# StackBoard · 小团队项目管理工具

为不超过 10 人的小团队设计的轻量级任务编排工具。核心特性：

- **团队总览**：管理员一眼看清每个人的工作量、阻塞项、项目进度
- **成员工作台**：进入某个成员的页面拖拽排活，今日聚焦 / WIP 限制 / 阻塞标记一目了然
- **项目看板**：Kanban 视图，按"待办 / 进行中 / 阻塞 / 已完成"分列
- **拖拽排序**：任意列表内拖动卡片调整执行顺序，状态实时落库
- **语雀文档关联**：任务可挂多个语雀文档链接（不重复造文档系统）
- **权限分级**：当前以管理员排活为主，预留员工自助使用的扩展空间

## 技术栈

- Next.js 14 (App Router) + TypeScript
- Prisma + SQLite（单文件，部署最简）
- Tailwind CSS + shadcn/ui 风格组件（Radix UI 底层）
- @dnd-kit 拖拽（支持鼠标 + 键盘 + 触摸）
- NextAuth (Credentials Provider) 账号密码登录
- Docker Compose 一键部署

## 一键部署（推荐）

确保宿主机装了 Docker（version ≥ 20），然后：

```bash
# 1. 准备环境变量
cp .env.example .env
# 编辑 .env：
#   NEXTAUTH_SECRET：必填，至少 32 位随机字符串
#   NEXTAUTH_URL：你的访问地址（http://内网IP:3000 或 https://域名）
#   ADMIN_EMAIL / ADMIN_PASSWORD：初始管理员账号

# 2. 启动（首次会自动构建镜像 + 跑数据库迁移 + 写入种子数据）
docker compose up -d

# 3. 打开 http://localhost:3000，用 .env 里的管理员账号登录
```

启动后：
- 数据库文件落在宿主机 `./data/stack-board.db`，**备份直接 copy 这个文件即可**
- 想清空示例数据：删掉 `./data/stack-board.db` 后重启容器

### 升级 / 重新构建

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

### 关停 / 重启

```bash
docker compose down            # 停止并删除容器（数据保留）
docker compose restart         # 重启
docker compose logs -f         # 看日志
```

## 本地开发

```bash
# 安装依赖（建议 pnpm，npm 也可以）
pnpm install

# 初始化数据库 + 写入种子数据
pnpm prisma migrate dev --name init
pnpm prisma:seed

# 启动开发服务
pnpm dev
# 打开 http://localhost:3000
```

默认账号（来自 seed）：

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 管理员 | `admin@local` | `admin123` |
| 成员 | `li@local`、`wang@local`、`zhang@local`、`chen@local`、`liu@local`、`yang@local` | `123456` |

## 目录结构

```
.
├── prisma/
│   ├── schema.prisma           # 数据模型
│   └── seed.ts                 # 种子数据
├── src/
│   ├── app/
│   │   ├── (app)/              # 需登录的页面组
│   │   │   ├── team/           # 团队总览（首页）
│   │   │   ├── member/[id]/    # 成员工作台
│   │   │   ├── projects/       # 项目列表
│   │   │   └── project/[id]/   # 项目看板
│   │   ├── login/              # 登录页
│   │   ├── api/                # REST API
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── tasks/          # 任务 CRUD
│   │   │   ├── tasks/[id]/
│   │   │   ├── tasks/reorder/  # 拖拽排序
│   │   │   ├── members/
│   │   │   └── projects/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn 风格基础组件
│   │   ├── task-card.tsx       # 工作台任务卡（含操作按钮）
│   │   ├── board-task-card.tsx # 看板小卡
│   │   ├── sortable-task-list.tsx  # 拖拽容器（dnd-kit）
│   │   ├── task-dialog.tsx     # 任务详情编辑对话框
│   │   ├── new-task-dialog.tsx
│   │   └── nav-bar.tsx
│   └── lib/
│       ├── db.ts               # Prisma client 单例
│       ├── auth.ts             # NextAuth 配置
│       ├── sort-index.ts       # 拖拽排序算法（浮点中点插入 + rebalance）
│       ├── serializers.ts      # DTO 序列化
│       └── types.ts            # 类型 + 常量
├── docker/
│   └── entrypoint.sh
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 数据模型设计要点

### 拖拽排序算法

每个 `Task` 有 `sortIndex: Float`，排序作用域 = 该任务的 `assigneeId`（个人执行顺序）。

- 拖拽时只更新被移动卡片的 `sortIndex`（设为相邻两项的均值），避免大批量写库
- 浮点精度极限大约支持 50+ 次连续插入，达到阈值时自动 rebalance（事务性重排该作用域所有 sortIndex）
- 详见 [`src/lib/sort-index.ts`](src/lib/sort-index.ts)

未来若需要无限插入精度，可平滑升级为字符串 LexoRank（schema 字段类型 `Float → String`，算法替换为 lexorank lib）。

### 优先级双轨制

- `priority` (P0/P1/P2/P3)：客观重要性，跨人传达"这件事多紧急"
- `sortIndex`：个人执行顺序，回答"接下来做什么"
- 两者**互补不冗余**——当 P0 任务被排到队尾时，反而能暴露"这个在等什么"的问题

### 角色与扩展性

- `User.role` = "admin" | "member"，目前仅作显示用，预留权限分级空间
- 未来开放给员工自助时：
  1. 按 role 限制可编辑范围（成员只能编辑自己的任务）
  2. "成员工作台"用当前登录用户取代下拉切换
  3. 增加审计日志表 `TaskAuditLog`（task 任何变更产生事件）

## 从 SQLite 切换到 PostgreSQL

数据量大了或者多人并发写入频繁时，可以无缝切到 PostgreSQL：

1. 修改 `prisma/schema.prisma`：
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. 修改 `DATABASE_URL` 为 `postgresql://user:pass@host:5432/dbname`
3. `pnpm prisma migrate dev --name switch-to-postgres`

## 备份策略（SQLite）

```bash
# 本地直接复制即可
cp ./data/stack-board.db ./backups/stack-board-$(date +%Y%m%d).db

# 容器内（无需停机）
docker compose exec stack-board sh -c "cp /app/data/stack-board.db /app/data/backup-$(date +%Y%m%d).db"
```

建议加个定时任务（cron / Windows 任务计划程序）每天自动备份一次。

## License

MIT
