"use client";

import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/fetcher";
import type { ProjectCategoryDTO } from "@/lib/types";

interface NewCategoryDialogProps {
  variant?: "default" | "outline";
  /** 创建成功后回调（在 close 之前调用）。 */
  onCreated?: (category: ProjectCategoryDTO) => void;
  /** 替换默认触发器；需是单个可作为 Radix DialogTrigger asChild 子节点的 ReactElement */
  triggerNode?: ReactElement;
}

export function NewCategoryDialog({
  variant = "outline",
  onCreated,
  triggerNode,
}: NewCategoryDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await apiFetch<ProjectCategoryDTO>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      onCreated?.(created);
      toast.success("分类已创建");
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FORBIDDEN") {
        toast.error("只有管理员可以创建分类");
      } else {
        toast.error(`创建失败：${msg}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {triggerNode ?? (
          <Button size="sm" variant={variant}>
            <Plus className="h-4 w-4" />
            新建分类
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建分类</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="category-name">分类名称</Label>
            <Input
              id="category-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：业务系统 / 内部工具 / AI 探索"
              maxLength={60}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
