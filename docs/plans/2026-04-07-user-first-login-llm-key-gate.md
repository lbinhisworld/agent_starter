# 用户首次登录个人模型 Key 门禁与自助配置计划

## 0. 主记录与任务编号

- **主记录**：本文档为本需求的唯一主记录。
- **owner 任务编号**：`ARCH-20260407-01`
- **产品任务编号**：`BP-20260407-01`
- **影响范围**：`multi(frontend-vue + frontend + backend + docs)`
- **风险级别**：`P0`
- **owner 执行口径**：本需求不是“再补一个设置页”，而是**登录链路 + 用户级密钥存储 + 业务入口门禁 + AI 调用真相源**的联合改造；实施前先按 Task Contract 冻结，再拆给前后端。

## 1. 背景与问题

当前 online 模式下，DeepSeek Key 主要通过接口或数据库手工配置。这种方式适合运维、联调和排障，但不适合作为正式产品的普通用户首用流程。

用户要求已经明确冻结为：

- 当**某个用户本人**首次登录时，如果他还**没有配置自己的大模型 Key**，则不能进入系统主界面。
- 必须先完成 Key 配置并校验通过，之后才允许进入 `home.html`、`index.html`、`report.html` 以及后续主链路页面。

这意味着本需求的核心不是“补一个后台设置项”，而是补齐**用户级模型配置 + 登录门禁**的产品闭环。

## 2. 需求冻结结论

| 项 | 结论 |
| ---- | ---- |
| 配置主体 | `AppUser` 登录用户本人 |
| 配置粒度 | 一人一套个人模型配置 |
| 首次登录门禁 | 未配置或未验证通过前，不允许进入系统 |
| 永久入口 | 登录后个人设置中的「模型配置」 |
| 首次登录入口 | 登录成功后自动跳转到同一份「模型配置」页 |
| 当前接口/数据库配置方式 | 保留为运维/迁移兜底，不再作为普通用户主路径 |
| 本轮支持范围 | `online` 模式；V1 仅支持 `DeepSeek` |
| 本轮不做 | `local` 模式、团队共享 Key、管理员代填他人明文 Key、多模型市场化切换 |

## 3. 业务目标与优先级

- **业务目标**：把“登录成功但进系统后才发现不能调用模型”的迟到型失败，前置为“登录后先完成模型初始化”。
- **目标用户**：在线版业务用户、咨询顾问、售前顾问、项目经理等真实使用者。
- **当前阶段归属**：`P0 在线可用闭环`。
- **为什么现在做**：
  - 现有主链路高度依赖大模型，用户未配置个人 Key 时，进入系统后多数关键动作都会失败。
  - 如果允许先进入系统再报错，会直接伤害“结果可信、过程可追踪、系统可用”的第一印象。
  - 相比让管理员或运维手工进库/调接口，用户自助完成初始化更接近正式产品形态。

## 4. 产品方案（V1）

### 4.1 主入口设计

- 登录成功后，前端先读取“当前用户模型配置状态”。
- 若状态为**未配置**或**未验证**，则不进入首页，直接跳转到 `model-config.html`（命名可由 owner 最终裁定）。
- 该页面与“个人设置中的模型配置”共用同一套表单与保存逻辑，避免做两套入口。

### 4.2 门禁规则

以下页面都属于“进入系统”的范围，必须受同一门禁保护：

- `home.html`
- `index.html`
- `report.html`
- 任意依赖登录态后继续进入业务主链路的详情页或深链页面

规则冻结为：

1. 用户登录成功。
2. 立即检查“当前用户是否已配置并验证自己的模型 Key”。
3. 若否，则强制跳转到模型配置页。
4. 只有保存并验证成功后，才允许跳转回原目标页或默认首页。

**不提供“跳过后再说”**，否则门禁就会失效。

### 4.3 配置页应提供的最小内容

- 说明文案：解释该 Key 仅用于当前登录用户自己的模型调用。
- 必填项：`DeepSeek API Key`
- 可选高级项：`API URL`、`Model`
- 主按钮：`保存并验证`
- 次按钮：`退出登录`

页面在首次登录门禁态下，不应再提供进入首页、任务页、管理员页等其它业务导航。

### 4.4 保存后的行为

