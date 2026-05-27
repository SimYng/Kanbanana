import { Archive } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectGrid, type ProjectGridItem } from "@/components/project-grid";
import { getCurrentUser } from "@/lib/session";
import type { ProjectColor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectsListPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  const projects = await prisma.project.findMany({
    orderBy: [{ archived: "asc" }, { sortIndex: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { tasks: true } },
    },
  });

  const stats: ProjectGridItem[] = await Promise.all(
    projects.map(async (p) => {
      const [done, blocked, doing] = await Promise.all([
        prisma.task.count({ where: { projectId: p.id, status: "done" } }),
        prisma.task.count({ where: { projectId: p.id, status: "blocked" } }),
        prisma.task.count({ where: { projectId: p.id, status: "doing" } }),
      ]);
      return {
        project: {
          id: p.id,
          name: p.name,
          color: p.color as ProjectColor,
          archived: p.archived,
        },
        total: p._count.tasks,
        done,
        doing,
        blocked,
      };
    }),
  );

  const active = stats.filter((s) => !s.project.archived);
  const archived = stats.filter((s) => s.project.archived);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">项目看板</h1>
          <p className="text-sm text-muted-foreground">
            选择项目进入 Kanban 视图，按"待办 / 进行中 / 阻塞 / 已完成"查看
          </p>
        </div>
        {isAdmin && <NewProjectDialog />}
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">还没有蕉给你的项目 🍌</p>
          {isAdmin ? (
            <NewProjectDialog />
          ) : (
            <p className="text-xs text-muted-foreground">请联系管理员创建项目。</p>
          )}
        </div>
      ) : (
        <ProjectGrid items={active} isAdmin={isAdmin} sortable />
      )}

      {archived.length > 0 && (
        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
            <Archive className="h-4 w-4 text-muted-foreground" />
            已归档项目
            <Badge variant="muted" className="font-normal">
              {archived.length}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
              展开
            </span>
            <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">
              收起
            </span>
          </summary>
          <div className="border-t p-4">
            <ProjectGrid items={archived} isAdmin={isAdmin} dimmed />
          </div>
        </details>
      )}
    </div>
  );
}
