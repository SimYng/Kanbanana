"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Inbox, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberAvatar } from "@/components/member-avatar";
import { BoardTaskCard } from "@/components/board-task-card";
import { SortableTaskList } from "@/components/sortable-task-list";
import { TaskDialog } from "@/components/task-dialog";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { BlockReasonDialog } from "@/components/block-reason-dialog";
import {
  MemberSwitcher,
  OVERVIEW_NAV_ID,
} from "@/components/member-switcher";
import { apiFetch } from "@/lib/fetcher";
import { cn, isTaskVisible } from "@/lib/utils";
import { STATUS_THEME } from "@/lib/status-theme";
import { useTaskStatusAction } from "@/lib/use-task-status-action";
import { computeOptimisticReorder } from "@/lib/optimistic-reorder";
import {
  STATUS_LABEL,
  type MemberDTO,
  type ProjectCategoryDTO,
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
  categories: ProjectCategoryDTO[];
  initialTasks: TaskDTO[];
}

export function MembersOverview({
  members,
  projects,
  categories,
  initialTasks,
}: MembersOverviewProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);
  const [openTask, setOpenTask] = useState<TaskDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // 「标记阻塞」需要先收集原因，单独的轻量 Dialog
  const [blockingTask, setBlockingTask] = useState<TaskDTO | null>(null);
  // router.refresh() 走 transition：不阻塞 UI、不打断乐观排序
  const [, startTransition] = useTransition();

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
    const unassigned: TaskDTO[] = [];
    for (const t of visibleTasks) {
      if (!t.assigneeId) {
        unassigned.push(t);
        continue;
      }
      byMember.get(t.assigneeId)?.push(t);
    }
    const sortFn = (a: TaskDTO, b: TaskDTO) => {
      const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (so !== 0) return so;
      return a.sortIndex - b.sortIndex;
    };
    for (const arr of byMember.values()) arr.sort(sortFn);
    unassigned.sort(sortFn);
    return { byMember, unassigned };
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

  // 新建任务统一回调：顶部全局按钮 + 每列小 + 按钮都走这里
  function handleTaskCreated(created: TaskDTO) {
    patchLocal(created);
    router.refresh();
  }

  const runStatusAction = useTaskStatusAction({
    getTask: (id) => tasks.find((t) => t.id === id),
    onPatched: (t) => {
      patchLocal(t);
      router.refresh();
    },
  });

  async function handleCardAction(
    taskId: string,
    action: { kind: "status"; value: TaskStatus },
  ) {
    // 标记阻塞要先收集原因，走专门的弹窗；其它状态直接快捷切换 + 撤销 toast
    if (action.value === "blocked") {
      const target = tasks.find((t) => t.id === taskId);
      if (target) setBlockingTask(target);
      return;
    }
    await runStatusAction(taskId, action.value);
  }

  async function submitBlock(taskId: string, reason: string) {
    const before = tasks.find((t) => t.id === taskId);
    if (!before) return;
    const snapshot = {
      status: before.status,
      focusedToday: before.focusedToday,
      blockedReason: before.blockedReason,
    };
    try {
      const updated = await apiFetch<TaskDTO>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "blocked", blockedReason: reason }),
      });
      patchLocal(updated);
      router.refresh();
      toast.success("已标记为「阻塞」", {
        description: before.title,
        duration: 6000,
        action: {
          label: "撤销",
          onClick: async () => {
            try {
              const reverted = await apiFetch<TaskDTO>(
                `/api/tasks/${taskId}`,
                {
                  method: "PATCH",
                  body: JSON.stringify(snapshot),
                },
              );
              patchLocal(reverted);
              router.refresh();
              toast.success("已撤销");
            } catch (err) {
              toast.error(`撤销失败：${(err as Error).message}`);
            }
          },
        },
      });
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  async function refreshAll() {
    const next = await apiFetch<TaskDTO[]>("/api/tasks");
    setTasks(next);
  }

  /**
   * 列内排序。每个成员的每种状态独立 DndContext，dnd-kit 天然只允许同 context 内拖动，
   * 跨成员或跨状态的拖动直接被忽略，不需额外校验。
   *
   * 体验关键：drop 瞬间 dnd-kit 会把卡片"复位"到 React state 决定的位置。
   * 如果只在 API 返回后才更新 state，会出现「先弹回原位→再跳到新位置」的闪烁。
   * 这里用 client 端的 computeSortIndex（与后端是同一份算法）先做乐观更新，
   * 让 dnd-kit 复位的目标就是新位置，肉眼无感。
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
        await refreshAll();
      } else {
        patchLocal(res.task);
      }
      // router.refresh() 放到 transition：服务端重 render 期间不打断本地排序
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
          <div className="ml-auto">
            {/* 全局入口：不预选负责人，留给弹窗下拉选；
                每列列头还有小 + 按钮可一键预选该成员，常用于排活。 */}
            <NewTaskDialog
              projects={projects.filter((p) => !p.archived)}
              members={members}
              categories={categories}
              onCreated={handleTaskCreated}
              allowCreateRelated
            />
          </div>
        </div>

        <MemberSwitcher
          currentId={OVERVIEW_NAV_ID}
          members={members}
          disabled={dialogOpen}
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {members.length === 0 && grouped.unassigned.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            还没有成员
          </div>
        ) : (
          <>
            {members.map((m) => (
              <OverviewColumn
                key={m.id}
                title={m.name}
                href={`/member/${m.id}`}
                leading={<MemberAvatar name={m.name} />}
                hoverHint="进入该成员的工作台"
                emptyText="手头是空的"
                tasks={grouped.byMember.get(m.id) ?? []}
                projects={projects}
                members={members}
                categories={categories}
                defaultAssigneeId={m.id}
                addTaskTooltip={`给 ${m.name} 派活`}
                onTaskCreated={handleTaskCreated}
                onOpen={openTaskDialog}
                onAction={handleCardAction}
                onReorder={handleReorder}
              />
            ))}
            {/* 未分配池：放在最右侧，作为「待派活」收纳池 */}
            <OverviewColumn
              key="__unassigned__"
              title="未分配"
              href="/member/unassigned"
              leading={
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Inbox className="h-3.5 w-3.5" />
                </span>
              }
              hoverHint="进入未分配任务池"
              emptyText="没有未分配任务"
              tasks={grouped.unassigned}
              projects={projects}
              members={members}
              categories={categories}
              defaultAssigneeId={undefined}
              addTaskTooltip="新建未分配任务"
              onTaskCreated={handleTaskCreated}
              onOpen={openTaskDialog}
              onAction={handleCardAction}
              onReorder={handleReorder}
            />
          </>
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

// 列内任务渲染顺序，跟 STATUS_ORDER 一致；每段独立 DndContext，跨段不允许拖动
const RENDER_STATUSES: TaskStatus[] = ["doing", "blocked", "todo", "done"];

interface OverviewColumnProps {
  title: string;
  /** 列头点击跳转的目标（成员工作台 / 未分配工作台） */
  href: string;
  /** 列头标题左侧的图标（成员头像或未分配 icon） */
  leading: ReactNode;
  /** 列头 hover 提示文案 */
  hoverHint: string;
  /** 列内无任务时的占位文案 */
  emptyText: string;
  tasks: TaskDTO[];
  /** 新建任务弹窗用 */
  projects: ProjectDTO[];
  members: MemberDTO[];
  categories: ProjectCategoryDTO[];
  /** undefined = 未分配；否则预选该负责人 */
  defaultAssigneeId: string | undefined;
  /** 列头小 + 按钮的 tooltip */
  addTaskTooltip: string;
  onTaskCreated: (task: TaskDTO) => void;
  onOpen: (task: TaskDTO) => void;
  /** 卡片 hover 出的快捷状态切换按钮回调；透传给 BoardTaskCard */
  onAction: (
    taskId: string,
    action: { kind: "status"; value: TaskStatus },
  ) => void;
  onReorder: (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
}

function OverviewColumn({
  title,
  href,
  leading,
  hoverHint,
  emptyText,
  tasks,
  projects,
  members,
  categories,
  defaultAssigneeId,
  addTaskTooltip,
  onTaskCreated,
  onOpen,
  onAction,
  onReorder,
}: OverviewColumnProps) {
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
          href={href}
          className="flex min-w-0 items-center gap-2 hover:underline"
          title={hoverHint}
        >
          {leading}
          <CardTitle className="truncate text-sm font-semibold">
            {title}
          </CardTitle>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        </Link>
        {/* 任务分布合并到 header 右侧：色点 + 数字横排，0 值弱化避免噪音；
            鼠标悬停每个 chip 有 tooltip 解释（"进行中 3"）。
            视觉上相当于既是图例又是分布 + 总数（4 数之和），省掉了独立的统计行。
            末尾跟一个小 + 按钮，点击直接打开"新建任务"弹窗并预选本列负责人。 */}
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums">
          <StatusCount status="doing" value={stats.doing} />
          <StatusCount status="blocked" value={stats.blocked} />
          <StatusCount status="todo" value={stats.todo} />
          <StatusCount status="done" value={stats.done} />
          <NewTaskDialog
            projects={projects.filter((p) => !p.archived)}
            members={members}
            categories={categories}
            defaultAssigneeId={defaultAssigneeId}
            onCreated={onTaskCreated}
            allowCreateRelated
            triggerNode={
              <Button
                size="sm"
                variant="ghost"
                aria-label={addTaskTooltip}
                title={addTaskTooltip}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            }
          />
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pt-2">
        {tasks.length === 0 ? (
          <div className="rounded border border-dashed py-6 text-center text-xs text-muted-foreground">
            {emptyText}
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
                <div className="space-y-1.5">
                  {items.map((t) => (
                    <BoardTaskCard
                      key={t.id}
                      task={t}
                      hideAssignee
                      showProject
                      showStatusBar
                      onOpen={onOpen}
                      onAction={onAction}
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
