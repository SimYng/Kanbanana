import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./db";
import type { UserRole } from "./types";

function unauthorized() {
  const err: Error & { status?: number } = new Error("UNAUTHORIZED");
  err.status = 401;
  return err;
}

/**
 * 浅层读取 session 里的 user。**不校验 user 是否还在数据库**。
 * 用于服务端组件做 redirect 等无副作用的场景，便宜（不查 DB）。
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/**
 * 守卫 API：除了检查 session 存在，还会去数据库里验证 user.id 是否真实存在，
 * 同时把 name / role 替换为数据库最新值。
 *
 * 这样能避免两类隐患：
 *  1. 数据库被重 seed 后旧 JWT 仍写入不存在的 creatorId，触发 P2003
 *  2. admin 被降级 / 改名后还能用旧 session 操作敏感接口
 */
export async function requireUser() {
  const sessionUser = await getCurrentUser();
  const id = (sessionUser as { id?: string } | null)?.id;
  if (!id) throw unauthorized();

  const dbUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!dbUser) throw unauthorized();

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role as UserRole,
  };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    const err: Error & { status?: number } = new Error("FORBIDDEN");
    err.status = 403;
    throw err;
  }
  return user;
}
