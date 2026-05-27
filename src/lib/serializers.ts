import type { Prisma } from "@prisma/client";
import type {
  ProjectColor,
  TaskDTO,
  TaskPriority,
  TaskStatus,
} from "./types";

const taskInclude = {
  project: true,
  assignee: true,
  yuqueLinks: true,
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: typeof taskInclude;
}>;

export const TASK_INCLUDE = taskInclude;

export function serializeTask(task: TaskWithRelations): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    creatorId: task.creatorId,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    sortIndex: task.sortIndex,
    focusedToday: task.focusedToday,
    blockedReason: task.blockedReason,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    yuqueLinks: task.yuqueLinks.map((l) => ({
      id: l.id,
      url: l.url,
      title: l.title,
    })),
    project: {
      id: task.project.id,
      name: task.project.name,
      color: task.project.color as ProjectColor,
      archived: task.project.archived,
    },
    assignee: task.assignee
      ? { id: task.assignee.id, name: task.assignee.name }
      : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
