# 首页 Vue 迁移 · DOM 对照表（正式入口：`home.html`）

> **命名沿革**：入口与构建产物曾用前缀 `home-vue`，已统一为 **`home`**（`home.html` / `home.js` / `home.css`）。  
> **正式入口（2026-04-06 cutover）**：默认业务首页为 **`frontend/home.html`**；`index.html` 在无 `caseId`、且非 `view=tools` 时首屏 `location.replace` 至 `home.html`。**`?legacyHome=1`（FE-20260406-02）**：不再保留旧首页壳，仅作兼容别名，与默认入口一致落到 **`home.html`**。  
> **文档沿革**：原文件名为 `home-vue-shadow-migration-map.md`，现更名为本路径，内容连续。  
> 真相源：`frontend/home.html`（Vue 构建产物 + `HomePage.vue`）、`frontend/index.html`（详情/知识库壳，**无** legacy `#homeView`）、`frontend/main.js`（详情/导入高亮等；**不再**承载 index 内首页列表渲染）、`frontend/js/core/problem-follow-shared.js`（案例键与首页高亮 session 键**唯一**实现；`index.html` 在 `main.js`（`defer`）**之前**同步加载该脚本）、`frontend-vue/src/home/problem-follow-home.ts`（首页卡阶段/排序/图标；委托 `SmartCto.problemFollowShared`；**FE-20260406-04A** 取代 `frontend/js/home-follow-card-bridge.js`）、`frontend/styles.css`。  
> Vue 首页实现：`frontend-vue/src/home/HomePage.vue`（挂载 **`#home-app`**；原 `index.html` 内 `#homeView` 区已迁移并对照至本组件模板）。

## 组件拆分冻结（工程层受控 · 禁止语义层重构）

**原则**：允许为可维护性做**工程层受控拆分**，禁止借「组件化」做**语义层重构**或改 UI 真相源。

### 验收前收口（影子页 UI/行为验收通过之前）

以下规则**持续有效**，直至影子页 **UI/行为验收通过**：

1. **`HomePage.vue` 继续作为整页主实现**：模板与展示逻辑以本文件为轴，**不主动**再拆 `ProblemFollowCard.vue` 一类**展示子组件**。
2. **允许继续抽离的仅限**：
   - **bridge / helper**、`caseKey` / **highlight** 相关纯函数；
   - **API** 封装、**import-export** 等与 DOM 无关的调用链；
   - **必要时**的**极薄展示子组件**，且须满足：**最终 DOM 与 legacy 零漂移**（层级、`id`/`class`、按钮顺序、文案、`hidden` 等与下表一致）。
3. **不允许**借「组件化」把首页卡片/列表从 `HomePage.vue` **主动**拆成多个**独立展示组件**（如单独 `ProblemFollowCard.vue`）——除非验收后另有书面变更本段。

### 允许（工程拆分 · 与「验收前收口」一致）

- `HomePage.vue` 作为**整页容器**（根级壳层），**默认保留**列表与卡片 **DOM 于本组件模板内**。
- 将**无展示结构责任**的逻辑拆到**独立 `.ts`**（或仅 re-export 的薄层）：
  - `caseKey` / **高亮** / 与 `problem-follow-home.ts` 对齐的 **helper**；
  - **API**、**导入/导出**流程（调用 `SmartCto.problemCaseApi`、`STORAGE_HTTP_ADAPTER` 等）。
- **极薄展示子组件**（**非默认**、**非** `ProblemFollowCard.vue` 级）：仅当确有必要且 **DOM 零漂移**；模板须与历史 `renderProblemFollowList` / 下表 **DOM 对照表** 字符串级结构可对照（实现已以 `HomePage.vue` 为准）。

### 不允许（语义拆分 / 视觉重设计）

- 按**业务语义**重新设计组件边界（例如「领域模型组件」替代 legacy 区块）。
- 因组件化而改 **DOM 顺序、层级、文案、`class` 命名**。
- 因组件化把 legacy **一个连续视觉块**拆成**多个结构或视觉不一致**的块。
- 先做「更合理的 Vue 版」再回头调 UI（**禁止**；须以 legacy DOM/CSS/行为为唯一对齐目标）。

### 执行顺序（强制）

