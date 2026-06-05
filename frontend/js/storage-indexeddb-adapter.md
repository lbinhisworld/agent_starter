# local 模式 IndexedDB 存储适配器（storage-indexeddb-adapter.js）说明

## 1. 定位

`storage-indexeddb-adapter.js` 是 `local` 模式下的数据持久化适配层。  
目标是在不改业务调用方式的前提下，把原本依赖 `localStorage` 的核心数据改为落到 `IndexedDB`。

它通过 IIFE 暴露单一全局对象：

- `window.STORAGE_INDEXEDDB_ADAPTER`

并由 `storage.js` 在 `MODE=local` 时接管同名存储接口（如 `getDigitalProblems`、`saveProblemDetailChat` 等）。

---

## 2. 存储结构

### 2.1 数据库

- `DB_NAME`: `do1_smart_cto_local_db`
- `DB_VERSION`: `1`
- `STORE_NAME`: `kv`

采用单对象仓 `kv`，每条记录结构为：

```json
{ "key": "...", "value": ... }
```

### 2.2 Key 映射

适配器内部将以下业务数据映射到 `kv`：

- `company_analyses`
- `digital_problem_followups`
- `problem_detail_chats`
- `digital_problem_operation_history`
- `digital_problem_task_tracking`

（历史版本曾写入 `tool_knowledge_*` 键；当前主站已下线工具知识库 UI，适配器不再读写这些 key，旧库中残留数据可忽略。）

并额外使用迁移标记：

- `__idb_migrated__`

---

## 3. 初始化与迁移

启动流程：

1. 打开 IndexedDB（若不存在则创建 `kv` 仓）。
2. 从 `localStorage` 读取旧数据进入内存 `cache`（兜底）。
3. 若未迁移（`__idb_migrated__` 不存在），将 `cache` 全量写入 IndexedDB 并打标。
4. 若已迁移，从 IndexedDB 回填 `cache`。

这样可保证首次切换时自动迁移，后续优先使用 IndexedDB 数据。

### 3.1 首屏与 `storageIndexedDbReady`

`init()` 为异步：在 IndexedDB 打开并回填 `cache` 之前，同步接口读到的可能是「已清空 localStorage 后的空数组」。因此适配器在 `init` 的 `finally` 中通过 **`setTimeout(0)`** 向 `window` 派发 **`CustomEvent('storageIndexedDbReady')`**（成功与失败均派发，避免界面永远不重绘）。

`main.js` 应监听该事件并刷新详情聊天等依赖持久化回填的 UI（如 `refreshProblemDetailChatIfOpen`）。

`ready === true` 后会对各 key 再执行一次 `flushKey`，避免 init 完成前已写入 cache、但因 `!ready` 被跳过的落盘。

---

## 4. 读写策略

适配器采用“同步读 + 异步落盘”策略：

- **读**：业务侧从内存 `cache` 同步读取（避免大范围改造为 async）。
- **写**：先更新 `cache`，再异步 `put` 到 IndexedDB。
- **防抖**：同一个 key 正在 flush 时，避免并发重复写。

---

## 5. 对外接口（供 storage.js 代理）

### 5.1 分析与问题单

- `getSavedAnalyses()`
- `saveAnalysis(record)`
- `getDigitalProblems()`
- `saveDigitalProblem(item)`
- `removeDigitalProblem(index)`
- `updateDigitalProblem(createdAt, updates)`
- `saveDigitalProblemsSnapshot(list)`

### 5.2 聊天与历史

- `getProblemDetailChats()`
- `saveProblemDetailChat(createdAt, messages)`
- `getOperationHistory()`
- `saveOperationHistory(all)`
- `getTaskTrackingData()`
- `saveTaskTrackingData(createdAt, data)`
- `saveTaskTrackingSnapshot(all)`：整表替换任务追踪（如「重置为初步需求」时删除某 `createdAt` 对应条目）

---

## 6. 与 storage.js 的关系

`storage.js` 中的模式分流：

- `MODE=online`：走 `STORAGE_HTTP_ADAPTER`
- `MODE=local`：走 `STORAGE_INDEXEDDB_ADAPTER`
- 其他情况：保留原 `localStorage` 实现

因此业务层（main.js / 各 task 模块）继续调用原全局存储函数即可，无需感知底层存储介质变化。

### 6.1 字段级更新与痛点标注（task6）

部分「在默认实现里写 `localStorage`」的函数，在启用适配器时**已在 `storage.js` 内改为**调用 `adapter.updateDigitalProblem(createdAt, updates)` 合并写入，保证与 `getDigitalProblems()` 读到的是同一份 `digitalProblems` 缓存。其中包括 **痛点标注**：`updateDigitalProblemPainPointSessions`、`updateDigitalProblemPainPointStep`（写回 `painPointSessions` 及对应 `valueStream` 环节上的 `painPoint`）。

若遗漏此类改造，会出现「已调用更新函数但列表项仍显示旧 `painPointSessions`」的现象，task6 **自动顺序执行**会误判进度。详见 `docs/task6-pain-point.md` 文首说明。

---

## 7. 风险与限制

- 适配器目前是“内存优先 + 异步落盘”，极端情况下页面异常退出可能丢失最后一次未 flush 写入。
- 多标签页并发写入时，当前实现未做跨标签同步协调，最后写入者生效。
- 当浏览器禁用 IndexedDB 或打开失败时，适配器会退化为仅内存可用（不会抛阻断异常）。

