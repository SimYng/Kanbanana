import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { errorJson, handleError, okJson } from "@/lib/api";
import type { ProjectCategoryDTO } from "@/lib/types";

const UpdateInput = z.object({
  name: z.string().min(1).max(60),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
    const data = UpdateInput.parse(await req.json());

    const exists = await prisma.projectCategory.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!exists) return errorJson("NOT_FOUND", 404);

    const cat = await prisma.projectCategory.update({
      where: { id: params.id },
      data,
    });
    return okJson<ProjectCategoryDTO>({
      id: cat.id,
      name: cat.name,
      isDefault: cat.isDefault,
      sortIndex: cat.sortIndex,
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
    const current = await prisma.projectCategory.findUnique({
      where: { id: params.id },
      select: { id: true, isDefault: true },
    });
    if (!current) return errorJson("NOT_FOUND", 404);
    // 默认分类（「未分类」）禁止删除：保证始终有一个兜底归宿。
    if (current.isDefault) {
      return errorJson("DEFAULT_CATEGORY_NOT_DELETABLE", 400);
    }

    const fallback = await prisma.projectCategory.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (!fallback) {
      // 极端情况：默认分类被人为破坏。报错让用户先修复，不静默丢数据。
      return errorJson("DEFAULT_CATEGORY_MISSING", 500);
    }

    // 把该分类下所有项目迁移到默认分类，再删分类（事务保证原子）。
    await prisma.$transaction([
      prisma.project.updateMany({
        where: { categoryId: params.id },
        data: { categoryId: fallback.id },
      }),
      prisma.projectCategory.delete({ where: { id: params.id } }),
    ]);
    return okJson({ ok: true, movedTo: fallback.id });
  } catch (e) {
    return handleError(e);
  }
}
