"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BoardTaskCard } from "@/components/board-task-card";
import { cn } from "@/lib/utils";
import { STATUS_THEME } from "@/lib/status-theme";
import { STATUS_LABEL, type TaskDTO, type TaskStatus } from "@/lib/types";

const KANBAN_STATUSES: TaskStatus[] = ["doing", "todo", "blocked"];
const COLUMN_ID_PREFIX = "col:";
const columnId = (s: TaskStatus) => `${COLUMN_ID_PREFIX}${s}`;
const parseColumnId = (id: string): TaskStatus | null => {
  if (!id.startsWith(COLUMN_ID_PREFIX)) return null;
  const v = id.slice(COLUMN_ID_PREFIX.length) as TaskStatus;
  return KANBAN_STATUSES.includes(v) ? v : null;
};

export type ReorderRequest =
  | {
      draggedId: string;
      targetId: string;
      position: "before" | "after";
      targetStatus?: TaskStatus;
    }
  | { draggedId: string; targetStatus: TaskStatus };

interface MemberKanbanProps {
  /** 三列任务（doing + todo + blocked，已经按 assignee 过滤） */
  tasks: TaskDTO[];
  onOpen: (task: TaskDTO) => void;
  /** 提交拖拽结果，由父级调用后端 reorder API */
  onReorderRequest: (req: ReorderRequest) => Promise<void> | void;
  /** 卡片右侧 action 按钮 hover 时触发 */
  onAction?: (
    taskId: string,
    action: { kind: "status"; value: TaskStatus },
  ) => void;
}

/**
 * 成员工作台的三列 Kanban：进行中 / 待办 / 阻塞中。
 *
 * 设计要点：
 *  - 单一 DndContext 包整组列，每列一个 SortableContext + 一个 droppable
 *    （空列也能成为拖拽放置目标）。
 *  - onDragOver 实时把被拖卡片 status 调整为目标列状态，实现"跨列预览"。
 *  - onDragEnd 时根据被拖卡片在新列中的相对位置，调用 onReorderRequest 提交：
 *      - 拖到具体 task 上 → targetId + position(+targetStatus if 跨列)
 *      - 拖到空列上 → 仅 targetStatus，服务端把任务放到该列底部
 *  - 用 DragOverlay 渲染被拖卡片，避免多容器场景下原列保留占位导致的视觉抖动。
 */
export function MemberKanban({
  tasks,
  onOpen,
  onReorderRequest,
  onAction,
}: MemberKanbanProps) {
  const [localTasks, setLocalTasks] = useState<TaskDTO[]>(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 父级 tasks 变化（commit / 远端刷新）时同步本地副本
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const columns = useMemo(() => {
    return KANBAN_STATUSES.map((status) => ({
      status,
      tasks: localTasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.sortIndex - b.sortIndex),
    }));
  }, [localTasks]);

  const activeTask = activeId
    ? localTasks.find((t) => t.id === activeId) ?? null
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findContainer(id: string): TaskStatus | null {
    const colMaybe = parseColumnId(id);
    if (colMaybe) return colMaybe;
    return localTasks.find((t) => t.id === id)?.status ?? null;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    const fromCol = findContainer(activeIdStr);
    const toCol = findContainer(overIdStr);
    if (!fromCol || !toCol) return;
    if (fromCol === toCol) return;

    // 跨列：把 activeTask 的 status 临时改成目标列，触发重新渲染到新列
    setLocalTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === activeIdStr);
      if (idx === -1) return prev;
      if (prev[idx].status === toCol) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], status: toCol };
      return next;
    });
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);

    if (!over) {
      // 取消拖动：从父级 tasks 完整 reset
      setLocalTasks(tasks);
      return;
    }

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const originalTask = tasks.find((t) => t.id === activeIdStr);
    const currentTask = localTasks.find((t) => t.id === activeIdStr);
    if (!originalTask || !currentTask) {
      setLocalTasks(tasks);
      return;
    }

    const targetCol = findContainer(overIdStr);
    if (!targetCol) {
      setLocalTasks(tasks);
      return;
    }

    const droppedOnColumn = parseColumnId(overIdStr) !== null;
    const movedToOtherColumn = originalTask.status !== targetCol;

    // 拖到空列 / 列容器：仅切状态
    if (droppedOnColumn) {
      if (movedToOtherColumn) {
        try {
          await onReorderRequest({
            draggedId: activeIdStr,
            targetStatus: targetCol,
          });
        } catch {
          setLocalTasks(tasks);
        }
      } else {
        // 拖回原列容器（没具体 target）→ 不做任何改动
        setLocalTasks(tasks);
      }
      return;
    }

    // 拖到具体 task 上：用 targetId + position
    const targetTask = localTasks.find((t) => t.id === overIdStr);
    if (!targetTask) {
      setLocalTasks(tasks);
      return;
    }

    // 同列且位置未变 → 无操作（避免无效请求）
    const columnTasks = localTasks
      .filter((t) => t.status === targetCol)
      .sort((a, b) => a.sortIndex - b.sortIndex);
    const draggedIdxInCol = columnTasks.findIndex((t) => t.id === activeIdStr);
    const targetIdxInCol = columnTasks.findIndex((t) => t.id === overIdStr);

    // 同列同位置：忽略
    if (!movedToOtherColumn && draggedIdxInCol === targetIdxInCol) {
      return;
    }

    const position: "before" | "after" =
      draggedIdxInCol === -1
        ? "before"
        : draggedIdxInCol < targetIdxInCol
          ? "after"
          : "before";

    try {
      await onReorderRequest({
        draggedId: activeIdStr,
        targetId: overIdStr,
        position,
        ...(movedToOtherColumn ? { targetStatus: targetCol } : {}),
      });
    } catch {
      setLocalTasks(tasks);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setLocalTasks(tasks);
      }}
    >
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-3">
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            tasks={col.tasks}
            isActiveColumn={
              activeTask !== null && activeTask.status === col.status
            }
            onOpen={onOpen}
            onAction={onAction}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="w-72 max-w-full">
            <BoardTaskCard
              task={activeTask}
              hideAssignee
              showProject
              showStatusBar
              onOpen={undefined}
              onAction={undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  tasks,
  isActiveColumn,
  onOpen,
  onAction,
}: {
  status: TaskStatus;
  tasks: TaskDTO[];
  isActiveColumn: boolean;
  onOpen: (task: TaskDTO) => void;
  onAction?: (
    taskId: string,
    action: { kind: "status"; value: TaskStatus },
  ) => void;
}) {
  const theme = STATUS_THEME[status];
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-0 flex-col border-t-4 transition-shadow",
        theme.top,
        isOver && !isActiveColumn && cn("ring-2", theme.ring),
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            theme.title,
          )}
        >
          <span className={cn("inline-block h-2 w-2 rounded-full", theme.dot)} />
          {STATUS_LABEL[status]}
        </CardTitle>
        <Badge variant="muted" className="font-normal tabular-nums">
          {tasks.length}
        </Badge>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-0">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <div className="rounded border border-dashed py-6 text-center text-xs text-muted-foreground">
              拖到这里
            </div>
          ) : (
            tasks.map((t) => (
              <BoardTaskCard
                key={t.id}
                task={t}
                hideAssignee
                showProject
                onOpen={onOpen}
                onAction={onAction}
              />
            ))
          )}
        </SortableContext>
      </CardContent>
    </Card>
  );
}
