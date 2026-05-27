import { computeSortIndex } from "./sort-index";
import type { TaskDTO } from "./types";

/**
 * 为拖拽排序计算「乐观 sortIndex」。
 *
 * 用途：调 /api/tasks/reorder 之前先在客户端算好新 sortIndex 立即写回 state，
 * 让 dnd-kit 在 drop 瞬间复位到的目标就是新位置，
 * 消除「先弹回原位 → API 返回后再跳到新位置」的闪烁。
 *
 * 与后端的一致性：
 *  - 用的是同一份 computeSortIndex
 *  - Scope 维度 = task.assigneeId（含 null），与后端 reorder 的 scope 一致
 *  - 跨 assignee 拖动 = 隐性「重新指派」，时序复杂，本地不再尝试乐观计算，
 *    返回 null 由调用方降级为「等后端返回再更新」（仍比所有人都不乐观好）
 *
 * @returns null 表示无法乐观计算（dragged/target 不在传入列表中、或跨 scope）
 */
export function computeOptimisticReorder(
  tasks: TaskDTO[],
  draggedId: string,
  targetId: string,
  position: "before" | "after",
): { newSortIndex: number; rollback: number } | null {
  const dragged = tasks.find((t) => t.id === draggedId);
  const target = tasks.find((t) => t.id === targetId);
  if (!dragged || !target) return null;
  if ((dragged.assigneeId ?? null) !== (target.assigneeId ?? null)) return null;

  const scopeId = dragged.assigneeId ?? null;
  const siblings = tasks
    .filter((t) => (t.assigneeId ?? null) === scopeId)
    .map((t) => ({ id: t.id, sortIndex: t.sortIndex }))
    .sort((a, b) => a.sortIndex - b.sortIndex);

  const newSortIndex = computeSortIndex(
    siblings,
    draggedId,
    targetId,
    position,
  );
  if (newSortIndex == null) return null;
  return { newSortIndex, rollback: dragged.sortIndex };
}
