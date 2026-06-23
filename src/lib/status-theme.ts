import type { TaskStatus } from "./types";

/**
 * 看板列的状态视觉主题。
 *  - top:   列顶部细色条，状态最直观的锚点
 *  - dot:   列头标题前的小圆点
 *  - title: 标题文字颜色
 *  - ring:  拖拽 hover 时给列卡的高亮 ring
 *
 * 与 task-card 的 statusBarClass 保持一致，避免风格漂移。
 * 同时被项目看板 (project/board.tsx) 与成员工作台 (member/member-kanban.tsx) 复用。
 */
export const STATUS_THEME: Record<
  TaskStatus,
  { top: string; dot: string; title: string; ring: string }
> = {
  todo: {
    top: "border-t-muted-foreground/30",
    dot: "bg-muted-foreground/50",
    title: "text-foreground",
    ring: "ring-muted-foreground/40",
  },
  doing: {
    top: "border-t-info",
    dot: "bg-info",
    title: "text-info",
    ring: "ring-info/60",
  },
  blocked: {
    top: "border-t-warn",
    dot: "bg-warn",
    title: "text-warn",
    ring: "ring-warn/60",
  },
  done: {
    top: "border-t-success",
    dot: "bg-success",
    title: "text-success",
    ring: "ring-success/60",
  },
  // 已取消：中止 / 作废，视觉上要明显「弱化、退场」，所以用比 todo 更淡的灰，
  // 不借用 destructive（红）——取消是主动决定，不是错误，红色会误导成报错。
  canceled: {
    top: "border-t-muted-foreground/25",
    dot: "bg-muted-foreground/40",
    title: "text-muted-foreground",
    ring: "ring-muted-foreground/40",
  },
};
