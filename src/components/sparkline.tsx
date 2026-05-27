import { cn } from "@/lib/utils";

interface SparklineProps {
  /** 时间序列数值，长度 ≥ 2 才会渲染（少于 2 个点画不出趋势） */
  data: number[];
  width?: number;
  height?: number;
  /** 描边颜色用 currentColor，由父级 className 的 text-* 决定 */
  className?: string;
  /** 填充透明度（描边下方阴影），0 = 不填充 */
  fillOpacity?: number;
  strokeWidth?: number;
}

/**
 * 极简 sparkline：纯 SVG，零依赖。
 * - 用 currentColor 上色，方便配合 text-info / text-success 等主题色
 * - 数据全相等时画一条水平线（避免除 0）
 * - 仅展示形状不显示坐标轴 / 数值（团队总览那种小屏「趋势提示」用法）
 */
export function Sparkline({
  data,
  width = 84,
  height = 24,
  className,
  fillOpacity = 0.15,
  strokeWidth = 1.5,
}: SparklineProps) {
  // 过滤掉 NaN（插值序列在两侧没真实点时可能出现）；少于 2 个有效点不画
  const valid = data.filter((v) => Number.isFinite(v));
  if (valid.length < 2) {
    return <div style={{ width, height }} aria-hidden />;
  }

  const max = Math.max(...valid);
  const min = Math.min(...valid);
  const range = max - min || 1;
  const dx = width / (data.length - 1);

  // NaN 位置直接跳过；剩余点连成折线。x 仍按"原始位置"分布，
  // 这样曲线在缺数据段会自然产生一个跨段直线，比断开更直观
  const points: Array<readonly [number, number]> = [];
  data.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const x = i * dx;
    const y =
      max === min ? height / 2 : height - ((v - min) / range) * (height - 2) - 1;
    points.push([x, y] as const);
  });
  const polyline = points
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const firstX = points[0][0];
  const lastX = points[points.length - 1][0];
  const area = `M${firstX},${height} L${polyline} L${lastX},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="趋势"
    >
      {fillOpacity > 0 && (
        <path d={area} fill="currentColor" opacity={fillOpacity} />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
