import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { errorJson, handleError, okJson } from "@/lib/api";
import { appendSortIndex } from "@/lib/sort-index";
import { PROJECT_COLORS, type ProjectColor, type ProjectDTO } from "@/lib/types";

const UpdateInput = z
  .object({
    name: z.string().min(1).max(100).optional(),
    color: z.enum(PROJECT_COLORS as [ProjectColor, ...ProjectColor[]]).optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.color !== undefined || v.archived !== undefined,
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

    // 默认项目（如「杂事」）禁止归档；改名 / 改色仍允许。
    if (current.isDefault && data.archived === true) {
      return errorJson("DEFAULT_PROJECT_NOT_ARCHIVABLE", 400);
    }

    // 取消归档时把项目挂回「活跃项目」队尾，避免旧 sortIndex 卡在奇怪位置。
    let extra: { sortIndex?: number } = {};
    if (data.archived === false && current.archived) {
      const activeSiblings = await prisma.project.findMany({
        where: { archived: false },
        select: { id: true, sortIndex: true },
        orderBy: { sortIndex: "asc" },
      });
      extra = { sortIndex: appendSortIndex(activeSiblings) };
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: { ...data, ...extra },
    });
    return okJson<ProjectDTO>({
      id: project.id,
      name: project.name,
      color: project.color as ProjectColor,
      archived: project.archived,
      isDefault: project.isDefault,
    });
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
    // 默认项目（「杂事」收纳袋）禁止删除：保证用户始终有一个收纳零散任务的去处。
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
