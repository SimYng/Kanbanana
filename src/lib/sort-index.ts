/**
 * 拖拽排序工具：基于浮点数 sortIndex 的"中点插入"算法。
 *
 * 使用约束（重要）：
 *  - 列表渲染时务必按 sortIndex 升序排列
 *  - 拖拽时只更新被移动的一项，避免全表写回
 *  - 浮点精度极限大约支持连续插入 50+ 次，达到阈值时调用 needsRebalance() 触发 rebalance
 *
 * 未来若需要无限插入精度，可平滑升级为字符串 LexoRank（值类型从 Float 改为 String）。
 */

const STEP = 1024;
const MIN_GAP = 0.0001;

export type Sortable = { id: string; sortIndex: number };

/**
 * 计算把"被拖卡片"插入到目标位置所需的新 sortIndex。
 *
 * @param sortedSiblings 同分组内的所有任务（已按 sortIndex 升序排列），可包含被拖卡片本身
 * @param draggedId     被拖卡片 id
 * @param targetId      目标卡片 id（拖到 Ta 的前面或后面）
 * @param position      "before" | "after"
 */
export function computeSortIndex(
  sortedSiblings: Sortable[],
  draggedId: string,
  targetId: string,
  position: "before" | "after",
): number | null {
  if (draggedId === targetId) return null;

  const others = sortedSiblings.filter((t) => t.id !== draggedId);
  const targetIdx = others.findIndex((t) => t.id === targetId);
  if (targetIdx === -1) return null;

  const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
  const prev = others[insertIdx - 1];
  const next = others[insertIdx];

  if (!prev && next) return next.sortIndex - STEP;
  if (prev && !next) return prev.sortIndex + STEP;
  if (prev && next) return (prev.sortIndex + next.sortIndex) / 2;
  return STEP;
}

/**
 * 拖到列表最末（追加到尾部）。
 */
export function appendSortIndex(sortedSiblings: Sortable[]): number {
  if (sortedSiblings.length === 0) return STEP;
  return sortedSiblings[sortedSiblings.length - 1].sortIndex + STEP;
}

/**
 * 拖到列表最前（插入到头部）。
 */
export function prependSortIndex(sortedSiblings: Sortable[]): number {
  if (sortedSiblings.length === 0) return STEP;
  return sortedSiblings[0].sortIndex - STEP;
}

/**
 * 检测同组任务里是否已有相邻两个 sortIndex 几乎相等的情况，
 * 真发生时调用方应触发一次 rebalance（重排所有 sortIndex 为 STEP, 2*STEP, …）。
 */
export function needsRebalance(sortedSiblings: Sortable[]): boolean {
  for (let i = 1; i < sortedSiblings.length; i++) {
    if (
      Math.abs(sortedSiblings[i].sortIndex - sortedSiblings[i - 1].sortIndex) <
      MIN_GAP
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 重排同组任务的 sortIndex，返回 [{id, sortIndex}] 待批量写库。
 */
export function rebalance(sortedSiblings: Sortable[]): Sortable[] {
  return sortedSiblings.map((t, i) => ({
    id: t.id,
    sortIndex: (i + 1) * STEP,
  }));
}

export const SORT_STEP = STEP;
