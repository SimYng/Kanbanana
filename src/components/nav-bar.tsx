"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Users, FolderKanban, LayoutGrid, LogOut, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/team", label: "团队总览", icon: Users },
  // href 用 /member 让 active 前缀匹配覆盖 overview / unassigned / [id]；
  // 实际目标是 overview，由 src/app/(app)/member/page.tsx 重定向过去。
  { href: "/member", label: "成员任务", icon: LayoutGrid },
  { href: "/projects", label: "项目看板", icon: FolderKanban },
];

const adminTabs = [
  { href: "/members", label: "成员管理", icon: UserCog },
];

export function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const visibleTabs = isAdmin ? [...tabs, ...adminTabs] : tabs;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center gap-3 sm:gap-6">
        <Link href="/team" className="flex shrink-0 items-center gap-2">
          <Image
            src="/brand/logo-mark.png"
            alt="蕉办 Kanbanana"
            width={28}
            height={28}
            priority
          />
          {/* 小屏只留品牌图标，文字让位给导航 tab */}
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            蕉办
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              Kanbanana
            </span>
          </span>
        </Link>

        {/* 小屏：tab 只显示图标并可横滑兜底，避免一行挤爆；sm+ 显示文字 */}
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const active =
              pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                title={tab.label}
                aria-label={tab.label}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-3",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {session?.user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 gap-2 px-2">
                  <MemberAvatar name={session.user.name ?? "?"} className="h-6 w-6" />
                  <span className="hidden text-sm sm:inline">{session.user.name}</span>
                  {session.user.role === "admin" && (
                    <span className="rounded border border-primary/50 bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                      管理员
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{session.user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
