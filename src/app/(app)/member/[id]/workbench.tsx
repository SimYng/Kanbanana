"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Inbox, AlertTriangle, CheckCircle2 } from "lucide-react";
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

  const { focused, doing, backlog, blocked, done } = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    return {
      focused: open.filter((t) => t.focusedToday),
      doing: tasks.filter((t) => t.status === "doing"),
      backlog: open.filter((t) => t.status === "todo" && !t.focusedToday),
      blocked: open.filter((t) => t.status === "blocked"),
      done: tasks.filter((t) => t.status === "done"),
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
    action: { kind: "status"; value: TaskStatus } | { kind: "focus"; value: boolean },
  ) {
    const body =
      action.kind === "status"
        ? { status: action.value }
        : { focusedToday: action.value };
    try {
      const updated = await apiFetch<TaskDTO>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
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
            上下拖动卡片 = 调整 {member.name} 的执行顺序
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
        <Stat label="今日聚焦" value={focused.length} tone="info" icon={Sparkles} />
        <Stat
          label="进行中 (WIP)"
          value={`${doing.length} / ${WIP_LIMIT}`}
          tone={overWip ? "warn" : "success"}
        />
        <Stat label="阻塞中" value={blocked.length} tone={blocked.length ? "warn" : undefined} icon={AlertTriangle} />
        <Stat label="待办池" value={backlog.length} icon={Inbox} />
      </div>

      {overWip && (
        <Card className="border-warn/40 bg-warn/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warn" />
            <div>
              <div className="font-medium">同时进行的任务过多</div>
              <div className="text-muted-foreground">
                {member.name} 当前有 {doing.length} 个任务处于"进行中"，超过建议上限 {WIP_LIMIT}。
                建议先完成或挂起部分任务。
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Section
        title="今日聚焦"
        hint="拖动卡片调整执行顺序"
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
        {focused.length === 0 ? (
          <EmptyHint>把待办池里的任务点「加入今日聚焦」，每天 3-5 件。</EmptyHint>
        ) : (
          <SortableTaskList tasks={focused} onReorder={handleReorder}>
            <div className="space-y-2">
              {focused.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onAction={handleAction}
                  onOpen={openTaskDialog}
                />
              ))}
            </div>
          </SortableTaskList>
        )}
      </Section>

      {blocked.length > 0 && (
        <Section title="阻塞中">
          <div className="space-y-2">
            {blocked.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onAction={handleAction}
                onOpen={openTaskDialog}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="待办池" hint="按个人执行顺序排列 · 拖动卡片调整顺序">
        {backlog.length === 0 ? (
          <EmptyHint>待办池已清空。</EmptyHint>
        ) : (
          <SortableTaskList tasks={backlog} onReorder={handleReorder}>
            <div className="space-y-2">
              {backlog.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onAction={handleAction}
                  onOpen={openTaskDialog}
                />
              ))}
            </div>
          </SortableTaskList>
        )}
      </Section>

      {done.length > 0 && (
        <Section
          title={
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              已完成
              <Badge variant="muted" className="font-normal">
                {done.length}
              </Badge>
            </span>
          }
        >
          <ul className="space-y-1 text-sm">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-muted-foreground">
                <span className="line-through">{t.title}</span>
                <span className="text-xs">· {t.project.name}</span>
              </li>
            ))}
          </ul>
        </Section>
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
  hint,
  action,
  children,
}: {
  title: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
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
