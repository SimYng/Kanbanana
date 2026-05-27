import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleError, okJson } from "@/lib/api";
import { serializeTask, TASK_INCLUDE } from "@/lib/serializers";
import { appendSortIndex } from "@/lib/sort-index";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";

const ListQuery = z.object({
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  status: z.enum(["todo", "doing", "blocked", "done"]).optional(),
});

const CreateInput = z.object({
  title: z.string().min(1, "标题不能为空").max(200),
  projectId: z.string().min(1),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(TASK_STATUSES as [TaskStatus, ...TaskStatus[]]).default("todo"),
  description: z.string().optional(),
  blockedReason: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  yuqueLinks: z.array(z.string().url()).optional(),
});

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const params = ListQuery.parse({
      assigneeId: searchParams.get("assigneeId") ?? undefined,
      projectId: searchParams.get("projectId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    // 约定：assigneeId="none" 表示「未分配负责人」（assigneeId IS NULL），
    //       供未分配池视图使用；其它字符串走精确匹配。
    const assigneeWhere = params.assigneeId
      ? params.assigneeId === "none"
        ? { assigneeId: null }
        : { assigneeId: params.assigneeId }
      : {};

    const tasks = await prisma.task.findMany({
      where: {
        ...assigneeWhere,
        ...(params.projectId ? { projectId: params.projectId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      include: TASK_INCLUDE,
      orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
    });

    return okJson(tasks.map(serializeTask));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const json = await req.json();
    const data = CreateInput.parse(json);

    const assigneeId = data.assigneeId ?? null;
    const siblings = assigneeId
      ? await prisma.task.findMany({
          where: { assigneeId },
          select: { id: true, sortIndex: true },
          orderBy: { sortIndex: "asc" },
        })
      : [];

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        assigneeId,
        creatorId: user.id,
        status: data.status,
        sortIndex: appendSortIndex(siblings),
        blockedReason: data.blockedReason,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        yuqueLinks: data.yuqueLinks?.length
          ? { create: data.yuqueLinks.map((url) => ({ url })) }
          : undefined,
      },
      include: TASK_INCLUDE,
    });

    return okJson(serializeTask(task), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
