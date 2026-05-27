import { redirect } from "next/navigation";

/**
 * /member 根入口：默认跳到「成员任务总览」。
 * 让顶部 nav 的「成员任务」按钮可以用 href="/member" 同时覆盖
 * /member、/member/overview、/member/unassigned、/member/[id] 的 active 判断。
 */
export default function MemberIndexPage() {
  redirect("/member/overview");
}
