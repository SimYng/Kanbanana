/**
 * 项目名称的小标签（任务卡上"所属项目"的显示）。
 *
 * 视觉策略：纯文本 + muted 颜色；不再绑定项目色。
 * 历史上接受 `color` / `hideDot` props，已废弃但保留签名，
 * 以避免对调用点造成大面积破坏 —— 这两个参数在新实现里不再使用。
 */
import type { ProjectColor } from "@/lib/types";

export function ProjectPill({
  name,
  size = "sm",
}: {
  name: string;
  /** @deprecated 已不再使用，保留以兼容旧调用 */
  color?: ProjectColor;
  size?: "sm" | "xs";
  /** @deprecated 已不再使用，保留以兼容旧调用 */
  hideDot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center ${
        size === "xs" ? "text-[11px]" : "text-xs"
      } text-muted-foreground`}
    >
      {name}
    </span>
  );
}
