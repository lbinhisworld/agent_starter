# 运行时验证四件套：build · 重启 · 最新实例 · 最小实调

## 元数据

- 适用模块：`multi`（以后端进程为主，前后端联调问题通用）
- 关联任务：`ARCH-20260325-03`（cross-cutting 知识卡迁移 · 第一批）
- 状态：active

---

## 为什么「代码改完」不等于「已经生效」

- **Node/Express 进程在启动时加载 `dist`**，路由与中间件在内存中固定；改源码或重新 `build` 后，若**未重启监听进程**，线上/本机仍运行旧逻辑。
- **端口上 listening 的不一定是当前工作区**：可能残留旧 PID、另一份克隆、或代理到远端环境。
- **单测通过**只证明仓库内契约；**用户浏览器/真实 DB/真实 token** 仍可能暴露未覆盖路径。
- 因此：接口行为、404/401 差异、新字段是否出现等问题，应用下面 **四件套** 先排除「实例与版本」因素，再谈业务逻辑 bug。

---

## 四件套定义

| 序号 | 名称 | 要回答的问题 |
| ---- | ---- | ------------ |
| 1 | **Build** | 当前工作区是否已 `npm run build` 成功，且无未提交的编译错误？ |
| 2 | **重启** | 目标端口上的进程是否在 **本次 build 之后** 重新启动？ |
| 3 | **最新实例确认** | 监听该端口的进程，是否就是 **本仓库 `backend`** 的 `node dist/...`，且 `state`/时间与构建链一致？ |
| 4 | **真实接口最小复验** | 是否用 **带鉴权** 的最小请求（如 `GET /health`、`POST /api/ai/chat`、或专用 `_runtime-verify-*.cjs`）命中同一 base URL，确认响应符合**当前**契约？ |

四者**顺序固定**：先能编译，再启对进程，再证明进程与代码对应，最后用真实 HTTP 证明行为。

---

## 典型证据（本仓库）

### 1. Build

- 在 `backend` 目录执行：`npm run build`，退出码 0。
- 记录：执行时刻（或 CI 日志片段）。

### 2. 重启

- 使用 `scripts/stop-local-backend.ps1` 停止旧进程后，再 `start-local-backend.ps1`（可按需 `-SkipBuild`）。
- 本机若 `PORT`（如 3000）被占用，脚本可能顺延到 **3002** 等；**以后续 `state.json` 与实际监听为准**。

### 3. 最新实例确认

- **`backend/.local/run/state.json`**（若使用标准脚本）：核对 `scriptRoot` 是否等于当前工作区 `backend` 路径；`port`、`pid`、`startedAt`。
- **`dist` 与启动时间**：例如 `dist/src/server.js`（或相关路由产物）的修改时间应 **早于** `startedAt`，表示为先 build 再启动当前产物。
- **端口占用**：`lsof`/资源管理器/脚本输出，确认 PID 与 `state.json` 一致。
- **反例**：`dist` 中某文件时间 **晚于** 进程启动时间 → 进程仍是旧内存路由，**必须重启**后再验（典型：`/api/ai/chat` 缺新字段、`GET .../export` 404）。

### 4. 真实接口最小复验

- **健康检查**：`GET http://127.0.0.1:<port>/health`。
- **需登录接口**：使用与 `.env` 中 `JWT_SECRET` 一致的 **JWT**（或 `POST /api/auth/login` 用库中真实账号），请求头 `Authorization: Bearer <token>`。
- **专项脚本**（若任务交付）：如 `node scripts/_runtime-verify-messages.cjs http://127.0.0.1:3002`、`node scripts/_runtime-verify-task11-step.cjs ...`，以输出 `ok:true` 为准。
- **AI 代理**：分层排查时建议：**上游直连** → **`/health`** → **`POST /api/ai/chat`**，避免把 DNS/代理问题误判为业务代码。

---

## 常见误判

| 误判 | 实际情况 | 该怎么验 |
| ---- | -------- | -------- |
| 「我本地 curl 正常」 | 用户环境与 agent 环境不同；或用户连的是另一端口 | 让用户提供 **base URL + 端口 + Network 截图** |
| 浏览器直接打开 `POST` 路由返回 404 | GET 不匹配 POST 路由，不是「服务挂了」 | 看 **方法** 与 OpenAPI/代码是否一致 |
| 无 Token 访问业务接口返回 401 | 预期行为 | 带 Bearer 再判是否 404/业务错误 |
| `GET .../export` 404 但 `GET .../messages` 200 | 多为**旧进程无新路由**或未加载最新 `dist` | 四件套对齐后再试 |
| 改完代码「看起来服务还在跑」 | 进程未重启 | 比对 `startedAt` 与 `dist` 时间 |

---

## 标准回报格式（建议）

联调或关账时，后端/全链路 agent 建议按下列**固定项**回报，便于 owner 快速判断是否为「实例问题」：

```text
1. build：是否在 backend 执行 npm run build？结果（通过/失败摘要）。
2. 重启：是否 stop 后 start？当前监听端口（如 3002）。
3. 最新实例：
   - state.json：scriptRoot、port、pid、startedAt（或等价说明）。
   - dist 关键文件时间与 startedAt 先后关系（先 build 后启动 / 不一致则说明）。
4. 真实接口最小复验：
   - URL（含端口）
   - 是否带 Bearer / 使用的脚本名
   - 关键响应字段或 exit 码（如 ok:true、HTTP 200 与 body 摘要）
```

与「仅代码审查/单测通过」区分：**四件套是运行时收尾**，用于冻结「当前环境可复现」。

---

## 与证据驱动协作的关系

- 架构侧约定：优先 **日志 / Network / Console** 驱动定责，不默认要求反复全量浏览器自动化。
- 四件套解决的是 **「进程与二进制是否对齐」**；在此之后，再用最小证据清单（请求体、`issues` 数组、截图）定位业务与契约。

---

## 修订记录

- 2026-03-25：初稿；提炼自 `architect-owner.md`（§14 / 后端进展）、`architect/02-playbooks.md`（§4）、`backend-agent.md` 任务记录中的「运行时复验」模板与 BE-20260321-06/BE-20260322-03 等结论；服务 ARCH-20260325-03。
