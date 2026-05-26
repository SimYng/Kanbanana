import { PROJECT_COLOR_HEX, type ProjectColor } from "@/lib/types";

export function ProjectPill({
  name,
  color,
  size = "sm",
}: {
  name: string;
  color: ProjectColor;
  size?: "sm" | "xs";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        size === "xs" ? "text-[11px]" : "text-xs"
      } text-muted-foreground`}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: PROJECT_COLOR_HEX[color] }}
      />
      {name}
    </span>
  );
}
