import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABEL, type TaskPriority } from "@/lib/types";

export function PriorityBadge({
  priority,
  short = false,
}: {
  priority: TaskPriority;
  short?: boolean;
}) {
  const variant =
    priority === "P0" ? "destructive" : priority === "P1" ? "warn" : "muted";
  return (
    <Badge variant={variant} className="font-mono">
      {short ? priority : PRIORITY_LABEL[priority]}
    </Badge>
  );
}
