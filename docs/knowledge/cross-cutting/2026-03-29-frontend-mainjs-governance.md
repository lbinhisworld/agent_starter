# frontend/main.js 拆分治理基线（v10）

## 元数据

- 适用模块：frontend（横切治理）
- 关联任务：`ARCH-20260329-01`、主记录 `docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md`
- 状态：active（与治理方案 `v10` 对齐，不另派生 `v10.x` 文本版本）

## 背景与目标

- `frontend/main.js` 当前约 **18961** 行，已形成难以维护的巨石文件。本轮工作的性质是**结构迁移工程**：把能力按阶段迁出到 `core/`、`legacy/` 等目标位，并配合 compat bridge 回收；**不是**以「代码变漂亮」为目标的泛重构或性能优化。
- **online 主路径零语义漂移**：不改变用户可见的 UI 与操作顺序，不改变消息 `type`/`payload`、不改变 storage key、不改变对外 API 的 path、method 与契约。`local` 模式的废弃与存储/配置层治理单独列为 **Phase 5**，不得与 Phase 1–4 的零漂移拆分混在同一批次里交付。
- 执行与验收的单一事实来源为仓库内主记录文档；本知识卡固化 **v10 冻结口径**，供评审与派工时快速对齐。

## 冻结规则（v10 基线）

以下内容摘自执行计划「§2 冻结规则摘要」，并补充各 Phase 在批次卡片中声明的**允许触碰边界**（`main.js` 仅能通过约定类型改动）。

### 总则

- 本轮统一以治理方案 **`v10`** 为唯一冻结基线，不再派生 `v10.x` 文本版本。
- 本轮是**结构迁移工程**，不是重构优化工程；online 主路径执行零语义漂移，`local` 废弃单独立项。
- `frontend/main.js` 进入**冻结维护态**，仅允许 **`bootstrap + bridge + compat + hotfix`** 类最小补丁，禁止借机堆叠新业务逻辑。

### 堵不如疏（默认可改位，减少「顺手改 main」）

> 仅禁止而不指明替代文件时，执行方会倾向在**仍驻留于 `main.js` 的宿主**（如全量聊天渲染、历史 task 编排）上直接堆逻辑。以下为与主记录 **§2.1** 对齐的**疏导**口径：实现前先选落点；`main.js` 仅在 bridge / 注入 / compat / 极小 hotfix 时首触。

- **task1 初步需求与补充链路**：`preliminaryRequirement.js`、`problem-detail-runtime.js`；`main.js` 只做 `init` 注入或单行桥。
- **聊天模型与持久化辅助**：`problem-detail-chat.js`；不在 `main.js` 扩展大块渲染实现。
- **任务编排与发送管道**：`problem-detail-runtime.js`。
- **详情壳层 DOM / 事件**：`legacy/problem-detail-renderer.js`、`problem-detail-events.js`。
- **已知技术债**：`renderProblemDetailChatFromStorage` 等仍可能在 `main.js`；新需求触及时应**先抽**到 `problem-detail-chat.js` / `problem-detail-runtime.js` 再保留薄包装，并在主记录登记表中留**迁出跟进**而非默认加长 `main.js`。
- **大块 `main.js` 变更的说明义务**：详见主记录 §2.1 末尾 Review 提示。

### 本轮禁止变更（语义与契约）

- UI 与**交互顺序**
- message 的 **`type` / `payload`**
- **storage key**
- API 的 **path / method / 契约**
- 新增 **`MODE === 'local'`** 业务分支
- 新增裸 **`window.xxx = fn`**（compat 双挂须按覆盖表登记并在批次内说明）

### 迁出时序硬约束

- **`renderProblemDetailContent`**：只允许在 **Phase 3B** 迁出；Phase 2B 的 renderer/events 拆分不得提前挪动其宿主。
- **task8 全局 ITGap**：只允许在 **Phase 4A** 迁出到 `core/task8-global-itgap.js` 等目标位；不得与 **task9** 局部 ITGap 混源或合并实现路径。
- **task10 / task11 编排**：只允许在 **Phase 4B** 迁入 companion runtime；Phase 4 禁止继续向 `rolePermission.js` / `coreBusinessObject.js` 堆编排以免形成新巨石。
- **Phase 5（`local` 废弃）** 是独立里程碑，不得混入本轮零漂移拆分任务批次。

### 各 Phase 允许边界（摘自批次卡片与阶段表）

| Phase | 批次（示例） | `main.js` 触碰类型 | 要点 |
| ---- | ---- | ---- | ---- |
| 0 | `FE-20260329-07` | **no** | 主记录、覆盖表、反查表、知识卡与规则落库；**不改业务代码** |
| 1A | `FE-20260329-08` | **bridge** | API 经 `problem-case-api` 收口；禁止改 UI / message / storage / API 契约 |
| 1B | `FE-20260329-09` | **bridge** | `app-state` façade；禁止改状态字段语义、hydration 事件名、storage key |
| 2A | `FE-20260329-10` | **bridge** | `app-dom`；禁止改 selector、壳层 DOM、交互顺序 |
| 2B | `FE-20260329-11` | **bridge** | renderer / events 分离；**禁止** `renderProblemDetailContent` 宿主提前迁出 |
| 3A | `FE-20260329-12` | **bridge** | 依赖图 + `problem-detail-chat`；禁止改消息类型与顺序、聊天块结构 |
| 3B | `FE-20260329-13` | **bridge** | `problem-detail-runtime`；推进与刷新语义不变；迁出后 `main.js` 仅剩外壳 |
| 4A | `FE-20260329-14` | **compat** | task2 / task8 编排回收；禁止 task8 阶段定义漂移、**禁止 task9 混源** |
| 4B | `FE-20260329-15` | **compat** | task10 / task11 companion runtime；禁止再向旧巨石文件堆编排 |
| 5 | 待新建 `ARCH` | 单独治理 | 仅影响 local 用户；存储、配置与 `local-mode-compat` 等**不**在 Phase 1–4 扩张 |

