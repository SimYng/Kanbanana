"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MemberAvatar } from "@/components/member-avatar";
import { TaskDialog } from "@/components/task-dialog";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { BlockReasonDialog } from "@/components/block-reason-dialog";
import {
  MemberSwitcher,
  UNASSIGNED_NAV_ID,
} from "@/components/member-switcher";
import { MemberKanban, type ReorderRequest } from "./member-kanban";
import { apiFetch } from "@/lib/fetcher";
import { isTaskVisible } from "@/lib/utils";
import { type MemberDTO, type ProjectDTO, type TaskDTO, type TaskStatus } from "@/lib/types";

interface WorkbenchProps {
  /** null 表示「未分配池」视图：展示所有 assigneeId IS NULL 的任务 */
  member: MemberDTO | null;
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
  // router.refresh() 走 transition：不阻塞 UI，不打断 member-kanban 的乐观更新
  const [, startTransition] = useTransition();

  // 归档项目里未完成的任务视为「作废」，不在工作台展示；
  // 已完成的任务仍保留，作为历史业绩（由 MemberKanban 的"近期已完成"列承担展示）。
  // 进行中/待办/阻塞中/近期已完成的分桶 + 时间筛选交给 MemberKanban 内部完成。
  const kanbanTasks = useMemo(() => tasks.filter(isTaskVisible), [tasks]);

  // 未分配视图用 `assigneeId=none` 查询（约定见 /api/tasks GET）。
  const refreshQuery = member ? `assigneeId=${member.id}` : "assigneeId=none";
  const ownerId: string | null = member?.id ?? null;

  async function refresh() {
    const next = await apiFetch<TaskDTO[]>(`/api/tasks?${refreshQuery}`);
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

  // 统一处理 Kanban 拖拽：兼容"列内排序"与"跨列切换状态"两种模式。
  // 客户端乐观 sortIndex 由 member-kanban 内部处理，这里只负责调 API + 校准。
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
      startTransition(() => router.refresh());
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
          {member ? (
            <>
              <MemberAvatar name={member.name} />
              <h1 className="text-xl font-semibold tracking-tight">
                {member.name} 的工作台
              </h1>
            </>
          ) : (
            <>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="h-4 w-4" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight">
                未分配任务
              </h1>
              <span className="text-xs text-muted-foreground">
                没有指派负责人 · 待管理员排活
              </span>
            </>
          )}
          <div className="ml-auto">
            <NewTaskDialog
              projects={projects.filter((p) => !p.archived)}
              members={allMembers}
              defaultAssigneeId={ownerId ?? undefined}
              onCreated={(created) => {
                patchLocal(created);
                router.refresh();
              }}
              triggerLabel="新建任务"
              allowCreateRelated
            />
          </div>
        </div>

        <MemberSwitcher
          currentId={member?.id ?? UNASSIGNED_NAV_ID}
          members={allMembers}
          disabled={dialogOpen || !!blockingTask}
        />
      </div>

      <MemberKanban
        tasks={kanbanTasks}
        onOpen={openTaskDialog}
        onAction={handleAction}
        onReorderRequest={handleReorderRequest}
      />

      <TaskDialog
        open={dialogOpen}
        task={openTask}
        onOpenChange={setDialogOpen}
        projects={projects}
        members={allMembers}
        onUpdated={(updated) => {
          // 任务负责人变化 → 已不属于本视图：从本地列表移除
          const stillBelongs = (updated.assigneeId ?? null) === ownerId;
          if (!stillBelongs) {
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
