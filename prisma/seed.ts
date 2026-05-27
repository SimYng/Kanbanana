import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const memberHash = await bcrypt.hash("123456", 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "管理员",
      passwordHash: adminHash,
      role: "admin",
    },
  });

  const memberDefs = [
    { email: "li@local", name: "小李" },
    { email: "wang@local", name: "小王" },
    { email: "zhang@local", name: "小张" },
    { email: "chen@local", name: "小陈" },
    { email: "liu@local", name: "小刘" },
    { email: "yang@local", name: "小杨" },
  ];

  const members: Record<string, string> = {};
  for (const m of memberDefs) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        email: m.email,
        name: m.name,
        passwordHash: memberHash,
        role: "member",
      },
    });
    members[m.email] = user.id;
  }

  // 默认分类（「未分类」）：固定 id 便于排查；不可删除，由 API 层保护。
  // 所有未指定分类的项目都会落到这里；删除其它分类时项目会被自动迁回。
  await prisma.projectCategory.upsert({
    where: { id: "default-category" },
    update: { isDefault: true },
    create: {
      id: "default-category",
      name: "未分类",
      isDefault: true,
      sortIndex: 0,
    },
  });

  // 默认项目（「收集箱」）：固定 id 便于排查；不可删除 / 归档，由 API 层保护。
  // sortIndex 设为 0 让它排在列表最前面，方便随手添加零散任务。
  // update 里不重置 name —— 用户在 UI 改过名（如「日常」「Inbox」）不应被 seed 覆盖。
  await prisma.project.upsert({
    where: { id: "default-misc" },
    update: { isDefault: true },
    create: {
      id: "default-misc",
      name: "收集箱",
      isDefault: true,
      sortIndex: 0,
      categoryId: "default-category",
    },
  });

  const projectDefs = ["官网改版", "移动端 App", "数据看板", "内部 CRM"];

  const PROJECT_STEP = 1024;
  const projects: Record<string, string> = {};
  for (let i = 0; i < projectDefs.length; i++) {
    const name = projectDefs[i];
    const existing = await prisma.project.findFirst({ where: { name } });
    const project =
      existing ??
      (await prisma.project.create({
        data: {
          name,
          sortIndex: (i + 1) * PROJECT_STEP,
          categoryId: "default-category",
        },
      }));
    projects[name] = project.id;
  }

  const taskCount = await prisma.task.count();
  if (taskCount > 0) {
    console.log(`已存在 ${taskCount} 个任务，跳过示例任务插入。`);
    return;
  }

  type TaskSeed = {
    title: string;
    project: string;
    assignee: string;
    status: "todo" | "doing" | "blocked" | "done";
    focusedToday?: boolean;
    blockedReason?: string;
    yuque?: string[];
  };

  const tasks: TaskSeed[] = [
    { title: "首页 Hero 区交互重构", project: "官网改版", assignee: "li@local", status: "doing", focusedToday: true, yuque: ["https://www.yuque.com/example/web/hero-redesign"] },
    { title: "登录页埋点接入", project: "官网改版", assignee: "li@local", status: "todo", focusedToday: true },
    { title: "PWA 离线缓存策略评估", project: "移动端 App", assignee: "li@local", status: "todo", yuque: ["https://www.yuque.com/example/app/pwa-cache"] },
    { title: "等待设计稿确认 - 个人中心改版", project: "移动端 App", assignee: "li@local", status: "blocked", blockedReason: "设计稿待小陈出图" },
    { title: "Q1 项目复盘文档归档", project: "官网改版", assignee: "li@local", status: "done" },

    { title: "支付下单接口联调", project: "移动端 App", assignee: "wang@local", status: "doing", focusedToday: true },
    { title: "数据看板权限模型设计", project: "数据看板", assignee: "wang@local", status: "todo" },
    { title: "CRM 客户字段迁移", project: "内部 CRM", assignee: "wang@local", status: "todo" },

    { title: "个人中心视觉设计", project: "移动端 App", assignee: "chen@local", status: "doing", focusedToday: true },
    { title: "官网新视觉规范输出", project: "官网改版", assignee: "chen@local", status: "todo" },

    { title: "数据看板可视化组件选型", project: "数据看板", assignee: "zhang@local", status: "doing", focusedToday: true },
    { title: "ETL 任务调度上线", project: "数据看板", assignee: "zhang@local", status: "todo" },
    { title: "等待运维开通数仓权限", project: "数据看板", assignee: "zhang@local", status: "blocked", blockedReason: "运维工单 #2031 处理中" },

    { title: "CRM 列表性能优化", project: "内部 CRM", assignee: "liu@local", status: "doing", focusedToday: true },
    { title: "App 推送服务接入", project: "移动端 App", assignee: "liu@local", status: "todo" },

    { title: "测试用例梳理 - 支付链路", project: "移动端 App", assignee: "yang@local", status: "doing", focusedToday: true },
    { title: "回归测试 - 官网改版", project: "官网改版", assignee: "yang@local", status: "todo" },
  ];

  const STEP = 1024;
  const assigneeCursor: Record<string, number> = {};

  for (const t of tasks) {
    const assigneeId = members[t.assignee];
    assigneeCursor[assigneeId] = (assigneeCursor[assigneeId] ?? 0) + STEP;
    const task = await prisma.task.create({
      data: {
        title: t.title,
        projectId: projects[t.project],
        assigneeId,
        creatorId: admin.id,
        status: t.status,
        sortIndex: assigneeCursor[assigneeId],
        focusedToday: t.focusedToday ?? false,
        blockedReason: t.blockedReason,
        completedAt: t.status === "done" ? new Date() : null,
      },
    });

    if (t.yuque?.length) {
      await prisma.yuqueLink.createMany({
        data: t.yuque.map((url) => ({ taskId: task.id, url })),
      });
    }
  }

  console.log("Seed 完成。");
  console.log(`管理员账号: ${adminEmail} / ${adminPassword}`);
  console.log("成员账号 (密码 123456): li/wang/zhang/chen/liu/yang @local");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
