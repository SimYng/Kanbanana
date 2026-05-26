# AGENTS.md

给在此仓库工作的 AI 编码助手（含 Cursor / Codex / Claude Code 等）的工作指南。本文档侧重「agent 视角的约定与坑」，用户向的安装/部署/技术栈介绍参见 [README.md](README.md)。

---

## 1. 项目快照

**蕉办 Kanbanana**（包名 `kanbanana`，仓库历史早期叫 `stack-board`/StackBoard，已于 0.2.0 改名）。给 ≤ 10 人小团队的轻量项目管理工具。**单体 Next.js 14 App Router 应用**，前后端在同一仓库，Prisma + SQLite 落库，Docker Compose 一键部署。

核心三视图：**团队总览（/team）→ 成员工作台（/member/[id]）→ 项目看板（/project/[id]）**。

### 品牌约定
- 中文主名：**蕉办**（谐音「交办」，对应"把任务交给人"）
- 英文名：**Kanbanana**（Kanban + Banana）
- 社区梗 / 表情包：**别催了，蕉办**
- 产品 slogan：**任务别乱飞，先上蕉办**
- **代码层一律英文** —— 包名 / 类名 / API 路径 / 字段名都用 `kanbanana` 或英文术语，**不要在标识符里塞中文**
- **UI 文案分级** —— 核心动作 / 空状态 / Toast 可以适度玩梗（蕉了 / 待蕉 / 蕉一个）；错误提示 / 权限提示 / 表单字段保持严肃

### 品牌资源位置
- Next.js 自动注入图标：`src/app/{icon,apple-icon,opengraph-image}.png`
- 应用内 UI 用 logo：`public/brand/logo-mark.png`（256）+ `logo-mark@2x.png`（512）
- 仓库展示用：`docs/brand/banner.png`
- 重新生成所有尺寸：`powershell -ExecutionPolicy Bypass -File scripts\process-logo.ps1`

## 2. 常用命令（Windows 友好）

| 用途 | 命令 |
|---|---|
| 安装依赖 | `pnpm install` |
| 初始化 / 推进迁移 | `pnpm prisma migrate dev` |
| 写入种子数据 | `pnpm prisma:seed` |
| 启动 dev | `pnpm dev` |
| 类型检查 | `pnpm tsc --noEmit` |
| Docker 一键部署 | `docker compose up -d` |

**Shell 注意**：开发机是 Windows PowerShell。PowerShell 不支持 bash 的 `&&` 和 heredoc：
- 顺序执行命令用 `;` 分隔
- 长 commit message 写到临时文件后 `git commit -F <file>`

## 3. 代码地图（按改动频率排序）

```
src/app/(app)/
  team/page.tsx                    团队总览（server component）
  member/[id]/page.tsx + workbench.tsx   成员工作台（server + client）
  project/[id]/page.tsx + board.tsx      项目看板（server + client）
  projects/page.tsx                项目列表（含归档分区）

src/app/api/
  tasks/route.ts                   GET 列表 / POST 创建
  tasks/[id]/route.ts              PATCH / DELETE
  tasks/reorder/route.ts           拖拽排序专用端点
  projects/route.ts                GET / POST
  projects/[id]/route.ts           PATCH / DELETE（admin）
  members/route.ts                 GET
  auth/[...nextauth]/route.ts      NextAuth

src/components/
  ui/*                             shadcn 风格基础组件（不要从头改样式，改 variant）
  task-card.tsx                    成员工作台任务卡（hideAssignee/hideProject 控制冗余）
  board-task-card.tsx              项目看板小卡（保留 assignee 显示）
  sortable-task-list.tsx           dnd-kit 容器
  *-dialog.tsx                     各业务弹窗
  confirm-dialog.tsx               通用危险操作确认弹窗（删除场景复用）
  project-actions-menu.tsx        ⋯ 菜单（编辑/归档/删除）
  theme-toggle.tsx                 next-themes 切换

src/lib/
  db.ts                            Prisma client 单例（防 dev HMR 多实例）
  auth.ts + session.ts             NextAuth + requireUser/requireAdmin
  api.ts                           okJson/errorJson/handleError
  fetcher.ts                       客户端 fetch 包装（throw Error(error_code)）
  serializers.ts                   Prisma → DTO 转换 + TASK_INCLUDE
  sort-index.ts                    拖拽排序算法（核心）
  types.ts                         所有 enum/常量/DTO 接口
```

