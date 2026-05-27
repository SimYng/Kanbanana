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
  type ProjectColor,
  type ProjectDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface NewProjectDialogProps {
  variant?: "default" | "outline";
  /** 创建成功后回调（在 close 之前调用）。常用于让父级 select 直接选中新项目。 */
  onCreated?: (project: ProjectDTO) => void;
  /** 替换默认的 + 文案触发器；需是单个可作为 Radix DialogTrigger asChild 子节点的 ReactElement */
  triggerNode?: ReactElement;
}

export function NewProjectDialog({
  variant = "default",
  onCreated,
  triggerNode,
}: NewProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<ProjectColor>("blue");
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setColor("blue");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await apiFetch<ProjectDTO>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), color }),
      });
      onCreated?.(created);
      toast.success("项目已创建");
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FORBIDDEN") {
        toast.error("只有管理员可以创建项目");
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
            新建项目
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">项目名称</Label>
            <Input
              id="project-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：移动端 App"
              maxLength={100}
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
