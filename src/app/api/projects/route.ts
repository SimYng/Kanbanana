import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/session";
import { handleError, okJson } from "@/lib/api";
import { appendSortIndex } from "@/lib/sort-index";
import { serializeProject } from "@/lib/serializers";
import type { ProjectDTO } from "@/lib/types";

const CreateInput = z.object({
  name: z.string().min(1).max(100),
  /** 所属分类 id；未传则归入默认分类（「未分类」）。 */
  categoryId: z.string().min(1).optional(),
});

export async function GET() {
  try {
    await requireUser();
    const projects = await prisma.project.findMany({
      orderBy: [{ archived: "asc" }, { sortIndex: "asc" }, { createdAt: "asc" }],
    });
    const out: ProjectDTO[] = projects.map(serializeProject);
    return okJson(out);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const data = CreateInput.parse(await req.json());

    // 未传 categoryId 时落到默认分类（「未分类」）；如果默认分类被人为破坏则报错
    let categoryId = data.categoryId;
    if (!categoryId) {
      const fallback = await prisma.projectCategory.findFirst({
        where: { isDefault: true },
        select: { id: true },
      });
      if (!fallback) {
        return okJson({ error: "DEFAULT_CATEGORY_MISSING" }, { status: 500 });
      }
      categoryId = fallback.id;
    }

    // 新项目挂到「活跃项目」队尾。归档项目不参与拖拽，不会被影响。
    const activeSiblings = await prisma.project.findMany({
      where: { archived: false },
      select: { id: true, sortIndex: true },
      orderBy: { sortIndex: "asc" },
    });

    const project = await prisma.project.create({
      data: {
        name: data.name,
        categoryId,
        sortIndex: appendSortIndex(activeSiblings),
      },
    });
    return okJson(serializeProject(project) satisfies ProjectDTO, {
      status: 201,
    });
  } catch (e) {
    return handleError(e);
  }
}
