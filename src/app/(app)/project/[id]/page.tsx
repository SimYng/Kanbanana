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
  const [user, project, projects, members, tasks] = await Promise.all([
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
  ]);

  if (!project) notFound();

  const projectDtos: ProjectDTO[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color as ProjectColor,
    archived: p.archived,
  }));

  const memberDtos: MemberDTO[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role as MemberDTO["role"],
  }));

  return (
    <ProjectBoard
      project={{
        id: project.id,
        name: project.name,
        color: project.color as ProjectColor,
        archived: project.archived,
      }}
      projects={projectDtos}
      members={memberDtos}
      initialTasks={tasks.map(serializeTask)}
      isAdmin={user?.role === "admin"}
    />
  );
}
