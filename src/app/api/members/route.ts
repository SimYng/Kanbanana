import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { errorJson, handleError, okJson } from "@/lib/api";
import type { MemberDTO, UserRole } from "@/lib/types";

// 邮箱校验放宽：兼容内网账号如 admin@local（不要求 .tld）
// 只要符合 a@b 形式即可，避免误伤
const emailLike = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[^\s@]+@[^\s@]+$/u, "INVALID_EMAIL");

const CreateInput = z.object({
  name: z.string().min(1).max(50),
  email: emailLike,
  password: z.string().min(6).max(100),
  role: z.enum(["admin", "member"] as [UserRole, ...UserRole[]]).default("member"),
});

export async function GET() {
  try {
    await requireUser();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true },
    });
    const out: MemberDTO[] = users.map((u) => ({
      ...u,
      role: u.role as UserRole,
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
    const email = data.email.trim().toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return errorJson("EMAIL_TAKEN", 409);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        passwordHash,
        role: data.role,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    return okJson<MemberDTO>(
      { ...user, role: user.role as UserRole },
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}
