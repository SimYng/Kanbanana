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
  Star,
  StarOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/priority-badge";
import { ProjectPill } from "@/components/project-pill";
import { cn } from "@/lib/utils";
import type { TaskDTO, TaskStatus } from "@/lib/types";

type Action =
  | { kind: "status"; value: TaskStatus }
  | { kind: "focus"; value: boolean };

interface TaskCardProps {
  task: TaskDTO;
  onAction?: (taskId: string, action: Action) => void;
  onOpen?: (task: TaskDTO) => void;
  /** 显示在右上角的截止时间标签 */
  dueLabel?: string;
  className?: string;
}

export function TaskCard({
  task,
  onAction,
  onOpen,
  dueLabel,
  className,
}: TaskCardProps) {
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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group transition-shadow",
        isDragging && "opacity-40 ring-2 ring-primary",
        className,
      )}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
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
            className="flex-1 text-left text-sm font-medium leading-snug hover:underline"
          >
            {task.title}
          </button>
          {dueLabel && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {dueLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pl-7">
          <ProjectPill name={task.project.name} color={task.project.color} />
          {task.assignee && (
            <span className="text-xs text-muted-foreground">
              负责人 · {task.assignee.name}
            </span>
          )}
          {task.yuqueLinks.length > 0 && (
            <a
              href={task.yuqueLinks[0].url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-info hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              语雀文档 × {task.yuqueLinks.length}
            </a>
          )}
          {task.status === "blocked" && task.blockedReason && (
            <span className="inline-flex items-center gap-1 text-xs text-warn">
              <AlertTriangle className="h-3 w-3" />
              {task.blockedReason}
            </span>
          )}
        </div>

        {onAction && (
          <div className="flex flex-wrap gap-1 pl-7">
            {task.status === "todo" && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onAction(task.id, { kind: "status", value: "doing" })}
              >
                <PlayCircle className="h-3.5 w-3.5" /> 开始
              </Button>
            )}
            {task.status === "doing" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onAction(task.id, { kind: "status", value: "done" })}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> 完成
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onAction(task.id, { kind: "status", value: "blocked" })
                  }
                >
                  <PauseCircle className="h-3.5 w-3.5" /> 标记阻塞
                </Button>
              </>
            )}
            {task.status === "blocked" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(task.id, { kind: "status", value: "todo" })}
              >
                <CircleDot className="h-3.5 w-3.5" /> 解除阻塞
              </Button>
            )}
            {task.status !== "done" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  onAction(task.id, { kind: "focus", value: !task.focusedToday })
                }
              >
                {task.focusedToday ? (
                  <>
                    <StarOff className="h-3.5 w-3.5" /> 移出今日
                  </>
                ) : (
                  <>
                    <Star className="h-3.5 w-3.5" /> 加入今日聚焦
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
