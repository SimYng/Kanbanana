"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MemberAvatar } from "@/components/member-avatar";
import { TaskDialog } from "@/components/task-dialog";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { BlockReasonDialog } from "@/components/block-reason-dialog";
import { MemberSwitcher } from "@/components/member-switcher";
import { MemberKanban, type ReorderRequest } from "./member-kanban";
import { apiFetch } from "@/lib/fetcher";
import { cn, isTaskVisible, isToday } from "@/lib/utils";
import { type MemberDTO, type ProjectDTO, type TaskDTO, type TaskStatus } from "@/lib/types";

interface WorkbenchProps {
  member: MemberDTO;
  allMembers: MemberDTO[];
  projects: ProjectDTO[];
  initialTasks: TaskDTO[];
}

export function MemberWorkbench({
  member,
  allMembers,
  projects,
  initialTasks,
}: WorkbenchProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);
  const [openTask, setOpenTask] = useState<TaskDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockingTask, setBlockingTask] = useState<TaskDTO | null>(null);

  const { doing, todo, blocked, done, doneToday, kanbanTasks } = useMemo(() => {
    // 归档项目里未完成的任务视为「作废」，不在工作台展示；
    // 已完成的任务仍保留，作为历史业绩。
    const visible = tasks.filter(isTaskVisible);
    const doingArr = visible.filter((t) => t.status === "doing");
    const todoArr = visible.filter((t) => t.status === "todo");
    const blockedArr = visible.filter((t) => t.status === "blocked");
    const doneAll = visible.filter((t) => t.status === "done");
    return {
      doing: doingArr,
      todo: todoArr,
      blocked: blockedArr,
      done: doneAll,
      doneToday: doneAll.filter((t) => isToday(t.completedAt)),
      // Kanban 三列任务集合（不含 done，done 折叠在底部）
      kanbanTasks: [...doingArr, ...todoArr, ...blockedArr],
    };
  }, [tasks]);

  async function refresh() {
    const next = await apiFetch<TaskDTO[]>(`/api/tasks?assigneeId=${member.id}`);
    setTasks(next);
  }

  function patchLocal(updated: TaskDTO) {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      const next = exists
        ? prev.map((t) => (t.id === updated.id ? updated : t))
        : [...prev, updated];
      return next.sort((a, b) => a.sortIndex - b.sortIndex);
    });
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
      const payload: Record<string, unknown> = { status: action.value };
      // 切到非阻塞状态时清空原因，避免残留旧文案
      payload.blockedReason = null;
      const updated = await apiFetch<TaskDTO>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
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

  // 统一处理 Kanban 拖拽：兼容"列内排序"与"跨列切换状态"两种模式
  async function handleReorderRequest(req: ReorderRequest) {
    try {
      const res = await apiFetch<{ task: TaskDTO; rebalanced: boolean }>(
        "/api/tasks/reorder",
        {
          method: "POST",
          body: JSON.stringify(req),
        },
      );
      if (res.rebalanced) {
        await refresh();
      } else {
        patchLocal(res.task);
      }
      router.refresh();
    } catch (e) {
      toast.error(`拖拽失败：${(e as Error).message}`);
      throw e;
    }
  }

  function openTaskDialog(task: TaskDTO) {
    setOpenTask(task);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/team">
              <ArrowLeft className="h-4 w-4" />
              团队总览
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <MemberAvatar name={member.name} />
          <h1 className="text-xl font-semibold tracking-tight">
            {member.name} 的工作台
          </h1>
          <div className="ml-auto">
            <NewTaskDialog
              projects={projects.filter((p) => !p.archived)}
              members={allMembers}
              defaultAssigneeId={member.id}
              onCreated={(created) => {
                patchLocal(created);
                router.refresh();
              }}
              triggerLabel="新建任务"
            />
          </div>
        </div>

        <MemberSwitcher
          currentId={member.id}
          members={allMembers}
          disabled={dialogOpen || !!blockingTask}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <CompactStat
          label="进行中"
          value={doing.length}
          tone={doing.length > 0 ? "info" : undefined}
          icon={PlayCircle}
        />
        <CompactStat label="待办" value={todo.length} icon={Inbox} />
        <CompactStat
          label="阻塞中"
          value={blocked.length}
          tone={blocked.length ? "warn" : undefined}
          icon={AlertTriangle}
        />
        <CompactStat
          label="今日已完成"
          value={doneToday.length}
          tone="success"
          icon={CheckCircle2}
        />
      </div>

      <MemberKanban
        tasks={kanbanTasks}
        onOpen={openTaskDialog}
        onAction={handleAction}
        onReorderRequest={handleReorderRequest}
      />

      {done.length > 0 && (
        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-success" />
            已完成
            <Badge variant="muted" className="font-normal">
              {done.length}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
              展开
            </span>
            <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">
              收起
            </span>
          </summary>
          <div className="space-y-1 border-t p-3 text-xs">
            {done.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-muted-foreground">
                <span className="line-through">{t.title}</span>
                <span>· {t.project.name}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <TaskDialog
        open={dialogOpen}
        task={openTask}
        onOpenChange={setDialogOpen}
        projects={projects}
        members={allMembers}
        onUpdated={(updated) => {
          if (updated.assigneeId !== member.id) {
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

function CompactStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  tone?: "info" | "warn" | "success";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass =
    tone === "info"
      ? "text-info"
      : tone === "warn"
        ? "text-warn"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-3">
        {Icon && <Icon className={cn("h-4 w-4", toneClass)} />}
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "ml-auto text-xl font-semibold leading-none tabular-nums",
            toneClass,
          )}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

