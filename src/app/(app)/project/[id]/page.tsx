import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { TASK_INCLUDE, serializeTask } from "@/lib/serializers";
import type { MemberDTO, ProjectColor, ProjectDTO } from "@/lib/types";
import { ProjectBoard } from "./board";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const [user, project, projects, members, tasks, taskCounts] = await Promise.all([
    getCurrentUser(),
    prisma.project.findUnique({ where: { id: params.id } }),
    prisma.project.findMany({
      orderBy: [{ archived: "asc" }, { sortIndex: "asc" }, { createdAt: "asc" }],
    }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({
      where: { projectId: params.id },
      include: TASK_INCLUDE,
      orderBy: { sortIndex: "asc" },
    }),
    // 顶部项目切换栏每个 chip 需要 todo/doing/blocked 计数，一次性聚合
    prisma.task.groupBy({
      by: ["projectId", "status"],
      _count: { _all: true },
    }),
  ]);

  if (!project) notFound();

  const projectDtos: ProjectDTO[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color as ProjectColor,
    archived: p.archived,
    isDefault: p.isDefault,
    categoryId: p.categoryId,
  }));

  const memberDtos: MemberDTO[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role as MemberDTO["role"],
  }));

  const projectStats: Record<string, { todo: number; doing: number; blocked: number }> = {};
  for (const row of taskCounts) {
    const slot = (projectStats[row.projectId] ??= { todo: 0, doing: 0, blocked: 0 });
    if (row.status === "todo") slot.todo = row._count._all;
    else if (row.status === "doing") slot.doing = row._count._all;
    else if (row.status === "blocked") slot.blocked = row._count._all;
  }

  return (
    <ProjectBoard
      project={{
        id: project.id,
        name: project.name,
        color: project.color as ProjectColor,
        archived: project.archived,
        isDefault: project.isDefault,
        categoryId: project.categoryId,
      }}
      projects={projectDtos}
      projectStats={projectStats}
      members={memberDtos}
      initialTasks={tasks.map(serializeTask)}
      isAdmin={user?.role === "admin"}
    />
  );
}
