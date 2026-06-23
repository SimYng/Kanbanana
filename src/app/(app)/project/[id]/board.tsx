"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BoardTaskCard } from "@/components/board-task-card";
import { SortableTaskList } from "@/components/sortable-task-list";
import { TaskDialog } from "@/components/task-dialog";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { BlockReasonDialog } from "@/components/block-reason-dialog";
import { ProjectActionsMenu } from "@/components/project-actions-menu";
import { apiFetch } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { STATUS_THEME } from "@/lib/status-theme";
import { computeOptimisticReorder } from "@/lib/optimistic-reorder";
import {
  STATUS_LABEL,
  TASK_STATUSES,
  type MemberDTO,
  type ProjectCategoryDTO,
  type ProjectDTO,
  type TaskDTO,
  type TaskStatus,
} from "@/lib/types";

type ProjectStat = { todo: number; doing: number; blocked: number };

interface ProjectBoardProps {
  project: ProjectDTO;
  projects: ProjectDTO[];
  categories: ProjectCategoryDTO[];
  /** 全部项目按状态聚合的任务数，用于顶部切换栏 chip 角标 */
  projectStats: Record<string, ProjectStat>;
  members: MemberDTO[];
  initialTasks: TaskDTO[];
  isAdmin?: boolean;
}

const EMPTY_STAT: ProjectStat = { todo: 0, doing: 0, blocked: 0 };