1. **先**完成与本文件一致的 **DOM 对照表**（或可指向本文件的增量行）。
2. **再**实现影子页，**优先整页在 `HomePage.vue` 内直出**。
3. 若需拆文件或**极薄**子组件，**仅**在 **DOM 零漂移**前提下进行；拆出前后应用同一对照表验收。
4. **回报义务**：见下文「回报模板（每轮必含）」。

### 触碰 `auth-runtime.js` / `main.js` / `src/home/problem-follow-home.ts` 时的回报

若本轮变更触及以下任一文件，回报中须**单列一小节**，区分：

| 类别 | 含义（示例） |
| --- | --- |
| **bridge / fallback** | 仅为影子页复用能力、与主站并行存在、可独立回滚的桥接逻辑 |
| **门禁或兼容所必需** | 影子页与主站**同鉴权级别**、路由/缓存兼容、或无法绕过的契约修正 |

（未触碰则写「未触碰」。）

### 边界再收紧（后端与真相源 · 与「验收前收口」同时有效）

1. **后端字段契约**：在相关方确认 **本轮 no-op** 的前提下，**不得**为首页卡片展示单独申请**后端改字段或改接口**。
2. **「当前任务 / 阶段」文案**：**仅**沿用 **legacy 推导规则**（`main.js` 与 `problem-follow-home.ts` 对齐路径），**不**新增以后端为真相源的展示字段。
3. **正式入口已切换后（FE-20260406-02）**：`index.html` 内 **legacy `#homeView` 壳已删除**；**不主动**做语义层组件化优化（与 `frontend-vue/AGENTS.md` 收口一致）；详情/知识库返回「首页」统一走 **`home.html`**（勿误伤 `view=tools`；`legacyHome=1` 与默认入口一致，不再单独保留旧 DOM）。

### 回报模板（每轮必含）

1. **本轮工程拆分清单**（文件名/职责一行一项；本轮无拆分则写「无」）。
2. **每个拆分是否改变 DOM**（是/否；无拆分则写「不适用」）。
3. **是否触碰** `frontend/js/auth-runtime.js`、`frontend/main.js`、`frontend-vue/src/home/problem-follow-home.ts`（是/否逐项）。
4. **若触碰**：分类标注 **`bridge/fallback`** 与 **`门禁/兼容必需`**（未触碰则写「未触碰」）。
5. **命名调整清单**（若本轮有入口/产物/文档重命名）。
6. **受影响文件列表**。
7. **登录门禁验证结果**、**错误凭证登录验证结果**（见「登录验证补强」）。
8. **固定句（原文照抄）**：**本拆分为工程层拆分，非语义层重构。**

### 验收证据（优先补齐、勿扩散实现面）

在宣称「可验收」前，证据至少应包含（可贴 PR 或本文件增量）：

| 证据项 | 说明 |
| --- | --- |
| **DOM 对照表** | 本文 **「对照表」** 为最新版本（或注明变更行） |
| **UI 差异清单** | 见下文 **「UI 差异清单」** |
| **行为差异清单** | 见下文 **「行为差异清单」** |
| **`npm run build`** | 在 `frontend-vue/` 执行，**通过**（附命令输出摘要或 CI 链接） |
| **`home.html` 登录门禁** | 与 `index.html` 同级：`auth-runtime.js` 首屏无 token → `login.html?redirect=...` |
| **最小复验** | 创建 / 删除 / 复制 / 导入 / 详情 / 售前分析报告 — 见下文 **「最小复验矩阵」**；**验收以真实浏览器人工联调为准**（不依赖仓库内自动化 smoke 脚本） |

### 登录验证补强（B）

#### B.1 未登录 / 登录失效 / 401

| 目标 | 实现要点 |
| --- | --- |
| 无 token 访问影子页 | `auth-runtime.js`：`pathname` 以 **`home.html`** 结尾且非登录/管理页、无 token → `login.html?redirect=当前路径&auth_reason=gate` |
| 401 | `handleAuthError(401)`：清 token、可选 `clearProblemCaseCachesAndUiStateOnLogout`、跳转 `login.html?redirect=...&auth_reason=auth` |

