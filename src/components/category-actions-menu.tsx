"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { EditCategoryDialog } from "@/components/edit-category-dialog";
import { apiFetch } from "@/lib/fetcher";
import type { ProjectCategoryDTO } from "@/lib/types";

interface CategoryActionsMenuProps {
  category: ProjectCategoryDTO;
  /** 当前分类下的项目数，删除前要提示会自动迁回默认分类 */
  projectCount?: number;
  onUpdated?: (category: ProjectCategoryDTO) => void;
  onDeleted?: (id: string) => void;
}

export function CategoryActionsMenu({
  category,
  projectCount = 0,
  onUpdated,
  onDeleted,
}: CategoryActionsMenuProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    try {
      await apiFetch(`/api/categories/${category.id}`, { method: "DELETE" });
      toast.success(
        projectCount > 0
          ? `分类已删除，${projectCount} 个项目已迁回「未分类」`
          : "分类已删除",
      );
      onDeleted?.(category.id);
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FORBIDDEN") {
        toast.error("只有管理员可以删除分类");
      } else if (msg === "DEFAULT_CATEGORY_NOT_DELETABLE") {
        toast.error("默认分类（未分类）不可删除");
      } else {
        toast.error(`删除失败：${msg}`);
        throw e;
      }
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="分类操作"
            className="h-7 w-7"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            编辑
          </DropdownMenuItem>
          {/* 默认分类（「未分类」）不展示删除入口 —— 它是兜底归宿，必须始终存在 */}
          {!category.isDefault && (
            <>
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCategoryDialog
        category={editOpen ? category : null}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={(c) => {
          onUpdated?.(c);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        danger
        title={`删除分类「${category.name}」？`}
        description={
          projectCount > 0 ? (
            <>
              该分类下还有
              <span className="mx-1 font-semibold">{projectCount}</span>
              个项目，删除后会自动迁回「未分类」分类。
              <br />
              此操作不会删除任何项目或任务。
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
