import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { errorJson, handleError, okJson } from "@/lib/api";
import { serializeTask, TASK_INCLUDE } from "@/lib/serializers";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";

const UpdateInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
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
    if (data.dueDate !== undefined) {
      updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    // completedAt 完全由后端基于 status 切换维护，前端不可显式传入。
    // - 非 done → done：写入当前时间，同时取消今日聚焦
    // - done → 非 done：清空，避免历史残留误导"今日完成"统计
    // - 其它情况（status 未变、或同为非 done）：不动 completedAt
    if (data.status !== undefined) {
      const current = await prisma.task.findUnique({
        where: { id: params.id },
        select: { status: true },
      });
      if (!current) return errorJson("NOT_FOUND", 404);

      if (data.status === "done" && current.status !== "done") {
        updates.completedAt = new Date();
        updates.focusedToday = false;
      } else if (data.status !== "done" && current.status === "done") {
        updates.completedAt = null;
      }
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
