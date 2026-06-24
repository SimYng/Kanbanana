<p align="center">
  <img src="./docs/brand/banner.png" alt="蕉办 Kanbanana" width="640" />
</p>

<h1 align="center">蕉办 · Kanbanana</h1>

<p align="center">
  <em>别催了，蕉办。</em><br/>
  一个有点不正经，但认真帮你管理任务的开源项目看板。
</p>

<p align="center">
  <code>任务别乱飞，先上蕉办</code>
</p>

---

为不超过 10 人的小团队设计的轻量任务编排工具。核心能力：

- **团队总览**：管理员一眼看清每个人在做什么、卡在哪、今天完成了多少
- **成员工作台**：状态驱动看板视图（进行中 / 待办 / 阻塞 / 近期已完成 / 已取消），拖拽排活、阻塞必带原因
- **项目看板**：Kanban 视图，按"待办 / 进行中 / 阻塞 / 已完成 / 已取消"分列；支持项目编辑 / 归档 / 删除
- **任务终态**：「已完成」算业绩、「已取消」记录主动放弃（不算业绩、不占工作量），两者都可一键互转 / 恢复
- **拖拽排序**：任意列表内拖动卡片调整执行顺序，浮点 `sortIndex` 落库；近似 LexoRank 但实现极简
- **语雀文档关联**：任务可挂多个语雀链接（不重复造文档系统）
- **权限分级**：当前管理员排活为主，预留员工自助使用扩展空间
- **主题切换**：跟随系统 / 浅色 / 深色

## 技术栈

- Next.js 14（App Router）+ TypeScript
- Prisma + SQLite（单文件，部署最简）
- Tailwind CSS + shadcn/ui 风格组件（Radix UI 底层）
- @dnd-kit 拖拽（鼠标 + 键盘 + 触摸）
- NextAuth Credentials Provider（账号密码登录）
- Docker Compose 一键部署

## 一键部署（推荐）

宿主机装好 Docker（≥ 20），然后：

```bash
# 1. 准备环境变量
cp .env.example .env
# 编辑 .env：
#   NEXTAUTH_SECRET：必填，至少 32 位随机字符串
#   NEXTAUTH_URL：你的访问地址（http://内网IP:2233 或 https://域名）
#   ADMIN_EMAIL / ADMIN_PASSWORD：初始管理员账号

# 2. 启动（首次会自动构建镜像 + 跑数据库迁移 + 写入种子数据）
docker compose up -d

# 3. 打开 http://localhost:2233，用 .env 里的管理员账号登录
```

启动后：

- 数据库文件落在宿主机 `./data/kanbanana.db`，**备份直接 copy 这个文件即可**
- 想清空示例数据：删掉 `./data/kanbanana.db` 后重启容器

> 若宿主机上仍留有旧数据库文件 `data/stack-board.db`，容器 entrypoint 会自动重命名为 `data/kanbanana.db`，无需手动操作。

### 升级 / 重新构建

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

### 关停 / 重启 / 查日志

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
# 打开 http://localhost:2233
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
│   │   │   ├── projects/       # 项目列表（含归档分区）
│   │   │   └── project/[id]/   # 项目看板
│   │   ├── login/              # 登录页
│   │   ├── api/                # REST API
│   │   ├── icon.png            # Next.js 自动注入的 favicon
│   │   ├── apple-icon.png
│   │   ├── opengraph-image.png # 社交分享卡
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn 风格基础组件
│   │   ├── task-card.tsx
│   │   ├── confirm-dialog.tsx
│   │   ├── block-reason-dialog.tsx
│   │   ├── project-actions-menu.tsx
│   │   └── ...
│   └── lib/
│       ├── sort-index.ts       # 拖拽排序算法
│       └── ...
├── public/brand/               # 应用内消费的 logo
├── docs/brand/                 # README banner / 截图等仓库展示资源
├── scripts/process-logo.ps1    # logo 多尺寸生成脚本
├── docker/entrypoint.sh
├── Dockerfile
├── docker-compose.yml
├── AGENTS.md                   # AI 编码助手工作指南
└── README.md
```

## 设计要点

### 拖拽排序算法

每个 `Task` 有 `sortIndex: Float`，排序作用域 = 该任务的 `assigneeId`（个人执行顺序）。

- 拖拽时只更新被移动卡片的 `sortIndex`（设为相邻两项的均值），避免大批量写库
- 浮点精度约 50 次连续插入告警，自动 rebalance（事务性重排该作用域全部 sortIndex）
- 详见 [`src/lib/sort-index.ts`](src/lib/sort-index.ts)

未来若需要无限插入精度，可平滑升级为字符串 LexoRank。

### 优先级与个人执行顺序双轨

- `priority`（P0–P3）：客观重要性，跨人传达"这件事多紧急"
- `sortIndex`：个人执行顺序，回答"接下来做什么"
- 两者**互补不冗余**——当 P0 任务被排到队尾时，反而能暴露"这个在等什么"的问题

### 状态驱动的成员工作台

工作台按 `status` 分列：**进行中 / 待办 / 阻塞中 / 近期已完成 / 已取消**。点击「阻塞」按钮会强制弹窗让你写阻塞原因，避免任务卡住却没人知道为什么。「已取消」是与「已完成」并列的终态，用来记录"决定不做了"的任务——不计入工作量统计，也不算完成业绩，但可随时恢复。

### 项目归档 vs 删除

- **归档**：折叠到底部，新建任务时项目下拉过滤掉，但**现有任务仍正常显示可继续推进**。一键可逆。
- **删除**：物理删除，连带删除项目下所有任务，二次确认提示"将删除 N 个任务"，引导用户优先选归档。

### 角色与扩展性

- `User.role` = `admin` | `member`，目前仅作展示用，预留权限分级空间
- 未来开放给员工自助时：按 role 限制可编辑范围 → 成员工作台用当前登录用户取代下拉切换 → 增加审计日志表

## 从 SQLite 切换到 PostgreSQL

数据量大了或多人并发写入频繁时，可以无缝切到 PostgreSQL：

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
# 本地直接复制
cp ./data/kanbanana.db ./backups/kanbanana-$(date +%Y%m%d).db

# 容器内（无需停机）
docker compose exec kanbanana sh -c "cp /app/data/kanbanana.db /app/data/backup-$(date +%Y%m%d).db"
```

建议加个定时任务（cron / Windows 任务计划程序）每天自动备份一次。

## 品牌资源

- `public/brand/logo-mark.png` — 应用内使用的纯图标版本
- `docs/brand/banner.png` — README / 社交媒体展示用
- `src/app/icon.png` + `apple-icon.png` + `opengraph-image.png` — Next.js 约定式 metadata，自动注入 `<head>`

修改 logo 后重新生成所有尺寸：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\process-logo.ps1
```

## License

MIT