## 阶段拆分一览

摘自执行计划「§3 阶段总览表」（Phase 0–5）：

| Phase | 批次 | 任务编号 | 负责人 | 前置依赖 | 关账条件（摘要） |
| ---- | ---- | ---- | ---- | ---- | ---- |
| 0 | 治理冻结与覆盖盘点 | `FE-20260329-07` | owner + frontend agent | `v10` 定稿 | 主记录；两张防漏表；台账；知识卡与规则；**未开始代码迁移** |
| 1A | `problem-case-api` | `FE-20260329-08` | frontend agent | Phase 0 `closed` | online API、导入/导出/恢复、task action、bundle refresh 经新模块收口 |
| 1B | `app-state` façade | `FE-20260329-09` | frontend agent | Phase 1A `closed` | 新代码经 façade 读状态；不散读详情/聊天/hydration |
| 2A | `app-dom` | `FE-20260329-10` | frontend agent | Phase 1B `closed` | DOM 与壳层 helper 离开 `main.js`，无业务逻辑迁入 |
| 2B | `problem-detail-renderer` / `problem-detail-events` | `FE-20260329-11` | frontend agent | Phase 2A `closed` | renderer 仅 DOM，events 仅绑定；`renderProblemDetailContent` 本阶段不迁出 |
| 3A | 依赖图 + `problem-detail-chat` | `FE-20260329-12` | frontend agent | Phase 2B `closed` | 依赖图补齐；聊天模型与持久化入口迁出 |
| 3B | `problem-detail-runtime` | `FE-20260329-13` | frontend agent | Phase 3A `closed` | `handleProblemDetailChatSend` 与 `renderProblemDetailContent` 宿主迁出 |
| 4A | task2 / task8 编排回收 | `FE-20260329-14` | frontend agent | Phase 3B `closed` | task2 进 companion；`task8-global-itgap.js`；主站与报告页阶段一致 |
| 4B | task10 / task11 编排回收 | `FE-20260329-15` | frontend agent | Phase 4A `closed` | 编排进 companion runtime；巨石不再吸收编排 |
| 5 | `local` 废弃独立里程碑 | 待新建 `ARCH` | owner + frontend agent | Phase 1–4 稳定 | 单独声明；覆盖 local 兼容、存储与配置 |

## 巨石基线行数

| 文件 | 当前行数 | 阈值/说明 |
| ---- | ---- | ---- |
| `frontend/main.js` | 18961 | 冻结维护态；允许 bridge/compat **短期**增长，须在批次卡声明峰值并在后续批次回收 |
| `frontend/js/rolePermission.js` | 1033 | 已接近 1200 评审阈值；Phase 4 默认**禁止**继续吸收编排 |
| `frontend/js/coreBusinessObject.js` | 900 | 未触线；同样只允许 companion runtime 承接编排 |

## 禁止行为清单

对应执行计划 §2「本轮禁止变更」及总则，逐条如下：

1. 变更 UI 与交互顺序。  
2. 变更 message 的 `type` 或 `payload`。  
3. 变更任意 storage key。  
4. 变更 API path、method 或对外契约。  
5. 新增 `MODE === 'local'` 业务分支（local 治理仅限 Phase 5 单独里程碑）。  
6. 新增裸 `window.xxx = fn`（未经覆盖表与 compat 策略登记）。  
7. 在 Phase 3B 之前迁出 `renderProblemDetailContent` 宿主。  
8. 在 Phase 4A 之前迁出 task8 全局 ITGap，或与 task9 局部 ITGap 混源。  
9. 在 Phase 4B 之前将 task10/task11 编排随意迁入错误模块或继续堆向巨石文件。  
10. 将 Phase 5（local 废弃）与 Phase 1–4 拆分批次混交付。

## 验证策略

- **关账证据**：每个批次关闭前必须在主记录 **§7 验收记录**中新增一行，并尽量附上**验收证据**（关键路径截图、或控制台/网络日志节选等），便于审计与回滚判断。
- **回退方式**：  
  - **Phase 0–1**：以**文档回滚**为主（主记录、台账、知识卡、规则与计划一致性）。  
  - **Phase 2 及以后**：**代码回滚**为主，并视情况回退 **compat bridge**（恢复双挂点与旧入口），避免线上或联调环境残留半迁移状态。

## 修订记录

- 2026-03-29：初稿；与 `docs/plans/2026-03-29-frontend-mainjs-splitting-execution-plan.md` v10 基线对齐。
- 2026-03-31：增补「堵不如疏」默认可改位与全量聊天宿主技术债说明；与主记录 §2.1 对齐。
