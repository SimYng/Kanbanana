import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TaskStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 任务是否被「项目归档」作废：项目已归档且任务未完成。
 *
 * 归档 = 项目结束，未完成的事就不会再做了，不该再出现在「待办 / 进行中 / 阻塞」
 * 以及它们的统计里；但已完成的任务保留，作为团队的历史业绩。
 */
export function isTaskDiscarded(task: {
  status: TaskStatus;
  project: { archived: boolean };
}): boolean {
  return task.project.archived && task.status !== "done";
}

/** 与 isTaskDiscarded 反义：可见任务（未归档项目的任务 ∪ 任意项目里已完成的任务）。 */
export function isTaskVisible(task: {
  status: TaskStatus;
  project: { archived: boolean };
}): boolean {
  return !isTaskDiscarded(task);
}

/**
 * 把 ISO 时间字符串转为本地日期的 yyyy-MM-dd（用于 `<input type="date">` 的 value）。
 * 直接用 `toISOString().slice(0,10)` 会按 UTC 取日期，在中国可能差一天。
 */
export function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 把 `<input type="date">` 给到的 yyyy-MM-dd 字符串转为 ISO 时刻。
 *
 * dueDate 是"日期"概念而非"时刻"，存为当地 23:59:59 的 ISO，
 * 这样在"今天/逾期"判断里能直观地把整天都视为该日期内。
 */
export function localDateToIso(localDate: string | null | undefined): string | null {
  if (!localDate) return null;
  const d = new Date(`${localDate}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * 把截止时间格式化为 UI 标签 + 强弱配色。
 *
 * - 已过期 → "逾期 N 天" / danger
 * - 当天 → "今天到期" / warn
 * - 明天 → "明天到期" / warn
 * - 7 天内 → "N 天后" / muted
 * - 更远 → "M月D日" 或 "yyyy/M/D" / muted
 */
export function formatDueLabel(
  iso: string | null | undefined,
): { label: string; tone: "danger" | "warn" | "muted" } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: `逾期 ${-diff} 天`, tone: "danger" };
  if (diff === 0) return { label: "今天到期", tone: "warn" };
  if (diff === 1) return { label: "明天到期", tone: "warn" };
  if (diff <= 7) return { label: `${diff} 天后`, tone: "muted" };
  if (due.getFullYear() === today.getFullYear()) {
    return { label: `${due.getMonth() + 1}月${due.getDate()}日`, tone: "muted" };
  }
  return {
    label: `${due.getFullYear()}/${due.getMonth() + 1}/${due.getDate()}`,
    tone: "muted",
  };
}

/** 判断 ISO 字符串或 Date 是否落在"今天"（本地时区）。 */
export function isToday(input: string | Date | null | undefined): boolean {
  if (!input) return false;
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
