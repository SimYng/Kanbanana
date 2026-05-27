"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
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
import { apiFetch } from "@/lib/fetcher";
import {
  PROJECT_COLOR_HEX,
  PROJECT_COLORS,
  type ProjectCategoryDTO,
  type ProjectColor,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface EditCategoryDialogProps {
  category: ProjectCategoryDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (category: ProjectCategoryDTO) => void;
}

export function EditCategoryDialog({
  category,
  open,
  onOpenChange,
  onSaved,
}: EditCategoryDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<ProjectColor>("gray");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && category) {
      setName(category.name);
      setColor(category.color);
    }
  }, [open, category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !name.trim()) return;
    setBusy(true);
    try {
      const updated = await apiFetch<ProjectCategoryDTO>(
        `/api/categories/${category.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim(), color }),
        },
      );
      onSaved?.(updated);
      toast.success("分类已更新");
      onOpenChange(false);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FORBIDDEN") {
        toast.error("只有管理员可以编辑分类");
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
          <DialogTitle>编辑分类</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-category-name">分类名称</Label>
            <Input
              id="edit-category-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className="grid gap-2">
            <Label>颜色</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`选择 ${c} 颜色`}
                  onClick={() => setColor(c)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full ring-offset-background transition-all",
                    color === c
                      ? "ring-2 ring-foreground ring-offset-2"
                      : "ring-1 ring-border hover:ring-foreground/40",
                  )}
                  style={{ background: PROJECT_COLOR_HEX[c] }}
                >
                  {color === c && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

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
