"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberAvatar } from "@/components/member-avatar";
import { BoardTaskCard } from "@/components/board-task-card";
import { SortableTaskList } from "@/components/sortable-task-list";
import { TaskDialog } from "@/components/task-dialog";
import {
  MemberSwitcher,
  OVERVIEW_NAV_ID,
} from "@/components/member-switcher";
import { apiFetch } from "@/lib/fetcher";
import { cn, isTaskVisible } from "@/lib/utils";
import { STATUS_THEME } from "@/lib/status-theme";
import {
  STATUS_LABEL,
  type MemberDTO,
  type ProjectDTO,
  type TaskDTO,
  type TaskStatus,
} from "@/lib/types";

/**
 * 列内任务的展示顺序：
 *   1. 进行中 — 当下手头的事
 *   2. 阻塞   — 需要介入解阻塞
 *   3. 待办   — 接下来要做
 *   4. 已完成 — 历史业绩
 * 组内仍按 sortIndex（个人执行顺序）排序，保留员工自己拖出来的优先级。
 */
const STATUS_ORDER: Record<TaskStatus, number> = {
  doing: 0,
  blocked: 1,
  todo: 2,
  done: 3,
};

interface MembersOverviewProps {
  members: MemberDTO[];
  projects: ProjectDTO[];
  initialTasks: TaskDTO[];
}

export function MembersOverview({
  members,
  projects,
  initialTasks,
}: MembersOverviewProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);
  const [openTask, setOpenTask] = useState<TaskDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 已完成任务只展示"近 7 天完成"的，避免历史完成堆积把列压垮。
  // 边界按日对齐（今天 00:00 往前 6 天 = 7 天前 00:00），跨天时数据不抖动。
  const visibleTasks = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgoStart = new Date(todayStart);
    weekAgoStart.setDate(weekAgoStart.getDate() - 6);

    return tasks.filter(isTaskVisible).filter((t) => {
      if (t.status !== "done") return true;
      if (!t.completedAt) return false;
      return new Date(t.completedAt) >= weekAgoStart;
    });
  }, [tasks]);

  const grouped = useMemo(() => {
    const byMember = new Map<string, TaskDTO[]>();
    for (const m of members) byMember.set(m.id, []);
    for (const t of visibleTasks) {
      if (!t.assigneeId) continue;
      byMember.get(t.assigneeId)?.push(t);
    }
    for (const arr of byMember.values()) {
      arr.sort((a, b) => {
        const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (so !== 0) return so;
        return a.sortIndex - b.sortIndex;
      });
    }
    return byMember;
  }, [visibleTasks, members]);

  function openTaskDialog(task: TaskDTO) {
    setOpenTask(task);
    setDialogOpen(true);
  }

  function patchLocal(updated: TaskDTO) {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      return exists
        ? prev.map((t) => (t.id === updated.id ? updated : t))
        : [...prev, updated];
    });
  }

  async function refreshAll() {
    const next = await apiFetch<TaskDTO[]>("/api/tasks");
    setTasks(next.filter((t) => t.assigneeId != null));
  }

  /**
   * 列内排序。每个成员的每种状态独立 DndContext，dnd-kit 天然只允许同 context 内拖动，
   * 所以跨成员或跨状态的拖动直接被忽略（鼠标释放无副作用），不需要额外校验。
   */
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
        await refreshAll();
      } else {
        patchLocal(res.task);
      }
      router.refresh();
    } catch (e) {
      toast.error(`排序失败：${(e as Error).message}`);
    }
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
          <h1 className="text-xl font-semibold tracking-tight">成员总览</h1>
          <Badge variant="muted" className="font-normal">
            {members.length} 人 · {visibleTasks.length} 个任务
          </Badge>
          <p className="text-xs text-muted-foreground">
            每人一列 · 顺序：进行中 → 阻塞 → 待办 → 已完成 · 已完成仅显示近 7 天
          </p>
        </div>

        <MemberSwitcher
          currentId={OVERVIEW_NAV_ID}
          members={members}
          disabled={dialogOpen}
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {members.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            还没有成员
          </div>
        ) : (
          members.map((m) => (
            <MemberColumn
              key={m.id}
              member={m}
              tasks={grouped.get(m.id) ?? []}
              onOpen={openTaskDialog}
              onReorder={handleReorder}
            />
          ))
        )}
      </div>

      <TaskDialog
        open={dialogOpen}
        task={openTask}
        onOpenChange={setDialogOpen}
        projects={projects}
        members={members}
        onUpdated={(updated) => {
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === updated.id);
            return exists
              ? prev.map((t) => (t.id === updated.id ? updated : t))
              : [...prev, updated];
          });
          router.refresh();
        }}
        onDeleted={(id) => {
          setTasks((prev) => prev.filter((t) => t.id !== id));
          router.refresh();
        }}
      />
    </div>
  );
}