- 保存时不是只写数据库，还要做一次最小验证。
- 验证成功：标记为已配置并放行进入系统。
- 验证失败：停留在当前页，展示明确错误，不放行。

这样可以避免“用户虽然填了 Key，但其实填错了，结果进系统后才爆雷”。

## 5. 永久入口设计

首次登录之后，用户仍需有一个稳定入口来更新自己的 Key。

V1 建议放在：

- 右上角登录态区域 / 用户菜单
- 菜单项名称：`模型配置`

理由：

- 这是**用户个人资产**，不是管理员公共配置。
- 放在管理员后台会把“用户自己的 Key”误导成“系统统一 Key”。
- 后续若扩展到不同模型或不同账号切换，也更适合收敛到个人设置。

## 6. 数据与接口边界建议

### 6.1 数据层

当前 `AppSetting` 是系统级配置，不适合作为“用户自己的 Key”主存储。

V1 建议新增用户级配置表，例如：

- `UserAiConfig`
  - `id`
  - `userId`（唯一）
  - `provider`（V1 固定为 `deepseek`）
  - `apiKeyCiphertext`
  - `apiUrl`
  - `model`
  - `verifiedAt`
  - `createdAt`
  - `updatedAt`

冻结要求：

- 明文 Key 不回显给其他人。
- 后端持久化时按敏感信息处理，至少做到加密或等价安全存储。
- 管理员不应读取其他用户的明文 Key。

### 6.2 接口层

建议新增“当前用户自己的模型配置”接口，而不是继续复用系统级 `/api/ai/config`：

- `GET /api/me/ai-config/status`
  - 返回当前用户是否已配置、是否已验证、当前 provider/model/apiUrl 摘要
- `PUT /api/me/ai-config`
  - 由当前登录用户提交自己的 Key 与可选模型参数
  - 保存后立即触发最小验证

同时，在线模式下的 AI 调用链路应改为：

- `POST /api/ai/chat` 按**当前登录用户**读取其个人模型配置
- 若当前用户未配置或未验证，返回明确错误码/错误体，作为前端门禁的后端兜底

`/api/ai/config` 与数据库直改方式可保留作运维或迁移兜底，但不再作为用户主流程。

## 7. 分阶段实施建议

### Phase 1：先建立门禁闭环

- 登录成功后检查用户个人模型配置状态
- 未配置则强制跳转模型配置页
- 模型配置页支持 `保存并验证`
- 验证成功后才进入首页

### Phase 2：再补正式永久入口

- 首页右上角或用户菜单增加「模型配置」
- 用户可随时替换自己的 Key、模型、URL
- 替换后立即重新验证

### Phase 3：再考虑增强项

以下不属于本轮最小范围，后续如确有价值再单独立项：

- 多 provider 切换
- 团队共享/组织级 Key
- 使用量统计、额度与费用分摊
- 管理员只看状态不看明文的支持台账

## 8. 对 owner / 前后端的动作建议

- **架构 owner**
  - 将本需求视为“登录链路 + AI 配置链路 + 数据存储边界”的联合改造，不按单纯前端页面处理。
  - 明确用户级配置成为在线模式主源，系统级 `AppSetting` 仅保留兜底策略或迁移策略。
- **前端**
  - 在登录成功后的首跳逻辑中加入用户模型配置状态检查。
  - 新增模型配置页，并把所有业务入口挂到同一门禁规则下。
  - 在正式首页补一个个人配置入口，供后续改 Key 使用。
- **后端**
  - 新增用户级模型配置表与接口。
  - AI 调用按当前登录用户读取配置，不再默认吃全局 `AppSetting`。
  - 对无配置、未验证、验证失败给出可读错误，方便前端留在配置页。

## 9. 验收口径

满足以下条件才算本需求收口：

1. 新用户首次登录，若没有自己的模型 Key，会被拦在模型配置页，无法进入首页。
2. 用户输入错误 Key 后点击“保存并验证”，页面不放行，并展示明确错误。
3. 用户输入正确 Key 并验证通过后，才会跳转进入首页或原始目标页。
4. 同一套部署下，不同用户分别维护自己的 Key，彼此不共享、不串用。
5. 退出登录并换另一个未配置 Key 的用户登录时，会再次命中门禁。
6. 后端 AI 请求实际使用的是当前登录用户自己的 Key，而不是某个全局公共 Key。

