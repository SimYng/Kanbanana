"use client";

import { useState, type MouseEvent } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type { ProjectDTO } from "@/lib/types";

interface StarProjectButtonProps {
  project: ProjectDTO;
  isAdmin: boolean;
  onUpdated?: (project: ProjectDTO) => void;
  className?: string;
}

/**
 * 项目「加星 / 取消加星」按钮：
 *  - starred=true（project.starSortIndex !== null）：实心黄星，所有人可见（用作视觉指示）
 *  - starred=false：空心淡灰星，仅 admin 可见（鼠标 hover 卡片才浮现，避免噪点）
 *  - 仅 admin 可点击 toggle，非 admin 看到的是只读图标
 *
 * 已归档项目允许加星吗？产品上没限制——你可以把已完成的项目继续置顶查看；
 * 后端 PATCH 也没加禁止。但 /projects 页面的「重点项目区」会过滤掉 archived，
 * 这是 UI 层决定的展示策略，不是数据层约束。
 */
export function StarProjectButton({
  project,
  isAdmin,
  onUpdated,
  className,
}: StarProjectButtonProps) {
  const starred = project.starSortIndex !== null;
  const [busy, setBusy] = useState(false);

  // 非 admin + 未加星 → 完全不渲染，避免增加视觉噪点
  if (!isAdmin && !starred) return null;

  async function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAdmin || busy) return;
    setBusy(true);
    try {
      const updated = await apiFetch<ProjectDTO>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ starred: !starred }),
      });
      onUpdated?.(updated);
      toast.success(starred ? "已取消重点" : "已标为重点", {
        description: updated.name,
        duration: 3000,
      });
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(
        msg === "FORBIDDEN" ? "只有管理员可以标记重点项目" : `操作失败：${msg}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isAdmin || busy}
      aria-label={starred ? "取消重点标记" : "标为重点项目"}
      title={
        isAdmin
          ? starred
            ? "重点项目（点击取消）"
            : "标为重点项目"
          : "重点项目"
      }
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all",
        starred
          ? "text-primary"
          : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        isAdmin ? "hover:bg-muted hover:text-primary" : "cursor-default",
        className,
      )}
    >
      <Star
        className={cn("h-4 w-4", starred && "fill-primary")}
        strokeWidth={starred ? 1.5 : 2}
      />
    </button>
  );
}
