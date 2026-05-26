import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleError, okJson } from "@/lib/api";
import { serializeTask, TASK_INCLUDE } from "@/lib/serializers";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

const UpdateInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES as [TaskPriority, ...TaskPriority[]]).optional(),
  status: z.enum(TASK_STATUSES as [TaskStatus, ...TaskStatus[]]).optional(),
  focusedToday: z.boolean().optional(),
  blockedReason: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireUser();
    const json = await req.json();
    const data = UpdateInput.parse(json);

    const updates: Record<string, unknown> = { ...data };
    if (data.status === "done") {
      updates.focusedToday = false;
    }
    if (data.dueDate !== undefined) {
      updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updates,
      include: TASK_INCLUDE,
    });
    return okJson(serializeTask(task));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireUser();
    await prisma.task.delete({ where: { id: params.id } });
    return okJson({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
