import { PROJECT_COLOR_HEX, type ProjectColor } from "@/lib/types";

export function ProjectPill({
  name,
  color,
  size = "sm",
  hideDot,
}: {
  name: string;
  color: ProjectColor;
  size?: "sm" | "xs";
  /** 在卡片上已经用左侧色条表达"任务状态色"时，隐藏项目色点避免与状态色视觉冲突 */
  hideDot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        size === "xs" ? "text-[11px]" : "text-xs"
      } text-muted-foreground`}
    >
      {!hideDot && (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: PROJECT_COLOR_HEX[color] }}
        />
      )}
      {name}
    </span>
  );
}
