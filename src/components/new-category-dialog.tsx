"use client";

import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
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
import {
  PROJECT_COLOR_HEX,
  PROJECT_COLORS,
  type ProjectCategoryDTO,
  type ProjectColor,
} from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const [color, setColor] = useState<ProjectColor>("gray");
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setColor("gray");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await apiFetch<ProjectCategoryDTO>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), color }),
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