**建议人工验证**：① 清除 `localStorage` 中 `smart_cto_auth_token`（及同套件键）后直接打开 `home.html`，应重定向至登录页且 `redirect` 含 `home.html`。② online 下触发受保护请求返回 401（若环境可稳定复现），应清理会话并回登录页。

#### B.2 登录页错误凭证（与「未登录 / 失效」区分）

| 模式 | 行为 |
| --- | --- |
| **online** | `frontend-vue/src/login/LoginPage.vue`：`backendApi.login` 抛错时写入 `error`，**不** `location.replace`，停留在登录页 |
| **local** | 当前实现为任意非空账号密码即本地 `signIn` 成功（联调约定），**无**「错误密码」分支；验证错误凭证须在 **online** 对真实后端账号进行 |

**建议人工验证**：online 下在 `login.html` 输入**错误**账号/密码，应仍停留在登录页并展示错误文案，**不应**进入 `home.html`。未登录跳转与错误凭证两条均做，避免口径混为「登录失败」。

---

## UI 差异清单（影子页 vs legacy 同区）

| 维度 | legacy（`index.html` + `main.js`） | 影子页（`HomePage.vue`） |
| --- | --- | --- |
| 壳层 | 单页内多 view，首页为 `#homeView` | 独立 `home.html`，仅含首页区 + 顶栏；无 `problemDetailView` 等 |
| 解析预览 | 在线解析成功时可填 `#parsePreviewContent` 并展示 | `#parsePreview` 结构保留，默认 hidden，**不**跑解析填充 |
| 样式 | `styles.css` | 同源 `styles.css` + `vue-auth-assets/home.css`（Vue 范围） |

## 行为差异清单（影子页 vs legacy 同源操作）

| 操作 | legacy 主要路径 | 影子页路径 | 备注 |
| --- | --- | --- | --- |
| 创建 | `handleParseClick` → `saveDigitalProblem` 等 | `onParseClick` → `saveDigitalProblem` + 刷新列表 | 不跑工商解析预览链 |
| 删除 | 列表委托 → `removeDigitalProblem` | 同 | `confirm` 文案对齐 |
| 复制 | 列表委托，合并聊天与 task 追踪 | `HomePage.vue` 内同逻辑 | 依赖全局 API |
| 导入 | online：`postProblemCaseImport` → 详情 | 同 | local 禁用按钮 |
| 详情 | `index.html?caseId=` | **同**（Vue 首页「详情」入口） | |
| 售前分析报告 | `report.html?caseId=` 新标签页 | **同** | online 校验 |
| 当前任务文案 | `getProblemFollowCardStageLabel` 等 | `problem-follow-home.ts` | **无后端专属字段** |

## 最小复验矩阵（人工或脚本）

| 用例 | 预期 | 验证方式（示例） |
| --- | --- | --- |
| 登录门禁 | 无 token 打开 `home.html` → 跳转登录 | 浏览器隐身窗口 / 清 token |
| 创建 | 输入企业名 →「开始」→ 列表出现新卡 | 手工 |
| 删除 | 删除 → 列表减少、`removeDigitalProblem` | 手工 |
| 复制 | 复制 → 新卡 + 聊天可选复制 | 手工 |
| 导入 | online 选 JSON → 成功提示 → 跳转详情 | 手工（需后端） |
| 详情 | 点击「详情」→ `index.html?caseId=` | 手工 |
| 售前分析报告 | 点击 → `report.html` 新标签 | 手工（online) |

---

## 对照表

