"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, CalendarClock, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/priority-badge";
import { cn, formatDueLabel } from "@/lib/utils";
import type { TaskDTO } from "@/lib/types";

const DUE_TONE_CLASS = {
  danger: "text-destructive",
  warn: "text-warn",
  muted: "text-muted-foreground",
} as const;

/**
 * 看板列里的小卡片：精简版任务卡，仅显示关键信息。
 */
export function BoardTaskCard({
  task,
  onOpen,
}: {
  task: TaskDTO;
  onOpen?: (task: TaskDTO) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const due = task.status === "done" ? null : formatDueLabel(task.dueDate);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group cursor-pointer transition-all hover:border-foreground/20",
        isDragging && "opacity-40 ring-2 ring-primary",
      )}
      onClick={() => onOpen?.(task)}
    >
      <CardContent className="space-y-1.5 p-2.5">
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
            aria-label="拖动排序"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <PriorityBadge priority={task.priority} short />
          <span className="flex-1 text-xs font-medium leading-snug">
            {task.title}
          </span>
        </div>
        <div className="flex items-center gap-2 pl-6 text-[11px] text-muted-foreground">
          {task.assignee && <span>{task.assignee.name}</span>}
          {task.yuqueLinks.length > 0 && <span>· 文档 ×{task.yuqueLinks.length}</span>}
          {due && (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-0.5 tabular-nums",
                DUE_TONE_CLASS[due.tone],
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {due.label}
            </span>
          )}
        </div>
        {task.status === "blocked" && task.blockedReason && (
          <div className="flex items-center gap-1 pl-6 text-[11px] text-warn">
            <AlertTriangle className="h-3 w-3" />
            {task.blockedReason}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
