import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleError, errorJson, okJson } from "@/lib/api";
import { serializeTask, TASK_INCLUDE } from "@/lib/serializers";
import {
  computeSortIndex,
  needsRebalance,
  rebalance,
} from "@/lib/sort-index";

/**
 * 拖拽排序 API。
 *
 * 排序作用域：
 *  - 默认作用域 = 该任务的 assigneeId（个人执行顺序）。
 *  - 如果目标任务的 assigneeId 不同，意味着同时发生了"重新指派"，
 *    我们用目标任务的 assigneeId 接管作用域。
 *
 * 调用方仅传 draggedId / targetId / position（before|after）。
 * sortIndex 计算由服务端完成，避免客户端时序竞争。
 *
 * 触发 rebalance 时返回 rebalanced = true，客户端应整体刷新该作用域列表。
 */

const Input = z.object({
  draggedId: z.string().min(1),
  targetId: z.string().min(1),
  position: z.enum(["before", "after"]),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const { draggedId, targetId, position } = Input.parse(await req.json());

    if (draggedId === targetId) return errorJson("SAME_ID", 400);

    const [dragged, target] = await Promise.all([
      prisma.task.findUnique({ where: { id: draggedId } }),
      prisma.task.findUnique({ where: { id: targetId } }),
    ]);
    if (!dragged || !target) return errorJson("NOT_FOUND", 404);

    const scopeAssigneeId = target.assigneeId ?? dragged.assigneeId;

    const siblings = await prisma.task.findMany({
      where: scopeAssigneeId
        ? { assigneeId: scopeAssigneeId }
        : { assigneeId: null },
      select: { id: true, sortIndex: true },
      orderBy: { sortIndex: "asc" },
    });

    const newIndex = computeSortIndex(siblings, draggedId, targetId, position);
    if (newIndex == null) return errorJson("CANNOT_COMPUTE_SORT_INDEX", 400);

    const updated = await prisma.task.update({
      where: { id: draggedId },
      data: {
        sortIndex: newIndex,
        ...(scopeAssigneeId !== dragged.assigneeId
          ? { assigneeId: scopeAssigneeId }
          : {}),
      },
      include: TASK_INCLUDE,
    });

    const after = siblings
      .map((s) => (s.id === draggedId ? { ...s, sortIndex: newIndex } : s))
      .sort((a, b) => a.sortIndex - b.sortIndex);

    if (needsRebalance(after)) {
      const next = rebalance(after);
      await prisma.$transaction(
        next.map((s) =>
          prisma.task.update({
            where: { id: s.id },
            data: { sortIndex: s.sortIndex },
          }),
        ),
      );
      return okJson({ task: serializeTask(updated), rebalanced: true });
    }

    return okJson({ task: serializeTask(updated), rebalanced: false });
  } catch (e) {
    return handleError(e);
  }
}
