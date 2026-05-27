import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { errorJson, handleError, okJson } from "@/lib/api";
import {
  computeSortIndex,
  needsRebalance,
  rebalance,
} from "@/lib/sort-index";
import { type ProjectColor, type ProjectDTO } from "@/lib/types";

/**
 * 项目拖拽排序 API（admin 专属）。
 *
 * 排序作用域固定为「未归档项目」。归档项目不参与排序，也不能作为拖拽目标。
 * 复用 lib/sort-index 的算法，与任务排序保持一致心智。
 */

const Input = z.object({
  draggedId: z.string().min(1),
  targetId: z.string().min(1),
  position: z.enum(["before", "after"]),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { draggedId, targetId, position } = Input.parse(await req.json());

    if (draggedId === targetId) return errorJson("SAME_ID", 400);

    const [dragged, target] = await Promise.all([
      prisma.project.findUnique({ where: { id: draggedId } }),
      prisma.project.findUnique({ where: { id: targetId } }),
    ]);
    if (!dragged || !target) return errorJson("NOT_FOUND", 404);
    if (dragged.archived || target.archived) {
      return errorJson("ARCHIVED_NOT_SORTABLE", 400);
    }
    // 项目列表已按分类分组渲染，只允许在同分类内部拖拽；
    // 跨分类移动请走「编辑项目」对话框，避免视觉与数据脱节。
    if (dragged.categoryId !== target.categoryId) {
      return errorJson("CROSS_CATEGORY_NOT_SORTABLE", 400);
    }

    // 把排序作用域收窄到「同分类 + 未归档」，
    // 这样 sortIndex 调整只影响同一分类内部的相对顺序，分类之间互不干扰。
    const siblings = await prisma.project.findMany({
      where: { archived: false, categoryId: dragged.categoryId },
      select: { id: true, sortIndex: true },
      orderBy: { sortIndex: "asc" },
    });

    const newIndex = computeSortIndex(siblings, draggedId, targetId, position);
    if (newIndex == null) return errorJson("CANNOT_COMPUTE_SORT_INDEX", 400);

    const updated = await prisma.project.update({
      where: { id: draggedId },
      data: { sortIndex: newIndex },
    });

    const after = siblings
      .map((s) => (s.id === draggedId ? { ...s, sortIndex: newIndex } : s))
      .sort((a, b) => a.sortIndex - b.sortIndex);

    const toDTO = (p: typeof updated): ProjectDTO => ({
      id: p.id,
      name: p.name,
      color: p.color as ProjectColor,
      archived: p.archived,
      isDefault: p.isDefault,
      categoryId: p.categoryId,
    });

    if (needsRebalance(after)) {
      const next = rebalance(after);
      await prisma.$transaction(
        next.map((s) =>
          prisma.project.update({
            where: { id: s.id },
            data: { sortIndex: s.sortIndex },
          }),
        ),
      );
      return okJson({ project: toDTO(updated), rebalanced: true });
    }

    return okJson({ project: toDTO(updated), rebalanced: false });
  } catch (e) {
    return handleError(e);
  }
}
