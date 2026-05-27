import type { ComponentType, ReactNode } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 团队总览页面所有面板共用的卡片表头：
 *  - 粗体标题（深色）+ 弱化图标作为辅助
 *  - 底部边线分隔，避免与下方子项标题混淆
 *  - rightSlot 用来放 Badge / Select 等右对齐控件
 *
 * 注意：本文件无 "use client"，可被 server 和 client 组件复用。
 */
export function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  rightSlot,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}) {
  return (
    <CardHeader className="flex-row items-center justify-between space-y-0 border-b pb-3">
      <CardTitle className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 self-center text-muted-foreground" />
        {title}
        {subtitle && (
          <span className="text-[11px] font-normal text-muted-foreground/70">
            · {subtitle}
          </span>
        )}
      </CardTitle>
      {rightSlot}
    </CardHeader>
  );
}