export function ProjectBoard({
  project: initialProject,
  projects,
  categories,
  projectStats,
  members,
  initialTasks,
  isAdmin,
}: ProjectBoardProps) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDTO>(initialProject);
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);
  const [openTask, setOpenTask] = useState<TaskDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockingTask, setBlockingTask] = useState<TaskDTO | null>(null);
  // router.refresh() 走 transition：不阻塞 UI，不打断乐观更新
  const [, startTransition] = useTransition();

  // 新建任务时只允许选未归档的项目（避免给归档项目加新任务）
  const assignableProjects = useMemo(
    () => projects.filter((p) => !p.archived || p.id === project.id),
    [projects, project.id],
  );

  const columns = useMemo(() => {
    return TASK_STATUSES.map((status) => ({
      status,
      tasks: tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.sortIndex - b.sortIndex),
    }));
  }, [tasks]);

  function patchLocal(updated: TaskDTO) {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      const next = exists
        ? prev.map((t) => (t.id === updated.id ? updated : t))
        : [...prev, updated];
      return next.sort((a, b) => a.sortIndex - b.sortIndex);
    });
  }

  async function refresh() {
    const next = await apiFetch<TaskDTO[]>(`/api/tasks?projectId=${project.id}`);
    setTasks(next);
  }

  async function handleAction(
    taskId: string,
    action: { kind: "status"; value: TaskStatus },
  ) {
    if (action.value === "blocked") {
      const target = tasks.find((t) => t.id === taskId);
      if (target) setBlockingTask(target);
      return;
    }
    try {
      const updated = await apiFetch<TaskDTO>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: action.value, blockedReason: null }),
      });
      patchLocal(updated);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function submitBlock(taskId: string, reason: string) {
    try {
      const updated = await apiFetch<TaskDTO>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "blocked", blockedReason: reason }),
      });
      patchLocal(updated);
      toast.success("已标记为阻塞");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  /**
   * 列内排序。先做客户端乐观更新，让 dnd-kit "复位"目标就是新位置，避免
   * 「先回原位 → API 返回后再跳到新位置」的闪烁。详见 lib/optimistic-reorder.ts。
   */
  async function handleReorder(
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) {
    const optimistic = computeOptimisticReorder(
      tasks,
      draggedId,
      targetId,
      position,
    );
    if (optimistic) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === draggedId
            ? { ...t, sortIndex: optimistic.newSortIndex }
            : t,
        ),
      );
    }

    try {
      const res = await apiFetch<{ task: TaskDTO; rebalanced: boolean }>(
        "/api/tasks/reorder",
        {
          method: "POST",
          body: JSON.stringify({ draggedId, targetId, position }),
        },
      );
      if (res.rebalanced) {
        await refresh();
      } else {
        patchLocal(res.task);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      if (optimistic) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === draggedId
              ? { ...t, sortIndex: optimistic.rollback }
              : t,
          ),
        );
      }
      toast.error(`排序失败：${(e as Error).message}`);
    }
  }

  const visibleSwitcherProjects = useMemo(
    () => projects.filter((p) => !p.archived || p.id === project.id),
    [projects, project.id],
  );

  // 键盘 ←/→ 在项目之间循环切换。
  // 跳过：输入框/可编辑元素中、任何弹窗打开、带修饰键、不在切换栏可达列表中。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (dialogOpen || blockingTask) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      const idx = visibleSwitcherProjects.findIndex((p) => p.id === project.id);
      if (idx === -1 || visibleSwitcherProjects.length < 2) return;

      const delta = e.key === "ArrowLeft" ? -1 : 1;
      const nextIdx =
        (idx + delta + visibleSwitcherProjects.length) %
        visibleSwitcherProjects.length;
      const next = visibleSwitcherProjects[nextIdx];
      if (next && next.id !== project.id) {
        e.preventDefault();
        router.push(`/project/${next.id}`);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visibleSwitcherProjects, project.id, dialogOpen, blockingTask, router]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
              项目列表
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
          {project.archived && (
            <Badge variant="muted" className="font-normal">
              已归档
            </Badge>
          )}
          <Badge variant="muted" className="font-normal">
            {tasks.length} 个任务
          </Badge>
          {isAdmin && (
            <ProjectActionsMenu
              project={project}
              taskCount={tasks.length}
              onUpdated={setProject}
              redirectAfterDelete="/projects"
            />
          )}
          <div className="ml-auto">
            <NewTaskDialog
              projects={assignableProjects}
              members={members}
              categories={categories}
              defaultProjectId={project.id}
              onCreated={(created) => {
                patchLocal(created);
                router.refresh();
              }}
              allowCreateRelated
            />
          </div>
        </div>

        {/* 项目切换栏：超过一行直接换行，每个 chip 展示该项目的 todo / doing / blocked 数 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleSwitcherProjects.map((p) => (
            <ProjectSwitcherChip
              key={p.id}
              project={p}
              stats={projectStats[p.id] ?? EMPTY_STAT}
              active={p.id === project.id}
            />
          ))}
          {visibleSwitcherProjects.length > 1 && (
            <span className="ml-1 text-[10px] text-muted-foreground/60">
              ← / → 切换
            </span>
          )}
        </div>
      </div>

      {project.archived && (
        <Card className="border-muted-foreground/30 bg-muted/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Archive className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">项目已归档</div>
              <div className="text-muted-foreground">
                项目仍可查看与编辑现有任务，但不建议添加新任务。
                {isAdmin && "如需恢复，点击右上角菜单 → 取消归档。"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {columns.map((col) => {
          const theme = STATUS_THEME[col.status];
          return (
          <Card key={col.status} className={cn("flex h-full min-h-0 flex-col border-t-4", theme.top)}>
            <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className={cn("flex items-center gap-2 text-sm font-medium", theme.title)}>
                <span className={cn("inline-block h-2 w-2 rounded-full", theme.dot)} />
                {STATUS_LABEL[col.status]}
              </CardTitle>
              <Badge variant="muted" className="font-normal tabular-nums">
                {col.tasks.length}
              </Badge>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-0">
              {col.tasks.length === 0 ? (
                <div className="rounded border border-dashed py-4 text-center text-xs text-muted-foreground">
                  —
                </div>
              ) : (
                <SortableTaskList tasks={col.tasks} onReorder={handleReorder}>
                  <div className="space-y-2">
                    {col.tasks.map((t) => (
                      <BoardTaskCard
                        key={t.id}
                        task={t}
                        onAction={handleAction}
                        onOpen={(task) => {
                          setOpenTask(task);
                          setDialogOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </SortableTaskList>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>

      <TaskDialog
        open={dialogOpen}
        task={openTask}
        onOpenChange={setDialogOpen}
        projects={projects}
        members={members}
        onUpdated={(updated) => {
          if (updated.projectId !== project.id) {
            setTasks((prev) => prev.filter((t) => t.id !== updated.id));
          } else {
            patchLocal(updated);
          }
          router.refresh();
        }}
        onDeleted={(id) => {
          setTasks((prev) => prev.filter((t) => t.id !== id));
          router.refresh();
        }}
      />

      <BlockReasonDialog
        task={blockingTask}
        onOpenChange={(o) => {
          if (!o) setBlockingTask(null);
        }}
        onSubmit={submitBlock}
      />
    </div>
  );
}

/**
 * 顶部项目切换 chip：色点 + 项目名 + 三色未完成数(todo·doing·blocked)
 * 仅显示 >0 的数字，避免一排 0 制造视觉噪音
 */
function ProjectSwitcherChip({
  project,
  stats,
  active,
}: {
  project: ProjectDTO;
  stats: ProjectStat;
  active: boolean;
}) {
  const hasAny = stats.todo + stats.doing + stats.blocked > 0;
  return (
    <Link
      href={`/project/${project.id}`}
      className={cn(
        "group flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-foreground/40 bg-accent font-medium text-foreground"
          : "border-border/60 text-muted-foreground hover:border-foreground/25 hover:bg-accent/40 hover:text-foreground",
      )}
      title={`${project.name} · 待办 ${stats.todo} · 进行 ${stats.doing} · 阻塞 ${stats.blocked}`}
    >
      <span className="max-w-[10rem] truncate">{project.name}</span>
      {hasAny && (
        <span className="ml-0.5 inline-flex items-center gap-1 text-[10px] tabular-nums">
          {stats.todo > 0 && (
            <span className="text-muted-foreground">{stats.todo}</span>
          )}
          {stats.doing > 0 && (
            <>
              {stats.todo > 0 && <span className="text-muted-foreground/30">·</span>}
              <span className="text-info">{stats.doing}</span>
            </>
          )}
          {stats.blocked > 0 && (
            <>
              {(stats.todo > 0 || stats.doing > 0) && (
                <span className="text-muted-foreground/30">·</span>
              )}
              <span className="text-warn">{stats.blocked}</span>
            </>
          )}
        </span>
      )}
    </Link>
  );
}
