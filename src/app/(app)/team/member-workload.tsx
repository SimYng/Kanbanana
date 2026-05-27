"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar } from "@/components/member-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./panel-header";

export interface MemberWorkloadRow {
  member: { id: string; name: string };
  doingCount: number;
  todoCount: number;
  blockedCount: number;
  doneToday: number;
  total: number;
}

type SortMode =
  | "manual"
  | "total-desc"
  | "blocked-desc"
  | "doing-desc"
  | "done-today-desc";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "manual", label: "团队成员顺序" },
  { value: "total-desc", label: "未完成多 → 少" },
  { value: "blocked-desc", label: "阻塞优先" },
  { value: "doing-desc", label: "进行中多 → 少" },
  { value: "done-today-desc", label: "今日完成多 → 少" },
];

function sortRows(
  rows: MemberWorkloadRow[],
  mode: SortMode,
): MemberWorkloadRow[] {
  if (mode === "manual") return rows;
  const arr = [...rows];
  switch (mode) {
    case "total-desc":
      arr.sort((a, b) => b.total - a.total);
      break;
    case "blocked-desc":
      arr.sort((a, b) => b.blockedCount - a.blockedCount);
      break;
    case "doing-desc":
      arr.sort((a, b) => b.doingCount - a.doingCount);
      break;
    case "done-today-desc":
      arr.sort((a, b) => b.doneToday - a.doneToday);
      break;
  }
  return arr;
}

export function MemberWorkload({ rows }: { rows: MemberWorkloadRow[] }) {
  const [sort, setSort] = useState<SortMode>("manual");
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  return (
    <Card className="flex flex-col">
      <PanelHeader
        icon={Users}
        title="成员手头工作量"
        rightSlot={
          <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {/* 成员 panel 不限高：高度自然撑开，作为整行 grid 的基准 */}
      <CardContent className="divide-y p-0">
        {rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            还没有成员
          </div>
        ) : (
          sorted.map((w) => <MemberRow key={w.member.id} row={w} />)
        )}
      </CardContent>
    </Card>
  );
}

function MemberRow({ row: w }: { row: MemberWorkloadRow }) {
  // 进度条按未完成任务的内部结构比例铺满，不再引入"建议容量"概念
  const denom = Math.max(w.total, 1);
  return (
    <Link
      href={`/member/${w.member.id}`}
      className="group block outline-none focus-visible:bg-accent/40"
    >
      <div className="space-y-1.5 px-3 py-2 transition-colors group-hover:bg-accent/40">
        <div className="flex items-center gap-2.5">
          <MemberAvatar name={w.member.name} />
          <span className="text-sm font-medium">{w.member.name}</span>
          <div className="flex items-baseline gap-2 text-[11px] tabular-nums">
            <InlineStat tone="info" label="进行" value={w.doingCount} />
            <InlineStat tone="muted" label="待办" value={w.todoCount} />
            <InlineStat
              tone="warn"
              label="阻塞"
              value={w.blockedCount}
              hideWhenZero
            />
            <InlineStat
              tone="success"
              label="今日完成"
              value={w.doneToday}
              hideWhenZero
            />
          </div>
          <span className="ml-auto text-sm font-medium tabular-nums text-muted-foreground">
            共 {w.total}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
        {w.total > 0 && (
          <div className="flex h-0.5 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-info transition-all"
              style={{ width: `${(w.doingCount / denom) * 100}%` }}
            />
            <div
              className="bg-muted-foreground/50 transition-all"
              style={{ width: `${(w.todoCount / denom) * 100}%` }}
            />
            <div
              className="bg-warn transition-all"
              style={{ width: `${(w.blockedCount / denom) * 100}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}

const INLINE_STAT_TONE = {
  info: "text-info",
  warn: "text-warn",
  success: "text-success",
  muted: "text-muted-foreground",
} as const;

/**
 * "·进行 3" 形式的行内小数字，配色随状态变化。
 *  hideWhenZero=true 时 0 直接不渲染，避免一排没意义的 0
 */
function InlineStat({
  tone,
  label,
  value,
  hideWhenZero,
}: {
  tone: keyof typeof INLINE_STAT_TONE;
  label: string;
  value: number;
  hideWhenZero?: boolean;
}) {
  if (hideWhenZero && value === 0) return null;
  return (
    <span className={cn("inline-flex items-baseline gap-0.5", INLINE_STAT_TONE[tone])}>
      <span className="text-muted-foreground/60">·</span>
      <span className="text-muted-foreground/80">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}
