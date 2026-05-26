import Link from "next/link";
import { Archive } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectActionsMenu } from "@/components/project-actions-menu";
import { getCurrentUser } from "@/lib/session";
import { PROJECT_COLOR_HEX, type ProjectColor, type ProjectDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ProjectWithStats = {
  project: ProjectDTO;
  total: number;
  done: number;
  doing: number;
  blocked: number;
};

export default async function ProjectsListPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  const projects = await prisma.project.findMany({
    orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { tasks: true } },
    },
  });

  const stats: ProjectWithStats[] = await Promise.all(
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
        <ProjectGrid items={active} isAdmin={isAdmin} />
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

function ProjectGrid({
  items,
  isAdmin,
  dimmed,
}: {
  items: ProjectWithStats[];
  isAdmin: boolean;
  dimmed?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        这里空空如也
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => {
        const { project, total, done, doing, blocked } = s;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        return (
          <div key={project.id} className="relative">
            <Link href={`/project/${project.id}`}>
              <Card
                className={cn(
                  "h-full transition-colors hover:border-foreground/30",
                  dimmed && "opacity-70",
                )}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 pr-10 text-base">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: PROJECT_COLOR_HEX[project.color] }}
                    />
                    <span className="truncate">{project.name}</span>
                    {project.archived && (
                      <Badge variant="muted" className="ml-1 font-normal">
                        已归档
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: PROJECT_COLOR_HEX[project.color],
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      完成 {done}/{total} · 进行 {doing}
                    </span>
                    {blocked > 0 && (
                      <Badge variant="warn" className="font-normal">
                        阻塞 ×{blocked}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
            {isAdmin && (
              <div className="absolute right-2 top-2">
                <ProjectActionsMenu project={project} taskCount={total} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
