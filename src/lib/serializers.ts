import type { Prisma, Project } from "@prisma/client";
import type { ProjectDTO, TaskDTO, TaskStatus } from "./types";

const taskInclude = {
  project: true,
  assignee: true,
  yuqueLinks: true,
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: typeof taskInclude;
}>;

export const TASK_INCLUDE = taskInclude;

/**
 * 项目序列化的唯一出口。
 * 任何把 Prisma Project（或同等形状的对象）转 ProjectDTO 的地方都应走这里，
 * 避免再加字段时还要追着 10+ 处 inline 出口逐个补。
 */
export function serializeProject(p: Project): ProjectDTO {
  return {
    id: p.id,
    name: p.name,
    archived: p.archived,
    isDefault: p.isDefault,
    categoryId: p.categoryId,
    starSortIndex: p.starSortIndex,
  };
}

export function serializeTask(task: TaskWithRelations): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    creatorId: task.creatorId,
    status: task.status as TaskStatus,
    sortIndex: task.sortIndex,
    focusedToday: task.focusedToday,
    blockedReason: task.blockedReason,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    yuqueLinks: task.yuqueLinks.map((l) => ({
      id: l.id,
      url: l.url,
      title: l.title,
    })),
    project: serializeProject(task.project),
    assignee: task.assignee
      ? { id: task.assignee.id, name: task.assignee.name }
      : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
