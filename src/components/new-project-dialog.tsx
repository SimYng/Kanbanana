"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewCategoryDialog } from "@/components/new-category-dialog";
import { apiFetch } from "@/lib/fetcher";
import {
  PROJECT_COLOR_HEX,
  PROJECT_COLORS,
  type ProjectCategoryDTO,
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
  /** 分类列表；不传时表单里不展示分类选择（创建时落到默认分类） */
  categories?: ProjectCategoryDTO[];
  /** 默认选中的分类 id（如在某分类的新建按钮里点开） */
  defaultCategoryId?: string;
  /** 是否在分类下拉旁显示"新建分类"快捷按钮，默认 true */
  allowCreateCategory?: boolean;
}

function pickInitialCategoryId(
  categories: ProjectCategoryDTO[] | undefined,
  preferred?: string,
): string {
  if (!categories || categories.length === 0) return "";
  if (preferred && categories.some((c) => c.id === preferred)) return preferred;
  // 优先选默认分类，其次第一个
  return (
    categories.find((c) => c.isDefault)?.id ?? categories[0]?.id ?? ""
  );
}

export function NewProjectDialog({
  variant = "default",
  onCreated,
  triggerNode,
  categories,
  defaultCategoryId,
  allowCreateCategory = true,
}: NewProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<ProjectColor>("blue");
  const [busy, setBusy] = useState(false);
  // 本地维护一份分类列表，便于在"快捷新建分类"后立即出现在下拉里
  const [localCategories, setLocalCategories] = useState<ProjectCategoryDTO[]>(
    categories ?? [],
  );
  const [categoryId, setCategoryId] = useState<string>(() =>
    pickInitialCategoryId(categories, defaultCategoryId),
  );
  const prevOpenRef = useRef(false);

  // 同步父组件传入的分类列表
  useEffect(() => {
    setLocalCategories(categories ?? []);
  }, [categories]);

  // 仅在 dialog "首次打开" 时重置表单，避免父组件 router.refresh() 引发的
  // props 更新把用户已选的分类冲掉。
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setName("");
      setColor("blue");
      setCategoryId(pickInitialCategoryId(categories, defaultCategoryId));
    }
    prevOpenRef.current = open;
  }, [open, categories, defaultCategoryId]);

  function reset() {
    setName("");
    setColor("blue");
    setCategoryId(pickInitialCategoryId(localCategories, defaultCategoryId));
  }

  function handleCategoryCreated(cat: ProjectCategoryDTO) {
    setLocalCategories((prev) =>
      prev.some((c) => c.id === cat.id) ? prev : [...prev, cat],
    );
    setCategoryId(cat.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const body: {
        name: string;
        color: ProjectColor;
        categoryId?: string;
      } = { name: name.trim(), color };
      if (categoryId) body.categoryId = categoryId;
      const created = await apiFetch<ProjectDTO>("/api/projects", {
        method: "POST",
        body: JSON.stringify(body),
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

          {localCategories.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="project-category">分类</Label>
              <div className="flex items-center gap-2">
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="project-category" className="flex-1">
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {localCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.isDefault ? "（默认）" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {allowCreateCategory && (
                  <NewCategoryDialog
                    onCreated={handleCategoryCreated}
                    triggerNode={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 w-9 shrink-0 px-0"
                        aria-label="新建分类"
                        title="新建分类"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
          )}

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
