import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Inbox,
  ListTodo,
  PlayCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectPill } from "@/components/project-pill";
import { Sparkline } from "@/components/sparkline";
import { TASK_INCLUDE, serializeTask } from "@/lib/serializers";
import { getStatusSeries, upsertTodayStatusSnapshot } from "@/lib/snapshot";
import { cn, formatDueLabel, isTaskVisible, isToday } from "@/lib/utils";
import { isActiveStatus, type TaskDTO } from "@/lib/types";
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
    // 工作量只算「活跃」任务：done（已完成）/ canceled（已取消）都不再是手头活
    const open = mine.filter((t) => isActiveStatus(t.status));
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
  // 活跃任务池：排除 done + canceled，作为全局工作量 / 截止前瞻的口径
  const openTasks = tasks.filter((t) => isActiveStatus(t.status));

  // 全局工作量统计（顶部第一列用）
  const overall = {
    doing: openTasks.filter((t) => t.status === "doing").length,
    blocked: blockedTasks.length,
    todo: openTasks.filter((t) => t.status === "todo").length,
  };

  // 「懒触发」每日快照：每次访问 /team 都 upsert 一条今天的快照，
  // 用于累积 doing / blocked / todo 的近期趋势 sparkline。
  // 没有 cron 框架，依赖访问触发；故障容忍度高，写挂掉也不影响渲染。
  const SNAPSHOT_WINDOW = 7;
  const doneTodayForSnapshot = allTaskDtos.filter(
    (t) => t.status === "done" && isToday(t.completedAt),
  ).length;
  try {
    await upsertTodayStatusSnapshot({
      doing: overall.doing,
      blocked: overall.blocked,
      todo: overall.todo,
      done: doneTodayForSnapshot,
    });
  } catch {
    // 静默失败：快照只是趋势辅助，挂了也不影响主页渲染
  }
  const statusSeries = await getStatusSeries(SNAPSHOT_WINDOW);

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

  // 时间序列：按日聚合，给「工作量分布」的两个指标画 sparkline。
  // 进行中 / 阻塞 / 待办没有日级历史快照（要做需要新建 TaskActivity 表 + 定时任务），
  // 目前只为「今日完成」「未来 7 天截止」算真实趋势。
  const COMPLETED_WINDOW = 7;
  const completedSeries: number[] = [];
  for (let i = COMPLETED_WINDOW - 1; i >= 0; i--) {
    const dayStart = new Date(todayStart);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const count = allTaskDtos.filter(
      (t) =>
        t.completedAt &&
        new Date(t.completedAt) >= dayStart &&
        new Date(t.completedAt) < dayEnd,
    ).length;
    completedSeries.push(count);
  }
  const doneTodayCount = completedSeries[completedSeries.length - 1];

  const DUE_WINDOW = 7;
  const dueSeries: number[] = [];
  for (let i = 0; i < DUE_WINDOW; i++) {
    const dayStart = new Date(todayStart);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const count = openTasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) >= dayStart &&
        new Date(t.dueDate) < dayEnd,
    ).length;
    dueSeries.push(count);
  }
  // 未来 7 天截止总数（不含逾期，更适合作为"前瞻"指标）
  const dueWeekCount = dueSeries.reduce((a, b) => a + b, 0);

  // 项目进度数据：保持 server 端 sortIndex 顺序作为"手动排序"默认值
  const projectProgressItems: ProjectProgressItem[] = projects.map((p) => {
    // 已取消任务移出范围：既不算完成、也不算待办，不该拉低 / 计入进度分母
    const pt = tasks.filter(
      (t) => t.projectId === p.id && t.status !== "canceled",
    );
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

      {/*
        第一行 3 卡片：以「工作量分布」的内容高度为 row 高度基准，
        另外两个截止任务面板若任务多于工作量分布的行数 → 卡片内滚动，不撑高 row。

        实现技巧：与下面成员工作量 / 项目进度那行一致：
         - WorkloadSummary 走 normal flow，决定 row 高度
         - 另外两个用 relative 占位 + absolute 撑满 row（脱离 row 高度计算）
         - 小屏（< lg）单列堆叠时不启用 absolute，恢复自然文档流，避免高度坍塌
      */}
      <div className="grid gap-3 lg:grid-cols-3">
        <WorkloadSummary
          doing={overall.doing}
          blocked={overall.blocked}
          todo={overall.todo}
          doneToday={doneTodayCount}
          completedSeries={completedSeries}
          dueWeek={dueWeekCount}
          dueSeries={dueSeries}
          doingSeries={statusSeries.doing}
          blockedSeries={statusSeries.blocked}
          todoSeries={statusSeries.todo}
        />
        <div className="lg:relative">
          <div className="lg:absolute lg:inset-0 lg:flex">
            <PreviewPanel
              icon={CalendarDays}
              title="今日任务"
              subtitle="逾期 + 今天到期"
              totalCount={todayPool.length}
              groups={todayGroups}
              emptyHint="今日没有需要冲的截止任务 🎉"
            />
          </div>
        </div>
        <div className="lg:relative">
          <div className="lg:absolute lg:inset-0 lg:flex">
            <PreviewPanel
              icon={ListTodo}
              title="未来 7 天"
              subtitle="按日聚合"
              totalCount={weekPool.length}
              groups={weekGroups}
              emptyHint="未来一周没有截止任务"
            />
          </div>
        </div>
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
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">任务</th>
                  <th className="px-3 py-2 font-medium">负责人</th>
                  <th className="px-3 py-2 font-medium">项目</th>
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
  doneToday,
  completedSeries,
  dueWeek,
  dueSeries,
  doingSeries,
  blockedSeries,
  todoSeries,
}: {
  doing: number;
  blocked: number;
  todo: number;
  doneToday: number;
  /** 过去 7 天每日完成数（含今天） */
  completedSeries: number[];
  dueWeek: number;
  /** 未来 7 天每日截止数（不含逾期） */
  dueSeries: number[];
  /** 来自 DailyStatusSnapshot 的近 7 天序列；点数太少时上层会传 undefined */
  doingSeries?: number[];
  blockedSeries?: number[];
  todoSeries?: number[];
}) {
  return (
    <Card className="flex flex-col">
      <PanelHeader icon={CheckCircle2} title="工作量分布" />
      <CardContent className="flex flex-1 flex-col gap-2 pt-3">
        <WorkloadRow
          icon={PlayCircle}
          label="进行中"
          value={doing}
          tone="info"
          series={doingSeries}
          seriesHint="过去 7 天"
        />
        <WorkloadRow
          icon={AlertTriangle}
          label="阻塞"
          value={blocked}
          tone={blocked > 0 ? "warn" : undefined}
          series={blockedSeries}
          seriesHint="过去 7 天"
        />
        <WorkloadRow
          icon={Inbox}
          label="待办"
          value={todo}
          series={todoSeries}
          seriesHint="过去 7 天"
        />
        <WorkloadRow
          icon={CheckCircle2}
          label="今日完成"
          value={doneToday}
          tone="success"
          series={completedSeries}
          seriesHint="过去 7 天"
        />
        <WorkloadRow
          icon={CalendarClock}
          label="未来 7 天截止"
          value={dueWeek}
          tone={dueWeek > 0 ? "warn" : undefined}
          series={dueSeries}
          seriesHint="按日"
        />
      </CardContent>
    </Card>
  );
}


