import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { errorJson, handleError, okJson } from "@/lib/api";
import { PROJECT_COLORS, type ProjectColor, type ProjectDTO } from "@/lib/types";

const UpdateInput = z
  .object({
    name: z.string().min(1).max(100).optional(),
    color: z.enum(PROJECT_COLORS as [ProjectColor, ...ProjectColor[]]).optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.color !== undefined || v.archived !== undefined,
    { message: "EMPTY_UPDATE" },
  );

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
    const data = UpdateInput.parse(await req.json());
    const project = await prisma.project.update({
      where: { id: params.id },
      data,
    });
    return okJson<ProjectDTO>({
      id: project.id,
      name: project.name,
      color: project.color as ProjectColor,
      archived: project.archived,
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
    // 校验项目存在；任务删除由 schema 的 onDelete: Cascade 处理
    const exists = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!exists) return errorJson("NOT_FOUND", 404);
    await prisma.project.delete({ where: { id: params.id } });
    return okJson({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
