"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectActionsMenu } from "@/components/project-actions-menu";
import { StarProjectButton } from "@/components/star-project-button";
import { apiFetch } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type { ProjectCategoryDTO, ProjectDTO } from "@/lib/types";

export interface ProjectGridItem {
  project: ProjectDTO;
  total: number;
  done: number;
  doing: number;
  blocked: number;
}

interface ProjectGridProps {
  items: ProjectGridItem[];
  isAdmin: boolean;
  /** 启用拖拽排序（仅 admin 生效，归档区调用方应传 false） */
  sortable?: boolean;
  /** 整体淡化（归档区使用） */
  dimmed?: boolean;
  /** 分类列表，会传给编辑对话框做"移动到分类" */
  categories?: ProjectCategoryDTO[];
  /**
   * 拖拽作用域：
   *  - "default"（默认）：分类内顺序，写 Project.sortIndex
   *  - "starred"：顶部「重点项目区」内顺序，写 Project.starSortIndex
   */
  scope?: "default" | "starred";
}

/**
 * 项目网格。admin + sortable 时启用拖拽排序（用 dnd-kit 的 rectSortingStrategy
 * 适配 grid 布局），其余情况退化为普通展示。
 *
 * 拖拽只挂在左上角的「拖拽手柄」上，整张卡片仍然可点击跳转项目详情。
 */
export function ProjectGrid({
  items,
  isAdmin,
  sortable,
  dimmed,
  categories,
  scope = "default",
}: ProjectGridProps) {
  const router = useRouter();
  const [list, setList] = useState(items);

  // 父组件 router.refresh() 后会重新传入 items，同步到本地状态。
  useEffect(() => {
    setList(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedId = String(active.id);
    const targetId = String(over.id);

    const oldIdx = list.findIndex((s) => s.project.id === draggedId);
    const newIdx = list.findIndex((s) => s.project.id === targetId);
    if (oldIdx === -1 || newIdx === -1) return;

    const position: "before" | "after" = oldIdx < newIdx ? "after" : "before";

    // 乐观更新：先在本地把卡片挪到目标位置
    const next = [...list];
    const [moved] = next.splice(oldIdx, 1);
    const insertAt = position === "after"
      ? next.findIndex((s) => s.project.id === targetId) + 1
      : next.findIndex((s) => s.project.id === targetId);
    next.splice(insertAt, 0, moved);
    setList(next);

    try {
      await apiFetch<{
        project: ProjectDTO;
        rebalanced: boolean;
      }>("/api/projects/reorder", {
        method: "POST",
        body: JSON.stringify({ draggedId, targetId, position, scope }),
      });
      // 一律 refresh：Next.js 14 的 router cache 默认缓存 RSC payload，
      // 不刷新的话切走再切回来会看到拖动前的旧顺序。
      // 顺带也覆盖了 rebalance 后整组 sortIndex 变化的情况。
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(
        msg === "FORBIDDEN" ? "只有管理员可以调整项目顺序" : `排序失败：${msg}`,
      );
      setList(list);
    }
  }

  function handleItemUpdated(updated: ProjectDTO) {
    setList((prev) =>
      prev.map((s) => (s.project.id === updated.id ? { ...s, project: updated } : s)),
    );
    router.refresh();
  }

  function handleItemDeleted(id: string) {
    setList((prev) => prev.filter((s) => s.project.id !== id));
    router.refresh();
  }

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        这里空空如也
      </div>
    );
  }

  const useDnd = isAdmin && !!sortable;

  const grid = (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {list.map((item) =>
        useDnd ? (
          <SortableProjectCard
            key={item.project.id}
            item={item}
            isAdmin={isAdmin}
            dimmed={dimmed}
            draggable
            categories={categories}
            onUpdated={handleItemUpdated}
            onDeleted={handleItemDeleted}
          />
        ) : (
          <SortableProjectCard
            key={item.project.id}
            item={item}
            isAdmin={isAdmin}
            dimmed={dimmed}
            draggable={false}
            categories={categories}
            onUpdated={handleItemUpdated}
            onDeleted={handleItemDeleted}
          />
        ),
      )}
    </div>
  );

  if (!useDnd) return grid;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={list.map((s) => s.project.id)}
        strategy={rectSortingStrategy}
      >
        {grid}
      </SortableContext>
    </DndContext>
  );
}

interface CardProps {
  item: ProjectGridItem;
  isAdmin: boolean;
  dimmed?: boolean;
  draggable: boolean;
  categories?: ProjectCategoryDTO[];
  onUpdated: (project: ProjectDTO) => void;
  onDeleted: (id: string) => void;
}

function SortableProjectCard({
  item,
  isAdmin,
  dimmed,
  draggable,
  categories,
  onUpdated,
  onDeleted,
}: CardProps) {
  // 不可拖时不调用 useSortable，避免在 SortableContext 之外报错。
  if (!draggable) {
    return (
      <ProjectCardShell
        item={item}
        isAdmin={isAdmin}
        dimmed={dimmed}
        draggable={false}
        categories={categories}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
    );
  }

  return (
    <DraggableProjectCard
      item={item}
      isAdmin={isAdmin}
      dimmed={dimmed}
      categories={categories}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
    />
  );
}

function DraggableProjectCard({
  item,
  isAdmin,
  dimmed,
  categories,
  onUpdated,
  onDeleted,
}: Omit<CardProps, "draggable">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.project.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ProjectCardShell
        item={item}
        isAdmin={isAdmin}
        dimmed={dimmed}
        draggable
        categories={categories}
        dragHandle={
          <button
            type="button"
            aria-label="拖动调整顺序"
            className={cn(
              "absolute left-1 top-1 inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing",
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
    </div>
  );
}

function ProjectCardShell({
  item,
  isAdmin,
  dimmed,
  draggable,
  dragHandle,
  categories,
  onUpdated,
  onDeleted,
}: CardProps & { dragHandle?: React.ReactNode }) {
  const { project, total, done, doing, blocked } = item;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="group relative">
      <Link href={`/project/${project.id}`}>
        <Card
          className={cn(
            "h-full transition-colors hover:border-foreground/30",
            dimmed && "opacity-70",
            // 给左侧拖拽手柄让出一点位置
            draggable && "pl-3",
          )}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 pr-16 text-base">
              <span className="truncate">{project.name}</span>
              {project.isDefault && (
                <Badge
                  variant="muted"
                  className="ml-1 font-normal"
                  title="默认项目：用来收纳零散小任务，不可删除 / 归档"
                >
                  默认
                </Badge>
              )}
              {project.archived && (
                <Badge variant="muted" className="ml-1 font-normal">
                  已归档
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                完成 {done}/{total} · 进行 {doing}
              </span>
              {blocked > 0 && (
                <Badge variant="warn" className="font-normal">
                  阻塞 ×{blocked}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
      {dragHandle}
      <div className="absolute right-2 top-2 flex items-center gap-0.5">
        <StarProjectButton
          project={project}
          isAdmin={isAdmin}
          onUpdated={onUpdated}
        />
        {isAdmin && (
          <ProjectActionsMenu
            project={project}
            taskCount={total}
            categories={categories}
            onUpdated={onUpdated}
            onDeleted={() => onDeleted(project.id)}
          />
        )}
      </div>
    </div>
  );
}