const TONE_TEXT = {
  info: "text-info",
  warn: "text-warn",
  success: "text-success",
  muted: "text-muted-foreground",
} as const;

function WorkloadRow({
  icon: Icon,
  label,
  value,
  tone,
  series,
  seriesHint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "info" | "warn" | "success";
  /** 有 series 时右侧画 sparkline；没有则不画（不挤压数字位置） */
  series?: number[];
  /** sparkline 上方 tooltip 文案，便于鼠标悬停说明数据口径 */
  seriesHint?: string;
}) {
  const colorClass = tone ? TONE_TEXT[tone] : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn("h-4 w-4 shrink-0", colorClass)} />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {series && series.length > 1 && (
          <span className={colorClass} title={seriesHint}>
            <Sparkline data={series} width={68} height={20} />
          </span>
        )}
        <div
          className={cn(
            "min-w-[2ch] text-right text-xl font-semibold tabular-nums",
            colorClass,
          )}
        >
          {value}
        </div>
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
    // lg+ 处于 row-absolute 容器内：用 flex-1 + min-h-0 撑满父级，
    // 让 CardContent 的 overflow-y-auto 在 row 内部生效。
    // 小屏单列堆叠时仍保留 max-h 兜底，避免一个超长列表把页面拉得很长。
    <Card className="flex w-full flex-col lg:min-h-0 lg:flex-1">
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
      <CardContent className="max-h-[24rem] min-h-0 flex-1 space-y-4 overflow-y-auto pt-3 lg:max-h-none">
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
    <section className="space-y-1">
      {/*
        日期分组标题：
         - 字号 / 颜色都比任务行更"标题化"，避免和正文混成一团灰
         - 底部一根淡分割线代替留白，组与组之间靠空白 + 线分割
         - danger 组（已过期）整组色调泛红，便于一眼区分
      */}
      <header
        className={cn(
          "flex items-baseline justify-between border-b border-border/60 px-1 pb-1 text-[12px] font-semibold tracking-tight",
          group.tone === "danger"
            ? "border-destructive/30 text-destructive"
            : "text-foreground/80",
        )}
      >
        <span>{group.label}</span>
        <span className="text-[10px] font-normal tabular-nums text-muted-foreground/70">
          {group.tasks.length}
        </span>
      </header>
      <ul className="space-y-0.5">
        {group.tasks.map((t) => (
          <PreviewItem key={t.id} task={t} />
        ))}
      </ul>
    </section>
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
    <li>
      <Link
        href={`/project/${task.projectId}`}
        className="block rounded-md px-1.5 py-1 transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">
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
        {/*
          二级元信息：项目 · 负责人。
          以前 · 用 muted/40 在浅色主题上几乎不可见，整行看着像挤一团；
          统一用 muted-foreground/60，并显式 leading 与 nbsp 控制呼吸感。
        */}
        <div className="mt-0.5 flex items-center gap-1.5 pl-0.5 text-[11px] leading-tight text-muted-foreground">
          <span className="min-w-0 truncate">{task.project.name}</span>
          <span aria-hidden className="text-muted-foreground/50">
            ·
          </span>
          <span className="shrink-0">{task.assignee?.name ?? "未分配"}</span>
        </div>
      </Link>
    </li>
  );
}