// 列内任务渲染顺序，跟 STATUS_ORDER 一致；每段独立 DndContext，跨段不允许拖动
const RENDER_STATUSES: TaskStatus[] = ["doing", "blocked", "todo", "done"];

function MemberColumn({
  member,
  tasks,
  onOpen,
  onReorder,
}: {
  member: MemberDTO;
  tasks: TaskDTO[];
  onOpen: (task: TaskDTO) => void;
  onReorder: (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
}) {
  const groups = useMemo(() => {
    const buckets: Record<TaskStatus, TaskDTO[]> = {
      doing: [],
      blocked: [],
      todo: [],
      done: [],
    };
    for (const t of tasks) buckets[t.status].push(t);
    // 入参 tasks 已按 STATUS_ORDER + sortIndex 排好，按 status 切片后组内顺序自然正确
    return buckets;
  }, [tasks]);

  const stats = useMemo(() => {
    const s = { doing: 0, blocked: 0, todo: 0, done: 0 };
    for (const t of tasks) s[t.status] += 1;
    return s;
  }, [tasks]);

  return (
    <Card className="flex h-full min-h-0 w-[18rem] shrink-0 flex-col">
      <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 space-y-0 border-b pb-3">
        <Link
          href={`/member/${member.id}`}
          className="flex min-w-0 items-center gap-2 hover:underline"
          title="进入该成员的工作台"
        >
          <MemberAvatar name={member.name} />
          <CardTitle className="truncate text-sm font-semibold">
            {member.name}
          </CardTitle>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        </Link>
        {/* 任务分布合并到 header 右侧：色点 + 数字横排，0 值弱化避免噪音；
            鼠标悬停每个 chip 有 tooltip 解释（"进行中 3"）。
            视觉上相当于既是图例又是分布 + 总数（4 数之和），省掉了独立的统计行。 */}
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums">
          <StatusCount status="doing" value={stats.doing} />
          <StatusCount status="blocked" value={stats.blocked} />
          <StatusCount status="todo" value={stats.todo} />
          <StatusCount status="done" value={stats.done} />
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-3">
        {tasks.length === 0 ? (
          <div className="rounded border border-dashed py-6 text-center text-xs text-muted-foreground">
            手头是空的
          </div>
        ) : (
          RENDER_STATUSES.map((status) => {
            const items = groups[status];
            if (items.length === 0) return null;
            return (
              <SortableTaskList
                key={status}
                tasks={items}
                onReorder={onReorder}
              >
                <div className="space-y-2">
                  {items.map((t) => (
                    <BoardTaskCard
                      key={t.id}
                      task={t}
                      hideAssignee
                      showProject
                      showStatusBar
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              </SortableTaskList>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function StatusCount({ status, value }: { status: TaskStatus; value: number }) {
  const theme = STATUS_THEME[status];
  const isZero = value === 0;
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", isZero && "opacity-40")}
      title={`${STATUS_LABEL[status]} ${value}`}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", theme.dot)} />
      <span className={isZero ? "text-muted-foreground" : theme.title}>
        {value}
      </span>
    </span>
  );
}
