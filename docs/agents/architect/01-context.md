# 架构 Owner：当前上下文

> 相对稳定背景与当前判断；高频变更的进展摘要可短记于此，**长篇流水**迁台账或 `docs/knowledge/`。

## 1. 当前项目结构

### 核心目录

- `frontend`：主业务前端（首页、`ProblemDetail`、工具页等）。
- `frontend-vue`：登录、管理端、后续迁移承接。
- `backend`：已有 `auth`、`ai`、`problem-cases` 等模块。
- `docs`：架构、部署、计划与 agent 面板。

### 两个前端重点

- **`frontend`**：当前主战场；`ProblemDetail` 为近期最优先复杂业务闭环。
- **`frontend-vue`**：登录、管理端、接线方式；owner 需与 `frontend` 一并纳入规划，避免边界遗漏。

## 2. 当前已知背景（摘要）

- 时间窗口紧；可调度：前端 agent、后端 agent、业务产品 agent、业务人员。
- **本周主线**：`ProblemDetail` 闭环；策略为「止血 + 收边界」，非全面重构。

## 3. 当前架构判断

### 系统现状

- 后端已有起步能力：`auth`、`ai`、`problem-cases`、`ProblemCase` / `ProblemCaseMessage`；前端 online 已走后端。
- **主要矛盾**：复杂度方向——前端承载过多业务规则、任务推进、消息流与回退裁决。

### 方向结论

- 后端：从「存储 + 代理」升级为「规则入口 + 动作裁决中心」。
- 前端：从「业务内核承载者」退回「展示与交互承载者」。
- 近期不追求全系统后端化，优先：`ProblemDetail` 消息时间线统一、最小任务动作接口、鉴权收口、刷新恢复可用。

## 4. 当前最高优先级事项

### 鉴权

- 暴露业务数据、配置、消息时间线、任务状态、AI 能力的接口默认须鉴权；仅健康检查等可匿名，例外须显式记录。
- **已知历史风险点（已代码收口，环境仍须核对）**：`/api/ai` 挂载顺序、OpenAPI/文档路由暴露面等——以各侧 agent 与运行时验证为准。

### 案例详情路由（P0）

- 详情页 URL 须携带后端标准 `caseId`；`createdAt` 仅作兼容/展示，不作详情主路由标识；`ProblemCase.id` 为稳定外部案例标识。

## 5. 当前本周目标（活跃摘要）

- `ProblemCaseMessage` 为唯一消息时间线来源；`ProblemDetail` 以后端接口为主。
- 新增消息为追加，非整段覆盖；`task start / confirm / revise / rollback` 走后端动作接口。
- 刷新恢复：case、tasks、messages、`caseId` 路由定位一致。

## 6. 近期进展摘要（非每日流水）

- **后端**：`/api/ai/*` 鉴权、若干敏感路由收紧；problem-cases 消息与任务动作用鉴权保护；测试与构建基线恢复；`ProblemCaseMessage` 字段归一化推进。
- **上游 AI 故障**：对网络类错误宜返回 502 + 可读信息；本机直连正常而后端失败时优先排查运行环境/DNS/代理；重启验收建议 `lsof(3002)` + `/health` + 最小 `/api/ai/chat` 实调（细节见 `docs/agents/backend/02-playbooks.md` 与 backend-agent 追加记录）。
- **前端**：读取侧与后端收口并进；**caseId 深链路由**仍为独立 P0 项。

---

**触发器**：目录结构、主线目标或架构结论变化时更新；具体接口清单与缺陷长文以各 agent 面板与知识卡为准。
