export type TaskStatus = "todo" | "doing" | "blocked" | "done" | "canceled";
export type UserRole = "admin" | "member";

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "doing",
  "blocked",
  "done",
  "canceled",
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "待办",
  doing: "进行中",
  blocked: "阻塞",
  done: "已完成",
  canceled: "已取消",
};

/**
 * 「终态」：done（做完）/ canceled（不做了）。
 * 都不再是手头活，不计入工作量 / 待办统计；区别只在 done 算业绩、canceled 不算。
 */
export const TERMINAL_STATUSES: TaskStatus[] = ["done", "canceled"];

/** 是否「活跃 / 进行中」状态（非终态）—— 工作量、未完成数等统计的口径。 */
export function isActiveStatus(status: TaskStatus): boolean {
  return status !== "done" && status !== "canceled";
}

export interface TaskDTO {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  assigneeId: string | null;
  creatorId: string;
  status: TaskStatus;
  sortIndex: number;
  focusedToday: boolean;
  blockedReason: string | null;
  dueDate: string | null;
  /** 状态变为 done 时由 API 自动写入；切回非 done 时清空。 */
  completedAt: string | null;
  /** 状态变为 canceled 时由 API 自动写入；切回非 canceled 时清空。与 completedAt 互斥。 */
  canceledAt: string | null;
  yuqueLinks: { id: string; url: string; title: string | null }[];
  project: ProjectDTO;
  assignee: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ProjectDTO {
  id: string;
  name: string;
  archived: boolean;
  /** 默认项目（如「收集箱」）：禁止删除 / 归档。系统中至多一个。 */
  isDefault: boolean;
  /** 所属分类 id。所有项目都属于某个分类（默认为「未分类」）。 */
  categoryId: string;
  /**
   * 「重点项目」标记 + 顺序：
   *  - null  → 未加星
   *  - 非 null → 已加星，值是「重点项目区」内的浮点排序键
   * UI 层用 `project.starSortIndex !== null` 判断是否加星。
   */
  starSortIndex: number | null;
}

export interface ProjectCategoryDTO {
  id: string;
  name: string;
  /** 默认分类（「未分类」）：禁止删除。系统中至多一个。 */
  isDefault: boolean;
  sortIndex: number;
}
