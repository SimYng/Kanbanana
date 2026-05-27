import { prisma } from "@/lib/db";

/**
 * 任务状态的日级快照。
 *
 * 背景：
 *  - team page 顶部「工作量分布」需要展示进行中 / 阻塞 / 待办的近期趋势
 *  - 这些是 Task.status 的「当前值」，DB 里没有历史，做 sparkline 必须有日级快照
 *
 * 方案：
 *  - 没有 cron 框架，用「懒触发」：每次访问 /team 时 upsert 当天一条
 *  - 历史日不动；某天没人访问就会留个空洞，前端用线性插值兜底
 *  - 不耦合 user / project 维度，4 个状态计数即可，表很小
 */

/** 把任意 Date 对齐到本地零点（用于和 DailyStatusSnapshot.date 比较 / 写入）。 */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface StatusCounts {
  doing: number;
  blocked: number;
  todo: number;
  done: number;
}

/** 当天 upsert 一条快照（覆盖最新值，因为今天还在变）。 */
export async function upsertTodayStatusSnapshot(counts: StatusCounts) {
  const today = startOfLocalDay(new Date());
  await prisma.dailyStatusSnapshot.upsert({
    where: { date: today },
    update: counts,
    create: { date: today, ...counts },
  });
}

export interface StatusSeries {
  doing: number[];
  blocked: number[];
  todo: number[];
}

/**
 * 取过去 N 天（含今天）的状态序列，按日历日对齐。
 *
 * 缺失日处理：缺哪天填 0。
 * 这是"开箱即有曲线"的工程妥协 —— 首次部署后没有历史快照，
 * 用 0 占位让 sparkline 立刻有形态；随着每日访问累积，0 会被真实值覆盖。
 *
 * 注意：0 在语义上是"那天没数据"而非"那天真的 0 任务"，
 * 视觉上可能呈现"刚起步时尖刺上扬"的曲线，这是预期的。
 */
export async function getStatusSeries(daysBack: number): Promise<StatusSeries> {
  const today = startOfLocalDay(new Date());
  const earliest = new Date(today);
  earliest.setDate(earliest.getDate() - (daysBack - 1));

  const snapshots = await prisma.dailyStatusSnapshot.findMany({
    where: { date: { gte: earliest, lte: today } },
    orderBy: { date: "asc" },
  });

  const map = new Map<string, StatusCounts>();
  for (const s of snapshots) {
    const d = new Date(s.date);
    const local = startOfLocalDay(d);
    const key = `${local.getFullYear()}-${local.getMonth()}-${local.getDate()}`;
    map.set(key, {
      doing: s.doing,
      blocked: s.blocked,
      todo: s.todo,
      done: s.done,
    });
  }

  const doing: number[] = [];
  const blocked: number[] = [];
  const todo: number[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    const cell = map.get(key);
    doing.push(cell?.doing ?? 0);
    blocked.push(cell?.blocked ?? 0);
    todo.push(cell?.todo ?? 0);
  }

  return { doing, blocked, todo };
}
