# Folder: e:\03_do1_workspace\do1_smart_cto\docs\agents

## 地位

项目级多角色 agent 工作面板目录，用于沉淀架构协调、业务产品判断与前后端执行边界。

## 职责

1. 为不同角色提供可直接接手的执行面板与上下文。
2. 维护跨角色协同规则、**轻量任务台账**与升级路径。
3. 让后续 AI 在不依赖聊天历史的情况下，也能恢复当前项目推进状态。
4. 与 `docs/knowledge/` 知识库配合：**可复用的缺陷与经验进知识卡**，主文档不堆流水账。

## 约束（冻结口径 · ARCH-20260325-01 / ARCH-20260325-02）

- **核心准则类文档**（各角色目录下的 `00-core.md`）**≤ 200 行**；超长内容拆到 `01-context.md` / `02-playbooks.md` 或知识库。
- **业务产品线分层**（`BP-20260325-06`）：主读 `docs/agents/business-product/` 下四层；`business-product-agent.md` 仅作历史迁移参考，不堆新增流水。
- **架构 owner 分层落地**（`ARCH-20260325-02`）：主读 `docs/agents/architect/` 下四层；`architect-owner.md` 仅作历史迁移参考，不堆新增流水。
- **动态增长内容**（任务记录、每日更新、追加补记）**不得**再写入 `00-core.md`；**台账**落在各角色 `03-active-tasks.md`，长叙述逐步迁出或仅保留索引。
- **缺陷经验**优先沉淀为 `docs/knowledge/` 下的知识卡，而非在主文档重复堆叠。
- 新任务若需要持续跟进，须先落到对应角色的 **`03-active-tasks.md`**（及 owner 总控侧约定位置），再派工或执行。
- **角色文档优先级**（`ARCH-20260326-02`）：一旦按某角色 `00-core.md` 完成身份初始化，该角色的职责边界与默认输出优先于通用执行倾向；尤其 **architect owner** 默认停留在**架构设计 / 审查 / 派工**位。
- **owner 实现门禁**（`ARCH-20260326-02`）：architect owner 未获「你直接改 / 你来实现 / 你亲自落代码 / 直接提交补丁」等明确授权前，只允许更新**文档、台账、知识卡、规则文件**，不得直接修改 `frontend/`、`frontend-vue/`、`backend/` 业务代码。
- 新增角色目录、调整角色边界或改变协作顺序时，必须同步更新本文件。
- 前后端实现边界以各自 `docs/agents/{frontend|backend}/` 为准；业务产品与架构判断仍以 owner / 业务产品文档为准，不直接混入实现细节。

## 目录结构

```text
docs/agents/
├── AGENTS.md                 # 本文件：索引与治理规则
├── architect-owner.md        # 架构 owner 历史全文（迁移参考；主读 architect/ 分层）
├── architect/                # 架构 owner 分层（核心 ≤200 行 + 上下文 + playbooks + 台账）
│   ├── AGENTS.md             # 本目录短索引（先读）
│   ├── 00-core.md
│   ├── 01-context.md
│   ├── 02-playbooks.md
│   └── 03-active-tasks.md
├── business-product-agent.md # 业务产品历史全文（迁移参考；主读 business-product/ 分层）
├── business-product/         # 业务产品分层（核心 ≤200 行 + 上下文 + playbooks + 台账）
│   ├── 00-core.md
│   ├── 01-context.md
│   ├── 02-playbooks.md
│   └── 03-active-tasks.md
├── frontend-agent.md         # 前端入口：保留历史与过渡期引用，新内容以 frontend/ 为准
├── backend-agent.md          # 后端入口：同上
├── frontend/
│   ├── 00-core.md           # 核心准则 + 修改边界（≤200 行）
│   ├── 01-context.md        # 项目背景、目标、冻结边界（相对稳定）
│   ├── 02-playbooks.md      # 操作手册：鉴权排查、协同模板、验收口径等
│   └── 03-active-tasks.md   # 轻量活跃任务台账（索引 + 短条目）
└── backend/
    ├── 00-core.md
    ├── 01-context.md
    ├── 02-playbooks.md
    └── 03-active-tasks.md
```

