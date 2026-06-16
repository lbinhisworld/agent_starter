# B2 实施计划：frontend-vue 源码搬进 frontend

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。Steps 用 `- [ ]` 跟踪。

**Goal:** 把 `frontend-vue` 源码搬进 `frontend`，使 `frontend` 成为唯一自包含工程；搬空后删除 `frontend-vue/`。

**Architecture:** B2（frontend-vue → frontend）。frontend 已是构建链中心，路径 `../frontend`→`.` 机械调整。源 HTML 放 `frontend/pages/`（源/产物分离）。详见 `docs/superpowers/specs/2026-06-16-frontend-vue-merge-design.md`（**子 agent 必读该设计文档了解全局改动清单**）。

**分支:** `chore/frontend-vue-merge-into-frontend`（已含 index/report 整合）。

**提交规范:** 每个 Task 末尾精确 `git add` 相关文件 + conventional commit；不 push；不 `git add -A`（工作区有无关改动）；`node_modules`/`vue-auth-assets`/`dist`/`config.local.js` 均不提交。

---

## Task 1: 搬迁文件（frontend-vue → frontend）

**Files:** git mv 搬迁

- [ ] **Step 1：搬 src/**
`git mv frontend-vue/src frontend/src`
- [ ] **Step 2：搬配置**
`git mv frontend-vue/package.json frontend-vue/package-lock.json frontend-vue/tsconfig.json frontend-vue/vite.config.ts frontend/`
- [ ] **Step 3：建 pages/ 搬源 HTML**
```
mkdir frontend/pages
git mv frontend-vue/home.html frontend-vue/login.html frontend-vue/admin.html frontend-vue/model-config.html frontend-vue/tool-experience.html frontend-vue/tool-detail.html frontend-vue/design-detail.html frontend-vue/design-llm-log.html frontend/pages/
```
- [ ] **Step 4：搬 public/（vite-home-guard.js 与根合并去重）**
```
# frontend/public 不存在，直接搬
git mv frontend-vue/public frontend/public
# auth-runtime.js 是 dev 生成产物，移除（避免入库）
git rm --cached frontend/public/js/auth-runtime.js 2>/dev/null; rm -f frontend/public/js/auth-runtime.js
```
（`frontend/public/vite-home-guard.js` 与 `frontend/vite-home-guard.js` 内容一致；保留 public 版供 vite，根版保留供 build-dist。两者都 gitignore 产物策略见 Task 5。）
- [ ] **Step 5：src/vite-env.d.ts**
随 `git mv frontend-vue/src` 已搬入 `frontend/src/vite-env.d.ts`，确认存在。
- [ ] **Step 6：暂不提交**
Task 1–4 改动连贯，统一在 Task 4 末尾提交（避免中间态 build 失败的提交）。

## Task 2: 改 vite.config.ts（路径 + input + normalize + 删 dev 挂载）

**Files:** `frontend/vite.config.ts`（必读设计文档 §4.2）

- [ ] **Step 1：`../frontend` → `.`（约 7 处 path.resolve）**
  - `syncAuthRuntimeToPublic` src：`'../frontend/js/auth-runtime.js'` → `'js/auth-runtime.js'`
  - `cleanFrontendVueAuthAssets`/`writeVueAuthAssetsVersion` assetsDir：`'../frontend/vue-auth-assets'` → `'vue-auth-assets'`
  - `patchHtmlVueAuthAssetsQuery` htmlPath：`'../frontend', htmlRel` → `htmlRel`（即 `path.resolve(__dirname, htmlRel)`）
  - `normalizeBuiltHtmlLocalAssetPaths` targets（5 个 html）：`'../frontend/xxx.html'` → `'xxx.html'`
  - `ensure-design-detail-scenario-script-tag`：`'../frontend/design-detail.html'` → `'design-detail.html'`
- [ ] **Step 2：`server.fs.allow`**
`[path.resolve(__dirname, '..'), path.resolve(__dirname, '../frontend')]` → `[__dirname]`
- [ ] **Step 3：`build.outDir`**
`path.resolve(__dirname, '../frontend')` → `path.resolve(__dirname)`（frontend 根，`emptyOutDir` 保持 false）
- [ ] **Step 4：`build.rollupOptions.input`（8 处）**
`path.resolve(__dirname, 'login.html')` 等 → `path.resolve(__dirname, 'pages/login.html')` 等（全部加 `pages/` 前缀）
- [ ] **Step 5：删 `dev-serve-sibling-frontend` 插件 + `createDevFrontendStack`**
源 HTML 资源改绝对 `/`（Task 3），vite root=frontend 原生 serve，不再需要挂载 sibling。删除 `createDevFrontendStack` 函数定义与 plugins 数组里的 `dev-serve-sibling-frontend` 项。
- [ ] **Step 6：调整 `normalizeBuiltHtmlLocalAssetPaths` 正则**
当前把 `../frontend/xxx` 与 `/frontend/xxx` 归一为 `xxx`。改为把 `/frontend/xxx` 与 `/xxx`（绝对根前缀）归一为 `./xxx`（产物相对）。设计文档 §4.3。
- [ ] **Step 7：更新文件头注释**
`[INPUT]: ../frontend 静态资源...` 等描述更新为"frontend 自包含"。

## Task 3: 改 src import 路径 + 源 HTML 资源前缀

**Files:** `frontend/src/**/*.ts`、`frontend/pages/*.html`

- [ ] **Step 1：src import 路径（约 27 处）**
```
# 全量替换：'../../../frontend/js/ → '../../js/  （src/<page>/ 上两级到 frontend 根）
cd frontend
# 先核对数量
rg -n "'\.\./\.\./\.\./frontend/js/" src
# 替换（用 sed 或逐个 Edit；改后核对无残留）
```
涉及：`src/design-detail/main.ts`（24 处）、`src/home/main.ts`（1 处）、`src/design-detail/designDetailLegacyScripts.ts`（dynamic import + `/frontend/` 检测分支）。改后 `rg "../../../frontend" frontend/src` 应无输出。
- [ ] **Step 2：源 HTML 资源前缀统一为绝对 `/`**
`frontend/pages/*.html` 中：
- `/frontend/styles.css` → `/styles.css`；`/frontend/config.js` → `/config.js`；`/frontend/config.local.js` → `/config.local.js`；`/frontend/js/xxx` → `/js/xxx`（5 个 html）
- login/admin/model-config 的相对引用（`styles.css`、`config.js`、`js/auth-runtime.js`）→ 绝对 `/styles.css`、`/config.js`、`/js/auth-runtime.js`（3 个 html）
改后 `rg "/frontend/" frontend/pages` 应无输出；所有资源引用以 `/` 开头。
- [ ] **Step 3：源 HTML 的 src 入口路径**
`pages/*.html` 的 `<script type="module" src="./src/xxx/main.ts">` 保持不变（pages→frontend→src，相对正确）。确认无需改。

## Task 4: 改 build-dist.mjs + 补 package.json devDeps

**Files:** `frontend/scripts/build-dist.mjs`、`frontend/package.json`

- [ ] **Step 1：build-dist.mjs**
- `frontendVueDir`（L10）→ 删除或 `= frontendDir`
- `frontendVueRequire`（L11）→ `createRequire(path.join(frontendDir, 'package.json'))`
- 错误文案 `"frontend-vue"`（L245、L264）→ `"frontend"`
- [ ] **Step 2：package.json 补 devDependencies**
`build-dist` 用 `@babel/parser`、`@babel/generator`、`lightningcss`、`terser`。确认 `frontend/package.json`（原 frontend-vue 的）devDeps 含这四个；缺则补（版本可参考 frontend-vue/node_modules 实际安装版本，或用 latest）。`terser` 当前应有。
- [ ] **Step 3：frontend/.gitignore 补 node_modules/**
确认根 `.gitignore` 的 `node_modules` 覆盖 frontend 子目录（应已覆盖）；补 `frontend/.gitignore` 加 `node_modules/` 以防万一。
- [ ] **Step 4：提交 Task 1–4**
```
cd /Users/tzknow/Documents/do1/project/agent_starter
git add frontend/src frontend/pages frontend/public frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/vite.config.ts frontend/scripts/build-dist.mjs frontend/.gitignore
git add -u   # 记录 frontend-vue 文件的删除/重命名（git mv 已暂存，此处补漏）
git status   # 核对暂存集只含本任务文件
git commit -m "refactor: move frontend-vue source into frontend (self-contained), pages/ for html source"
```
（核对：暂存集不应含 .codegraph/.mcp.json/docs/superpowers 等无关项；若 `git add -u` 误纳，用 `git restore --staged` 剔除。）

## Task 5: 验证 build（npm install + vite build + build-dist）

**Files:** 无改动（仅验证）

- [ ] **Step 1：npm install**
```
cd frontend
npm install
```
预期：成功（依赖搬入后在此 install）。
- [ ] **Step 2：vite build**
```
npm run build
```
预期：成功，8 页产物写 `frontend/vue-auth-assets/`，根 HTML 为产物版（含 `vue-auth-assets/xxx.js`），`frontend/pages/*.html` 仍为源版（含 `./src/xxx/main.ts`，未被覆盖）。无 UNRESOLVED_IMPORT。
- [ ] **Step 3：build-dist**
```
cd /Users/tzknow/Documents/do1/project/agent_starter
cp frontend/config.local.example.js frontend/config.local.js  # 本地文件，gitignored
node frontend/scripts/build-dist.mjs --no-minify --no-obfuscation
```
预期：成功，`frontend/dist/` 完整、无 index/report。
- [ ] **Step 4：产物 HTML 路径归一核对**
```
grep -E 'src="/|href="/' frontend/*.html | head   # 产物 html 不应有绝对 / 资源引用（应被 normalize 为 ./）
```
预期：无输出（或仅 cdn 外链）。
- [ ] **Step 5：dev 冒烟**
```
cd frontend && npm run dev &
# 等几秒后 curl
curl -s -o /dev/null -w "%{http_code}" http://localhost:6677/pages/home.html   # 预期 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:6677/styles.css         # 预期 200
# 测完 kill dev server
```

## Task 6: 合并 AGENTS.md/README.md + 文档注释更新

**Files:** `frontend/AGENTS.md`、`frontend/README.md`、根 `README.md`/`AGENTS.md`、`frontend/src/**/*.ts` 注释

- [ ] **Step 1：合并 frontend-vue/AGENTS.md → frontend/AGENTS.md**
`frontend-vue/AGENTS.md`（13KB Vue 工程指南）内容并入 `frontend/AGENTS.md`（91KB 主体）末尾；更新"唯一源码工程"为 frontend（src/ 源码、pages/ 源 HTML）。
- [ ] **Step 2：合并 README**
`frontend/README.md` 更新为自包含工程说明（源码在 src/、源 HTML 在 pages/、构建 `npm run build` → vue-auth-assets、`build-dist` → dist）。
- [ ] **Step 3：根 README.md/AGENTS.md 引用更新**
`frontend-vue` 引用 → `frontend`（根 README/AGENTS）。
- [ ] **Step 4：src 注释更新**
`frontend/src/**/*.ts` 注释里的 `frontend-vue/AGENTS.md` → `frontend/AGENTS.md`；`../../../frontend/js/` 相关注释 → `../../js/`。`rg "frontend-vue" frontend/src` 核对。
- [ ] **Step 5：提交**
```
git add frontend/AGENTS.md frontend/README.md README.md AGENTS.md frontend/src
git commit -m "docs: merge frontend-vue docs into frontend after self-contained reorg"
```

## Task 7: 删 frontend-vue + 全量验证

**Files:** 删 `frontend-vue/`

- [ ] **Step 1：确认 frontend-vue 已搬空（只剩 node_modules/可能）**
`ls frontend-vue` 应只剩 `node_modules`（或不剩）。
- [ ] **Step 2：删 frontend-vue**
```
git rm -r frontend-vue --ignore-unmatch   # --ignore-unmatch 容忍 node_modules 未跟踪
```
（若 `node_modules` 未跟踪导致 `git rm -r` 报错，先 `rm -rf frontend-vue/node_modules` 再 `git rm -r frontend-vue`。）
- [ ] **Step 3：全量验证**
- `rg "frontend-vue" . -g '!node_modules' -g '!.git' -g '!docs/superpowers'` → 只剩文档性历史引用（可接受）或无
- `rg "../../../frontend" frontend/src` → 无
- `rg "/frontend/" frontend/pages` → 无
- `cd frontend && npm run build` → 成功
- `node frontend/scripts/build-dist.mjs --no-minify --no-obfuscation` → 成功
- [ ] **Step 4：提交**
```
git add -u   # 记录 frontend-vue 删除（仅删除，不含其他）
git status   # 核对只含 frontend-vue 删除
git commit -m "chore: remove frontend-vue after merging into frontend"
```
- [ ] **Step 5：分支提交历史核对**
`git log --oneline chore/frontend-merge-drop-index-report..HEAD` 报告 B2 提交。

---

## 回滚
- Task 1–4（重组）：`git revert` 对应提交，或 `git checkout chore/frontend-merge-drop-index-report -- frontend-vue frontend`。
- Task 7（删 frontend-vue）：`git revert` 删除提交。
- 各 Task 独立提交，便于定点回滚。
