# Folder: e:\03_do1_workspace\do1_smart_cto\frontend-vue

## 地位

Vue 登录页、管理端与统一 API 客户端，与 `frontend` 主站共享同源 `localStorage` 鉴权键。

> **工程定位（2026-06-16 起，2026-06-16 独立化重构）**：本目录 `frontend-vue/` 是**唯一自包含前端工程**（Vue 3 + Vite），不再依赖 sibling `frontend/`。原 `frontend/js/` 的共享资源已全数迁入：被 import 的 legacy JS（`designDetail*SystemPrompt.js`、`task1BusinessInsight.js`、`core/problem-case-api.js` 等 23 个）在 `src/legacy/`；运行时 `<script src>` 加载的（`api.js`、`auth-runtime.js`、`utils.js`、`storage*.js` 等）在 `public/static/`。vite 产物输出到 `dist/`，`npm run build:dist` 再生成发布包 `release/`。原 `frontend/` 目录已废弃（改名 `frontend.bak/` 暂留备份）。

## 职责

1. 登录、个人模型配置与管理员用户管理 UI。
2. **正式首页（Vue）**（`frontend/home.html` → `src/home/HomePage.vue`）：与历史 legacy `#homeView` 区同 id/class 的对照见 `docs/design/home-shadow-migration-map.md`；构建产物与其它入口一并写入 `frontend/vue-auth-assets/`（`home.js` / `home.css`）。默认入口由 `index.html` 重定向至 `home.html`；`?legacyHome=1` 为兼容别名，与默认一致（**FE-20260406-02**：`index.html` 不再内嵌 legacy 首页 DOM）。**FE-20260406-03**：案例键与首页高亮 session 的唯一实现在 `frontend/js/core/problem-follow-shared.js`；`src/home/problem-follow-home.ts` 委托之；`HomePage.vue` 通过 `problem-follow-home` 清高亮（退出登录），不直接写 sessionStorage 键名字面量。**FE-20260406-04A**：首页卡 canonical / 阶段文案等自 `home-follow-card-bridge.js` 迁入 `problem-follow-home.ts`，`home.html` 不再加载该 bridge 脚本。**FE-20260422**：`frontend/tool-experience.html`（`src/tool-experience/`）为「工具经验」独立页，产物 `tool-experience.js` / `tool-experience.css`；列表工具栏入口见 `HomePage.vue`。**FE-20260521**：`frontend/tool-detail.html`（`src/tool-detail/`）为「工具详情」页（布局借鉴设计详情：顶栏工具标题 + 左对话 + 右工作画布），产物 `tool-detail.js` / `tool-detail.css`；首页工具栏最左「工具集」→ `tool-detail.html?tool=工具集`。**FE-20260428**：`frontend/design-detail.html`（`src/design-detail/`）为「设计详情」独立页（左侧任务进展 + 右侧 **动态 Tab 亮色画布**），产物 `design-detail.js` / `design-detail.css`；客户档案卡「设计」入口见 `HomePage.vue`。**FE-20260506**：`frontend/design-llm-log.html`（`src/design-llm-log/`）为案例级 LLM 审计**独立页**（可选书签/直链），产物 `design-llm-log.js` / `design-llm-log.css`；设计详情顶栏「LLM」默认打开 **可拖拽磨砂浮层**（`src/design-detail/DesignDetailLlmLogFloatingPanel.vue`），不整页跳转。
3. `src/api/client.ts` 对受保护请求附带 `Authorization`，并与 `frontend/js/auth-runtime.js` 对齐同 token 会话（不再根据 `X-Auth-Token` / `X-Auth-Expires-At` 覆盖本地 token）；`AI_CONFIG_REQUIRED` 统一回跳 `model-config.html`。

## 约束

