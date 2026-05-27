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
 * 调用方有两种模式：
 *  A. 列内/跨列拖到具体位置：传 `targetId + position(before|after)`，
 *     可选 `targetStatus` 强制跨列时切换状态。
 *  B. 拖到（可能为空的）目标列底部：仅传 `targetStatus`，
 *     不带 targetId/position，服务端把任务排到 scope 末尾。
 *
 * 跨列时同步处理 `completedAt`：
 *  - 新状态 = done → 写入当前时间
 *  - 旧状态 = done、新状态 ≠ done → 清空
 *
 * sortIndex 计算由服务端完成，避免客户端时序竞争。
 * 触发 rebalance 时返回 rebalanced = true，客户端应整体刷新该作用域列表。
 */

const STATUS_ENUM = z.enum(["todo", "doing", "blocked", "done"]);

const Input = z
  .object({
    draggedId: z.string().min(1),
    targetId: z.string().min(1).optional(),
    position: z.enum(["before", "after"]).optional(),
    targetStatus: STATUS_ENUM.optional(),
  })
  .refine(
    (d) => Boolean(d.targetId && d.position) || Boolean(d.targetStatus),
    { message: "either (targetId + position) or targetStatus is required" },
  );

export async function POST(req: Request) {
  try {
    await requireUser();
    const { draggedId, targetId, position, targetStatus } = Input.parse(
      await req.json(),
    );

    if (targetId && draggedId === targetId) return errorJson("SAME_ID", 400);

    const dragged = await prisma.task.findUnique({ where: { id: draggedId } });
    if (!dragged) return errorJson("NOT_FOUND", 404);

    const target = targetId
      ? await prisma.task.findUnique({ where: { id: targetId } })
      : null;
    if (targetId && !target) return errorJson("NOT_FOUND", 404);

    const scopeAssigneeId = target?.assigneeId ?? dragged.assigneeId;
    const newStatus = targetStatus ?? target?.status ?? dragged.status;

    const siblings = await prisma.task.findMany({
      where: scopeAssigneeId
        ? { assigneeId: scopeAssigneeId }
        : { assigneeId: null },
      select: { id: true, sortIndex: true },
      orderBy: { sortIndex: "asc" },
    });

    let newIndex: number | null;
    if (target && position) {
      newIndex = computeSortIndex(siblings, draggedId, target.id, position);
    } else {
      // 拖到空列 / 仅状态切换：放到 scope 末尾
      const maxIdx = siblings.reduce(
        (m, s) => (s.sortIndex > m ? s.sortIndex : m),
        Number.NEGATIVE_INFINITY,
      );
      newIndex = Number.isFinite(maxIdx) ? maxIdx + 1 : 1;
    }
    if (newIndex == null) return errorJson("CANNOT_COMPUTE_SORT_INDEX", 400);

    // 跨状态时同步维护 completedAt
    const statusChanged = newStatus !== dragged.status;
    const completedAtPatch: { completedAt?: Date | null } = {};
    if (statusChanged) {
      if (newStatus === "done") completedAtPatch.completedAt = new Date();
      else if (dragged.status === "done") completedAtPatch.completedAt = null;
    }

    const updated = await prisma.task.update({
      where: { id: draggedId },
      data: {
        sortIndex: newIndex,
        ...(scopeAssigneeId !== dragged.assigneeId
          ? { assigneeId: scopeAssigneeId }
          : {}),
        ...(statusChanged ? { status: newStatus } : {}),
        ...completedAtPatch,
      },
      include: TASK_INCLUDE,
    });

    const after = siblings
      .map((s) => (s.id === draggedId ? { ...s, sortIndex: newIndex! } : s))
      .concat(
        siblings.some((s) => s.id === draggedId)
          ? []
          : [{ id: draggedId, sortIndex: newIndex }],
      )
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
