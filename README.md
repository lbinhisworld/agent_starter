# do1_smart_cto

## 目标

让你在 **10 分钟内跑起来**本项目（前端 + 后端）。

---

## 目录结构（你只需要记住这几个）

- `frontend-vue/`：**唯一自包含前端工程**（Vue 3 + Vite）。入口页是 `home.html`，共享运行时资源在 `public/static/`、被 import 的 legacy JS 在 `src/legacy/`，其余 Vue 页面见 `frontend-vue/AGENTS.md`。
- ~~`frontend/`~~：**已废弃**（2026-06-16 独立化重构，资源已迁入 `frontend-vue/`，目录改名 `frontend.bak/` 暂留备份）。
- `backend/`：Node 后端（Express + Prisma）。

> 已移除的纯原生页：`index.html`（企业信息/商业画布查询）与 `report.html`（售前分析报告）及其独占资源（含 `main.js`）已于 2026-06-16 删除。入口页现为 `home.html`。

`docs/`：文档（部署见 `docs/deploy/`）。**前端阶段与沟通历史 UI**：见 `frontend-vue/src/` 内相关设计与 `docs/` 下的阶段/对话模型文档。

---

## 0) 依赖准备

- Node.js（推荐 LTS / 或团队统一版本）
- Git
- 数据库：本地用 MariaDB/MySQL（连接方式见 `docs/本地MySQL搭建说明.md`）

---

## 1) 一键启动前后端（推荐）

仓库根目录 `dev.mjs` 一条命令同时启动前端（Vite :6677）和后端（ts-node-dev :6688）：

```bash
node dev.mjs              # 同时启动前后端
node dev.mjs --skip-db    # 跳过 prisma（快速重启）
```

启动后访问 **http://localhost:6677/**（未登录会跳 login.html，账号 root/root）。

> 首次运行前需先安装依赖：`cd backend && npm install` 和 `cd frontend-vue && npm install`，
> 并配置 `backend/.env`（`cp backend/.env.example backend/.env`，填 DATABASE_URL）。

---

## 2) 前端快速启动（单独）

前端源码在 `frontend-vue/`（Vue 3 + Vite，唯一自包含工程），生产构建产物输出到 `frontend-vue/dist/`，发布包 `frontend-vue/release/`（由 `npm run build:dist` 生成）。

本地开发：

```bash
cd frontend-vue
npm install
npm run dev
```

联调打开 `http://localhost:6677/home.html`（详见 `frontend-vue/AGENTS.md`）。

生产/预览构建：

```bash
cd frontend-vue
npm run build   # 产物写入 frontend-vue/dist/
npm run build:dist  # 发布包写入 frontend-vue/release/（含 home-legacy.bundle 打包与 minify）
```

---

## 3) 前端配置：后端地址

> 本项目**统一 online 模式**：AI 调用与数据持久化均走后端。原有的 local 模式（前端直连 DeepSeek + IndexedDB）已于 2026-06-17 废弃，不再支持（`config.js` 的 `MODE` 字段锁定为 `'online'`，勿改）。

前端默认后端地址写在 `frontend-vue/public/static/config.js` 的 `BACKEND_API_URL`。若你本机后端端口不同，复制一份本地覆盖（不会提交到 Git）：

```bash
cd frontend-vue
cp public/static/config.js public/static/config.local.js
# 编辑 config.local.js，只保留并修改 BACKEND_API_URL
```

`config.local.js` 会在 `config.js` 之后加载并覆盖配置。

---

## 4) 后端启动

```bash
cd backend
npm ci
npm run build
npm run start
```

健康检查：

- `GET /health`
- `GET /api/problem-cases`

### 4.1 数据库与 Prisma（有改表/首次部署才需要）

- 有 migrations（推荐线上）：`npx prisma migrate deploy`
- 本地快速对齐结构（谨慎）：`npx prisma db push`
- 生成 client：`npx prisma generate`

（本机数据库搭建与连接串：见 `docs/本地MySQL搭建说明.md`）

---

## 5) 常见问题排查（最常用 3 个）

- 前端能打开但接口报错：
  - 检查 `BACKEND_API_URL`（`config.js` 或 `config.local.js`）是否可访问，后端是否已启动

- 后端"启动了但外部访问不了"：
  - 先在服务器本机 `curl http://127.0.0.1:6688/health`
  - 再检查 Nginx/防火墙/安全组（部署细节见 `docs/deploy/02-虚拟机部署执行手册.md`）

- 后端 build 报错：
  - 先 `npm ci` 再 `npm run build`，并检查 TypeScript 报错行
