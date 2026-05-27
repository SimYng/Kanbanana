import Link from "next/link";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/member-avatar";
import { PriorityBadge } from "@/components/priority-badge";
import { ProjectPill } from "@/components/project-pill";
import { TASK_INCLUDE, serializeTask } from "@/lib/serializers";
import { isTaskVisible, isToday } from "@/lib/utils";
import { PROJECT_COLOR_HEX, type ProjectColor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const [members, allTasks, projects] = await Promise.all([
    prisma.user.findMany({
      where: { role: "member" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      include: TASK_INCLUDE,
      orderBy: { sortIndex: "asc" },
    }),
    prisma.project.findMany({
      where: { archived: false },
      orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  // 已归档项目里的未完成任务视为「作废」，不计入工作量与阻塞统计；
  // 已完成任务（含归档项目里的）继续保留，作为历史业绩。
  const allTaskDtos = allTasks.map(serializeTask);
  const tasks = allTaskDtos.filter(isTaskVisible);

  const memberRows = members.map((m) => {
    const mine = tasks.filter((t) => t.assigneeId === m.id);
    const open = mine.filter((t) => t.status !== "done");
    const doneToday = mine.filter((t) => t.status === "done" && isToday(t.updatedAt)).length;
    return {
      member: m,
      doingCount: open.filter((t) => t.status === "doing").length,
      todoCount: open.filter((t) => t.status === "todo").length,
      blockedCount: open.filter((t) => t.status === "blocked").length,
      doneToday,
      total: open.length,
    };
  });

  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const doingTotal = memberRows.reduce((s, w) => s + w.doingCount, 0);
  const doneTodayTotal = memberRows.reduce((s, w) => s + w.doneToday, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">团队总览</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="团队成员" value={members.length} />
        <StatCard label="进行中总数" value={doingTotal} tone="info" />
        <StatCard
          label="阻塞任务"
          value={blockedTasks.length}
          tone={blockedTasks.length ? "warn" : undefined}
        />
        <StatCard
          label="今日已完成"
          value={doneTodayTotal}
          tone={doneTodayTotal > 0 ? "success" : undefined}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">成员手头工作量</h2>
        <div className="space-y-1.5">
          {memberRows.map((w) => {
            // 进度条按未完成任务的内部结构比例铺满，不再引入"建议容量"概念
            const denom = Math.max(w.total, 1);
            return (
              <Link
                key={w.member.id}
                href={`/member/${w.member.id}`}
                className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="cursor-pointer transition-colors group-hover:border-foreground/25 group-hover:bg-accent/30">
                  <CardContent className="space-y-1.5 p-3">
                    <div className="flex items-center gap-3">
                      <MemberAvatar name={w.member.name} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{w.member.name}</div>
                        <div className="text-xs text-muted-foreground">
                          进行 {w.doingCount} · 待办 {w.todoCount} · 阻塞 {w.blockedCount}
                          {w.doneToday > 0 && ` · 今日完成 ${w.doneToday}`}
                        </div>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-muted-foreground">
                        共 {w.total}
                      </span>
                      {w.blockedCount > 0 && (
                        <Badge variant="warn" className="font-normal">
                          阻塞 ×{w.blockedCount}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    {w.total > 0 && (
                      <div className="flex h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="bg-info transition-all"
                          style={{ width: `${(w.doingCount / denom) * 100}%` }}
                        />
                        <div
                          className="bg-muted-foreground/50 transition-all"
                          style={{ width: `${(w.todoCount / denom) * 100}%` }}
                        />
                        <div
                          className="bg-warn transition-all"
                          style={{ width: `${(w.blockedCount / denom) * 100}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {blockedTasks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warn" />
            <h2 className="text-lg font-semibold">团队阻塞看板</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            所有阻塞中的任务集中展示，方便每日晨会快速过一遍
          </p>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">任务</th>
                  <th className="px-3 py-2 font-medium">负责人</th>
                  <th className="px-3 py-2 font-medium">项目</th>
                  <th className="px-3 py-2 font-medium">优先级</th>
                  <th className="px-3 py-2 font-medium">阻塞原因</th>
                </tr>
              </thead>
              <tbody>
                {blockedTasks.map((t) => (
                  <tr key={t.id} className="border-t bg-warn/5">
                    <td className="px-3 py-2 font-medium">{t.title}</td>
                    <td className="px-3 py-2">{t.assignee?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <ProjectPill name={t.project.name} color={t.project.color} />
                    </td>
                    <td className="px-3 py-2">
                      <PriorityBadge priority={t.priority} short />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.blockedReason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">项目进度</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => {
            const pt = tasks.filter((t) => t.projectId === p.id);
            const doneCount = pt.filter((t) => t.status === "done").length;
            const blockedCount = pt.filter((t) => t.status === "blocked").length;
            const pct = pt.length === 0 ? 0 : Math.round((doneCount / pt.length) * 100);
            return (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <Link href={`/project/${p.id}`} className="flex items-center gap-2 hover:underline">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: PROJECT_COLOR_HEX[p.color as ProjectColor] }}
                      />
                      {p.name}
                    </Link>
                    <span className="text-xs font-normal text-muted-foreground">
                      {doneCount}/{pt.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: PROJECT_COLOR_HEX[p.color as ProjectColor],
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>完成度 {pct}%</span>
                    {blockedCount > 0 && (
                      <Badge variant="warn" className="font-normal">
                        阻塞 ×{blockedCount}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "info" | "warn" | "success" | "destructive";
}) {
  const toneClass =
    tone === "info"
      ? "text-info"
      : tone === "warn"
        ? "text-warn"
        : tone === "success"
          ? "text-success"
          : tone === "destructive"
            ? "text-destructive"
            : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
