# Backend Agent · 轻量活跃任务台账

> **任务号**：`ARCH-20260325-01`（docs/agents 文档治理第一阶段）  
> **原则**：短条目 + 状态 + 指向；长叙述与运行时复验段落过渡期见 `docs/agents/backend-agent.md`。

## 台账条目模板（复制使用）

- 任务编号：`BE-YYYYMMDD-序号`
- 日期：
- 标题：
- 优先级：`P0|P1|P2`
- 状态：`待派工|进行中|待验证|已完成|已关闭`
- 涉及模块：
- 一句话目标：
- 阻塞：
- 详述：→ `backend-agent.md` 对应节 **或** `docs/knowledge/backend/` 知识卡链接

---

## 当前活跃索引（首批迁入）

> 从 `backend-agent.md` 抽取的**索引行**（含仍标「进行中」者）；完整条目见原文件。

| 任务编号 | 标题（摘要） | 状态 |
| -------- | ------------ | ---- |
| BE-20260323-07 | 5 张业务表字段 COMMENT 治理（Prisma + MariaDB） | 进行中 |
| BE-20260325-12 | online 模式案例 owner 隔离（后端主实现） | 进行中 |
| BE-20260325-13 | 管理员案例列表显示创建用户 | 待派工 |
| BE-20260326-01 | macOS 本地 backend 启动脚本支持（bash，与 ps1 统一链路） | 待验证 |
| BE-20260408-01 | 用户首次登录个人模型 Key 门禁（后端 Phase 1） | 已完成 |
| BE-20260406-01 | 首页 Vue 影子页：problem-cases 字段契约核对（结论：无需后端改动） | 已关闭 |

### BE-20260408-01（明细）

- 日期：2026-04-08
- 优先级：P0
- 状态：已完成
- 涉及模块：`prisma`、`auth`、`ai`、`tests`
- 一句话目标：落地 `AppUser` 个人 AI 配置真相源、保存并验证接口、`/api/ai/chat` 用户级门禁与系统级配置权限收口。
- 阻塞：无（运行时复验阶段识别到**本地数据库历史 drift**：仅本机存在 `20260403194500_widen_problem_case_customer_name`，导致脚本内 `prisma db push` 因潜在截断拦截；已按最小风险策略仅执行本次新增 migration SQL，再以 `--skip-db-push` / 前台实例完成复验，未扩大为无关 schema 改造。）
- 详述：
  - Prisma：新增 `UserAiConfig`（`userId` 唯一关联 `AppUser`、`apiKeyCiphertext` 密文、`verifiedAt`、时间戳）；见 `backend/prisma/schema.prisma` 与 `backend/prisma/migrations/20260408093000_add_user_ai_config/migration.sql`
  - 接口：新增 `GET /api/me/ai-config/status`、`PUT /api/me/ai-config`；`PUT` 固定语义为“保存并验证”，失败不放行、不标记已验证
  - AI chat：`role=user` 只读当前用户自己的已验证配置；缺失 / 未验证返回 `HTTP 428` + `code=AI_CONFIG_REQUIRED`
  - 系统级配置：`/api/ai/config` 已收口为管理员路径，不再允许普通业务用户访问
  - 验证：已完成定向单测、`npm run build`、本地最新实例健康检查与真实接口最小复验；详见 `backend-agent.md` 本任务记录

### BE-20260406-01（明细）

- 日期：2026-04-06
- 优先级：P2（文档/契约核对）
- 状态：已关闭（**backend no-op**）
- 涉及模块：`problem-cases`（只读核对：`problem-case.routes.ts` / `problem-case.service.ts` / `types.ts`）
- 一句话目标：确认「首页迁 Vue 影子页、零漂移」所需字段是否已由现有接口提供，避免重复派工后端。
- 阻塞：无
- 结论摘要：
  - `GET /api/problem-cases` 的 `items[]` 已含 `id`、`createdAt`、`customerName` 及任务进度相关状态字段；**admin** 下列表项额外注入 `createdBy`（`list()` 内 `buildCreatedByFromOwner`）；普通用户列表项无 `createdBy` 字段名，但实体含 `ownerUsernameSnapshot` 等可供展示。
  - 当前任务标签需前端按与 legacy 一致规则从 `currentMajorStage`、`completedStages`、`workflowAlignCompletedStages`、`itGapCompletedStages`、`completedTaskIds` 等推导（列表不返回预计算 `tasks` 数组）。
  - 删除：`DELETE /api/problem-cases/:id`；报告：`GET /api/problem-cases/:id/report`（旧聚合链路仍可用）；导入回跳：`POST /api/problem-cases/import` 响应 `caseId` + `GET /api/problem-cases/:id` 详情。
  - **缺失字段：无**；本轮**不需要**新增接口或改后端实现。
- 详述：→ 接手 AI 可直接以本条目为「已核对、可跳过后端」依据；若产品强制「非 admin 列表也返回同形 `createdBy`」再单独立项 additive 讨论。

### BE-20260326-01（明细）

- 日期：2026-03-26
- 优先级：P1
- 状态：待验证（实现已合入，待 mac 同学实机跑通）
- 涉及模块：`backend/scripts`、本地运行文档
- 一句话目标：为 macOS 提供与 PowerShell 等价的本地启动/停止/状态脚本（不启动本机 DB 服务，仅检查可达）。
- 阻塞：无
- 详述：见 `backend/scripts/README-local.md`（Windows / macOS 双轨说明）

---

## 说明

- 环境类、历史「进行中」条目是否仍有效，以 `backend-agent.md` 最新登记为准。
- 大量已关闭任务（如 `BE-20260323-01`、`BE-20260324-01`、`BE-20260324-11` 等）的**完整交付说明**仍在 `backend-agent.md`，本阶段不重复粘贴。
- 新任务：**先写本文件索引行**，再同步 `backend-agent.md`（过渡期）。
