import { prisma } from "@/lib/db";
import { TASK_INCLUDE, serializeProject, serializeTask } from "@/lib/serializers";
import type { MemberDTO, ProjectCategoryDTO, ProjectDTO } from "@/lib/types";
import { MembersOverview } from "./members-overview";

export const dynamic = "force-dynamic";

/**
 * 成员总览页：每个非管理员一列横向并排，全员手头任务一屏对照。
 *
 * 静态段 `overview` 在 Next.js 路由中优先于 `[id]`，
 * 因此与 /member/[id] 共存不会冲突。
 */
export default async function MembersOverviewPage() {
  const [members, projects, categoriesRaw, tasks] = await Promise.all([
    prisma.user.findMany({
      where: { role: "member" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({
      orderBy: [{ archived: "asc" }, { sortIndex: "asc" }, { createdAt: "asc" }],
    }),
    prisma.projectCategory.findMany({
      orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
    }),
    // 同时拉取「已分配」和「未分配」任务：未分配单独成一列展示
    prisma.task.findMany({
      include: TASK_INCLUDE,
      orderBy: { sortIndex: "asc" },
    }),
  ]);

  const memberDtos: MemberDTO[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role as MemberDTO["role"],
  }));

  const projectDtos: ProjectDTO[] = projects.map(serializeProject);

  const categoryDtos: ProjectCategoryDTO[] = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    isDefault: c.isDefault,
    sortIndex: c.sortIndex,
  }));

  return (
    <MembersOverview
      members={memberDtos}
      projects={projectDtos}
      categories={categoryDtos}
      initialTasks={tasks.map(serializeTask)}
    />
  );
}