- **多页入口 HTML**：`login.html` / `admin.html` / `home.html` / `model-config.html` / `tool-experience.html` / `tool-detail.html` / `design-detail.html` / `design-llm-log.html` 中 Vue 入口须使用 **`./src/<feature>/main.ts`**（相对当前 HTML），勿使用 **`/src/...`**；否则页面 URL 带子路径（如 `/frontend-vue/login.html`）时浏览器会向站点根请求 `/src/...` 导致模块 404 与白屏。
- 鉴权键名须与 `auth-runtime` 一致：`smart_cto_auth_token`、`smart_cto_auth_role`、`smart_cto_auth_expires_at`。
- **共享静态资源 `public/static/`**：`login.html` / `admin.html` 的 `<link>`/`<script>` 用**裸路径 `static/*`**（如 `static/styles.css`、`static/config.js`、`static/config.local.js`、`static/favicon.ico`）引用——dev 下经 Vite `publicDir` 解析、build 下复制到 outDir。这批文件由 `frontend/` 同名源文件**物理拷贝**而来（与 `home.html` 等使用的 `/frontend/*` 中间件挂载是两套并列机制）。注意 `config.local.js` 为本地 gitignored 覆盖配置（仅用于覆盖 `BACKEND_API_URL`；`MODE` 字段已于 2026-06-17 废弃，统一 online，local 模式不再支持），源端 `frontend/config.local.js` 改动需**手动重拷**到 `public/static/`。
- **正式首页（`src/home/`）**：须遵守 `docs/design/home-shadow-migration-map.md` **「组件拆分冻结」**、**「验收前收口」**与 **「边界再收紧」**（后端契约 no-op、阶段文案仅 legacy 推导、不在 `index.html` 复活 legacy 壳/不借组件化做语义重构）。`HomePage.vue` 为整页主实现，**不主动**拆 `ProblemFollowCard.vue` 一类展示子组件；允许继续抽离的**仅限** helper、`caseKey`/highlight、API、import-export 工具，及**必要时** DOM 零漂移的极薄展示子组件。触碰 `frontend/js/auth-runtime.js`、`frontend/main.js` 时，回报须单列 bridge/fallback 与门禁/兼容所必需（**FE-20260406-04A** 起不再使用 `home-follow-card-bridge.js`）。每轮回报须含：**工程拆分清单**、各拆分**是否改 DOM**、**命名调整清单**（若有）、**登录/错误凭证验证结果**、固定句「**本拆分为工程层拆分，非语义层重构**」——详见该文档 **「回报模板」**与 **「验收证据」**。

### 构建产物输出策略（正式协作规则 · `FE-20260326-01`）

本目录执行生产构建时，产物输出到 **`dist/vue-auth-assets/`**（非本目录内堆叠的多套 hash 文件），`npm run build:dist` 再生成发布包 `release/`。

| 项 | 说明 |
| ---- | ---- |
| **输出位置** | `dist/vue-auth-assets/`（vite build），`release/`（build:dist 发布包），供各入口同源引用 |
| **固定文件名** | 构建使用 **固定资源文件名** 覆盖输出，避免历史 hash 文件在目录内累积、难以审阅与合并 |
| **构建前清理** | 构建开始前 **清空** `frontend/vue-auth-assets/`，再写入当前次构建的完整产物集，保证目录与本次源码一一对应 |
| **`version.txt`** | 构建结束后写入版本令牌；入口运行时读取该文件，为脚本/样式 URL 拼接 **`?v=...`**，在固定文件名下仍能通过 query 破浏览器强缓存 |

**多人协作（硬规则）**：若 Git 或其它流程导致 **`dist/vue-auth-assets/` 冲突**，**禁止对产物做手工 merge 或挑文件拼凑**；应 **先合并 `frontend-vue` 源码与配置**，再 **统一重新构建** 一次，以构建生成的整包产物为准并提交。

**节奏**：平时以改 **`src/...`** 为主；**收口 / 发版前** 统一构建并提交 `frontend/vue-auth-assets/`（含 `version.txt`），与主站入口引用保持一致。

