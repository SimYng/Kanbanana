"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryActionsMenu } from "@/components/category-actions-menu";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { ProjectGrid, type ProjectGridItem } from "@/components/project-grid";
import type { ProjectCategoryDTO } from "@/lib/types";

interface CategorySectionProps {
  category: ProjectCategoryDTO;
  items: ProjectGridItem[];
  isAdmin: boolean;
  /** 完整分类列表，用于卡片右上角「编辑项目」时切换分类 */
  categories: ProjectCategoryDTO[];
}

/**
 * 单个项目分类的一段：左侧色点 + 分类名 + 项目数；
 * 右侧 admin 可见「新建项目（预选此分类）」+ 分类操作菜单（编辑 / 删除）。
 *
 * 拖拽作用域 = 同分类内：每个分类有独立的 ProjectGrid 实例，
 * 跨分类移动请走"编辑项目"对话框，避免视觉与数据脱节。
 */
export function CategorySection({
  category,
  items,
  isAdmin,
  categories,
}: CategorySectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight">
          {category.name}
        </h2>
        {category.isDefault && (
          <Badge
            variant="muted"
            className="font-normal"
            title="默认分类：未指定分类的项目都会落到这里，不可删除"
          >
            默认
          </Badge>
        )}
        <Badge variant="muted" className="font-normal">
          {items.length}
        </Badge>
        {isAdmin && (
          <div className="ml-auto flex items-center gap-1">
            <NewProjectDialog
              variant="outline"
              categories={categories}
              defaultCategoryId={category.id}
              triggerNode={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-xs"
                  aria-label={`在分类「${category.name}」下新建项目`}
                  title={`在分类「${category.name}」下新建项目`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  项目
                </Button>
              }
            />
            <CategoryActionsMenu
              category={category}
              projectCount={items.length}
            />
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
          该分类下还没有项目
          {isAdmin ? "，点上方「+ 项目」开始添加" : ""}
        </div>
      ) : (
        <ProjectGrid
          items={items}
          isAdmin={isAdmin}
          sortable
          categories={categories}
        />
      )}
    </section>
  );
}
