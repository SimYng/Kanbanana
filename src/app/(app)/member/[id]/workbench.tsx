"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { TaskCard } from "@/components/task-card";
import { SortableTaskList } from "@/components/sortable-task-list";
import { TaskDialog } from "@/components/task-dialog";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { apiFetch } from "@/lib/fetcher";
import { isToday } from "@/lib/utils";
import { WIP_LIMIT, type MemberDTO, type ProjectDTO, type TaskDTO, type TaskStatus } from "@/lib/types";

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
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);
  const [openTask, setOpenTask] = useState<TaskDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { doing, todo, blocked, done, doneToday } = useMemo(() => {
    const doneAll = tasks.filter((t) => t.status === "done");
    return {
      doing: tasks.filter((t) => t.status === "doing"),
      todo: tasks.filter((t) => t.status === "todo"),
      blocked: tasks.filter((t) => t.status === "blocked"),
      done: doneAll,
      doneToday: doneAll.filter((t) => isToday(t.updatedAt)),
    };
  }, [tasks]);

  const overWip = doing.length > WIP_LIMIT;

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
    try {
      const updated = await apiFetch<TaskDTO>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: action.value }),
      });
      patchLocal(updated);
    } catch (e) {
      toast.error((e as Error).message);
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
    } catch (e) {
      toast.error(`排序失败：${(e as Error).message}`);
    }
  }

  function openTaskDialog(task: TaskDTO) {
    setOpenTask(task);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/team">
            <ArrowLeft className="h-4 w-4" />
            团队总览
          </Link>
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <MemberAvatar name={member.name} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {member.name} 的工作台
          </h1>
          <p className="text-xs text-muted-foreground">
            列表顶部 = 优先做 · 上下拖动卡片调整执行顺序
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {allMembers
            .filter((m) => m.role !== "admin")
            .map((m) => (
              <Button
                key={m.id}
                asChild
                size="sm"
                variant={m.id === member.id ? "secondary" : "ghost"}
              >
                <Link href={`/member/${m.id}`}>{m.name}</Link>
              </Button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={`进行中 (WIP ≤ ${WIP_LIMIT})`}
          value={doing.length}
          tone={overWip ? "warn" : doing.length > 0 ? "info" : undefined}
          icon={PlayCircle}
        />
        <Stat label="待办" value={todo.length} icon={Inbox} />
        <Stat
          label="阻塞中"
          value={blocked.length}
          tone={blocked.length ? "warn" : undefined}
          icon={AlertTriangle}
        />
        <Stat label="今日已完成" value={doneToday.length} tone="success" icon={CheckCircle2} />
      </div>

      {overWip && (
        <Card className="border-warn/40 bg-warn/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warn" />
            <div>
              <div className="font-medium">同时进行的任务过多</div>
              <div className="text-muted-foreground">
                {member.name} 当前有 {doing.length} 个任务处于"进行中"，超过建议上限 {WIP_LIMIT}。
                建议先完成或暂停部分任务，避免上下文切换损耗。
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Section
        title="进行中"
        count={doing.length}
        hint="手头正在做的事 · 拖动调整顺序"
        action={
          <NewTaskDialog
            projects={projects}
            members={allMembers}
            defaultAssigneeId={member.id}
            onCreated={patchLocal}
            triggerLabel="新建任务"
          />
        }
      >
        {doing.length === 0 ? (
          <EmptyHint>没有正在进行的任务。从下方"待办"选一个开始做。</EmptyHint>
        ) : (
          <SortableTaskList tasks={doing} onReorder={handleReorder}>
            <div className="space-y-2">
              {doing.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  hideAssignee
                  onAction={handleAction}
                  onOpen={openTaskDialog}
                />
              ))}
            </div>
          </SortableTaskList>
        )}
      </Section>

      <Section
        title="待办"
        count={todo.length}
        hint="顶部 = 接下来要做 · 拖动卡片调整顺序"
      >
        {todo.length === 0 ? (
          <EmptyHint>待办池已清空。</EmptyHint>
        ) : (
          <SortableTaskList tasks={todo} onReorder={handleReorder}>
            <div className="space-y-2">
              {todo.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  hideAssignee
                  onAction={handleAction}
                  onOpen={openTaskDialog}
                />
              ))}
            </div>
          </SortableTaskList>
        )}
      </Section>

      {blocked.length > 0 && (
        <Section title="阻塞中" count={blocked.length}>
          <div className="space-y-2">
            {blocked.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                hideAssignee
                onAction={handleAction}
                onOpen={openTaskDialog}
              />
            ))}
          </div>
        </Section>
      )}

      {done.length > 0 && (
        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
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
          <div className="space-y-1 border-t p-4 text-sm">
            {done.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-muted-foreground">
                <span className="line-through">{t.title}</span>
                <span className="text-xs">· {t.project.name}</span>
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
        }}
        onDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}

function Section({
  title,
  count,
  hint,
  action,
  children,
}: {
  title: React.ReactNode;
  count?: number;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {typeof count === "number" && (
            <Badge variant="muted" className="font-normal">
              {count}
            </Badge>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function Stat({
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
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 text-2xl font-semibold tabular-nums ${toneClass}`}>
          {Icon && <Icon className="h-4 w-4" />}
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
