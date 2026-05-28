import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { errorJson, handleError, okJson } from "@/lib/api";
import { appendSortIndex } from "@/lib/sort-index";
import { serializeProject } from "@/lib/serializers";

const UpdateInput = z
  .object({
    name: z.string().min(1).max(100).optional(),
    archived: z.boolean().optional(),
    /** 把项目移动到指定分类 */
    categoryId: z.string().min(1).optional(),
    /**
     * 标记 / 取消「重点项目」。后端基于此切换 starSortIndex：
     *  - true  → 分配「重点区域队尾」浮点排序键
     *  - false → starSortIndex 设为 null（视为未加星）
     */
    starred: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.archived !== undefined ||
      v.categoryId !== undefined ||
      v.starred !== undefined,
    { message: "EMPTY_UPDATE" },
  );

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
    const data = UpdateInput.parse(await req.json());

    const current = await prisma.project.findUnique({
      where: { id: params.id },
      select: { archived: true, isDefault: true },
    });
    if (!current) return errorJson("NOT_FOUND", 404);

    // 默认项目（如「收集箱」）禁止归档；改名 / 改分类仍允许。
    if (current.isDefault && data.archived === true) {
      return errorJson("DEFAULT_PROJECT_NOT_ARCHIVABLE", 400);
    }

    // 取消归档时把项目挂回「活跃项目」队尾，避免旧 sortIndex 卡在奇怪位置。
    let extra: { sortIndex?: number; starSortIndex?: number | null } = {};
    if (data.archived === false && current.archived) {
      const activeSiblings = await prisma.project.findMany({
        where: { archived: false },
        select: { id: true, sortIndex: true },
        orderBy: { sortIndex: "asc" },
      });
      extra = { sortIndex: appendSortIndex(activeSiblings) };
    }

    // 切「重点项目」标记：true 时分配重点区队尾键，false 时置 null（脱离重点区）。
    // 归档项目不允许加星——已归档项目挂在「重点」顶部反而干扰；如果同时归档 + 取消加星
    // 则两者都生效；归档时若仍为加星状态，前端理应展示在已归档区，重点区按需过滤掉。
    if (data.starred !== undefined) {
      if (data.starred) {
        const starredSiblings = await prisma.project.findMany({
          where: { starSortIndex: { not: null } },
          select: { id: true, starSortIndex: true },
          orderBy: { starSortIndex: "asc" },
        });
        extra.starSortIndex = appendSortIndex(
          starredSiblings.map((s) => ({ id: s.id, sortIndex: s.starSortIndex! })),
        );
      } else {
        extra.starSortIndex = null;
      }
    }

    // 校验目标分类存在，避免 FK 报错带出 P2003
    if (data.categoryId) {
      const cat = await prisma.projectCategory.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!cat) return errorJson("CATEGORY_NOT_FOUND", 400);
    }

    // starred 是组件 UI 字段，不是 Prisma 列；从 data 里剥出去避免 update 报错
    const { starred: _starred, ...prismaPatch } = data;
    const project = await prisma.project.update({
      where: { id: params.id },
      data: { ...prismaPatch, ...extra },
    });
    return okJson(serializeProject(project));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
    const exists = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, isDefault: true },
    });
    if (!exists) return errorJson("NOT_FOUND", 404);
    // 默认项目（「收集箱」）禁止删除：保证用户始终有一个收纳零散任务的去处。
    if (exists.isDefault) {
      return errorJson("DEFAULT_PROJECT_NOT_DELETABLE", 400);
    }
    // 任务删除由 schema 的 onDelete: Cascade 处理
    await prisma.project.delete({ where: { id: params.id } });
    return okJson({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