## 4. 核心设计决策（带「为什么」）

### 状态驱动的成员工作台（**没有「今日聚焦」**）
工作台按 `status` 分四区：进行中 / 待办 / 阻塞中 / 已完成。「今日聚焦」概念已废弃，但 `Task.focusedToday` 字段仍保留以兼容旧迁移和未来可能的需求——**不要再在 UI 引用它**。

### sortIndex 浮点中点插入
拖拽只更新被移动卡片的 `sortIndex = (prev + next) / 2`，作用域 = `assigneeId`。约 50 次连续插入后精度告警，触发 `rebalance` 事务重排该作用域全部任务。算法见 `src/lib/sort-index.ts`。

### 优先级与执行顺序双轨制
- `priority` (P0–P3)：客观重要性
- `sortIndex`：个人执行顺序
两者互补不冗余。P0 排到队尾恰好暴露「在等什么」。**不要合并这两个概念**。

### 项目归档 ≠ 删除
- **归档**：UI 折叠到底部，新建任务时项目下拉过滤掉，但**现有任务仍正常显示**，可继续推进。一键可逆。
- **删除**：物理删除，schema 的 `Task.project onDelete: Cascade` 会级联删除任务，需二次确认并明示"将删除 N 个任务"。
- 删除当前正在浏览的项目要 `router.push("/projects")` 避免 404。

### 阻塞必须带原因
点击「阻塞」按钮**不直接**改 status，先弹 `BlockReasonDialog` 收集 `blockedReason`，提交时一并 PATCH。切到非 blocked 状态时**主动清空 blockedReason**，避免残留旧文案。参见 `workbench.tsx` 的 `handleAction`。

### 权限分级
- 通过 `requireAdmin()` / `requireUser()` 守卫 API（`src/lib/session.ts`）
- 前端通过 server component 拉 `getCurrentUser()` 传 `isAdmin` prop 到 client component
- 目前 admin 限制：项目 CRUD、成员 CRUD、`/members` 页面访问
- 未来扩展到任务编辑权限时遵循同样模式

### 成员管理的硬约束
所有写操作都要尊重以下不变量（API 层强制，不依赖前端）：
- **不能删除自己** —— 防止误删导致无人能登录
- **必须保留至少一个 admin** —— 删除最后一个 admin / 把最后一个 admin 降级，均拒绝（`isLastAdmin()` 助手）
- **task creator 不能删** —— schema 是 `Task.creator onDelete: Restrict`，Prisma 抛 `P2003` 时翻译为 `HAS_AUTHORED_TASKS`，前端引导用户先迁移任务
- **task assignee 删了 OK** —— schema 是 `onDelete: SetNull`，任务保留，负责人变空待重新分配
- **权限分级语义**：admin 可改任何人；普通用户可改自己的 name/password，**不能改自己的 role**（防止自我提权）
- 错误码统一使用 `EMAIL_TAKEN` / `LAST_ADMIN` / `CANNOT_DELETE_SELF` / `HAS_AUTHORED_TASKS` / `FORBIDDEN`，前端按 code 翻译为友好中文

### 任务卡片布局两段式
第一行：拖拽手柄 + 优先级 + 标题（`flex-1 min-w-0 truncate`）+ 操作按钮组（`shrink-0`）
第二行：项目 + 负责人 + 文档 + 阻塞原因（元信息行）
按需通过 `hideAssignee` / `hideProject` 隐藏冗余字段。

## 5. 反模式（已经踩过的坑，请勿重蹈）

| 坑 | 表现 | 正确做法 |
|---|---|---|
| **SQLite path 相对解析** | `DATABASE_URL=file:./prisma/dev.db` 在 Prisma 里相对 `schema.prisma` 解析，会生成 `prisma/prisma/dev.db` | `.env` 用 `file:./dev.db`，Docker 用绝对路径 `file:/app/data/kanbanana.db` |
| **pnpm 不跑 Prisma postinstall** | 缺少生成的 Prisma Client | `package.json` 的 `pnpm.onlyBuiltDependencies` 显式 allow `@prisma/client` 和 `prisma` |
| **Windows + Next standalone EPERM** | 本地 `pnpm build` 因符号链接失败 | `next.config.mjs` 里 `output` 设为 `process.env.NEXT_BUILD_STANDALONE === "1" ? "standalone" : undefined`，仅 Docker 构建时启用 |
| **解除阻塞后阻塞原因残留** | 阻塞状态切走后 `blockedReason` 还在数据库 | `handleAction` 切到非 blocked 时一律 `payload.blockedReason = null` |
| **Link 包卡片 + 内嵌菜单按钮冒泡** | 点菜单同时触发卡片导航 | 菜单组件**放在 Link 外面**用 `absolute` 定位到卡片角落，并加 `stopPropagation` 双保险 |
| **Dialog 里 description 渲染块级元素** | DialogDescription 默认是 `<p>`，里面塞 `<div>` 会触发 hydration 警告 | 用 phrasing content（span/br），或 `asChild` 把 wrapper 换成 div |
| **dnd-kit 拖拽手柄常驻** | 视觉噪音大 | 用 `group-hover:opacity-100` + `opacity-0` 让手柄 hover 才出现 |

