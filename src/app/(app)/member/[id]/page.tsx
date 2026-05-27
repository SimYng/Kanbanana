import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TASK_INCLUDE, serializeTask } from "@/lib/serializers";
import type { MemberDTO, ProjectDTO, ProjectColor } from "@/lib/types";
import { MemberWorkbench } from "./workbench";

export const dynamic = "force-dynamic";

export default async function MemberPage({
  params,
}: {
  params: { id: string };
}) {
  const [member, allMembers, projects, tasks] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.user.findMany({
      where: { role: "member" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({
      orderBy: [{ archived: "asc" }, { sortIndex: "asc" }, { createdAt: "asc" }],
    }),
    prisma.task.findMany({
      where: { assigneeId: params.id },
      include: TASK_INCLUDE,
      orderBy: { sortIndex: "asc" },
    }),
  ]);

  if (!member) notFound();

  const memberDtos: MemberDTO[] = allMembers.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role as MemberDTO["role"],
  }));

  const projectDtos: ProjectDTO[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color as ProjectColor,
    archived: p.archived,
  }));

  return (
    <MemberWorkbench
      member={{ id: member.id, name: member.name, email: member.email, role: member.role as MemberDTO["role"] }}
      allMembers={memberDtos}
      projects={projectDtos}
      initialTasks={tasks.map(serializeTask)}
    />
  );
}
