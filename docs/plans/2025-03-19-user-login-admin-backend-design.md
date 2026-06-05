# 用户登录与管理员后台 — 设计与实施计划

> 2026-04-07 补充：涉及“用户自己的大模型 Key 在首次登录时必须先配置、配置成功前不得进入系统”的方案，改由 `docs/plans/2026-04-07-user-first-login-llm-key-gate.md` 作为主记录；本文件继续聚焦登录鉴权与管理员后台本身。

## 1. 需求与约束（已确认）

| 项 | 结论 |
|----|------|
| 用户登录标识 | `username` |
| 用户状态 | 仅 **启用 / 停用** |
| 外部系统 | 用户注册走外部流程，本系统不实现注册；后台仅维护用户与状态 |
| 管理员账号 | 固定存管理员表，初始可 seed 或手动维护 |
| Local 模式 | 不与后端挂钩，账号与密码存前端（localStorage）；默认 root/root；后台可展示明文密码 |
| Online 模式 | 后端存 hash，鉴权用 **JWT**（`Authorization: Bearer <token>`）；后台新增/改密时接口返回明文一次供管理员复制，库中只存 hash |
| 随机初始密码 | 新增用户时生成随机密码，在管理后台界面展示明文（当前阶段默认一直可看） |

---

## 2. 数据模型（简要）

### 2.1 管理员（AdminUser）
- `id`, `username`（唯一）, `passwordHash`, `createdAt`, `updatedAt`
- Local：前端 `localStorage` 中等价结构，可存明文密码便于 root/root 与展示

### 2.2 业务用户（AppUser）
- `id`, `username`（唯一）, `passwordHash`, `status`（`ENABLED` \| `DISABLED`）, `createdAt`, `updatedAt`
- 不需要 `externalUserId`（本期不做外部系统映射）

### 2.3 登录与鉴权规则
- 账号不存在或密码错误 → 401
- 账号存在但 `status === DISABLED` → 403（或统一 401，建议 403 便于排查）
- 成功登录 → 签发 JWT（online）或写前端会话（local）

---

## 3. 鉴权方案：JWT（Online 模式）

- **签发**：登录接口校验用户名+密码（bcrypt/argon2）及 `status` 后，生成 JWT（payload 含 `userId`、`username`、`role`、`exp` 等）。
- **校验**：需要鉴权的接口通过中间件解析 `Authorization: Bearer <token>`，校验签名与过期，并从 payload 取身份。
- **撤销**：JWT 无状态，禁用用户后旧 token 在过期前仍有效；可接受短期延迟时用较短 `exp`（如 2h），必要时再补黑名单或版本号。

---

## 4. 阶段计划（含 JWT 落地）

### 阶段 0：需求定稿与数据结构草案（已完成）
- 账号字段、状态枚举、角色、Local/Online 策略、密码展示策略已确认。
- 输出：本文档。

### 前端工程框架化：Vue3（与鉴权并行推进）
- 技术选型：Vite + Vue3 + TypeScript + Vue Router + Pinia（状态管理）
- 目录约定：`src/auth`（登录/登出/鉴权状态机）、`src/api`（HTTP 封装）、`src/repositories`（Local/Online 适配器）、`src/pages`（Login/Admin 等页面）
- 关键要求：
  - Repository 抽象屏蔽 `localStorage` 与后端 API 差异
  - JWT 分支通过统一的 `AuthRepository` 接入：由它负责写入/读取 token，并提供 `getCurrentUser()/signOut()`
  - local 模式仅保留登录联调能力；管理员后台在 local 下禁用/隐藏（为后续移除留最小体积）
- 输出：Vue3 工程骨架 + 路由门禁 + 一个可复用的认证状态机（满足后续替换 Online(JWT) 实现）。

### 阶段 1：Local 登录（不支持管理员后台访问）
- 登录页：local 模式下默认 root/root 可用（用于联调前端交互，不作为长期方案）。
- 管理后台：local 模式下不提供访问入口（路由禁用/按钮隐藏）。
- 输出：登录页 + 前端鉴权状态与路由控制（sessionStorage 存当前登录身份）。

### 阶段 2：Local 联调稳定（为移除做准备）
- 仅完善“业务用户登录态”在 local 下的稳定性（过期/登出/状态展示）。
- 输出：保证 local 分支可随时移除，不影响在线 JWT 分支接口与页面结构。

### 阶段 3：Online 鉴权接入（后端 + JWT）
- 后端：Prisma 新增 `AdminUser`、`AppUser` 表；登录接口（管理员与业务用户可统一或分路径）；密码 hash（如 bcrypt）；签发 JWT。
- 登录响应：返回 `{ token, expiresIn, user: { id, username, role } }`；前端将 token 存内存或 localStorage，请求时带 `Authorization: Bearer <token>`。
- 管理后台：Online 模式下提供；调用后端 API；新增用户接口生成随机密码并返回明文一次，库中只存 hash；启用/停用、修改密码接口。
- 输出：Online 模式下登录可用、管理后台通过 API 维护用户，禁用用户无法登录（新请求会 403；旧 token 在过期前仍有效，可依赖短过期时间控制）。

### 阶段 4：权限落到业务与审计预留
- 接口权限：区分管理员与业务用户可访问的 API；ProblemCase 等可按创建人/归属做数据隔离（可选）。
- 操作日志：管理员改状态、改密码、创建用户等关键操作落库或日志，便于审计。
- 输出：业务数据按角色可见/可操作，为多用户与审计打基础。

---

## 5. 技术要点小结

- **Local**：前端唯一数据源；root/root 默认；密码明文存、明文展示。
- **Online**：后端 hash + JWT；管理后台仅“展示/返回明文一次”，库中仅 hash；用户状态启用/停用在后端生效。
- **JWT**：推荐短过期（如 2h），后续可按需加刷新 token 或黑名单。

---

*文档版本：2025-03-19，JWT 方案已纳入阶段 3。*
