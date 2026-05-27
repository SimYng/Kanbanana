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
拖拽只更新被移动卡片的 `sortIndex = (prev + next) / 2`。约 50 次连续插入后精度告警，触发 `rebalance` 事务重排该作用域全部记录。算法见 `src/lib/sort-index.ts`，被 **任务** 和 **项目** 两套排序共用，未来再加其它实体排序也直接复用同一套工具。

各作用域定义：
- **任务排序**（`/api/tasks/reorder`）：作用域 = `assigneeId`（即每个成员一份独立顺序）
- **项目排序**（`/api/projects/reorder`，admin 专属）：作用域 = `archived === false`（归档项目不参与排序）

### 项目归档 ≠ 删除
- **归档**：项目结束。一键可逆。具体语义：
  - 项目列表里折叠到底部分区，新建任务时下拉过滤掉，**不参与项目排序**
  - 项目看板（`/project/[id]`）仍可访问，用于查阅历史
  - 「归档项目里 + 未完成」的任务视为**作废**：团队总览、成员工作台、阻塞看板、所有顶部统计都隐藏它们
  - 「归档项目里 + 已完成」的任务**保留**：算到历史业绩里（如「今日已完成」）
  - 统一通过 `isTaskVisible` / `isTaskDiscarded` 判断（`src/lib/utils.ts`），不要在使用点散写 `task.project.archived && ...`
- **取消归档**：API 自动把项目的 `sortIndex` 重设为「活跃项目队尾」，避免旧 sortIndex 卡在奇怪位置。
- **删除**：物理删除，schema 的 `Task.project onDelete: Cascade` 会级联删除任务，需二次确认并明示"将删除 N 个任务"。
- 删除当前正在浏览的项目要 `router.push("/projects")` 避免 404。
- `TaskDTO.project.archived` 字段已暴露给前端，新写过滤逻辑直接用 helper 即可。

### 项目排序（admin 专属）
- `/projects` 页面的活跃区是 admin 拖拽排序，普通成员看到的就是 admin 排好的固定顺序
- 拖拽手柄只挂在左上角 `GripVertical` 图标上，整张卡片仍可点击跳转
- grid 布局用 `rectSortingStrategy`，与列表排序的 `verticalListSortingStrategy` 区分
- 全局所有列项目下拉 / 项目列表都按 `[archived asc, sortIndex asc, createdAt asc]` 排序，保持视觉一致
- 归档区不可拖（API 校验 `ARCHIVED_NOT_SORTABLE`，前端 grid 也不挂 dnd）
- **项目排序作用域 = 同分类 + 未归档**：项目按 `categoryId` 分组渲染，每个分类是独立的 `ProjectGrid` / `SortableContext`；
  `/api/projects/reorder` 也只允许同 `categoryId` 内拖（跨分类返回 `CROSS_CATEGORY_NOT_SORTABLE`），跨分类移动请走「编辑项目」对话框

### 项目分类（admin 专属）
- 「分类」是把同领域项目折成一组展示的轻概念，对任务模型完全无感
- 每个项目必须挂在某个分类下（`Project.categoryId NOT NULL` + FK Restrict），UI 上按分类分组渲染
- **默认分类「未分类」（`id="default-category"`, `isDefault=true`）**：未指定分类的新项目会落到这里；删除其它分类时该分类下的项目会被自动迁回，禁止删除（API 返回 `DEFAULT_CATEGORY_NOT_DELETABLE`）
- 分类排序复用 `lib/sort-index` 同一套算法，新建分类挂到队尾
- `/api/categories` 的 DELETE 在事务里先 `updateMany` 把该分类下的项目迁到默认分类，再删分类本身；保证不丢项目
- 默认分类与「收集箱」默认项目是两套独立的不变式：分类层 `default-category` ↔ 项目层 `default-misc`，互不绑定

