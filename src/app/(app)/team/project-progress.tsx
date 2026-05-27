"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FolderKanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PROJECT_COLOR_HEX, type ProjectColor } from "@/lib/types";
import { PanelHeader } from "./panel-header";

export interface ProjectProgressItem {
  id: string;
  name: string;
  color: ProjectColor;
  doneCount: number;
  blockedCount: number;
  totalCount: number;
  pct: number; // 0-100
}

type SortMode =
  | "manual"
  | "progress-desc"
  | "progress-asc"
  | "blocked-desc"
  | "open-desc";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "manual", label: "项目看板顺序" },
  { value: "open-desc", label: "未完成多 → 少" },
  { value: "blocked-desc", label: "阻塞优先" },
  { value: "progress-asc", label: "完成度低 → 高" },
  { value: "progress-desc", label: "完成度高 → 低" },
];

function sortItems(
  items: ProjectProgressItem[],
  mode: SortMode,
): ProjectProgressItem[] {
  if (mode === "manual") return items;
  const arr = [...items];
  switch (mode) {
    case "progress-desc":
      arr.sort((a, b) => b.pct - a.pct);
      break;
    case "progress-asc":
      arr.sort((a, b) => a.pct - b.pct);
      break;
    case "blocked-desc":
      arr.sort((a, b) => b.blockedCount - a.blockedCount);
      break;
    case "open-desc": {
      const open = (it: ProjectProgressItem) => it.totalCount - it.doneCount;
      arr.sort((a, b) => open(b) - open(a));
      break;
    }
  }
  return arr;
}

export function ProjectProgressGrid({
  items,
}: {
  items: ProjectProgressItem[];
}) {
  const [sort, setSort] = useState<SortMode>("manual");
  const sorted = useMemo(() => sortItems(items, sort), [items, sort]);

  return (
    // xl:flex-1 + xl:min-h-0 配合 page.tsx 的 absolute wrapper：
    //  - flex-1 占满 wrapper 宽高（wrapper 是 xl:flex）
    //  - min-h-0 让 Card 允许收缩到 wrapper 高度以下，从而 CardContent 的
    //    flex-1 + overflow-y-auto 才能在 xl 屏正确生效（否则内容会撑破）
    <Card className="flex w-full flex-col xl:min-h-0 xl:flex-1">
      <PanelHeader
        icon={FolderKanban}
        title="项目进度"
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
      {/* 项目 panel 受 grid stretch 拉到与成员同高，超出部分在 CardContent 内滚动；
          min-h-0 是 flex 子项允许收缩到内容以下的必需配合，否则 overflow 不会生效 */}
      <CardContent className="min-h-0 flex-1 divide-y overflow-y-auto p-0">
        {items.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            没有活跃项目
          </div>
        ) : (
          sorted.map((p) => <ProgressRow key={p.id} item={p} />)
        )}
      </CardContent>
    </Card>
  );
}

function ProgressRow({ item }: { item: ProjectProgressItem }) {
  const hex = PROJECT_COLOR_HEX[item.color];
  return (
    <Link
      href={`/project/${item.id}`}
      className="group block outline-none focus-visible:bg-accent/40"
    >
      <div className="space-y-1.5 px-3 py-2 transition-colors group-hover:bg-accent/40">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: hex }}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {item.name}
          </span>
          {item.blockedCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums text-warn">
              <AlertTriangle className="h-3 w-3" />
              {item.blockedCount}
            </span>
          )}
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {item.doneCount}/{item.totalCount}
            <span className={cn("ml-1.5", item.pct === 100 && "text-success")}>
              {item.pct}%
            </span>
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full transition-all"
            style={{ width: `${item.pct}%`, background: hex }}
          />
        </div>
      </div>
    </Link>
  );
}