## 6. 添加新功能的步骤模板

### 加一个新 API 端点
1. `src/app/api/<resource>/route.ts` 或 `[id]/route.ts`
2. 用 `zod` 定义 input schema
3. `requireUser()` 或 `requireAdmin()`
4. 错误用 `handleError(e)` 包装 → 统一返回 `{ error: "CODE" }`
5. 客户端用 `apiFetch<T>(path, init)`，错误信息会以 `Error(code)` 抛出
6. 在 `src/lib/types.ts` 加 DTO 类型，在 `src/lib/serializers.ts` 加序列化

### 加一个新 Dialog
1. 复制 `confirm-dialog.tsx` / `block-reason-dialog.tsx` 结构（受控 `open` + `onOpenChange`）
2. 表单用 `<form onSubmit>` + `disabled={busy || !valid}` 防双提交
3. 错误用 `toast.error(...)`，成功用 `toast.success(...)`
4. 涉及危险操作（删除）必用 `ConfirmDialog` + `danger` 态

### 加一个新状态字段到 Task
1. `prisma/schema.prisma` 加字段
2. `pnpm prisma migrate dev --name <descriptive-name>`
3. `src/lib/types.ts` 更新 `TaskDTO`
4. `src/lib/serializers.ts` 更新 `serializeTask`
5. `src/app/api/tasks/[id]/route.ts` 的 `UpdateInput` zod schema 加上
6. 各 UI 组件按需展示

## 7. Schema 当前状态

数据模型见 `prisma/schema.prisma`。**遗留兼容字段**：
- `Task.focusedToday`：UI 层已不再使用，保留是为了向后兼容老数据。删除前需评估迁移成本。
- 切到 PostgreSQL 时去掉 Float 精度依赖问题（见 README 切库指引）。

级联关系：
- `Task.project onDelete: Cascade` —— 删项目会带走所有任务
- `Task.assignee onDelete: SetNull` —— 删用户保留任务（assignee 置空）
- `Task.creator onDelete: Restrict` —— 不允许删有创建过任务的用户
- `YuqueLink.task onDelete: Cascade` —— 跟任务一起走

## 8. UI 风格约定

- 主题用 `next-themes`，组件用 CSS variable（`bg-background` / `text-foreground` / `border-input` 等），**不要硬编码 hex 颜色**（项目色 `PROJECT_COLOR_HEX` 例外，作为业务数据维度）
- 按钮主操作 `variant="default"`，次操作 `variant="outline"`，破坏性 `variant="destructive"`，**避免 `ghost` 混用**导致风格不一
- 状态标识用左侧 `1px` 色条（参考 `task-card.tsx`），优先级用 `PriorityBadge` 短形态
- 中文文案用全角标点，但**操作按钮文案尽量短**（2–4 字优先）

## 9. Git / Commit 风格

- 提交信息中文，遵循 conventional commits（`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`）
- 单个 commit 聚焦一个意图，跨文件耦合的重构允许合并
- **不要主动 push**，除非用户明确要求
- **不要主动 commit**，除非用户明确要求；用户说「拆分 commit」时按功能粒度切，切不动就一起 commit 并说明原因
- Windows PowerShell 写多行 commit message：写临时文件 → `git commit -F .commit-msg.tmp` → 删临时文件

## 10. 文档维护责任

更新代码时**同步检查并更新**以下文件：
- `README.md`：用户向变更（部署、命令、新功能介绍、品牌资源说明）
- `AGENTS.md`（本文件）：架构决策、踩坑记录、约定变化

不要把 AGENTS.md 当成 changelog 来写，**只记录会指导未来工作的内容**。
