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
      <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
