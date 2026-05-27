"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { cn } from "@/lib/utils";
import type { MemberDTO } from "@/lib/types";

/**
 * 成员工作台 / 成员总览页公用的顶部切换栏。
 *
 * 行为：
 *  - 第一个 chip 永远是「总览」（/member/overview）
 *  - 其后是所有非 admin 成员的 chip
 *  - 当前页对应的 chip 高亮
 *  - 注册全局 ←/→ keydown 在序列里循环跳转
 *
 * 跳过键盘切换的场景：
 *  - 修饰键（Cmd/Ctrl/Alt/Shift）
 *  - 焦点在输入控件或 contenteditable 元素里
 *  - 父级显式传 disabled（如弹窗打开时）
 */
export const OVERVIEW_NAV_ID = "__overview__";

interface MemberSwitcherProps {
  /** `OVERVIEW_NAV_ID` 或某个 member.id */
  currentId: string;
  members: MemberDTO[];
  /** 弹窗打开等场景需要临时禁用键盘导航 */
  disabled?: boolean;
}

export function MemberSwitcher({
  currentId,
  members,
  disabled,
}: MemberSwitcherProps) {
  const router = useRouter();

  // admin 不参与排活/工作台浏览，所以不进切换序列
  const switchable = useMemo(
    () => members.filter((m) => m.role !== "admin"),
    [members],
  );

  const targets = useMemo(
    () => [
      { id: OVERVIEW_NAV_ID, href: "/member/overview" },
      ...switchable.map((m) => ({ id: m.id, href: `/member/${m.id}` })),
    ],
    [switchable],
  );

  useEffect(() => {
    if (disabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      const idx = targets.findIndex((t) => t.id === currentId);
      if (idx === -1 || targets.length < 2) return;

      const delta = e.key === "ArrowLeft" ? -1 : 1;
      const nextIdx = (idx + delta + targets.length) % targets.length;
      const next = targets[nextIdx];
      if (next && next.id !== currentId) {
        e.preventDefault();
        router.push(next.href);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [targets, currentId, disabled, router]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SwitcherChip
        href="/member/overview"
        active={currentId === OVERVIEW_NAV_ID}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        总览
      </SwitcherChip>
      <span className="text-muted-foreground/30">|</span>
      {switchable.map((m) => (
        <SwitcherChip
          key={m.id}
          href={`/member/${m.id}`}
          active={m.id === currentId}
        >
          <MemberAvatar name={m.name} className="h-4 w-4 text-[10px]" />
          {m.name}
        </SwitcherChip>
      ))}
      {targets.length > 1 && (
        <span className="ml-1 text-[10px] text-muted-foreground/60">
          ← / → 切换
        </span>
      )}
    </div>
  );
}

function SwitcherChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-foreground/40 bg-accent font-medium text-foreground"
          : "border-border/60 text-muted-foreground hover:border-foreground/25 hover:bg-accent/40 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
