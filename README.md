# do1_smart_cto

## 目标

让你在 **10 分钟内跑起来**本项目（前端 + 可选后端），并知道“本地模式 / 线上模式”怎么切。

---

## 目录结构（你只需要记住这两个）

- `smart_cto/`：纯静态前端（`index.html + main.js + js/*`）
- `backend/`：Node 后端（Express + Prisma）

`docs/`：文档（部署见 `docs/deploy/`）。**前端阶段与沟通历史 UI**：见 `frontend/数字化问题跟进阶段设计.md`、`frontend/对话模型管理.md`（过程日志标签统一字号等见前者 §0.6、后者 §4.5）。

---

## 0) 依赖准备

- Node.js（推荐 LTS / 或团队统一版本）
- Git
- （可选）数据库：本地用 MariaDB/MySQL（连接方式见 `docs/本地MySQL搭建说明.md`）

---

## 1) 前端快速启动（必做）

前端是静态站点，建议用本地静态服务器启动（不要直接双击 `index.html`）。

```bash
cd smart_cto
npx serve .
```

打开终端提示的地址即可。

---

## 2) 前端配置：本地模式 / 线上模式（二选一）

先复制一份本地配置（不会提交到 Git）：

```bash
cd smart_cto
cp config.example.js config.local.js
```

### 2.1 本地模式（local）

适合个人开发：**AI 直连 DeepSeek + 数据存 localStorage**。

在 `smart_cto/config.local.js` 配置：

- `MODE: 'local'`
- `DEEPSEEK_API_KEY: '...'`

### 2.2 线上模式（online）

适合联调/共享数据：**AI + 数据统一走后端**。

在 `smart_cto/config.local.js` 配置：

- `MODE: 'online'`
- `BACKEND_API_URL: 'http(s)://<host>/api'`

注意：`BACKEND_API_URL` 必须是 **API 基础地址（以 `/api` 结尾）**，不要填 `/health`。

---

## 3) 后端启动（仅 MODE='online' 需要）

```bash
cd backend
npm ci
npm run build
npm run start
```

健康检查：

- `GET /health`
- `GET /api/problem-cases`

### 3.1 数据库与 Prisma（有改表/首次部署才需要）

- 有 migrations（推荐线上）：`npx prisma migrate deploy`
- 本地快速对齐结构（谨慎）：`npx prisma db push`
- 生成 client：`npx prisma generate`

（本机数据库搭建与连接串：见 `docs/本地MySQL搭建说明.md`）

---

## 4) 常见问题排查（最常用 3 个）

- 前端能打开但接口报错：
  - `MODE='local'`：检查 `DEEPSEEK_API_KEY` 是否填写正确
  - `MODE='online'`：检查 `BACKEND_API_URL` 是否可访问，后端是否已启动

- 后端“启动了但外部访问不了”：
  - 先在服务器本机 `curl http://127.0.0.1:3000/health`
  - 再检查 Nginx/防火墙/安全组（部署细节见 `docs/deploy/02-虚拟机部署执行手册.md`）

- 后端 build 报错：
  - 先 `npm ci` 再 `npm run build`，并检查 TypeScript 报错行
