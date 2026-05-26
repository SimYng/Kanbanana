import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { getCurrentUser } from "@/lib/session";
import { PROJECT_COLOR_HEX, type ProjectColor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectsListPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { tasks: true },
      },
    },
  });

  const counts = await Promise.all(
    projects.map(async (p) => {
      const [done, blocked, doing] = await Promise.all([
        prisma.task.count({ where: { projectId: p.id, status: "done" } }),
        prisma.task.count({ where: { projectId: p.id, status: "blocked" } }),
        prisma.task.count({ where: { projectId: p.id, status: "doing" } }),
      ]);
      return { done, blocked, doing };
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">项目看板</h1>
          <p className="text-sm text-muted-foreground">
            选择项目进入 Kanban 视图，按"待办 / 进行中 / 阻塞 / 已完成"查看
          </p>
        </div>
        {isAdmin && <NewProjectDialog />}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">还没有项目。</p>
          {isAdmin ? (
            <NewProjectDialog />
          ) : (
            <p className="text-xs text-muted-foreground">
              请联系管理员创建项目。
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, idx) => {
            const c = counts[idx];
            const pct =
              p._count.tasks === 0 ? 0 : Math.round((c.done / p._count.tasks) * 100);
            return (
              <Link key={p.id} href={`/project/${p.id}`}>
                <Card className="h-full transition-colors hover:border-foreground/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: PROJECT_COLOR_HEX[p.color as ProjectColor] }}
                      />
                      {p.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: PROJECT_COLOR_HEX[p.color as ProjectColor],
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        完成 {c.done}/{p._count.tasks} · 进行 {c.doing}
                      </span>
                      {c.blocked > 0 && (
                        <Badge variant="warn" className="font-normal">
                          阻塞 ×{c.blocked}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
