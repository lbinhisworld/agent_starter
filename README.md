# agent_starter

## 目标

让你在 **10 分钟内跑起来**本项目（前端 + 后端）。

---

## 目录结构（你只需要记住这几个）

- `frontend-vue/`：**唯一自包含前端工程**（Vue 3 + Vite）。入口页是 `home.html`，共享运行时资源在 `public/static/`、被 import 的 legacy JS 在 `src/legacy/`，其余 Vue 页面见 `frontend-vue/AGENTS.md`。
- `backend/`：Node 后端（Express + Prisma）。
- `docs/`：文档（部署见 `docs/deploy/`；前端阶段与沟通历史 UI 见 `frontend-vue/src/` 与 `docs/` 下的阶段/对话模型文档）。

---

## 快速开始（新用户从这里开始）

### 0) 环境要求

- **Node.js**（推荐 LTS / 或团队统一版本）
- **Git**
- **数据库**：MariaDB 或 MySQL（本机搭建与连接串见 `docs/本地MySQL搭建说明.md`）

### 1) 安装依赖

前后端各装一次（首次或拉取新依赖后执行）：

```bash
cd backend && npm install
cd ../frontend-vue && npm install
```

### 2) 配置后端环境变量

后端启动需要 `backend/.env`（仓库不入库，需自行创建）：

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，把 `DATABASE_URL` 的口令 `change_me` 改成本机数据库实际口令：

```
DATABASE_URL="mysql://smart_cto_app:你的口令@127.0.0.1:3306/smart_cto"
PORT=6688
```

> 若未配置 `.env` 直接运行 `node dev.mjs`，脚本会打印分步引导并退出。

### 3) 一键启动前后端

仓库根目录 `dev.mjs` 一条命令同时启动前端（Vite :6677）和后端（ts-node-dev :6688）：

```bash
node dev.mjs              # 同时启动前后端
node dev.mjs --skip-db    # 跳过 prisma（快速重启）
```

> 管理员账号 `root` / `root`（由 `backend/scripts/init-agent-starter-local-db.cjs` 初始化）。

### 4) 访问

浏览器打开 **http://localhost:6677/**（未登录会跳 `login.html`，用 `root` / `root` 登录），登录后进入首页 `home.html`。

---

## 进阶

### 前端单独启动

```bash
cd frontend-vue
npm run dev          # 开发服务器 → http://localhost:6677/home.html
```

生产/预览构建：

```bash
cd frontend-vue
npm run build        # 产物写入 frontend-vue/dist/
npm run build:dist   # 发布包写入 frontend-vue/release/（含 home-legacy.bundle 打包与 minify）
```

### 后端单独启动

```bash
cd backend
npm ci
npm run build
npm run start
```

健康检查：

- `GET http://127.0.0.1:6688/health`
- `GET http://127.0.0.1:6688/api/problem-cases`（需登录态）

### 数据库与 Prisma（有改表 / 首次部署才需要）

- 应用 migrations（推荐线上）：`cd backend && npx prisma migrate deploy`
- 本地快速对齐结构（谨慎）：`cd backend && npx prisma db push`
- 生成 client：`cd backend && npx prisma generate`

（本机数据库搭建与连接串：见 `docs/本地MySQL搭建说明.md`）

### 前端后端地址配置

本项目**统一 online 模式**：AI 调用与数据持久化均走后端。原有的 local 模式（前端直连 DeepSeek + IndexedDB）已于 2026-06-17 废弃，不再支持（`config.js` 的 `MODE` 字段锁定为 `'online'`，勿改）。

前端默认后端地址写在 `frontend-vue/public/static/config.js` 的 `BACKEND_API_URL`。若你本机后端端口不同，创建本地覆盖（不会提交到 Git）：

```bash
cd frontend-vue
cp public/static/config.js public/static/config.local.js
# 编辑 config.local.js，只保留并修改 BACKEND_API_URL
```

`config.local.js` 会在 `config.js` 之后加载并覆盖配置。

---

## 常见问题排查

- **前端能打开但接口报错 / 列表空**：
  - 检查 `BACKEND_API_URL`（`frontend-vue/public/static/config.js` 或 `config.local.js`）是否指向已启动的后端
  - 检查 `backend/.env` 的 `DATABASE_URL` 口令是否正确、数据库是否可达
  - 确认 `config.js` 的 `MODE` 仍为 `'online'`（删改会导致 online 适配器禁用、列表数据丢失）

- **`node dev.mjs` 提示缺少 `backend/.env`**：
  - 按「快速开始 → 2) 配置后端环境变量」创建 `.env` 后重跑

- **后端"启动了但外部访问不了"**：
  - 先在服务器本机 `curl http://127.0.0.1:6688/health`
  - 再检查 Nginx / 防火墙 / 安全组（部署细节见 `docs/deploy/02-虚拟机部署执行手册.md`）

- **端口被占用**：
  - `node dev.mjs` 启动前会自动 kill 6677 / 6688 占用进程；若仍冲突，手动 `lsof -ti :6677 | xargs kill -9`

- **后端 build 报错**：
  - 先 `npm ci` 再 `npm run build`，并检查 TypeScript 报错行
