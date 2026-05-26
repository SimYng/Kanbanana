import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/member-avatar";
import { NewMemberDialog } from "@/components/new-member-dialog";
import { MemberActionsMenu } from "@/components/member-actions-menu";
import type { MemberDTO, UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/team");

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          tasksAssigned: { where: { status: { not: "done" } } },
          tasksCreated: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">成员管理</h1>
          <p className="text-sm text-muted-foreground">
            管理员可以新增、编辑、删除成员，以及重置密码。
          </p>
        </div>
        <NewMemberDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">成员</th>
                  <th className="px-4 py-3 font-medium">邮箱</th>
                  <th className="px-4 py-3 font-medium">角色</th>
                  <th className="px-4 py-3 text-right font-medium">未完成任务</th>
                  <th className="px-4 py-3 text-right font-medium">创建时间</th>
                  <th className="w-[1%] px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const member: MemberDTO = {
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role as UserRole,
                  };
                  const isMe = u.id === me.id;
                  return (
                    <tr key={u.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MemberAvatar name={u.name} className="h-7 w-7" />
                          <span className="font-medium">{u.name}</span>
                          {isMe && (
                            <span className="text-xs text-muted-foreground">（你）</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.role === "admin" ? (
                          <Badge
                            variant="outline"
                            className="border-primary/50 bg-primary/15"
                          >
                            管理员
                          </Badge>
                        ) : (
                          <Badge variant="muted" className="font-normal">
                            成员
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {u._count.tasksAssigned}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <MemberActionsMenu member={member} currentUserId={me.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        提示：删除成员后，名下未完成任务的负责人会被清空，需要重新分配。
        曾创建过任务的成员（通常是早期管理员）不能直接删除，
        如需删除请先把这些任务的创建人迁移走。
      </p>
    </div>
  );
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