## 10. 明确不做

- 不把这个需求降级成“管理员后台里再加一个系统级 DeepSeek 配置卡片”。
- 不继续默认依赖“让运维手工调接口/改数据库”作为普通用户初始化路径。
- 不在本轮把模型配置混进管理员用户维护表格中。

以上三点若不冻结，后续实现很容易再次偏回“系统级统一 Key”方案，与本需求原意不符。

## 11. Owner 任务合同（Task Contract）

### 11.1 影响范围判断

- **影响范围**：`multi(frontend-vue + frontend + backend + docs)`
- **前端影响点**
  - `frontend-vue/src/login/`
  - `frontend-vue/src/api/`
  - 新增 `frontend-vue` 模型配置入口页
  - `frontend/js/auth-runtime.js`
  - `frontend/home.html`、`frontend/index.html`、`frontend/report.html` 的首屏门禁路径
- **后端影响点**
  - Prisma schema / migration
  - 用户级 AI 配置模块
  - `/api/me/ai-config/*`
  - `/api/ai/chat`
  - 现有 `/api/ai/config` 的角色边界
- **文档影响点**
  - `docs/plans/2026-04-07-user-first-login-llm-key-gate.md`
  - `docs/agents/architect/03-active-tasks.md`
  - `docs/agents/business-product/03-active-tasks.md`
  - 对应 FE / BE 台账

### 11.2 冻结的 v1 产品 / 技术边界

- **本轮主目标**：先闭环“用户首次登录必须完成个人模型 Key 配置并验证通过”，再谈体验增强。
- **配置主体冻结**：仅 `AppUser` 本人；不是管理员代填，不是系统公共 Key。
- **模式冻结**：仅 `MODE=online` 生效；`local` 不进入本轮。
- **provider 冻结**：仅 `DeepSeek`。
- **页面门禁冻结**
  - 受门禁保护：`home.html`、`index.html`、`report.html`、以及任何带登录态的业务深链。
  - **不纳入本轮门禁**：`admin.html` 及管理员后台链路。
  - **门禁豁免页**：`login.html`、`model-config.html`。
- **前端门禁定位冻结**
  - 登录成功首跳时先查状态，再决定去业务页还是去 `model-config.html`。
  - 已有 token 的直接访问/刷新/深链进入，仍要由共享门禁脚本再次校验。
  - 前端门禁只做 **UX 预判**，**不能替代后端真相源**。
- **后端真相源冻结**
  - `AppUser` 的个人 AI 配置是 online 业务用户的唯一真相源。
  - `POST /api/ai/chat` 对普通业务用户**不得继续默认吃系统级 `AppSetting`**。
- **页面命名冻结**
  - 首版配置入口文件名按 `model-config.html` 规划。
  - 登录成功后的默认目标页仍为 `home.html`；若存在 `redirect`，则验证通过后返回该目标。

### 11.3 本轮拆批冻结

- **Phase 1 / 必做**
  - 用户级配置数据模型
  - 状态查询 / 保存并验证接口
  - 登录首跳门禁
  - 业务页统一门禁
  - `/api/ai/chat` 用户级配置读取
- **Phase 2 / 紧随其后**
  - 首页或用户菜单中的永久入口「模型配置」
- **本轮不允许**先做 UI 页面但继续让 `/api/ai/chat` 走系统级 Key；这会形成“假门禁”。

## 12. 历史数据 / 兼容策略

- **系统级配置兼容**
  - 现有 `AppSetting` 与 `/api/ai/config` 保留作**运维 / 迁移 / 管理员兜底**。
  - 普通业务用户主链路不再以其为真相源。
- **角色兼容**
  - `AppUser`：进入业务页前必须通过个人 Key 门禁。
  - `AdminUser`：本轮不纳入个人 Key 门禁，避免误伤管理后台。
- **会话兼容**
  - 老用户不是“重新注册才生效”；部署后，已有登录态用户下一次进入受保护业务页时也应命中状态检查。
  - `redirect` 参数保持兼容；门禁通过后应返回原目标页。
