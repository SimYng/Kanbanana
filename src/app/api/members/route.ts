import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleError, okJson } from "@/lib/api";
import type { MemberDTO } from "@/lib/types";

export async function GET() {
  try {
    await requireUser();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true },
    });
    const out: MemberDTO[] = users.map((u) => ({
      ...u,
      role: u.role as MemberDTO["role"],
    }));
    return okJson(out);
  } catch (e) {
    return handleError(e);
  }
}
