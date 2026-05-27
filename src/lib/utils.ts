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
