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
      <div className="container flex h-14 items-center gap-6">
        <Link href="/team" className="flex items-center gap-2">
          <Image
            src="/brand/logo-mark.png"
            alt="蕉办 Kanbanana"
            width={28}
            height={28}
            priority
          />
          <span className="text-base font-semibold tracking-tight">
            蕉办
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              Kanbanana
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {visibleTabs.map((tab) => {
            const active =
              pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {session?.user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 gap-2 px-2">
                  <MemberAvatar name={session.user.name ?? "?"} className="h-6 w-6" />
                  <span className="text-sm">{session.user.name}</span>
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