**FE-20260616-independent**：`frontend-vue/` 已彻底独立，不再依赖 sibling `frontend/`（已废弃改名）。共享资源分布：被 import 的 legacy JS 在 `src/legacy/`（`design-detail/main.ts`、`home/main.ts` import `../legacy/...`），运行时 `<script>` 加载的在 `public/static/`（各 HTML 用 `static/*` 裸路径，dev 经 publicDir、build 复制到 `dist/static/`）。`vite.config.ts` 已删除 `dev-serve-sibling-frontend` 中间件与 `serve-static` 依赖；`outDir` 为 `dist/`，`emptyOutDir: true`。`src/design-detail/designDetailLegacyScripts.ts` 的 task1 fallback `<script>` 指向 `static/js/task1BusinessInsight.js`。联调请打开 **`http://localhost:6677/home.html`**（或同端口其它入口 HTML）；生产以 **`npm run build`** 后 **`dist/home.html`**（`vue-auth-assets/home.js`）或 `npm run build:dist` 后 `release/` 为准。

## 成员清单

| 文件路径 | 简述 |
| ---- | ---- |
| `src/api/client.ts` | 受保护 JSON 请求、`login()` 与 `requestJson()` 成功响应统一鉴权处理；**FE-20260327**：同 token 会话，不再按续期头覆盖本地 token；**FE-20260324-17**：401 清 token 并跳转；403 调 `handleAuthForbidden`（与 `auth-runtime` 同源去重提示）；**FE-20260408**：新增 `getMyAiConfigStatus()` / `saveMyAiConfig()` 与 `AI_CONFIG_REQUIRED` 统一回跳；**FE-20260506**：`fetchCaseLlmLogs(caseId)` |
| `src/api/AGENTS.md` | `src/api/` 子目录索引：统一 HTTP 客户端、401/403 与 `AI_CONFIG_REQUIRED` 处理口径 |
| `src/stores/auth.ts` | Pinia 鉴权状态：从 localStorage 初始化、登录写入 token/role/username；退出登录清理 `smart_cto_auth_token`/`smart_cto_auth_role`/`smart_cto_auth_username`/`smart_cto_auth_expires_at`，避免跨账号残留 |
| `vite.config.ts` | 构建前将 `../frontend/js/auth-runtime.js` 复制到 `public/js`，并在构建前清理 `../frontend/vue-auth-assets/`；多入口含 `login` / `admin` / **`home`** / **`model-config`** / **`tool-experience`** / **`design-detail`** / **`design-llm-log`**；产物固定命名输出到 `frontend/vue-auth-assets/`（含 `home.js` / `home.css` / `model-config.js` / `model-config.css` / **`tool-experience.js` / `tool-experience.css`** / **`design-detail.js` / `design-detail.css`** / **`design-llm-log.js` / `design-llm-log.css`**），构建后写入 `version.txt`（上述产物哈希参与），并为 **`frontend/design-detail.html`** / **`frontend/design-llm-log.html`** 内 **`./vue-auth-assets/*`** 注入 **`?v=<hash>`** 以防浏览器强缓存旧 bundle；`closeBundle` 将打包后的 `frontend/home.html` 等入口里 **`../frontend/`** 与 **`/frontend/`** 资源引用归一为同目录 `config.js` / `js/*` 口径；`npm run dev` 下用 **`serve-static`** 挂载 **`/frontend`** 到仓库 `frontend/`（含可选 `config.local.js` 空响应）；**`inject-vite-home-guard`** 向 `home.html` 注入 `./vite-home-guard.js`（避免误用静态站打开源码入口时无提示） |
| `public/vite-home-guard.js` | 首页专用：探测 `/frontend/config.js` 404 与 `main.ts` 非 JS MIME，提示使用 `npm run dev` 或 `frontend/home.html`；构建复制到 `frontend/vite-home-guard.js` |
| `public/static/` | `login.html` / `admin.html` 共享静态资源（`styles.css` / `config.js` / `config.local.js` / `favicon.ico`），由 `frontend/` 同名源文件物理拷贝；`config.local.js` 为本地 gitignored 覆盖配置 |
| `model-config.html` | 个人模型配置 HTML 壳（源码在 `frontend-vue/`）：与主站同源 `config.js`、`js/auth-runtime.js`；不展示业务导航，供首次登录门禁与后续手动访问共用 |
| `src/login/AGENTS.md` | `src/login/` 子目录索引：登录表单与 online 首跳门禁口径 |
| `src/model-config/main.ts` | 挂载 `ModelConfigPage` 到 `#app` |
| `src/model-config/ModelConfigPage.vue` | 个人模型配置最小页面：DeepSeek API Key 必填、`API URL` / `Model` 高级项、保存并验证、退出登录；不持久化明文 Key |
| `src/model-config/AGENTS.md` | `src/model-config/` 子目录索引：个人模型配置页的职责与边界 |
| `home.html` | 正式首页 HTML 壳（源码在 `frontend-vue/`）：与主站同源 `config.js`、`js/auth-runtime.js`、存储链与 `js/core/problem-follow-shared.js`，不加载 `main.js`（**FE-20260406-04A**：不再外链 `home-follow-card-bridge.js`；逻辑在 `problem-follow-home.ts`） |
| `tool-experience.html` | 工具经验页壳：同源 `config` / `auth-runtime` / `api.js` / `utils.js`，不加载 `storage.js`；构建产出见 `vue-auth-assets/tool-experience.*` |
| `tool-detail.html` | 工具详情页壳：同源 `config` / `auth-runtime` / `api.js`；布局借鉴设计详情；构建产出见 `vue-auth-assets/tool-detail.*` |
| `src/tool-detail/AGENTS.md` | 工具详情页子目录索引 |
| `design-detail.html` | 设计详情页壳：同源 `config` / `auth-runtime` / `api.js` / **`task1BusinessInsight.js`** / `utils.js` / **`storage-http-adapter` / `storage-indexeddb-adapter` / `storage.js`**（与 `home.html` 对齐，供 bundle、`saveProblemDetailChat` 与设计页工商提炼）；不加载 `main.js`；顶栏 **「LLM」** 为页内浮层 `DesignDetailLlmLogFloatingPanel`（`GET …/llm-logs` 审计列表）；构建产出见 `vue-auth-assets/design-detail.*`（可拆 `shared-problem-case-api.js`） |
| `design-llm-log.html` | LLM 审计页壳：同源 `config` / `auth-runtime`；`GET /problem-cases/:id/llm-logs` 经 `src/api/client.ts`；构建产出 `vue-auth-assets/design-llm-log.*` |
| `src/tool-experience/AGENTS.md` | 工具经验页子目录索引 |
| `src/design-detail/AGENTS.md` | 设计详情页子目录索引；简洁交互模式台账见同目录 `design_mode_promts.md`（提示词）、`design_mode_ux.md`（交互/协议；含推理图 **`tk_`/`ft_`/`lk_`** 摘要）；后端分配器 **`backend/src/modules/problem-cases/design-detail-graph-ids.ts`** |
| `src/home/main.ts` | 挂载 `HomePage` 到 **`#home-app`** |
| `src/home/problem-follow-home.ts` | 首页卡阶段文案、列表排序、图标与时间格式（与 `main.js` canonical 对齐；**FE-20260406-04A**） |
| `src/home/HomePage.vue` | legacy 首页 DOM 复刻（仅 `#homeView` 相关）；详情跳转 `index.html?caseId=`；档案卡「设计」→ `design-detail.html`（**FE-20260428**）。**FE-20260413**：顶栏已移除「知识库」入口。**FE-20260521**：案例列表工具栏最左「工具集」→ `tool-detail.html`。**FE-20260422**：「工具经验」→ `tool-experience.html`。**FE-20260408**：顶栏「模型配置」永久入口，跳同一份 `model-config.html?redirect=...`；须监听 `storageBackendReady` / `storageIndexedDbReady` / `problemCasesChanged` 后 `loadList()`；`loadList()` 须对 `getDigitalProblems()` **新数组 + 项浅拷贝**快照（online 缓存原地 mutate，避免 Vue 不刷新）。**FE-20260407-home**：首页复制案例若本地未命中源聊天缓存，须先调用 `problemCaseApi.refreshProblemDetailBundle(caseId)` 按需补拉消息，避免首页不再全量预拉 message 后复制功能退化。 |

**触发器**: 一旦本文件夹增删文件或鉴权/续期行为调整，请立即重写此文档。
