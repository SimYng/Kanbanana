"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { TaskDTO } from "@/lib/types";

export interface SortableTaskListProps {
  tasks: TaskDTO[];
  /** 拖拽完成后回调：draggedId, targetId, position("before" | "after") */
  onReorder: (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
  children: React.ReactNode;
}

/**
 * 通用拖拽容器。任务卡片用 BoardTaskCard 等 useSortable 子组件渲染。
 *
 * dnd-kit 的 onDragEnd 给的是 source/destination index。
 * 这里转换为 (draggedId, targetId, position) 以匹配后端 reorder API。
 */
export function SortableTaskList({
  tasks,
  onReorder,
  children,
}: SortableTaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedId = String(active.id);
    const targetId = String(over.id);

    const oldIdx = tasks.findIndex((t) => t.id === draggedId);
    const newIdx = tasks.findIndex((t) => t.id === targetId);
    if (oldIdx === -1 || newIdx === -1) return;

    const position: "before" | "after" = oldIdx < newIdx ? "after" : "before";
    onReorder(draggedId, targetId, position);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}
