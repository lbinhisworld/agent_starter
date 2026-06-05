## 任务4：价值流绘制模块（`js/task4ValueStream.js`）

> 最近更新：2026-04-03。Session 为 **两主环节**：Mirror → **分阶段架构加固**（按 `valueStream.stages` 动态生成 `subSteps`）。系统提示：`VALUE_STREAM_PROMPT_MIRROR`、`VALUE_STREAM_PROMPT_STAGE_HARDENING`（`main.js`）。**Mirror**：用户消息由 `buildMirrorStageUserContent` 注入初步需求 **`roadmap.phase1_Critical`（最紧急/第一阶段）** JSON；系统提示含 **§1.1** 硬约束，要求 `focus` / `deliverables` 在输出阶段与环节中可追踪。整图 `VALUE_STREAM_PROMPT_HARDENING` 与合成 `VALUE_STREAM_PROMPT_SYNTHESIS` **仅空串占位**，产品稿已下线。完工门槛：`task4ValueStreamIsFinalForCompletion` 认 **`hardening_final`** 或历史 **`synthesis_final`**。设计总览见 `frontend/数字化问题跟进阶段设计.md` §1 / §5.4、用户向说明见 `docs/00-用户操作手册与商业化分析.md` §7.4。

**模块职责**

- **主流程（Session）**：`valueStreamDrawSessionsBlock` 对应 `getDefaultValueStreamDrawSessions()`：**忠实还原** + **分阶段架构加固与集成**（`subSteps` 在 Mirror 完成后按各 `stage.name` 生成「加固：…」子行）。**FE-20260411**：Mirror 完成后须用**全新** `subSteps`（`done` 全为 false），不得继承上一轮加固进度；否则修改提示词重跑 Mirror 后仍会跳过已完成阶段，过程日志里只剩最后一阶段 LLM。`runValueStreamDrawSessionsAutoSequential`：Mirror → 对每个未完成的 `subStep` 调用 `generateValueStreamFromInputs(..., 'per_stage_hardening')`，就地合并 `workingVsm.stages[i]`；每段推送 `valueStreamCard`（末段为 `hardening_final`，中途为 `hardening_stage_progress`）+ `task4LlmQueryBlock`（`noteName`：`分阶段架构加固：{阶段名}`）。默认 `chatOpts.timeoutMs: 300000`。
- **Mirror user**：`buildMirrorStageUserContent` — 核心流程梳理、组织模式、BMC 价值主张、深层动机；**§5** `pickPhase1CriticalForMirror(item)` → `roadmap.phase1_Critical` JSON（无 V2 或缺 roadmap 时为 `{}`）。
- **分阶段 user**：`buildPerStageHardeningUserContent` — §1 目标阶段名 + Original 节点 JSON；§2 `legacySystems`、`painPointRadar`（IT Gap）、`causal_relation`。
- **引导块路径**：`runValueStreamPhaseHardening` 对整图 **for** 各 stage 串行加固，汇总一条 LLM-查询块 + 一张终稿卡（`skipWorkspaceUpdate` 时仍写 `valueStreamHardeningDraft`）。
- **`runValueStreamPhaseSynthesis`**：仅占位提示「已取消独立合成」，不再调大模型。
- **修改链路**：`runTask4ModificationTwoPhaseRegenerate` — Mirror 后按阶段循环加固，返回合并后的 `finalValueStream`。
- **解析**：`parseSingleStageHardeningLlmContent` 期望单个 `{ stage_name, nodes }`（或单元素数组）；`mergeHardenedStageIntoWorkingVsm` + `normalizeStageBlock`。
- **持久化**：`valueStreamDrawSessions` 兼容旧版 **3 行** Session（迁移为 2 行 + 清空子任务进度由 Mirror 后重建）。`window.valueStreamDrawSessionsHasUnfinished` 用于 Session 卡「全部已完成」按钮态。

---

### 系统提示词（`main.js`）

| 常量 | 说明 |
|------|------|
| `VALUE_STREAM_PROMPT` / `VALUE_STREAM_PROMPT_MIRROR` | Mirror 阶段（L1/L2 阶段数组协议，略） |
| `VALUE_STREAM_PROMPT_STAGE_HARDENING` | 单阶段加固 + 4-Domain 协议 + 无损集成 + 单对象 JSON 输出 |
| `VALUE_STREAM_PROMPT_HARDENING` / `VALUE_STREAM_PROMPT_SYNTHESIS` | **空字符串**（已废弃，占位） |

---

### 排查：Mirror 成功、某阶段加固超时

- 单次调用仅生成一个阶段 JSON，可对比整图加固的体量；仍可通过 `globalThis.__FE_TASK4_LLM_DEBUG = true` 过滤 `[FE:task4-llm]`。
- 需要时在 `chatOpts` 中调整 `timeoutMs`（与 `api.js` 上限一致）。

---

### 输出格式（分阶段）

单阶段 Strict JSON：

```json
{
  "stage_name": "...",
  "nodes": [
    {
      "node_id": "V_序号",
      "node_name": "...",
      "actor": "...",
      "main_object": "...",
      "type": "Original/Enhanced",
      "gap_resolved": "…或 null",
      "logic_meta": { "constraints": "...", "details": "..." }
    }
  ]
}
```

归一化后工作区仍为 `stages[].steps[]` + `vsmL2`（与 `valueStream.js` 一致）。
