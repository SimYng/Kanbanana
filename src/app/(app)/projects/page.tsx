import { Archive, FolderKanban, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { NewCategoryDialog } from "@/components/new-category-dialog";
import { ProjectGrid, type ProjectGridItem } from "@/components/project-grid";
import { CategorySection } from "@/components/category-section";
import { getCurrentUser } from "@/lib/session";
import { serializeProject } from "@/lib/serializers";
import type { ProjectCategoryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectsListPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  const [projects, categoriesRaw] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ archived: "asc" }, { sortIndex: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { tasks: true } },
      },
    }),
    prisma.projectCategory.findMany({
      orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const categories: ProjectCategoryDTO[] = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    isDefault: c.isDefault,
    sortIndex: c.sortIndex,
  }));

  const stats: ProjectGridItem[] = await Promise.all(
    projects.map(async (p) => {
      const [done, blocked, doing, canceled] = await Promise.all([
        prisma.task.count({ where: { projectId: p.id, status: "done" } }),
        prisma.task.count({ where: { projectId: p.id, status: "blocked" } }),
        prisma.task.count({ where: { projectId: p.id, status: "doing" } }),
        prisma.task.count({ where: { projectId: p.id, status: "canceled" } }),
      ]);
      return {
        project: serializeProject(p),
        // 已取消任务移出范围：不计入总数，避免拉低项目完成进度
        total: p._count.tasks - canceled,
        done,
        doing,
        blocked,
      };
    }),
  );

  const active = stats.filter((s) => !s.project.archived);
  const archived = stats.filter((s) => s.project.archived);

  // 「重点项目」：仅未归档 + 已加星，按 starSortIndex 升序展示
  const starred = active
    .filter((s) => s.project.starSortIndex !== null)
    .sort(
      (a, b) =>
        (a.project.starSortIndex as number) -
        (b.project.starSortIndex as number),
    );

  // 按分类分桶（保持分类的排序，桶内项目按 sortIndex 已经排过了）
  const byCategory = new Map<string, ProjectGridItem[]>();
  for (const c of categories) byCategory.set(c.id, []);
  for (const item of active) {
    const arr = byCategory.get(item.project.categoryId);
    if (arr) {
      arr.push(item);
    } else {
      // 项目挂在已不存在的分类上（理论上 FK Restrict 不会发生，兜底）：
      // 落到默认分类，避免静默丢失。
      const fallback = categories.find((c) => c.isDefault);
      if (fallback) byCategory.get(fallback.id)!.push(item);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">项目看板</h1>
            <Badge variant="muted" className="font-normal">
              <FolderKanban className="mr-1 h-3 w-3" />
              {stats.length} 个项目
              {archived.length > 0 && (
                <span className="ml-1 text-muted-foreground/70">
                  （{active.length} 进行中 · {archived.length} 已归档）
                </span>
              )}
              <span className="ml-1.5 border-l border-border pl-1.5">
                {categories.length} 个分类
              </span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            选择项目进入 Kanban 视图，按"待办 / 进行中 / 阻塞 / 已完成"查看
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <NewCategoryDialog />
            <NewProjectDialog categories={categories} />
          </div>
        )}
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">还没有蕉给你的项目 🍌</p>
          {isAdmin ? (
            <NewProjectDialog categories={categories} />
          ) : (
            <p className="text-xs text-muted-foreground">请联系管理员创建项目。</p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/*
            「重点项目区」：只在有加星项目时显示。
            scope="starred" 的 ProjectGrid 拖拽会写 Project.starSortIndex，
            不影响分类内的常规 sortIndex；两套排序互不打架。
          */}
          {starred.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <h2 className="text-sm font-semibold tracking-tight">
                  重点项目
                </h2>
                <Badge variant="muted" className="font-normal">
                  {starred.length}
                </Badge>
              </div>
              <ProjectGrid
                items={starred}
                isAdmin={isAdmin}
                sortable
                categories={categories}
                scope="starred"
              />
            </section>
          )}

          <div className="space-y-6">
            {categories.map((c) => {
              const items = byCategory.get(c.id) ?? [];
              return (
                <CategorySection
                  key={c.id}
                  category={c}
                  items={items}
                  isAdmin={isAdmin}
                  categories={categories}
                />
              );
            })}
          </div>
        </div>
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
            <ProjectGrid
              items={archived}
              isAdmin={isAdmin}
              dimmed
              categories={categories}
            />
          </div>
        </details>
      )}
    </div>
  );
}
