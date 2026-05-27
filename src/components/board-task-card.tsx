"use client";

import type { ComponentType } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  GripVertical,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/priority-badge";
import { cn, formatDueLabel } from "@/lib/utils";
import type { TaskDTO, TaskStatus } from "@/lib/types";

const DUE_TONE_CLASS = {
  danger: "text-destructive",
  warn: "text-warn",
  muted: "text-muted-foreground",
} as const;

type Action = { kind: "status"; value: TaskStatus };

interface BoardTaskCardProps {
  task: TaskDTO;
  onOpen?: (task: TaskDTO) => void;
  /** 传入则在卡片 hover 时露出紧凑的状态切换按钮组 */
  onAction?: (taskId: string, action: Action) => void;
}

/**
 * 看板列里的小卡片：精简版任务卡。
 *
 * 布局心智：
 *  - 第一行：drag · P2 · 负责人 · 标题（占满剩余）· 截止时间
 *  - 第二行（仅在有文档/阻塞/可操作时渲染）：辅助元信息 + hover 状态切换按钮
 *  - 所有元素 `items-center` 垂直居中对齐，避免 badge 与文本高度不一致
 */
export function BoardTaskCard({ task, onOpen, onAction }: BoardTaskCardProps) {
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
  const hasYuque = task.yuqueLinks.length > 0;
  const hasBlockedReason = task.status === "blocked" && !!task.blockedReason;
  const hasMetaRow = hasYuque || hasBlockedReason || !!onAction;

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
      <CardContent className="space-y-1 p-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
            aria-label="拖动排序"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <PriorityBadge priority={task.priority} short />
          {task.assignee && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {task.assignee.name}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs font-medium leading-snug">
            {task.title}
          </span>
          {due && (
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-0.5 text-[11px] tabular-nums",
                DUE_TONE_CLASS[due.tone],
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {due.label}
            </span>
          )}
        </div>

        {hasMetaRow && (
          <div className="flex items-center gap-2 pl-6 text-[11px] text-muted-foreground">
            {hasYuque && <span>文档 ×{task.yuqueLinks.length}</span>}
            {hasBlockedReason && (
              <span className="inline-flex items-center gap-1 text-warn">
                <AlertTriangle className="h-3 w-3" />
                {task.blockedReason}
              </span>
            )}
            {onAction && (
              <div className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <CompactActions
                  status={task.status}
                  taskId={task.id}
                  onAction={onAction}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CompactActionButton {
  value: TaskStatus;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  tone?: string;
}

function CompactActions({
  status,
  taskId,
  onAction,
}: {
  status: TaskStatus;
  taskId: string;
  onAction: (taskId: string, action: Action) => void;
}) {
  const buttons: CompactActionButton[] = (() => {
    if (status === "todo") {
      return [{ value: "doing", label: "开始", Icon: PlayCircle, tone: "text-info" }];
    }
    if (status === "doing") {
      return [
        { value: "done", label: "完成", Icon: CheckCircle2, tone: "text-success" },
        { value: "blocked", label: "标记阻塞", Icon: AlertTriangle, tone: "text-warn" },
        { value: "todo", label: "暂停退回待办", Icon: PauseCircle },
      ];
    }
    if (status === "blocked") {
      return [{ value: "todo", label: "解除阻塞", Icon: CircleDot, tone: "text-info" }];
    }
    return [];
  })();

  if (buttons.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5">
      {buttons.map(({ value, label, Icon, tone }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            "rounded p-0.5 hover:bg-accent",
            tone ?? "text-muted-foreground",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onAction(taskId, { kind: "status", value });
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
