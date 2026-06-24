/**
 * 看板 / 总览「列」的响应式布局惯用法（统一一处，避免改断点时三个文件各改一遍）。
 *
 * 移动端（<md）：列纵向堆叠 + 整页滚动（自然文档流），避免一屏里塞多个内部滚动框；
 * md+：恢复视口高度锁 + 列内独立滚动的看板布局。
 *
 * 被项目看板 (project/[id]/board.tsx)、成员工作台 (member/[id]/member-kanban.tsx)、
 * 成员总览 (member/overview/members-overview.tsx) 三处共用；各自的边框 / 宽度 / 间距
 * 等差异化 className 仍由调用点用 cn() 自行拼接，这里只收敛「同一套断点行为」。
 */

/** 看板列网格容器：<md 单列自然高度，md+ 撑满视口剩余高度并按列数分栏。 */
export const BOARD_GRID =
  "grid gap-3 md:min-h-0 md:flex-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

/** 列卡片高度：<md 自然高度，md+ 撑满 row 高度。与各自 flex/border/宽度 className 组合。 */
export const BOARD_COLUMN_FILL = "md:h-full md:min-h-0";

/** 列内容区滚动：<md 随内容自然增高（整页滚动），md+ 列内独立滚动。 */
export const BOARD_COLUMN_SCROLL = "md:min-h-0 md:flex-1 md:overflow-y-auto";