| legacy DOM 位置 | legacy `id` / `class`（要点） | Vue 模板位置 | 完全复刻 | 差异说明 |
| --- | --- | --- | --- | --- |
| `index.html` L21 | `#homeView.view.home-intake-view` | `HomePage.vue` `<div id="homeView" class="view home-intake-view">` | 是 | 影子页外层为 `.app` + `nav`，与 legacy 单页内「仅 home 区」等价；未包含 `#taskTrackingView` 等同页其它 view（按范围冻结不做） |
| `index.html` L29 | `#digitalProblemInput.home-intake-input` | 同 id/class 的 `<textarea>` | 是 | `v-model` 绑定；行为走 `saveDigitalProblem`，非 legacy 的解析 LLM 预览链（见 `#parsePreview`） |
| `index.html` L31 | `#btnParse.btn-parse` | 同 id/class | 是 | 加载文案与 `main.js` L5414 一致为「创建中…」；影子页不跑 `handleParseClick` 内解析预览填充 |
| `index.html` L35–39 | `#parsePreview.parse-preview`、`#parsePreviewContent.parse-preview-grid` | 同 id；`dl` 保留空 | 结构是 | `#parsePreview` 默认 `hidden`；影子页首版不向 `parsePreviewContent` 写入解析字段（legacy 在线解析成功才展示） |
| `index.html` L43 | `#problemFollowCount.problem-follow-count` | 同 id/class，文本由「共有 N 个客户档案」计算 | 是 | 计数同源 `getDigitalProblems().length` |
| `index.html` L48 | `#problemFollowListContent.problem-follow-list` | 同 id/class | 是 | 列表由 Vue `v-for` 渲染；排序/阶段标签经 `problem-follow-home.ts` 对齐 main 规则 |
| 卡片内 | `.problem-follow-card`、`.problem-follow-card-accent`、`.problem-follow-card-body`、`.problem-follow-card-archive-no`、`.problem-follow-card-title`、`.problem-follow-card-requirement-title`、`.problem-follow-card-task-row`、`.problem-follow-card-task-badge`、`.problem-follow-card-task-text`、`.problem-follow-card-date`、`.problem-follow-card-actions` | 同名 class 逐项保留 | 是 | 斑马纹用 `.problem-follow-card-accent-a` / `-b`；高亮类 `.problem-follow-card-highlight` |
| 操作区 | `.btn-problem-follow-start`「详情」、`.btn-problem-follow-copy`、`.btn-problem-follow-delete`、`.btn-problem-follow-presales-report`「售前分析报告」 | 同名 class + 文案 | 是 | 「详情」→ `index.html?caseId=`；顶栏「知识库」→ `index.html?view=tools`；售前报告 → `report.html?caseId=` 新标签页（online） |
| 工具栏 | `#btnProblemCaseImport`、`#problemCaseImportInput` | 同 id | 是 | 导入走 `SmartCto.problemCaseApi` + `STORAGE_HTTP_ADAPTER`；local 模式按钮 disabled + 提示 |

## UI / 行为差异摘要

- **UI**：顶栏 `#topNav` 与 legacy 一致；影子页不加载 `main.js`，故无 `problemDetailView` 等节点。
- **行为**：「开始」仅创建空需求档案并刷新列表（与 `handleParseClick` 在「无解析扩展」路径一致意图）；不执行 legacy 的工商解析填充 `#parsePreviewContent`。
- **列表与异步回填**：须与 legacy 一致监听 **`storageBackendReady`**（online，`storage-http-adapter.js` 在 `init` 完成后派发）与 **`storageIndexedDbReady`**（local+IndexedDB），在事件后再次 `loadList()`；仅 `onMounted` + `problemCasesChanged` 不足以覆盖首屏早于异步回填的读取（见 `main.js` 约 L1907、L1933）。
- **Vue 与 online 缓存引用**：`getDigitalProblems()` 在 online 下返回的 `problemCasesCache` 会被 `saveDigitalProblem`/`removeDigitalProblem` **原地**修改；`loadList()` 必须生成**新数组与项浅拷贝**，不可把缓存数组引用直接赋给 `ref`，否则「开始」创建/删除/复制后界面可能不更新（与接口是否成功无关）。
- **鉴权**：`home.html` 与 `index.html` 相同首屏门禁（`auth-runtime.js`）。
- **构建**：`frontend-vue/home.html` 中静态链使用 `../frontend/...` 以便 Vite 解析；`js/core/problem-case-api.js` 由 `src/home/main.ts` **import** 打入 `vue-auth-assets/home.js`，避免 HTML 外链在构建时被丢弃。
- **入口文件名**：正式产物为 **`home.html`**（非 `home.htm`）；错拼或旧链接会导致加载异常或缓存旧脚本。

**触发器**：变更 legacy 首页 DOM、卡片规则、**边界再收紧**条款、验收证据或首页影子页**工程拆分**策略时，同步本表与 `frontend-vue/AGENTS.md`。
