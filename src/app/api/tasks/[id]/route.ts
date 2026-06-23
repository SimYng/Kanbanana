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

    // completedAt / canceledAt 完全由后端基于 status「切换」维护，前端不可显式传入。
    // 两者是互斥的终态时间戳：进入某终态写入 now，离开该终态清空。
    //  - 进入 done：写 completedAt = now（并取消今日聚焦）
    //  - 进入 canceled：写 canceledAt = now
    //  - 离开 done / canceled：清空对应字段（避免历史残留污染统计）
    //  - done ↔ canceled 互转时，两个分支会各自把对方清掉
    // 只在 status 真正变化时处理：避免对已 done 任务再 PATCH done 时刷新掉原完成时间。
    if (data.status !== undefined) {
      const current = await prisma.task.findUnique({
        where: { id: params.id },
        select: { status: true },
      });
      if (!current) return errorJson("NOT_FOUND", 404);

      if (data.status !== current.status) {
        if (data.status === "done") {
          updates.completedAt = new Date();
          updates.focusedToday = false;
        } else if (current.status === "done") {
          updates.completedAt = null;
        }

        if (data.status === "canceled") {
          updates.canceledAt = new Date();
        } else if (current.status === "canceled") {
          updates.canceledAt = null;
        }
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
