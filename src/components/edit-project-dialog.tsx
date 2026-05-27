"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/fetcher";
import type {
  ProjectCategoryDTO,
  ProjectDTO,
} from "@/lib/types";

interface EditProjectDialogProps {
  project: ProjectDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (project: ProjectDTO) => void;
  /** 分类列表；不传时表单里不展示分类选择 */
  categories?: ProjectCategoryDTO[];
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSaved,
  categories,
}: EditProjectDialogProps) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setCategoryId(project.categoryId);
    }
  }, [open, project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !name.trim()) return;
    setBusy(true);
    try {
      const body: { name: string; categoryId?: string } = {
        name: name.trim(),
      };
      if (categories && categoryId && categoryId !== project.categoryId) {
        body.categoryId = categoryId;
      }
      const updated = await apiFetch<ProjectDTO>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onSaved?.(updated);
      toast.success("项目已更新");
      onOpenChange(false);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FORBIDDEN") {
        toast.error("只有管理员可以编辑项目");
      } else {
        toast.error(`保存失败：${msg}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑项目</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-project-name">项目名称</Label>
            <Input
              id="edit-project-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          {categories && categories.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="edit-project-category">分类</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="edit-project-category">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.isDefault ? "（默认）" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              取消
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
