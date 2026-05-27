import { prisma } from "@/lib/db";
import { TASK_INCLUDE, serializeTask } from "@/lib/serializers";
import type { MemberDTO, ProjectCategoryDTO, ProjectDTO } from "@/lib/types";
import { MemberWorkbench } from "../[id]/workbench";

export const dynamic = "force-dynamic";

/**
 * 「未分配」工作台：展示所有 assigneeId IS NULL 的任务，
 * 供管理员把任务派给具体成员前集中查看 / 整理。
 *
 * 静态段 `unassigned` 在 Next.js 路由匹配中优先于 `[id]`，
 * 因此与 /member/[id] 共存不会冲突（同 /member/overview 套路）。
 */
export default async function UnassignedPage() {
  const [allMembers, projects, categoriesRaw, tasks] = await Promise.all([
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
    prisma.task.findMany({
      where: { assigneeId: null },
      include: TASK_INCLUDE,
      orderBy: { sortIndex: "asc" },
    }),
  ]);

  const memberDtos: MemberDTO[] = allMembers.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role as MemberDTO["role"],
  }));

  const projectDtos: ProjectDTO[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    archived: p.archived,
    isDefault: p.isDefault,
    categoryId: p.categoryId,
  }));

  const categoryDtos: ProjectCategoryDTO[] = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    isDefault: c.isDefault,
    sortIndex: c.sortIndex,
  }));

  return (
    <MemberWorkbench
      member={null}
      allMembers={memberDtos}
      projects={projectDtos}
      categories={categoryDtos}
      initialTasks={tasks.map(serializeTask)}
    />
  );
}