- **迁移策略**
  - **不做**将系统级 `AppSetting` 自动回填为各用户个人 Key。
  - **不做**把现有系统级 Key 作为普通用户的默认个人 Key。
- **数据安全策略**
  - 前端表单只负责采集，不在 localStorage / sessionStorage 持久化用户明文 Key。
  - 后端持久化必须按敏感信息处理；本轮默认要求**加密后存库**，不是明文入库。
- **保存 / 验证策略**
  - `PUT /api/me/ai-config` 不是“先保存后慢慢看”；应以“保存并验证”为单次事务语义。
  - 若验证失败，前端留在配置页；后端**不得把该次失败输入标记为已通过门禁**。
- **后端兜底错误码策略**
  - 即使前端门禁遗漏，后端仍需对未配置 / 未验证用户返回可识别错误。
  - 本轮建议冻结为：`HTTP 428` + `code: "AI_CONFIG_REQUIRED"`，供前端统一跳回 `model-config.html`。

## 13. 给前端 agent 的可直接转发指令

- 先读：
  - `/Users/tzknow/Documents/do1/workspace/do1_smart_cto/.cursor/rules/project-core.mdc`
  - `/Users/tzknow/Documents/do1/workspace/do1_smart_cto/docs/agents/frontend/00-core.md`
  - `/Users/tzknow/Documents/do1/workspace/do1_smart_cto/docs/agents/frontend/03-active-tasks.md`
  - `/Users/tzknow/Documents/do1/workspace/do1_smart_cto/frontend-vue/AGENTS.md`
  - `/Users/tzknow/Documents/do1/workspace/do1_smart_cto/docs/plans/2026-04-07-user-first-login-llm-key-gate.md`
- 本轮按 **Phase 1 必做** 实施，不要先做体验优化。
- 交付要求：
  - 在 `frontend-vue` 新增 `model-config.html` 入口页及对应 Vue 页面，承载“保存并验证”表单。
  - `frontend-vue/src/login/LoginPage.vue`：
    - online 登录成功后，不要直接跳 `redirect/home.html`。
    - 先调 `GET /api/me/ai-config/status`。
    - 若未通过门禁，跳 `model-config.html?redirect=...`。
    - 若通过，才进入原目标页。
  - `frontend/js/auth-runtime.js`：
    - 对 `home.html`、`index.html`、`report.html`、业务深链做二次门禁校验。
    - `login.html`、`model-config.html` 不得被自身门禁重定向。
    - `admin.html` 本轮不要纳入此门禁。
  - `frontend-vue/src/api/client.ts`：
    - 新增 `getMyAiConfigStatus()`、`saveMyAiConfig()`。
    - 为后续 `AI_CONFIG_REQUIRED` 预留统一跳转处理，不要各页面散落写分支。
  - `model-config.html` 页面：
    - 字段只做 `DeepSeek API Key` 必填，`API URL` / `Model` 可做高级项。
    - 主按钮固定为“保存并验证”。
    - 次按钮固定为“退出登录”。
    - 首次登录门禁态下，不展示进入业务页的快捷入口。
- 前端实现约束：
  - 不允许把用户明文 Key 存进 localStorage / sessionStorage。
  - 不允许只在 `LoginPage.vue` 做首跳判断，而漏掉深链直开 / 刷新后的业务页门禁。
  - 不允许只加前端跳转，不接后端兜底错误码。
- 回报要求：
  - 明确列出触碰了哪些页面与共享脚本。
  - 区分“登录首跳门禁”和“业务页二次门禁”。
  - 区分“前端 UX 门禁”与“后端兜底门禁”。
  - 若临时不做首页永久入口，必须明确标记为 `Phase 2`，不要伪装成本轮已完成。

## 14. 给后端 agent 的可直接转发指令

- 先读：
  - `/Users/tzknow/Documents/do1/workspace/do1_smart_cto/.cursor/rules/project-core.mdc`
  - `/Users/tzknow/Documents/do1/workspace/do1_smart_cto/docs/agents/backend/00-core.md`
  - `/Users/tzknow/Documents/do1/workspace/do1_smart_cto/docs/agents/backend/03-active-tasks.md`
  - `/Users/tzknow/Documents/do1/workspace/do1_smart_cto/docs/plans/2026-04-07-user-first-login-llm-key-gate.md`