### 阻塞必须带原因
点击「阻塞」按钮**不直接**改 status，先弹 `BlockReasonDialog` 收集 `blockedReason`，提交时一并 PATCH。切到非 blocked 状态时**主动清空 blockedReason**，避免残留旧文案。参见 `workbench.tsx` 的 `handleAction`。

### `completedAt` 由后端独占维护
`Task.completedAt` 用来精确判断「今日完成」、「本周完成」等统计，**不要**用 `updatedAt` 替代（updatedAt 被任意字段编辑触发，会污染统计）。
- API（`/api/tasks/[id]` PATCH）根据 status 切换**自动**维护：非 done → done 写入 `new Date()`，done → 非 done 清空
- 前端 **不可** 在 PATCH body 里显式传 `completedAt`，Zod schema 也不接收该字段
- 统计代码统一用 `isToday(t.completedAt)` 风格，参见 `team/page.tsx`、`workbench.tsx` 的 `doneToday`

### 截止时间是「日期」不是「时刻」
`Task.dueDate` 在模型里是 `DateTime?`，但产品语义是"截止到哪一天"。统一通过 `src/lib/utils.ts` 的三个 helper 处理，**不要散写 `new Date()` 拼日期**：
- `localDateToIso(yyyy-MM-dd)` → 提交时把表单值转 ISO（存为本地当天 23:59:59）
- `isoToLocalDate(iso)` → 编辑时把 ISO 转回 `<input type="date">` 的值
- `formatDueLabel(iso)` → 卡片显示用，返回 `{ label, tone: "danger"|"warn"|"muted" }`，含「逾期 N 天 / 今天到期 / N 天后」等口径
卡片侧已完成（`done`）任务**不渲染**截止时间，避免一片红色的视觉噪音。

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
第一行：拖拽手柄 + 标题（`flex-1 min-w-0 truncate`）+ 操作按钮组（`shrink-0`）
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
| **Client mutation 后忘记 `router.refresh()`** | 本页本地 state 已乐观更新，但切到其他页面（团队总览 / 项目列表）会看到旧数据，Next.js 14 默认 client router cache 缓存 RSC payload 约 30 秒 | **凡是 client 端做的 mutation（API 调用成功后）一律加 `router.refresh()`**，让其它 server component 页面的 RSC 缓存失效。本页面 useState 不会被覆盖，跨页面切换会拿到最新值。`force-dynamic` 不解决这个问题，它只影响 server fetch cache，不影响 router cache |

## 6. 添加新功能的步骤模板

### 加一个新 API 端点
1. `src/app/api/<resource>/route.ts` 或 `[id]/route.ts`
2. 用 `zod` 定义 input schema
3. `requireUser()` 或 `requireAdmin()`
4. 错误用 `handleError(e)` 包装 → 统一返回 `{ error: "CODE" }`
5. 客户端用 `apiFetch<T>(path, init)`，错误信息会以 `Error(code)` 抛出
6. 在 `src/lib/types.ts` 加 DTO 类型，在 `src/lib/serializers.ts` 加序列化
7. **写操作（POST/PATCH/DELETE）成功后**，调用方一律 `router.refresh()`（见反模式表）

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

- 主题用 `next-themes`，组件用 CSS variable（`bg-background` / `text-foreground` / `border-input` 等），**不要硬编码 hex 颜色**
- **项目 / 项目分类没有"颜色"维度**：早期 schema 里 `Project.color` / `ProjectCategory.color` 已在 `drop_project_color` migration 中删除；UI 上靠"名称 + 文字层级 + 分类分组"识别，不要再引入项目色点 / 按项目调色板。需要状态强调时用 `STATUS_THEME`（看板列）或语义色 token（`text-info` / `text-warn` / `text-success` / `text-destructive`）
- 按钮主操作 `variant="default"`，次操作 `variant="outline"`，破坏性 `variant="destructive"`，**避免 `ghost` 混用**导致风格不一
- 状态标识用左侧 `1px` 色条（参考 `task-card.tsx`），不要再引入"优先级 / 重要性"等独立可视化字段
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
