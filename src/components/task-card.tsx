"use client";

import type { ComponentType } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  GripVertical,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "@/components/priority-badge";
import { ProjectPill } from "@/components/project-pill";
import { cn, formatDueLabel } from "@/lib/utils";
import type { TaskDTO, TaskStatus } from "@/lib/types";

type Action = { kind: "status"; value: TaskStatus };

interface TaskCardProps {
  task: TaskDTO;
  onAction?: (taskId: string, action: Action) => void;
  onOpen?: (task: TaskDTO) => void;
  /** 隐藏负责人（成员工作台里已知负责人，避免冗余） */
  hideAssignee?: boolean;
  /** 隐藏项目（项目看板里已知项目，避免冗余） */
  hideProject?: boolean;
  className?: string;
}

const DUE_TONE_CLASS = {
  danger: "text-destructive",
  warn: "text-warn",
  muted: "text-muted-foreground",
} as const;

function statusBarClass(status: TaskStatus) {
  switch (status) {
    case "doing":
      return "bg-info";
    case "blocked":
      return "bg-warn";
    case "done":
      return "bg-success/60";
    default:
      return "bg-border";
  }
}

export function TaskCard({
  task,
  onAction,
  onOpen,
  hideAssignee,
  hideProject,
  className,
}: TaskCardProps) {
  // 已完成任务不再强调截止时间（避免一片"逾期"红色噪音）
  const due = task.status === "done" ? null : formatDueLabel(task.dueDate);
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

  const showProject = !hideProject;
  const showAssignee = !hideAssignee && task.assignee;
  const showYuque = task.yuqueLinks.length > 0;
  const showBlocked = task.status === "blocked" && !!task.blockedReason;
  // 项目 pill 已经移到标题行，meta 行只在还有 assignee / yuque / blocked 时才出现
  const hasMetaRow = showAssignee || showYuque || showBlocked;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex overflow-hidden p-0 transition-colors hover:border-foreground/25",
        isDragging && "opacity-40 ring-2 ring-primary",
        className,
      )}
    >
      <div className={cn("w-1 shrink-0", statusBarClass(task.status))} />
      <div className="min-w-0 flex-1 space-y-1 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="-ml-1 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
            aria-label="拖动排序"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <PriorityBadge priority={task.priority} short />
          {showProject && (
            <span className="shrink-0">
              <ProjectPill name={task.project.name} color={task.project.color} size="xs" />
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpen?.(task)}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium leading-snug hover:underline"
          >
            {task.title}
          </button>
          {due && (
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums",
                DUE_TONE_CLASS[due.tone],
              )}
            >
              {due.label}
            </span>
          )}
          {onAction && (
            <ActionButtons status={task.status} taskId={task.id} onAction={onAction} />
          )}
        </div>

        {hasMetaRow && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-6 text-xs text-muted-foreground">
            {showAssignee && task.assignee && (
              <span>{task.assignee.name}</span>
            )}
            {showYuque && (
              <a
                href={task.yuqueLinks[0].url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-info hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                语雀文档 ×{task.yuqueLinks.length}
              </a>
            )}
            {showBlocked && (
              <span className="inline-flex items-center gap-1 text-warn">
                <AlertTriangle className="h-3 w-3" />
                {task.blockedReason}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * 卡片右侧的紧凑操作组。
 *
 * 视觉规则（保持同组按钮风格一致）：
 *  - 三个按钮高度统一 h-7，圆角统一 rounded-md
 *  - 主操作（开始 / 完成 / 解除阻塞）：filled，带文字
 *  - 次操作（阻塞 / 暂停）：outline 同等高度 icon-only 方块按钮（h-7 w-7）
 */
function ActionButtons({
  status,
  taskId,
  onAction,
}: {
  status: TaskStatus;
  taskId: string;
  onAction: (taskId: string, action: Action) => void;
}) {
  const primaryClass = "h-7 px-2.5 text-xs [&_svg]:size-3.5";

  if (status === "todo") {
    return (
      <Button
        size="sm"
        className={cn("shrink-0", primaryClass)}
        onClick={() => onAction(taskId, { kind: "status", value: "doing" })}
      >
        <PlayCircle />
        开始
      </Button>
    );
  }
  if (status === "doing") {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          className={primaryClass}
          onClick={() => onAction(taskId, { kind: "status", value: "done" })}
        >
          <CheckCircle2 />
          完成
        </Button>
        <IconAction
          label="标记阻塞"
          Icon={AlertTriangle}
          tone="text-warn"
          onClick={() => onAction(taskId, { kind: "status", value: "blocked" })}
        />
        <IconAction
          label="暂停退回待办"
          Icon={PauseCircle}
          onClick={() => onAction(taskId, { kind: "status", value: "todo" })}
        />
      </div>
    );
  }
  if (status === "blocked") {
    return (
      <Button
        size="sm"
        className={cn("shrink-0", primaryClass)}
        onClick={() => onAction(taskId, { kind: "status", value: "todo" })}
      >
        <CircleDot />
        解除阻塞
      </Button>
    );
  }
  return null;
}

function IconAction({
  label,
  Icon,
  tone,
  onClick,
}: {
  label: string;
  Icon: ComponentType<{ className?: string }>;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "h-7 w-7 shrink-0 p-0 [&_svg]:size-3.5",
        tone ?? "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon />
    </Button>
  );
}
