export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type UserRole = "admin" | "member";

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "blocked", "done"];
export const TASK_PRIORITIES: TaskPriority[] = ["P0", "P1", "P2", "P3"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "待办",
  doing: "进行中",
  blocked: "阻塞",
  done: "已完成",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  P0: "P0 紧急",
  P1: "P1 高",
  P2: "P2 中",
  P3: "P3 低",
};

export interface TaskDTO {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  assigneeId: string | null;
  creatorId: string;
  status: TaskStatus;
  priority: TaskPriority;
  sortIndex: number;
  focusedToday: boolean;
  blockedReason: string | null;
  dueDate: string | null;
  /** 状态变为 done 时由 API 自动写入；切回非 done 时清空。 */
  completedAt: string | null;
  yuqueLinks: { id: string; url: string; title: string | null }[];
  project: {
    id: string;
    name: string;
    archived: boolean;
    isDefault: boolean;
    categoryId: string;
  };
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
}

export interface ProjectCategoryDTO {
  id: string;
  name: string;
  /** 默认分类（「未分类」）：禁止删除。系统中至多一个。 */
  isDefault: boolean;
  sortIndex: number;
}
