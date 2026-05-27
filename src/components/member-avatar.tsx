import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  if (/^[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(-1);
  const parts = trimmed.split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export function MemberAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-7 w-7", className)}>
      {/*
        亮色「香蕉」主题下的头像配色思路：
         - 头像是 ~24px 的实心圆，里面还有深色字符，色块视觉权重远大于 1px 的进度条；
           直接用 bg-primary 会比同色进度条「看起来深得多」（被字符拉低平均亮度）
         - 改为 bg-primary/15 的极淡米黄 + 内描边 ring-primary/40 暗示主题色，
           字符用 foreground 深色保证可读 → 既保留香蕉感、又不喧宾夺主
         - 暗色主题低饱和背景里这套淡色头像几乎不可见，回到 muted 灰
      */}
      <AvatarFallback className="bg-primary/15 text-xs font-semibold text-foreground ring-1 ring-inset ring-primary/40 dark:bg-muted dark:font-medium dark:text-foreground dark:ring-0">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
