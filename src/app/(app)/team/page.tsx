import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Inbox,
  ListTodo,
  PlayCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "@/components/priority-badge";
import { ProjectPill } from "@/components/project-pill";
import { TASK_INCLUDE, serializeTask } from "@/lib/serializers";
import { cn, formatDueLabel, isTaskVisible, isToday } from "@/lib/utils";
import type { TaskDTO } from "@/lib/types";
import {
  ProjectProgressGrid,
  type ProjectProgressItem,
} from "./project-progress";
import {
  MemberWorkload,
  type MemberWorkloadRow,
} from "./member-workload";
import { PanelHeader } from "./panel-header";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const [members, allTasks, projects] = await Promise.all([
    prisma.user.findMany({
      where: { role: "member" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      include: TASK_INCLUDE,
      orderBy: { sortIndex: "asc" },
    }),
    prisma.project.findMany({
      where: { archived: false },
      orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  // 已归档项目里的未完成任务视为「作废」，不计入工作量与阻塞统计；
  // 已完成任务（含归档项目里的）继续保留，作为历史业绩。
  const allTaskDtos = allTasks.map(serializeTask);
  const tasks = allTaskDtos.filter(isTaskVisible);

  const memberRows: MemberWorkloadRow[] = members.map((m) => {
    const mine = tasks.filter((t) => t.assigneeId === m.id);
    const open = mine.filter((t) => t.status !== "done");
    const doneToday = mine.filter((t) => t.status === "done" && isToday(t.completedAt)).length;
    return {
      member: { id: m.id, name: m.name },
      doingCount: open.filter((t) => t.status === "doing").length,
      todoCount: open.filter((t) => t.status === "todo").length,
      blockedCount: open.filter((t) => t.status === "blocked").length,
      doneToday,
      total: open.length,
    };
  });

  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const openTasks = tasks.filter((t) => t.status !== "done");

  // 全局工作量统计（顶部第一列用）
  const overall = {
    doing: openTasks.filter((t) => t.status === "doing").length,
    blocked: blockedTasks.length,
    todo: openTasks.filter((t) => t.status === "todo").length,
  };

  // 时间边界（本地时区，按"天"对齐）
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const weekEndExclusive = new Date(todayStart);
  weekEndExclusive.setDate(weekEndExclusive.getDate() + 7);

  // 截止日期池
  const withDue = openTasks.filter((t) => t.dueDate);
  const todayPool = withDue.filter((t) => new Date(t.dueDate!) < tomorrowStart);
  const weekPool = withDue.filter((t) => new Date(t.dueDate!) < weekEndExclusive);

  const todayGroups = groupByDay(todayPool, todayStart, tomorrowStart);
  const weekGroups = groupByDay(weekPool, todayStart, tomorrowStart);

  // 项目进度数据：保持 server 端 sortIndex 顺序作为"手动排序"默认值
  const projectProgressItems: ProjectProgressItem[] = projects.map((p) => {
    const pt = tasks.filter((t) => t.projectId === p.id);
    const doneCount = pt.filter((t) => t.status === "done").length;
    const blockedCount = pt.filter((t) => t.status === "blocked").length;
    const totalCount = pt.length;
    const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
    return {
      id: p.id,
      name: p.name,
      doneCount,
      blockedCount,
      totalCount,
      pct,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">团队总览</h1>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <WorkloadSummary
          doing={overall.doing}
          blocked={overall.blocked}
          todo={overall.todo}
        />
        <PreviewPanel
          icon={CalendarDays}
          title="今日任务"
          subtitle="逾期 + 今天到期"
          totalCount={todayPool.length}
          groups={todayGroups}
          emptyHint="今日没有需要冲的截止任务 🎉"
        />
        <PreviewPanel
          icon={ListTodo}
          title="未来 7 天"
          subtitle="按日聚合"
          totalCount={weekPool.length}
          groups={weekGroups}
          emptyHint="未来一周没有截止任务"
        />
      </div>

      {/*
        以成员 panel 高度为基准，项目 panel 超出滚动的核心技巧：
         - 外层 grid 默认 stretch + row 高度 = max(子项内容高度)
         - 把项目 panel 装进 relative 容器内的 absolute 子元素 → 它脱离 row 高度
           计算（intrinsic height 视为 0），row 高度因此完全由 MemberWorkload 决定
         - 然后 absolute inset-0 让项目 panel 撑满 row（即成员高度），内部滚动
         - 小屏 (< xl) 单列堆叠时不启用 relative/absolute，恢复自然文档流
      */}
      <div className="grid gap-3 xl:grid-cols-2">
        <MemberWorkload rows={memberRows} />
        <div className="xl:relative">
          <div className="xl:absolute xl:inset-0 xl:flex">
            <ProjectProgressGrid items={projectProgressItems} />
          </div>
        </div>
      </div>

      {blockedTasks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warn" />
            <h2 className="text-lg font-semibold">团队阻塞看板</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            所有阻塞中的任务集中展示，方便每日晨会快速过一遍
          </p>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">任务</th>
                  <th className="px-3 py-2 font-medium">负责人</th>
                  <th className="px-3 py-2 font-medium">项目</th>
                  <th className="px-3 py-2 font-medium">优先级</th>
                  <th className="px-3 py-2 font-medium">阻塞原因</th>
                </tr>
              </thead>
              <tbody>
                {blockedTasks.map((t) => (
                  <tr key={t.id} className="border-t bg-warn/5">
                    <td className="px-3 py-2 font-medium">{t.title}</td>
                    <td className="px-3 py-2">{t.assignee?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <ProjectPill name={t.project.name} />
                    </td>
                    <td className="px-3 py-2">
                      <PriorityBadge priority={t.priority} short />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.blockedReason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ───────────────────────── 顶部第一列：工作量分布 ─────────────────────────

function WorkloadSummary({
  doing,
  blocked,
  todo,
}: {
  doing: number;
  blocked: number;
  todo: number;
}) {
  return (
    <Card className="flex flex-col">
      <PanelHeader icon={CheckCircle2} title="工作量分布" />
      <CardContent className="flex flex-1 flex-col justify-around gap-2 pt-3">
        <WorkloadRow icon={PlayCircle} label="进行中" value={doing} tone="info" />
        <WorkloadRow
          icon={AlertTriangle}
          label="阻塞"
          value={blocked}
          tone={blocked > 0 ? "warn" : undefined}
        />
        <WorkloadRow icon={Inbox} label="待办" value={todo} />
      </CardContent>
    </Card>
  );
}


const TONE_TEXT = {
  info: "text-info",
  warn: "text-warn",
  muted: "text-muted-foreground",
} as const;

function WorkloadRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "info" | "warn";
}) {
  const colorClass = tone ? TONE_TEXT[tone] : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn("h-4 w-4", colorClass)} />
        {label}
      </div>
      <div className={cn("text-2xl font-semibold tabular-nums", colorClass)}>
        {value}
      </div>
    </div>
  );
}

// ───────────────────────── 顶部第二/三列：截止任务预览 ─────────────────────────

type DayGroup = { key: string; label: string; tone?: "danger"; tasks: TaskDTO[] };

const WEEK_DAY = ["日", "一", "二", "三", "四", "五", "六"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatDayLabel(date: Date, todayStart: Date, tomorrowStart: Date): string {
  const dayName = WEEK_DAY[date.getDay()];
  if (dayKey(date) === dayKey(todayStart)) return `今日 (周${dayName})`;
  if (dayKey(date) === dayKey(tomorrowStart)) return `明日 (周${dayName})`;
  return `${date.getMonth() + 1}月${date.getDate()}日 (周${dayName})`;
}

/**
 * 把带 dueDate 的任务按"日"分组：
 *  - 早于今天 → 单独聚到「已过期」组，置顶
 *  - 其它按日聚合，按日期升序排列
 *  组内任务再按 dueDate 升序
 */
function groupByDay(
  tasks: TaskDTO[],
  todayStart: Date,
  tomorrowStart: Date,
): DayGroup[] {
  const overdue: TaskDTO[] = [];
  const buckets = new Map<string, { date: Date; tasks: TaskDTO[] }>();

  for (const t of tasks) {
    const d = new Date(t.dueDate!);
    if (d < todayStart) {
      overdue.push(t);
      continue;
    }
    const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const k = dayKey(dayOnly);
    const bucket = buckets.get(k);
    if (bucket) bucket.tasks.push(t);
    else buckets.set(k, { date: dayOnly, tasks: [t] });
  }

  const byDue = (a: TaskDTO, b: TaskDTO) =>
    +new Date(a.dueDate!) - +new Date(b.dueDate!);

  const result: DayGroup[] = [];
  if (overdue.length > 0) {
    overdue.sort(byDue);
    result.push({
      key: "overdue",
      label: `已过期 (${overdue.length})`,
      tone: "danger",
      tasks: overdue,
    });
  }

  const sortedBuckets = Array.from(buckets.entries()).sort(
    (a, b) => +a[1].date - +b[1].date,
  );
  for (const [k, v] of sortedBuckets) {
    v.tasks.sort(byDue);
    result.push({
      key: k,
      label: formatDayLabel(v.date, todayStart, tomorrowStart),
      tasks: v.tasks,
    });
  }

  return result;
}

function PreviewPanel({
  icon,
  title,
  subtitle,
  totalCount,
  groups,
  emptyHint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  totalCount: number;
  groups: DayGroup[];
  emptyHint: string;
}) {
  return (
    <Card className="flex flex-col">
      <PanelHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        rightSlot={
          <Badge variant="muted" className="font-normal tabular-nums">
            {totalCount}
          </Badge>
        }
      />
      <CardContent className="max-h-[24rem] flex-1 space-y-3 overflow-y-auto pt-3">
        {groups.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {emptyHint}
          </div>
        ) : (
          groups.map((g) => <DayGroupSection key={g.key} group={g} />)
        )}
      </CardContent>
    </Card>
  );
}

function DayGroupSection({ group }: { group: DayGroup }) {
  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-center gap-2 px-1 text-xs font-medium",
          group.tone === "danger" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <span>{group.label}</span>
      </div>
      <div className="space-y-0.5">
        {group.tasks.map((t) => (
          <PreviewItem key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

const DUE_TONE_CLASS = {
  danger: "text-destructive",
  warn: "text-warn",
  muted: "text-muted-foreground",
} as const;

function PreviewItem({ task }: { task: TaskDTO }) {
  const due = formatDueLabel(task.dueDate);
  return (
    <Link
      href={`/project/${task.projectId}`}
      className="block rounded-md px-1.5 py-1 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-center gap-1.5">
        <PriorityBadge priority={task.priority} short />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {task.title}
        </span>
        {due && (
          <span
            className={cn(
              "shrink-0 text-[10px] tabular-nums",
              DUE_TONE_CLASS[due.tone],
            )}
          >
            {due.label}
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 pl-0.5 text-[11px] text-muted-foreground">
        <ProjectPill name={task.project.name} />
        <span className="text-muted-foreground/40">·</span>
        <span className="truncate">{task.assignee?.name ?? "未分配"}</span>
      </div>
    </Link>
  );
}
