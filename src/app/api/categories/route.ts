import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/session";
import { handleError, okJson } from "@/lib/api";
import { appendSortIndex } from "@/lib/sort-index";
import {
  PROJECT_COLORS,
  type ProjectCategoryDTO,
  type ProjectColor,
} from "@/lib/types";

const CreateInput = z.object({
  name: z.string().min(1).max(60),
  color: z
    .enum(PROJECT_COLORS as [ProjectColor, ...ProjectColor[]])
    .default("gray"),
});

function toDTO(c: {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  sortIndex: number;
}): ProjectCategoryDTO {
  return {
    id: c.id,
    name: c.name,
    color: c.color as ProjectColor,
    isDefault: c.isDefault,
    sortIndex: c.sortIndex,
  };
}

export async function GET() {
  try {
    await requireUser();
    const cats = await prisma.projectCategory.findMany({
      orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
    });
    return okJson(cats.map(toDTO));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const data = CreateInput.parse(await req.json());

    // 新分类挂到列表末尾；与项目 / 任务 sortIndex 共用 lib/sort-index 算法
    const siblings = await prisma.projectCategory.findMany({
      select: { id: true, sortIndex: true },
      orderBy: { sortIndex: "asc" },
    });

    const cat = await prisma.projectCategory.create({
      data: { ...data, sortIndex: appendSortIndex(siblings) },
    });
    return okJson(toDTO(cat), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
