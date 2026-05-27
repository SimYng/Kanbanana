export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type UserRole = "admin" | "member";
export type ProjectColor =
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "pink"
  | "yellow"
  | "gray";

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

export const PROJECT_COLORS: ProjectColor[] = [
  "blue",
  "purple",
  "green",
  "orange",
  "pink",
  "yellow",
  "gray",
];

export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = {
  blue: "#3b82f6",
  purple: "#a855f7",
  green: "#22c55e",
  orange: "#f97316",
  pink: "#ec4899",
  yellow: "#eab308",
  gray: "#737373",
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
    color: ProjectColor;
    archived: boolean;
    isDefault: boolean;
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
  color: ProjectColor;
  archived: boolean;
  /** 默认项目（如「杂事」收纳袋）：禁止删除 / 归档。系统中至多一个。 */
  isDefault: boolean;
}
