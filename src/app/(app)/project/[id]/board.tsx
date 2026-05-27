"use client";

import { useMemo, useState } from "react";
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
import {
  PROJECT_COLOR_HEX,
  STATUS_LABEL,
  TASK_STATUSES,
  type MemberDTO,
  type ProjectDTO,
  type TaskDTO,
  type TaskStatus,
} from "@/lib/types";

interface ProjectBoardProps {
  project: ProjectDTO;
  projects: ProjectDTO[];
  members: MemberDTO[];
  initialTasks: TaskDTO[];
  isAdmin?: boolean;
}

export function ProjectBoard({
  project: initialProject,
  projects,
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

  async function handleReorder(
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) {
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
      router.refresh();
    } catch (e) {
      toast.error(`排序失败：${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
            项目列表
          </Link>
        </Button>
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: PROJECT_COLOR_HEX[project.color] }}
        />
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
        <div className="ml-auto flex items-center gap-2">
          {projects
            .filter((p) => !p.archived || p.id === project.id)
            .map((p) => (
              <Button
                key={p.id}
                asChild
                size="sm"
                variant={p.id === project.id ? "secondary" : "ghost"}
              >
                <Link href={`/project/${p.id}`}>{p.name}</Link>
              </Button>
            ))}
          <NewTaskDialog
            projects={assignableProjects}
            members={members}
            defaultProjectId={project.id}
            onCreated={(created) => {
              patchLocal(created);
              router.refresh();
            }}
          />
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

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {columns.map((col) => (
          <Card key={col.status} className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">
                {STATUS_LABEL[col.status]}
              </CardTitle>
              <span className="text-xs text-muted-foreground">{col.tasks.length}</span>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 pt-0">
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
        ))}
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
