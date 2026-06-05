# Smart CTO 后端部署说明（更新时间：2026-03-19 02:44）

本文档面向“需要把后端部署到服务器”的场景，重点说明部署完成后应执行的后续步骤，保证：

- 数据库已创建并完成迁移（包含 `AdminUser` / `AppUser` 两张表）
- JWT 鉴权与管理员后台功能可用
- 业务接口（`/api/problem-cases`、`/api/ai/chat` 等）在在线模式下可正确校验 `Authorization: Bearer <token>`

## 1. 前置条件

1. 安装运行环境
- Node.js（建议 >= 18）
- MySQL（版本建议 >= 8）

2. 准备 MySQL 数据库
- 数据库名：`do1_smart_cto`（如果你使用的是其他库名，请同步到 `DATABASE_URL`）
- 账号：需要能对该库执行建表/写入（至少拥有 DDL/DML 权限）

## 2. 配置环境变量

在服务器上的 `backend/` 目录创建（或覆盖）`.env` 文件。

参考模板：`backend/docs/dotenv.production.template`；密钥生成与自检说明：`backend/docs/secrets-init.md`。

最少需要：
- `NODE_ENV=production`（或 production / development 均可）
- `HOST`：建议生产环境填写 `0.0.0.0`
- `PORT=3000`
- `DATABASE_URL="mysql://<user>:<password>@<host>:3306/<dbName>"`

生产环境 **必须** 显式配置（启动前自检，不自动生成）：
- `JWT_SECRET`：JWT 签名密钥；`NODE_ENV=production` 时不可省略且不可使用开发占位 `dev_jwt_secret`。
- **建议** `AI_CONFIG_ENCRYPTION_SECRET`：用户 AI Key 加密专用密钥；可用 `npm run secrets:generate` 或 `node scripts/generate-deploy-secrets.cjs` 生成后与 `JWT_SECRET` 一并写入 `.env`。未设置时，现有逻辑会回退为使用 `JWT_SECRET` 派生加密密钥（启动时会打印警告）。

可选：
- `JWT_EXPIRES_IN`：JWT 过期时长（默认与代码中 `auth.service` 一致）

## 3. 安装依赖

在 `backend/` 目录执行：

- `npm ci`（推荐）或 `npm install`

## 4. Prisma Client 生成

在 `backend/` 目录执行：

- `npm run prisma:generate`

## 5. 数据库迁移（创建用户表等）

在 `backend/` 目录执行迁移，确保数据库完成新 schema 的建表。

建议方式（开发迁移脚本）：
- `npm run prisma:migrate -- --name init-auth`

如果你是生产环境（不想使用 dev 交互式迁移），建议改用：
- `npx prisma migrate deploy`

迁移完成后，数据库应新增表：
- `AdminUser`
- `AppUser`

## 6. 后端启动

在 `backend/` 目录执行：
- `npm run start`

启动后：
- 健康检查：`GET /health` 应返回 `ok: true`
- Swagger：`/api-docs` 可选访问确认（若生产有鉴权/反代可按实际配置跳过）

## 7. 初始化管理员账号（root/root）

后端当前实现了“首次登录自动 seed 默认管理员（root/root）”逻辑：
- 当数据库中不存在 `AdminUser(username=root)` 时
- 第一次用 `POST /api/auth/login` 使用 `root/root` 登录成功后，会自动创建该管理员记录

部署完成后你可按以下流程初始化：
1) 用浏览器打开前端登录页（online 模式下）
2) 输入 `root/root` 登录
3) 进入 `admin.html` 后即可在后台手动创建/启用/停用用户

## 8. 与前端在线模式的联动要求

前端在线模式要求：
- `frontend/config.local.js` 中 `MODE=online`
- `BACKEND_API_URL` 指向后端：`http(s)://<server-host>:3000/api`

并且前端请求会在 online 模式下携带：
- `Authorization: Bearer <JWT>`

后端鉴权：
- 禁用用户会返回 `403`
- 管理后台接口（`/api/admin/*`）要求管理员 role

## 9. 需要重点关注的错误

1. `DATABASE_URL` 无法连接或认证失败
- 会导致 Prisma migration 失败或后端启动失败

2. JWT 鉴权失败（401/403）
- 检查前端是否处于 online 模式
- 检查 token 是否写入并随请求附带 `Authorization: Bearer`