## 索引规则

| 读者意图 | 先读 |
| -------- | ---- |
| 项目总协作与分形文档链 | 根目录 `AGENTS.md`、`.cursor/rules/project-core.mdc` |
| 架构 owner / 总控任务与台账 | 分层短索引 **`architect/AGENTS.md`** → **`architect/00-core.md`** 起读；活跃台账 **`architect/03-active-tasks.md`**；`architect-owner.md` 保留历史全文 |
| 业务产品取舍与版本优先级 | **`business-product/00-core.md`** 起读；活跃台账 **`business-product/03-active-tasks.md`**；`business-product-agent.md` 保留历史全文 |
| **前端执行：准则** | `frontend/00-core.md` |
| **前端执行：背景与边界** | `frontend/01-context.md` |
| **前端执行：怎么查/怎么协同** | `frontend/02-playbooks.md` |
| **前端执行：当前跟哪些任务** | `frontend/03-active-tasks.md` |
| **后端执行** | 同上，替换为 `backend/` 下对应文件 |
| **可复用踩坑与结论** | `docs/knowledge/README.md` 与对应子目录 |

- **入口文件**：`frontend-agent.md` / `backend-agent.md` 顶部说明指向分层目录；历史长文在原文件中逐步收敛，不要求第一阶段删改历史正文。

## 成员清单

| 文件路径 | 简述 |
| -------- | ---- |
| `docs/agents/AGENTS.md` | 本目录索引与文档治理规则 |
| `docs/agents/architect-owner.md` | 架构 owner 历史迁移参考全文（主读已迁至 `architect/`） |
| `docs/agents/architect/AGENTS.md` | 架构 owner 分层目录短索引（阅读顺序与四层职责） |
| `docs/agents/architect/00-core.md` | 架构 owner 核心准则（≤200 行） |
| `docs/agents/architect/01-context.md` | 架构 owner 当前上下文与架构判断摘要 |
| `docs/agents/architect/02-playbooks.md` | 架构 owner 派工模板（含 Task Contract v1）、运行时验证、接手清单 |
| `docs/agents/architect/03-active-tasks.md` | 架构 owner 轻量活跃 ARCH 台账 |
| `docs/agents/business-product-agent.md` | 业务产品历史迁移参考全文（主读已迁至 `business-product/`） |
| `docs/agents/business-product/00-core.md` | 业务产品核心准则（≤200 行） |
| `docs/agents/business-product/01-context.md` | 业务产品当前上下文与路线图摘要 |
| `docs/agents/business-product/02-playbooks.md` | 业务产品裁决框架、标准输出、验收与提示词模板 |
| `docs/agents/business-product/03-active-tasks.md` | 业务产品轻量活跃 BP 台账 |
| `docs/agents/frontend-agent.md` | 前端执行入口（过渡期保留全文历史） |
| `docs/agents/backend-agent.md` | 后端执行入口（过渡期保留全文历史） |
| `docs/agents/frontend/00-core.md` | 前端核心准则（≤200 行） |
| `docs/agents/frontend/01-context.md` | 前端背景与冻结边界 |
| `docs/agents/frontend/02-playbooks.md` | 前端操作手册与协同模板 |
| `docs/agents/frontend/03-active-tasks.md` | 前端轻量活跃台账 |
| `docs/agents/backend/00-core.md` | 后端核心准则（≤200 行） |
| `docs/agents/backend/01-context.md` | 后端背景与冻结边界（含设计详情推理图 **`tk_`/`ft_`/`lk_`** 主键与 `GET …/design-detail/task-graph` 兼容说明） |
| `docs/agents/backend/02-playbooks.md` | 后端操作手册与协同模板 |
| `docs/agents/backend/03-active-tasks.md` | 后端轻量活跃台账 |
| `docs/knowledge/README.md` | 知识库规则与命名约定 |

**触发器**: 一旦本文件夹增删角色文档、分层文件、角色职责或协作顺序变化，请立即重写本文件。
