"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { apiFetch } from "@/lib/fetcher";
import type { ProjectDTO } from "@/lib/types";

interface ProjectActionsMenuProps {
  project: ProjectDTO;
  /** 项目当前任务数，用于删除确认提示 */
  taskCount?: number;
  /** 触发按钮风格 */
  buttonVariant?: "ghost" | "outline";
  /** 触发按钮尺寸 */
  buttonSize?: "icon" | "sm";
  /** 编辑或归档完成后通知父组件 */
  onUpdated?: (project: ProjectDTO) => void;
  /** 删除完成后通知父组件；不传则默认 router.refresh() */
  onDeleted?: (id: string) => void;
  /** 删除完成后跳转到指定路径；默认不跳转 */
  redirectAfterDelete?: string;
}

export function ProjectActionsMenu({
  project,
  taskCount,
  buttonVariant = "ghost",
  buttonSize = "icon",
  onUpdated,
  onDeleted,
  redirectAfterDelete,
}: ProjectActionsMenuProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleArchiveToggle() {
    try {
      const updated = await apiFetch<ProjectDTO>(
        `/api/projects/${project.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ archived: !project.archived }),
        },
      );
      onUpdated?.(updated);
      toast.success(updated.archived ? "已归档" : "已恢复");
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FORBIDDEN") {
        toast.error("只有管理员可以归档项目");
      } else {
        toast.error(`操作失败：${msg}`);
      }
    }
  }

  async function handleDelete() {
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: "DELETE" });
      toast.success("项目已删除");
      onDeleted?.(project.id);
      if (redirectAfterDelete) {
        router.push(redirectAfterDelete);
      } else {
        router.refresh();
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FORBIDDEN") {
        toast.error("只有管理员可以删除项目");
      } else {
        toast.error(`删除失败：${msg}`);
        throw e;
      }
    }
  }

  function stop(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={buttonVariant}
            size={buttonSize}
            onClick={stop}
            aria-label="项目操作"
            className={buttonSize === "icon" ? "h-8 w-8" : undefined}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleArchiveToggle();
            }}
          >
            {project.archived ? (
              <>
                <ArchiveRestore className="h-4 w-4" />
                取消归档
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                归档
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProjectDialog
        project={editOpen ? project : null}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={(p) => {
          onUpdated?.(p);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        danger
        title={`删除项目「${project.name}」？`}
        description={
          taskCount && taskCount > 0 ? (
            <>
              此操作不可撤销。该项目下的
              <span className="mx-1 font-semibold text-destructive">{taskCount}</span>
              个任务也会一并删除。
              <br />
              如只是暂时不再添加新任务，建议改为"归档"。
            </>
          ) : (
            "此操作不可撤销。"
          )
        }
        confirmLabel="删除"
        onConfirm={handleDelete}
      />
    </>
  );
}
