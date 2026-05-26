import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { errorJson, handleError, okJson } from "@/lib/api";
import type { MemberDTO, UserRole } from "@/lib/types";

const UpdateInput = z
  .object({
    name: z.string().min(1).max(50).optional(),
    role: z.enum(["admin", "member"] as [UserRole, ...UserRole[]]).optional(),
    password: z.string().min(6).max(100).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.role !== undefined || v.password !== undefined,
    { message: "EMPTY_UPDATE" },
  );

async function isLastAdmin(userId: string) {
  const admins = await prisma.user.count({ where: { role: "admin" } });
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return admins <= 1 && target?.role === "admin";
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireUser();
    const data = UpdateInput.parse(await req.json());

    // 权限：admin 可改任何人；普通成员只能改自己，且不能改 role
    if (me.role !== "admin") {
      if (me.id !== params.id) return errorJson("FORBIDDEN", 403);
      if (data.role !== undefined) return errorJson("FORBIDDEN", 403);
    }

    // 保护：拒绝把最后一个 admin 降级为 member
    if (data.role === "member" && (await isLastAdmin(params.id))) {
      return errorJson("LAST_ADMIN", 409);
    }

    const patch: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.role !== undefined) patch.role = data.role;
    if (data.password !== undefined) {
      patch.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: patch,
      select: { id: true, name: true, email: true, role: true },
    });
    return okJson<MemberDTO>({ ...user, role: user.role as UserRole });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireAdmin();
    if (me.id === params.id) return errorJson("CANNOT_DELETE_SELF", 409);
    if (await isLastAdmin(params.id)) return errorJson("LAST_ADMIN", 409);

    try {
      await prisma.user.delete({ where: { id: params.id } });
    } catch (e) {
      // Task.creator onDelete: Restrict —— 该用户创建过任务时无法删除
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2003"
      ) {
        return errorJson("HAS_AUTHORED_TASKS", 409);
      }
      throw e;
    }
    return okJson({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
