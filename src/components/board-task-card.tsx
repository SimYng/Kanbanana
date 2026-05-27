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
import { ProjectPill } from "@/components/project-pill";
import { cn, formatDueLabel } from "@/lib/utils";
import type { TaskDTO, TaskStatus } from "@/lib/types";

const DUE_TONE_CLASS = {
  danger: "text-destructive",
  warn: "text-warn",
  muted: "text-muted-foreground",
} as const;

/**
 * 卡片左侧的"任务状态色条"。
 *
 * 在没有"列本身就有颜色"语义的场景（例如成员工作台 Kanban、成员总览），
 * 通过这条 2-3px 的左色条把任务状态色作为视觉主角，
 * 避免与项目色点抢戏（这种场景下项目色点也会通过 hideDot 隐藏）。
 */
const STATUS_BORDER: Record<TaskStatus, string> = {
  todo: "border-l-muted-foreground/40",
  doing: "border-l-info",
  blocked: "border-l-warn",
  done: "border-l-success/60",
};

type Action = { kind: "status"; value: TaskStatus };

interface BoardTaskCardProps {
  task: TaskDTO;
  onOpen?: (task: TaskDTO) => void;
  /** 传入则在卡片 hover 时露出紧凑的状态切换按钮组 */
  onAction?: (taskId: string, action: Action) => void;
  /** 工作台等"已知负责人"场景，省掉负责人名以减少冗余 */
  hideAssignee?: boolean;
  /** 工作台等"跨项目"场景，显示项目（默认放到第二行 meta，隐藏项目色点） */
  showProject?: boolean;
  /** 卡片左侧加状态色条。配合 showProject 用于"列本身没有状态颜色"的场景 */
  showStatusBar?: boolean;
  /** 禁用列内拖动排序：useSortable disabled + 隐藏 drag handle。
   *  用于"已完成"等按 completedAt 展示的只读列，仍可作为跨列拖入的目标。 */
  nonSortable?: boolean;
}

/**
 * 看板列里的小卡片：精简版任务卡。
 *
 * 布局心智：
 *  - 第一行：drag · P2 · 负责人 · 标题（占满剩余）· 截止时间
 *  - 第二行（meta）：项目（如 showProject）· 文档 · 阻塞原因 · hover 状态切换按钮
 *  - 所有元素 `items-center` 垂直居中对齐，避免 badge 与文本高度不一致
 *
 * 项目色 vs 状态色：showStatusBar 模式下左边色条 = 任务状态色，
 * 项目仅以纯文字呈现（hideDot），避免与状态色互相干扰。
 */
export function BoardTaskCard({
  task,
  onOpen,
  onAction,
  hideAssignee,
  showProject,
  showStatusBar,
  nonSortable,
}: BoardTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: nonSortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const due = task.status === "done" ? null : formatDueLabel(task.dueDate);
  const hasYuque = task.yuqueLinks.length > 0;
  const hasBlockedReason = task.status === "blocked" && !!task.blockedReason;
  const hasMetaRow =
    !!showProject || hasYuque || hasBlockedReason || !!onAction;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        // hover 效果用 shadow + 轻微抬起，避免 `hover:border-*` 覆盖
        // 左侧 border-l 的状态色条（会让卡片在 hover 时被误以为变成"待办"灰）
        "group cursor-pointer transition-all hover:-translate-y-px hover:shadow-md hover:ring-1 hover:ring-foreground/10",
        showStatusBar && cn("border-l-[3px]", STATUS_BORDER[task.status]),
        isDragging && "opacity-40 ring-2 ring-primary",
      )}
      onClick={() => onOpen?.(task)}
    >
      <CardContent className="space-y-1 p-2.5">
        <div className="flex items-center gap-1.5">
          {!nonSortable && (
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
          )}
          <PriorityBadge priority={task.priority} short />
          {!hideAssignee && task.assignee && (
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
            {showProject && (
              <span className="min-w-0 truncate">
                <ProjectPill name={task.project.name} size="xs" />
              </span>
            )}
            {hasYuque && <span className="shrink-0">文档 ×{task.yuqueLinks.length}</span>}
            {hasBlockedReason && (
              <span className="inline-flex min-w-0 items-center gap-1 truncate text-warn">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="truncate">{task.blockedReason}</span>
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
