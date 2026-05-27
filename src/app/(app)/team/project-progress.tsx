"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">项目进度</h2>
        <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
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
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          没有活跃项目
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <ProgressCard key={p.id} item={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProgressCard({ item }: { item: ProjectProgressItem }) {
  const hex = PROJECT_COLOR_HEX[item.color];
  return (
    <Card className="transition-colors hover:border-foreground/20">
      <CardContent className="space-y-1.5 p-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: hex }}
          />
          <Link
            href={`/project/${item.id}`}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {item.name}
          </Link>
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
      </CardContent>
    </Card>
  );
}
