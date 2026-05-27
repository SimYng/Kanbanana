"use client";

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
  const showBlocked = task.status === "blocked" && task.blockedReason;
  const hasMetaRow = showProject || showAssignee || showYuque || showBlocked;

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
      <div className="min-w-0 flex-1 space-y-1.5 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="-ml-1 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
            aria-label="拖动排序"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <PriorityBadge priority={task.priority} short />
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-xs text-muted-foreground">
            {showProject && (
              <ProjectPill name={task.project.name} color={task.project.color} />
            )}
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

function ActionButtons({
  status,
  taskId,
  onAction,
}: {
  status: TaskStatus;
  taskId: string;
  onAction: (taskId: string, action: Action) => void;
}) {
  if (status === "todo") {
    return (
      <Button
        size="sm"
        onClick={() => onAction(taskId, { kind: "status", value: "doing" })}
      >
        <PlayCircle className="h-3.5 w-3.5" />
        开始
      </Button>
    );
  }
  if (status === "doing") {
    return (
      <div className="flex shrink-0 gap-1">
        <Button
          size="sm"
          onClick={() => onAction(taskId, { kind: "status", value: "done" })}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          完成
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAction(taskId, { kind: "status", value: "blocked" })}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          阻塞
        </Button>
        <Button
          size="sm"
          variant="outline"
          title="暂停并退回待办"
          onClick={() => onAction(taskId, { kind: "status", value: "todo" })}
        >
          <PauseCircle className="h-3.5 w-3.5" />
          暂停
        </Button>
      </div>
    );
  }
  if (status === "blocked") {
    return (
      <Button
        size="sm"
        onClick={() => onAction(taskId, { kind: "status", value: "todo" })}
      >
        <CircleDot className="h-3.5 w-3.5" />
        解除阻塞
      </Button>
    );
  }
  return null;
}
