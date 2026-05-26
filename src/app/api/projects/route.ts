import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/session";
import { handleError, okJson } from "@/lib/api";
import { PROJECT_COLORS, type ProjectColor, type ProjectDTO } from "@/lib/types";

const CreateInput = z.object({
  name: z.string().min(1).max(100),
  color: z.enum(PROJECT_COLORS as [ProjectColor, ...ProjectColor[]]).default("blue"),
});

export async function GET() {
  try {
    await requireUser();
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "asc" },
    });
    const out: ProjectDTO[] = projects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color as ProjectColor,
      archived: p.archived,
    }));
    return okJson(out);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const data = CreateInput.parse(await req.json());
    const project = await prisma.project.create({ data });
    return okJson(
      {
        id: project.id,
        name: project.name,
        color: project.color as ProjectColor,
        archived: project.archived,
      } satisfies ProjectDTO,
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}