- 本轮按 **Phase 1 必做** 实施，不要顺手扩成多 provider 或组织级配置。
- 交付要求：
  - Prisma 新增用户级配置表，例如 `UserAiConfig`：
    - `id`
    - `userId`（唯一，关联 `AppUser`）
    - `provider`
    - `apiKeyCiphertext`
    - `apiUrl`
    - `model`
    - `verifiedAt`
    - `createdAt`
    - `updatedAt`
  - 新增用户级接口：
    - `GET /api/me/ai-config/status`
    - `PUT /api/me/ai-config`
  - `PUT /api/me/ai-config` 语义冻结为“保存并验证”：
    - 仅当前登录用户可操作自己的配置。
    - 调上游做最小验证。
    - 验证失败时返回明确错误，不得错误放行。
  - 改造 `POST /api/ai/chat`：
    - `role=user` 时按当前登录用户读取其个人已验证配置。
    - 若缺失或未通过验证，返回稳定错误：建议 `HTTP 428` + `code: "AI_CONFIG_REQUIRED"`。
    - 本轮**不得**让普通业务用户继续默认吃系统级 `AppSetting`。
  - `/api/ai/config`：
    - 保留作运维 / 管理员路径；
    - 不再作为 `AppUser` 个人配置主路径；
    - 如当前无角色限制，请补充最小权限收口方案并在回报中说明。
- 后端实现约束：
  - 用户明文 Key 不回显给其它人，也不应以普通接口明文返回。
  - 不要把“验证失败但已入库的无效 Key”标记为已验证。
  - 不要因为这个需求误伤现有 `admin` 管理后台链路。
- 后端回报必须包含：
  - schema / migration 变更点
  - 接口 contract
  - 错误码 contract
  - AI chat 配置解析顺序
  - **build**
  - **重启**
  - **最新实例确认**
  - **真实接口最小复验**

## 15. 验收标准（执行版）

- **门禁验收**
  - 新 `AppUser` 首次登录后，若未配置个人 Key，不能进入 `home.html`、`index.html`、`report.html`。
  - 带 `caseId`、`view=tools` 等深链直接打开时，也会先被导向 `model-config.html`。
  - `admin.html` 不受本轮门禁误伤。
- **配置页验收**
  - 错误 Key：留在配置页，展示明确错误，不放行。
  - 正确 Key：验证成功后进入原目标页；无 `redirect` 时进入 `home.html`。
  - 退出登录：能正确清会话并回登录页。
- **后端真相源验收**
  - 普通业务用户 AI 请求读取的是当前用户自己的配置，不是系统公共 Key。
  - 一个用户配置成功，不代表另一个用户自动通过门禁。
  - 用户 A / 用户 B 的 Key 不串用。
- **兼容验收**
  - 现有管理员后台链路可继续使用。
  - `/api/ai/config` 与系统级配置仍可作为运维/迁移兜底存在，但不干扰 `AppUser` 主链路。
- **发布前复验**
  - 后端涉及接口行为变化，必须完成：
    - `build`
    - 重启
    - 最新实例确认
    - `GET /api/me/ai-config/status` 最小复验
    - `PUT /api/me/ai-config` 错 Key / 正确 Key 复验
    - `POST /api/ai/chat` 在已配置用户 / 未配置用户下的真实最小复验

## 16. 本轮明确不做什么（owner 冻结）

- 不做 `local` 模式个人 Key 门禁。
- 不做多 provider 切换。
- 不做团队共享 / 组织级 Key。
- 不做管理员代填他人明文 Key。
- 不做使用量、计费、额度体系。
- 不做将旧系统级 `AppSetting` 自动迁移成每个用户的默认个人 Key。
- 不做“只在前端跳一下页面”的假门禁。

## 17. 当前 owner 派工结论

- 本需求已达到 **可拆工** 状态。
- 默认拆工顺序：
  1. **backend** 先落用户级配置表、状态接口、保存并验证接口、AI chat 真相源切换。
  2. **frontend** 再接登录首跳门禁、业务页二次门禁、`model-config.html` 页面。
  3. **business-product** 继续只守边界，不再扩需求。
- 只有当后端最小 contract 冻结后，前端再开始接页面；避免前端先做一套假状态。
