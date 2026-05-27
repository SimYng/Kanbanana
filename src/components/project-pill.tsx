/**
 * 项目名称的小标签（任务卡上"所属项目"的显示）。
 *
 * 纯文本 + muted 颜色：项目不再带视觉色，全靠文字识别。
 */
export function ProjectPill({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "xs";
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
