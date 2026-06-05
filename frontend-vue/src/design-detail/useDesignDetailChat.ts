/**
 * [INPUT]: URL caseId、`SmartCto.problemCaseApi`、`storage` 同源聊天、`designDetailProgressGovernance.ts`、`designDetailLineState`（当前任务持久化）
 * [OUTPUT]: 任务进展标题旁**当前任务**标签；聊天流 **任务动态** 卡片（经营信息提炼灰行 **仅前 3 个顶层字段** +「。。。」摘要，**逐码点** reveal；完整 JSON 仍入 `task1LlmQueryBlock` / `basicInfoCard`；**客户需求提炼**灰行为**单行简报**（有内容的顶层维度计数，**不**预列各分域键行），**完整 JSON** 仍入 `task1LlmQueryBlock`）；**任务进展左栏全量 UI**（动态卡、画布 Tab、工作区快照字段、抑制回放、底部草稿等）经 `DesignDetailProgressWorkspace` / `problemCaseApi` 与消息指纹对齐后 **debounce 落库** 与 **hydrate 后恢复**；**无**左侧独立 JSON 磨砂框；**左侧进度滚动**由 `DesignDetailPage` 监听 `dynamicsCardsView` 滚底；任务 1 绿色引导已完整展示且等待工商输入时，底部输入框 **蓝色光晕** + 占位「请提供客户工商及经营范围信息」；**推导逻辑写库成功后**（`localStorage` 阶段 `awaiting`）绿色「→ 请输入用户需求」+ 同套光晕与占位；用户发送后「→ 正在解析需求」行尾蓝环 → ✓ + 需求 JSON 灰行 + `task1LlmQueryBlock` →「→ 正在渲染需求画布」行尾态 → **需求提炼** 画布 Tab（**追加在横向 Tab 最右侧**；**首次追加**「客户基本信息」/「需求提炼」横向 Tab 时同步 `activeDesignCanvasTabId` 切至该 Tab；自上而下根卡片（`DesignDetailPage`：折叠头内 **序号在「需求提炼」左侧** + `需求提炼 ·` 时间）；子 Tab 对应 JSON 字段；同步时忽略**无实质字段**的空 `llmOutputJson` 块）；需求阶段 **completed** 后 **online** 按分域 **串行** `postDesignDetailSyncCustomerReqSectionGraph`（**业务背景 → 核心业务对象 → 状态转移矩阵 → 痛点雷达 → IT 现状与集成 → 运营模式 → 管理资源**，至管理资源后**不再**同步路线图等）：每域先「正在提炼…逻辑」行尾 **转圈** 至接口成功后 **去掉转圈**，再推送「完成…逻辑提炼」行尾 **✓**，**上一域完成 reveal 后**短停顿再下一域（**不**在开头预列全部分域子任务）；**「重启当前」**以 `currentDesignLineTaskId` **为锚**（**不**调 `problemDetailRestart`）：`pruneDesignDetailPersistedChatForRestartAtLineTask` 修剪同源聊天（仅任务 1 锚点时删三类 `task1LlmQueryBlock` + 尾随未确认 `basicInfoCard`；后续锚点**保留**任务 1 块）；online 删**锚点及之后**推理图与对应 LLM 审计、清空任务进展工作区快照；非任务 1 锚点 **`buildPriorDynamicsPreservingCompletedSteps`** 保留锚点**之前**线步任务动态卡并仅新建当前锚点卡；任务 1 锚点时 **`resetDesignCanvasWorkspace`**，非任务 1 锚点 **`rehydrateDesignCanvasTabsKeepTask1`**（**不**关闭 `designDynamicsSuppressPersistedReplay`）并维持抑制 hydrate 回放动态；写回锚点前 **不**调 `reconcileDesignDetailLineTaskId`；任务 2 锚点且 task1 完成时 **自动** `runTask2L1EntityPortraitPipeline`；`llmStatsIncludeFromMessageIndex` 对齐修剪后消息长度；抑制为真期间 **不**调用 `syncCustomerRequirementCanvasEntriesFromMessages`，直至用户再次发送；提炼成功后画布 Tab 等；聊天写入仍走 `saveProblemDetailChat`；**不**用全案「首个未完成任务」驱动当前任务
 * [POS]: `DesignDetailPage.vue` 对话区数据编排
 *
 * [PROTOCOL]: 变更任务线、任务动态或 task1 门控时须同步 `designDetailTaskMirror.ts`、`designModeTaskPipeline.ts`、`designDetailLineInference.ts`、`design_mode_tasks.md`、`designDetailLineState.ts` 与 `AGENTS.md`；**查证任务 0 卡死（完全重启后停在首两句）**：控制台过滤 **`[design-detail:task0-pipeline]`**（`kickoff_*` / `reveal_ticker_*` / `try_finalize_*` / `finalize_*` / `watchdog_*`）与 **`[design-detail:hydrate]`**（`cycle_skip_restart_busy` / `tryRecover_*` / `apply_snapshot_task0_regression_risk` / `bootstrap_*`）；**查证「完全重启」与 LLM 审计残留**：控制台过滤 **`[design-detail:full-restart]`**（`suppress_replay_early` / 清库 / `persist_*`）；**查证「继续补充 → 是」**：控制台过滤 **`[design-detail:supplement-yes]`**；**查证调试任务间「继续」**：控制台过滤 **`[design-detail:debug-pipeline-continue]`**；**查证任务 2 L1 落库与反向验证边**：控制台过滤 **`[design-detail:task2-l1-sync]`**（`linkCount` / `l1RawHasTokenValidationKey`）；**潜在冲突对齐**：**`[design-detail:task2-l1-alignment]`**（任务 2）、**`[design-detail:task3-l2-alignment]`**（任务 3 L2）；**查证任务 3 L2 落库与反向验证边**：控制台过滤 **`[design-detail:task3-l2-sync]`**；**查证任务 4 L2**：**`[design-detail:task4-l2-sync]`**；**任务 2 L1 同步成功后**按 **`designDetailTask2L1SyncUiProgress.ts`** 推正向/反向链接明细与 **`Token_Validation_Mapping`** 灰块，并递增 **`logicTreeGraphRefreshTick`** 驱动 **`DesignDetailLogicTreeModal`** 再拉 **`GET …/task-graph`**；**任务 3 L2 落库成功后**同理推 **任务 3 正向归纳**、**`Token_Validation_Mapping`（L2）**、**反向验证（含任务 2+3）** 与 **`logicTreeGraphRefreshTick`**；**任务 4 L2 落库成功后**推 **任务 4 正向归纳**、**`Token_Validation_Mapping`（价值链）**、**反向验证（含任务 2+3+4）** 与 **`logicTreeGraphRefreshTick`**；后端 **`[problem-case:task2-l1-target-kv]`**（含 **`token_validation_parse`** / **`token_validation_parse_zero`**）与 **`[problem-case:task2-l1-graph]`**；**`[problem-case:task3-l2-target-kv]`** / **`[problem-case:task3-l2-graph]`**；**`[problem-case:task4-l2-target-kv]`** / **`[problem-case:task4-l2-graph]`**；**多轮补充**：`ensureCustomerRequirementAwaitingProgressUi` 在 **`choice_yes_*`** 来源时须 **先剥** 旧「请补充…」「请输入用户需求」绿行再 **追加到底部**，避免与首轮文案相同导致 `some()` 误判、用户只看底部以为无提示；**online**「重启当前」删图：锚点 **`customer_basic`** 时 `buildTaskGraphDeleteTaskIdsForRestartAnchor` **须含** `customer_requirement`，避免任务 1 重启遗留需求分域 token；非任务 1 锚点只删锚点及之后线步；`applyDesignDetailProgressWorkspaceSnapshot` 合并 **`task1CustomerRequirementPhase`** 时：若 `localStorage` 已为 **`awaiting`**，快照为 `completed`/`idle`/**`paused`** 均**保留 awaiting**；若为 **`paused`** 而快照为 `completed`/`idle` 则**保留 paused**（防「继续补充 → 是」后旧快照把阶段写回 `paused`，`ensureCustomerRequirementAwaitingProgressUi` 不执行、进度区仍卡「是/否」）；hydrate 在 tryRecover 后若阶段为 `awaiting` 调用 `ensureCustomerRequirementAwaitingProgressUi` 补绿字引导；`tryRecoverDesignDetailProgressWorkspace` 应用快照后若 `llmStatsIncludeFromMessageIndex` 大于消息条数则归零，与 `designDetailLlmStats.clampLlmStatsIncludeFromIndex` 一致防大模型统计漏计工商等块；每次 hydrate 在 tryRecover 后调用 `sanitizeLlmStatsIncludeFromIndex`，避免快照中的统计起点把**仍存在于聊天**的早期 `task1LlmQueryBlock` 整段排除（需求提炼后工商统计空窗）；**多轮补充需求**时同文案 `bmc_generating` 行会重复存在，行尾转圈/收尾须用 **`findLastProgressLineIndex`** 对准**当前轮**最后一条，禁止 `lines.find` 误改首轮导致旧行残留转圈；排查「需求解析后顶栏统计里工商行消失」时 grep **`[design-detail:llm-stats]`**：重点 **`hydrate_post_tryRecover_anomaly`**、**`hydrate_llm_stats_sanitized`**、**`tryRecover_apply_snapshot` / `after_apply`**、**`flushPersist_warn_llm_stats_gte_msg_len`**、**`buildDesignDetailLlmStatsFromMessages`**（`designDetailLlmStats.ts`）；**客户需求提炼** `task1LlmQueryBlock` 须带 **`task1RequirementDistillOrdinal`**（与 `task1BusinessInsight.js` / `designDetailLlmStats.ts` 一致），保证统计与画布与全案历史对齐；**每批**需求提炼在管理资源分域同步成功后 **`runIncrementalMergeTotalRequirementAfterDistill`**：`→ 将需求批次#n 合并入总体需求`，再按 **业务背景→分析师备注** 各 Tab 子步骤走 **`mergeRequirementTabSliceAsync`** + `summarizeDesignDetailRequirementMergeByLlm`（`ProblemCaseLlmLog` 同前：**`taskId`**=`任务 1：客户基本情况了解`，**`callTarget`**=`需求#n合并#token`）；完成后 **`appendTask1RequirementSupplementPrompt`**；**「继续补充 → 否」**：任务 1 动态卡淡绿收官、持久化线步至任务 2、新建第二张淡黄卡；**先** `getDesignDetailTaskGraph` + `buildTask2L1InferenceInputFromTaskGraph` 将特征 TSV 推入进度区，**再**调用 **`inferDesignDetailL1EntityPortraitFromContext`**（`task1BusinessInsight.js`，`task2InferenceUserBlock`）；**不再**批量合并；**≥2 条且无** override 时仍可有 **`mergedRequirementBaselinePreview`**（规则预填）；**`withDesignDetailLlmLogContext` 收尾**递增 **`llmLogAuditRefreshTick`**；**「完全重启」**须与 `applyDesignDetailFullSessionResetForCaseId`、`deleteAllDesignDetailTaskGraph`、`postClearCaseLlmLogsAll`、设计线强制 **`customer_basic`** 行为一致并递增 **`llmLogAuditRefreshTick`**；**进度行** `revealRate`/`revealDebt`（任务 2 L1 调试灰块仅在 **`TASK2_L1_PROGRESS_DEBUG_UI_ENABLED`** 为 true 时追加，且 ×1.5 吞吐）须与 **`designDetailProgressWorkspace`** 快照类型/解析一致；**任务 1 动态卡**完成行与角标耗时优先聚合聊天 `task1LlmQueryBlock` 的 `llmMeta.durationMs`（与 LLM 审计浮层一致），`DynamicsCardModel.displayDurationSec` 与 hydrate 修补历史「耗时0秒」
 */

import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import {
  applyTask1StartConfirmToMessages,
  formatChatTimestampForMessage,
  mapFrontendTaskIdToBackendTaskId,
} from './designDetailProgressGovernance';
import {
  advanceDesignDetailLineTask,
  ensureDesignDetailLineRecord,
  loadDesignDetailLineState,
  reconcileDesignDetailLineTaskId,
  repairDesignDetailLineStateForMissingTask65,
  saveDesignDetailLineState,
  type DesignDetailLineTaskId,
} from './designDetailLineState';
import {
  DESIGN_MODE_LINE_TASK_ORDER,
  designLineTaskIndexInOrder,
  designLinePillLabel,
  designLineTaskDisplayName,
  designLineTasksFromStepInclusive,
  pickLaterDesignLineTaskId,
  resolveDesignDetailCurrentLineTaskIdForDisplay,
} from './designModeTaskPipeline';
import { listCompletedDesignLineTasksForSelectRestart } from './designDetailSelectRestartStages';
import {
  buildTaskStartNotificationMessage,
  canDesignPageRunTask1BasicInfoExtract,
  canDesignPageRunTask1CustomerRequirementParse,
  canDesignPageRunTask1ProgressChatInput,
  getProblemDetailChatStorageKey,
  isTask1ActivePreliminaryFollowupPhaseDesign,
  isTaskCompleted,
  mergeResolvedItemForDesign,
  persistChatMessages,
  pruneDesignDetailPersistedChatForRestart,
  pruneDesignDetailPersistedChatForRestartAtLineTask,
  pruneTrailingUnconfirmedBasicInfoForDesignResubmit,
  refreshBundle,
  hasTaskStartNotificationRow,
  shouldPersistTask1StartNotification,
  TASK1_ID,
} from './designDetailTaskMirror';
import { buildDesignDetailChatTimeline } from './designDetailChatTimeline';
import {
  designDetailChatPanelMode,
  setDesignDetailChatPanelMode,
  type DesignDetailChatPanelMode,
} from './designDetailChatPanelMode';
import {
  loadDesignDetailCustomerRequirementPhase,
  saveDesignDetailCustomerRequirementPhase,
  type DesignDetailCustomerRequirementPhase,
} from './designDetailCustomerRequirementPhase';
import { getLatestCustomerRequirementParsed } from './designDetailLineInference';
import {
  buildDesignDetailProgressSnapshotV1,
  buildMessagesFingerprint,
  clearDesignDetailProgressWorkspace,
  countDynamicsSnapshotLines,
  fetchDesignDetailProgressWorkspacePayload,
  fetchRemoteDesignDetailProgressWorkspacePayload,
  messagesFingerprintsEqual,
  mergeDynamicsCardsPreferRicherProgress,
  parseDesignDetailProgressSnapshot,
  persistDesignDetailProgressWorkspacePayload,
  pickProgressWorkspaceRawForHydrate,
  progressSnapshotMatchesMessages,
  readLocalDesignDetailProgressWorkspacePayload,
  type DesignDetailLeftPanelUiSnapshot,
  type DesignDetailProgressSnapshotV1,
} from './designDetailProgressWorkspace';
import {
  DESIGN_DETAIL_LLM_CALL_TARGET_BMC,
  DESIGN_DETAIL_LLM_CALL_TARGET_BUSINESS_EXTRACT,
  DESIGN_DETAIL_LLM_CALL_TARGET_L1_ENTITY_PORTRAIT,
  DESIGN_DETAIL_LLM_CALL_TARGET_L2_CORE_VALUE_DRIVER,
  DESIGN_DETAIL_LLM_CALL_TARGET_L3_MACRO_PROCESS,
  DESIGN_DETAIL_LLM_CALL_TARGET_L3_VSM_STAGE,
  DESIGN_DETAIL_LLM_CALL_TARGET_L3_SCENARIO,
  DESIGN_DETAIL_LLM_CALL_TARGET_L4_COLLABORATION,
  DESIGN_DETAIL_LLM_CALL_TARGET_L4_PROTOTYPE,
  DESIGN_DETAIL_LLM_CALL_TARGET_L5_BLUEPRINT,
  DESIGN_DETAIL_LLM_CALL_TARGET_L5_TECHNICAL_DDL,
  DESIGN_DETAIL_LLM_CALL_TARGET_L2_INDUSTRY_BUSINESS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK2_L1_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK2_L1_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK3_L2_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK3_L2_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK4_L2_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK4_L2_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK5_L3_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK5_L3_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK51_L3_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK51_L3_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK55_L3_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK55_L3_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK6_L3_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK65_L3_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK6_L3_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK7_L4_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK7_L4_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK8_L45_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK8_L45_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK85_L475_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK85_L475_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK9_L5_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK9_L5_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK10_L5_ALIGNMENT_QUESTIONNAIRE,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK10_L5_DEEP_INSIGHT_SYNTHESIS,
  DESIGN_DETAIL_TASK1_LLM_AUDIT_TASK_ID,
  nextRequirementDistillOrdinalForChatAppend,
  readPersistedRequirementDistillOrdinal,
  sanitizeLlmStatsIncludeFromIndex,
} from './designDetailLlmStats';
import {
  deepCloneParsed,
  mergeCorePainPointSummaryFieldAsync,
  mergeRequirementTabSliceAsync,
  REQUIREMENT_MERGE_TAB_KEYS,
  REQUIREMENT_MERGE_TAB_COUNT,
  sanitizeRequirementParsedDeprecatedFields,
  summarizeMergeTwoStrings,
  tokenSurfaceForMergePath,
  type RequirementMergeStringMerger,
} from './designDetailRequirementMerge';
import { countRequirementTabMergeTokenDelta } from './requirementMergeTabTokenStats';
import {
  buildLlmLogTaskIdsForRestart,
  buildTaskGraphDeleteTaskIdsForRestart,
  isDesignDetailInferenceRevisionRestartLineStep,
  lineStepIdsForPainPointResetOnRestart,
  resolveDesignDetailRestartScope,
  resolveRestartAffectedLineSteps,
  resolveRestartWorkspacePruneLineSteps,
} from './designDetailRestartScope';
import { applyDesignDetailFullSessionResetForCaseId } from './problemDetailRestartFromCase';
import {
  buildTask2L1InferenceProgressDebugText,
  buildTask2L1InferenceUserBlock,
  buildTask2PostSyncEvidenceInputDebugLines,
  listTask2L1PainPointRadarInput2FeatureRows,
  truncateTask2L1InferenceBlockForProgress,
  type Task2L1TaskGraphFeatureRow,
} from './buildTask2L1InferenceInputFromTaskGraph';
import {
  buildTask3L2InferenceUserBlock,
  truncateTask3L2DebugProgressText,
} from './buildTask3L2InferenceInputFromTaskGraph';
import {
  buildTask4L2InferenceUserBlock,
  truncateTask4L2DebugProgressText,
} from './buildTask4L2InferenceInputFromTaskGraph';
import {
  buildTask5L3InferenceUserBlock,
  truncateTask5L3DebugProgressText,
} from './buildTask5L3InferenceInputFromTaskGraph';
import {
  buildTask55L3VsmInferenceUserBlock,
  truncateTask55L3DebugProgressText,
} from './buildTask5L5VsmInferenceInputFromTaskGraph';
import { pickTask52FieldSetFeaturesFromGraphTasks } from './buildTask52AssetFieldSetInferenceInputFromTaskGraph';
import { pickTask53WorkflowFeaturesFromGraphTasks } from './buildCurrentStateUnderstandingWorkflowsFromTask53';
import { stripTask6FromGraphTasksForCurrentStateUnderstanding } from './buildCurrentStateUnderstandingScenariosFromTask55And6';
import { truncateTask6L3DebugProgressText } from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import {
  buildTask6PhaseSubtaskProgressEntries,
  findTask6PhaseSubtaskBlockEndIndex,
} from './designDetailTask6PhaseDebugProgress';
import { runTask6L3ScenarioPipeline as runTask6L3ScenarioPipelineCore } from './runTask6L3ScenarioPipeline';
import { runTask65ItGapPipeline as runTask65ItGapPipelineCore } from './runTask65ItGapPipeline';
import { runTask7L4CollaborationPipeline as runTask7L4CollaborationPipelineCore } from './runTask7L4CollaborationPipeline';
import {
  parseDiagnosticReviewStepCardFromTask65Raw,
  parseDiagnosticReviewStepsSnapshot,
  upsertDiagnosticReviewStepCard,
  type DiagnosticReviewStepCard,
} from './buildDiagnosticReviewFromTask65ItGap';
import type { Task65ItGapSubtask } from './buildTask65ItGapInferenceInputFromTaskGraph';
import { truncateTask65ItGapDebugProgressText } from './buildTask65ItGapInferenceInputFromTaskGraph';
import {
  pickTask6ScenarioFeaturesFromGraphTasks,
  truncateTask7L4DebugProgressText,
} from './buildTask7L4CollaborationInferenceInputFromTaskGraph';
import {
  buildTask8L45PrototypeInferenceUserBlock,
  pickTask1FeaturesFromGraphTasksForTask8,
  pickTask1Through4FeaturesFromGraphTasks,
  pickTask7L4CollaborationFeaturesFromGraphTasks,
  truncateTask8L45DebugProgressText,
} from './buildTask8L45PrototypeInferenceInputFromTaskGraph';
import {
  buildToolSuitePrimitiveGraphFeatures,
  hydrateToolSuiteKnowledgeForDesign,
  logDesignDetailTask0Pipeline,
  logDesignDetailTask0Sync,
  syncToolSuitePrimitivesToDesignGraph,
  verifyTask0GraphAfterSync,
} from './designDetailToolSuitePrimitiveSource';
import {
  buildTask9L5BlueprintInferenceUserBlock,
  pickTask1FeaturesFromGraphTasksForTask9,
  pickTask8L45PrototypeDetailFeaturesFromGraphTasks,
  truncateTask9L5DebugProgressText,
} from './buildTask9L5BlueprintInferenceInputFromTaskGraph';
import { runTask9L5BlueprintPipelineImpl } from './runTask9L5BlueprintPipeline';
import { runTask10L5TechnicalDdlPipelineImpl } from './runTask10L5TechnicalDdlPipeline';
import { truncateTask10L5DebugProgressText } from './buildTask10L5TechnicalDdlInferenceInputFromTaskGraph';
import {
  buildTask10ArchGateDiagnostic,
  logTask10ArchGate,
} from './designDetailTask10ArchGateDebugLog';
import { ARCHITECTURE_INVENTORY_TAB_ID } from './architectureInventoryCanvas';
import { TASK10_ARCH_INVENTORY_START_LINE } from './runTask10DataArchitecturePipeline';
import { runDesignReportGenerationPipelineImpl } from './runDesignReportGenerationPipeline';
import type { DesignReportProgressLineOpts } from './runDesignReportGenerationPipeline';
import { runDesignReportHybridEngine } from './runDesignReportHybridEngine';
import { clearDesignReportNarrativeCache } from './runDesignReportHybridEngine';
import { shouldClearDesignReportNarrativeOnRestart } from './designDetailRestartDesignReport';
import {
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER1_PAIN,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER2_DIAGNOSIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER3_SOLUTION,
  DESIGN_DETAIL_TASK11_LLM_AUDIT_TASK_ID,
} from './designDetailLlmStats';
import { runTask11AnalysisReportPipelineImpl } from './runTask11AnalysisReportPipeline';
import { TASK11_ANALYSIS_REPORT_DONE_LINE } from './postTask10DeliverablesCanvas';
import { runTask12FlowchartPipelineImpl } from './runTask12FlowchartPipeline';
import { runTask13FunctionInventoryPipelineImpl } from './runTask13FunctionInventoryPipeline';
import {
  DEBUG_CONTINUE_TO_TASK_11_PROMPT,
  DEBUG_CONTINUE_TO_TASK_12_PROMPT,
  DEBUG_CONTINUE_TO_TASK_13_PROMPT,
  TASK11_ANALYSIS_REPORT_START_LINE,
  TASK12_FLOWCHART_START_LINE,
  TASK13_FUNCTION_INVENTORY_START_LINE,
  TASK10_ARCH_INVENTORY_LEGACY_LINE,
} from './postTask10DeliverablesCanvas';
import { runTask85PhysicalHookPipeline } from './runTask85PhysicalHookPipeline';
import { runTask51ValuePropositionPipeline } from './runTask51ValuePropositionPipeline';
import { runTask52AssetFieldSetPipeline } from './runTask52AssetFieldSetPipeline';
import {
  migrateTask52ProgressLineFull,
  task52ProgressIndicatesPipelineKickoff,
} from './designDetailTask52ProgressLineMigrate';
import {
  migrateTask53ProgressLineFull,
  task53ProgressIndicatesPipelineKickoff,
} from './designDetailTask53ProgressLineMigrate';
import {
  buildTask52TableSubtaskProgressEntries,
  findTask52TableSubtaskBlockEndIndex,
} from './designDetailTask52TableDebugProgress';
import {
  buildTask53ProcessForwardLinkDebugProgressEntries,
  buildTask53ProcessSubtaskProgressEntries,
  findTask53ProcessSubtaskBlockEndIndex,
} from './designDetailTask53ProcessDebugProgress';
import {
  buildTask65ItGapSubtaskProgressEntries,
  findTask65ItGapSubtaskBlockEndIndex,
} from './designDetailTask65ItGapDebugProgress';
import {
  buildTask7L4SubtaskProgressEntries,
  findTask7L4SubtaskBlockEndIndex,
} from './designDetailTask7L4DebugProgress';
import { buildTask65ItGapAlignmentQuestionnaireUserBlock } from './designDetailAlignmentQuestionnaireInput';
import {
  appendTask65L3DeepInsightSection,
  clearTask65L3DeepInsightText,
} from './designDetailTask65L3DeepInsight';
import {
  clearTask65PipelineResume,
  readTask65PipelineResume,
  type Task65PipelineResumeState,
  writeTask65PipelineResume,
} from './designDetailTask65PipelineResume';

function migrateTask52LinesInDynamicsCards(cards: DynamicsCardModel[]): DynamicsCardModel[] {
  return cards.map((c) => {
    if (c.lineTaskId !== 'capability_field_set_mapping') return c;
    const lines = c.lines
      .map((r) => ({ ...r, full: migrateTask52ProgressLineFull(r.full) }))
      .filter((r) => String(r.full ?? '').trim().length > 0);
    return { ...c, lines };
  });
}

function migrateTask53LinesInDynamicsCards(cards: DynamicsCardModel[]): DynamicsCardModel[] {
  return cards.map((c) => {
    if (c.lineTaskId !== 'key_scenario_temporal_flow_inference') return c;
    const lines = c.lines
      .map((r) => ({ ...r, full: migrateTask53ProgressLineFull(r.full) }))
      .filter((r) => String(r.full ?? '').trim().length > 0);
    return { ...c, lines };
  });
}

function migrateDesignDetailProgressLinesInDynamicsCards(
  cards: DynamicsCardModel[],
): DynamicsCardModel[] {
  return migrateTask53LinesInDynamicsCards(migrateTask52LinesInDynamicsCards(cards));
}
import { runTask53WorkflowFlowPipeline } from './runTask53WorkflowFlowPipeline';
import { truncateTask51L3DebugProgressText } from './buildTask51ValuePropositionInferenceInputFromTaskGraph';
import { truncateTask85L475DebugProgressText } from './buildTask85PhysicalHookInferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK55_LINE_TASK_ID,
  DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK6_LINE_TASK_ID,
  DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK7_LINE_TASK_ID,
  normLogicTaskId,
  type DesignDetailLogicGraphTaskDto,
} from './designDetailLogicGraphMerge';
import {
  ALIGNMENT_CHANGES_APPLIED_LINE,
  ALIGNMENT_FEEDBACK_RECEIVED_LINE,
  formatAlignmentUserFeedbackProgressText,
  ALIGNMENT_NO_STRUCTURAL_CHANGES_LINE,
  buildAlignmentFeatureSnapshotForLineTask,
  buildAlignmentInferenceDiffItems,
  type AlignmentDynamicsLineTaskId,
  type AlignmentFeatureSnapshot,
} from './designDetailAlignmentInferenceDiff';
import {
  buildForwardInductionLinkUiLines,
  buildForwardInductionLinkUiLinesTask3,
  buildForwardInductionLinkUiLinesTask4,
  buildForwardInductionLinkUiLinesTask5,
  buildForwardInductionLinkUiLinesTask55,
  buildForwardInductionLinkUiLinesTask6,
  buildForwardInductionLinkUiLinesTask7,
  buildReverseValidationLinkUiLines,
  extractTask5L3TokenValidationMappingProgressSnippet,
  extractTask6L3TokenValidationMappingProgressSnippet,
  extractTask7L4TokenValidationMappingProgressSnippet,
  normalizeL3ProcessInferenceRawForServerSync,
  normalizeL3Vsm55InferenceRawForServerSync,
  normalizeL4CollaborationInferenceRawForServerSync,
  normalizeL4PrototypeInferenceRawForServerSync,
  normalizeL5BlueprintInferenceRawForServerSync,
  buildForwardInductionLinkUiLinesTask8,
  buildTask2L1ConflictDatasetUserBlock,
  buildTask3L2ConflictDatasetUserBlock,
  buildTask4L2ConflictDatasetUserBlock,
  buildTask5L3ConflictDatasetUserBlock,
  buildTask55L3ConflictDatasetUserBlock,
  buildTask6L3ConflictDatasetUserBlock,
  buildTask65L3ConflictDatasetUserBlock,
  buildTask7L4ConflictDatasetUserBlock,
  buildTask8L45ConflictDatasetUserBlock,
  buildTask85L475ConflictDatasetUserBlock,
  buildTask9L5ConflictDatasetUserBlock,
  buildTask10L5ConflictDatasetUserBlock,
  parseTask5L3TokenValidationMappingForAlignment,
  parseTask7L4TokenValidationMappingForAlignment,
  parseTask8L45TokenValidationMappingForAlignment,
  parseTask85L475TokenValidationMappingForAlignment,
  parseTask9L5TokenValidationMappingForAlignment,
  parseTask10L5TokenValidationMappingForAlignment,
  parseTask55L3TokenValidationMappingForAlignment,
  parseTask6L3TokenValidationMappingForAlignment,
  extractTask3L2TokenValidationMappingProgressSnippet,
  extractTask4L2TokenValidationMappingProgressSnippet,
  buildTask2L1TvmProgressSnippetWithPainPointCoverage,
  extractTokenValidationMappingProgressSnippet,
  mergeSupplementedPainPointTvmIntoL1InferenceRaw,
  normalizeL2BusinessInferenceRawForServerSync,
  normalizeL2ValueInferenceRawForServerSync,
  normalizeLogicGraphTasksFromApiPayload,
  parseTask2L1TokenValidationMappingWithPainPointCoverage,
  isTokenValidationMappingPotentialConflict,
  mergeSupplementTvmRowsFromReverseValidationLinks,
  parseTask3L2TokenValidationMappingForAlignment,
  parseTask4L2TokenValidationMappingForAlignment,
  normalizeTokenValidationMappingProgressLineKind,
  task2L1AllValidationRowsResolved,
  task2L1FilterPotentialConflictRows,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';
import {
  INFERENCE_CONCLUSION_ORGANIZE_LINE,
  appendFeatureInferenceConclusionsForLineTask,
  hasFeatureInferenceConclusionOrganizeLine,
  shouldProceedWithFeatureInferenceConclusionPush,
} from './designDetailFeatureInferenceConclusionProgress';
import {
  applyPainPointConfirmedImmunityToTvmRows,
  buildTask1PainPointConfirmedConsistencyMap,
  buildTask1PainPointConfirmedIndex,
} from './designDetailPainPointConfirmed';
import { recoverTask51RawFromDynamicsInferenceSub } from './buildCurrentStateUnderstandingFromTask51';
import {
  fetchNormalizedLogicGraphTasksForImmunity,
} from './designDetailUpstreamValidationImmunity';
import {
  applyTvmImmunityToRowsForGate,
  dedupeTvmImmunityProgressLines,
  runTvmImmunityPipelineForTask3Or4,
} from './designDetailTvmImmunityPipeline';
import {
  clearAlignmentPainPointTargetFeatureIds,
  readAlignmentPainPointTargetFeatureIds,
  writeAlignmentPainPointTargetFeatureIds,
} from './designDetailAlignmentPainTargets';
import { ensureDesignDetailTask1ScriptsReady } from './designDetailLegacyScripts';
import {
  anyDynamicsCardAwaitingAlignmentReply,
  buildAlignmentPendingRestoreSpecs,
  resolveAlignmentPendingFromPersisted,
} from './designDetailAlignmentPendingRestore';
import {
  clearTask2L1AlignmentQuestionnaireText,
  clearTask3L2AlignmentQuestionnaireText,
  clearTask4L2AlignmentQuestionnaireText,
  clearTask5L3AlignmentQuestionnaireText,
  clearTask51L3AlignmentQuestionnaireText,
  clearTask55L3AlignmentQuestionnaireText,
  writeTask2L1AlignmentQuestionnaireText,
  writeTask3L2AlignmentQuestionnaireText,
  writeTask4L2AlignmentQuestionnaireText,
  writeTask5L3AlignmentQuestionnaireText,
  writeTask51L3AlignmentQuestionnaireText,
  writeTask55L3AlignmentQuestionnaireText,
  writeTask6L3AlignmentQuestionnaireText,
  clearTask6L3AlignmentQuestionnaireText,
  writeTask65L3AlignmentQuestionnaireText,
  clearTask65L3AlignmentQuestionnaireText,
  writeTask7L4AlignmentQuestionnaireText,
  clearTask7L4AlignmentQuestionnaireText,
  writeTask8L45AlignmentQuestionnaireText,
  clearTask8L45AlignmentQuestionnaireText,
  writeTask85L475AlignmentQuestionnaireText,
  clearTask85L475AlignmentQuestionnaireText,
  writeTask9L5AlignmentQuestionnaireText,
  clearTask9L5AlignmentQuestionnaireText,
  writeTask10L5AlignmentQuestionnaireText,
  clearTask10L5AlignmentQuestionnaireText,
} from './designDetailTaskAlignmentQuestionnaire';
import {
  clearTask2L1DeepInsightText,
  readTask2L1DeepInsightText,
  writeTask2L1DeepInsightText,
} from './designDetailTask2L1DeepInsight';
import {
  clearTask2L1UserRectificationText,
  readTask2L1UserRectificationText,
  writeTask2L1UserRectificationText,
} from './designDetailTask2L1UserRectification';
import {
  clearTask3L2DeepInsightText,
  readTask3L2DeepInsightText,
  writeTask3L2DeepInsightText,
} from './designDetailTask3L2DeepInsight';
import {
  clearTask3L2UserRectificationText,
  readTask3L2UserRectificationText,
  writeTask3L2UserRectificationText,
} from './designDetailTask3L2UserRectification';
import {
  clearTask4L2DeepInsightText,
  readTask4L2DeepInsightText,
  writeTask4L2DeepInsightText,
} from './designDetailTask4L2DeepInsight';
import {
  clearTask4L2UserRectificationText,
  readTask4L2UserRectificationText,
  writeTask4L2UserRectificationText,
} from './designDetailTask4L2UserRectification';
import {
  clearTask5L3DeepInsightText,
  readTask5L3DeepInsightText,
  writeTask5L3DeepInsightText,
} from './designDetailTask5L3DeepInsight';
import {
  clearTask51L3DeepInsightText,
  readTask51L3DeepInsightText,
  writeTask51L3DeepInsightText,
} from './designDetailTask51L3DeepInsight';
import {
  clearTask55L3DeepInsightText,
  writeTask55L3DeepInsightText,
} from './designDetailTask55L3DeepInsight';
import {
  clearTask6L3DeepInsightText,
  writeTask6L3DeepInsightText,
} from './designDetailTask6L3DeepInsight';
import {
  clearTask7L4DeepInsightText,
  readTask7L4DeepInsightText,
  writeTask7L4DeepInsightText,
} from './designDetailTask7L4DeepInsight';
import {
  clearTask8L45DeepInsightText,
  readTask8L45DeepInsightText,
  writeTask8L45DeepInsightText,
} from './designDetailTask8L45DeepInsight';
import {
  clearTask85L475DeepInsightText,
  readTask85L475DeepInsightText,
  writeTask85L475DeepInsightText,
} from './designDetailTask85L475DeepInsight';
import {
  clearTask9L5DeepInsightText,
  readTask9L5DeepInsightText,
  writeTask9L5DeepInsightText,
} from './designDetailTask9L5DeepInsight';
import {
  readTask10L5DeepInsightText,
  writeTask10L5DeepInsightText,
  clearTask10L5DeepInsightText,
} from './designDetailTask10L5DeepInsight';
import {
  clearTask6L3UserRectificationText,
  writeTask6L3UserRectificationText,
} from './designDetailTask6L3UserRectification';
import {
  clearTask7L4UserRectificationText,
  readTask7L4UserRectificationText,
  writeTask7L4UserRectificationText,
} from './designDetailTask7L4UserRectification';
import {
  clearTask8L45UserRectificationText,
  readTask8L45UserRectificationText,
  writeTask8L45UserRectificationText,
} from './designDetailTask8L45UserRectification';
import {
  clearTask85L475UserRectificationText,
  readTask85L475UserRectificationText,
  writeTask85L475UserRectificationText,
} from './designDetailTask85L475UserRectification';
import {
  clearTask9L5UserRectificationText,
  readTask9L5UserRectificationText,
  writeTask9L5UserRectificationText,
} from './designDetailTask9L5UserRectification';
import {
  readTask10L5UserRectificationText,
  writeTask10L5UserRectificationText,
  clearTask10L5UserRectificationText,
} from './designDetailTask10L5UserRectification';
import {
  clearTask5L3UserRectificationText,
  readTask5L3UserRectificationText,
  writeTask5L3UserRectificationText,
} from './designDetailTask5L3UserRectification';
import {
  clearTask51L3UserRectificationText,
  readTask51L3UserRectificationText,
  writeTask51L3UserRectificationText,
} from './designDetailTask51L3UserRectification';
import {
  clearTask55L3UserRectificationText,
  writeTask55L3UserRectificationText,
} from './designDetailTask55L3UserRectification';
import {
  buildTask2L1TargetKvSyncAlignmentMeta,
  buildTask3L2TargetKvSyncAlignmentMeta,
  buildTask4L2TargetKvSyncAlignmentMeta,
  buildTask5L3TargetKvSyncAlignmentMeta,
  buildTask6L3TargetKvSyncAlignmentMeta,
  buildTask7L4TargetKvSyncAlignmentMeta,
  buildTask8L45TargetKvSyncAlignmentMeta,
  buildTask85L475TargetKvSyncAlignmentMeta,
  buildTask9L5TargetKvSyncAlignmentMeta,
  buildTask55L3TargetKvSyncAlignmentMeta,
  buildTask10L5TargetKvSyncAlignmentMeta,
  mergeTargetKvSyncBodyWithAlignmentMeta,
} from './designDetailTargetKvSyncAlignmentMeta';
import { markTask1ValidationResolvedForAlignmentLineTask } from './designDetailMarkTask1ValidationResolved';
import {
  DEBUG_PIPELINE_STEP_CONTINUE_PROMPT_FULL,
  DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_4,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_52,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_53,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_55,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_6,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_65,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_7,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_8,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_85,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_9,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10_DATA_ARCH,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_11,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_12,
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_13,
  designDetailDebugGate,
} from './designDetailDebugFlags';
import {
  designDetailExperienceMode,
  isDesignDetailDebugExperienceActive,
  isDesignDetailProgressLineVisibleForExperience,
  buildUsageModeHiddenProgressPlaceholder,
  setDesignDetailExperienceMode,
} from './designDetailExperienceMode';
import {
  filterDynamicsCardViewsForUsageMode,
  priorDesignLineTaskId,
  isUsageModeLineTaskDisplayCompleteForGate,
} from './designDetailUsageModeProgressGate';

const POLL_MS = 2800;

/** 缓存上一次 hydration 的消息指纹，用于变化检测避免无必要的 UI 更新和 PUT 请求 */
let _cachedMsgFp: ReturnType<typeof buildMessagesFingerprint> | null = null;

/** 「合并需求」卡：≥2 条提炼时用规则合并（无 LLM）异步生成预览，debounce 防抖 */
let mergedBaselinePreviewTimer: ReturnType<typeof setTimeout> | null = null;
let mergedBaselinePreviewGen = 0;

/** startPoll 预检时传入的指纹（用于 runHydrationCycle 复用，避免重复 fetch） */
let _pendingMsgFp: ReturnType<typeof buildMessagesFingerprint> | null = null;

/** 工作区快照指纹：用于 watch 中检测是否真正需要 PUT */
let _cachedWorkspaceFp = '';

const PROGRESS_LONG_LINE_CP = 480;
const PROGRESS_BURST_CP = 4;
/** 【调试】等进度灰块：相对默认逐码点节奏提速 50%（吞吐 ×1.5，与 `ensureRevealTicker` 内 `revealDebt` 配合） */
const PROGRESS_REVEAL_RATE_DEBUG = 1.5;

/** 任务 1 进入后第二条进度行（绿色引导） */
const TASK1_SCOPE_PROMPT_LINE = '→ 请提供客户工商及经营范围信息';
/** 旧版引导文案（hydrate 时视为已展示过引导，避免重复插入） */
const TASK1_SCOPE_PROMPT_LINE_LEGACY = '→ 请提供客户经营范围及业务形态相关信息';

/** 与 `task1BusinessInsight.js` 中 `DESIGN_DETAIL_BMC_NOTE_NAME` 一致 */
const DESIGN_DETAIL_BMC_NOTE = '设计详情 BMC 生成';
/** 与 `task1BusinessInsight.js` 中 `DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE_NAME` 一致 */
const DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE = '设计详情经营信息提炼';
/** task1：经营信息提炼进行中的进度行（与 BMC「正在生成 bmc」行区分） */
const TASK1_EXTRACTING_CUSTOMER_BASIC_LINE = '→ 正在提炼客户基本信息';
/** task1：提炼 JSON 落聊天后，同步后台 token/特征/逻辑边前的进度行 */
const TASK1_DERIVING_LOGIC_LINE = '→ 提炼推导逻辑';
/** 任务 1 绿色引导已展示且等待用户粘贴工商时，底部输入框占位（与进度区语义一致，无 `→` 前缀） */
const TASK1_SCOPE_INPUT_PLACEHOLDER = '请提供客户工商及经营范围信息';
/** task1：提炼完成后绘制右侧「客户基本信息」画布 Tab 的进度行 */
const TASK1_DRAWING_CUSTOMER_BASIC_CANVAS_LINE = '→ 正在绘制客户基本信息画布';

/** 画布与推导逻辑落库后引导用户输出需求（绿色行） */
const TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE = '→ 请输入用户需求';
/** 历史快照/旧版本曾写入的绿行文案，hydrate 时归一为 `TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE` */
const TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE_LEGACY = '→ 请输出客户需求';
/** 与 `task1BusinessInsight.js` 中 `DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME` 一致 */
const DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE = '设计详情客户需求提炼';
/** task1：需求提炼进行中进度行 */
const TASK1_PARSING_CUSTOMER_REQUIREMENT_LINE = '→ 正在解析需求';
const TASK1_CUSTOMER_REQUIREMENT_INPUT_PLACEHOLDER = '请输入用户需求';
/** task1：需求 JSON 落库后绘制右侧「需求提炼」画布 Tab 的进度行 */
const TASK1_RENDERING_REQUIREMENT_CANVAS_LINE = '→ 正在渲染需求画布';
/** 各分域逻辑提炼（至管理资源）完成后：询问是否继续补充需求（带「是/否」按钮） */
const TASK1_REQUIREMENT_SUPPLEMENT_QUESTION_LINE = '→ 是否继续补充需求？';
const TASK1_REQUIREMENT_SUPPLEMENT_YES_GUIDE_LINE =
  '→ 请补充客户需求：在下方输入并发送，将重新进行需求提炼与各分域逻辑同步。';

/** 任务 2 动态卡：理解进度行 + LLM 等待行（与分域提炼转圈同类，便于收尾删行） */
/** 任务 2：拉取任务 1 推理图并组装特征 TSV 输入 */
const TASK2_FETCH_GRAPH_INPUT_LINE = '→ 正在拉取任务 1 推理图并组装任务 2 输入…';
const TASK2_L1_ENTITY_LLM_WORKING_LINE = '→ 正在推理规模与组织模式（大模型）';
/** 任务 2：模型 JSON 展示后，解析 Target_KV 并写服务端 token / 特征前 */
const TASK2_SYNC_TARGET_KV_LINE = '→ 正在写入任务 2 token 与特征…';
/** 任务 2 L1：`Token_Validation_Mapping` 存在「潜在冲突」时，先生成对齐问卷（大模型） */
const TASK2_L1_ALIGNMENT_Q_WORKING_LINE = '→ 正在生成需求对齐问卷（大模型）';
const TASK2_L1_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK2_L1_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察（Input 5）并自动重跑任务 2 L1；若仍有「潜在冲突」将再次展示问卷。';
const TASK2_L1_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入（Input 5）。正在结合该洞察重新推理规模与组织模式（L1）…';
/** 任务 3（推理层级 L2-行业与业务层，见 `logicTreeInferenceLayerTierLabelByNormTaskId` / 架构矩阵）：TVM 潜在冲突时生成对齐问卷 */
const TASK3_L2_ALIGNMENT_Q_WORKING_LINE =
  '→ 正在生成 L2-行业与业务层 反向验证对齐问卷（大模型）';
const TASK3_L2_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK3_L2_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察（Input 3）并自动重跑任务 3（L2-行业与业务层）；若仍有「潜在冲突」将再次展示问卷。';
const TASK3_L2_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入（Input 3）。正在结合该洞察重新推理行业与业务属性（L2-行业与业务层）…';
/** 任务 4 L2：`Token_Validation_Mapping`（价值链）存在「潜在冲突」时先生成对齐问卷 */
const TASK4_L2_ALIGNMENT_Q_WORKING_LINE = '→ 正在生成 L2 价值链反向验证对齐问卷（大模型）';
const TASK4_L2_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK4_L2_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察（Input 4）并自动重跑任务 4 L2；若仍有「潜在冲突」将再次展示问卷。';
const TASK4_L2_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入（Input 4）。正在结合该洞察重新推理价值链分析（L2）…';
const TASK5_L3_ALIGNMENT_Q_WORKING_LINE = '→ 正在生成 L3 宏观流程反向验证对齐问卷（大模型）';
const TASK5_L3_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK5_L3_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察并自动重跑任务 5 L3；若仍有「潜在冲突」将再次展示问卷。';
const TASK5_L3_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入。正在结合该洞察重新推理宏观业务流程（L3）…';
const TASK51_L3_ALIGNMENT_Q_WORKING_LINE = '→ 正在生成 L3.1 战略价值主张反向验证对齐问卷（大模型）';
const TASK51_L3_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK51_L3_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察并自动重跑任务 5.1 L3.1；若仍有「潜在冲突」将再次展示问卷。';
const TASK51_L3_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入。正在结合该洞察重新推理战略价值主张与业务能力单元（L3.1）…';
const TASK55_L3_ALIGNMENT_Q_WORKING_LINE = '→ 正在生成 L3.5 VSM 反向验证对齐问卷（大模型）';
const TASK55_L3_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK55_L3_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察并自动重跑任务 5.5 L3.5；若仍有「潜在冲突」将再次展示问卷。';
const TASK55_L3_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入。正在结合该洞察重新推理 VSM 阶段拆解（L3.5）…';
const TASK6_L3_ALIGNMENT_Q_WORKING_LINE =
  '→ 正在生成 L3 关键场景反向验证对齐问卷（大模型）';
const TASK6_L3_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK6_L3_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察（Input 3）并自动重跑任务 6 L3；若仍有「潜在冲突」将再次展示问卷。';
const TASK6_L3_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入。正在结合该洞察重新推理关键场景…';
const TASK65_L3_ALIGNMENT_Q_WORKING_LINE =
  '→ 正在生成 L3 三维 IT-Gap 反向验证对齐问卷（大模型）';
const TASK65_L3_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK65_L3_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察并仅重跑当前流程环节的 IT-Gap 推理；若仍有「潜在冲突」将再次展示问卷。';
const TASK65_L3_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入。正在结合该洞察重新推理三维 IT-Gap 分析…';
const TASK10_L5_ALIGNMENT_Q_WORKING_LINE =
  '→ 正在生成 L5 数据架构反向验证对齐问卷（大模型）';
const TASK10_L5_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK10_L5_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察（Input 3）并自动重跑任务 10 L5；若仍有「潜在冲突」将再次展示问卷。';
const TASK10_L5_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入（Input 3）。正在结合该洞察重新推理 L5 数据架构与范式排异（L5）…';
const TASK7_L4_ALIGNMENT_Q_WORKING_LINE = '→ 正在生成 L4 协作节点反向验证对齐问卷（大模型）';
const TASK7_L4_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK7_L4_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察（Input 3）并自动重跑任务 7 L4；若仍有「潜在冲突」将再次展示问卷。';
const TASK7_L4_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入（Input 3）。正在结合该洞察重新推理二级协作节点拆解（L4）…';
const TASK8_L45_ALIGNMENT_Q_WORKING_LINE = '→ 正在生成 L4.5 状态机反向验证对齐问卷（大模型）';
const TASK8_L45_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK8_L45_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察（Input 4）并自动重跑任务 8 L4.5；若仍有「潜在冲突」将再次展示问卷。';
const TASK8_L45_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入（Input 4）。正在结合该洞察重新推理角色/对象/STM（L4.5）…';
const TASK85_L475_ALIGNMENT_Q_WORKING_LINE = '→ 正在生成 L4.7 物理外挂反向验证对齐问卷（大模型）';
const TASK85_L475_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK85_L475_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察（Input 4）并自动重跑任务 8.5 L4.7；若仍有「潜在冲突」将再次展示问卷。';
const TASK85_L475_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入（Input 4）。正在结合该洞察重新推理物理外挂集成（L4.7）…';
const TASK9_L5_ALIGNMENT_Q_WORKING_LINE = '→ 正在生成 L5 蓝图反向验证对齐问卷（大模型）';
const TASK9_L5_ALIGNMENT_DOUBT_LINE = '→ 产生疑问';
const TASK9_L5_ALIGNMENT_CHAT_GUIDE_LINE =
  '→ 请在下方回复上述问卷；提交后将凝练为深访洞察（Input 4）并自动重跑任务 9 L5；若仍有「潜在冲突」将再次展示问卷。';
const TASK9_L5_ALIGNMENT_SYNTH_DONE_LINE =
  '→ 深访洞察已写入（Input 4）。正在结合该洞察重新推理领域容器与工具宿主（L5）…';

const ALIGNMENT_PENDING_RESTORE_SPECS = buildAlignmentPendingRestoreSpecs({
  task2Guide: TASK2_L1_ALIGNMENT_CHAT_GUIDE_LINE,
  task2Synth: TASK2_L1_ALIGNMENT_SYNTH_DONE_LINE,
  task3Guide: TASK3_L2_ALIGNMENT_CHAT_GUIDE_LINE,
  task3Synth: TASK3_L2_ALIGNMENT_SYNTH_DONE_LINE,
  task4Guide: TASK4_L2_ALIGNMENT_CHAT_GUIDE_LINE,
  task4Synth: TASK4_L2_ALIGNMENT_SYNTH_DONE_LINE,
  task5Guide: TASK5_L3_ALIGNMENT_CHAT_GUIDE_LINE,
  task5Synth: TASK5_L3_ALIGNMENT_SYNTH_DONE_LINE,
  task51Guide: TASK51_L3_ALIGNMENT_CHAT_GUIDE_LINE,
  task51Synth: TASK51_L3_ALIGNMENT_SYNTH_DONE_LINE,
  task55Guide: TASK55_L3_ALIGNMENT_CHAT_GUIDE_LINE,
  task55Synth: TASK55_L3_ALIGNMENT_SYNTH_DONE_LINE,
  task6Guide: TASK6_L3_ALIGNMENT_CHAT_GUIDE_LINE,
  task6Synth: TASK6_L3_ALIGNMENT_SYNTH_DONE_LINE,
  task65Guide: TASK65_L3_ALIGNMENT_CHAT_GUIDE_LINE,
  task65Synth: TASK65_L3_ALIGNMENT_SYNTH_DONE_LINE,
  task7Guide: TASK7_L4_ALIGNMENT_CHAT_GUIDE_LINE,
  task7Synth: TASK7_L4_ALIGNMENT_SYNTH_DONE_LINE,
  task8Guide: TASK8_L45_ALIGNMENT_CHAT_GUIDE_LINE,
  task8Synth: TASK8_L45_ALIGNMENT_SYNTH_DONE_LINE,
  task85Guide: TASK85_L475_ALIGNMENT_CHAT_GUIDE_LINE,
  task85Synth: TASK85_L475_ALIGNMENT_SYNTH_DONE_LINE,
  task9Guide: TASK9_L5_ALIGNMENT_CHAT_GUIDE_LINE,
  task9Synth: TASK9_L5_ALIGNMENT_SYNTH_DONE_LINE,
  task10Guide: TASK10_L5_ALIGNMENT_CHAT_GUIDE_LINE,
  task10Synth: TASK10_L5_ALIGNMENT_SYNTH_DONE_LINE,
});
const TASK3_INDUSTRY_BUSINESS_START_LINE = '→ 开始进行行业与业务属性推理';
/** 任务 0：sync 落库请求期间行尾蓝环；落库返回后须摘掉（与任务 3 Target_KV 落库行同类） */
const TASK0_SYNC_SPINNER_LINE = '→ 正在将工具原语落库至推理图（任务 0）…';
const TASK3_DEBUG_L1_FEATURE_LIST_LINE = '【调试】【任务 3】→ 上游 L1 实体画像特征列表';
const TASK3_DEBUG_L2_FEATURE_LIST_LINE = '【调试】【任务 3】→ 本步 L2 行业与业务属性推理';
const TASK3_DEBUG_INFERENCE_DONE_LINE = '【调试】【任务 3】→ 推理完成';
const TASK3_L2_INDUSTRY_LLM_WORKING_LINE = '→ 正在进行行业与业务属性推理（大模型）';
const TASK3_LOGIC_EXTRACT_LINE = '→ 进行任务 3 推理逻辑提取';
/** 任务 3：解析 Target_KV 并写服务端 token / 特征 / 逻辑边前（行尾蓝环，与任务 2 落库行同类） */
const TASK3_SYNC_TARGET_KV_LINE = '→ 正在写入任务 3 Target_KV 与逻辑链…';
const TASK3_SYNC_TARGET_KV_OK_LINE = '→ 任务 3 Target_KV 与逻辑链已写入服务端';
const TASK3_DEBUG_TOKEN_KV_LINE = '【调试】【任务 3】→ 提取到 token';
const TASK3_DEBUG_FEATURE_KV_LINE = '【调试】【任务 3】→ 提取到feature';
const TASK4_CORE_VALUE_START_LINE = '→ 开始进行价值链分析推理';
const TASK4_DEBUG_L1_FEATURE_LIST_LINE = '【调试】【任务 4】→ L1推理结果：Feature 列表';
const TASK4_DEBUG_L2_FEATURE_LIST_LINE = '【调试】【任务 4】→ L2推理结果：Feature 列表';
const TASK4_DEBUG_INFERENCE_DONE_LINE = '【调试】【任务 4】→ 推理完成';
const TASK4_L2_VALUE_LLM_WORKING_LINE = '→ 正在进行价值链分析推理（大模型）';
const TASK4_LOGIC_EXTRACT_LINE = '→ 进行任务 4 推理逻辑提取';
const TASK4_DEBUG_TOKEN_KV_LINE = '【调试】【任务 4】→ 提取到 token';
const TASK4_DEBUG_FEATURE_KV_LINE = '【调试】【任务 4】→ 提取到feature';
const TASK5_MACRO_PROCESS_START_LINE = '→ 开始进行 L3 宏观流程特征推理';
const TASK5_DEBUG_UPSTREAM_FEATURE_LIST_LINE =
  '【调试】【任务 5】→ L1/L2/L2.5 与 L2 价值链上游 Feature 列表';
const TASK5_DEBUG_INFERENCE_DONE_LINE = '【调试】【任务 5】→ 推理完成';
const TASK5_L3_LLM_WORKING_LINE = '→ 正在进行 L3 宏观流程特征推理（大模型）';
const TASK5_LOGIC_EXTRACT_LINE = '→ 进行任务 5 推理逻辑提取';
const TASK5_SYNC_TARGET_KV_LINE = '→ 正在写入任务 5 Target_KV 与逻辑链…';
const TASK5_SYNC_TARGET_KV_OK_LINE = '→ 任务 5 Target_KV 与逻辑链已写入服务端';
const TASK5_DEBUG_TOKEN_KV_LINE = '【调试】【任务 5】→ 提取到 token';
const TASK5_DEBUG_FEATURE_KV_LINE = '【调试】【任务 5】→ 提取到feature';
const TASK55_VSM_START_LINE = '→ 开始进行 L3.5 价值流图 VSM 阶段拆解';
const TASK51_L3_LLM_WORKING_LINE = '→ 正在进行 L3.1 战略价值主张推理（大模型，最长约 5 分钟）';
const TASK52_L3_LLM_WORKING_LINE = '→ 功能理解：';
const TASK52_SYNC_TARGET_KV_LINE = '→ 正在写入任务 5.2 Target_KV 与逻辑链…';
const TASK53_L3_LLM_WORKING_LINE = '→ 正在进行 L3.3 关键工作流拓扑编排推理（大模型，最长约 5 分钟）';
const TASK53_SYNC_TARGET_KV_LINE = '→ 正在写入任务 5.3 Target_KV 与逻辑链…';
const TASK51_SYNC_TARGET_KV_LINE = '→ 正在写入任务 5.1 Target_KV 与逻辑链…';
const TASK55_SYNC_TARGET_KV_LINE = '→ 正在写入任务 5.5 Target_KV 与逻辑链…';
const TASK55_SYNC_TARGET_KV_OK_LINE = '→ 任务 5.5 Target_KV 与逻辑链已写入服务端';
const TASK55_DEBUG_MACRO_CONSTRAINT_LINE = '【调试】【任务 5.5】→ 上游 5.3/5.2/5.1 与战略总线 Input 4';
const TASK55_DEBUG_INFERENCE_DONE_LINE = '【调试】【任务 5.5】→ 推理完成';
const TASK55_L3_LLM_WORKING_LINE = '→ 正在进行 L3.5 VSM 阶段拆解（大模型）';
const TASK55_LOGIC_EXTRACT_LINE = '→ 进行任务 5.5 推理逻辑提取';
const TASK55_DEBUG_TOKEN_KV_LINE = '【调试】【任务 5.5】→ 提取到 token';
const TASK55_DEBUG_FEATURE_KV_LINE = '【调试】【任务 5.5】→ 提取到feature';
const TASK6_SCENARIO_START_LINE = '→ 开始进行关键场景推理';
const TASK6_SYNC_TARGET_KV_LINE = '→ 正在写入任务 6 Target_KV 与逻辑链…';
const TASK6_SYNC_TARGET_KV_OK_LINE = '→ 任务 6 Target_KV 与逻辑链已写入服务端';
const TASK6_DEBUG_INFERENCE_DONE_LINE = '【调试】【任务 6】→ 推理完成';
const TASK6_L3_LLM_WORKING_LINE = '→ 正在进行关键场景推理（大模型，最长约 5 分钟）';
const TASK6_LOGIC_EXTRACT_LINE = '→ 进行任务 6 推理逻辑提取';
const TASK6_DEBUG_TOKEN_KV_LINE = '【调试】【任务 6】→ 提取到 token';
const TASK6_DEBUG_FEATURE_KV_LINE = '【调试】【任务 6】→ 提取到feature';

const TASK7_COLLAB_START_LINE = '→ 开始进行任务节点IT选型推理';
const TASK7_SYNC_TARGET_KV_LINE = '→ 正在写入任务 7 Target_KV 与逻辑链…';
const TASK7_SYNC_TARGET_KV_OK_LINE = '→ 任务 7 Target_KV 与逻辑链已写入服务端';
const TASK7_DEBUG_INFERENCE_DONE_LINE = '【调试】【任务 7】→ 推理完成';
const TASK7_L4_LLM_WORKING_LINE = '→ 正在进行 L4 协作节点拆解推理（大模型，最长约 5 分钟）';

const TASK8_PROTOTYPE_START_LINE = '→ 开始进行 L4.5 角色、对象与状态转移矩阵推理';
const TASK8_DEBUG_INFERENCE_DONE_LINE = '→ 任务 8 推理完成';
const TASK8_LOGIC_EXTRACT_LINE = '→ 任务 8：开始提炼推理逻辑';
const TASK8_SYNC_TARGET_KV_LINE = '→ 正在进行 Target_KV 落库（任务 8）';
const TASK8_SYNC_TARGET_KV_OK_LINE = '→ 任务 8 Target_KV 与逻辑链已写入服务端';
const TASK8_DEBUG_TOKEN_KV_LINE = '→ 任务 8 token / feature 明细';
const TASK8_DEBUG_FEATURE_KV_LINE = '→ 任务 8 feature 明细';
const TASK8_L45_LLM_WORKING_LINE = '→ 正在进行 L4.5 角色对象状态矩阵推理（大模型，最长约 5 分钟）';

const TASK85_PHYSICAL_HOOK_START_LINE = '→ 开始进行 L4.7 技术栈组件与外挂 Hook 集成推理';
const TASK85_L475_LLM_WORKING_LINE = '→ 正在进行 L4.7 技术集成推理（大模型，最长约 5 分钟）';
const TASK85_SYNC_TARGET_KV_LINE = '→ 正在进行 Target_KV 落库（任务 8.5）';

/** 任务 5.2 动态卡是否仍停在「即将开始」占位、尚未进入表格字段功能理解流水线 */
function isTask52PipelineKickoffPending(card: DynamicsCardModel | undefined): boolean {
  if (!card) return true;
  if (card.status === 'completed') return false;
  return !card.lines.some(
    (l) =>
      task52ProgressIndicatesPipelineKickoff(l.full) ||
      l.kind === 'task52_inference_sub' ||
      l.full.includes('未加载 inferDesignDetailL52AssetFieldSetFromContext'),
  );
}

/** 任务 5.3 动态卡是否仍停在「即将开始」占位、尚未进入流程环节功能理解流水线 */
function isTask53PipelineKickoffPending(card: DynamicsCardModel | undefined): boolean {
  if (!card) return true;
  if (card.status === 'completed') return false;
  return !card.lines.some(
    (l) =>
      task53ProgressIndicatesPipelineKickoff(l.full) ||
      l.kind === 'task53_inference_sub' ||
      l.full.includes('未加载 inferDesignDetailL53WorkflowFlowFromContext'),
  );
}

/** 任务 8.5 动态卡是否仍停在首句「即将开始」、尚未进入 L4.7 流水线 */
function isTask85PipelineKickoffPending(card: DynamicsCardModel | undefined): boolean {
  if (!card) return true;
  if (card.status === 'completed') return false;
  return !card.lines.some(
    (l) =>
      l.full.includes('L4.7') ||
      l.full.includes('L4.75') ||
      l.full.includes('Target_KV') ||
      l.full.includes('任务 8.5 推理完成') ||
      l.full.includes('任务 8.5 推理失败') ||
      l.full.includes('未加载 inferDesignDetailL475PhysicalHookFromContext'),
  );
}

/** 任务 10 动态卡是否仍停在占位/首句，尚未进入 L5 物理 DDL 流水线（含「重启当前」仅预置卡） */
function isTask10PipelineKickoffPending(card: DynamicsCardModel | undefined): boolean {
  if (!card) return true;
  if (card.status === 'completed') return false;
  return !card.lines.some(
    (l) =>
      l.full.includes('L5 物理 Schema') ||
      l.full.includes('物理建表 Schema') ||
      l.full.includes('Target_KV 落库（任务 10') ||
      l.full.includes('任务 10 推理') ||
      l.full.includes('未加载 inferDesignDetailL5TechnicalDdlFromContext'),
  );
}

/** 同线步多张动态卡时取 completed 优先、否则行数最多者（避免陈旧首卡导致门闩误判） */
function findDynamicsCardByLineTaskId(
  cards: readonly DynamicsCardModel[],
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
): DynamicsCardModel | undefined {
  const matches = cards.filter((c) => c.lineTaskId === lineTaskId);
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  return matches.slice().sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return -1;
    if (b.status === 'completed' && a.status !== 'completed') return 1;
    return (b.lines?.length ?? 0) - (a.lines?.length ?? 0);
  })[0];
}

const TASK9_BLUEPRINT_START_LINE = '→ 开始进行 L5 领域驱动逻辑容器与工具宿主定义推理';
const TASK9_DEBUG_INFERENCE_DONE_LINE = '→ 任务 9 推理完成';
const TASK9_LOGIC_EXTRACT_LINE = '→ 任务 9：开始提炼推理逻辑';
const TASK9_SYNC_TARGET_KV_LINE = '→ 正在进行 Target_KV 落库（任务 9）';
const TASK9_SYNC_TARGET_KV_OK_LINE = '→ 任务 9 Target_KV 与逻辑链已写入服务端';
const TASK9_DEBUG_TOKEN_KV_LINE = '→ 任务 9 token / feature 明细';
const TASK9_DEBUG_FEATURE_KV_LINE = '→ 任务 9 feature 明细';
const TASK9_L5_LLM_WORKING_LINE = '→ 正在进行 L5 领域容器与工具宿主推理（大模型，最长约 5 分钟）';

const TASK10_SYNC_TARGET_KV_LINE = '→ 正在进行 Target_KV 落库（任务 10）';
const TASK10_LLM_WORKING_LINE = '→ 正在进行 L5 物理 Schema 与 RBAC 推理（大模型，最长约 5 分钟）';

const TASK7_LOGIC_EXTRACT_LINE = '→ 进行任务 7 推理逻辑提取';
const TASK7_DEBUG_TOKEN_KV_LINE = '【调试】【任务 7】→ 提取到 token';
const TASK7_DEBUG_FEATURE_KV_LINE = '【调试】【任务 7】→ 提取到feature';

/**
 * 设计详情页跨异步 LLM 的会话代数：「完全重启」递增后，滞后的任务 2 L1 等回调不得写回 UI。
 * `designDetailLlmAbortController`：中止进行中的 `fetchDeepSeekChat`（与 api.js `options.signal` 合并）。
 */
let designDetailSessionGeneration = 0;
let designDetailLlmAbortController: AbortController | null = null;

/** @returns 是否实际中止了进行中的 LLM 请求（用于「完全重启」控制台对账） */
function abortDesignDetailInFlightLlm(reason: string): boolean {
  const c = designDetailLlmAbortController;
  designDetailLlmAbortController = null;
  if (!c) return false;
  try {
    c.abort(reason);
  } catch {
    /* ignore */
  }
  return true;
}

/** 开始新的可取消 LLM 前调用：先中止上一段同页请求 */
function takeDesignDetailLlmAbortController(): AbortController {
  abortDesignDetailInFlightLlm('replaced_by_new_design_detail_llm');
  const next = new AbortController();
  designDetailLlmAbortController = next;
  return next;
}

function bumpDesignDetailSessionGeneration(): void {
  designDetailSessionGeneration += 1;
}

/** 设计页「完全重启」专用：控制台过滤 `[design-detail:full-restart]` 与 `[problem-case-api]` / 服务端 `[problem-case:llm-logs-clear]` 对账 */
function logDesignDetailFullRestart(phase: string, extra?: Record<string, unknown>): void {
  try {
    console.info('[design-detail:full-restart]', {
      phase,
      sessionGeneration: designDetailSessionGeneration,
      ...extra,
    });
  } catch {
    /* ignore */
  }
}

/** hydrate / 工作区恢复快照：与 `[design-detail:task0-pipeline]`、`[design-detail:full-restart]` 联查任务 0 卡死 */
function logDesignDetailHydrate(phase: string, extra?: Record<string, unknown>): void {
  try {
    console.info('[design-detail:hydrate]', {
      phase,
      sessionGeneration: designDetailSessionGeneration,
      ...extra,
    });
  } catch {
    /* ignore */
  }
}

function countLiveDynamicsCardLines(cards: ReadonlyArray<{ lines?: ReadonlyArray<unknown> }>): number {
  return countDynamicsSnapshotLines(cards);
}

/** 工作区快照已恢复多线步/多行进展时，勿再 bootstrap 任务 1 空引导卡 */
function hasMeaningfulProgressFromWorkspace(cards: ReadonlyArray<{ lineTaskId?: string; lines?: unknown[] }>): boolean {
  if (!cards.length) return false;
  const lineCount = countLiveDynamicsCardLines(cards);
  if (cards.length > 1) return true;
  if (lineCount > 3) return true;
  return cards.some(
    (c) =>
      c.lineTaskId !== 'customer_basic' &&
      c.lineTaskId !== 'optional_toolbox_primitive',
  );
}

/** 供 `frontend/js/api.js` 在 `fetchDeepSeekChat` 内解析，写入案例级 LLM 审计 */
function withDesignDetailLlmLogContext<T>(
  ctx: { caseId: string; taskId: string; callTarget: string },
  fn: () => Promise<T>,
  onAfter?: () => void,
): Promise<T> {
  const g = window as unknown as {
    SmartCto?: { designDetailLlmLogContext?: { caseId: string; taskId: string; callTarget: string } };
  };
  g.SmartCto = g.SmartCto || {};
  const prev = g.SmartCto.designDetailLlmLogContext;
  g.SmartCto.designDetailLlmLogContext = ctx;
  return fn().finally(() => {
    if (prev !== undefined) g.SmartCto!.designDetailLlmLogContext = prev;
    else delete g.SmartCto!.designDetailLlmLogContext;
    onAfter?.();
  });
}

/** 与 `task1BusinessInsight.js` 中 `DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT` 顶层 JSON 键一致，供需求画布子 Tab */
const CUSTOMER_REQUIREMENT_CANVAS_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'businessContext', label: '业务背景' },
  { key: 'coreBusinessEntities', label: '核心业务对象' },
  { key: 'stateTransitionMatrix', label: '状态转移矩阵' },
  { key: 'painPointRadar', label: '痛点雷达' },
  { key: 'itLandscape', label: 'IT 现状与集成' },
  { key: 'existingSpreadsheets', label: '现有表格' },
  { key: 'operationModel', label: '运营模式' },
  { key: 'managementResources', label: '管理资源' },
  { key: 'roadmap', label: '路线图' },
];

/** 需求提炼落库后同步后台推理图的分域顺序：至管理资源后结束，不继续路线图等 */
const CUSTOMER_REQUIREMENT_GRAPH_SYNC_AFTER_DISTILL: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'businessContext', label: '业务背景' },
  { key: 'coreBusinessEntities', label: '核心业务对象' },
  { key: 'stateTransitionMatrix', label: '状态转移矩阵' },
  { key: 'painPointRadar', label: '痛点雷达' },
  { key: 'itLandscape', label: 'IT 现状与集成' },
  { key: 'existingSpreadsheets', label: '现有表格' },
  { key: 'operationModel', label: '运营模式' },
  { key: 'managementResources', label: '管理资源' },
];

function customerRequirementSectionSyncProgressLines(key: string): { start: string; done: string } {
  if (key === 'businessContext') {
    return { start: '→ 正在提炼业务背景的逻辑', done: '→ 完成业务背景的逻辑提炼' };
  }
  if (key === 'coreBusinessEntities') {
    return { start: '→ 正在提炼核心业务对象的逻辑', done: '→ 完成核心业务对象的逻辑提炼' };
  }
  if (key === 'stateTransitionMatrix') {
    return { start: '→ 正在提炼状态转移矩阵的逻辑', done: '→ 完成状态转移矩阵的逻辑提炼' };
  }
  if (key === 'painPointRadar') {
    return { start: '→ 正在提炼痛点雷达的逻辑', done: '→ 完成痛点雷达的逻辑提炼' };
  }
  if (key === 'itLandscape') {
    return { start: '→ 正在提炼IT 现状与集成的逻辑', done: '→ 完成IT 现状与集成的逻辑提炼' };
  }
  if (key === 'existingSpreadsheets') {
    return { start: '→ 正在提炼现有表格的逻辑', done: '→ 完成现有表格的逻辑提炼' };
  }
  if (key === 'operationModel') {
    return { start: '→ 正在提炼运营模式的逻辑', done: '→ 完成运营模式的逻辑提炼' };
  }
  if (key === 'managementResources') {
    return { start: '→ 正在提炼管理资源的逻辑', done: '→ 完成管理资源的逻辑提炼' };
  }
  return { start: '→ 正在提炼逻辑', done: '→ 完成逻辑提炼' };
}

/** 任务动态区「需求提炼」灰行：每字段值仅展示前 N 个 Unicode 标量 + 省略号（与流式 reveal 同区） */
/** 与经营信息提炼 JSON 字段一致，供画布表格列名 */
const CUSTOMER_BASIC_CANVAS_FIELD_ROWS: ReadonlyArray<{ field: string; label: string }> = [
  { field: 'company_name', label: '企业名称' },
  { field: 'credit_code', label: '统一社会信用代码' },
  { field: 'legal_representative', label: '法定代表人' },
  { field: 'established_date', label: '成立日期' },
  { field: 'registered_capital', label: '注册资本' },
  { field: 'is_listed', label: '是否上市' },
  { field: 'listing_location', label: '上市地点' },
  { field: 'business_scope', label: '经营范围' },
  { field: 'core_qualifications', label: '核心资质' },
  { field: 'official_website', label: '官网' },
];

/** 任务动态区经营信息提炼灰行：仅展示前 N 个顶层字段，其余用中文省略号（与完整 `parsed` 入聊天块无关） */
const TASK1_BASIC_INFO_PROGRESS_MAX_FIELDS = 3;
const TASK1_BASIC_INFO_PROGRESS_TAIL = '。。。';

function buildTask1BasicInfoProgressPreview(parsed: Record<string, unknown>): string {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return `${TASK1_BASIC_INFO_PROGRESS_TAIL}`;
  }
  const preset = CUSTOMER_BASIC_CANVAS_FIELD_ROWS.map((r) => r.field);
  const keys = Object.keys(parsed).filter((k) => typeof k === 'string' && k.length > 0 && !k.startsWith('__'));
  const presetSet = new Set(preset);
  const inOrder = preset.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !presetSet.has(k)).sort((a, b) => a.localeCompare(b));
  const ordered = [...inOrder, ...rest].slice(0, TASK1_BASIC_INFO_PROGRESS_MAX_FIELDS);
  const slice: Record<string, unknown> = {};
  for (const k of ordered) {
    slice[k] = parsed[k];
  }
  try {
    return `${JSON.stringify(slice, null, 2)}${TASK1_BASIC_INFO_PROGRESS_TAIL}`;
  } catch {
    return TASK1_BASIC_INFO_PROGRESS_TAIL;
  }
}

export type DesignCanvasTabKind =
  | 'case_overview'
  | 'customer_basic'
  | 'requirement_distill'
  | 'current_state_understanding'
  | 'diagnostic_review'
  | 'architecture_inventory';

export type DesignCanvasTab = {
  id: string;
  label: string;
  kind: DesignCanvasTabKind;
};

/** 右侧「需求提炼」画布：单次大模型提炼一条根卡片（标题为提炼时间） */
export type CustomerRequirementCanvasEntry = {
  id: string;
  /** 与聊天块 `timestamp` 一致，用于 hydrate 时恢复子 Tab */
  isoTimestamp: string;
  /** 根卡片标题旁展示 */
  titleTimeLabel: string;
  /** 与聊天 `task1LlmQueryBlock.task1RequirementDistillOrdinal` 对齐：全案第几次需求提炼（缺省则回退列表序） */
  distillOrdinal?: number;
  parsed: Record<string, unknown>;
  /** 当前子 Tab 对应 `CUSTOMER_REQUIREMENT_CANVAS_FIELDS[].key` */
  activeSubTabKey: string;
};

export type CustomerBasicCanvasRow = {
  field: string;
  label: string;
  value: string;
};

/** 「合并需求」折叠卡片与 `DesignDetailPage.reqCardExpanded` 的键一致 */
export const DESIGN_DETAIL_MERGED_REQUIREMENT_CARD_ID = '__design_detail_merged_requirement__';

/** 列表展示为**新在上**；合并时按聊天时间自旧向新 `Object.assign`，同名字段以**最近**一次需求提炼为准 */
function mergeCustomerRequirementParsedFromEntries(entries: CustomerRequirementCanvasEntry[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (let i = entries.length - 1; i >= 0; i--) {
    Object.assign(merged, entries[i]!.parsed);
  }
  return merged;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatCustomerBasicCell(v: unknown): string {
  if (v == null) return '—';
  const s = String(v).trim();
  return s.length ? s : '—';
}

function buildCustomerBasicCanvasRows(parsed: Record<string, unknown>): CustomerBasicCanvasRow[] {
  return CUSTOMER_BASIC_CANVAS_FIELD_ROWS.map(({ field, label }) => ({
    field,
    label,
    value: formatCustomerBasicCell(parsed[field]),
  }));
}

/** 需求画布根卡片标题（与详情区「时间 + 提炼」语义一致） */
function formatRequirementCanvasTitleLabel(timestampRaw: string): string {
  const t = String(timestampRaw || '').trim();
  return t.length ? `需求提炼 · ${t}` : '需求提炼';
}

/** 避免 `{}` 或全空字段在画布上占一条空根卡片 */
function hasMeaningfulCustomerRequirementParsed(parsed: Record<string, unknown>): boolean {
  for (const v of Object.values(parsed)) {
    if (v == null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    return true;
  }
  return false;
}

function collectCustomerRequirementBlocksFromChat(
  messages: Array<Record<string, unknown>>,
): Array<{ timestamp: string; parsed: Record<string, unknown>; distillOrdinal: number }> {
  const out: Array<{ timestamp: string; parsed: Record<string, unknown>; distillOrdinal: number }> = [];
  for (const m of messages) {
    if (m?.type !== 'task1LlmQueryBlock') continue;
    if (String((m as { noteName?: string }).noteName || '') !== DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE) continue;
    const parsed = (m as { llmOutputJson?: unknown }).llmOutputJson;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const rec = parsed as Record<string, unknown>;
    if (!hasMeaningfulCustomerRequirementParsed(rec)) continue;
    const timestamp = String((m as { timestamp?: string }).timestamp || '').trim();
    const recM = m as Record<string, unknown>;
    const persisted = readPersistedRequirementDistillOrdinal(recM);
    const distillOrdinal = persisted ?? out.length + 1;
    out.push({ timestamp, parsed: rec, distillOrdinal });
  }
  return out;
}

type ProgressLineKind =
  | 'default'
  | 'scope_green'
  | 'user_quote'
  | 'bmc_generating'
  | 'bmc_result_quote'
  /** 任务进展：`Token_Validation_Mapping` JSON 块（淡红 + 关键字段深蓝，见 `formatTokenValidationMappingProgressHtml`） */
  | 'token_validation_mapping_quote'
  /** 任务 2 L1：`Token_Validation_Mapping` 存在「潜在冲突」时，先生成对齐问卷（大模型） */
  | 'task2_alignment_questionnaire_sub'
  /** 任务 3 L2：同上，问卷子区 */
  | 'task3_alignment_questionnaire_sub'
  /** 任务 4 L2：价值链 TVM 对齐问卷子区 */
  | 'task4_alignment_questionnaire_sub'
  /** 任务 5 L3：宏观流程 TVM 对齐问卷子区 */
  | 'task5_alignment_questionnaire_sub'
  /** 任务 5.5 L3.5：VSM TVM 对齐问卷子区 */
  | 'task55_alignment_questionnaire_sub'
  /** 任务 6 L3：关键场景 TVM 对齐问卷子区 */
  | 'task6_alignment_questionnaire_sub'
  /** 任务 6.5 L3：三维 IT-Gap TVM 对齐问卷子区 */
  | 'task65_alignment_questionnaire_sub'
  | 'task7_alignment_questionnaire_sub'
  | 'task8_alignment_questionnaire_sub'
  | 'task85_alignment_questionnaire_sub'
  | 'task9_alignment_questionnaire_sub'
  /** 任务 10 L5：数据架构 TVM 对齐问卷子区 */
  | 'task10_alignment_questionnaire_sub'
  /** 任务 3 L2：「推理完成」行下方的灰色子区域正文（模型输出，无前缀 →） */
  | 'task3_inference_sub'
  /** 任务 4 L2：模型 JSON 灰色子区域正文 */
  | 'task4_inference_sub'
  | 'task5_inference_sub'
  | 'task55_inference_sub'
  | 'task6_inference_sub'
  | 'task65_inference_sub'
  | 'task7_inference_sub'
  | 'task8_inference_sub'
  | 'task85_inference_sub'
  | 'task9_inference_sub'
  | 'task10_inference_sub'
  /** 深访对齐重跑后：修改项 diff 子行（灰/绿分色） */
  | 'alignment_diff_sub'
  /** 深访对齐：用户反馈原文（使用模式展示） */
  | 'alignment_user_feedback_sub'
  | 'requirement_supplement_prompt'
  | 'debug_step_continue_prompt'
  /** Target_KV 落库后：说人话推理结论（使用/调试均展示） */
  | 'inference_conclusion_sub';

type AlignmentDiffLinePayload = {
  field: string;
  before: string;
  after: string;
};

type AppendLineOpts = {
  /** 主要为 `bmc_generating`：行尾环形动画；`default` + `check` 用于分域「完成…逻辑提炼」行尾绿勾 */
  bmcGenUi?: 'spinner' | 'check';
  /** 仅 `bmc_generating` + spinner：行尾环用蓝色（提炼）；省略为琥珀色（BMC） */
  spinnerBlue?: boolean;
  /** 该行不参与逐字流式，一次性展示全文 */
  startFullyRevealed?: boolean;
  /**
   * 相对默认 ticker 的逐码点吞吐倍率（与 `PROGRESS_LONG_LINE_CP` / `PROGRESS_BURST_CP` 相乘后取整）；
   * 仅在不使用 `startFullyRevealed` 时生效；**【调试】** 灰块用 `PROGRESS_REVEAL_RATE_DEBUG`（1.5）。
   */
  revealRate?: number;
  /** 仅 `alignment_diff_sub`：结构化 diff 条目 */
  alignmentDiff?: AlignmentDiffLinePayload;
  /** `inference_conclusion_sub`：对应 graph `featureId`，已推送结论永不擦除 */
  inferenceFeatureId?: string;
};

function cpLen(s: string): number {
  return Array.from(s).length;
}

function sliceCp(s: string, n: number): string {
  if (n <= 0) return '';
  const arr = Array.from(s);
  return arr.slice(0, n).join('');
}

type ProgressLineModel = {
  id: number;
  full: string;
  cursor: number;
  /** 默认箭头行；`scope_green` 为任务 1 绿色引导；`user_quote` 为灰色引用块；`task2_alignment_questionnaire_sub` / `task3_alignment_questionnaire_sub` / `task3_inference_sub` / `task4_inference_sub` 为子区灰字 */
  kind: ProgressLineKind;
  bmcGenUi?: 'spinner' | 'check';
  /** `bmc_generating` 且 spinner：蓝色环（经营信息提炼）；否则行尾环为琥珀色 */
  spinnerBlue?: boolean;
  /** 缺省 1；`revealRate !== 1` 时与 `revealDebt` 配合做非整数倍逐码点 */
  revealRate?: number;
  /** `revealRate` 非 1 时的吞吐小数累加器（快照可恢复，避免刷新后节奏跳变） */
  revealDebt?: number;
  alignmentDiff?: AlignmentDiffLinePayload;
  inferenceFeatureId?: string;
};

/** 多轮「补充需求」会重复追加同文案进度行；`find` 会误命中首轮，须从尾部取当前轮待收尾行 */
function findLastProgressLineIndex(
  lines: ProgressLineModel[],
  pred: (line: ProgressLineModel) => boolean,
): number {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (pred(lines[i]!)) return i;
  }
  return -1;
}

/** 去掉任务 2「正在推理规模与组织模式（大模型）」转圈行（LLM 已返回或会话已失效时收尾） */
function removeTask2L1EntityLlmWorkingSpinnerLine(card: DynamicsCardModel | undefined): boolean {
  if (!card) return false;
  const spinIdx = findLastProgressLineIndex(
    card.lines,
    (l) => l.kind === 'bmc_generating' && l.full === TASK2_L1_ENTITY_LLM_WORKING_LINE,
  );
  if (spinIdx < 0) return false;
  card.lines.splice(spinIdx, 1);
  return true;
}

/** 去掉任务 3「正在进行行业与业务属性推理（大模型）」转圈行（须在目标 `cardsOut` 卡上调用，勿 clone 后再 `withTask*` 覆盖） */
function removeTask3L2LlmWorkingSpinnerFromCard(card: DynamicsCardModel | undefined): boolean {
  if (!card) return false;
  const spinIdx = findLastProgressLineIndex(
    card.lines,
    (l) => l.kind === 'bmc_generating' && l.full === TASK3_L2_INDUSTRY_LLM_WORKING_LINE,
  );
  if (spinIdx < 0) return false;
  card.lines.splice(spinIdx, 1);
  return true;
}

/** 去掉任务 3「正在写入 Target_KV…」转圈行（须在目标卡上 inline 调用） */
function removeTask3L2SyncSpinnerFromCard(card: DynamicsCardModel | undefined): boolean {
  if (!card) return false;
  const spinIdx = findLastProgressLineIndex(
    card.lines,
    (l) => l.kind === 'bmc_generating' && l.full === TASK3_SYNC_TARGET_KV_LINE,
  );
  if (spinIdx < 0) return false;
  card.lines.splice(spinIdx, 1);
  return true;
}

type DynamicsCardModel = {
  key: string;
  /** 设计任务线步（与 `designModeTaskPipeline` 一致；动态卡不会出现 `all_done`） */
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>;
  status: 'running' | 'completed';
  startedAtMs: number;
  completedAtMs: number | null;
  lines: ProgressLineModel[];
  /** 已消费到的本地进度 tail 行下标 */
  extraTailConsumed: number;
  /** 是否已排队「我已完成…」行（避免重复） */
  completionQueued: boolean;
  /** 任务线收官：「谢谢」行已追加 */
  thanksAppended: boolean;
  /** 已从持久化聊天恢复的「设计详情 BMC 生成」块时间戳，避免轮询重复追加 */
  lastDesignBmcHydratedKey?: string;
  /**
   * 任务 1 收官后展示用整秒：与聊天 `task1LlmQueryBlock.llmMeta.durationMs` 聚合一致；
   * 未设置时角标仍用 `completedAtMs - startedAtMs`（catch-up 新建卡墙钟常为 0）。
   */
  displayDurationSec?: number | null;
};

let progressLineIdSeq = 1;

function lastIndexOfTaskStart(messages: Array<Record<string, unknown>>, taskId: string): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.type === 'taskStartNotification' && String(m.taskId || '') === taskId) return i;
  }
  return -1;
}

function isOnlineMode(): boolean {
  return String((window as unknown as { APP_CONFIG?: { MODE?: string } }).APP_CONFIG?.MODE || '').toLowerCase() === 'online';
}

function getCaseIdForBackend(item: Record<string, unknown> | null): string {
  if (!item) return '';
  const id = item.id != null && String(item.id).trim() !== '' ? String(item.id).trim() : '';
  if (id) return id;
  return item.createdAt != null ? String(item.createdAt).trim() : '';
}

function normalizeProgressLine(raw: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (t.startsWith('→')) return t;
  return `→ ${t}`;
}

function aggregateTask1LlmUsage(messages: Array<Record<string, unknown>>): {
  inputTok: number;
  outputTok: number;
  hasAny: boolean;
} {
  let inputTok = 0;
  let outputTok = 0;
  let hasAny = false;
  for (const m of messages) {
    if (m?.type !== 'task1LlmQueryBlock') continue;
    const lm = (m as { llmMeta?: { usage?: Record<string, unknown> }; usage?: Record<string, unknown> }).llmMeta;
    const u = (lm?.usage || (m as { usage?: Record<string, unknown> }).usage) as Record<string, unknown> | undefined;
    if (u && typeof u === 'object') {
      hasAny = true;
      const pi = Number(u.prompt_tokens ?? u.promptTokens ?? 0);
      const co = Number(u.completion_tokens ?? u.completionTokens ?? 0);
      if (Number.isFinite(pi)) inputTok += pi;
      if (Number.isFinite(co)) outputTok += co;
    }
  }
  return { inputTok, outputTok, hasAny };
}

/** 聚合任务 1 相关 `task1LlmQueryBlock` 的 LLM 墙钟耗时（毫秒），与审计浮层 `durationMs` 同源 */
function aggregateTask1LlmDurationMs(messages: Array<Record<string, unknown>>): number {
  let total = 0;
  for (const m of messages) {
    if (m?.type !== 'task1LlmQueryBlock') continue;
    const meta = (m as { llmMeta?: { durationMs?: unknown } }).llmMeta;
    const top = (m as { durationMs?: unknown }).durationMs;
    const raw = meta?.durationMs ?? top;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

/**
 * 任务 1 进度卡「耗时 N 秒」与角标：优先用聊天块内 LLM duration 之和（与详情审计一致）；
 * 无 duration 元数据时退回墙钟秒数（如历史会话）。
 */
function deriveTask1ProgressDisplaySec(
  messages: Array<Record<string, unknown>>,
  wallSec: number,
): number {
  const llmMs = aggregateTask1LlmDurationMs(messages);
  if (llmMs > 0) return Math.max(1, Math.ceil(llmMs / 1000));
  return Math.max(0, Math.round(wallSec));
}

/** 历史「耗时0秒」完成行与角标：在仍有 LLM duration 时回填展示秒数 */
function repairTask1CompletionLineIfZeroDuration(
  card: DynamicsCardModel,
  messages: Array<Record<string, unknown>>,
): boolean {
  if (card.lineTaskId !== 'customer_basic' || card.status !== 'completed') return false;
  const idx = findLastProgressLineIndex(card.lines, (l) => isCompletedProgressLine(l.full));
  if (idx < 0) return false;
  const line = card.lines[idx]!;
  if (!String(line.full).includes('耗时0秒')) return false;
  const wallSec =
    card.completedAtMs != null
      ? Math.max(0, Math.round((card.completedAtMs - card.startedAtMs) / 1000))
      : 0;
  const sec = deriveTask1ProgressDisplaySec(messages, wallSec);
  if (sec <= 0) return false;
  const usage = aggregateTask1LlmUsage(messages);
  const inStr = formatTokenDisplay(usage.inputTok, usage.hasAny);
  const outStr = formatTokenDisplay(usage.outputTok, usage.hasAny);
  const newFull = formatCompletionLine(designLineTaskDisplayName('customer_basic'), sec, inStr, outStr);
  if (newFull === line.full) return false;
  line.full = newFull;
  line.cursor = cpLen(line.full);
  card.displayDurationSec = sec;
  return true;
}

/** 任务 1 已收尾：修正历史「耗时0秒」文案，并为角标写入与 LLM 块一致的 `displayDurationSec` */
function reconcileTask1CompletedCardDuration(
  card: DynamicsCardModel,
  messages: Array<Record<string, unknown>>,
): boolean {
  let changed = repairTask1CompletionLineIfZeroDuration(card, messages);
  const llmMs = aggregateTask1LlmDurationMs(messages);
  if (llmMs > 0) {
    const sec = Math.max(1, Math.ceil(llmMs / 1000));
    if (card.displayDurationSec == null || card.displayDurationSec === 0) {
      card.displayDurationSec = sec;
      changed = true;
    }
  }
  return changed;
}

function formatTokenDisplay(n: number, hasAny: boolean): string {
  if (!hasAny) return '—';
  return String(Math.max(0, Math.floor(n)));
}

function formatCompletionLine(
  taskDisplay: string,
  sec: number,
  inStr: string,
  outStr: string,
): string {
  return `→ 我已完成${taskDisplay}，耗时${sec}秒，输入 token ${inStr}，输出 token ${outStr}`;
}

function isCompletedProgressLine(full: string): boolean {
  return String(full).includes('我已完成') && String(full).includes('耗时');
}

export function useDesignDetailChat(caseIdRef: ReturnType<typeof ref<string>>) {
  /** 任务 2 L1：问卷已展示、等待用户回复以合成深访洞察（Input 5）；任务 3 L2 对齐态字段结构相同（Input 3）。 */
  type Task2L1AlignmentPendingState = {
    caseId: string;
    conflictDatasetUserBlock: string;
    questionnaireMarkdown: string;
    painPointTargetFeatureIds: string[];
  };

  /** 任务 6.5：子任务级对齐等待（含 pipeline 续跑快照） */
  type Task65L3AlignmentPendingState = Task2L1AlignmentPendingState & {
    progressLabel: string;
    stepIndex: number;
    perStepRawOutputs: string[];
    epochAtStart: number;
  };

  function applyPainPointConfirmedImmunityFromGraph(
    rows: Task2L1TvmParsedRow[],
    graph: DesignDetailLogicGraphTaskDto[] | null | undefined,
  ): Task2L1TvmParsedRow[] {
    if (!graph?.length) return rows;
    const confirmed = buildTask1PainPointConfirmedIndex(graph);
    if (!confirmed.size) return rows;
    return applyPainPointConfirmedImmunityToTvmRows(rows, confirmed);
  }

  function stashAlignmentPainTargetsForLineTask(
    caseId: string,
    lineTaskId: AlignmentDynamicsLineTaskId,
    conflictRows: ReadonlyArray<Task2L1TvmParsedRow>,
  ): void {
    writeAlignmentPainPointTargetFeatureIds(caseId, lineTaskId, conflictRows);
  }

  /** 深访问卷回复后、重跑本线步 LLM 前：任务 1 冲突节点 Validation_Status → Resolved_By_Customer */
  async function ensureTask1ValidationResolvedBeforeAlignmentRerun(
    caseId: string,
    lineTaskId: AlignmentDynamicsLineTaskId,
    painPointTargetFeatureIdsFromPending?: readonly string[],
  ): Promise<boolean> {
    const markVs = await markTask1ValidationResolvedForAlignmentLineTask(
      caseId,
      lineTaskId,
      painPointTargetFeatureIdsFromPending,
    );
    if (!markVs.ok) {
      loadError.value = markVs.message || '任务 1 Validation_Status 落库失败';
      return false;
    }
    return true;
  }
  /** 与 localStorage 对齐的当前任务线 id（刷新恢复） */
  const currentDesignLineTaskId = ref<DesignDetailLineTaskId>('optional_toolbox_primitive');
  const currentDesignLinePillText = computed(() =>
    designLinePillLabel(
      resolveDesignDetailCurrentLineTaskIdForDisplay(
        dynamicsCards.value,
        currentDesignLineTaskId.value,
      ),
    ),
  );

  const dynamicsCards = ref<DynamicsCardModel[]>([]);
  /** 左栏双 Tab 滚动位置（与 `leftPanelUi` 一并落库） */
  const leftPanelScrollProgress = ref(0);
  const leftPanelScrollChat = ref(0);
  /** hydrate 应用工作区快照后递增，供页面恢复 Tab 与滚动位置 */
  const leftPanelUiRestoreTick = ref(0);

  function readLeftPanelUiForPersist(): DesignDetailLeftPanelUiSnapshot {
    return {
      chatPanelMode: designDetailChatPanelMode.value,
      scrollProgress: Math.max(0, Math.floor(leftPanelScrollProgress.value)),
      scrollChat: Math.max(0, Math.floor(leftPanelScrollChat.value)),
    };
  }

  function applyLeftPanelUiFromSnapshot(ui?: DesignDetailLeftPanelUiSnapshot): void {
    const mode: DesignDetailChatPanelMode = ui?.chatPanelMode === 'chat' ? 'chat' : 'progress';
    setDesignDetailChatPanelMode(mode);
    leftPanelScrollProgress.value =
      typeof ui?.scrollProgress === 'number' && Number.isFinite(ui.scrollProgress) && ui.scrollProgress >= 0
        ? Math.floor(ui.scrollProgress)
        : 0;
    leftPanelScrollChat.value =
      typeof ui?.scrollChat === 'number' && Number.isFinite(ui.scrollChat) && ui.scrollChat >= 0
        ? Math.floor(ui.scrollChat)
        : 0;
    leftPanelUiRestoreTick.value += 1;
  }

  function noteLeftPanelScroll(panel: 'progress' | 'chat', scrollTop: number): void {
    const v = Math.max(0, Math.floor(scrollTop));
    if (panel === 'progress') {
      if (leftPanelScrollProgress.value === v) return;
      leftPanelScrollProgress.value = v;
    } else {
      if (leftPanelScrollChat.value === v) return;
      leftPanelScrollChat.value = v;
    }
    queuePersistDesignDetailProgressWorkspace();
  }

  function setDesignDetailChatPanelModeAndPersist(mode: DesignDetailChatPanelMode): void {
    if (designDetailChatPanelMode.value === mode) return;
    setDesignDetailChatPanelMode(mode);
    queuePersistDesignDetailProgressWorkspace();
  }

  /** 「聊天」Tab：用户消息 + 任务开/收官 + 推理结论 + 深访问卷 */
  const designChatTimeline = computed(() =>
    buildDesignDetailChatTimeline(
      lastHydratedMessages.value,
      dynamicsCards.value.map((c) => ({
        key: c.key,
        lineTaskId: c.lineTaskId,
        startedAtMs: c.startedAtMs,
        completedAtMs: c.completedAtMs,
        lines: c.lines.map((r) => ({
          id: r.id,
          full: r.full,
          kind: String(r.kind || 'default'),
        })),
      })),
    ),
  );

  const dynamicsCardsView = computed(() => {
    const mapped = dynamicsCards.value.map((c) => {
      const titleText = designLinePillLabel(c.lineTaskId);
      const rows = c.lines
        .filter((r) => isDesignDetailProgressLineVisibleForExperience({ kind: r.kind, full: r.full }))
        .map((r) => {
          const kind = normalizeTokenValidationMappingProgressLineKind(r.kind, r.full) as ProgressLineKind;
          return {
            id: String(r.id),
            text: sliceCp(r.full, r.cursor),
            kind,
            bmcGenUi: r.bmcGenUi,
            spinnerBlue: r.spinnerBlue,
            alignmentDiff: r.alignmentDiff,
          };
        });
      if (
        !isDesignDetailDebugExperienceActive() &&
        rows.length === 0 &&
        (c.lines?.length ?? 0) > 0
      ) {
        rows.push({
          id: `usage-placeholder-${c.key}`,
          text: buildUsageModeHiddenProgressPlaceholder(titleText),
          kind: 'default' as ProgressLineKind,
        });
      }
      return {
        key: c.key,
        lineTaskId: c.lineTaskId,
        titleText,
        cardTone: c.status === 'completed' ? ('mint_done' as const) : ('amber' as const),
        completed: c.status === 'completed',
        startedAtMs: c.startedAtMs,
        completedAtMs: c.completedAtMs,
        durationSec:
          c.status === 'completed' && c.completedAtMs != null
            ? typeof c.displayDurationSec === 'number' &&
              Number.isFinite(c.displayDurationSec) &&
              c.displayDurationSec >= 0
              ? Math.floor(c.displayDurationSec)
              : Math.max(0, Math.round((c.completedAtMs - c.startedAtMs) / 1000))
            : null,
        rows,
      };
    });
    return filterDynamicsCardViewsForUsageMode(
      dynamicsCards.value.map((c) => ({
        key: c.key,
        lineTaskId: c.lineTaskId,
        status: c.status,
        lines: c.lines,
      })),
      mapped,
    );
  });

  const loadError = ref<string | null>(null);
  const pollTimer = ref<ReturnType<typeof setInterval> | null>(null);
  const lastResolvedItem = ref<Record<string, unknown> | null>(null);
  const lastHydratedMessages = shallowRef<Array<Record<string, unknown>>>([]);
  const lastHydratedItem = shallowRef<Record<string, unknown> | null>(null);
  const lastHydratedPreliminaryFollowupActive = ref(false);
  const sendBusy = ref(false);
  const restartBusy = ref(false);
  const fullRestartBusy = ref(false);
  /** 底部输入框草稿，与任务进展工作区一并持久化 */
  const designDetailChatDraft = ref('');
  const designChatInputPlaceholder = ref('描述设计意图或约束…');
  /** 与 `designDetailCustomerRequirementPhase.ts` 同源；在 hydrate / 画布就绪 / 需求提炼完成 / 重启时更新 */
  const task1CustomerRequirementPhase = ref<DesignDetailCustomerRequirementPhase>('idle');
  const designOnlyProgressTail = ref<string[]>([]);

  /** 右侧画布区：横向 Tab（首项固定「案例概览」，提炼成功后追加「客户基本信息」） */
  const designCanvasTabs = ref<DesignCanvasTab[]>([
    { id: 'case_overview', label: '案例概览', kind: 'case_overview' },
  ]);
  const activeDesignCanvasTabId = ref('case_overview');
  const customerBasicCanvasRows = ref<CustomerBasicCanvasRow[]>([]);
  /** 右侧「需求提炼」Tab：自上而下多条根卡片（与聊天中「设计详情客户需求提炼」块同步；**新在上**） */
  const customerRequirementCanvasEntries = ref<CustomerRequirementCanvasEntry[]>([]);
  /** 「合并需求」根卡片当前子 Tab */
  const mergedRequirementActiveSubTabKey = ref<string>(
    CUSTOMER_REQUIREMENT_CANVAS_FIELDS[0]?.key ?? 'businessContext',
  );
  /** 每批需求提炼（管理资源分域同步）结束后增量合并写入；与聊天条数对齐见 `lastMergedRequirementEntryCount` */
  const mergedRequirementParsedOverride = ref<Record<string, unknown> | null>(null);
  /** 最近一次增量合并完成时 `customerRequirementCanvasEntries` 条数，供快照恢复；不在此因「新条落库」清空 override */
  const lastMergedRequirementEntryCount = ref(0);
  /** 合并完成后递增，供 `DesignDetailPage` 自动展开「合并需求」卡 */
  const mergedRequirementMergeDoneTick = ref(0);
  /** 任务 2 L1 同步后递增，供顶栏 Tree 在已打开时重新拉取推理图 */
  const logicTreeGraphRefreshTick = ref(0);
  const architectureInventoryGraphRefreshTick = ref(0);
  /** 设计报告 LLM 子任务落库后递增，驱动「设计报告」子 Tab 重读缓存 */
  const designReportContentRefreshTick = ref(0);
  /** 递增后请求架构清单子 Tab 切至「设计报告」 */
  const designReportSubTabFocusTick = ref(0);
  const businessProcessSubTabFocusTick = ref(0);
  const functionInventorySubTabFocusTick = ref(0);
  /** 调试门闩：点「继续」后执行的下一阶段异步逻辑（不入快照，刷新后丢弃） */
  const pendingDebugPipelineContinueAction = shallowRef<(() => Promise<void>) | null>(null);
  const debugPipelineContinueBusy = ref(false);
  const requirementMergeBusy = ref(false);
  /** 任务 2（L1 实体画像）LLM 调用中：防重复点「否」并短暂门控底部发送 */
  const task2EntityPortraitBusy = ref(false);
  /** 任务 2 L1：对齐问卷生成中（释放 task2EntityPortraitBusy 后仍提示底部稍候） */
  const task2L1AlignmentQuestionnaireBusy = ref(false);
  const task2L1AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  /** 任务 3 L2：反向验证潜在冲突对齐问卷生成中 */
  const task3L2AlignmentQuestionnaireBusy = ref(false);
  const task3L2AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  /** 任务 4 L2：反向验证潜在冲突对齐问卷生成中 */
  const task4L2AlignmentQuestionnaireBusy = ref(false);
  const task4L2AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  /** 任务 5 L3：反向验证潜在冲突对齐问卷生成中 */
  const task5L3AlignmentQuestionnaireBusy = ref(false);
  const task5L3AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  /** 任务 5.1 L3.1：反向验证潜在冲突对齐问卷生成中 */
  const task51L3AlignmentQuestionnaireBusy = ref(false);
  const task51L3AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  /** 任务 5.5 L3.5：反向验证潜在冲突对齐问卷生成中 */
  const task55L3AlignmentQuestionnaireBusy = ref(false);
  const task55L3AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  /** 任务 6 L3：反向验证潜在冲突对齐问卷生成中 */
  const task6L3AlignmentQuestionnaireBusy = ref(false);
  const task6L3AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  /** 任务 6.5 L3：反向验证潜在冲突对齐问卷生成中 */
  const task65L3AlignmentQuestionnaireBusy = ref(false);
  const task65L3AlignmentPending = ref<Task65L3AlignmentPendingState | null>(null);
  const task7L4AlignmentQuestionnaireBusy = ref(false);
  const task7L4AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  const task8L45AlignmentQuestionnaireBusy = ref(false);
  const task8L45AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  const task85L475AlignmentQuestionnaireBusy = ref(false);
  const task85L475AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  const task9L5AlignmentQuestionnaireBusy = ref(false);
  const task9L5AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);
  const task10L5AlignmentQuestionnaireBusy = ref(false);
  const task10L5AlignmentPending = ref<Task2L1AlignmentPendingState | null>(null);

  /** hydrate / 发送前：从进度卡 + localStorage 问卷恢复内存 pending（避免误走 task1 BMC 路径） */
  function syncAlignmentPendingStatesFromPersisted(rawId: string): void {
    const cid = String(rawId || '').trim();
    if (!cid) return;
    const cards = dynamicsCards.value;
    for (const spec of ALIGNMENT_PENDING_RESTORE_SPECS) {
      if (spec.lineTaskId === 'scale_org_mode_extract' && task2L1AlignmentPending.value) continue;
      if (spec.lineTaskId === 'industry_business_profile_extract' && task3L2AlignmentPending.value) continue;
      if (spec.lineTaskId === 'core_value_driver_inference' && task4L2AlignmentPending.value) continue;
      if (spec.lineTaskId === 'macro_process_flow_inference' && task5L3AlignmentPending.value) continue;
      if (spec.lineTaskId === 'value_proposition_capability_units' && task51L3AlignmentPending.value) continue;
      if (spec.lineTaskId === 'vsm_stage_decomposition' && task55L3AlignmentPending.value) continue;
      if (spec.lineTaskId === 'pain_point_extraction' && task6L3AlignmentPending.value) continue;
      if (spec.lineTaskId === 'three_dimension_itgap_analysis' && task65L3AlignmentPending.value) continue;
      if (spec.lineTaskId === 'key_requirement_scenarios' && task7L4AlignmentPending.value) continue;
      if (spec.lineTaskId === 'role_object_stm_inference' && task8L45AlignmentPending.value) continue;
      if (spec.lineTaskId === 'physical_hook_integration_inference' && task85L475AlignmentPending.value)
        continue;
      if (spec.lineTaskId === 'business_capability_positioning' && task9L5AlignmentPending.value) continue;
      if (spec.lineTaskId === 'process_type_derivation' && task10L5AlignmentPending.value) continue;
      const restored = resolveAlignmentPendingFromPersisted(cid, cards, spec);
      if (!restored) continue;
      if (spec.lineTaskId === 'scale_org_mode_extract') task2L1AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'industry_business_profile_extract') task3L2AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'core_value_driver_inference') task4L2AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'macro_process_flow_inference') task5L3AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'value_proposition_capability_units') task51L3AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'vsm_stage_decomposition') task55L3AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'pain_point_extraction') task6L3AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'three_dimension_itgap_analysis') {
        const base = restored;
        if (base) {
          const resume = readTask65PipelineResume(cid);
          task65L3AlignmentPending.value = {
            ...base,
            progressLabel: resume?.progressLabel ?? '',
            stepIndex: resume?.stepIndex ?? 0,
            perStepRawOutputs: resume?.perStepRawOutputs ?? [],
            epochAtStart: resume?.epochAtStart ?? designDetailSessionGeneration,
          };
        }
      }
      else if (spec.lineTaskId === 'key_requirement_scenarios') task7L4AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'role_object_stm_inference') task8L45AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'physical_hook_integration_inference')
        task85L475AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'business_capability_positioning') task9L5AlignmentPending.value = restored;
      else if (spec.lineTaskId === 'process_type_derivation') task10L5AlignmentPending.value = restored;
    }
  }

  function hasAnyAlignmentPendingRef(): boolean {
    return !!(
      task2L1AlignmentPending.value ||
      task3L2AlignmentPending.value ||
      task4L2AlignmentPending.value ||
      task5L3AlignmentPending.value ||
      task51L3AlignmentPending.value ||
      task55L3AlignmentPending.value ||
      task6L3AlignmentPending.value ||
      task65L3AlignmentPending.value ||
      task7L4AlignmentPending.value ||
      task8L45AlignmentPending.value ||
      task85L475AlignmentPending.value ||
      task9L5AlignmentPending.value ||
      task10L5AlignmentPending.value
    );
  }

  /** 多轮提炼、尚未点「否」做 LLM 精合并时：用 `summarizeMergeTwoStrings` 规则链预填「合并需求」各 Tab，避免空白 */
  const mergedRequirementBaselinePreview = ref<Record<string, unknown> | null>(null);

  function scheduleMergedRequirementBaselinePreviewRefresh(): void {
    if (mergedBaselinePreviewTimer) clearTimeout(mergedBaselinePreviewTimer);
    mergedBaselinePreviewTimer = setTimeout(() => {
      mergedBaselinePreviewTimer = null;
      void refreshMergedRequirementBaselinePreview();
    }, 380);
  }

  async function refreshMergedRequirementBaselinePreview(): Promise<void> {
    const myGen = ++mergedBaselinePreviewGen;
    if (requirementMergeBusy.value) return;
    if (mergedRequirementParsedOverride.value != null) return;
    const oldestFirst = [...customerRequirementCanvasEntries.value].sort((a, b) =>
      String(a.isoTimestamp).localeCompare(String(b.isoTimestamp)),
    );
    if (oldestFirst.length < 2) {
      mergedRequirementBaselinePreview.value = null;
      return;
    }
    try {
      let acc = deepCloneParsed(oldestFirst[0]!.parsed);
      for (let j = 1; j < oldestFirst.length; j += 1) {
        const entry = oldestFirst[j]!;
        for (const { key } of REQUIREMENT_MERGE_TAB_KEYS) {
          acc[key] = await mergeRequirementTabSliceAsync(key, acc[key], entry.parsed[key], undefined, [key]);
        }
        const summaryMerged = await mergeCorePainPointSummaryFieldAsync(acc, entry.parsed, undefined);
        if (summaryMerged) acc.corePainPointSummary = summaryMerged;
      }
      if (myGen !== mergedBaselinePreviewGen) return;
      mergedRequirementBaselinePreview.value = acc;
    } catch {
      if (myGen !== mergedBaselinePreviewGen) return;
      mergedRequirementBaselinePreview.value = null;
    }
  }

  const mergedCustomerRequirementParsed = computed(() => {
    if (mergedRequirementParsedOverride.value) {
      return mergedRequirementParsedOverride.value;
    }
    const entries = customerRequirementCanvasEntries.value;
    if (entries.length >= 2 && mergedRequirementBaselinePreview.value) {
      return mergedRequirementBaselinePreview.value;
    }
    return mergeCustomerRequirementParsedFromEntries(entries);
  });

  const REQUIREMENT_DISTILL_TAB_ID = 'requirement_distill';
  const CURRENT_STATE_UNDERSTANDING_TAB_ID = 'current_state_understanding';
  const DIAGNOSTIC_REVIEW_TAB_ID = 'diagnostic_review';
  const diagnosticReviewStepCards = ref<Record<string, DiagnosticReviewStepCard>>({});
  const diagnosticReviewRefreshTick = ref(0);

  /** 任务 5.1 模型原文（供「现状理解」画布）；随进度工作区快照持久化 */
  const task51L3MatrixRawOutput = ref('');
  const currentStateUnderstandingGraphTasks = ref<DesignDetailLogicGraphTaskDto[]>([]);
  const currentStateUnderstandingRefreshTick = ref(0);

  /** 拉取推理图并刷新「现状理解」内 5.2 字段集子卡（5.1 原文须已存在） */
  async function refreshCurrentStateUnderstandingFromTaskGraph(caseIdForGraph: string): Promise<void> {
    const cid = String(caseIdForGraph || '').trim();
    if (!cid || !task51L3MatrixRawOutput.value.trim()) return;
    const getGraph = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (
              id: string,
            ) => Promise<{ ok?: boolean; data?: { tasks?: unknown[] } } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;
    if (typeof getGraph !== 'function') return;
    try {
      const gr = await getGraph(cid);
      if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        currentStateUnderstandingGraphTasks.value = normalizeLogicGraphTasksFromApiPayload(
          gr.data.tasks as DesignDetailLogicGraphTaskDto[],
        );
        currentStateUnderstandingRefreshTick.value += 1;
      }
    } catch {
      /* 画布刷新失败不阻断主链路 */
    }
  }

  function resolveCustomerDisplayNameForCanvas(): string {
    try {
      const u = new URL(window.location.href);
      const n = String(u.searchParams.get('customerName') || '').trim();
      if (n) return n;
    } catch {
      /* ignore */
    }
    const item = (lastResolvedItem.value ?? lastHydratedItem.value) as Record<string, unknown> | null;
    if (item) {
      const cn = item.customerName ?? item.name ?? item.companyName;
      if (cn != null && String(cn).trim()) return String(cn).trim();
    }
    return '客户';
  }

  /** 任务 5.1 收官后：写入原文、在「需求提炼」右侧插入「现状理解」Tab 并切至该 Tab */
  function applyTask51CurrentStateUnderstandingCanvas(l51Raw: string): void {
    const raw = String(l51Raw || '').trim();
    if (!raw) return;
    task51L3MatrixRawOutput.value = raw;
    currentStateUnderstandingRefreshTick.value += 1;
    ensureCurrentStateUnderstandingTab();
    void refreshCurrentStateUnderstandingFromTaskGraph(String(caseIdRef.value || '').trim());
  }

  /** 「现状理解」Tab 紧挨「需求提炼」右侧；首次追加时可选切至该 Tab */
  function ensureCurrentStateUnderstandingTab(switchToTab = true): void {
    const tabs = designCanvasTabs.value;
    if (tabs.some((t) => t.kind === 'current_state_understanding')) {
      if (switchToTab) activeDesignCanvasTabId.value = CURRENT_STATE_UNDERSTANDING_TAB_ID;
      return;
    }
    const newTab: DesignCanvasTab = {
      id: CURRENT_STATE_UNDERSTANDING_TAB_ID,
      label: '现状理解',
      kind: 'current_state_understanding',
    };
    const reqIdx = tabs.findIndex((t) => t.kind === 'requirement_distill');
    if (reqIdx >= 0) {
      const next = tabs.slice();
      next.splice(reqIdx + 1, 0, newTab);
      designCanvasTabs.value = next;
    } else {
      designCanvasTabs.value = [...tabs, newTab];
    }
    if (switchToTab) activeDesignCanvasTabId.value = CURRENT_STATE_UNDERSTANDING_TAB_ID;
  }

  /** 「诊断梳理」Tab 紧挨「现状理解」右侧；任务 6.5 推理开始时追加 */
  function ensureDiagnosticReviewTab(switchToTab = false): void {
    const tabs = designCanvasTabs.value;
    if (tabs.some((t) => t.kind === 'diagnostic_review')) {
      if (switchToTab) activeDesignCanvasTabId.value = DIAGNOSTIC_REVIEW_TAB_ID;
      return;
    }
    const newTab: DesignCanvasTab = {
      id: DIAGNOSTIC_REVIEW_TAB_ID,
      label: '诊断梳理',
      kind: 'diagnostic_review',
    };
    const csuIdx = tabs.findIndex((t) => t.kind === 'current_state_understanding');
    if (csuIdx >= 0) {
      const next = tabs.slice();
      next.splice(csuIdx + 1, 0, newTab);
      designCanvasTabs.value = next;
    } else {
      const reqIdx = tabs.findIndex((t) => t.kind === 'requirement_distill');
      if (reqIdx >= 0) {
        const next = tabs.slice();
        next.splice(reqIdx + 1, 0, newTab);
        designCanvasTabs.value = next;
      } else {
        designCanvasTabs.value = [...tabs, newTab];
      }
    }
    if (switchToTab) activeDesignCanvasTabId.value = DIAGNOSTIC_REVIEW_TAB_ID;
  }

  function applyTask65SubtaskDiagnosticReviewCanvas(
    sub: Pick<Task65ItGapSubtask, 'progressLabel' | 'phaseLabel' | 'workflowName' | 'stepName'>,
    stepRaw: string,
  ): void {
    ensureDiagnosticReviewTab(false);
    const card = parseDiagnosticReviewStepCardFromTask65Raw(stepRaw, sub);
    if (!card) return;
    diagnosticReviewStepCards.value = upsertDiagnosticReviewStepCard(
      diagnosticReviewStepCards.value,
      card,
    );
    diagnosticReviewRefreshTick.value += 1;
  }

  function startTask65DiagnosticReviewCanvas(): void {
    ensureDiagnosticReviewTab(true);
  }

  function clearDiagnosticReviewCanvas(): void {
    diagnosticReviewStepCards.value = {};
    diagnosticReviewRefreshTick.value += 1;
    designCanvasTabs.value = designCanvasTabs.value.filter((t) => t.kind !== 'diagnostic_review');
    if (activeDesignCanvasTabId.value === DIAGNOSTIC_REVIEW_TAB_ID) {
      activeDesignCanvasTabId.value = designCanvasTabs.value.some(
        (t) => t.kind === 'current_state_understanding',
      )
        ? CURRENT_STATE_UNDERSTANDING_TAB_ID
        : 'case_overview';
    }
  }

  /** 「需求提炼」Tab 固定在最右侧（晚于案例概览、客户基本信息等已存在 Tab）；**本函数内首次追加**时切到该 Tab */
  function ensureRequirementDistillTab() {
    const tabs = designCanvasTabs.value;
    if (tabs.some((t) => t.kind === 'requirement_distill')) return;
    designCanvasTabs.value = tabs.concat({
      id: REQUIREMENT_DISTILL_TAB_ID,
      label: '需求提炼',
      kind: 'requirement_distill',
    });
    activeDesignCanvasTabId.value = REQUIREMENT_DISTILL_TAB_ID;
  }

  /** 首次追加「架构清单」Tab 并切至该 Tab */
  function ensureArchitectureInventoryTab() {
    const tabs = designCanvasTabs.value;
    if (tabs.some((t) => t.kind === 'architecture_inventory')) return;
    designCanvasTabs.value = tabs.concat({
      id: ARCHITECTURE_INVENTORY_TAB_ID,
      label: '架构清单',
      kind: 'architecture_inventory',
    });
    activeDesignCanvasTabId.value = ARCHITECTURE_INVENTORY_TAB_ID;
  }

  function setActiveArchitectureInventoryTab() {
    activeDesignCanvasTabId.value = ARCHITECTURE_INVENTORY_TAB_ID;
  }

  function saveLineStepHoldThroughTask10(rawId: string, currentTaskId: DesignDetailLineTaskId): void {
    saveDesignDetailLineState(rawId, {
      schemaVersion: 1,
      currentTaskId,
      holdPastTask3: false,
      holdPastTask4: false,
      holdPastTask5: false,
      holdPastTask55: true,
      holdPastTask6: true,
      holdPastTask7: true,
      holdPastTask8: true,
      holdPastTask85: true,
      holdPastTask9: true,
      holdPastTask10: true,
    });
    currentDesignLineTaskId.value = currentTaskId;
  }

  function advanceLineStepToTask11(rawId: string): void {
    saveLineStepHoldThroughTask10(rawId, 'process_node_design');
  }

  function advanceLineStepToTask12(rawId: string): void {
    saveLineStepHoldThroughTask10(rawId, 'role_and_business_object_derivation');
  }

  function advanceLineStepToTask13(rawId: string): void {
    saveLineStepHoldThroughTask10(rawId, 'module_abstract_design');
  }

  /** 任务 13 完成后线步推进至任务 14（ER 图生成） */
  function advanceLineStepAfterTask13Complete(rawId: string): void {
    saveLineStepHoldThroughTask10(rawId, 'field_design');
  }

  function ensureDynamicsCardForLineTask(
    rawId: string,
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
  ): DynamicsCardModel {
    return withLineTaskDynamicsCard((card) => card, rawId, lineTaskId)!;
  }

  /**
   * 在最新 dynamics 快照上改指定线步动态卡并写回（与 `withTask3L2DynamicsCard` 同构）。
   * 禁止 mutator 后 `dynamicsCards.value = cloneDynamics()`，否则修改落在陈旧克隆上会被丢弃。
   */
  function withLineTaskDynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    rawId: string,
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    let card = findDynamicsCardByLineTaskId(cards, lineTaskId);
    if (!card) {
      card = {
        key: `${lineTaskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId,
        status: 'running',
        startedAtMs: Date.now(),
        completedAtMs: null,
        lines: [],
        extraTailConsumed: 0,
        completionQueued: false,
        thanksAppended: false,
      };
      cards.push(card);
    }
    mutator(card);
    dynamicsCards.value = cards;
    if (rawId) ensureRevealTicker(rawId);
    return card;
  }

  function completeDynamicsCardForLineTask(
    rawId: string,
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
  ): void {
    withLineTaskDynamicsCard((card) => {
      card.status = 'completed';
      card.completedAtMs = Date.now();
    }, rawId, lineTaskId);
  }

  function pruneRequirementDistillTabIfEmpty() {
    if (customerRequirementCanvasEntries.value.length > 0) return;
    const tabs = designCanvasTabs.value.filter((t) => t.kind !== 'requirement_distill');
    if (tabs.length !== designCanvasTabs.value.length) {
      designCanvasTabs.value = tabs;
      if (activeDesignCanvasTabId.value === REQUIREMENT_DISTILL_TAB_ID) {
        activeDesignCanvasTabId.value = 'case_overview';
      }
    }
  }

  /** 从持久化聊天重建需求画布条目（保留各根卡片已选子 Tab） */
  function syncCustomerRequirementCanvasEntriesFromMessages(messages: Array<Record<string, unknown>>) {
    const blocks = collectCustomerRequirementBlocksFromChat(messages);
    if (blocks.length === 0) {
      customerRequirementCanvasEntries.value = [];
      mergedRequirementParsedOverride.value = null;
      lastMergedRequirementEntryCount.value = 0;
      mergedBaselinePreviewGen += 1;
      mergedRequirementBaselinePreview.value = null;
      if (mergedBaselinePreviewTimer) {
        clearTimeout(mergedBaselinePreviewTimer);
        mergedBaselinePreviewTimer = null;
      }
      pruneRequirementDistillTabIfEmpty();
      return;
    }
    const prevTabs = new Map(
      customerRequirementCanvasEntries.value.map((e) => [e.isoTimestamp, e.activeSubTabKey]),
    );
    const defaultKey = CUSTOMER_REQUIREMENT_CANVAS_FIELDS[0]?.key ?? 'requirement_summary';
    const mapped = blocks.map((b, idx) => ({
      id: `req-${b.timestamp || 'na'}-${idx}`,
      isoTimestamp: b.timestamp,
      titleTimeLabel: formatRequirementCanvasTitleLabel(b.timestamp),
      distillOrdinal: b.distillOrdinal,
      parsed: b.parsed,
      activeSubTabKey: prevTabs.get(b.timestamp) ?? defaultKey,
    }));
    mapped.sort((a, b) => String(b.isoTimestamp).localeCompare(String(a.isoTimestamp)));
    customerRequirementCanvasEntries.value = mapped;
    const len = mapped.length;
    if (len < 2) {
      mergedBaselinePreviewGen += 1;
      mergedRequirementBaselinePreview.value = null;
      if (mergedBaselinePreviewTimer) {
        clearTimeout(mergedBaselinePreviewTimer);
        mergedBaselinePreviewTimer = null;
      }
    } else if (!mergedRequirementParsedOverride.value) {
      scheduleMergedRequirementBaselinePreviewRefresh();
    }
    ensureRequirementDistillTab();
  }

  /**
   * 本页「重启当前」后为 true：轮询 hydrate **不**根据持久化聊天向任务动态卡追加 BMC/尾段/完成行等，避免刚清空的进度被立即写回。
   * 用户再次在底部发送后置 false。
   */
  const designDynamicsSuppressPersistedReplay = ref(false);

  /**
   * 与工作区快照字段 `llmStatsIncludeFromMessageIndex` 对齐：「重启当前」成功结束时设为当时消息长度（持久化聊天可仍含更早消息，本值用于快照/hydrate 一致性）；切换 `caseId` 时归零。
   */
  const llmStatsIncludeFromMessageIndex = ref(0);

  /** 构建工作区快照指纹（覆盖 debounce/watch 可能监听的变量）；须在本 composable 内各 ref 声明之后定义 */
  function buildWorkspaceFingerprint(): string {
    return [
      dynamicsCards.value.length,
      JSON.stringify(designOnlyProgressTail.value),
      task1CustomerRequirementPhase.value,
      designCanvasTabs.value.length,
      activeDesignCanvasTabId.value,
      customerBasicCanvasRows.value.length,
      customerRequirementCanvasEntries.value.length,
      currentDesignLineTaskId.value,
      designDynamicsSuppressPersistedReplay.value,
      llmStatsIncludeFromMessageIndex.value,
      designDetailChatDraft.value,
      lastHydratedMessages.value.length,
      _cachedMsgFp ? `${_cachedMsgFp.len}:${_cachedMsgFp.lastId}` : '',
    ].join('|');
  }

  /** 设计详情每次 LLM 调用结束后递增；「重启当前」成功收尾也会递增，供 `DesignDetailLlmLogFloatingPanel` 在打开时重新 `fetchCaseLlmLogs`（否则浮层常开时仍显示清库前的列表） */
  const llmLogAuditRefreshTick = ref(0);
  function bumpLlmLogAuditRefresh() {
    llmLogAuditRefreshTick.value += 1;
  }

  function withLlmAuditCtx<T>(ctx: { caseId: string; taskId: string; callTarget: string }, fn: () => Promise<T>) {
    return withDesignDetailLlmLogContext(ctx, fn, bumpLlmLogAuditRefresh);
  }

  /** 深访问卷/合成：与 `withLlmAuditCtx` 同 ctx 显式传入 `fetchDeepSeekChat`，避免仅依赖全局 context */
  function designDetailLlmFetchOpts(
    ctx: { caseId: string; taskId: string; callTarget: string },
    extra?: { signal?: AbortSignal },
  ) {
    return {
      ...(extra?.signal ? { signal: extra.signal } : {}),
      llmLog: {
        caseId: ctx.caseId,
        taskId: ctx.taskId,
        callTarget: ctx.callTarget,
      },
    };
  }

  /** 与点「否」时旧版批量合并相同的大模型字符串合并器（审计 `需求#batch合并#token`） */
  function createRequirementMergeStringMerger(
    rawId: string,
    mergeRequirementBatchId: number,
  ): RequirementMergeStringMerger {
    return async (a, b, ctx) => {
      const A = String(a ?? '').trim();
      const B = String(b ?? '').trim();
      if (!A) return B;
      if (!B) return A;
      if (A === B) return a;
      const token = tokenSurfaceForMergePath(ctx.tabKey, ctx.path);
      const w = window as unknown as {
        summarizeDesignDetailRequirementMergeByLlm?: (o: Record<string, unknown>) => Promise<{
          mergedText?: string;
        }>;
      };
      if (typeof w.summarizeDesignDetailRequirementMergeByLlm !== 'function') {
        return summarizeMergeTwoStrings(a, b);
      }
      const tabLabel = REQUIREMENT_MERGE_TAB_KEYS.find((x) => x.key === ctx.tabKey)?.label ?? ctx.tabKey;
      try {
        const res = await withLlmAuditCtx(
          {
            caseId: rawId,
            taskId: DESIGN_DETAIL_TASK1_LLM_AUDIT_TASK_ID,
            callTarget: `需求#${mergeRequirementBatchId}合并#${token}`,
          },
          () =>
            w.summarizeDesignDetailRequirementMergeByLlm!({
              tokenSurface: token,
              tabLabel,
              textA: a,
              textB: b,
            }),
        );
        const mt = typeof res?.mergedText === 'string' ? res.mergedText.trim() : '';
        return mt || summarizeMergeTwoStrings(a, b);
      } catch {
        return summarizeMergeTwoStrings(a, b);
      }
    };
  }

  /**
   * 管理资源等分域同步成功后：将**本批** `parsed` 按 Tab 合并入 `mergedRequirementParsedOverride`（大模型 token 合并逻辑与旧版「否」批量合并一致）。
   */
  async function runIncrementalMergeTotalRequirementAfterDistill(
    rawId: string,
    batchOrdinal: number,
    parsedRec: Record<string, unknown>,
  ): Promise<void> {
    const cid = String(rawId || '').trim();
    if (!cid) return;
    requirementMergeBusy.value = true;
    mergedBaselinePreviewGen += 1;
    mergedRequirementBaselinePreview.value = null;
    if (mergedBaselinePreviewTimer) {
      clearTimeout(mergedBaselinePreviewTimer);
      mergedBaselinePreviewTimer = null;
    }
    try {
      ensureTask1DynamicsCard();
      let cards = cloneDynamics();
      const cHead = cards.find((c) => c.lineTaskId === 'customer_basic');
      if (cHead) {
        appendLineToCard(
          cHead,
          `→ 将需求批次#${batchOrdinal} 合并入总体需求`,
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cards;
      ensureRevealTicker(cid);
      await delayMs(220);

      const mergeStrings = createRequirementMergeStringMerger(cid, batchOrdinal);
      let mergedAcc = mergedRequirementParsedOverride.value
        ? deepCloneParsed(mergedRequirementParsedOverride.value)
        : ({} as Record<string, unknown>);

      for (let ti = 0; ti < REQUIREMENT_MERGE_TAB_KEYS.length; ti += 1) {
        const { key, label } = REQUIREMENT_MERGE_TAB_KEYS[ti]!;
        const { newTokens, updatedTokens } = countRequirementTabMergeTokenDelta(
          key,
          mergedAcc[key],
          parsedRec[key],
        );
        mergedAcc[key] = await mergeRequirementTabSliceAsync(
          key,
          mergedAcc[key],
          parsedRec[key],
          mergeStrings,
          [key],
        );
        mergedRequirementParsedOverride.value = { ...mergedAcc };
        cards = cloneDynamics();
        const cTab = cards.find((c) => c.lineTaskId === 'customer_basic');
        if (cTab) {
          if (isDesignDetailDebugExperienceActive()) {
            appendLineToCard(
              cTab,
              `   （${ti + 1}/${REQUIREMENT_MERGE_TAB_COUNT}）「${label}」｜新增 token ${newTokens} 个，更新 token ${updatedTokens} 个；`,
              'default',
              { startFullyRevealed: true },
            );
          } else {
            appendLineToCard(cTab, `→ （${ti + 1}/${REQUIREMENT_MERGE_TAB_COUNT}）「${label}」`, 'default', {
              startFullyRevealed: true,
              bmcGenUi: 'check',
            });
          }
        }
        dynamicsCards.value = cards;
        ensureRevealTicker(cid);
        await delayMs(70);
      }

      const summaryMerged = await mergeCorePainPointSummaryFieldAsync(mergedAcc, parsedRec, mergeStrings);
      if (summaryMerged) mergedAcc.corePainPointSummary = summaryMerged;
      const mergedBc = mergedAcc.businessContext;
      if (mergedBc && typeof mergedBc === 'object' && !Array.isArray(mergedBc)) {
        delete (mergedBc as Record<string, unknown>).businessStatus;
      }
      mergedRequirementParsedOverride.value = { ...mergedAcc };

      lastMergedRequirementEntryCount.value = customerRequirementCanvasEntries.value.length;
      mergedRequirementMergeDoneTick.value += 1;
      designChatInputPlaceholder.value = '需求已合并至右侧「合并需求」卡片；请选择是否继续补充需求。';
      queuePersistDesignDetailProgressWorkspace();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const cardsErr = cloneDynamics();
      const cErr = cardsErr.find((c) => c.lineTaskId === 'customer_basic');
      if (cErr) {
        appendLineToCard(cErr, `→ 总体需求合并失败：${msg}`, 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsErr;
      ensureRevealTicker(cid);
    } finally {
      requirementMergeBusy.value = false;
    }
  }

  /** 诊断：工作区快照中的 `llmStatsIncludeFromMessageIndex` 若异常，多与早期 `task1LlmQueryBlock` 下标有关 */
  function logLlmStatsDiag(event: string, payload: Record<string, unknown>) {
    if (typeof console === 'undefined' || typeof console.info !== 'function') return;
    try {
      console.info(`[design-detail:llm-stats] ${event}`, payload);
    } catch {
      /* 忽略控制台异常 */
    }
  }

  /** 「是否继续补充需求 → 是」全链路查证：控制台搜 `[design-detail:supplement-yes]` */
  function logSupplementYesDiag(event: string, payload: Record<string, unknown> = {}) {
    if (typeof console === 'undefined' || typeof console.info !== 'function') return;
    try {
      console.info(`[design-detail:supplement-yes] ${event}`, payload);
    } catch {
      /* 忽略控制台异常 */
    }
  }

  function diagDynamicsSupplementSnapshot(): Record<string, unknown> {
    const c1 = dynamicsCards.value.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) {
      return { hasC1: false, phase: task1CustomerRequirementPhase.value };
    }
    const supplementRows = c1.lines.filter((l) => l.kind === 'requirement_supplement_prompt').length;
    const lastLines = c1.lines.slice(-8).map((l) => ({
      kind: l.kind,
      preview: l.full.length > 72 ? `${l.full.slice(0, 72)}…` : l.full,
    }));
    return {
      hasC1: true,
      phase: task1CustomerRequirementPhase.value,
      lineCount: c1.lines.length,
      supplementRows,
      lastLines,
    };
  }

  /**
   * 诊断：列出聊天中 `task1LlmQueryBlock` 的下标与备注前缀，及 `[fromIdx, len)` 内条数。
   * 用于查证 hydrate 后 `llmStatsIncludeFromMessageIndex` 与聊天中 `task1LlmQueryBlock` 分布是否一致。
   */
  function diagTask1LlmBlockSummary(
    messages: ReadonlyArray<Record<string, unknown>>,
    fromIdx: number,
  ): Record<string, unknown> {
    const indices: number[] = [];
    const notePrefixes: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i]?.type !== 'task1LlmQueryBlock') continue;
      indices.push(i);
      notePrefixes.push(String((messages[i] as { noteName?: string }).noteName || '').slice(0, 28));
    }
    const inWin = indices.filter((i) => i >= fromIdx);
    return {
      msgLen: messages.length,
      statsFromIdx: fromIdx,
      task1LlmBlockCount: indices.length,
      task1LlmIndices: indices,
      task1LlmNotePrefixes: notePrefixes,
      task1LlmInStatWindowCount: inWin.length,
      task1LlmIndicesInStatWindow: inWin,
    };
  }

  /**
   * 任务动态已出现并 **完整 reveal**「→ 请提供客户工商及经营范围信息」，且尚未追加「正在提炼」行：
   * 用于底部输入框蓝色光晕 + 专用占位（与 `DesignDetailPage.vue` 绑定）。
   */
  const designChatInputHighlightTask1ScopeAwait = computed(() => {
    if (loadError.value) return false;
    /** 客户需求等待阶段用另一套占位与光晕，不再沿用「请提供工商」条件 */
    if (task1CustomerRequirementPhase.value !== 'idle') return false;
    const messages = lastHydratedMessages.value;
    const itemRaw = lastResolvedItem.value ?? lastHydratedItem.value;
    if (!itemRaw) return false;
    const item = mergeResolvedItemForDesign(itemRaw as Record<string, unknown>) || (itemRaw as Record<string, unknown>);
    if (isTaskCompleted(item, TASK1_ID, messages as Array<Record<string, unknown>>)) return false;
    const mergedForPh = mergeResolvedItemForDesign(item) || item;
    if (isTask1ActivePreliminaryFollowupPhaseDesign(messages as Array<Record<string, unknown>>, mergedForPh)) {
      return false;
    }
    const c1 = dynamicsCards.value.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return false;
    const scopeRow = c1.lines.find(
      (l) =>
        (l.full === TASK1_SCOPE_PROMPT_LINE || l.full === TASK1_SCOPE_PROMPT_LINE_LEGACY) &&
        l.kind === 'scope_green',
    );
    if (!scopeRow) return false;
    if (scopeRow.cursor < cpLen(scopeRow.full)) return false;
    if (c1.lines.some((l) => l.full === TASK1_EXTRACTING_CUSTOMER_BASIC_LINE)) return false;
    return true;
  });

  /** 画布已展示客户基本信息且阶段为 `awaiting`：绿色「请输入用户需求」已完整 reveal、尚未出现「正在解析需求」行 */
  const designChatInputHighlightTask1CustomerRequirementAwait = computed(() => {
    if (loadError.value) return false;
    if (task1CustomerRequirementPhase.value !== 'awaiting') return false;
    const messages = lastHydratedMessages.value;
    const itemRaw = lastResolvedItem.value ?? lastHydratedItem.value;
    if (!itemRaw) return false;
    const item = mergeResolvedItemForDesign(itemRaw as Record<string, unknown>) || (itemRaw as Record<string, unknown>);
    if (isTaskCompleted(item, TASK1_ID, messages as Array<Record<string, unknown>>)) return false;
    const mergedForPh = mergeResolvedItemForDesign(item) || item;
    if (isTask1ActivePreliminaryFollowupPhaseDesign(messages as Array<Record<string, unknown>>, mergedForPh)) {
      return false;
    }
    const c1 = dynamicsCards.value.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return false;
    const reqRow = c1.lines.find(
      (l) => l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE && l.kind === 'scope_green',
    );
    if (!reqRow) return false;
    if (reqRow.cursor < cpLen(reqRow.full)) return false;
    if (c1.lines.some((l) => l.full === TASK1_PARSING_CUSTOMER_REQUIREMENT_LINE)) return false;
    return true;
  });

  const designChatInputHighlightTask1ScopeOrRequirementAwait = computed(
    () => designChatInputHighlightTask1ScopeAwait.value || designChatInputHighlightTask1CustomerRequirementAwait.value,
  );

  /** 调试模式任务 0 已 completed、等待进入任务 1：底部「发送」等同点卡片「继续」 */
  const designChatInputSendTriggersTask0DebugContinue = computed(
    () =>
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1) &&
      isTask0AwaitingDebugContinueToTask1(),
  );

  const designChatInputPlaceholderEffective = computed(() => {
    if (task2EntityPortraitBusy.value) {
      return '正在进行规模与组织模式推理（大模型），请稍候…';
    }
    if (task2L1AlignmentQuestionnaireBusy.value) {
      return '正在生成需求对齐问卷（大模型），请稍候…';
    }
    if (task3L2AlignmentQuestionnaireBusy.value) {
      return '正在生成 L2-行业与业务层 反向验证对齐问卷（大模型），请稍候…';
    }
    if (task4L2AlignmentQuestionnaireBusy.value) {
      return '正在生成 L2 价值链反向验证对齐问卷（大模型），请稍候…';
    }
    if (task5L3AlignmentQuestionnaireBusy.value) {
      return '正在生成 L3 宏观流程反向验证对齐问卷（大模型），请稍候…';
    }
    if (task51L3AlignmentQuestionnaireBusy.value) {
      return '正在生成 L3.1 战略价值主张反向验证对齐问卷（大模型），请稍候…';
    }
    if (task55L3AlignmentQuestionnaireBusy.value) {
      return '正在生成 L3.5 VSM 反向验证对齐问卷（大模型），请稍候…';
    }
    if (task6L3AlignmentQuestionnaireBusy.value) {
      return '正在生成 L3 关键场景反向验证对齐问卷（大模型），请稍候…';
    }
    if (task10L5AlignmentQuestionnaireBusy.value) {
      return '正在生成 L5 数据架构反向验证对齐问卷（大模型），请稍候…';
    }
    if (task2L1AlignmentPending.value) {
      return '请对照进度区「产生疑问」下的问卷，在此输入您的确认与补充…';
    }
    if (task3L2AlignmentPending.value) {
      return '请对照任务 3 进度区「产生疑问」下的问卷，在此输入您的确认与补充…';
    }
    if (task4L2AlignmentPending.value) {
      return '请对照任务 4 进度区「产生疑问」下的问卷，在此输入您的确认与补充…';
    }
    if (task5L3AlignmentPending.value) {
      return '请对照任务 5 进度区「产生疑问」下的问卷，在此输入您的确认与补充…';
    }
    if (task51L3AlignmentPending.value) {
      return '请对照任务 5.1 进度区「产生疑问」下的问卷，在此输入您的确认与补充…';
    }
    if (task55L3AlignmentPending.value) {
      return '请对照任务 5.5 进度区「产生疑问」下的问卷，在此输入您的确认与补充…';
    }
    if (task6L3AlignmentPending.value) {
      return '请对照任务 6 进度区「产生疑问」下的问卷，在此输入您的确认与补充…';
    }
    if (task10L5AlignmentPending.value) {
      return '请对照任务 10 进度区「产生疑问」下的问卷，在此输入您的确认与补充…';
    }
    if (requirementMergeBusy.value) {
      return '正在将本批需求合并入总体需求，请稍候…';
    }
    if (dynamicsHasRequirementSupplementPromptChoice()) {
      return '请先点击进度区「是」或「否」选择是否继续补充需求。';
    }
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
      dynamicsHasDebugStepContinuePrompt() &&
      !task2L1AlignmentPending.value &&
      !task3L2AlignmentPending.value &&
      !task4L2AlignmentPending.value &&
      !task5L3AlignmentPending.value &&
      !task51L3AlignmentPending.value &&
      !task55L3AlignmentPending.value &&
      !task6L3AlignmentPending.value &&
      !task10L5AlignmentPending.value
    ) {
      return '请先点击进度区「继续」（【调试】是否继续）后再发送。';
    }
    if (task1CustomerRequirementPhase.value === 'paused') {
      return '已暂停需求补充；若需重新开始可点顶栏「重启当前」。';
    }
    if (designChatInputHighlightTask1CustomerRequirementAwait.value) return TASK1_CUSTOMER_REQUIREMENT_INPUT_PLACEHOLDER;
    if (designChatInputHighlightTask1ScopeAwait.value) return TASK1_SCOPE_INPUT_PLACEHOLDER;
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1) &&
      isTask0AwaitingDebugContinueToTask1()
    ) {
      if (dynamicsHasDebugStepContinuePrompt()) {
        return '任务 0 已完成：请点击任务 0 卡片「继续」，或直接点底部「发送」进入任务 1。';
      }
      return '任务 0 已完成，正在准备进入任务 1…（亦可点「发送」）';
    }
    /** 线步已进任务 1 或进度区已挂任务 1 引导时，不得沿用 hydrate 早期写入的「任务 0 进行中」占位 */
    if (task1InputUiBlocksTask0FootLock.value || currentDesignLineTaskId.value !== 'optional_toolbox_primitive') {
      const item = (lastResolvedItem.value ?? lastHydratedItem.value) as Record<string, unknown> | null;
      const msgs = lastHydratedMessages.value;
      if (item && !isTaskCompleted(item, TASK1_ID, msgs)) {
        const c1 = dynamicsCards.value.find((c) => c.lineTaskId === 'customer_basic');
        if (
          c1?.lines.some(
            (l) =>
              l.kind === 'scope_green' &&
              (l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE ||
                l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE_LEGACY),
          )
        ) {
          return TASK1_CUSTOMER_REQUIREMENT_INPUT_PLACEHOLDER;
        }
        if (task1CustomerRequirementPhase.value === 'awaiting') {
          return TASK1_CUSTOMER_REQUIREMENT_INPUT_PLACEHOLDER;
        }
        return '可粘贴企业基本工商信息（关键词触发提炼），或发送客户工商及经营范围等描述（本页将提炼为结构化 JSON）。';
      }
    }
    return designChatInputPlaceholder.value;
  });

  /** 任务 1 工商/需求引导已出现时，不得因线步仍为任务 0 而禁用底部输入（否则 textarea 无法聚焦） */
  const task1InputUiBlocksTask0FootLock = computed(() => {
    if (task1CustomerRequirementPhase.value === 'awaiting') return true;
    if (designChatInputHighlightTask1ScopeOrRequirementAwait.value) return true;
    const c1 = dynamicsCards.value.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return false;
    return c1.lines.some(
      (l) =>
        l.kind === 'scope_green' &&
        (l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE ||
          l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE_LEGACY ||
          l.full === TASK1_SCOPE_PROMPT_LINE ||
          l.full === TASK1_SCOPE_PROMPT_LINE_LEGACY),
    );
  });

  /** 分域补充询问未选择、已选「否」暂停、或总体需求增量合并进行中时，禁止底部发送 */
  const designChatInputSendDisabled = computed(
    () => {
      if (designChatInputSendTriggersTask0DebugContinue.value) {
        return sendBusy.value || debugPipelineContinueBusy.value;
      }
      return (
      sendBusy.value ||
      (currentDesignLineTaskId.value === 'optional_toolbox_primitive' &&
        !task1InputUiBlocksTask0FootLock.value) ||
      task1CustomerRequirementPhase.value === 'paused' ||
      dynamicsHasRequirementSupplementPromptChoice() ||
      (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
        dynamicsHasDebugStepContinuePrompt() &&
        !task2L1AlignmentPending.value &&
        !task3L2AlignmentPending.value &&
        !task4L2AlignmentPending.value &&
        !task5L3AlignmentPending.value &&
        !task51L3AlignmentPending.value &&
        !task55L3AlignmentPending.value &&
        !task6L3AlignmentPending.value) ||
      debugPipelineContinueBusy.value ||
      requirementMergeBusy.value ||
      task2EntityPortraitBusy.value ||
      task2L1AlignmentQuestionnaireBusy.value ||
      task3L2AlignmentQuestionnaireBusy.value ||
      task4L2AlignmentQuestionnaireBusy.value ||
      task5L3AlignmentQuestionnaireBusy.value ||
      task51L3AlignmentQuestionnaireBusy.value ||
      task55L3AlignmentQuestionnaireBusy.value ||
      task6L3AlignmentQuestionnaireBusy.value
      );
    },
  );

  let revealTimer: ReturnType<typeof setInterval> | null = null;
  let lastProgressTailFingerprint = '';
  /** 完成行流式结束后：`t1` → reconcile 任务线并（若已收官）追加「谢谢」 */
  let pendingStreamAdvance: null | 't0' | 't1' = null;
  /** 任务 0 → 任务 1 自动推进仅执行一次（完全重启 / Tree 任务 0 层就绪） */
  let task0AutoAdvanceDone = false;
  /** 任务 0 收官落库 + 进任务 1 串行中，防重入 */
  let task0FinalizeInFlight = false;
  /** 已为当前聊天指纹应用过后端/本地任务进展快照，避免轮询重复 GET */
  let appliedProgressWorkspaceMessagesFp: ReturnType<typeof buildMessagesFingerprint> | null = null;
  let designDetailProgressPersistTimer: ReturnType<typeof setTimeout> | null = null;
  /** 远端 PUT 失败但本地已镜像时置 true，hydrate / 可见性恢复后重试 */
  let designDetailProgressPersistPending = false;
  /** 首次 hydrate + 快照恢复完成前禁止写库，避免用空壳覆盖服务端工作区 */
  let designDetailProgressWorkspaceSaveEnabled = false;

  const onCasesChanged = () => {
    void runHydrationCycle();
  };

  function clearRevealInterval() {
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  }

  function allLinesFullyRevealed(cards: DynamicsCardModel[]): boolean {
    for (const c of cards) {
      for (const row of c.lines) {
        if (row.cursor < cpLen(row.full)) return false;
      }
    }
    return true;
  }

  /** 等待任务动态卡内所有行 reveal 完毕（与 `ensureRevealTicker` 配合；超时则不再阻塞） */
  async function waitUntilDynamicsFullyRevealed(maxWaitMs = 120_000): Promise<void> {
    const t0 = Date.now();
    while (Date.now() - t0 < maxWaitMs) {
      if (allLinesFullyRevealed(dynamicsCards.value)) return;
      await delayMs(24);
    }
  }

  /** 使用模式：上一线步对用户可见进度（含推理结论 reveal）展示完后再启动本线步流水线 */
  async function awaitUsageModePriorLineTaskDisplayComplete(
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
    maxWaitMs = 120_000,
  ): Promise<void> {
    if (isDesignDetailDebugExperienceActive()) return;
    const prior = priorDesignLineTaskId(lineTaskId);
    if (!prior) return;
    const t0 = Date.now();
    while (Date.now() - t0 < maxWaitMs) {
      const card = findDynamicsCardByLineTaskId(dynamicsCards.value, prior);
      if (isUsageModeLineTaskDisplayCompleteForGate(card)) return;
      await delayMs(24);
    }
  }

  function cloneDynamics(): DynamicsCardModel[] {
    return dynamicsCards.value.map((c) => ({
      ...c,
      lines: c.lines.map((r) => ({ ...r })),
    }));
  }

  /**
   * 在最新 `dynamicsCards` 快照上修改任务 3 动态卡并写回（避免 `cloneDynamics()` 后仍持有陈旧 card 引用导致 UI 与内存不一致）。
   */
  function withTask3L2DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'industry_business_profile_extract');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  /** 去掉任务 3「正在进行行业与业务属性推理（大模型）」转圈行 */
  function removeTask3L2LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask3L2DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK3_L2_INDUSTRY_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  /** 会话已重置（完全重启/重启当前）时摘掉任务 3 转圈并提示，避免假死 */
  function exitTask3PipelineIfSessionStale(rawId: string, epochAtStart: number): boolean {
    if (designDetailSessionGeneration === epochAtStart) return false;
    removeTask3L2LlmWorkingSpinnerLine(rawId);
    removeTask3L2SyncSpinnerLine(rawId);
    withTask3L2DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 3 推理已中止（页面会话已重置，请对本线步「重启当前」重跑）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    void flushPersistDesignDetailProgressWorkspace(rawId);
    return true;
  }

  /** 去掉任务 3「正在写入 Target_KV…」转圈行（落库已返回或失败收尾时；始终作用于当前 `dynamicsCards`） */
  function removeTask3L2SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask3L2DynamicsCard((card) => {
      removed = removeTask3L2SyncSpinnerFromCard(card);
    }, caseIdForTicker);
    return removed;
  }

  /** 去掉任务 0「正在将工具原语落库…」转圈行（sync 已返回或失败收尾时） */
  function removeTask0SyncSpinnerLine(caseIdForTicker?: string): boolean {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
    if (!card) return false;
    const spinIdx = findLastProgressLineIndex(
      card.lines,
      (l) => l.kind === 'bmc_generating' && l.full === TASK0_SYNC_SPINNER_LINE,
    );
    if (spinIdx < 0) return false;
    card.lines.splice(spinIdx, 1);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return true;
  }

  /** 任务 3 落库/规范化失败等不可自动进任务 4 时：动态卡淡绿收官，避免长期停在「推理逻辑提取」 */
  function sealTask3L2DynamicsCardTerminal(caseIdForTicker?: string): void {
    withTask3L2DynamicsCard((card) => {
      if (card.status === 'completed') return;
      card.status = 'completed';
      card.completedAtMs = Date.now();
      card.completionQueued = true;
    }, caseIdForTicker);
  }

  function withTask5L3DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'macro_process_flow_inference');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask5L3LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask5L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK5_L3_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask5L3SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask5L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK5_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function withTask51L3DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'value_proposition_capability_units');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask51L3LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask51L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK51_L3_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask51L3SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask51L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK51_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function withTask52L3DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = findDynamicsCardByLineTaskId(cards, 'capability_field_set_mapping');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask52L3LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask52L3DynamicsCard((card) => {
      for (let i = card.lines.length - 1; i >= 0; i--) {
        const l = card.lines[i]!;
        if (l.bmcGenUi === 'spinner' && l.full.startsWith(TASK52_L3_LLM_WORKING_LINE)) {
          card.lines.splice(i, 1);
          removed = true;
        }
      }
    }, caseIdForTicker);
    return removed;
  }

  function removeTask52L3SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask52L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK52_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function withTask53L3DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = findDynamicsCardByLineTaskId(cards, 'key_scenario_temporal_flow_inference');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask53L3LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask53L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK53_L3_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask53L3SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask53L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK53_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function withTask55L3DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'vsm_stage_decomposition');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask55L3LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask55L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK55_L3_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask55L3SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask55L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK55_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function withTask6L3DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'pain_point_extraction');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask6L3LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask6L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK6_L3_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask6L3SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask6L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK6_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  /** 完全重启 / 重启当前导致 `designDetailSessionGeneration` 变化时摘掉转圈，避免任务 6 假死 */
  function exitTask6PipelineIfSessionStale(rawId: string, epochAtStart: number): boolean {
    if (designDetailSessionGeneration === epochAtStart) return false;
    removeTask6L3LlmWorkingSpinnerLine(rawId);
    removeTask6L3SyncSpinnerLine(rawId);
    withTask6L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 6 推理已中止（页面会话已重置，请对本线步「重启当前」重跑）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    void flushPersistDesignDetailProgressWorkspace(rawId);
    return true;
  }

  const TASK65_L3_SYNC_TARGET_KV_LINE = '→ 正在写入任务 6.5 Target_KV 与逻辑链…';

  function withTask65L3DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'three_dimension_itgap_analysis');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask65L3SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask65L3DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK65_L3_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function exitTask65PipelineIfSessionStale(rawId: string, epochAtStart: number): boolean {
    if (designDetailSessionGeneration === epochAtStart) return false;
    removeTask65L3SyncSpinnerLine(rawId);
    withTask65L3DynamicsCard((card) => {
      appendLineToCard(
        card,
        '→ 任务 6.5 推理已中止（页面会话已重置，请对本线步「重启当前」重跑）',
        'default',
        { startFullyRevealed: true },
      );
    }, rawId);
    void flushPersistDesignDetailProgressWorkspace(rawId);
    return true;
  }

  function pickTask6TokensFeaturesFromGraphTasks(
    tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[]; tokens?: { tokenId: string; name: string }[] }>,
  ): { tokens: { tokenId: string; name: string }[]; features: Task2L1TaskGraphFeatureRow[] } {
    const t6 = tasks.find((t) => {
      const id = String(t?.taskId || '').trim();
      return id === 'pain_point_extraction' || id.includes('任务 6') || id.includes('关键场景');
    });
    return {
      tokens: Array.isArray(t6?.tokens) ? t6.tokens : [],
      features: Array.isArray(t6?.features) ? t6.features : [],
    };
  }

  function withTask7L4DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'key_requirement_scenarios');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask7L4LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask7L4DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK7_L4_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask7L4SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask7L4DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK7_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function pickTask7TokensFeaturesFromGraphTasks(
    tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[]; tokens?: { tokenId: string; name: string }[] }>,
  ): { tokens: { tokenId: string; name: string }[]; features: Task2L1TaskGraphFeatureRow[] } {
    const t7 = tasks.find((t) => {
      const id = String(t?.taskId || '').trim();
      return id === 'key_requirement_scenarios' || id.includes('任务 7') || id.includes('协作节点');
    });
    return {
      tokens: Array.isArray(t7?.tokens) ? t7.tokens : [],
      features: Array.isArray(t7?.features) ? t7.features : [],
    };
  }

  function withTask8L45DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'role_object_stm_inference');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask8L45LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask8L45DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK8_L45_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask8L45SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask8L45DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK8_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function pickTask8TokensFeaturesFromGraphTasks(
    tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[]; tokens?: { tokenId: string; name: string }[] }>,
  ): { tokens: { tokenId: string; name: string }[]; features: Task2L1TaskGraphFeatureRow[] } {
    const t8 = tasks.find((t) => {
      const id = String(t?.taskId || '').trim();
      return id === 'role_object_stm_inference' || id.includes('任务 8') || id.includes('状态转移矩阵');
    });
    return {
      tokens: Array.isArray(t8?.tokens) ? t8.tokens : [],
      features: Array.isArray(t8?.features) ? t8.features : [],
    };
  }

  function exitTask7PipelineIfSessionStale(caseId: string, epochAtStart: number): boolean {
    if (designDetailSessionGeneration === epochAtStart) return false;
    removeTask7L4LlmWorkingSpinnerLine(caseId);
    removeTask7L4SyncSpinnerLine(caseId);
    return true;
  }

  function exitTask8PipelineIfSessionStale(caseId: string, epochAtStart: number): boolean {
    if (designDetailSessionGeneration === epochAtStart) return false;
    removeTask8L45LlmWorkingSpinnerLine(caseId);
    removeTask8L45SyncSpinnerLine(caseId);
    return true;
  }

  function withTask85DynamicsCard(
    mutator: (card: DynamicsCardModel) => void,
    caseIdForTicker?: string,
  ): DynamicsCardModel | undefined {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'physical_hook_integration_inference');
    if (!card) return undefined;
    mutator(card);
    dynamicsCards.value = cards;
    const cid = String(caseIdForTicker ?? '').trim();
    if (cid) ensureRevealTicker(cid);
    return card;
  }

  function removeTask85LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask85DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK85_L475_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask85SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask85DynamicsCard((card) => {
      const spinIdx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === TASK85_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function exitTask85PipelineIfSessionStale(caseId: string, epochAtStart: number): boolean {
    if (designDetailSessionGeneration === epochAtStart) return false;
    removeTask85LlmWorkingSpinnerLine(caseId);
    removeTask85SyncSpinnerLine(caseId);
    return true;
  }

  function withTask9L5DynamicsCard(
    fn: (card: DesignDetailDynamicsCard) => void,
    caseIdForTicker?: string,
  ): void {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'business_capability_positioning');
    if (!card) return;
    fn(card);
    dynamicsCards.value = cards;
    if (caseIdForTicker) ensureRevealTicker(caseIdForTicker);
  }

  function removeTask9L5LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask9L5DynamicsCard((card) => {
      const spinIdx = card.lines.findIndex(
        (l) => l.kind === 'bmc_generating' && l.full === TASK9_L5_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask9L5SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask9L5DynamicsCard((card) => {
      const spinIdx = card.lines.findIndex(
        (l) => l.kind === 'bmc_generating' && l.full === TASK9_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function pickTask9TokensFeaturesFromGraphTasks(
    tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[]; tokens?: { tokenId: string; name: string }[] }>,
  ): { tokens: { tokenId: string; name: string }[]; features: Task2L1TaskGraphFeatureRow[] } {
    const t9 = tasks.find((t) => {
      const id = String(t?.taskId || '').trim();
      return (
        id === 'business_capability_positioning' ||
        id.includes('任务 9') ||
        id.includes('系统菜单')
      );
    });
    return {
      tokens: Array.isArray(t9?.tokens) ? t9.tokens : [],
      features: Array.isArray(t9?.features) ? t9.features : [],
    };
  }

  function exitTask9PipelineIfSessionStale(caseId: string, epochAtStart: number): boolean {
    if (designDetailSessionGeneration === epochAtStart) return false;
    removeTask9L5LlmWorkingSpinnerLine(caseId);
    removeTask9L5SyncSpinnerLine(caseId);
    return true;
  }

  function withTask10L5DynamicsCard(
    fn: (card: DesignDetailDynamicsCard) => void,
    caseIdForTicker?: string,
  ): void {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === 'process_type_derivation');
    if (!card) return;
    fn(card);
    dynamicsCards.value = cards;
    if (caseIdForTicker) ensureRevealTicker(caseIdForTicker);
  }

  function removeTask10LlmWorkingSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask10L5DynamicsCard((card) => {
      const spinIdx = card.lines.findIndex(
        (l) => l.kind === 'bmc_generating' && l.full === TASK10_LLM_WORKING_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function removeTask10SyncSpinnerLine(caseIdForTicker?: string): boolean {
    let removed = false;
    withTask10L5DynamicsCard((card) => {
      const spinIdx = card.lines.findIndex(
        (l) => l.kind === 'bmc_generating' && l.full === TASK10_SYNC_TARGET_KV_LINE,
      );
      if (spinIdx < 0) return;
      card.lines.splice(spinIdx, 1);
      removed = true;
    }, caseIdForTicker);
    return removed;
  }

  function exitTask10PipelineIfSessionStale(caseId: string, epochAtStart: number): boolean {
    if (designDetailSessionGeneration === epochAtStart) return false;
    removeTask10LlmWorkingSpinnerLine(caseId);
    removeTask10SyncSpinnerLine(caseId);
    return true;
  }

  /** 对齐问卷「正在生成…」行尾转圈：LLM 结束/失败/会话重置时须摘掉，避免进度区永久挂死 */
  function removeAlignmentQuestionnaireGeneratingLine(
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
    workingLine: string,
  ) {
    const rawId = String(caseIdRef.value || '').trim();
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === lineTaskId);
    if (!card) return;
    const idx = findLastProgressLineIndex(
      card.lines,
      (l) => l.kind === 'bmc_generating' && l.full === workingLine,
    );
    if (idx < 0) return;
    card.lines.splice(idx, 1);
    dynamicsCards.value = cards;
    if (rawId) ensureRevealTicker(rawId);
  }

  /** 快照恢复或丢弃门闩：去掉不可再点的调试「继续」行 */
  function stripDebugStepContinueFromDynamicsCards(cards: DynamicsCardModel[]): DynamicsCardModel[] {
    return cards.map((c) => ({
      ...c,
      lines: c.lines.filter((l) => l.kind !== 'debug_step_continue_prompt'),
    }));
  }

  function dynamicsHasDebugStepContinuePrompt(): boolean {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) return false;
    return dynamicsCards.value.some((c) =>
      c.lines.some((l) => l.kind === 'debug_step_continue_prompt'),
    );
  }

  function stripDebugStepContinuePromptLines(caseId: string): void {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    let changed = false;
    for (const c of cards) {
      const n = c.lines.length;
      c.lines = c.lines.filter((l) => l.kind !== 'debug_step_continue_prompt');
      if (c.lines.length !== n) changed = true;
    }
    if (changed) {
      dynamicsCards.value = cards;
      ensureRevealTicker(cid);
    }
  }

  type DesignDetailPipelineRunOpts = {
    /** 为 true 时不于 pipeline 内推「【调试】是否继续」（供深访 diff 等后续进度行之后再推至该任务卡末尾） */
    deferDebugContinue?: boolean;
    /**
     * 为 true 时 TVM 仍有「潜在冲突」也不在本轮 pipeline 末尾推问卷；
     * 由深访重跑路径在 **`appendAlignmentRerunDiffProgress`** 之后再 **`flushDeferredAlignmentQuestionnaireIfAny`**。
     */
    deferAlignmentQuestionnaire?: boolean;
    /** 任务 6.5：深访闭环后从指定子任务续跑 */
    task65ResumeFrom?: Pick<Task65PipelineResumeState, 'stepIndex' | 'perStepRawOutputs'>;
    task65SkipIntro?: boolean;
  };

  type DeferredAlignmentQuestionnaireJob = {
    caseId: string;
    lineTaskId: AlignmentDynamicsLineTaskId;
    epochAtStart: number;
    conflictDatasetUserBlock: string;
    tier:
      | 'task2'
      | 'task3'
      | 'task4'
      | 'task5'
      | 'task51'
      | 'task55'
      | 'task6'
      | 'task65'
      | 'task7'
      | 'task8'
      | 'task85'
      | 'task9'
      | 'task10';
    task65SubtaskProgressLabel?: string;
    task65SubtaskStepIndex?: number;
    task65SubtaskPerStepRawOutputs?: string[];
    task65ConflictRows?: Task2L1TvmParsedRow[];
  };

  const deferredAlignmentQuestionnaireJob = ref<DeferredAlignmentQuestionnaireJob | null>(null);

  /** 将指定任务卡上的调试「继续」行去掉后，在进度行末尾重新追加（保证位于该任务最后） */
  function appendDebugContinueAtLineTaskEnd(
    rawId: string,
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
    onContinue: () => void | Promise<void>,
    promptFull: string = DEBUG_PIPELINE_STEP_CONTINUE_PROMPT_FULL,
  ): void {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) return;
    const cards = cloneDynamics();
    const card = findDynamicsCardByLineTaskId(cards, lineTaskId);
    if (card) {
      card.lines = card.lines.filter((l) => l.kind !== 'debug_step_continue_prompt');
      appendLineToCard(card, promptFull, 'debug_step_continue_prompt', {
        startFullyRevealed: true,
      });
      if (lineTaskId === 'process_type_derivation') {
        logTask10ArchGate('append_ok', {
          caseId: rawId,
          lineTaskId,
          cardStatus: card.status,
          lineCount: card.lines.length,
        });
      }
    } else {
      try {
        console.warn('[design-detail:debug-pipeline-continue]', {
          phase: 'append_debug_continue_missing_card',
          lineTaskId,
          caseId: rawId,
        });
        if (lineTaskId === 'process_type_derivation') {
          logTask10ArchGate('append_missing_card', { caseId: rawId, lineTaskId });
        }
      } catch {
        /* ignore */
      }
    }
    dynamicsCards.value = cards;
    ensureRevealTicker(rawId);
    pendingDebugPipelineContinueAction.value = onContinue;
  }

  /** 任务 0 动态卡已 completed 且任务 1 尚未挂载引导卡时，可挂调试门闩 */
  function isTask0AwaitingDebugContinueToTask1(): boolean {
    const cards = cloneDynamics();
    const t0 = cards.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
    if (!t0 || t0.status !== 'completed') return false;
    const t1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!t1) return true;
    if (t1.status === 'completed' || t1.status === 'running') return false;
    return (t1.lines?.length ?? 0) === 0;
  }

  /** 任务 0 已收官但线步仍停在任务 0 时，写回 `customer_basic`（与 `completeTask0DynamicsCardOnly` 一致） */
  function syncLineStateAfterTask0CompletedGate(rawId: string): void {
    const cid = String(rawId || '').trim();
    if (!cid || !isTask0AwaitingDebugContinueToTask1()) return;
    const prev = loadDesignDetailLineState(cid);
    currentDesignLineTaskId.value = 'customer_basic';
    saveDesignDetailLineState(cid, {
      schemaVersion: 1,
      currentTaskId: 'customer_basic',
      holdPastTask3: prev?.holdPastTask3,
      holdPastTask4: prev?.holdPastTask4,
    });
  }

  /** 调试模式：任务 0 已 completed 时在卡末挂「继续」并登记 pending 回调 */
  async function ensureTask0ToTask1DebugContinueGate(rawId: string): Promise<void> {
    if (
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) ||
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1) ||
      !isTask0AwaitingDebugContinueToTask1()
    ) {
      logDesignDetailTask0Pipeline('debug_gate_skip', {
        caseId: rawId,
        stepContinue: designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE),
        pauseBeforeTask1: designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1),
        awaiting: isTask0AwaitingDebugContinueToTask1(),
      });
      return;
    }
    logDesignDetailTask0Pipeline('debug_gate_attach', { caseId: rawId, ...diagTask0PipelineState(rawId) });
    syncLineStateAfterTask0CompletedGate(rawId);
    const item = (lastResolvedItem.value ?? lastHydratedItem.value) as Record<string, unknown> | null;
    const msgs = lastHydratedMessages.value;
    if (item) {
      syncDesignChatInputPlaceholderFromTaskState(item, msgs);
    }
    if (!dynamicsCardsHaveDebugStepContinuePrompt()) {
      appendDebugContinueAtLineTaskEnd(rawId, 'optional_toolbox_primitive', async () => {
        kickoffTask1AfterTask0Gate(rawId);
        if (designDetailProgressPersistTimer) {
          clearTimeout(designDetailProgressPersistTimer);
          designDetailProgressPersistTimer = null;
        }
        await flushPersistDesignDetailProgressWorkspace(rawId);
        queuePersistDesignDetailProgressWorkspace();
      });
    }
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  /** 任务 0→1 门闩通过后：挂载任务 1 卡并推送工商引导行 */
  function kickoffTask1AfterTask0Gate(rawId: string): void {
    beginTask1AfterTask0(rawId);
    ensureTask1StartupProgressUi(rawId);
  }

  async function scheduleDebugContinueAfterTask0IfReady(rawId: string): Promise<void> {
    await ensureTask0ToTask1DebugContinueGate(rawId);
  }

  async function scheduleDebugContinueAfterTask2L1SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) || task2L1AlignmentPending.value) return;
    const st = loadDesignDetailLineState(rawId);
    if (st?.currentTaskId !== 'industry_business_profile_extract') return;
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'scale_org_mode_extract', async () => {
      const abort = takeDesignDetailLlmAbortController();
      await runTask3L2IndustryBusinessPipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask3L2SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) ||
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_4) ||
      task3L2AlignmentPending.value
    ) {
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    if (st?.currentTaskId !== 'core_value_driver_inference') return;
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'industry_business_profile_extract', async () => {
      const abort = takeDesignDetailLlmAbortController();
      await runTask4L2CoreValueDriverPipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  /**
   * 按锚点清空深访洞察 / 纠偏等 **localStorage**（推理图 DELETE 不会自动清这些键）。
   * 锚点及之后线步的对齐产物须与「选择重启 / 重启当前」语义一致，避免重跑仍带上轮深访结论。
   */
  function clearDesignDetailAlignmentLocalStoresFromAnchor(
    rawId: string,
    anchor: Exclude<DesignDetailLineTaskId, 'all_done'>,
    scope: ReturnType<typeof resolveDesignDetailRestartScope>,
  ): void {
    const steps = resolveRestartAffectedLineSteps(anchor, scope);
    if (steps.includes('scale_org_mode_extract')) {
      clearTask2L1DeepInsightText(rawId);
      clearTask2L1AlignmentQuestionnaireText(rawId);
      clearTask2L1UserRectificationText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'scale_org_mode_extract');
    }
    if (steps.includes('industry_business_profile_extract')) {
      clearTask3L2DeepInsightText(rawId);
      clearTask3L2UserRectificationText(rawId);
      clearTask3L2AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'industry_business_profile_extract');
    }
    if (steps.includes('core_value_driver_inference')) {
      clearTask4L2DeepInsightText(rawId);
      clearTask4L2UserRectificationText(rawId);
      clearTask4L2AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'core_value_driver_inference');
    }
    if (steps.includes('macro_process_flow_inference')) {
      clearTask5L3DeepInsightText(rawId);
      clearTask5L3UserRectificationText(rawId);
      clearTask5L3AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'macro_process_flow_inference');
    }
    if (steps.includes('value_proposition_capability_units')) {
      clearTask51L3DeepInsightText(rawId);
      clearTask51L3UserRectificationText(rawId);
      clearTask51L3AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'value_proposition_capability_units');
    }
    if (steps.includes('capability_field_set_mapping')) {
      clearAlignmentPainPointTargetFeatureIds(rawId, 'capability_field_set_mapping');
    }
    if (steps.includes('key_scenario_temporal_flow_inference')) {
      clearAlignmentPainPointTargetFeatureIds(rawId, 'key_scenario_temporal_flow_inference');
    }
    if (steps.includes('vsm_stage_decomposition')) {
      clearTask55L3DeepInsightText(rawId);
      clearTask55L3UserRectificationText(rawId);
      clearTask55L3AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'vsm_stage_decomposition');
    }
    if (steps.includes('pain_point_extraction')) {
      clearTask6L3DeepInsightText(rawId);
      clearTask6L3UserRectificationText(rawId);
      clearTask6L3AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'pain_point_extraction');
    }
    if (steps.includes('three_dimension_itgap_analysis')) {
      clearTask65L3DeepInsightText(rawId);
      clearTask65L3AlignmentQuestionnaireText(rawId);
      clearTask65PipelineResume(rawId);
      clearDiagnosticReviewCanvas();
      clearAlignmentPainPointTargetFeatureIds(rawId, 'three_dimension_itgap_analysis');
    }
    if (steps.includes('key_requirement_scenarios')) {
      clearTask7L4DeepInsightText(rawId);
      clearTask7L4UserRectificationText(rawId);
      clearTask7L4AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'key_requirement_scenarios');
    }
    if (steps.includes('role_object_stm_inference')) {
      clearTask8L45DeepInsightText(rawId);
      clearTask8L45UserRectificationText(rawId);
      clearTask8L45AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'role_object_stm_inference');
    }
    if (steps.includes('physical_hook_integration_inference')) {
      clearTask85L475DeepInsightText(rawId);
      clearTask85L475UserRectificationText(rawId);
      clearTask85L475AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'physical_hook_integration_inference');
    }
    if (steps.includes('business_capability_positioning')) {
      clearTask9L5DeepInsightText(rawId);
      clearTask9L5UserRectificationText(rawId);
      clearTask9L5AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'business_capability_positioning');
    }
    if (steps.includes('process_type_derivation')) {
      clearTask10L5DeepInsightText(rawId);
      clearTask10L5UserRectificationText(rawId);
      clearTask10L5AlignmentQuestionnaireText(rawId);
      clearAlignmentPainPointTargetFeatureIds(rawId, 'process_type_derivation');
    }
  }

  function dynamicsCardsHaveDebugStepContinuePrompt(): boolean {
    return cloneDynamics().some((c) => c.lines.some((l) => l.kind === 'debug_step_continue_prompt'));
  }

  /** 恢复快照会剥掉门闩行；按线步与动态卡状态补挂「【调试】是否继续」 */
  async function reattachDebugPipelineContinueGatesFromLineState(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) || dynamicsCardsHaveDebugStepContinuePrompt()) {
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    if (!st) return;
    const cards = cloneDynamics();
    const tid = st.currentTaskId;
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1) &&
      isTask0AwaitingDebugContinueToTask1() &&
      (tid === 'customer_basic' || tid === 'optional_toolbox_primitive')
    ) {
      await scheduleDebugContinueAfterTask0IfReady(rawId);
      return;
    }
    const t2 = cards.find((c) => c.lineTaskId === 'scale_org_mode_extract');
    const t3 = cards.find((c) => c.lineTaskId === 'industry_business_profile_extract');
    const t4 = cards.find((c) => c.lineTaskId === 'core_value_driver_inference');
    const t2Done = t2?.status === 'completed';
    const t3NotStarted =
      !t3 || (t3.status !== 'completed' && (t3.lines?.length ?? 0) === 0 && t3.status !== 'running');
    const t3Done = t3?.status === 'completed';
    const t4NotStarted =
      !t4 || (t4.status !== 'completed' && (t4.lines?.length ?? 0) === 0 && t4.status !== 'running');
    const t4Done = t4?.status === 'completed';

    if (
      tid === 'industry_business_profile_extract' &&
      t2Done &&
      t3NotStarted &&
      !task2L1AlignmentPending.value &&
      !task3L2AlignmentPending.value
    ) {
      await scheduleDebugContinueAfterTask2L1SegmentIfReady(rawId, mergedItem);
      return;
    }
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_4) &&
      tid === 'core_value_driver_inference' &&
      t3Done &&
      t4NotStarted &&
      !task3L2AlignmentPending.value &&
      !task4L2AlignmentPending.value
    ) {
      await scheduleDebugContinueAfterTask3L2SegmentIfReady(rawId, mergedItem);
      return;
    }
    if (tid === 'macro_process_flow_inference' && t4Done && !task4L2AlignmentPending.value && !task5L3AlignmentPending.value) {
      const t5NotStarted =
        !cards.find((c) => c.lineTaskId === 'macro_process_flow_inference') ||
        (() => {
          const t5 = cards.find((c) => c.lineTaskId === 'macro_process_flow_inference');
          return (
            !!t5 &&
            t5.status !== 'completed' &&
            (t5.lines?.length ?? 0) === 0 &&
            t5.status !== 'running'
          );
        })();
      if (t5NotStarted) {
        await scheduleDebugContinueAfterTask4L2SegmentIfReady(rawId, mergedItem);
      }
    }
    const t51 = cards.find((c) => c.lineTaskId === 'value_proposition_capability_units');
    const t51Done = t51?.status === 'completed';
    const t52 = cards.find((c) => c.lineTaskId === 'capability_field_set_mapping');
    const t52NotStarted =
      !t52 ||
      (t52.status !== 'completed' && (t52.lines?.length ?? 0) === 0 && t52.status !== 'running');
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_52) &&
      t51Done &&
      t52NotStarted &&
      !task51L3AlignmentPending.value
    ) {
      await scheduleDebugContinueAfterTask51SegmentIfReady(rawId, mergedItem);
      return;
    }
    const t52Done = t52?.status === 'completed';
    const t53 = cards.find((c) => c.lineTaskId === 'key_scenario_temporal_flow_inference');
    const t53NotStarted =
      !t53 ||
      (t53.status !== 'completed' && (t53.lines?.length ?? 0) === 0 && t53.status !== 'running');
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_53) &&
      t52Done &&
      t53NotStarted &&
      (tid === 'key_scenario_temporal_flow_inference' ||
        (tid === 'capability_field_set_mapping' && loadDesignDetailLineState(rawId)?.holdPastTask52 === true))
    ) {
      await scheduleDebugContinueAfterTask52SegmentIfReady(rawId, mergedItem);
      return;
    }
    const t53Done = t53?.status === 'completed';
    const t55 = cards.find((c) => c.lineTaskId === 'vsm_stage_decomposition');
    const t55NotStarted =
      !t55 ||
      (t55.status !== 'completed' && (t55.lines?.length ?? 0) === 0 && t55.status !== 'running');
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_55) &&
      t53Done &&
      t55NotStarted &&
      (tid === 'vsm_stage_decomposition' ||
        (tid === 'key_scenario_temporal_flow_inference' &&
          loadDesignDetailLineState(rawId)?.holdPastTask53 === true))
    ) {
      await scheduleDebugContinueAfterTask53SegmentIfReady(rawId, mergedItem);
      return;
    }
    const t55Done = t55?.status === 'completed';
    const t6 = cards.find((c) => c.lineTaskId === 'pain_point_extraction');
    const t6NotStarted =
      !t6 ||
      (t6.status !== 'completed' && (t6.lines?.length ?? 0) === 0 && t6.status !== 'running');
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_6) &&
      t55Done &&
      t6NotStarted &&
      !task55L3AlignmentPending.value &&
      (tid === 'pain_point_extraction' ||
        (tid === 'vsm_stage_decomposition' && loadDesignDetailLineState(rawId)?.holdPastTask55 === true))
    ) {
      await scheduleDebugContinueAfterTask55L3SegmentIfReady(rawId, mergedItem);
    }
    const t6Done = cards.find((c) => c.lineTaskId === 'pain_point_extraction')?.status === 'completed';
    const t7 = cards.find((c) => c.lineTaskId === 'key_requirement_scenarios');
    const t7NotStarted =
      !t7 ||
      (t7.status !== 'completed' && (t7.lines?.length ?? 0) === 0 && t7.status !== 'running');
    const t65 = cards.find((c) => c.lineTaskId === 'three_dimension_itgap_analysis');
    const t65NotStarted =
      !t65 ||
      (t65.status !== 'completed' && (t65.lines?.length ?? 0) === 0 && t65.status !== 'running');
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_65) &&
      t6Done &&
      t65NotStarted &&
      (tid === 'three_dimension_itgap_analysis' ||
        (tid === 'pain_point_extraction' && loadDesignDetailLineState(rawId)?.holdPastTask6 === true))
    ) {
      await scheduleDebugContinueAfterTask6L3SegmentIfReady(rawId, mergedItem);
    }
    const t65Done = cards.find((c) => c.lineTaskId === 'three_dimension_itgap_analysis')?.status === 'completed';
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_7) &&
      t65Done &&
      t7NotStarted &&
      (tid === 'key_requirement_scenarios' ||
        (tid === 'three_dimension_itgap_analysis' &&
          loadDesignDetailLineState(rawId)?.holdPastTask65 === true))
    ) {
      await scheduleDebugContinueAfterTask65SegmentIfReady(rawId, mergedItem);
    }
    const t7Done = cards.find((c) => c.lineTaskId === 'key_requirement_scenarios')?.status === 'completed';
    const t8 = cards.find((c) => c.lineTaskId === 'role_object_stm_inference');
    const t8NotStarted =
      !t8 ||
      (t8.status !== 'completed' && (t8.lines?.length ?? 0) === 0 && t8.status !== 'running');
    if (
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_8) &&
      t7Done &&
      t8NotStarted &&
      (tid === 'role_object_stm_inference' ||
        (tid === 'key_requirement_scenarios' && loadDesignDetailLineState(rawId)?.holdPastTask7 === true))
    ) {
      await scheduleDebugContinueAfterTask7L4SegmentIfReady(rawId, mergedItem);
    }
    const t8Done = cards.find((c) => c.lineTaskId === 'role_object_stm_inference')?.status === 'completed';
    const t85 = cards.find((c) => c.lineTaskId === 'physical_hook_integration_inference');
    const t85NotStarted = isTask85PipelineKickoffPending(t85);
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_85) && t8Done && t85NotStarted) {
      await scheduleDebugContinueAfterTask8ToTask85IfReady(rawId, mergedItem);
    }
    const t85Done = cards.find((c) => c.lineTaskId === 'physical_hook_integration_inference')?.status === 'completed';
    const t9 = cards.find((c) => c.lineTaskId === 'business_capability_positioning');
    const t9NotStarted =
      !t9 ||
      (t9.status !== 'completed' && (t9.lines?.length ?? 0) === 0 && t9.status !== 'running');
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_9) && t85Done && t9NotStarted) {
      await scheduleDebugContinueAfterTask85ToTask9IfReady(rawId, mergedItem);
    }
    const t9Done =
      findDynamicsCardByLineTaskId(cards, 'business_capability_positioning')?.status === 'completed';
    const t10NotStarted = isTask10PipelineKickoffPending(
      findDynamicsCardByLineTaskId(cards, 'process_type_derivation'),
    );
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10) && t9Done && t10NotStarted) {
      await scheduleDebugContinueAfterTask9ToTask10IfReady(rawId, mergedItem);
    }
    const t10Done =
      findDynamicsCardByLineTaskId(cards, 'process_type_derivation')?.status === 'completed';
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_11) && t10Done && isTask10AwaitingDebugContinueToTask11()) {
      const stFix = loadDesignDetailLineState(rawId);
      if (
        stFix?.currentTaskId === 'process_node_design' ||
        stFix?.currentTaskId === 'role_and_business_object_derivation' ||
        stFix?.currentTaskId === 'module_abstract_design'
      ) {
        saveDesignDetailLineState(rawId, {
          schemaVersion: 1,
          currentTaskId: 'process_type_derivation',
          holdPastTask10: true,
        });
        currentDesignLineTaskId.value = 'process_type_derivation';
      }
      await scheduleDebugContinueAfterTask10ToTask11IfReady(rawId, { forceAfterTask10Success: true });
    }
  }

  /** 任务 8 动态卡已 completed 且任务 8.5 尚未起跑时，可挂调试门闩 */
  function isTask8L45AwaitingDebugContinueToTask85(): boolean {
    const cards = cloneDynamics();
    const t8 = cards.find((c) => c.lineTaskId === 'role_object_stm_inference');
    if (!t8 || t8.status !== 'completed') return false;
    const t85 = cards.find((c) => c.lineTaskId === 'physical_hook_integration_inference');
    return isTask85PipelineKickoffPending(t85);
  }

  /** 任务 8.5 动态卡已 completed 且任务 9 尚未起跑时，可挂调试门闩 */
  function isTask85AwaitingDebugContinueToTask9(): boolean {
    const cards = cloneDynamics();
    const t85 = cards.find((c) => c.lineTaskId === 'physical_hook_integration_inference');
    if (!t85 || t85.status !== 'completed') return false;
    const t9 = cards.find((c) => c.lineTaskId === 'business_capability_positioning');
    if (!t9) return true;
    if (t9.status === 'completed' || t9.status === 'running') return false;
    return (t9.lines?.length ?? 0) === 0;
  }

  /** 任务 9 动态卡已 completed 且任务 10 尚未起跑时，可挂调试门闩 */
  function isTask9AwaitingDebugContinueToTask10(): boolean {
    const cards = cloneDynamics();
    const t9 = findDynamicsCardByLineTaskId(cards, 'business_capability_positioning');
    if (!t9 || t9.status !== 'completed') return false;
    return isTask10PipelineKickoffPending(findDynamicsCardByLineTaskId(cards, 'process_type_derivation'));
  }

  /** 任务 10 已收官且任务 11 尚未起跑时，可挂调试门闩 */
  function isTask10AwaitingDebugContinueToTask11(): boolean {
    const cards = cloneDynamics();
    const t10 = findDynamicsCardByLineTaskId(cards, 'process_type_derivation');
    if (!t10 || t10.status !== 'completed') return false;
    const t11 = findDynamicsCardByLineTaskId(cards, 'process_node_design');
    if (t11 && (t11.status === 'running' || t11.status === 'completed')) return false;
    if (
      t10.lines.some(
        (l) =>
          l.full.includes(TASK11_ANALYSIS_REPORT_START_LINE) ||
          l.full.includes(TASK10_ARCH_INVENTORY_START_LINE) ||
          l.full.includes(TASK10_ARCH_INVENTORY_LEGACY_LINE) ||
          l.full.includes('即将开始数据结构绘制'),
      )
    ) {
      return false;
    }
    const rawId = String(caseIdRef.value || '').trim();
    const st = rawId ? loadDesignDetailLineState(rawId) : null;
    if (st?.holdPastTask10 === true) return true;
    return t10.lines.some((l) => l.full.includes('Target_KV 落库完成（任务 10）'));
  }

  function isTask11AwaitingDebugContinueToTask12(): boolean {
    const cards = cloneDynamics();
    const t11 = findDynamicsCardByLineTaskId(cards, 'process_node_design');
    if (!t11 || t11.status !== 'completed') return false;
    const t12 = findDynamicsCardByLineTaskId(cards, 'role_and_business_object_derivation');
    if (t12 && (t12.status === 'running' || t12.status === 'completed')) return false;
    return t11.lines.some((l) => l.full.includes('设计报告第一章已在画布渲染'));
  }

  function isTask12AwaitingDebugContinueToTask13(): boolean {
    const cards = cloneDynamics();
    const t12 = findDynamicsCardByLineTaskId(cards, 'role_and_business_object_derivation');
    if (!t12 || t12.status !== 'completed') return false;
    const t13 = findDynamicsCardByLineTaskId(cards, 'module_abstract_design');
    if (t13 && (t13.status === 'running' || t13.status === 'completed')) return false;
    return !t12.lines.some((l) => l.full.includes(TASK13_FUNCTION_INVENTORY_START_LINE));
  }

  function appendLineToTask10CardLine(rawId: string, line: string): void {
    withTask10L5DynamicsCard((card) => {
      appendLineToCard(card, line, 'scope_green', { startFullyRevealed: true });
    }, rawId);
  }

  function finishDesignReportSubSpinnerLineOnCard(
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
    rawId: string,
    workingLine: string,
    doneLine: string,
  ): void {
    withLineTaskDynamicsCard((card) => {
      const idx = findLastProgressLineIndex(
        card.lines,
        (l) => l.kind === 'bmc_generating' && l.full === workingLine,
      );
      if (idx < 0) return;
      const row = card.lines[idx]!;
      row.full = normalizeProgressLine(doneLine);
      row.kind = 'scope_green';
      row.bmcGenUi = 'check';
      row.cursor = cpLen(row.full);
    }, rawId, lineTaskId);
  }

  function resolveDesignReportCompanyName(): string {
    try {
      const u = new URL(window.location.href);
      const n = String(u.searchParams.get('customerName') || '').trim();
      if (n) return n;
    } catch {
      /* ignore */
    }
    return '客户';
  }

  async function refreshDesignReportCanvasFromCache(rawId: string): Promise<void> {
    designReportSubTabFocusTick.value += 1;
    designReportContentRefreshTick.value += 1;
    await nextTick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    try {
      await runDesignReportHybridEngine({
        caseId: rawId,
        companyName: resolveDesignReportCompanyName(),
        mode: 'static_only',
        reuseCachedLlm: true,
      });
    } catch {
      /* 画布仍以 localStorage 缓存为准 */
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function awaitDesignReportChapter1RenderedOnCanvas(rawId: string): Promise<void> {
    await refreshDesignReportCanvasFromCache(rawId);
  }

  async function awaitDesignReportChapter2RenderedOnCanvas(rawId: string): Promise<void> {
    await refreshDesignReportCanvasFromCache(rawId);
  }

  async function awaitDesignReportChapter3RenderedOnCanvas(rawId: string): Promise<void> {
    await refreshDesignReportCanvasFromCache(rawId);
  }

  async function runTask11AnalysisReportThenMaybeTask12(rawId: string): Promise<void> {
    await awaitUsageModePriorLineTaskDisplayComplete('process_node_design');
    advanceLineStepToTask11(rawId);
    ensureDynamicsCardForLineTask(rawId, 'process_node_design');
    await runTask11AnalysisReportPipelineImpl({
      rawId,
      companyName: resolveDesignReportCompanyName(),
      appendProgressLine: (line, opts) =>
        withLineTaskDynamicsCard(
          (card) => {
            const kind = opts?.kind ?? 'scope_green';
            appendLineToCard(card, line, kind, {
              startFullyRevealed: opts?.startFullyRevealed ?? true,
              bmcGenUi: opts?.bmcGenUi,
              spinnerBlue: opts?.spinnerBlue,
            });
          },
          rawId,
          'process_node_design',
        ),
      finishProgressSpinnerLine: (working, done) =>
        finishDesignReportSubSpinnerLineOnCard('process_node_design', rawId, working, done),
      invokeChapter1Llm: (fn) =>
        withDesignDetailLlmLogContext(
          {
            caseId: rawId,
            taskId: DESIGN_DETAIL_TASK11_LLM_AUDIT_TASK_ID,
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER1_PAIN,
          },
          fn,
          () => {
            llmLogAuditRefreshTick.value += 1;
          },
        ),
      invokeChapter2Llm: (fn) =>
        withDesignDetailLlmLogContext(
          {
            caseId: rawId,
            taskId: DESIGN_DETAIL_TASK11_LLM_AUDIT_TASK_ID,
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER2_DIAGNOSIS,
          },
          fn,
          () => {
            llmLogAuditRefreshTick.value += 1;
          },
        ),
      invokeChapter3Llm: (fn) =>
        withDesignDetailLlmLogContext(
          {
            caseId: rawId,
            taskId: DESIGN_DETAIL_TASK11_LLM_AUDIT_TASK_ID,
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER3_SOLUTION,
          },
          fn,
          () => {
            llmLogAuditRefreshTick.value += 1;
          },
        ),
      bumpDesignReportContentTick: () => {
        designReportContentRefreshTick.value += 1;
      },
      designReportSubTabFocusTick: () => {
        designReportSubTabFocusTick.value += 1;
      },
      ensureArchitectureInventoryTab,
      setActiveArchitectureInventoryTab,
      awaitDesignReportChapter1Rendered: awaitDesignReportChapter1RenderedOnCanvas,
      awaitDesignReportChapter2Rendered: awaitDesignReportChapter2RenderedOnCanvas,
      awaitDesignReportChapter3Rendered: awaitDesignReportChapter3RenderedOnCanvas,
      flushPersistDesignDetailProgressWorkspace,
    });
    withLineTaskDynamicsCard(
      (card) => appendLineToCard(card, TASK11_ANALYSIS_REPORT_DONE_LINE, 'scope_green', { startFullyRevealed: true }),
      rawId,
      'process_node_design',
    );
    completeDynamicsCardForLineTask(rawId, 'process_node_design');
    await flushPersistDesignDetailProgressWorkspace(rawId);
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_12)) {
      await scheduleDebugContinueAfterTask11ToTask12IfReady(rawId, { forceAfterTask11Success: true });
    } else {
      await runTask12FlowchartThenMaybeTask13(rawId);
    }
  }

  async function runTask12FlowchartThenMaybeTask13(rawId: string): Promise<void> {
    await awaitUsageModePriorLineTaskDisplayComplete('role_and_business_object_derivation');
    advanceLineStepToTask12(rawId);
    ensureDynamicsCardForLineTask(rawId, 'role_and_business_object_derivation');
    await runTask12FlowchartPipelineImpl({
      rawId,
      appendProgressLine: (line) =>
        withLineTaskDynamicsCard(
          (card) => appendLineToCard(card, line, 'scope_green', { startFullyRevealed: true }),
          rawId,
          'role_and_business_object_derivation',
        ),
      ensureArchitectureInventoryTab,
      setActiveArchitectureInventoryTab,
      focusBusinessProcessSubTab: () => {
        businessProcessSubTabFocusTick.value += 1;
      },
      flushPersistDesignDetailProgressWorkspace,
    });
    completeDynamicsCardForLineTask(rawId, 'role_and_business_object_derivation');
    await flushPersistDesignDetailProgressWorkspace(rawId);
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_13)) {
      await scheduleDebugContinueAfterTask12ToTask13IfReady(rawId, { forceAfterTask12Success: true });
    } else {
      await runTask13FunctionInventoryThenAdvance(rawId);
    }
  }

  async function runTask13FunctionInventoryThenAdvance(rawId: string): Promise<void> {
    await awaitUsageModePriorLineTaskDisplayComplete('module_abstract_design');
    advanceLineStepToTask13(rawId);
    ensureDynamicsCardForLineTask(rawId, 'module_abstract_design');
    await runTask13FunctionInventoryPipelineImpl({
      rawId,
      appendProgressLine: (line) =>
        withLineTaskDynamicsCard(
          (card) => appendLineToCard(card, line, 'scope_green', { startFullyRevealed: true }),
          rawId,
          'module_abstract_design',
        ),
      ensureArchitectureInventoryTab,
      setActiveArchitectureInventoryTab,
      focusFunctionInventorySubTab: () => {
        functionInventorySubTabFocusTick.value += 1;
      },
      bumpArchitectureInventoryRefreshTick: () => {
        architectureInventoryGraphRefreshTick.value += 1;
      },
      flushPersistDesignDetailProgressWorkspace,
    });
    completeDynamicsCardForLineTask(rawId, 'module_abstract_design');
    advanceLineStepAfterTask13Complete(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  /** @deprecated 请使用 `runTask11AnalysisReportThenMaybeTask12` */
  async function runTask10DataArchitectureThenAdvance(rawId: string): Promise<void> {
    await runTask11AnalysisReportThenMaybeTask12(rawId);
  }

  async function scheduleDebugContinueAfterTask10ToTask11IfReady(
    rawId: string,
    opts?: { forceAfterTask10Success?: boolean },
  ): Promise<void> {
    const cards = cloneDynamics();
    const t10 = findDynamicsCardByLineTaskId(cards, 'process_type_derivation');
    const st = loadDesignDetailLineState(rawId);
    const diag = buildTask10ArchGateDiagnostic({
      t10Card: t10,
      holdPastTask10: st?.holdPastTask10,
      currentTaskId: st?.currentTaskId,
    });
    logTask10ArchGate('schedule_task11_enter', {
      caseId: rawId,
      forceAfterTask10Success: !!opts?.forceAfterTask10Success,
      diag,
    });
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) {
      logTask10ArchGate('schedule_task11_skip', { reason: 'debug_pipeline_step_continue_off', diag });
      return;
    }
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_11)) {
      logTask10ArchGate('schedule_task11_skip', { reason: 'pause_before_task11_off', diag });
      return;
    }
    if (!opts?.forceAfterTask10Success && !isTask10AwaitingDebugContinueToTask11()) {
      logTask10ArchGate('schedule_task11_skip', { reason: 'not_awaiting_and_not_forced', diag });
      return;
    }
    logTask10ArchGate('schedule_task11_ok', { caseId: rawId, diag });
    appendDebugContinueAtLineTaskEnd(
      rawId,
      'process_type_derivation',
      async () => {
        logTask10ArchGate('debug_continue_click_run_task11', { caseId: rawId });
        await runTask11AnalysisReportThenMaybeTask12(rawId);
      },
      DEBUG_CONTINUE_TO_TASK_11_PROMPT,
    );
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  /** @deprecated 别名 */
  async function scheduleDebugContinueAfterTask10ToDataArchIfReady(
    rawId: string,
    opts?: { forceAfterTask10Success?: boolean },
  ): Promise<void> {
    await scheduleDebugContinueAfterTask10ToTask11IfReady(rawId, opts);
  }

  async function scheduleDebugContinueAfterTask11ToTask12IfReady(
    rawId: string,
    opts?: { forceAfterTask11Success?: boolean },
  ): Promise<void> {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) || !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_12)) {
      return;
    }
    if (!opts?.forceAfterTask11Success && !isTask11AwaitingDebugContinueToTask12()) {
      return;
    }
    appendDebugContinueAtLineTaskEnd(
      rawId,
      'process_node_design',
      async () => {
        await runTask12FlowchartThenMaybeTask13(rawId);
      },
      DEBUG_CONTINUE_TO_TASK_12_PROMPT,
    );
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask12ToTask13IfReady(
    rawId: string,
    opts?: { forceAfterTask12Success?: boolean },
  ): Promise<void> {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) || !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_13)) {
      return;
    }
    if (!opts?.forceAfterTask12Success && !isTask12AwaitingDebugContinueToTask13()) {
      return;
    }
    appendDebugContinueAtLineTaskEnd(
      rawId,
      'role_and_business_object_derivation',
      async () => {
        await runTask13FunctionInventoryThenAdvance(rawId);
      },
      DEBUG_CONTINUE_TO_TASK_13_PROMPT,
    );
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask8ToTask85IfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) ||
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_85) ||
      task8L45AlignmentPending.value ||
      !isTask8L45AwaitingDebugContinueToTask85()
    ) {
      return;
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'role_object_stm_inference', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c85n = cs.find((c) => c.lineTaskId === 'physical_hook_integration_inference');
      if (!c85n) {
        c85n = {
          key: `physical_hook_integration_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'physical_hook_integration_inference',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c85n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask85PhysicalHookPipelineImpl(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask85ToTask9IfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) ||
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_9) ||
      task85L475AlignmentPending.value ||
      !isTask85AwaitingDebugContinueToTask9()
    ) {
      return;
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'physical_hook_integration_inference', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c9n = cs.find((c) => c.lineTaskId === 'business_capability_positioning');
      if (!c9n) {
        c9n = {
          key: `business_capability_positioning-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'business_capability_positioning',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c9n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask9L5BlueprintPipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask9ToTask10IfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
    opts?: { forceAfterTask9Success?: boolean },
  ): Promise<void> {
    if (
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) ||
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10) ||
      (!opts?.forceAfterTask9Success && !isTask9AwaitingDebugContinueToTask10())
    ) {
      return;
    }
    try {
      console.info('[design-detail:debug-pipeline-continue]', {
        phase: 'schedule_task9_to_task10',
        caseId: rawId,
        forceAfterTask9Success: !!opts?.forceAfterTask9Success,
      });
    } catch {
      /* ignore */
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'business_capability_positioning', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c10n = cs.find((c) => c.lineTaskId === 'process_type_derivation');
      if (!c10n) {
        c10n = {
          key: `process_type_derivation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'process_type_derivation',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c10n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask10L5TechnicalDdlPipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  /** @deprecated 兼容旧名；请用 scheduleDebugContinueAfterTask85ToTask9IfReady */
  async function scheduleDebugContinueAfterTask8L45SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    await scheduleDebugContinueAfterTask85ToTask9IfReady(rawId, mergedItem);
  }

  /** @deprecated 请用 isTask85AwaitingDebugContinueToTask9 */
  function isTask8L45AwaitingDebugContinueToTask9(): boolean {
    return isTask85AwaitingDebugContinueToTask9();
  }

  async function scheduleDebugContinueAfterTask7L4SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) || task7L4AlignmentPending.value) {
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    const tid = st?.currentTaskId;
    if (
      tid !== 'role_object_stm_inference' &&
      !(tid === 'key_requirement_scenarios' && st?.holdPastTask7 === true)
    ) {
      return;
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'key_requirement_scenarios', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c8n = cs.find((c) => c.lineTaskId === 'role_object_stm_inference');
      if (!c8n) {
        c8n = {
          key: `role_object_stm_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'role_object_stm_inference',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c8n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask8L45PrototypePipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask6L3SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) || task6L3AlignmentPending.value || task65L3AlignmentPending.value) return;
    const st = loadDesignDetailLineState(rawId);
    const tid = st?.currentTaskId;
    if (
      tid !== 'three_dimension_itgap_analysis' &&
      !(tid === 'pain_point_extraction' && st?.holdPastTask6 === true)
    ) {
      return;
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'pain_point_extraction', async () => {
      const abort = takeDesignDetailLlmAbortController();
      await runTask65ItGapPipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask65SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) return;
    const st = loadDesignDetailLineState(rawId);
    const tid = st?.currentTaskId;
    if (
      tid !== 'key_requirement_scenarios' &&
      !(tid === 'three_dimension_itgap_analysis' && st?.holdPastTask65 === true)
    ) {
      return;
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'three_dimension_itgap_analysis', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c7n = cs.find((c) => c.lineTaskId === 'key_requirement_scenarios');
      if (!c7n) {
        c7n = {
          key: `key_requirement_scenarios-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'key_requirement_scenarios',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c7n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask7L4CollaborationPipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  /** 深访重跑后：使用模式须自动衔接任务 6.5（调试模式仍走「是否继续」门闩） */
  async function continuePipelineAfterTask6SegmentForExperience(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
    epochAtStart?: number,
  ): Promise<void> {
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) {
      await scheduleDebugContinueAfterTask6L3SegmentIfReady(rawId, mergedItem);
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    if (!st) return;
    const shouldAdvanceToT65 =
      st.currentTaskId === 'three_dimension_itgap_analysis' || st.holdPastTask6 === true;
    if (!shouldAdvanceToT65) return;
    const t65 = findDynamicsCardByLineTaskId(cloneDynamics(), 'three_dimension_itgap_analysis');
    if (t65 && (t65.status === 'running' || t65.status === 'completed' || (t65.lines?.length ?? 0) > 0)) {
      return;
    }
    const epoch = epochAtStart ?? designDetailSessionGeneration;
    await runTask65ItGapPipeline(
      rawId,
      epoch,
      takeDesignDetailLlmAbortController(),
      mergedItem,
    );
  }

  /** 深访重跑后：使用模式须自动衔接任务 7（调试模式仍走「是否继续」门闩） */
  async function continuePipelineAfterTask65SegmentForExperience(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
    epochAtStart?: number,
  ): Promise<void> {
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) {
      await scheduleDebugContinueAfterTask65SegmentIfReady(rawId, mergedItem);
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    if (!st) return;
    if (st.holdPastTask6 === true && st.holdPastTask65 !== true) return;
    const shouldAdvanceToT7 = st.holdPastTask65 === true;
    if (!shouldAdvanceToT7) return;
    const t7 = findDynamicsCardByLineTaskId(cloneDynamics(), 'key_requirement_scenarios');
    if (t7 && (t7.status === 'running' || t7.status === 'completed' || (t7.lines?.length ?? 0) > 0)) {
      return;
    }
    const epoch = epochAtStart ?? designDetailSessionGeneration;
    await runTask7L4CollaborationPipeline(
      rawId,
      epoch,
      takeDesignDetailLlmAbortController(),
      mergedItem,
    );
  }

  /** 使用模式 hydrate 后：补跑未启动的任务 6.5 / 7（旧会话直跳或刷新中断） */
  async function resumeDesignDetailPipelineAfterHydrateIfNeeded(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) return;
    if (hasAnyAlignmentPendingRef()) return;
    if (fullRestartBusy.value || restartBusy.value) return;
    const st = loadDesignDetailLineState(rawId);
    if (!st) return;
    const repaired = repairDesignDetailLineStateForMissingTask65(st);
    if (repaired.currentTaskId !== st.currentTaskId) {
      saveDesignDetailLineState(rawId, repaired);
      currentDesignLineTaskId.value = repaired.currentTaskId;
    }
    if (repaired.holdPastTask6 === true && repaired.holdPastTask65 !== true) {
      const cards = cloneDynamics();
      const t7Idx = cards.findIndex((c) => c.lineTaskId === 'key_requirement_scenarios');
      if (t7Idx >= 0) {
        const t7 = cards[t7Idx]!;
        const t7Started =
          t7.status === 'running' ||
          t7.status === 'completed' ||
          (t7.lines?.length ?? 0) > 0;
        const t65 = cards.find((c) => c.lineTaskId === 'three_dimension_itgap_analysis');
        const t65Done = t65?.status === 'completed';
        if (t7Started && !t65Done) {
          cards.splice(t7Idx, 1);
          dynamicsCards.value = cards;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
        }
      }
    }
    await continuePipelineAfterTask6SegmentForExperience(rawId, mergedItem);
    await continuePipelineAfterTask65SegmentForExperience(rawId, mergedItem);
  }

  async function scheduleDebugContinueAfterTask51SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) ||
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_52) ||
      task51L3AlignmentPending.value
    ) {
      return;
    }
    const cards = cloneDynamics();
    const t51 = cards.find((c) => c.lineTaskId === 'value_proposition_capability_units');
    const t51Done = t51?.status === 'completed';
    const t52 = cards.find((c) => c.lineTaskId === 'capability_field_set_mapping');
    const t52NotStarted =
      !t52 ||
      (t52.status !== 'completed' && (t52.lines?.length ?? 0) === 0 && t52.status !== 'running');
    if (!t51Done || !t52NotStarted) {
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    const tid = st?.currentTaskId;
    if (
      tid !== 'capability_field_set_mapping' &&
      !(tid === 'value_proposition_capability_units' && st?.holdPastTask51 === true)
    ) {
      saveDesignDetailLineState(rawId, {
        schemaVersion: 1,
        currentTaskId: 'capability_field_set_mapping',
        holdPastTask5: true,
        holdPastTask51: true,
      });
      currentDesignLineTaskId.value = 'capability_field_set_mapping';
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'value_proposition_capability_units', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c52n = findDynamicsCardByLineTaskId(cs, 'capability_field_set_mapping');
      if (!c52n || c52n.status === 'completed') {
        cs = cs.filter(
          (c) =>
            c.lineTaskId !== 'capability_field_set_mapping' || c.status === 'completed',
        );
        c52n = {
          key: `capability_field_set_mapping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'capability_field_set_mapping',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c52n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask52AssetFieldSetPipelineImpl(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask52SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) || !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_53)) {
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    const tid = st?.currentTaskId;
    if (
      tid !== 'key_scenario_temporal_flow_inference' &&
      !(tid === 'capability_field_set_mapping' && st?.holdPastTask52 === true)
    ) {
      return;
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'capability_field_set_mapping', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c53n = findDynamicsCardByLineTaskId(cs, 'key_scenario_temporal_flow_inference');
      if (!c53n || c53n.status === 'completed') {
        cs = cs.filter(
          (c) =>
            c.lineTaskId !== 'key_scenario_temporal_flow_inference' || c.status === 'completed',
        );
        c53n = {
          key: `key_scenario_temporal_flow_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'key_scenario_temporal_flow_inference',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c53n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask53WorkflowFlowPipelineImpl(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask53SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) ||
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_55)
    ) {
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    const tid = st?.currentTaskId;
    if (
      tid !== 'vsm_stage_decomposition' &&
      !(tid === 'key_scenario_temporal_flow_inference' && st?.holdPastTask53 === true)
    ) {
      return;
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'key_scenario_temporal_flow_inference', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c55n = cs.find((c) => c.lineTaskId === 'vsm_stage_decomposition');
      if (!c55n) {
        c55n = {
          key: `vsm_stage_decomposition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'vsm_stage_decomposition',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c55n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask55L3VsmStagePipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask55L3SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) ||
      task55L3AlignmentPending.value
    ) {
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    const tid = st?.currentTaskId;
    /** 5.5 收官后应为任务 6 线步；兼容 reconcile 尚未写盘时仍停在 5.5 且 holdPastTask55 */
    if (
      tid !== 'pain_point_extraction' &&
      !(tid === 'vsm_stage_decomposition' && st?.holdPastTask55 === true)
    ) {
      return;
    }
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'vsm_stage_decomposition', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c6n = cs.find((c) => c.lineTaskId === 'pain_point_extraction');
      if (!c6n) {
        c6n = {
          key: `pain_point_extraction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'pain_point_extraction',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c6n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask6L3ScenarioPipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function scheduleDebugContinueAfterTask4L2SegmentIfReady(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (
      !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) ||
      task4L2AlignmentPending.value ||
      task5L3AlignmentPending.value
    ) {
      return;
    }
    const st = loadDesignDetailLineState(rawId);
    if (st?.currentTaskId !== 'macro_process_flow_inference') return;
    const epoch = designDetailSessionGeneration;
    appendDebugContinueAtLineTaskEnd(rawId, 'core_value_driver_inference', async () => {
      const abort = takeDesignDetailLlmAbortController();
      let cs = cloneDynamics();
      let c5n = cs.find((c) => c.lineTaskId === 'macro_process_flow_inference');
      if (!c5n) {
        c5n = {
          key: `macro_process_flow_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'macro_process_flow_inference',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cs = [...cs, c5n];
      }
      dynamicsCards.value = cs;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await runTask5L3MacroProcessPipeline(rawId, epoch, abort, mergedItem);
    });
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function onDebugPipelineStepContinue(opts?: { force?: boolean }): Promise<void> {
    if (!opts?.force && !designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) return;
    const rawId = String(caseIdRef.value || '').trim();
    if (!rawId) return;
    if (debugPipelineContinueBusy.value) return;
    let fn = pendingDebugPipelineContinueAction.value;
    if (typeof fn !== 'function' && isTask0AwaitingDebugContinueToTask1()) {
      await ensureTask0ToTask1DebugContinueGate(rawId);
      fn = pendingDebugPipelineContinueAction.value;
    }
    if (typeof fn !== 'function') {
      logTask10ArchGate('debug_continue_click_no_pending', {
        caseId: rawId,
        hasPromptLine: dynamicsCardsHaveDebugStepContinuePrompt(),
      });
      return;
    }
    debugPipelineContinueBusy.value = true;
    try {
      try {
        console.info('[design-detail:debug-pipeline-continue]', { caseId: rawId });
        logTask10ArchGate('debug_continue_click', { caseId: rawId });
      } catch {
        /* ignore */
      }
      pendingDebugPipelineContinueAction.value = null;
      stripDebugStepContinuePromptLines(rawId);
      await fn();
      if (designDetailProgressPersistTimer) {
        clearTimeout(designDetailProgressPersistTimer);
        designDetailProgressPersistTimer = null;
      }
      await flushPersistDesignDetailProgressWorkspace(rawId);
      queuePersistDesignDetailProgressWorkspace();
    } finally {
      debugPipelineContinueBusy.value = false;
    }
  }

  watch(designDetailExperienceMode, async (mode) => {
    if (mode !== 'usage') return;
    if (typeof pendingDebugPipelineContinueAction.value !== 'function') return;
    if (debugPipelineContinueBusy.value) return;
    await onDebugPipelineStepContinue({ force: true });
  });

  function safeJsonStringify(x: unknown): string {
    try {
      return JSON.stringify(x ?? {}, null, 2);
    } catch {
      return '';
    }
  }

  /** 需求提炼成功后进度灰行：单行简报，不枚举各分域键（完整结构见聊天 `task1LlmQueryBlock`） */
  function buildCustomerRequirementProgressBriefForCard(parsed: Record<string, unknown>): string {
    let meaningful = 0;
    for (const k of Object.keys(parsed)) {
      if (typeof k !== 'string' || !k || k.startsWith('__')) continue;
      const v = parsed[k];
      if (v == null) continue;
      if (typeof v === 'string' && !v.trim()) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
      meaningful += 1;
    }
    return `客户需求提炼已完成（${meaningful} 个顶层维度有内容；完整 JSON 见下方 LLM 块）。`;
  }

  /** 与 `customerRequirementSectionSyncProgressLines` 产出一致，供「重发工商」等场景剥线 */
  function collectCustomerRequirementSectionSyncLineTexts(): Set<string> {
    const s = new Set<string>();
    for (const { key } of CUSTOMER_REQUIREMENT_GRAPH_SYNC_AFTER_DISTILL) {
      const { start, done } = customerRequirementSectionSyncProgressLines(key);
      s.add(start);
      s.add(done);
    }
    return s;
  }

  function finalizeCustomerRequirementSectionDerivingLine(caseId: string, startLine: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    const idx = c1
      ? findLastProgressLineIndex(c1.lines, (l) => l.kind === 'bmc_generating' && l.full === startLine)
      : -1;
    /** 绿勾改挂在下一行「完成…逻辑提炼」；此处仅去掉行尾转圈 */
    if (c1 && idx >= 0) delete c1.lines[idx]!.bmcGenUi;
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function removeCustomerRequirementSectionDerivingLine(caseId: string, startLine: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    const idx = findLastProgressLineIndex(
      c1.lines,
      (l) => l.full === startLine && l.kind === 'bmc_generating',
    );
    if (idx >= 0) c1.lines.splice(idx, 1);
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  /** 需求画布当前子 Tab 正文（数组编号分行，与详情页行式展示相近） */
  function formatCustomerRequirementSubTabValue(parsed: Record<string, unknown>, key: string): string {
    const raw = parsed[key];
    if (raw == null) return '—';
    if (Array.isArray(raw)) {
      const parts = raw.map((x) => String(x).trim()).filter((s) => s.length > 0);
      if (parts.length === 0) return '—';
      return parts.map((x, i) => `${i + 1}. ${x}`).join('\n');
    }
    if (typeof raw === 'object') return safeJsonStringify(raw);
    const s = String(raw).trim();
    return s.length ? s : '—';
  }

  /** 刷新后从聊天中的「设计详情 BMC 生成」块回放任务动态尾段 */
  function syncDesignDetailBmcFromPersistedMessages(
    card: DynamicsCardModel,
    messages: Array<Record<string, unknown>>,
  ): boolean {
    if (card.lineTaskId !== 'customer_basic') return false;
    let blockIdx = -1;
    let block: Record<string, unknown> | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m &&
        m.type === 'task1LlmQueryBlock' &&
        String((m as { noteName?: string }).noteName || '') === DESIGN_DETAIL_BMC_NOTE
      ) {
        blockIdx = i;
        block = m as Record<string, unknown>;
        break;
      }
    }
    if (!block || blockIdx < 0) return false;
    const ts = String((block.timestamp as string | undefined) || '');
    if (card.lastDesignBmcHydratedKey === ts) return false;
    if (card.lines.some((l) => l.full === '→ bmc 生成')) {
      card.lastDesignBmcHydratedKey = ts;
      return false;
    }
    card.lastDesignBmcHydratedKey = ts;

    let userBody = '';
    for (let j = blockIdx - 1; j >= 0; j--) {
      const m = messages[j];
      if (m && m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
        userBody = String(m.content).replace(/\r\n/g, '\n');
        break;
      }
    }
    if (userBody) {
      appendLineToCard(card, '→ 接收到用户输入', 'default', { startFullyRevealed: true });
      appendLineToCard(card, `「${userBody}`, 'user_quote', { startFullyRevealed: true });
    }
    appendLineToCard(card, '→ 正在生成 bmc', 'bmc_generating', {
      bmcGenUi: 'check',
      startFullyRevealed: true,
    });
    appendLineToCard(card, '→ bmc 生成', 'default', { startFullyRevealed: true });
    const raw =
      typeof block.llmOutputRaw === 'string' && String(block.llmOutputRaw).trim()
        ? String(block.llmOutputRaw).trim()
        : safeJsonStringify((block as { llmOutputJson?: unknown }).llmOutputJson);
    appendLineToCard(card, raw, 'bmc_result_quote', { startFullyRevealed: true });
    return true;
  }

  /** 任务 0 推进链路快照（控制台 filter：`[design-detail:task0-pipeline]`） */
  function diagTask0PipelineState(caseId: string): Record<string, unknown> {
    const cards = dynamicsCards.value;
    const t0 = cards.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
    return {
      caseId,
      sessionGeneration: designDetailSessionGeneration,
      pendingStreamAdvance,
      task0AutoAdvanceDone,
      task0FinalizeInFlight,
      currentDesignLineTaskId: currentDesignLineTaskId.value,
      suppressPersistedReplay: designDynamicsSuppressPersistedReplay.value,
      revealTimerActive: !!revealTimer,
      t0Status: t0?.status,
      t0CompletionQueued: t0?.completionQueued,
      t0LineCount: t0?.lines?.length ?? 0,
      t0LinesReveal: (t0?.lines ?? []).map((l) => ({
        cursor: l.cursor,
        len: cpLen(l.full),
        kind: l.kind,
        head: String(l.full).slice(0, 40),
      })),
      allRevealed: allLinesFullyRevealed(cards),
      debugStepContinue: designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE),
      debugPauseBeforeTask1: designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1),
      hasDebugContinuePrompt: dynamicsCardsHaveDebugStepContinuePrompt(),
      pendingContinueFn: typeof pendingDebugPipelineContinueAction.value === 'function',
    };
  }

  function forceRevealAllDynamicsLines(trigger: string): boolean {
    const cards = cloneDynamics();
    let changed = false;
    for (const c of cards) {
      for (const row of c.lines) {
        const len = cpLen(row.full);
        if (row.cursor < len) {
          row.cursor = len;
          changed = true;
        }
      }
    }
    if (changed) {
      dynamicsCards.value = cards;
      logDesignDetailTask0Pipeline('force_reveal_all', { trigger, ...diagTask0PipelineState(String(caseIdRef.value || '').trim()) });
    }
    return changed;
  }

  const task0AdvanceWatchdogTimers: ReturnType<typeof setTimeout>[] = [];

  function clearTask0AdvanceWatchdogs(): void {
    for (const t of task0AdvanceWatchdogTimers) clearTimeout(t);
    task0AdvanceWatchdogTimers.length = 0;
  }

  function scheduleTask0AdvanceWatchdog(caseId: string, trigger: string, attempt: number): void {
    const delays = [2500, 6000, 15000];
    const delay = delays[attempt];
    if (delay == null) return;
    const timer = window.setTimeout(() => {
      const cid = String(caseIdRef.value || '').trim();
      if (cid !== caseId) return;
      if (task0AutoAdvanceDone) return;
      const snap = diagTask0PipelineState(caseId);
      logDesignDetailTask0Pipeline('watchdog_tick', { trigger, attempt, delayMs: delay, ...snap });
      if (task0AutoAdvanceDone) return;
      if (!allLinesFullyRevealed(dynamicsCards.value)) {
        forceRevealAllDynamicsLines(`watchdog_${trigger}_${attempt}`);
      }
      if (!pendingStreamAdvance && !task0FinalizeInFlight && !task0AutoAdvanceDone) {
        pendingStreamAdvance = 't0';
        logDesignDetailTask0Pipeline('watchdog_restore_pending_t0', { trigger, attempt });
      }
      ensureRevealTicker(caseId);
      tryFinalizeStreamAdvance(caseId);
      if (!task0AutoAdvanceDone && attempt + 1 < delays.length) {
        scheduleTask0AdvanceWatchdog(caseId, trigger, attempt + 1);
      }
    }, delay);
    task0AdvanceWatchdogTimers.push(timer);
  }

  /** 完全重启 / bootstrap 后：挂 reveal、尝试收官，并注册看门狗（防 reveal 停转或 finalize 早退后永卡） */
  function kickoffTask0StreamAdvance(caseId: string, trigger: string): void {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    clearTask0AdvanceWatchdogs();
    logDesignDetailTask0Pipeline('kickoff_enter', { trigger, ...diagTask0PipelineState(cid) });
    pendingStreamAdvance = 't0';
    ensureRevealTicker(cid);
    if (allLinesFullyRevealed(dynamicsCards.value)) {
      logDesignDetailTask0Pipeline('kickoff_try_finalize_immediate', { trigger });
      tryFinalizeStreamAdvance(cid);
    } else {
      logDesignDetailTask0Pipeline('kickoff_wait_reveal', { trigger });
    }
    scheduleTask0AdvanceWatchdog(cid, trigger, 0);
  }

  function tryFinalizeStreamAdvance(caseId: string) {
    if (!pendingStreamAdvance) {
      return;
    }
    if (!allLinesFullyRevealed(dynamicsCards.value)) {
      logDesignDetailTask0Pipeline('try_finalize_skip_not_revealed', {
        pending: pendingStreamAdvance,
        ...diagTask0PipelineState(String(caseId || '').trim()),
      });
      return;
    }
    const cid = String(caseId || '').trim();
    if (!cid) {
      logDesignDetailTask0Pipeline('try_finalize_skip_no_case', { pending: pendingStreamAdvance });
      pendingStreamAdvance = null;
      return;
    }
    if (pendingStreamAdvance === 't0') {
      logDesignDetailTask0Pipeline('try_finalize_invoke_t0', { ...diagTask0PipelineState(cid) });
      void finalizeTask0CompletionWithSync(cid);
      return;
    }
    const item = lastResolvedItem.value ?? lastHydratedItem.value;
    const msgs = lastHydratedMessages.value;
    if (!item || !msgs.length) {
      pendingStreamAdvance = null;
      return;
    }
    if (pendingStreamAdvance === 't1') {
      const cards = cloneDynamics();
      const card = cards.find((x) => x.lineTaskId === 'customer_basic');
      if (card && card.status === 'running') {
        card.status = 'completed';
        card.completedAtMs = Date.now();
      }
      dynamicsCards.value = cards;
      const next = reconcileDesignDetailLineTaskId(cid, item, msgs, task1CustomerRequirementPhase.value);
      currentDesignLineTaskId.value = next;
      pendingStreamAdvance = null;
      if (next === 'all_done') {
        const cards2 = cloneDynamics();
        const c1 = cards2.find((x) => x.lineTaskId === 'customer_basic');
        if (c1 && !c1.thanksAppended) {
          appendLineToCard(c1, '→ 任务已完成！谢谢', 'default');
          c1.thanksAppended = true;
          dynamicsCards.value = cards2;
        }
      }
      ensureRevealTicker(caseId);
    }
  }

  function ensureRevealTicker(caseId: string) {
    if (revealTimer) return;
    logDesignDetailTask0Pipeline('reveal_ticker_start', {
      caseId: String(caseId || '').trim(),
      ...diagTask0PipelineState(String(caseId || '').trim()),
    });
    revealTimer = setInterval(() => {
      const cards = dynamicsCards.value;
      let changed = false;
      outer: for (const card of cards) {
        for (const row of card.lines) {
          const len = cpLen(row.full);
          if (row.cursor >= len) continue;
          const baseStep = row.cursor >= PROGRESS_LONG_LINE_CP ? PROGRESS_BURST_CP : 1;
          const rateRaw = row.revealRate;
          const rate = typeof rateRaw === 'number' && Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : 1;
          let step: number;
          if (rate === 1) {
            step = baseStep;
          } else {
            const debt = (row.revealDebt ?? 0) + baseStep * rate;
            step = Math.min(len - row.cursor, Math.floor(debt));
            row.revealDebt = debt - step;
          }
          row.cursor = Math.min(len, row.cursor + step);
          changed = true;
          break outer;
        }
      }
      if (changed) dynamicsCards.value = cloneDynamics();
      tryFinalizeStreamAdvance(caseId);
      if (dynamicsCards.value.every((c) => c.lines.every((r) => r.cursor >= cpLen(r.full)))) {
        logDesignDetailTask0Pipeline('reveal_ticker_all_done', {
          caseId: String(caseId || '').trim(),
          pendingStreamAdvance,
          task0AutoAdvanceDone,
        });
        clearRevealInterval();
      }
    }, 22);
  }

  type ProgressLineKindExt =
    | ProgressLineKind
    | 'task51_inference_sub'
    | 'task52_inference_sub'
    | 'task52_logic_understanding';

  function buildProgressLineRow(
    full: string,
    kind: ProgressLineKindExt = 'default',
    opts?: AppendLineOpts,
  ): ProgressLineModel | null {
    let normalized: string;
    if (
      kind === 'user_quote' ||
      kind === 'bmc_result_quote' ||
      kind === 'token_validation_mapping_quote' ||
      kind === 'task2_alignment_questionnaire_sub' ||
      kind === 'task3_alignment_questionnaire_sub' ||
      kind === 'task4_alignment_questionnaire_sub' ||
      kind === 'task5_alignment_questionnaire_sub' ||
      kind === 'task51_alignment_questionnaire_sub' ||
      kind === 'task55_alignment_questionnaire_sub' ||
      kind === 'task6_alignment_questionnaire_sub' ||
      kind === 'task65_alignment_questionnaire_sub' ||
      kind === 'task7_alignment_questionnaire_sub' ||
      kind === 'task8_alignment_questionnaire_sub' ||
      kind === 'task85_alignment_questionnaire_sub' ||
      kind === 'task9_alignment_questionnaire_sub' ||
      kind === 'task10_alignment_questionnaire_sub' ||
      kind === 'task3_inference_sub' ||
      kind === 'task4_inference_sub' ||
      kind === 'task5_inference_sub' ||
      kind === 'task51_inference_sub' ||
      kind === 'task52_inference_sub' ||
      kind === 'task52_logic_understanding' ||
      kind === 'task55_inference_sub' ||
      kind === 'task6_inference_sub' ||
      kind === 'task65_inference_sub' ||
      kind === 'task7_inference_sub' ||
      kind === 'task8_inference_sub' ||
      kind === 'task85_inference_sub' ||
      kind === 'task9_inference_sub' ||
      kind === 'task10_inference_sub' ||
      kind === 'alignment_diff_sub'
    ) {
      normalized = String(full || '');
    } else {
      normalized = normalizeProgressLine(full);
    }
    if (!normalized.trim() && !(kind === 'alignment_diff_sub' && opts?.alignmentDiff)) return null;
    const cursor = opts?.startFullyRevealed ? cpLen(normalized) : 0;
    const rateOpt = opts?.revealRate;
    const revealRate =
      !opts?.startFullyRevealed && typeof rateOpt === 'number' && Number.isFinite(rateOpt) && rateOpt > 0 && rateOpt !== 1
        ? rateOpt
        : undefined;
    return {
      id: progressLineIdSeq++,
      full: normalized,
      cursor,
      kind: kind as ProgressLineKind,
      bmcGenUi: opts?.bmcGenUi,
      spinnerBlue: opts?.spinnerBlue,
      ...(opts?.alignmentDiff ? { alignmentDiff: { ...opts.alignmentDiff } } : {}),
      ...(opts?.inferenceFeatureId
        ? { inferenceFeatureId: String(opts.inferenceFeatureId).trim() }
        : {}),
      ...(revealRate != null ? { revealRate, revealDebt: 0 } : {}),
    };
  }

  function appendLineToCard(
    card: DynamicsCardModel,
    full: string,
    kind: ProgressLineKindExt = 'default',
    opts?: AppendLineOpts,
  ) {
    const row = buildProgressLineRow(full, kind, opts);
    if (row) card.lines.push(row);
  }

  function insertProgressLineRowAt(
    card: DynamicsCardModel,
    index: number,
    full: string,
    kind: ProgressLineKindExt = 'default',
    opts?: AppendLineOpts,
  ): void {
    const row = buildProgressLineRow(full, kind, opts);
    if (!row) return;
    if (index >= 0 && index <= card.lines.length) {
      card.lines.splice(index, 0, row);
    } else {
      card.lines.push(row);
    }
  }

  /** 在「→ 功能理解：表名」子任务下串行插入子进度；使用模式不含大模型 JSON */
  async function pushTask52TableDebugProgressSerial(
    rawId: string,
    tableName: string,
    tableRaw: string,
  ): Promise<void> {
    const entries = buildTask52TableSubtaskProgressEntries(tableRaw, {
      includeLlmJson: isDesignDetailDebugExperienceActive(),
    });
    if (!entries.length) return;
    for (const entry of entries) {
      withTask52L3DynamicsCard((card) => {
        const idx = findTask52TableSubtaskBlockEndIndex(card.lines, tableName);
        insertProgressLineRowAt(card, idx, entry.full, entry.kind, {
          startFullyRevealed: entry.startFullyRevealed ?? true,
        });
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await waitUntilDynamicsFullyRevealed();
    }
  }

  /** 在「→ {阶段}｜关键场景推理」子任务下串行插入子进度；使用模式不展示大模型 JSON 灰块 */
  async function pushTask6PhaseDebugProgressSerial(
    rawId: string,
    phaseLabel: string,
    phaseRaw: string,
  ): Promise<void> {
    const entries = buildTask6PhaseSubtaskProgressEntries(phaseRaw, {
      includeLlmJson: isDesignDetailDebugExperienceActive(),
    });
    if (!entries.length) return;
    for (const entry of entries) {
      withTask6L3DynamicsCard((card) => {
        const idx = findTask6PhaseSubtaskBlockEndIndex(card.lines, phaseLabel);
        insertProgressLineRowAt(card, idx, entry.full, entry.kind, {
          startFullyRevealed: entry.startFullyRevealed ?? true,
        });
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await waitUntilDynamicsFullyRevealed();
    }
  }

  /** 在「→ {价值流阶段-流程环节}｜任务节点IT选型」子任务下插入调试 JSON 与逻辑提取进度 */
  async function pushTask7SubtaskProgressAfterInference(
    rawId: string,
    progressLabel: string,
    stepRaw: string,
  ): Promise<void> {
    const jsonEntries = buildTask7L4SubtaskProgressEntries(stepRaw, {
      includeLlmJson: isDesignDetailDebugExperienceActive(),
      includeLogicExtract: false,
    });
    const logicEntries = buildTask7L4SubtaskProgressEntries(stepRaw, {
      includeLlmJson: false,
      includeLogicExtract: true,
    });
    const entries = [...jsonEntries, ...logicEntries];
    if (!entries.length) return;
    for (const entry of entries) {
      withTask7L4DynamicsCard((card) => {
        const idx = findTask7L4SubtaskBlockEndIndex(card.lines, progressLabel);
        insertProgressLineRowAt(card, idx, entry.full, entry.kind, {
          startFullyRevealed: entry.startFullyRevealed ?? true,
        });
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await waitUntilDynamicsFullyRevealed();
    }
  }

  /** 在「→ {价值流阶段-流程环节}｜三维 IT-Gap 分析」子任务下串行插入子进度；使用模式不展示 JSON 灰块 */
  async function pushTask65StepDebugProgressSerial(
    rawId: string,
    progressLabel: string,
    stepRaw: string,
  ): Promise<void> {
    const entries = buildTask65ItGapSubtaskProgressEntries(stepRaw, {
      includeLlmJson: isDesignDetailDebugExperienceActive(),
    });
    if (!entries.length) return;
    for (const entry of entries) {
      withTask65L3DynamicsCard((card) => {
        const idx = findTask65ItGapSubtaskBlockEndIndex(card.lines, progressLabel);
        insertProgressLineRowAt(card, idx, entry.full, entry.kind, {
          startFullyRevealed: entry.startFullyRevealed ?? true,
        });
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await waitUntilDynamicsFullyRevealed();
    }
  }

  /** 在「→ 流程理解：流程名」子任务下串行插入子进度；使用模式不推送子行 */
  async function pushTask53ProcessDebugProgressSerial(
    rawId: string,
    processName: string,
    processRaw: string,
  ): Promise<void> {
    const entries = buildTask53ProcessSubtaskProgressEntries(processRaw, {
      includeLlmJson: isDesignDetailDebugExperienceActive(),
    });
    if (!entries.length) return;
    for (const entry of entries) {
      withTask53L3DynamicsCard((card) => {
        const idx = findTask53ProcessSubtaskBlockEndIndex(card.lines, processName);
        insertProgressLineRowAt(card, idx, entry.full, entry.kind, {
          startFullyRevealed: entry.startFullyRevealed ?? true,
        });
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await waitUntilDynamicsFullyRevealed();
    }
  }

  /** 落库后：在各「→ 流程理解」子任务块末尾插入正向归纳链接行（仅调试模式） */
  async function pushTask53ProcessForwardLinkDebugProgressSerial(
    rawId: string,
    processNames: readonly string[],
    mergedTasks: DesignDetailLogicGraphTaskDto[],
  ): Promise<void> {
    if (!isDesignDetailDebugExperienceActive()) return;
    for (const processName of processNames) {
      const entries = buildTask53ProcessForwardLinkDebugProgressEntries(processName, mergedTasks);
      if (!entries.length) continue;
      for (const entry of entries) {
        withTask53L3DynamicsCard((card) => {
          const idx = findTask53ProcessSubtaskBlockEndIndex(card.lines, processName);
          insertProgressLineRowAt(card, idx, entry.full, entry.kind, {
            startFullyRevealed: entry.startFullyRevealed ?? true,
          });
        }, rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
        await waitUntilDynamicsFullyRevealed();
      }
    }
  }

  type GraphTaskRow = { taskId?: string; features?: Task2L1TaskGraphFeatureRow[] };

  function resolveDesignDetailTaskGraphFetcher():
    | ((id: string) => Promise<{ ok?: boolean; data?: { tasks?: GraphTaskRow[] } }>)
    | undefined {
    return (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (
              id: string,
            ) => Promise<{ ok?: boolean; data?: { tasks?: GraphTaskRow[] } }>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;
  }

  async function fetchAlignmentFeatureSnapshotForCase(
    caseId: string,
    lineTaskId: AlignmentDynamicsLineTaskId,
  ): Promise<AlignmentFeatureSnapshot> {
    const getGraph = resolveDesignDetailTaskGraphFetcher();
    if (typeof getGraph !== 'function') return {};
    try {
      const gr = await getGraph(caseId);
      if (gr && gr.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
        return buildAlignmentFeatureSnapshotForLineTask(gr.data.tasks, lineTaskId);
      }
    } catch {
      /* 比对失败时仍推主行，子行可省略 */
    }
    return {};
  }

  /** 深访对齐：提交瞬间推送「接收到反馈」+ 用户原文灰块 */
  async function appendAlignmentFeedbackReceivedProgress(
    caseId: string,
    lineTaskId: AlignmentDynamicsLineTaskId,
    userText: string,
  ): Promise<void> {
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === lineTaskId);
    if (card) {
      appendLineToCard(card, ALIGNMENT_FEEDBACK_RECEIVED_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        card,
        formatAlignmentUserFeedbackProgressText(userText),
        'alignment_user_feedback_sub',
        { startFullyRevealed: true },
      );
    }
    dynamicsCards.value = cards;
    ensureRevealTicker(caseId);
    await flushPersistDesignDetailProgressWorkspace(caseId);
    queuePersistDesignDetailProgressWorkspace();
  }

  function appendAlignmentDiffSubLine(card: DynamicsCardModel, item: AlignmentDiffLinePayload): void {
    appendLineToCard(card, '', 'alignment_diff_sub', {
      startFullyRevealed: true,
      alignmentDiff: item,
    });
  }

  /** 深访对齐：重跑 pipeline 完成后推送修改说明与 diff 子行 */
  async function appendAlignmentRerunDiffProgress(
    caseId: string,
    lineTaskId: AlignmentDynamicsLineTaskId,
    beforeSnap: AlignmentFeatureSnapshot,
  ): Promise<void> {
    const afterSnap = await fetchAlignmentFeatureSnapshotForCase(caseId, lineTaskId);
    const diffs = buildAlignmentInferenceDiffItems(beforeSnap, afterSnap);
    const cards = cloneDynamics();
    const card = cards.find((c) => c.lineTaskId === lineTaskId);
    if (card) {
      appendLineToCard(card, ALIGNMENT_CHANGES_APPLIED_LINE, 'default', { startFullyRevealed: true });
      if (!diffs.length) {
        appendLineToCard(card, ALIGNMENT_NO_STRUCTURAL_CHANGES_LINE, 'task3_inference_sub', {
          startFullyRevealed: true,
        });
      } else {
        for (const d of diffs) {
          appendAlignmentDiffSubLine(card, d);
        }
      }
    }
    dynamicsCards.value = cards;
    ensureRevealTicker(caseId);
    await flushPersistDesignDetailProgressWorkspace(caseId);
    queuePersistDesignDetailProgressWorkspace();
  }

  async function appendTask2L1AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsSync = cloneDynamics();
    const c2s = cardsSync.find((c) => c.lineTaskId === 'scale_org_mode_extract');
    if (!c2s) return;
    appendLineToCard(c2s, TASK2_L1_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsSync;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task2EntityPortraitBusy.value = false;
    task2L1AlignmentQuestionnaireBusy.value = true;
    const alignAbortT2 = takeDesignDetailLlmAbortController();
    const wQ = window as unknown as {
      generateDesignDetailTask2L1AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
      }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ.generateDesignDetailTask2L1AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtxT2 = {
          caseId: rawId,
          taskId: designLinePillLabel('scale_org_mode_extract'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK2_L1_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtxT2, () =>
          wQ.generateDesignDetailTask2L1AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtxT2, { signal: alignAbortT2.signal }),
          ),
        );
        if (designDetailSessionGeneration !== epochAtStart) {
          questionnaireMdFull = '（问卷生成已取消：会话已重置）';
        } else {
          questionnaireMdFull = String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
        }
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask2L1AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      questionnaireMdFull = `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task2L1AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine('scale_org_mode_extract', TASK2_L1_ALIGNMENT_Q_WORKING_LINE);
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsSync = cloneDynamics();
    const c2a = cardsSync.find((c) => c.lineTaskId === 'scale_org_mode_extract');
    if (c2a) {
      appendLineToCard(c2a, TASK2_L1_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c2a,
        truncateTask3L2DebugProgressText(questionnaireMdFull),
        'task2_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c2a, TASK2_L1_ALIGNMENT_CHAT_GUIDE_LINE, 'default', {
        startFullyRevealed: true,
      });
    }
    writeTask2L1AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task2L1AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'scale_org_mode_extract',
      ),
    };
    dynamicsCards.value = cardsSync;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask3L2AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c3a = cardsQ.find((c) => c.lineTaskId === 'industry_business_profile_extract');
    if (!c3a) return;
    appendLineToCard(c3a, TASK3_L2_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task3L2AlignmentQuestionnaireBusy.value = true;
    const alignAbort = takeDesignDetailLlmAbortController();
    const wQ3 = window as unknown as {
      generateDesignDetailTask3L2AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
      }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ3.generateDesignDetailTask3L2AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtx = {
          caseId: rawId,
          taskId: designLinePillLabel('industry_business_profile_extract'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK3_L2_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtx, () =>
          wQ3.generateDesignDetailTask3L2AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtx, { signal: alignAbort.signal }),
          ),
        );
        if (designDetailSessionGeneration !== epochAtStart) {
          questionnaireMdFull = '（问卷生成已取消：会话已重置）';
        } else {
          questionnaireMdFull = String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
        }
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask3L2AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      const aborted =
        (eq instanceof Error && (eq.name === 'AbortError' || /aborted|超时/i.test(eq.message))) ||
        (typeof eq === 'object' &&
          eq !== null &&
          'name' in eq &&
          String((eq as { name?: unknown }).name) === 'AbortError');
      questionnaireMdFull = aborted
        ? `（问卷生成失败：${eq instanceof Error ? eq.message : '请求已取消或超时'}）`
        : `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task3L2AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'industry_business_profile_extract',
        TASK3_L2_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c3b = cardsQ.find((c) => c.lineTaskId === 'industry_business_profile_extract');
    if (c3b) {
      appendLineToCard(c3b, TASK3_L2_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c3b,
        truncateTask3L2DebugProgressText(questionnaireMdFull),
        'task3_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c3b, TASK3_L2_ALIGNMENT_CHAT_GUIDE_LINE, 'default', {
        startFullyRevealed: true,
      });
    }
    writeTask3L2AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task3L2AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'industry_business_profile_extract',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask4L2AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c4a = cardsQ.find((c) => c.lineTaskId === 'core_value_driver_inference');
    if (!c4a) return;
    appendLineToCard(c4a, TASK4_L2_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task4L2AlignmentQuestionnaireBusy.value = true;
    const alignAbortT4 = takeDesignDetailLlmAbortController();
    const wQ4 = window as unknown as {
      generateDesignDetailTask4L2AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
      }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ4.generateDesignDetailTask4L2AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtxT4 = {
          caseId: rawId,
          taskId: designLinePillLabel('core_value_driver_inference'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK4_L2_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtxT4, () =>
          wQ4.generateDesignDetailTask4L2AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtxT4, { signal: alignAbortT4.signal }),
          ),
        );
        if (designDetailSessionGeneration !== epochAtStart) {
          questionnaireMdFull = '（问卷生成已取消：会话已重置）';
        } else {
          questionnaireMdFull = String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
        }
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask4L2AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      questionnaireMdFull = `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task4L2AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine('core_value_driver_inference', TASK4_L2_ALIGNMENT_Q_WORKING_LINE);
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c4b = cardsQ.find((c) => c.lineTaskId === 'core_value_driver_inference');
    if (c4b) {
      appendLineToCard(c4b, TASK4_L2_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c4b,
        truncateTask4L2DebugProgressText(questionnaireMdFull),
        'task4_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c4b, TASK4_L2_ALIGNMENT_CHAT_GUIDE_LINE, 'default', {
        startFullyRevealed: true,
      });
    }
    writeTask4L2AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task4L2AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'core_value_driver_inference',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask6L3AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c6a = cardsQ.find((c) => c.lineTaskId === 'pain_point_extraction');
    if (!c6a) return;
    appendLineToCard(c6a, TASK6_L3_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task6L3AlignmentQuestionnaireBusy.value = true;
    const alignAbort = takeDesignDetailLlmAbortController();
    const wQ6 = window as unknown as {
      generateDesignDetailTask6L3AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
      }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ6.generateDesignDetailTask6L3AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtx = {
          caseId: rawId,
          taskId: designLinePillLabel('pain_point_extraction'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK6_L3_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtx, () =>
          wQ6.generateDesignDetailTask6L3AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtx, { signal: alignAbort.signal }),
          ),
        );
        if (designDetailSessionGeneration !== epochAtStart) {
          questionnaireMdFull = '（问卷生成已取消：会话已重置）';
        } else {
          questionnaireMdFull = String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
        }
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask6L3AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      const aborted =
        (eq instanceof Error && (eq.name === 'AbortError' || /aborted|超时/i.test(eq.message))) ||
        (typeof eq === 'object' &&
          eq !== null &&
          'name' in eq &&
          String((eq as { name?: unknown }).name) === 'AbortError');
      questionnaireMdFull = aborted
        ? `（问卷生成失败：${eq instanceof Error ? eq.message : '请求已取消或超时'}）`
        : `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task6L3AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'pain_point_extraction',
        TASK6_L3_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c6b = cardsQ.find((c) => c.lineTaskId === 'pain_point_extraction');
    if (c6b) {
      appendLineToCard(c6b, TASK6_L3_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c6b,
        truncateTask6L3DebugProgressText(questionnaireMdFull),
        'task6_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c6b, TASK6_L3_ALIGNMENT_CHAT_GUIDE_LINE, 'default', {
        startFullyRevealed: true,
      });
    }
    writeTask6L3AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task6L3AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'pain_point_extraction',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  /** 在指定「价值流阶段-流程环节」子任务块下串行插入对齐问卷相关进度行 */
  async function pushTask65SubtaskAlignmentProgressSerial(
    rawId: string,
    progressLabel: string,
    entries: Array<{
      full: string;
      kind: 'default' | 'task65_alignment_questionnaire_sub';
      startFullyRevealed?: boolean;
    }>,
  ): Promise<void> {
    if (!entries.length) return;
    for (const entry of entries) {
      withTask65L3DynamicsCard((card) => {
        const idx = findTask65ItGapSubtaskBlockEndIndex(card.lines, progressLabel);
        insertProgressLineRowAt(card, idx, entry.full, entry.kind, {
          startFullyRevealed: entry.startFullyRevealed ?? true,
        });
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      await waitUntilDynamicsFullyRevealed();
    }
  }

  async function appendTask65SubtaskAlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    progressLabel: string,
    stepIndex: number,
    perStepRawOutputs: string[],
    conflictRows: Task2L1TvmParsedRow[],
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    const subLabel = String(progressLabel || '').trim();
    if (!rawId || !subLabel) return;
    const conflictBlock = buildTask65L3ConflictDatasetUserBlock(conflictRows);
    const questionnaireUserBlock = buildTask65ItGapAlignmentQuestionnaireUserBlock(
      conflictRows,
      subLabel,
    );
    pendingDebugPipelineContinueAction.value = null;
    await pushTask65SubtaskAlignmentProgressSerial(rawId, subLabel, [
      {
        full: TASK65_L3_ALIGNMENT_Q_WORKING_LINE,
        kind: 'default',
        startFullyRevealed: true,
      },
    ]);
    task65L3AlignmentQuestionnaireBusy.value = true;
    const alignAbort = takeDesignDetailLlmAbortController();
    const wQ65 = window as unknown as {
      generateDesignDetailTask65L3AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{ rawOutput?: string; content?: string }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ65.generateDesignDetailTask65L3AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtx = {
          caseId: rawId,
          taskId: designLinePillLabel('three_dimension_itgap_analysis'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK65_L3_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtx, () =>
          wQ65.generateDesignDetailTask65L3AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: questionnaireUserBlock },
            designDetailLlmFetchOpts(qAuditCtx, { signal: alignAbort.signal }),
          ),
        );
        if (designDetailSessionGeneration !== epochAtStart) {
          questionnaireMdFull = '（问卷生成已取消：会话已重置）';
        } else {
          questionnaireMdFull = String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
        }
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask65L3AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      const aborted =
        (eq instanceof Error && (eq.name === 'AbortError' || /aborted|超时/i.test(eq.message))) ||
        (typeof eq === 'object' &&
          eq !== null &&
          'name' in eq &&
          String((eq as { name?: unknown }).name) === 'AbortError');
      questionnaireMdFull = aborted
        ? `（问卷生成失败：${eq instanceof Error ? eq.message : '请求已取消或超时'}）`
        : `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task65L3AlignmentQuestionnaireBusy.value = false;
      withTask65L3DynamicsCard((card) => {
        const lines = card.lines;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (String(lines[i]?.full ?? '') === TASK65_L3_ALIGNMENT_Q_WORKING_LINE) {
            lines.splice(i, 1);
            break;
          }
        }
      }, rawId);
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    await pushTask65SubtaskAlignmentProgressSerial(rawId, subLabel, [
      { full: TASK65_L3_ALIGNMENT_DOUBT_LINE, kind: 'default', startFullyRevealed: true },
      {
        full: truncateTask65ItGapDebugProgressText(questionnaireMdFull),
        kind: 'task65_alignment_questionnaire_sub',
        startFullyRevealed: true,
      },
      { full: TASK65_L3_ALIGNMENT_CHAT_GUIDE_LINE, kind: 'default', startFullyRevealed: true },
    ]);
    writeTask65L3AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    writeTask65PipelineResume(rawId, {
      stepIndex,
      perStepRawOutputs: [...perStepRawOutputs],
      progressLabel: subLabel,
      epochAtStart,
    });
    task65L3AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'three_dimension_itgap_analysis',
      ),
      progressLabel: subLabel,
      stepIndex,
      perStepRawOutputs: [...perStepRawOutputs],
      epochAtStart,
    };
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask7L4AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c7a = cardsQ.find((c) => c.lineTaskId === 'key_requirement_scenarios');
    if (!c7a) return;
    appendLineToCard(c7a, TASK7_L4_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task7L4AlignmentQuestionnaireBusy.value = true;
    const alignAbort = takeDesignDetailLlmAbortController();
    const wQ7 = window as unknown as {
      generateDesignDetailTask7L4AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{ rawOutput?: string; content?: string }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ7.generateDesignDetailTask7L4AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtx = {
          caseId: rawId,
          taskId: designLinePillLabel('key_requirement_scenarios'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK7_L4_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtx, () =>
          wQ7.generateDesignDetailTask7L4AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtx, { signal: alignAbort.signal }),
          ),
        );
        questionnaireMdFull =
          designDetailSessionGeneration !== epochAtStart
            ? '（问卷生成已取消：会话已重置）'
            : String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask7L4AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      questionnaireMdFull = `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task7L4AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'key_requirement_scenarios',
        TASK7_L4_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c7b = cardsQ.find((c) => c.lineTaskId === 'key_requirement_scenarios');
    if (c7b) {
      appendLineToCard(c7b, TASK7_L4_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c7b,
        truncateTask7L4DebugProgressText(questionnaireMdFull),
        'task7_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c7b, TASK7_L4_ALIGNMENT_CHAT_GUIDE_LINE, 'default', { startFullyRevealed: true });
    }
    writeTask7L4AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task7L4AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'key_requirement_scenarios',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask8L45AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c8a = cardsQ.find((c) => c.lineTaskId === 'role_object_stm_inference');
    if (!c8a) return;
    appendLineToCard(c8a, TASK8_L45_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task8L45AlignmentQuestionnaireBusy.value = true;
    const alignAbort = takeDesignDetailLlmAbortController();
    const wQ8 = window as unknown as {
      generateDesignDetailTask8L45AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{ rawOutput?: string; content?: string }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ8.generateDesignDetailTask8L45AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtx = {
          caseId: rawId,
          taskId: designLinePillLabel('role_object_stm_inference'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK8_L45_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtx, () =>
          wQ8.generateDesignDetailTask8L45AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtx, { signal: alignAbort.signal }),
          ),
        );
        questionnaireMdFull =
          designDetailSessionGeneration !== epochAtStart
            ? '（问卷生成已取消：会话已重置）'
            : String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask8L45AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      questionnaireMdFull = `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task8L45AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'role_object_stm_inference',
        TASK8_L45_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c8b = cardsQ.find((c) => c.lineTaskId === 'role_object_stm_inference');
    if (c8b) {
      appendLineToCard(c8b, TASK8_L45_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c8b,
        truncateTask8L45DebugProgressText(questionnaireMdFull),
        'task8_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c8b, TASK8_L45_ALIGNMENT_CHAT_GUIDE_LINE, 'default', { startFullyRevealed: true });
    }
    writeTask8L45AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task8L45AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'role_object_stm_inference',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask85L475AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c85a = cardsQ.find((c) => c.lineTaskId === 'physical_hook_integration_inference');
    if (!c85a) return;
    appendLineToCard(c85a, TASK85_L475_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task85L475AlignmentQuestionnaireBusy.value = true;
    const alignAbort = takeDesignDetailLlmAbortController();
    const wQ85 = window as unknown as {
      generateDesignDetailTask85L475AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{ rawOutput?: string; content?: string }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ85.generateDesignDetailTask85L475AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtx = {
          caseId: rawId,
          taskId: designLinePillLabel('physical_hook_integration_inference'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK85_L475_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtx, () =>
          wQ85.generateDesignDetailTask85L475AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtx, { signal: alignAbort.signal }),
          ),
        );
        questionnaireMdFull =
          designDetailSessionGeneration !== epochAtStart
            ? '（问卷生成已取消：会话已重置）'
            : String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask85L475AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      questionnaireMdFull = `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task85L475AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'physical_hook_integration_inference',
        TASK85_L475_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c85b = cardsQ.find((c) => c.lineTaskId === 'physical_hook_integration_inference');
    if (c85b) {
      appendLineToCard(c85b, TASK85_L475_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c85b,
        truncateTask85L475DebugProgressText(questionnaireMdFull),
        'task85_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c85b, TASK85_L475_ALIGNMENT_CHAT_GUIDE_LINE, 'default', { startFullyRevealed: true });
    }
    writeTask85L475AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task85L475AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'physical_hook_integration_inference',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask9L5AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c9a = cardsQ.find((c) => c.lineTaskId === 'business_capability_positioning');
    if (!c9a) return;
    appendLineToCard(c9a, TASK9_L5_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task9L5AlignmentQuestionnaireBusy.value = true;
    const alignAbort = takeDesignDetailLlmAbortController();
    const wQ9 = window as unknown as {
      generateDesignDetailTask9L5AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{ rawOutput?: string; content?: string }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ9.generateDesignDetailTask9L5AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtx = {
          caseId: rawId,
          taskId: designLinePillLabel('business_capability_positioning'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK9_L5_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtx, () =>
          wQ9.generateDesignDetailTask9L5AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtx, { signal: alignAbort.signal }),
          ),
        );
        questionnaireMdFull =
          designDetailSessionGeneration !== epochAtStart
            ? '（问卷生成已取消：会话已重置）'
            : String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask9L5AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      questionnaireMdFull = `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task9L5AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'business_capability_positioning',
        TASK9_L5_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c9b = cardsQ.find((c) => c.lineTaskId === 'business_capability_positioning');
    if (c9b) {
      appendLineToCard(c9b, TASK9_L5_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c9b,
        truncateTask9L5DebugProgressText(questionnaireMdFull),
        'task9_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c9b, TASK9_L5_ALIGNMENT_CHAT_GUIDE_LINE, 'default', { startFullyRevealed: true });
    }
    writeTask9L5AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task9L5AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'business_capability_positioning',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask10L5AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c10a = cardsQ.find((c) => c.lineTaskId === 'process_type_derivation');
    if (!c10a) return;
    appendLineToCard(c10a, TASK10_L5_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task10L5AlignmentQuestionnaireBusy.value = true;
    const alignAbort = takeDesignDetailLlmAbortController();
    const wQ10 = window as unknown as {
      generateDesignDetailTask6L3AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
      }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ10.generateDesignDetailTask6L3AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtx = {
          caseId: rawId,
          taskId: designLinePillLabel('process_type_derivation'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK10_L5_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtx, () =>
          wQ10.generateDesignDetailTask6L3AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtx, { signal: alignAbort.signal }),
          ),
        );
        if (designDetailSessionGeneration !== epochAtStart) {
          questionnaireMdFull = '（问卷生成已取消：会话已重置）';
        } else {
          questionnaireMdFull = String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
        }
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask6L3AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      const aborted =
        (eq instanceof Error && (eq.name === 'AbortError' || /aborted|超时/i.test(eq.message))) ||
        (typeof eq === 'object' &&
          eq !== null &&
          'name' in eq &&
          String((eq as { name?: unknown }).name) === 'AbortError');
      questionnaireMdFull = aborted
        ? `（问卷生成失败：${eq instanceof Error ? eq.message : '请求已取消或超时'}）`
        : `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task10L5AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'process_type_derivation',
        TASK10_L5_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c10b = cardsQ.find((c) => c.lineTaskId === 'process_type_derivation');
    if (c10b) {
      appendLineToCard(c10b, TASK10_L5_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c10b,
        truncateTask10L5DebugProgressText(questionnaireMdFull),
        'task10_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c10b, TASK10_L5_ALIGNMENT_CHAT_GUIDE_LINE, 'default', {
        startFullyRevealed: true,
      });
    }
    writeTask10L5AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task10L5AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'process_type_derivation',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask5L3AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c5a = cardsQ.find((c) => c.lineTaskId === 'macro_process_flow_inference');
    if (!c5a) return;
    appendLineToCard(c5a, TASK5_L3_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task5L3AlignmentQuestionnaireBusy.value = true;
    const alignAbortT5 = takeDesignDetailLlmAbortController();
    const wQ5 = window as unknown as {
      generateDesignDetailTask5L3AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
      }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ5.generateDesignDetailTask5L3AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtxT5 = {
          caseId: rawId,
          taskId: designLinePillLabel('macro_process_flow_inference'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK5_L3_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtxT5, () =>
          wQ5.generateDesignDetailTask5L3AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtxT5, { signal: alignAbortT5.signal }),
          ),
        );
        if (designDetailSessionGeneration !== epochAtStart) {
          questionnaireMdFull = '（问卷生成已取消：会话已重置）';
        } else {
          questionnaireMdFull = String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
        }
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask5L3AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      questionnaireMdFull = `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task5L3AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'macro_process_flow_inference',
        TASK5_L3_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c5b = cardsQ.find((c) => c.lineTaskId === 'macro_process_flow_inference');
    if (c5b) {
      appendLineToCard(c5b, TASK5_L3_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c5b,
        truncateTask5L3DebugProgressText(questionnaireMdFull),
        'task5_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c5b, TASK5_L3_ALIGNMENT_CHAT_GUIDE_LINE, 'default', {
        startFullyRevealed: true,
      });
    }
    writeTask5L3AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task5L3AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'macro_process_flow_inference',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask51L3AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c51a = cardsQ.find((c) => c.lineTaskId === 'value_proposition_capability_units');
    if (!c51a) return;
    appendLineToCard(c51a, TASK51_L3_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task51L3AlignmentQuestionnaireBusy.value = true;
    const alignAbortT51 = takeDesignDetailLlmAbortController();
    const wQ51 = window as unknown as {
      generateDesignDetailTask51L3AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
      }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ51.generateDesignDetailTask51L3AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtxT51 = {
          caseId: rawId,
          taskId: designLinePillLabel('value_proposition_capability_units'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK51_L3_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtxT51, () =>
          wQ51.generateDesignDetailTask51L3AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtxT51, { signal: alignAbortT51.signal }),
          ),
        );
        if (designDetailSessionGeneration !== epochAtStart) {
          questionnaireMdFull = '（问卷生成已取消：会话已重置）';
        } else {
          questionnaireMdFull = String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
        }
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask51L3AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      questionnaireMdFull = `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task51L3AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'value_proposition_capability_units',
        TASK51_L3_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c51b = cardsQ.find((c) => c.lineTaskId === 'value_proposition_capability_units');
    if (c51b) {
      appendLineToCard(c51b, TASK51_L3_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c51b,
        truncateTask51L3DebugProgressText(questionnaireMdFull),
        'task51_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c51b, TASK51_L3_ALIGNMENT_CHAT_GUIDE_LINE, 'default', {
        startFullyRevealed: true,
      });
    }
    writeTask51L3AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task51L3AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'value_proposition_capability_units',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function appendTask55L3AlignmentQuestionnaireFromConflict(
    caseId: string,
    epochAtStart: number,
    conflictBlock: string,
  ): Promise<void> {
    const rawId = String(caseId || '').trim();
    if (!rawId) return;
    pendingDebugPipelineContinueAction.value = null;
    let cardsQ = cloneDynamics();
    const c55a = cardsQ.find((c) => c.lineTaskId === 'vsm_stage_decomposition');
    if (!c55a) return;
    appendLineToCard(c55a, TASK55_L3_ALIGNMENT_Q_WORKING_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    queuePersistDesignDetailProgressWorkspace();
    task55L3AlignmentQuestionnaireBusy.value = true;
    const alignAbortT55 = takeDesignDetailLlmAbortController();
    const wQ55 = window as unknown as {
      generateDesignDetailTask55L3AlignmentQuestionnaireFromContext?: (
        payload: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
      }>;
    };
    let questionnaireMdFull = '';
    try {
      if (typeof wQ55.generateDesignDetailTask55L3AlignmentQuestionnaireFromContext === 'function') {
        const qAuditCtxT55 = {
          caseId: rawId,
          taskId: designLinePillLabel('vsm_stage_decomposition'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK55_L3_ALIGNMENT_QUESTIONNAIRE,
        };
        const qRes = await withLlmAuditCtx(qAuditCtxT55, () =>
          wQ55.generateDesignDetailTask55L3AlignmentQuestionnaireFromContext!(
            { alignmentQuestionnaireUserBlock: conflictBlock },
            designDetailLlmFetchOpts(qAuditCtxT55, { signal: alignAbortT55.signal }),
          ),
        );
        if (designDetailSessionGeneration !== epochAtStart) {
          questionnaireMdFull = '（问卷生成已取消：会话已重置）';
        } else {
          questionnaireMdFull = String(qRes.rawOutput || qRes.content || '').trim() || '（模型无输出）';
        }
      } else {
        questionnaireMdFull =
          '（问卷生成失败：未加载 generateDesignDetailTask55L3AlignmentQuestionnaireFromContext）';
      }
    } catch (eq) {
      questionnaireMdFull = `（问卷生成失败：${eq instanceof Error ? eq.message : String(eq)}）`;
    } finally {
      task55L3AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'vsm_stage_decomposition',
        TASK55_L3_ALIGNMENT_Q_WORKING_LINE,
      );
    }
    if (designDetailSessionGeneration !== epochAtStart) return;
    cardsQ = cloneDynamics();
    const c55b = cardsQ.find((c) => c.lineTaskId === 'vsm_stage_decomposition');
    if (c55b) {
      appendLineToCard(c55b, TASK55_L3_ALIGNMENT_DOUBT_LINE, 'default', { startFullyRevealed: true });
      appendLineToCard(
        c55b,
        truncateTask55L3DebugProgressText(questionnaireMdFull),
        'task55_alignment_questionnaire_sub',
        { startFullyRevealed: true },
      );
      appendLineToCard(c55b, TASK55_L3_ALIGNMENT_CHAT_GUIDE_LINE, 'default', {
        startFullyRevealed: true,
      });
    }
    writeTask55L3AlignmentQuestionnaireText(rawId, questionnaireMdFull, conflictBlock);
    task55L3AlignmentPending.value = {
      caseId: rawId,
      conflictDatasetUserBlock: conflictBlock,
      questionnaireMarkdown: questionnaireMdFull,
      painPointTargetFeatureIds: readAlignmentPainPointTargetFeatureIds(
        rawId,
        'vsm_stage_decomposition',
      ),
    };
    dynamicsCards.value = cardsQ;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  async function flushDeferredAlignmentQuestionnaireIfAny(caseId: string): Promise<void> {
    const cid = String(caseId || '').trim();
    const job = deferredAlignmentQuestionnaireJob.value;
    if (!job || job.caseId !== cid) return;
    deferredAlignmentQuestionnaireJob.value = null;
    if (job.tier === 'task2') {
      await appendTask2L1AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task3') {
      await appendTask3L2AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task4') {
      await appendTask4L2AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task5') {
      await appendTask5L3AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task51') {
      await appendTask51L3AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task55') {
      await appendTask55L3AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task65') {
      const progressLabel = String(job.task65SubtaskProgressLabel ?? '').trim();
      const stepIndex = Number(job.task65SubtaskStepIndex);
      const perStepRawOutputs = Array.isArray(job.task65SubtaskPerStepRawOutputs)
        ? job.task65SubtaskPerStepRawOutputs
        : [];
        if (progressLabel && Number.isFinite(stepIndex) && stepIndex >= 0) {
        await appendTask65SubtaskAlignmentQuestionnaireFromConflict(
          cid,
          job.epochAtStart,
          progressLabel,
          stepIndex,
          perStepRawOutputs,
          job.task65ConflictRows ?? [],
        );
      }
    } else if (job.tier === 'task7') {
      await appendTask7L4AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task8') {
      await appendTask8L45AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task85') {
      await appendTask85L475AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task9') {
      await appendTask9L5AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else if (job.tier === 'task10') {
      await appendTask10L5AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    } else {
      await appendTask6L3AlignmentQuestionnaireFromConflict(
        cid,
        job.epochAtStart,
        job.conflictDatasetUserBlock,
      );
    }
  }

  function dynamicsHasRequirementSupplementPromptChoice(): boolean {
    return dynamicsCards.value.some((c) =>
      c.lines.some((l) => l.kind === 'requirement_supplement_prompt'),
    );
  }

  function stripTask1RequirementSupplementPromptLines(caseId: string): void {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    let removed = 0;
    let changed = false;
    for (const c of cards) {
      const before = c.lines.length;
      c.lines = c.lines.filter((l) => l.kind !== 'requirement_supplement_prompt');
      const d = before - c.lines.length;
      if (d > 0) {
        removed += d;
        changed = true;
      }
    }
    if (changed) {
      logSupplementYesDiag('strip_supplement_prompt', { cid, removedRows: removed });
      dynamicsCards.value = cards;
      ensureRevealTicker(cid);
    }
  }

  /** 管理资源等分域逻辑提炼全部成功后推送（离线无同步 API 时亦推送） */
  function appendTask1RequirementSupplementPrompt(caseId: string): void {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    if (dynamicsHasRequirementSupplementPromptChoice()) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    appendLineToCard(c1, TASK1_REQUIREMENT_SUPPLEMENT_QUESTION_LINE, 'requirement_supplement_prompt', {
      startFullyRevealed: true,
    });
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
    queuePersistDesignDetailProgressWorkspace();
  }

  /** 阶段已为 `awaiting` 时：去掉「是/否」行并保证两条绿色引导（与 `onRequirementSupplementChoiceYes` 一致）；供快照恢复后纠偏动态卡。 */
  function ensureCustomerRequirementAwaitingProgressUi(caseId: string, from?: string): void {
    const cid = String(caseId || '').trim();
    if (!cid) {
      logSupplementYesDiag('ensure_progress_ui_skip', { from, reason: 'no_cid' });
      return;
    }
    const ph = task1CustomerRequirementPhase.value;
    if (ph !== 'awaiting') {
      logSupplementYesDiag('ensure_progress_ui_skip', {
        from,
        cid,
        phase: ph,
        snapshot: diagDynamicsSupplementSnapshot(),
      });
      return;
    }
    const beforeSnap = diagDynamicsSupplementSnapshot();
    stripTask1RequirementSupplementPromptLines(cid);
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) {
      logSupplementYesDiag('ensure_progress_ui_skip', { from, cid, reason: 'no_customer_basic_card' });
      return;
    }
    /**
     * 多轮「继续补充 → 是」：上一轮留在卡上的两条绿字与本轮文案相同，`some()` 会误判已展示；
     * 旧行在列表上方，用户只看底部会以为没提示。仅在用户点「是」触发的两次 ensure 上：先剥旧再追加到底部。
     */
    const forceFreshSupplementGuides =
      from === 'choice_yes_after_save' || from === 'choice_yes_post_hydrate';
    if (forceFreshSupplementGuides) {
      const beforeRm = c1.lines.length;
      c1.lines = c1.lines.filter(
        (l) =>
          !(
            l.kind === 'scope_green' &&
            (l.full === TASK1_REQUIREMENT_SUPPLEMENT_YES_GUIDE_LINE ||
              l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE ||
              l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE_LEGACY)
          ),
      );
      const removedGuideRows = beforeRm - c1.lines.length;
      appendLineToCard(c1, TASK1_REQUIREMENT_SUPPLEMENT_YES_GUIDE_LINE, 'scope_green', {
        startFullyRevealed: true,
      });
      appendLineToCard(c1, TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE, 'scope_green', {
        startFullyRevealed: true,
      });
      dynamicsCards.value = cards;
      ensureRevealTicker(cid);
      logSupplementYesDiag('ensure_progress_ui_done', {
        from,
        cid,
        before: beforeSnap,
        after: diagDynamicsSupplementSnapshot(),
        forceFreshSupplementGuides: true,
        removedGuideRows,
        appendedYesGuide: true,
        appendedReqPrompt: true,
        dynamicsRowsChanged: true,
      });
      reconcileDesignLineStepForTask1InputUi(cid);
      return;
    }

    let changed = false;
    let appendedYesGuide = false;
    let appendedReqPrompt = false;
    if (!c1.lines.some((l) => l.full === TASK1_REQUIREMENT_SUPPLEMENT_YES_GUIDE_LINE && l.kind === 'scope_green')) {
      appendLineToCard(c1, TASK1_REQUIREMENT_SUPPLEMENT_YES_GUIDE_LINE, 'scope_green', {
        startFullyRevealed: true,
      });
      changed = true;
      appendedYesGuide = true;
    }
    if (!c1.lines.some((l) => l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE && l.kind === 'scope_green')) {
      appendLineToCard(c1, TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE, 'scope_green', {
        startFullyRevealed: true,
      });
      changed = true;
      appendedReqPrompt = true;
    }
    if (changed) {
      dynamicsCards.value = cards;
      ensureRevealTicker(cid);
    }
    logSupplementYesDiag('ensure_progress_ui_done', {
      from,
      cid,
      before: beforeSnap,
      after: diagDynamicsSupplementSnapshot(),
      appendedYesGuide,
      appendedReqPrompt,
      dynamicsRowsChanged: changed,
    });
    reconcileDesignLineStepForTask1InputUi(cid);
  }

  async function onRequirementSupplementChoiceYes(): Promise<void> {
    const rawId = String(caseIdRef.value || '').trim();
    if (!rawId) {
      logSupplementYesDiag('choice_yes_abort', { reason: 'no_case_id' });
      return;
    }
    logSupplementYesDiag('choice_yes_start', {
      rawId,
      phaseRefBefore: task1CustomerRequirementPhase.value,
      localStoragePhaseBefore: loadDesignDetailCustomerRequirementPhase(rawId),
      dynamics: diagDynamicsSupplementSnapshot(),
      supplementPending: dynamicsHasRequirementSupplementPromptChoice(),
    });
    try {
      saveDesignDetailCustomerRequirementPhase(rawId, 'awaiting');
      task1CustomerRequirementPhase.value = 'awaiting';
      logSupplementYesDiag('choice_yes_after_local_save', {
        rawId,
        localStoragePhase: loadDesignDetailCustomerRequirementPhase(rawId),
        phaseRef: task1CustomerRequirementPhase.value,
      });
      ensureCustomerRequirementAwaitingProgressUi(rawId, 'choice_yes_after_save');
      designChatInputPlaceholder.value = TASK1_CUSTOMER_REQUIREMENT_INPUT_PLACEHOLDER;
      queuePersistDesignDetailProgressWorkspace();
      await runHydrationCycle();
      logSupplementYesDiag('choice_yes_after_hydrate', {
        rawId,
        phaseRef: task1CustomerRequirementPhase.value,
        localStoragePhase: loadDesignDetailCustomerRequirementPhase(rawId),
        dynamics: diagDynamicsSupplementSnapshot(),
        supplementPending: dynamicsHasRequirementSupplementPromptChoice(),
      });
      if (task1CustomerRequirementPhase.value === 'awaiting') {
        ensureCustomerRequirementAwaitingProgressUi(rawId, 'choice_yes_post_hydrate');
      } else {
        logSupplementYesDiag('choice_yes_skip_second_ensure', {
          rawId,
          phaseRef: task1CustomerRequirementPhase.value,
        });
      }
    } catch (e) {
      logSupplementYesDiag('choice_yes_error', {
        rawId,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * 「是否继续补充需求 → 否」：任务 1 动态卡收官（淡绿）、持久化进入任务 2、新建第二张淡黄进度卡并调用 L1 实体画像 LLM。
   */
  async function onRequirementSupplementChoiceNo(): Promise<void> {
    const rawId = String(caseIdRef.value || '').trim();
    if (!rawId) return;
    if (requirementMergeBusy.value) return;
    if (task2EntityPortraitBusy.value) return;

    const epochAtStart = designDetailSessionGeneration;
    const task2LlmAbort = takeDesignDetailLlmAbortController();

    stripTask1RequirementSupplementPromptLines(rawId);

    saveDesignDetailCustomerRequirementPhase(rawId, 'completed');
    task1CustomerRequirementPhase.value = 'completed';

    ensureTask1DynamicsCard();
    let cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;

    const msgsForDuration = lastHydratedMessages.value;
    const wallSecT1 = Math.max(0, Math.round((Date.now() - c1.startedAtMs) / 1000));
    c1.displayDurationSec = deriveTask1ProgressDisplaySec(msgsForDuration, wallSecT1);

    c1.status = 'completed';
    c1.completedAtMs = Date.now();
    c1.completionQueued = true;

    saveDesignDetailLineState(rawId, { schemaVersion: 1, currentTaskId: 'scale_org_mode_extract' });
    currentDesignLineTaskId.value = 'scale_org_mode_extract';

    const mergedItem = lastResolvedItem.value ?? lastHydratedItem.value;

    const kickTask2Pipeline = async () => {
      await awaitUsageModePriorLineTaskDisplayComplete('scale_org_mode_extract');
      let cards2 = cloneDynamics();
      let c2 = cards2.find((c) => c.lineTaskId === 'scale_org_mode_extract');
      if (!c2) {
        c2 = {
          key: `scale_org_mode_extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'scale_org_mode_extract',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cards2 = [...cards2, c2];
      }
      appendLineToCard(c2, TASK2_FETCH_GRAPH_INPUT_LINE, 'default', { startFullyRevealed: true });
      dynamicsCards.value = cards2;
      ensureRevealTicker(rawId);
      if (designDetailProgressPersistTimer) {
        clearTimeout(designDetailProgressPersistTimer);
        designDetailProgressPersistTimer = null;
      }
      await flushPersistDesignDetailProgressWorkspace(rawId);
      queuePersistDesignDetailProgressWorkspace();
      await runTask2L1EntityPortraitPipeline(rawId, epochAtStart, task2LlmAbort, mergedItem);
    };

    dynamicsCards.value = cards;
    ensureRevealTicker(rawId);
    designChatInputPlaceholder.value = '描述设计意图或约束…';
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();

    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) {
      appendDebugContinueAtLineTaskEnd(rawId, 'customer_basic', kickTask2Pipeline);
    } else {
      let c2 = cards.find((c) => c.lineTaskId === 'scale_org_mode_extract');
      if (!c2) {
        c2 = {
          key: `scale_org_mode_extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineTaskId: 'scale_org_mode_extract',
          status: 'running',
          startedAtMs: Date.now(),
          completedAtMs: null,
          lines: [],
          extraTailConsumed: 0,
          completionQueued: false,
          thanksAppended: false,
        };
        cards = [...cards, c2];
      }
      appendLineToCard(c2, TASK2_FETCH_GRAPH_INPUT_LINE, 'default', { startFullyRevealed: true });

      dynamicsCards.value = cards;
      ensureRevealTicker(rawId);
      designChatInputPlaceholder.value = '描述设计意图或约束…';
      if (designDetailProgressPersistTimer) {
        clearTimeout(designDetailProgressPersistTimer);
        designDetailProgressPersistTimer = null;
      }
      await flushPersistDesignDetailProgressWorkspace(rawId);
      queuePersistDesignDetailProgressWorkspace();

      await runTask2L1EntityPortraitPipeline(rawId, epochAtStart, task2LlmAbort, mergedItem);
    }
  }

  /** 从 GET task-graph 拆任务 1 / 任务 2 特征行，供任务 3 L2 user 组装 */
  function pickTask1Task2FeaturesFromGraphTasks(
    tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  ): { task1Features: Task2L1TaskGraphFeatureRow[]; task2Features: Task2L1TaskGraphFeatureRow[] } {
    const t1 = tasks.find((x) => String(x?.taskId || '').trim() === 'customer_basic');
    const t2 = tasks.find((x) => {
      const id = String(x?.taskId || '').trim();
      return (
        id === DESIGN_DETAIL_TASK2_LINE_TASK_ID ||
        id === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID ||
        id === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY
      );
    });
    return {
      task1Features: Array.isArray(t1?.features) ? t1!.features! : [],
      task2Features: Array.isArray(t2?.features) ? t2!.features! : [],
    };
  }

  /** 从 GET task-graph 拆任务 3 的 token / 特征行（聚合卡 `taskId` 为线步 id；历史数据可能仅为落库中文名） */
  function pickTask3TokensFeaturesFromGraphTasks(
    tasks: Array<{ taskId?: string; tokens?: unknown[]; features?: unknown[] }>,
  ): { tokens: Array<Record<string, unknown>>; features: Array<Record<string, unknown>> } {
    const t3 = tasks.find((x) => {
      const id = String(x?.taskId || '').trim();
      return id === DESIGN_DETAIL_TASK3_LINE_TASK_ID || id === DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID;
    });
    const tokens = Array.isArray(t3?.tokens) ? (t3!.tokens as Array<Record<string, unknown>>) : [];
    const features = Array.isArray(t3?.features) ? (t3!.features as Array<Record<string, unknown>>) : [];
    return { tokens, features };
  }

  /** Target_KV 落库后：将本线步 task-graph Feature 整理为说人话推理结论（使用/调试均展示） */
  async function pushFeatureInferenceConclusionsAfterSync(
    rawId: string,
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
    mergedForProgress: DesignDetailLogicGraphTaskDto[],
    llmAbort?: AbortSignal,
    /** 传入当前流水线已持有的动态卡引用，避免随后 `dynamicsCards.value = cardsSync` 覆盖结论行 */
    targetCard?: DynamicsCardModel,
    /**
     * 与 `targetCard` 同属的 `cloneDynamics()` 数组；推送过程中须同步写回 `dynamicsCards`，
     * 否则 UI/持久化仍停留在落库前快照（调试模式停门闩时尤易误判为「未推结论」）。
     */
    pipelineCards?: DynamicsCardModel[],
  ): Promise<void> {
    if (!mergedForProgress.length) return;
    const cards = targetCard ? null : cloneDynamics();
    const card = targetCard ?? cards?.find((c) => c.lineTaskId === lineTaskId);
    if (!card) return;
    const commitDynamicsToUi = () => {
      if (pipelineCards) {
        dynamicsCards.value = pipelineCards;
      } else if (cards) {
        dynamicsCards.value = cards;
      }
    };
    if (!shouldProceedWithFeatureInferenceConclusionPush(card.lines, mergedForProgress, lineTaskId)) {
      return;
    }
    if (!hasFeatureInferenceConclusionOrganizeLine(card.lines)) {
      appendLineToCard(card, INFERENCE_CONCLUSION_ORGANIZE_LINE, 'scope_green', {
        startFullyRevealed: true,
      });
      commitDynamicsToUi();
    }
    await appendFeatureInferenceConclusionsForLineTask({
      caseId: rawId,
      lineTaskId,
      auditTaskIdLabel: designLinePillLabel(lineTaskId),
      mergedTasks: mergedForProgress,
      existingLines: card.lines,
      appendLine: async (text, mode, featureId) => {
        const instant = mode === 'instant';
        appendLineToCard(card, text, 'inference_conclusion_sub', {
          startFullyRevealed: instant,
          inferenceFeatureId: featureId,
        });
        commitDynamicsToUi();
        ensureRevealTicker(rawId);
      },
      waitRevealComplete: () => waitUntilDynamicsFullyRevealed(),
      withLlmAudit: (callTarget, fn) =>
        withLlmAuditCtx({ caseId: rawId, taskId: designLinePillLabel(lineTaskId), callTarget }, fn),
      signal: llmAbort,
    });
    commitDynamicsToUi();
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);
  }

  /** 进度子区：`任务 3-{featureId}-{tokenstr}-{operator}-{value}` */
  function formatTask3FeatureKvDebugLine(f: Record<string, unknown>): string {
    const fid = String(f.featureId ?? (f as { feature_id?: unknown }).feature_id ?? '').trim();
    const td = String(f.tokenDisplay ?? (f as { token_display?: unknown }).token_display ?? '').trim();
    const tokenOne = td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
    const op = String(f.operator ?? '').trim() || '—';
    const val = String(f.name ?? '').trim() || '—';
    return `任务 3-${fid}-${tokenOne || '—'}-${op}-${val}`;
  }

  /** 从 GET task-graph 拆任务 3 特征行（供任务 4 user 组装） */
  function pickTask3FeaturesFromGraphTasks(
    tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  ): Task2L1TaskGraphFeatureRow[] {
    const t3 = tasks.find((x) => {
      const id = String(x?.taskId || '').trim();
      return id === DESIGN_DETAIL_TASK3_LINE_TASK_ID || id === DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID;
    });
    return Array.isArray(t3?.features) ? t3!.features! : [];
  }

  /** 从 GET task-graph 拆任务 4 的 token / 特征行 */
  function pickTask4FeaturesFromGraphTasks(
    tasks: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
  ): Task2L1TaskGraphFeatureRow[] {
    const t4 = tasks.find((x) => {
      const id = String(x?.taskId || '').trim();
      return (
        id === DESIGN_DETAIL_TASK4_LINE_TASK_ID ||
        id === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID ||
        id === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY
      );
    });
    return Array.isArray(t4?.features) ? t4!.features! : [];
  }

  function pickTask4TokensFeaturesFromGraphTasks(
    tasks: Array<{ taskId?: string; tokens?: unknown[]; features?: unknown[] }>,
  ): { tokens: Array<Record<string, unknown>>; features: Array<Record<string, unknown>> } {
    const t4 = tasks.find((x) => {
      const id = String(x?.taskId || '').trim();
      return (
        id === DESIGN_DETAIL_TASK4_LINE_TASK_ID ||
        id === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID ||
        id === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY
      );
    });
    const tokens = Array.isArray(t4?.tokens) ? (t4!.tokens as Array<Record<string, unknown>>) : [];
    const features = Array.isArray(t4?.features) ? (t4!.features as Array<Record<string, unknown>>) : [];
    return { tokens, features };
  }

  /** 进度子区：`任务 4-{featureId}-…` */
  function formatTask4FeatureKvDebugLine(f: Record<string, unknown>): string {
    const fid = String(f.featureId ?? (f as { feature_id?: unknown }).feature_id ?? '').trim();
    const td = String(f.tokenDisplay ?? (f as { token_display?: unknown }).token_display ?? '').trim();
    const tokenOne = td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
    const op = String(f.operator ?? '').trim() || '—';
    const val = String(f.name ?? '').trim() || '—';
    return `任务 4-${fid}-${tokenOne || '—'}-${op}-${val}`;
  }

  function pickTask5TokensFeaturesFromGraphTasks(
    tasks: Array<{ taskId?: string; tokens?: unknown[]; features?: unknown[] }>,
  ): { tokens: Array<Record<string, unknown>>; features: Array<Record<string, unknown>> } {
    const t5 = tasks.find((x) => {
      const id = String(x?.taskId || '').trim();
      return (
        id === 'macro_process_flow_inference' ||
        id === '任务 5：宏观业务流程推断' ||
        id === '任务 5：L3：宏观流程特征推理'
      );
    });
    const tokens = Array.isArray(t5?.tokens) ? (t5!.tokens as Array<Record<string, unknown>>) : [];
    const features = Array.isArray(t5?.features) ? (t5!.features as Array<Record<string, unknown>>) : [];
    return { tokens, features };
  }

  function pickTask55TokensFeaturesFromGraphTasks(
    tasks: Array<{ taskId?: string; tokens?: unknown[]; features?: unknown[] }>,
  ): { tokens: Array<Record<string, unknown>>; features: Array<Record<string, unknown>> } {
    const t55 = tasks.find((x) => {
      const id = String(x?.taskId || '').trim();
      return id === 'vsm_stage_decomposition' || id.includes('任务 5.5') || id.includes('VSM 阶段');
    });
    const tokens = Array.isArray(t55?.tokens) ? (t55!.tokens as Array<Record<string, unknown>>) : [];
    const features = Array.isArray(t55?.features) ? (t55!.features as Array<Record<string, unknown>>) : [];
    return { tokens, features };
  }

  function formatTask5FeatureKvDebugLine(f: Record<string, unknown>): string {
    const fid = String(f.featureId ?? '').trim();
    const td = String(f.tokenDisplay ?? '').trim();
    const tokenOne = td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
    const op = String(f.operator ?? '').trim() || '—';
    const val = String(f.name ?? '').trim() || '—';
    return `任务 5-${fid}-${tokenOne || '—'}-${op}-${val}`;
  }

  /**
   * 任务 3 L2：… Target_KV 落库成功后 **任务 3 卡淡绿收官**、线步切任务 4（**价值链分析推理**）、**先**新建淡黄任务 4 卡再标任务 3 已完成；**失败或未落库**时线步仍留在任务 3。
   * 须在任务 2 L1 落库成功且任务 2 卡已标为 completed 之后调用。
   */
  async function runTask3L2IndustryBusinessPipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    await awaitUsageModePriorLineTaskDisplayComplete('industry_business_profile_extract');

    const w = window as unknown as {
      inferDesignDetailL2IndustryBusinessFromContext?: (
        p: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
        usage?: Record<string, unknown>;
        model?: string;
        durationMs?: number;
      }>;
    };
    if (typeof w.inferDesignDetailL2IndustryBusinessFromContext !== 'function') {
      const cardsBad = cloneDynamics();
      const c3b = cardsBad.find((c) => c.lineTaskId === 'industry_business_profile_extract');
      if (c3b) {
        appendLineToCard(
          c3b,
          '→ 任务 3 推理失败：未加载 task1BusinessInsight（inferDesignDetailL2IndustryBusinessFromContext）',
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cardsBad;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }

    let cards = cloneDynamics();
    let c3 = cards.find((c) => c.lineTaskId === 'industry_business_profile_extract');
    if (!c3) {
      c3 = {
        key: `industry_business_profile_extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'industry_business_profile_extract',
        status: 'running',
        startedAtMs: Date.now(),
        completedAtMs: null,
        lines: [],
        extraTailConsumed: 0,
        completionQueued: false,
        thanksAppended: false,
      };
      cards = [...cards, c3];
    }
    appendLineToCard(c3, TASK3_INDUSTRY_BUSINESS_START_LINE, 'scope_green', { startFullyRevealed: true });
    appendLineToCard(c3, TASK3_DEBUG_L1_FEATURE_LIST_LINE, 'default', { startFullyRevealed: true });
    appendLineToCard(c3, TASK3_DEBUG_L2_FEATURE_LIST_LINE, 'default', { startFullyRevealed: true });
    dynamicsCards.value = cards;
    ensureRevealTicker(rawId);
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();

    const getGraph = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (
              id: string,
            ) => Promise<{
              ok?: boolean;
              data?: { tasks?: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }> };
              errorMessage?: string;
            }>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;

    let l2Raw = '';
    let l2RawForSync = '';
    let task3ImmunityProgressLines: string[] = [];
    let task3PreparedTvmRows: Task2L1TvmParsedRow[] | null = null;
    let mergedGraphForTask3: DesignDetailLogicGraphTaskDto[] | null = null;

    async function runTask3L2AppendPostSyncGraphNarrative(): Promise<void> {
      try {
        console.warn('[design-detail:task3-l2-sync]', {
          caseId: rawId,
          ok: true,
          l2RawLen: l2Raw.length,
          l2RawHasTokenValidationKey: /Token_Validation_Mapping/i.test(l2Raw),
        });
      } catch {
        /* ignore */
      }
      if (typeof getGraph !== 'function') {
        withTask3L2DynamicsCard((card) => {
          appendLineToCard(card, '→ 未挂载 getDesignDetailTaskGraph，跳过 token/feature 调试行', 'default', {
            startFullyRevealed: true,
          });
        }, rawId);
        return;
      }
      try {
        const gr2 = await getGraph(rawId);
        if (designDetailSessionGeneration !== epochAtStart) return;
        if (gr2 && gr2.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
          const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
            gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
          );
          mergedGraphForTask3 = mergedForProgress;
          await pushFeatureInferenceConclusionsAfterSync(
            rawId,
            'industry_business_profile_extract',
            mergedForProgress,
            llmAbort.signal,
          );
          withTask3L2DynamicsCard((card) => {
            appendLineToCard(card, '→ 任务 3：开始提炼正向归纳链接', 'scope_green', {
              startFullyRevealed: true,
            });
            for (const ln of buildForwardInductionLinkUiLinesTask3(mergedForProgress)) {
              appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
            }
            appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
            appendLineToCard(card, '→ Token_Validation_Mapping（L2）：', 'scope_green', {
              startFullyRevealed: true,
            });
            appendLineToCard(
              card,
              extractTask3L2TokenValidationMappingProgressSnippet(l2RawForSync || l2Raw),
              'token_validation_mapping_quote',
              { startFullyRevealed: true },
            );
            appendLineToCard(card, '→ 开始提炼反向验证链接', 'scope_green', { startFullyRevealed: true });
            for (const ln2 of buildReverseValidationLinkUiLines(mergedForProgress)) {
              appendLineToCard(card, ln2, 'bmc_result_quote', { startFullyRevealed: true });
            }
            appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
            const tf = pickTask3TokensFeaturesFromGraphTasks(gr2.data.tasks);
            appendLineToCard(card, TASK3_DEBUG_TOKEN_KV_LINE, 'default', { startFullyRevealed: true });
            const tokenLines = tf.tokens
              .map((row) => String(row.tokenId ?? (row as { token_id?: unknown }).token_id ?? '').trim())
              .filter(Boolean)
              .map((tid) => `任务 3-token-${tid}`);
            appendLineToCard(
              card,
              tokenLines.length ? tokenLines.join('\n') : '（无 token）',
              'task3_inference_sub',
              { startFullyRevealed: true },
            );
            appendLineToCard(card, TASK3_DEBUG_FEATURE_KV_LINE, 'default', { startFullyRevealed: true });
            const featLines = tf.features.map((f) => formatTask3FeatureKvDebugLine(f));
            appendLineToCard(
              card,
              featLines.length ? featLines.join('\n') : '（无 feature）',
              'task3_inference_sub',
              { startFullyRevealed: true },
            );
          }, rawId);
          logicTreeGraphRefreshTick.value += 2;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
        } else {
          withTask3L2DynamicsCard((card) => {
            appendLineToCard(
              card,
              '→ 推理图响应无 tasks 或结构异常，跳过 token/feature 调试行',
              'default',
              { startFullyRevealed: true },
            );
          }, rawId);
        }
      } catch {
        withTask3L2DynamicsCard((card) => {
          appendLineToCard(card, '→ 拉取推理图失败，跳过 token/feature 调试行', 'default', {
            startFullyRevealed: true,
          });
        }, rawId);
      }
    }

    async function runTask3L2TvmGateAndMaybeAlignmentQuestionnaire(
      pipelineOpts?: DesignDetailPipelineRunOpts,
    ): Promise<boolean> {
      const raw = String(l2RawForSync || l2Raw || '').trim();
      if (!raw) {
        withTask3L2DynamicsCard((card) => {
          appendLineToCard(card, '→ 反向验证校验跳过：无 L2 模型输出', 'default', { startFullyRevealed: true });
        }, rawId);
        return false;
      }
      try {
        let immunityProgressLines = [...task3ImmunityProgressLines];
        let tvmRowsForAlign: Task2L1TvmParsedRow[];
        if (task3PreparedTvmRows?.length) {
          tvmRowsForAlign = task3PreparedTvmRows;
        } else {
          tvmRowsForAlign = parseTask3L2TokenValidationMappingForAlignment(raw);
          let graphForImmunity = mergedGraphForTask3;
          if (!graphForImmunity?.length && typeof getGraph === 'function') {
            const freshGraphForImmunity = await fetchNormalizedLogicGraphTasksForImmunity(rawId, getGraph);
            if (freshGraphForImmunity?.length) {
              graphForImmunity = freshGraphForImmunity;
              mergedGraphForTask3 = freshGraphForImmunity;
            }
          }
          if (graphForImmunity?.length) {
            const gateImm = applyTvmImmunityToRowsForGate(tvmRowsForAlign, graphForImmunity, 'task3');
            tvmRowsForAlign = gateImm.rows;
            immunityProgressLines = [...immunityProgressLines, ...gateImm.progressLines];
          }
        }
        const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
        const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
        const conflictCount = conflictRows.length;
        try {
          console.warn('[design-detail:task3-l2-gate]', {
            caseId: rawId,
            tvmRows: tvmRowsForAlign.length,
            potentialConflictCount: conflictCount,
            allowTask4Kickoff: !hasUnresolvedTvmConflict,
            debugPauseBeforeTask4: designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_4),
          });
        } catch {
          /* ignore */
        }
        withTask3L2DynamicsCard((card) => {
          appendLineToCard(
            card,
            `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
              hasUnresolvedTvmConflict
                ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 4`
                : 'Consistency 均已消解或已确认为痛点（历史痛点免疫），可进入任务 4'
            }`,
            'scope_green',
            { startFullyRevealed: true },
          );
          for (const ln of dedupeTvmImmunityProgressLines(immunityProgressLines)) {
            appendLineToCard(card, ln, 'scope_green', { startFullyRevealed: true });
          }
        }, rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
        if (!hasUnresolvedTvmConflict) return true;

        pendingDebugPipelineContinueAction.value = null;
        if (!conflictCount) {
          withTask3L2DynamicsCard((card) => {
            appendLineToCard(
              card,
              '→ 门禁判定存在未消解校验，但冲突清单为空；请查看控制台 [design-detail:task3-l2-gate]',
              'default',
              { startFullyRevealed: true },
            );
          }, rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          return false;
        }
        const conflictBlock = buildTask3L2ConflictDatasetUserBlock(conflictRows);
        stashAlignmentPainTargetsForLineTask(rawId, 'industry_business_profile_extract', conflictRows);
        try {
          console.warn('[design-detail:task3-l2-alignment]', {
            caseId: rawId,
            conflictRows: conflictRows.length,
            tvmParsedTotal: tvmRowsForAlign.length,
          });
        } catch {
          /* ignore */
        }
        if (pipelineOpts?.deferAlignmentQuestionnaire) {
          deferredAlignmentQuestionnaireJob.value = {
            caseId: rawId,
            lineTaskId: 'industry_business_profile_extract',
            epochAtStart,
            conflictDatasetUserBlock: conflictBlock,
            tier: 'task3',
          };
          await flushPersistDesignDetailProgressWorkspace(rawId);
          return false;
        }
        await appendTask3L2AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
        return false;
      } catch (gateErr) {
        const msg = gateErr instanceof Error ? gateErr.message : String(gateErr);
        try {
          console.warn('[design-detail:task3-l2-gate]', { caseId: rawId, phase: 'error', message: msg });
        } catch {
          /* ignore */
        }
        withTask3L2DynamicsCard((card) => {
          appendLineToCard(card, `→ 反向验证校验失败：${msg}`, 'default', { startFullyRevealed: true });
        }, rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
        return false;
      }
    }

    let task1Features: Task2L1TaskGraphFeatureRow[] = [];
    let task2Features: Task2L1TaskGraphFeatureRow[] = [];
    if (typeof getGraph === 'function') {
      try {
        const gr = await getGraph(rawId);
        if (gr && gr.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
          mergedGraphForTask3 = normalizeLogicGraphTasksFromApiPayload(
            gr.data.tasks as DesignDetailLogicGraphTaskDto[],
          );
          const picked = pickTask1Task2FeaturesFromGraphTasks(gr.data.tasks);
          task1Features = picked.task1Features;
          task2Features = picked.task2Features;
        }
      } catch {
        /* 空图仍送模，由模型在缺证据时自述 */
      }
    }

    const upstreamForTask3 = mergedGraphForTask3?.length
      ? buildTask1PainPointConfirmedConsistencyMap(mergedGraphForTask3)
      : undefined;

    const task3InferenceUserBlock = buildTask3L2InferenceUserBlock(
      task1Features,
      task2Features,
      readTask3L2DeepInsightText(rawId),
      readTask3L2UserRectificationText(rawId),
      upstreamForTask3,
    );

    const task3UserChars = task3InferenceUserBlock.length;
    let cardsSpin = cloneDynamics();
    const c3spin = cardsSpin.find((c) => c.lineTaskId === 'industry_business_profile_extract');
    if (c3spin) {
      appendLineToCard(
        c3spin,
        `→ 送模上下文约 ${task3UserChars.toLocaleString('zh-CN')} 字（任务1 ${task1Features.length} 条 + 任务2 ${task2Features.length} 条特征；超时约 5 分钟）`,
        'default',
        { startFullyRevealed: true },
      );
      appendLineToCard(c3spin, TASK3_L2_INDUSTRY_LLM_WORKING_LINE, 'bmc_generating', {
        bmcGenUi: 'spinner',
        spinnerBlue: true,
        startFullyRevealed: true,
      });
    }
    dynamicsCards.value = cardsSpin;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    try {
      const task3AuditId = designLinePillLabel('industry_business_profile_extract');
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: task3AuditId,
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L2_INDUSTRY_BUSINESS,
        },
        () =>
          w.inferDesignDetailL2IndustryBusinessFromContext!(
            { task3InferenceUserBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (exitTask3PipelineIfSessionStale(rawId, epochAtStart)) return;
      let cardsOut = cloneDynamics();
      const c3o = cardsOut.find((c) => c.lineTaskId === 'industry_business_profile_extract');
      if (c3o) {
        removeTask3L2LlmWorkingSpinnerFromCard(c3o);
        l2Raw = String(res.rawOutput || res.content || '').trim();
        l2RawForSync = l2Raw;
        if (l2Raw && typeof getGraph === 'function') {
          let graphPre = mergedGraphForTask3;
          if (!graphPre?.length) {
            const freshPre = await fetchNormalizedLogicGraphTasksForImmunity(rawId, getGraph);
            if (freshPre?.length) {
              graphPre = freshPre;
              mergedGraphForTask3 = freshPre;
            }
          }
          if (graphPre?.length) {
            const pipe = runTvmImmunityPipelineForTask3Or4(
              l2Raw,
              graphPre,
              'task3',
              parseTask3L2TokenValidationMappingForAlignment,
            );
            l2RawForSync = pipe.mergedRaw;
            task3PreparedTvmRows = pipe.rows;
            task3ImmunityProgressLines = pipe.progressLines;
          }
        }
        appendLineToCard(c3o, TASK3_DEBUG_INFERENCE_DONE_LINE, 'default', { startFullyRevealed: true });
        const subBody = truncateTask3L2DebugProgressText(l2Raw || '（模型无输出）');
        appendLineToCard(c3o, subBody, 'task3_inference_sub', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsOut;
      ensureRevealTicker(rawId);

      let cardsAfterKv = cloneDynamics();
      const c3kv = cardsAfterKv.find((c) => c.lineTaskId === 'industry_business_profile_extract');
      if (c3kv) {
        appendLineToCard(c3kv, TASK3_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsAfterKv;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      let allowTask4Kickoff = false;
      if (c3kv && isOnlineMode()) {
        const postT3 = (
          window as unknown as {
            SmartCto?: {
              problemCaseApi?: {
                postDesignDetailSyncTask3L2TargetKvTokens?: (
                  id: string,
                  body: Record<string, unknown>,
                ) => Promise<{
                  ok?: boolean;
                  message?: string;
                } | null>;
              };
            };
          }
        ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask3L2TargetKvTokens;
        if (typeof postT3 === 'function' && l2Raw) {
          try {
            const normT3 = normalizeL2BusinessInferenceRawForServerSync(l2RawForSync || l2Raw);
            if (!normT3.ok) {
              removeTask3L2SyncSpinnerLine(rawId);
              withTask3L2DynamicsCard((card) => {
                appendLineToCard(
                  card,
                  `→ Target_KV 落库失败：${normT3.message}`,
                  'default',
                  { startFullyRevealed: true },
                );
              }, rawId);
              sealTask3L2DynamicsCardTerminal(rawId);
            } else {
              withTask3L2DynamicsCard((card) => {
                appendLineToCard(card, TASK3_SYNC_TARGET_KV_LINE, 'bmc_generating', {
                  bmcGenUi: 'spinner',
                  spinnerBlue: true,
                  startFullyRevealed: true,
                });
              }, rawId);
              await flushPersistDesignDetailProgressWorkspace(rawId);
              let syncRes: { ok?: boolean; message?: string } | null = null;
              try {
                syncRes = await postT3(
                  rawId,
                  mergeTargetKvSyncBodyWithAlignmentMeta(
                    { l2InferenceRaw: normT3.normalized },
                    buildTask3L2TargetKvSyncAlignmentMeta(rawId),
                  ),
                );
              } finally {
                removeTask3L2SyncSpinnerLine(rawId);
              }
              if (exitTask3PipelineIfSessionStale(rawId, epochAtStart)) return;
              if (!syncRes || syncRes.ok !== true) {
                const hint =
                  syncRes && typeof (syncRes as { message?: string }).message === 'string'
                    ? (syncRes as { message: string }).message
                    : '同步失败';
                withTask3L2DynamicsCard((card) => {
                  appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', {
                    startFullyRevealed: true,
                  });
                }, rawId);
                sealTask3L2DynamicsCardTerminal(rawId);
              } else {
                withTask3L2DynamicsCard((card) => {
                  appendLineToCard(card, TASK3_SYNC_TARGET_KV_OK_LINE, 'scope_green', {
                    startFullyRevealed: true,
                  });
                }, rawId);
                await flushPersistDesignDetailProgressWorkspace(rawId);
                await runTask3L2AppendPostSyncGraphNarrative();
                if (exitTask3PipelineIfSessionStale(rawId, epochAtStart)) return;
                allowTask4Kickoff = await runTask3L2TvmGateAndMaybeAlignmentQuestionnaire(opts);
                if (exitTask3PipelineIfSessionStale(rawId, epochAtStart)) return;
              }
            }
          } catch (eKv) {
            if (exitTask3PipelineIfSessionStale(rawId, epochAtStart)) return;
            removeTask3L2SyncSpinnerLine(rawId);
            withTask3L2DynamicsCard((card) => {
              appendLineToCard(
                card,
                `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
                'default',
                { startFullyRevealed: true },
              );
            }, rawId);
            sealTask3L2DynamicsCardTerminal(rawId);
          }
        } else if (!l2Raw) {
          withTask3L2DynamicsCard((card) => {
            appendLineToCard(card, '→ Target_KV 落库跳过：模型无可用 JSON 输出', 'default', {
              startFullyRevealed: true,
            });
          }, rawId);
          sealTask3L2DynamicsCardTerminal(rawId);
        } else {
          withTask3L2DynamicsCard((card) => {
            appendLineToCard(card, '→ 未加载 postDesignDetailSyncTask3L2TargetKvTokens，跳过服务端写入', 'default', {
              startFullyRevealed: true,
            });
          }, rawId);
          sealTask3L2DynamicsCardTerminal(rawId);
        }
      } else if (c3kv) {
        appendLineToCard(c3kv, '→ 离线模式：未将 Target_KV 写入服务端', 'default', { startFullyRevealed: true });
        if (l2Raw) {
          allowTask4Kickoff = await runTask3L2TvmGateAndMaybeAlignmentQuestionnaire(opts);
          if (exitTask3PipelineIfSessionStale(rawId, epochAtStart)) return;
        }
      }
      /** 勿写回陈旧 `cardsAfterKv`：对齐问卷路径已在 `runTask3L2TvmGate…` 内 `cloneDynamics()` 更新；写回会吞问卷并残留「正在生成…」转圈 */
      if (allowTask4Kickoff) {
        dynamicsCards.value = cloneDynamics();
        ensureRevealTicker(rawId);
      }

      if (allowTask4Kickoff && l2Raw) {
        const afterLineStateAndFlush = async () => {
          saveDesignDetailLineState(rawId, {
            schemaVersion: 1,
            currentTaskId: 'core_value_driver_inference',
            holdPastTask3: false,
            holdPastTask4: false,
          });
          if (mergedItem) {
            reconcileDesignDetailLineTaskId(
              rawId,
              mergedItem,
              lastHydratedMessages.value,
              task1CustomerRequirementPhase.value,
            );
          }
          const stMid = loadDesignDetailLineState(rawId);
          if (stMid?.currentTaskId) currentDesignLineTaskId.value = stMid.currentTaskId;
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
        };

        if (
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_4) &&
          !opts?.deferDebugContinue
        ) {
          removeTask3L2SyncSpinnerLine(rawId);
          withTask3L2DynamicsCard((c3g) => {
            c3g.status = 'completed';
            c3g.completedAtMs = Date.now();
            c3g.completionQueued = true;
            appendLineToCard(
              c3g,
              '→ 任务 3 已收官；请点击下方「继续」进入任务 4（调试门闩）',
              'scope_green',
              { startFullyRevealed: true },
            );
          }, rawId);
          ensureRevealTicker(rawId);
          if (designDetailProgressPersistTimer) {
            clearTimeout(designDetailProgressPersistTimer);
            designDetailProgressPersistTimer = null;
          }
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          appendDebugContinueAtLineTaskEnd(rawId, 'industry_business_profile_extract', async () => {
            await afterLineStateAndFlush();
            let cs = cloneDynamics();
            let c4n = cs.find((c) => c.lineTaskId === 'core_value_driver_inference');
            if (!c4n) {
              c4n = {
                key: `core_value_driver_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                lineTaskId: 'core_value_driver_inference',
                status: 'running',
                startedAtMs: Date.now(),
                completedAtMs: null,
                lines: [],
                extraTailConsumed: 0,
                completionQueued: false,
                thanksAppended: false,
              };
              cs = [...cs, c4n];
            }
            dynamicsCards.value = cs;
            ensureRevealTicker(rawId);
            if (designDetailProgressPersistTimer) {
              clearTimeout(designDetailProgressPersistTimer);
              designDetailProgressPersistTimer = null;
            }
            await flushPersistDesignDetailProgressWorkspace(rawId);
            queuePersistDesignDetailProgressWorkspace();
            await runTask4L2CoreValueDriverPipeline(rawId, epochAtStart, llmAbort, mergedItem, opts);
          });
        } else {
          let cardsSeal = cloneDynamics();
          let c4 = cardsSeal.find((c) => c.lineTaskId === 'core_value_driver_inference');
          if (!c4) {
            c4 = {
              key: `core_value_driver_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              lineTaskId: 'core_value_driver_inference',
              status: 'running',
              startedAtMs: Date.now(),
              completedAtMs: null,
              lines: [],
              extraTailConsumed: 0,
              completionQueued: false,
              thanksAppended: false,
            };
            cardsSeal = [...cardsSeal, c4];
          }
          const c3s = cardsSeal.find((c) => c.lineTaskId === 'industry_business_profile_extract');
          if (c3s) {
            c3s.status = 'completed';
            c3s.completedAtMs = Date.now();
            c3s.completionQueued = true;
          }
          dynamicsCards.value = cardsSeal;
          ensureRevealTicker(rawId);
          if (designDetailProgressPersistTimer) {
            clearTimeout(designDetailProgressPersistTimer);
            designDetailProgressPersistTimer = null;
          }
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();

          await afterLineStateAndFlush();
          await runTask4L2CoreValueDriverPipeline(rawId, epochAtStart, llmAbort, mergedItem);
        }
      } else {
        saveDesignDetailLineState(rawId, {
          schemaVersion: 1,
          currentTaskId: 'industry_business_profile_extract',
          holdPastTask3: false,
          holdPastTask4: false,
        });
        if (mergedItem) {
          reconcileDesignDetailLineTaskId(
            rawId,
            mergedItem,
            lastHydratedMessages.value,
            task1CustomerRequirementPhase.value,
          );
        }
        const stAfter = loadDesignDetailLineState(rawId);
        if (stAfter?.currentTaskId) currentDesignLineTaskId.value = stAfter.currentTaskId;
        await flushPersistDesignDetailProgressWorkspace(rawId);
        queuePersistDesignDetailProgressWorkspace();
      }
    } catch (e) {
      if (exitTask3PipelineIfSessionStale(rawId, epochAtStart)) return;
      task3L2AlignmentQuestionnaireBusy.value = false;
      removeAlignmentQuestionnaireGeneratingLine(
        'industry_business_profile_extract',
        TASK3_L2_ALIGNMENT_Q_WORKING_LINE,
      );
      let cardsE = cloneDynamics();
      const c3e = cardsE.find((c) => c.lineTaskId === 'industry_business_profile_extract');
      if (c3e) {
        removeTask3L2SyncSpinnerFromCard(c3e);
        removeTask3L2LlmWorkingSpinnerFromCard(c3e);
        const aborted =
          (e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message))) ||
          (typeof e === 'object' &&
            e !== null &&
            'name' in e &&
            String((e as { name?: unknown }).name) === 'AbortError');
        appendLineToCard(
          c3e,
          aborted ? '→ 任务 3 推理已取消（会话已重置）' : `→ 任务 3 推理失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cardsE;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    }
  }

  /**
   * 任务 4 L2：价值链分析推理；Target_KV 落库并 TVM 门禁通过后任务 4 卡淡绿收官；调试门闩下点「继续」进入任务 5，否则自动 `runTask5L3MacroProcessPipeline`。
   */
  async function runTask4L2CoreValueDriverPipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    await awaitUsageModePriorLineTaskDisplayComplete('core_value_driver_inference');

    const w = window as unknown as {
      inferDesignDetailL2CoreValueDriverFromContext?: (
        p: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
        usage?: Record<string, unknown>;
        model?: string;
        durationMs?: number;
      }>;
    };
    if (typeof w.inferDesignDetailL2CoreValueDriverFromContext !== 'function') {
      const cardsBad = cloneDynamics();
      const c4b = cardsBad.find((c) => c.lineTaskId === 'core_value_driver_inference');
      if (c4b) {
        appendLineToCard(
          c4b,
          '→ 任务 4 推理失败：未加载 task1BusinessInsight（inferDesignDetailL2CoreValueDriverFromContext）',
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cardsBad;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }

    let cards = cloneDynamics();
    let c4 = cards.find((c) => c.lineTaskId === 'core_value_driver_inference');
    if (!c4) {
      c4 = {
        key: `core_value_driver_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'core_value_driver_inference',
        status: 'running',
        startedAtMs: Date.now(),
        completedAtMs: null,
        lines: [],
        extraTailConsumed: 0,
        completionQueued: false,
        thanksAppended: false,
      };
      cards = [...cards, c4];
    }
    appendLineToCard(c4, TASK4_CORE_VALUE_START_LINE, 'default', { startFullyRevealed: true });
    appendLineToCard(c4, TASK4_DEBUG_L1_FEATURE_LIST_LINE, 'default', { startFullyRevealed: true });
    appendLineToCard(c4, TASK4_DEBUG_L2_FEATURE_LIST_LINE, 'default', { startFullyRevealed: true });
    dynamicsCards.value = cards;
    currentDesignLineTaskId.value = 'core_value_driver_inference';
    saveDesignDetailLineState(rawId, {
      schemaVersion: 1,
      currentTaskId: 'core_value_driver_inference',
      holdPastTask4: false,
    });
    ensureRevealTicker(rawId);
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();

    const getGraph = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (
              id: string,
            ) => Promise<{
              ok?: boolean;
              data?: { tasks?: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }> };
              errorMessage?: string;
            }>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;

    let task1Features: Task2L1TaskGraphFeatureRow[] = [];
    let task2Features: Task2L1TaskGraphFeatureRow[] = [];
    let task3Features: Task2L1TaskGraphFeatureRow[] = [];
    let mergedGraphForTask4: DesignDetailLogicGraphTaskDto[] | null = null;
    if (typeof getGraph === 'function') {
      try {
        const gr = await getGraph(rawId);
        if (gr && gr.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
          mergedGraphForTask4 = normalizeLogicGraphTasksFromApiPayload(
            gr.data.tasks as DesignDetailLogicGraphTaskDto[],
          );
          const picked = pickTask1Task2FeaturesFromGraphTasks(gr.data.tasks);
          task1Features = picked.task1Features;
          task2Features = picked.task2Features;
          task3Features = pickTask3FeaturesFromGraphTasks(gr.data.tasks);
        }
      } catch {
        /* 空图仍送模 */
      }
    }

    const upstreamForTask4 = mergedGraphForTask4?.length
      ? buildTask1PainPointConfirmedConsistencyMap(mergedGraphForTask4)
      : undefined;

    const task4InferenceUserBlock = buildTask4L2InferenceUserBlock(
      task1Features,
      task3Features,
      readTask4L2DeepInsightText(rawId),
      readTask4L2UserRectificationText(rawId),
      upstreamForTask4,
    );

    let l2ValueRaw = '';
    let l2ValueRawForSync = '';
    let task4ImmunityProgressLines: string[] = [];
    let task4PreparedTvmRows: Task2L1TvmParsedRow[] | null = null;

    async function runTask4L2TvmGateAndMaybeAlignmentQuestionnaire(
      c4kvCard: DynamicsCardModel,
      pipelineOpts?: DesignDetailPipelineRunOpts,
    ): Promise<boolean> {
      const raw = String(l2ValueRawForSync || l2ValueRaw || '').trim();
      if (!raw) {
        appendLineToCard(c4kvCard, '→ 反向验证校验跳过：无 L2 模型输出', 'default', {
          startFullyRevealed: true,
        });
        return false;
      }
      let immunityProgressLines = [...task4ImmunityProgressLines];
      let tvmRowsForAlign: Task2L1TvmParsedRow[];
      if (task4PreparedTvmRows?.length) {
        tvmRowsForAlign = task4PreparedTvmRows;
      } else {
        tvmRowsForAlign = parseTask4L2TokenValidationMappingForAlignment(raw);
        let graphForImmunity = mergedGraphForTask4;
        if (!graphForImmunity?.length && typeof getGraph === 'function') {
          const freshGraphForImmunity = await fetchNormalizedLogicGraphTasksForImmunity(rawId, getGraph);
          if (freshGraphForImmunity?.length) {
            graphForImmunity = freshGraphForImmunity;
            mergedGraphForTask4 = freshGraphForImmunity;
          }
        }
        if (graphForImmunity?.length) {
          const gateImm = applyTvmImmunityToRowsForGate(tvmRowsForAlign, graphForImmunity, 'task4');
          tvmRowsForAlign = gateImm.rows;
          immunityProgressLines = [...immunityProgressLines, ...gateImm.progressLines];
        }
      }
      const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
      appendLineToCard(
        c4kvCard,
        `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
          hasUnresolvedTvmConflict
            ? '存在潜在冲突，需对齐确认后方可收官任务 4'
            : 'Consistency 均已消解或已确认为痛点（历史痛点免疫），任务 4 可收官'
        }`,
        'default',
        { startFullyRevealed: true },
      );
      for (const ln of dedupeTvmImmunityProgressLines(immunityProgressLines)) {
        appendLineToCard(c4kvCard, ln, 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cloneDynamics();
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      if (!hasUnresolvedTvmConflict) return true;

      pendingDebugPipelineContinueAction.value = null;
      const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
      const conflictBlock = buildTask4L2ConflictDatasetUserBlock(conflictRows);
      stashAlignmentPainTargetsForLineTask(rawId, 'core_value_driver_inference', conflictRows);
      try {
        console.warn('[design-detail:task4-l2-alignment]', {
          caseId: rawId,
          conflictRows: conflictRows.length,
          tvmParsedTotal: tvmRowsForAlign.length,
        });
      } catch {
        /* ignore */
      }
      if (pipelineOpts?.deferAlignmentQuestionnaire) {
        deferredAlignmentQuestionnaireJob.value = {
          caseId: rawId,
          lineTaskId: 'core_value_driver_inference',
          epochAtStart,
          conflictDatasetUserBlock: conflictBlock,
          tier: 'task4',
        };
        dynamicsCards.value = cloneDynamics();
        ensureRevealTicker(rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
        return false;
      }
      await appendTask4L2AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
      return false;
    }

    let cardsSpin = cloneDynamics();
    const c4spin = cardsSpin.find((c) => c.lineTaskId === 'core_value_driver_inference');
    if (c4spin) {
      appendLineToCard(c4spin, TASK4_L2_VALUE_LLM_WORKING_LINE, 'bmc_generating', {
        bmcGenUi: 'spinner',
        spinnerBlue: true,
        startFullyRevealed: true,
      });
    }
    dynamicsCards.value = cardsSpin;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    try {
      const task4AuditId = designLinePillLabel('core_value_driver_inference');
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: task4AuditId,
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L2_CORE_VALUE_DRIVER,
        },
        () =>
          w.inferDesignDetailL2CoreValueDriverFromContext!(
            { task4InferenceUserBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (designDetailSessionGeneration !== epochAtStart) {
        return;
      }
      let cardsOut = cloneDynamics();
      const c4o = cardsOut.find((c) => c.lineTaskId === 'core_value_driver_inference');
      if (c4o) {
        const spinIdx = findLastProgressLineIndex(
          c4o.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK4_L2_VALUE_LLM_WORKING_LINE,
        );
        if (spinIdx >= 0) c4o.lines.splice(spinIdx, 1);
        l2ValueRaw = String(res.rawOutput || res.content || '').trim();
        l2ValueRawForSync = l2ValueRaw;
        if (l2ValueRaw && typeof getGraph === 'function') {
          let graphPre = mergedGraphForTask4;
          if (!graphPre?.length) {
            const freshPre = await fetchNormalizedLogicGraphTasksForImmunity(rawId, getGraph);
            if (freshPre?.length) {
              graphPre = freshPre;
              mergedGraphForTask4 = freshPre;
            }
          }
          if (graphPre?.length) {
            const pipe = runTvmImmunityPipelineForTask3Or4(
              l2ValueRaw,
              graphPre,
              'task4',
              parseTask4L2TokenValidationMappingForAlignment,
            );
            l2ValueRawForSync = pipe.mergedRaw;
            task4PreparedTvmRows = pipe.rows;
            task4ImmunityProgressLines = pipe.progressLines;
          }
        }
        appendLineToCard(c4o, TASK4_DEBUG_INFERENCE_DONE_LINE, 'default', { startFullyRevealed: true });
        const subBody = truncateTask4L2DebugProgressText(l2ValueRaw || '（模型无输出）');
        appendLineToCard(c4o, subBody, 'task4_inference_sub', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsOut;
      ensureRevealTicker(rawId);

      let cardsAfterKv = cloneDynamics();
      const c4kv = cardsAfterKv.find((c) => c.lineTaskId === 'core_value_driver_inference');
      if (c4kv) {
        appendLineToCard(c4kv, TASK4_LOGIC_EXTRACT_LINE, 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsAfterKv;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);

      let allowTask4SyncOk = false;
      if (c4kv && isOnlineMode()) {
        const postT4 = (
          window as unknown as {
            SmartCto?: {
              problemCaseApi?: {
                postDesignDetailSyncTask4L2TargetKvTokens?: (
                  id: string,
                  body: Record<string, unknown>,
                ) => Promise<{
                  ok?: boolean;
                  message?: string;
                } | null>;
              };
            };
          }
        ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask4L2TargetKvTokens;
        if (typeof postT4 === 'function' && l2ValueRaw) {
          try {
            const normT4 = normalizeL2ValueInferenceRawForServerSync(l2ValueRawForSync || l2ValueRaw);
            if (!normT4.ok) {
              appendLineToCard(
                c4kv,
                `→ Target_KV 落库失败：${normT4.message}`,
                'default',
                { startFullyRevealed: true },
              );
            } else {
            const syncRes = await postT4(
              rawId,
              mergeTargetKvSyncBodyWithAlignmentMeta(
                { l2ValueInferenceRaw: normT4.normalized },
                buildTask4L2TargetKvSyncAlignmentMeta(rawId),
              ),
            );
            if (designDetailSessionGeneration !== epochAtStart) return;
            if (!syncRes || syncRes.ok !== true) {
              const hint =
                syncRes && typeof (syncRes as { message?: string }).message === 'string'
                  ? (syncRes as { message: string }).message
                  : '同步失败';
              appendLineToCard(c4kv, `→ Target_KV 落库失败：${hint}`, 'default', { startFullyRevealed: true });
            } else {
              allowTask4SyncOk = true;
              try {
                console.warn('[design-detail:task4-l2-sync]', {
                  caseId: rawId,
                  ok: true,
                  l2ValueRawLen: l2ValueRaw.length,
                  l2ValueRawHasTokenValidationKey: /Token_Validation_Mapping/i.test(l2ValueRaw),
                });
              } catch {
                /* ignore */
              }
              if (typeof getGraph === 'function') {
                try {
                  const gr2 = await getGraph(rawId);
                  if (designDetailSessionGeneration !== epochAtStart) return;
                  if (gr2 && gr2.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
                    const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                      gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
                    );
                    mergedGraphForTask4 = mergedForProgress;
                    await pushFeatureInferenceConclusionsAfterSync(
                      rawId,
                      'core_value_driver_inference',
                      mergedForProgress,
                      llmAbort.signal,
                      c4kv,
                      cardsAfterKv,
                    );
                    appendLineToCard(c4kv, '→ 任务 4：开始提炼正向归纳链接', 'default', {
                      startFullyRevealed: true,
                    });
                    for (const ln of buildForwardInductionLinkUiLinesTask4(mergedForProgress)) {
                      appendLineToCard(c4kv, ln, 'bmc_result_quote', { startFullyRevealed: true });
                    }
                    appendLineToCard(c4kv, '→ 更新 tree 视图', 'default', { startFullyRevealed: true });
                    logicTreeGraphRefreshTick.value += 1;

                    appendLineToCard(c4kv, '→ Token_Validation_Mapping（价值链）：', 'default', {
                      startFullyRevealed: true,
                    });
                    appendLineToCard(
                      c4kv,
                      extractTask4L2TokenValidationMappingProgressSnippet(l2ValueRawForSync || l2ValueRaw),
                      'token_validation_mapping_quote',
                      { startFullyRevealed: true },
                    );

                    appendLineToCard(c4kv, '→ 开始提炼反向验证链接', 'default', { startFullyRevealed: true });
                    for (const ln2 of buildReverseValidationLinkUiLines(mergedForProgress)) {
                      appendLineToCard(c4kv, ln2, 'bmc_result_quote', { startFullyRevealed: true });
                    }
                    appendLineToCard(c4kv, '→ 更新 tree 视图', 'default', { startFullyRevealed: true });
                    logicTreeGraphRefreshTick.value += 1;

                    const tf = pickTask4TokensFeaturesFromGraphTasks(gr2.data.tasks);
                    appendLineToCard(c4kv, TASK4_DEBUG_TOKEN_KV_LINE, 'default', { startFullyRevealed: true });
                    const tokenLines = tf.tokens
                      .map((row) => String(row.tokenId ?? (row as { token_id?: unknown }).token_id ?? '').trim())
                      .filter(Boolean)
                      .map((tid) => `任务 4-token-${tid}`);
                    appendLineToCard(
                      c4kv,
                      tokenLines.length ? tokenLines.join('\n') : '（无 token）',
                      'task4_inference_sub',
                      { startFullyRevealed: true },
                    );
                    appendLineToCard(c4kv, TASK4_DEBUG_FEATURE_KV_LINE, 'default', { startFullyRevealed: true });
                    const featLines = tf.features.map((f) => formatTask4FeatureKvDebugLine(f));
                    appendLineToCard(
                      c4kv,
                      featLines.length ? featLines.join('\n') : '（无 feature）',
                      'task4_inference_sub',
                      { startFullyRevealed: true },
                    );
                    dynamicsCards.value = cardsAfterKv;
                    ensureRevealTicker(rawId);
                    await flushPersistDesignDetailProgressWorkspace(rawId);
                  } else {
                    appendLineToCard(
                      c4kv,
                      '→ 推理图响应无 tasks 或结构异常，跳过 token/feature 调试行',
                      'default',
                      { startFullyRevealed: true },
                    );
                  }
                } catch {
                  appendLineToCard(c4kv, '→ 拉取推理图失败，跳过 token/feature 调试行', 'default', {
                    startFullyRevealed: true,
                  });
                }
              } else {
                appendLineToCard(c4kv, '→ 未挂载 getDesignDetailTaskGraph，跳过 token/feature 调试行', 'default', {
                  startFullyRevealed: true,
                });
              }
            }
            }
          } catch (eKv) {
            if (designDetailSessionGeneration !== epochAtStart) return;
            appendLineToCard(
              c4kv,
              `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
              'default',
              { startFullyRevealed: true },
            );
          }
        } else if (!l2ValueRaw) {
          appendLineToCard(c4kv, '→ Target_KV 落库跳过：模型无可用 JSON 输出', 'default', {
            startFullyRevealed: true,
          });
        } else {
          appendLineToCard(c4kv, '→ 未加载 postDesignDetailSyncTask4L2TargetKvTokens，跳过服务端写入', 'default', {
            startFullyRevealed: true,
          });
        }
      } else if (c4kv) {
        appendLineToCard(c4kv, '→ 离线模式：未将 Target_KV 写入服务端', 'default', { startFullyRevealed: true });
        if (l2ValueRaw) allowTask4SyncOk = true;
      }
      dynamicsCards.value = cardsAfterKv;
      ensureRevealTicker(rawId);

      let allowTask4Complete = !!(allowTask4SyncOk && l2ValueRaw);
      if (allowTask4Complete) {
        const cardsGate = cloneDynamics();
        const c4g = cardsGate.find((c) => c.lineTaskId === 'core_value_driver_inference');
        if (c4g) {
          allowTask4Complete = await runTask4L2TvmGateAndMaybeAlignmentQuestionnaire(c4g, opts);
          if (designDetailSessionGeneration !== epochAtStart) return;
        }
        dynamicsCards.value = cloneDynamics();
        ensureRevealTicker(rawId);
      }

      const allowTask5Kickoff = !!(allowTask4Complete && l2ValueRaw);

      if (allowTask4Complete) {
        const cardsDone = cloneDynamics();
        const c4d = cardsDone.find((c) => c.lineTaskId === 'core_value_driver_inference');
        if (c4d) {
          c4d.status = 'completed';
          c4d.completedAtMs = Date.now();
          c4d.completionQueued = true;
        }
        dynamicsCards.value = cardsDone;
        ensureRevealTicker(rawId);
        if (designDetailProgressPersistTimer) {
          clearTimeout(designDetailProgressPersistTimer);
          designDetailProgressPersistTimer = null;
        }
        await flushPersistDesignDetailProgressWorkspace(rawId);
        queuePersistDesignDetailProgressWorkspace();
      }

      if (allowTask5Kickoff) {
        const afterLineStateAndFlush = async () => {
          saveDesignDetailLineState(rawId, {
            schemaVersion: 1,
            currentTaskId: 'macro_process_flow_inference',
            holdPastTask3: false,
            holdPastTask4: false,
          });
          if (mergedItem) {
            reconcileDesignDetailLineTaskId(
              rawId,
              mergedItem,
              lastHydratedMessages.value,
              task1CustomerRequirementPhase.value,
            );
          }
          const stMid = loadDesignDetailLineState(rawId);
          if (stMid?.currentTaskId) currentDesignLineTaskId.value = stMid.currentTaskId;
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
        };

        if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && !opts?.deferDebugContinue) {
          await afterLineStateAndFlush();
          appendDebugContinueAtLineTaskEnd(rawId, 'core_value_driver_inference', async () => {
            let cs = cloneDynamics();
            let c5n = cs.find((c) => c.lineTaskId === 'macro_process_flow_inference');
            if (!c5n) {
              c5n = {
                key: `macro_process_flow_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                lineTaskId: 'macro_process_flow_inference',
                status: 'running',
                startedAtMs: Date.now(),
                completedAtMs: null,
                lines: [],
                extraTailConsumed: 0,
                completionQueued: false,
                thanksAppended: false,
              };
              cs = [...cs, c5n];
            }
            dynamicsCards.value = cs;
            ensureRevealTicker(rawId);
            if (designDetailProgressPersistTimer) {
              clearTimeout(designDetailProgressPersistTimer);
              designDetailProgressPersistTimer = null;
            }
            await flushPersistDesignDetailProgressWorkspace(rawId);
            queuePersistDesignDetailProgressWorkspace();
            await runTask5L3MacroProcessPipeline(rawId, epochAtStart, llmAbort, mergedItem);
          });
        } else {
          let cardsSeal = cloneDynamics();
          let c5 = cardsSeal.find((c) => c.lineTaskId === 'macro_process_flow_inference');
          if (!c5) {
            c5 = {
              key: `macro_process_flow_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              lineTaskId: 'macro_process_flow_inference',
              status: 'running',
              startedAtMs: Date.now(),
              completedAtMs: null,
              lines: [],
              extraTailConsumed: 0,
              completionQueued: false,
              thanksAppended: false,
            };
            cardsSeal = [...cardsSeal, c5];
          }
          dynamicsCards.value = cardsSeal;
          ensureRevealTicker(rawId);
          if (designDetailProgressPersistTimer) {
            clearTimeout(designDetailProgressPersistTimer);
            designDetailProgressPersistTimer = null;
          }
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          await afterLineStateAndFlush();
          await runTask5L3MacroProcessPipeline(rawId, epochAtStart, llmAbort, mergedItem);
        }
      } else {
        saveDesignDetailLineState(rawId, {
          schemaVersion: 1,
          currentTaskId: 'core_value_driver_inference',
          holdPastTask3: false,
          holdPastTask4: !!(allowTask4SyncOk && l2ValueRaw),
        });
      }
      if (mergedItem) {
        reconcileDesignDetailLineTaskId(
          rawId,
          mergedItem,
          lastHydratedMessages.value,
          task1CustomerRequirementPhase.value,
        );
      }
      const stT4 = loadDesignDetailLineState(rawId);
      if (stT4?.currentTaskId) currentDesignLineTaskId.value = stT4.currentTaskId;
      await flushPersistDesignDetailProgressWorkspace(rawId);
      queuePersistDesignDetailProgressWorkspace();
    } catch (e) {
      if (designDetailSessionGeneration !== epochAtStart) {
        return;
      }
      let cardsE = cloneDynamics();
      const c4e = cardsE.find((c) => c.lineTaskId === 'core_value_driver_inference');
      if (c4e) {
        const spinIdx = findLastProgressLineIndex(
          c4e.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK4_L2_VALUE_LLM_WORKING_LINE,
        );
        if (spinIdx >= 0) c4e.lines.splice(spinIdx, 1);
        const aborted =
          (e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message))) ||
          (typeof e === 'object' &&
            e !== null &&
            'name' in e &&
            String((e as { name?: unknown }).name) === 'AbortError');
        appendLineToCard(
          c4e,
          aborted ? '→ 任务 4 推理已取消（会话已重置）' : `→ 任务 4 推理失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cardsE;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    }
  }

  /**
   * 任务 5 L3：宏观业务流程 / VSM；Target_KV 落库成功后任务 5 卡淡绿收官，`holdPastTask5` 护栏。
   */
  async function runTask5L3MacroProcessPipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    await awaitUsageModePriorLineTaskDisplayComplete('macro_process_flow_inference');

    const w = window as unknown as {
      inferDesignDetailL3MacroProcessFromContext?: (
        p: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
      }>;
    };
    if (typeof w.inferDesignDetailL3MacroProcessFromContext !== 'function') {
      const cardsBad = cloneDynamics();
      const c5b = cardsBad.find((c) => c.lineTaskId === 'macro_process_flow_inference');
      if (c5b) {
        appendLineToCard(
          c5b,
          '→ 任务 5 推理失败：未加载 task1BusinessInsight（inferDesignDetailL3MacroProcessFromContext）',
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cardsBad;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }

    let cards = cloneDynamics();
    let c5 = cards.find((c) => c.lineTaskId === 'macro_process_flow_inference');
    if (!c5) {
      c5 = {
        key: `macro_process_flow_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'macro_process_flow_inference',
        status: 'running',
        startedAtMs: Date.now(),
        completedAtMs: null,
        lines: [],
        extraTailConsumed: 0,
        completionQueued: false,
        thanksAppended: false,
      };
      cards = [...cards, c5];
    }
    appendLineToCard(c5, TASK5_MACRO_PROCESS_START_LINE, 'scope_green', { startFullyRevealed: true });
    appendLineToCard(c5, TASK5_DEBUG_UPSTREAM_FEATURE_LIST_LINE, 'default', { startFullyRevealed: true });
    dynamicsCards.value = cards;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    const getGraph = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (
              id: string,
            ) => Promise<{
              ok?: boolean;
              data?: { tasks?: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }> };
            }>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;

    let task1Features: Task2L1TaskGraphFeatureRow[] = [];
    let task2Features: Task2L1TaskGraphFeatureRow[] = [];
    let task3Features: Task2L1TaskGraphFeatureRow[] = [];
    let task4Features: Task2L1TaskGraphFeatureRow[] = [];
    let mergedGraphForTask5: DesignDetailLogicGraphTaskDto[] | undefined;
    if (typeof getGraph === 'function') {
      try {
        const gr = await getGraph(rawId);
        if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
          mergedGraphForTask5 = normalizeLogicGraphTasksFromApiPayload(
            gr.data.tasks as DesignDetailLogicGraphTaskDto[],
          );
          const picked = pickTask1Task2FeaturesFromGraphTasks(gr.data.tasks);
          task1Features = picked.task1Features;
          task2Features = picked.task2Features;
          task3Features = pickTask3FeaturesFromGraphTasks(gr.data.tasks);
          task4Features = pickTask4FeaturesFromGraphTasks(gr.data.tasks);
        }
      } catch {
        /* 空图仍送模 */
      }
    }

    const upstreamForTask5 = mergedGraphForTask5?.length
      ? buildTask1PainPointConfirmedConsistencyMap(mergedGraphForTask5)
      : undefined;

    const task5InferenceUserBlock = buildTask5L3InferenceUserBlock(
      task1Features,
      task2Features,
      task3Features,
      task4Features,
      readTask5L3DeepInsightText(rawId),
      readTask5L3UserRectificationText(rawId),
      upstreamForTask5,
    );

    let l3ProcessRaw = '';
    withTask5L3DynamicsCard((card) => {
      appendLineToCard(card, TASK5_L3_LLM_WORKING_LINE, 'bmc_generating', {
        bmcGenUi: 'spinner',
        spinnerBlue: true,
        startFullyRevealed: true,
      });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    try {
      const task5AuditId = designLinePillLabel('macro_process_flow_inference');
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: task5AuditId,
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L3_MACRO_PROCESS,
        },
        () =>
          w.inferDesignDetailL3MacroProcessFromContext!(
            { task5InferenceUserBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (designDetailSessionGeneration !== epochAtStart) return;

      removeTask5L3LlmWorkingSpinnerLine(rawId);
      l3ProcessRaw = String(res.rawOutput || res.content || '').trim();
      withTask5L3DynamicsCard((card) => {
        appendLineToCard(card, TASK5_DEBUG_INFERENCE_DONE_LINE, 'default', { startFullyRevealed: true });
        appendLineToCard(
          card,
          truncateTask5L3DebugProgressText(l3ProcessRaw || '（模型无输出）'),
          'task5_inference_sub',
          { startFullyRevealed: true },
        );
        appendLineToCard(card, TASK5_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);

      let allowTask5SyncOk = false;
      if (isOnlineMode() && l3ProcessRaw) {
        const postT5 = (
          window as unknown as {
            SmartCto?: {
              problemCaseApi?: {
                postDesignDetailSyncTask5L3TargetKvTokens?: (
                  id: string,
                  body: Record<string, unknown>,
                ) => Promise<{ ok?: boolean; message?: string } | null>;
              };
            };
          }
        ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask5L3TargetKvTokens;
        if (typeof postT5 === 'function') {
          try {
            const normT5 = normalizeL3ProcessInferenceRawForServerSync(l3ProcessRaw);
            if (!normT5.ok) {
              removeTask5L3SyncSpinnerLine(rawId);
              withTask5L3DynamicsCard((card) => {
                appendLineToCard(card, `→ Target_KV 落库失败：${normT5.message}`, 'default', {
                  startFullyRevealed: true,
                });
              }, rawId);
            } else {
              withTask5L3DynamicsCard((card) => {
                appendLineToCard(card, TASK5_SYNC_TARGET_KV_LINE, 'bmc_generating', {
                  bmcGenUi: 'spinner',
                  spinnerBlue: true,
                  startFullyRevealed: true,
                });
              }, rawId);
              await flushPersistDesignDetailProgressWorkspace(rawId);
              let syncRes: { ok?: boolean; message?: string } | null = null;
              try {
                syncRes = await postT5(
                  rawId,
                  mergeTargetKvSyncBodyWithAlignmentMeta(
                    { l3ProcessInferenceRaw: normT5.normalized },
                    buildTask5L3TargetKvSyncAlignmentMeta(rawId),
                  ),
                );
              } finally {
                removeTask5L3SyncSpinnerLine(rawId);
              }
              if (designDetailSessionGeneration !== epochAtStart) return;
              if (syncRes?.ok === true) {
                allowTask5SyncOk = true;
                try {
                  console.warn('[design-detail:task5-l3-sync]', { caseId: rawId, ok: true });
                } catch {
                  /* ignore */
                }
                withTask5L3DynamicsCard((card) => {
                  appendLineToCard(card, TASK5_SYNC_TARGET_KV_OK_LINE, 'scope_green', {
                    startFullyRevealed: true,
                  });
                }, rawId);
                await flushPersistDesignDetailProgressWorkspace(rawId);
                if (typeof getGraph === 'function') {
                  const gr2 = await getGraph(rawId);
                  if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
                    const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                      gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
                    );
                    await pushFeatureInferenceConclusionsAfterSync(
                      rawId,
                      'macro_process_flow_inference',
                      mergedForProgress,
                      llmAbort.signal,
                    );
                    withTask5L3DynamicsCard((card) => {
                      appendLineToCard(card, '→ 任务 5：开始提炼正向归纳链接', 'scope_green', {
                        startFullyRevealed: true,
                      });
                      for (const ln of buildForwardInductionLinkUiLinesTask5(mergedForProgress)) {
                        appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
                      }
                      appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                      appendLineToCard(card, '→ Token_Validation_Mapping（L3）：', 'scope_green', {
                        startFullyRevealed: true,
                      });
                      appendLineToCard(
                        card,
                        extractTask5L3TokenValidationMappingProgressSnippet(l3ProcessRaw),
                        'token_validation_mapping_quote',
                        { startFullyRevealed: true },
                      );
                      appendLineToCard(card, '→ 开始提炼反向验证链接', 'scope_green', {
                        startFullyRevealed: true,
                      });
                      for (const ln2 of buildReverseValidationLinkUiLines(mergedForProgress)) {
                        appendLineToCard(card, ln2, 'bmc_result_quote', { startFullyRevealed: true });
                      }
                      appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                      appendLineToCard(card, TASK5_DEBUG_TOKEN_KV_LINE, 'default', { startFullyRevealed: true });
                      const tf = pickTask5TokensFeaturesFromGraphTasks(gr2.data.tasks);
                      const tokenLines = tf.tokens
                        .map((row) => String(row.tokenId ?? '').trim())
                        .filter(Boolean)
                        .map((tid) => `任务 5-token-${tid}`);
                      appendLineToCard(
                        card,
                        tokenLines.length ? tokenLines.join('\n') : '（无 token）',
                        'task5_inference_sub',
                        { startFullyRevealed: true },
                      );
                      appendLineToCard(card, TASK5_DEBUG_FEATURE_KV_LINE, 'default', { startFullyRevealed: true });
                      const featLines = tf.features.map((f) => formatTask5FeatureKvDebugLine(f));
                      appendLineToCard(
                        card,
                        featLines.length ? featLines.join('\n') : '（无 feature）',
                        'task5_inference_sub',
                        { startFullyRevealed: true },
                      );
                    }, rawId);
                    logicTreeGraphRefreshTick.value += 2;
                  }
                }
              } else {
                const hint =
                  syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
                withTask5L3DynamicsCard((card) => {
                  appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', {
                    startFullyRevealed: true,
                  });
                }, rawId);
              }
            }
          } catch (eKv) {
            removeTask5L3SyncSpinnerLine(rawId);
            withTask5L3DynamicsCard((card) => {
              appendLineToCard(
                card,
                `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
                'default',
                { startFullyRevealed: true },
              );
            }, rawId);
          }
        } else {
          withTask5L3DynamicsCard((card) => {
            appendLineToCard(card, '→ 未加载 postDesignDetailSyncTask5L3TargetKvTokens', 'default', {
              startFullyRevealed: true,
            });
          }, rawId);
        }
      } else if (!isOnlineMode() && l3ProcessRaw) {
        withTask5L3DynamicsCard((card) => {
          appendLineToCard(card, '→ 离线模式：未将 Target_KV 写入服务端', 'default', { startFullyRevealed: true });
        }, rawId);
        allowTask5SyncOk = true;
      }

      async function runTask5L3TvmGateAndMaybeAlignmentQuestionnaire(
        pipelineOpts?: DesignDetailPipelineRunOpts,
      ): Promise<boolean> {
        const raw = String(l3ProcessRaw || '').trim();
        if (!raw) {
          withTask5L3DynamicsCard((card) => {
            appendLineToCard(card, '→ 反向验证校验跳过：无 L3 模型输出', 'default', {
              startFullyRevealed: true,
            });
          }, rawId);
          return false;
        }
        const tvmRowsForAlign = parseTask5L3TokenValidationMappingForAlignment(raw);
        const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
        const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
        const conflictCount = conflictRows.length;
        try {
          console.warn('[design-detail:task5-l3-gate]', {
            caseId: rawId,
            tvmRows: tvmRowsForAlign.length,
            potentialConflictCount: conflictCount,
            allowTask51Kickoff: !hasUnresolvedTvmConflict,
          });
        } catch {
          /* ignore */
        }
        withTask5L3DynamicsCard((card) => {
          appendLineToCard(
            card,
            `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
              hasUnresolvedTvmConflict
                ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 5.1`
                : 'Consistency 均已消解或已确认为痛点，可进入任务 5.1'
            }`,
            'scope_green',
            { startFullyRevealed: true },
          );
        }, rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
        if (!hasUnresolvedTvmConflict) return true;

        pendingDebugPipelineContinueAction.value = null;
        if (!conflictCount) {
          withTask5L3DynamicsCard((card) => {
            appendLineToCard(
              card,
              '→ 门禁判定存在未消解校验，但冲突清单为空；请查看控制台 [design-detail:task5-l3-gate]',
              'default',
              { startFullyRevealed: true },
            );
          }, rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          return false;
        }
        const conflictBlock = buildTask5L3ConflictDatasetUserBlock(conflictRows);
        stashAlignmentPainTargetsForLineTask(rawId, 'macro_process_flow_inference', conflictRows);
        if (pipelineOpts?.deferAlignmentQuestionnaire) {
          deferredAlignmentQuestionnaireJob.value = {
            caseId: rawId,
            lineTaskId: 'macro_process_flow_inference',
            epochAtStart,
            conflictDatasetUserBlock: conflictBlock,
            tier: 'task5',
          };
          await flushPersistDesignDetailProgressWorkspace(rawId);
          return false;
        }
        await appendTask5L3AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
        return false;
      }

      let allowTask51Kickoff = false;
      if (allowTask5SyncOk && l3ProcessRaw) {
        allowTask51Kickoff = await runTask5L3TvmGateAndMaybeAlignmentQuestionnaire(_opts);
        if (designDetailSessionGeneration !== epochAtStart) return;
      }

      if (l3ProcessRaw) {
        removeTask5L3LlmWorkingSpinnerLine(rawId);
        withTask5L3DynamicsCard((card) => {
          if (allowTask5SyncOk && allowTask51Kickoff) {
            card.status = 'completed';
            card.completedAtMs = Date.now();
            card.completionQueued = true;
          } else if (allowTask5SyncOk && !allowTask51Kickoff) {
            card.status = 'running';
            card.completedAtMs = null;
            card.completionQueued = false;
          } else if (!allowTask5SyncOk) {
            card.status = 'completed';
            card.completedAtMs = Date.now();
            appendLineToCard(
              card,
              '→ 任务 5 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
              'default',
              { startFullyRevealed: true },
            );
          }
        }, rawId);
      }
      ensureRevealTicker(rawId);

      const task5Done = !!(allowTask5SyncOk && l3ProcessRaw && allowTask51Kickoff);
      saveDesignDetailLineState(rawId, {
        schemaVersion: 1,
        currentTaskId: task5Done ? 'value_proposition_capability_units' : 'macro_process_flow_inference',
        holdPastTask3: false,
        holdPastTask4: false,
        holdPastTask5: task5Done,
      });
      if (mergedItem) {
        reconcileDesignDetailLineTaskId(
          rawId,
          mergedItem,
          lastHydratedMessages.value,
          task1CustomerRequirementPhase.value,
        );
      }
      const stT5 = loadDesignDetailLineState(rawId);
      if (stT5?.currentTaskId) currentDesignLineTaskId.value = stT5.currentTaskId;
      await flushPersistDesignDetailProgressWorkspace(rawId);
      if (task5Done) {
        await runTask51ValuePropositionPipelineImpl(rawId, epochAtStart, llmAbort, mergedItem, _opts);
      }
    } catch (e) {
      if (designDetailSessionGeneration !== epochAtStart) return;
      removeTask5L3LlmWorkingSpinnerLine(rawId);
      removeTask5L3SyncSpinnerLine(rawId);
      withTask5L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ 任务 5 推理失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    }
  }

  /**
   * 任务 5.5 L3.5：VSM 阶段拆解；以任务 5 宏观特征为硬约束；落库成功后 `holdPastTask55`。
   */
  async function runTask55L3VsmStagePipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    await awaitUsageModePriorLineTaskDisplayComplete('vsm_stage_decomposition');

    const w = window as unknown as {
      inferDesignDetailL3VsmStageFromContext?: (
        p: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{ rawOutput?: string; content?: string }>;
    };
    if (typeof w.inferDesignDetailL3VsmStageFromContext !== 'function') {
      const c55b = cloneDynamics().find((c) => c.lineTaskId === 'vsm_stage_decomposition');
      if (c55b) {
        appendLineToCard(
          c55b,
          '→ 任务 5.5 推理失败：未加载 inferDesignDetailL3VsmStageFromContext',
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cloneDynamics();
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }

    let cards = cloneDynamics();
    let c55 = cards.find((c) => c.lineTaskId === 'vsm_stage_decomposition');
    if (!c55) {
      c55 = {
        key: `vsm_stage_decomposition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'vsm_stage_decomposition',
        status: 'running',
        startedAtMs: Date.now(),
        completedAtMs: null,
        lines: [],
        extraTailConsumed: 0,
        completionQueued: false,
        thanksAppended: false,
      };
      cards = [...cards, c55];
    }
    appendLineToCard(c55, TASK55_VSM_START_LINE, 'scope_green', { startFullyRevealed: true });
    dynamicsCards.value = cards;
    ensureRevealTicker(rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    const getGraph = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (id: string) => Promise<{
              ok?: boolean;
              data?: { tasks?: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }> };
            }>;
            postDesignDetailSyncTask55L3VsmTargetKvTokens?: (
              id: string,
              body: Record<string, unknown>,
            ) => Promise<{ ok?: boolean; message?: string } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;

    let task53WorkflowFeatures: ReturnType<typeof pickTask53WorkflowFeaturesFromGraphTasks> = [];
    if (typeof getGraph === 'function') {
      try {
        const gr = await getGraph(rawId);
        if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
          task53WorkflowFeatures = pickTask53WorkflowFeaturesFromGraphTasks(gr.data.tasks);
          appendLineToCard(c55, TASK55_DEBUG_MACRO_CONSTRAINT_LINE, 'default', { startFullyRevealed: true });
          appendLineToCard(
            c55,
            `5.3 核心工作流 ${task53WorkflowFeatures.length} 条（须 100% 归入 classified_workflows）`,
            'task55_inference_sub',
            { startFullyRevealed: true },
          );
        }
      } catch {
        /* 空图仍送模 */
      }
    }

    const task55InferenceUserBlock = buildTask55L3VsmInferenceUserBlock(task53WorkflowFeatures);

    let l3VsmRaw = '';
    withTask55L3DynamicsCard((card) => {
      appendLineToCard(card, TASK55_L3_LLM_WORKING_LINE, 'bmc_generating', {
        bmcGenUi: 'spinner',
        spinnerBlue: true,
        startFullyRevealed: true,
      });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    try {
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: designLinePillLabel('vsm_stage_decomposition'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L3_VSM_STAGE,
        },
        () =>
          w.inferDesignDetailL3VsmStageFromContext!(
            { task55InferenceUserBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (designDetailSessionGeneration !== epochAtStart) return;

      removeTask55L3LlmWorkingSpinnerLine(rawId);
      l3VsmRaw = String(res.rawOutput || res.content || '').trim();
      withTask55L3DynamicsCard((card) => {
        appendLineToCard(card, TASK55_DEBUG_INFERENCE_DONE_LINE, 'default', { startFullyRevealed: true });
        appendLineToCard(
          card,
          truncateTask55L3DebugProgressText(l3VsmRaw || '（模型无输出）'),
          'task55_inference_sub',
          { startFullyRevealed: true },
        );
        appendLineToCard(card, TASK55_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);

      let allowTask55SyncOk = false;
      const postT55 = (
        window as unknown as {
          SmartCto?: {
            problemCaseApi?: {
              postDesignDetailSyncTask55L3VsmTargetKvTokens?: (
                id: string,
                body: Record<string, unknown>,
              ) => Promise<{ ok?: boolean; message?: string } | null>;
            };
          };
        }
      ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask55L3VsmTargetKvTokens;
      if (isOnlineMode() && l3VsmRaw && typeof postT55 === 'function') {
        try {
          const norm = normalizeL3Vsm55InferenceRawForServerSync(l3VsmRaw);
          if (!norm.ok) {
            removeTask55L3SyncSpinnerLine(rawId);
            withTask55L3DynamicsCard((card) => {
              appendLineToCard(card, `→ Target_KV 落库失败：${norm.message}`, 'default', {
                startFullyRevealed: true,
              });
            }, rawId);
          } else {
            withTask55L3DynamicsCard((card) => {
              appendLineToCard(card, TASK55_SYNC_TARGET_KV_LINE, 'bmc_generating', {
                bmcGenUi: 'spinner',
                spinnerBlue: true,
                startFullyRevealed: true,
              });
            }, rawId);
            await flushPersistDesignDetailProgressWorkspace(rawId);
            let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
            try {
              syncRes = await postT55(
                rawId,
                mergeTargetKvSyncBodyWithAlignmentMeta(
                  { l3ProcessInferenceRaw: norm.normalized },
                  buildTask55L3TargetKvSyncAlignmentMeta(rawId),
                ),
              );
            } finally {
              removeTask55L3SyncSpinnerLine(rawId);
            }
            if (designDetailSessionGeneration !== epochAtStart) return;
            if (syncRes?.ok === true) {
              allowTask55SyncOk = true;
              const syncData = syncRes as {
                data?: { tokenCount?: number; featureCount?: number; linkCount?: number };
              };
              try {
                console.warn('[design-detail:task55-l3-vsm-sync]', {
                  caseId: rawId,
                  ok: true,
                  tokenCount: syncData.data?.tokenCount,
                  featureCount: syncData.data?.featureCount,
                  linkCount: syncData.data?.linkCount,
                });
              } catch {
                /* ignore */
              }
              withTask55L3DynamicsCard((card) => {
                appendLineToCard(card, TASK55_SYNC_TARGET_KV_OK_LINE, 'scope_green', {
                  startFullyRevealed: true,
                });
              }, rawId);
              await flushPersistDesignDetailProgressWorkspace(rawId);
              if (typeof getGraph === 'function') {
                const gr2 = await getGraph(rawId);
                if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
                  const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                    gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
                  );
                  await pushFeatureInferenceConclusionsAfterSync(
                    rawId,
                    'vsm_stage_decomposition',
                    mergedForProgress,
                    llmAbort.signal,
                  );
                  withTask55L3DynamicsCard((card) => {
                    appendLineToCard(card, '→ 任务 5.5：开始提炼正向归纳链接', 'scope_green', {
                      startFullyRevealed: true,
                    });
                    const fwdLines = buildForwardInductionLinkUiLinesTask55(mergedForProgress);
                    for (const ln of fwdLines) {
                      appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
                    }
                    const lc =
                      typeof syncData.data?.linkCount === 'number'
                        ? syncData.data.linkCount
                        : fwdLines[0]?.startsWith('（')
                          ? 0
                          : fwdLines.length;
                    appendLineToCard(
                      card,
                      `→ 推理结果已提炼｜token ${syncData.data?.tokenCount ?? '—'}｜特征 ${syncData.data?.featureCount ?? '—'}｜逻辑边 ${lc}`,
                      'scope_green',
                      { startFullyRevealed: true },
                    );
                    appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', {
                      startFullyRevealed: true,
                    });
                    appendLineToCard(card, TASK55_DEBUG_TOKEN_KV_LINE, 'default', { startFullyRevealed: true });
                    const tf = pickTask55TokensFeaturesFromGraphTasks(gr2.data.tasks);
                    const tokenLines = tf.tokens
                      .map((row) => String(row.tokenId ?? '').trim())
                      .filter(Boolean)
                      .map((tid) => `任务 5.5-token-${tid}`);
                    appendLineToCard(
                      card,
                      tokenLines.length ? tokenLines.join('\n') : '（无 token）',
                      'task55_inference_sub',
                      { startFullyRevealed: true },
                    );
                    appendLineToCard(card, TASK55_DEBUG_FEATURE_KV_LINE, 'default', { startFullyRevealed: true });
                    const featLines = tf.features.map((f) => formatTask5FeatureKvDebugLine(f));
                    appendLineToCard(
                      card,
                      featLines.length ? featLines.join('\n') : '（无 feature）',
                      'task55_inference_sub',
                      { startFullyRevealed: true },
                    );
                  }, rawId);
                  logicTreeGraphRefreshTick.value += 1;
                }
              }
            } else {
              const hint =
                syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
              withTask55L3DynamicsCard((card) => {
                appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', {
                  startFullyRevealed: true,
                });
                if (syncRes && syncRes.status === 404) {
                  appendLineToCard(
                    card,
                    '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task55 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                    'default',
                    { startFullyRevealed: true },
                  );
                }
              }, rawId);
            }
          }
        } catch (eKv) {
          removeTask55L3SyncSpinnerLine(rawId);
          withTask55L3DynamicsCard((card) => {
            appendLineToCard(
              card,
              `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
              'default',
              { startFullyRevealed: true },
            );
          }, rawId);
        }
      } else if (!isOnlineMode() && l3VsmRaw) {
        allowTask55SyncOk = true;
      }

      async function runTask55L3TvmGateAndMaybeAlignmentQuestionnaire(
        pipelineOpts?: DesignDetailPipelineRunOpts,
      ): Promise<boolean> {
        const raw = String(l3VsmRaw || '').trim();
        if (!raw) {
          withTask55L3DynamicsCard((card) => {
            appendLineToCard(card, '→ 反向验证校验跳过：无 L3.5 模型输出', 'default', {
              startFullyRevealed: true,
            });
          }, rawId);
          return false;
        }
        const tvmRowsForAlign = parseTask55L3TokenValidationMappingForAlignment(raw);
        const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
        const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
        const conflictCount = conflictRows.length;
        try {
          console.warn('[design-detail:task55-l3-gate]', {
            caseId: rawId,
            tvmRows: tvmRowsForAlign.length,
            potentialConflictCount: conflictCount,
            allowTask6Kickoff: !hasUnresolvedTvmConflict,
          });
        } catch {
          /* ignore */
        }
        withTask55L3DynamicsCard((card) => {
          appendLineToCard(
            card,
            `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
              hasUnresolvedTvmConflict
                ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 6`
                : 'Consistency 均已消解或已确认为痛点，可进入任务 6'
            }`,
            'scope_green',
            { startFullyRevealed: true },
          );
        }, rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
        if (!hasUnresolvedTvmConflict) return true;

        pendingDebugPipelineContinueAction.value = null;
        if (!conflictCount) {
          withTask55L3DynamicsCard((card) => {
            appendLineToCard(
              card,
              '→ 门禁判定存在未消解校验，但冲突清单为空；请查看控制台 [design-detail:task55-l3-gate]',
              'default',
              { startFullyRevealed: true },
            );
          }, rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          return false;
        }
        const conflictBlock = buildTask55L3ConflictDatasetUserBlock(conflictRows);
        stashAlignmentPainTargetsForLineTask(rawId, 'vsm_stage_decomposition', conflictRows);
        if (pipelineOpts?.deferAlignmentQuestionnaire) {
          deferredAlignmentQuestionnaireJob.value = {
            caseId: rawId,
            lineTaskId: 'vsm_stage_decomposition',
            epochAtStart,
            conflictDatasetUserBlock: conflictBlock,
            tier: 'task55',
          };
          await flushPersistDesignDetailProgressWorkspace(rawId);
          return false;
        }
        await appendTask55L3AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
        return false;
      }

      let allowTask6Kickoff = false;
      if (allowTask55SyncOk && l3VsmRaw) {
        allowTask6Kickoff = await runTask55L3TvmGateAndMaybeAlignmentQuestionnaire(_opts);
        if (designDetailSessionGeneration !== epochAtStart) return;
      }

      if (l3VsmRaw) {
        removeTask55L3LlmWorkingSpinnerLine(rawId);
        withTask55L3DynamicsCard((card) => {
          if (allowTask55SyncOk && allowTask6Kickoff) {
            card.status = 'completed';
            card.completedAtMs = Date.now();
            card.completionQueued = true;
          } else if (allowTask55SyncOk && !allowTask6Kickoff) {
            card.status = 'running';
            card.completedAtMs = null;
            card.completionQueued = false;
          } else {
            card.status = 'completed';
            card.completedAtMs = Date.now();
            appendLineToCard(
              card,
              '→ 任务 5.5 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
              'default',
              { startFullyRevealed: true },
            );
          }
        }, rawId);
      }
      const task55Done = !!(allowTask55SyncOk && l3VsmRaw && allowTask6Kickoff);
      saveDesignDetailLineState(rawId, {
        schemaVersion: 1,
        currentTaskId: task55Done ? 'pain_point_extraction' : 'vsm_stage_decomposition',
        holdPastTask3: false,
        holdPastTask4: false,
        holdPastTask5: false,
        holdPastTask51: true,
        holdPastTask55: task55Done,
        holdPastTask6: false,
      });
      if (task55Done) {
        if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_6)) {
          await scheduleDebugContinueAfterTask55L3SegmentIfReady(rawId, mergedItem);
        } else {
          await runTask6L3ScenarioPipeline(rawId, epochAtStart, llmAbort, mergedItem, _opts);
        }
      }
      if (mergedItem) {
        reconcileDesignDetailLineTaskId(
          rawId,
          mergedItem,
          lastHydratedMessages.value,
          task1CustomerRequirementPhase.value,
        );
      }
      const stT55 = loadDesignDetailLineState(rawId);
      if (stT55?.currentTaskId) currentDesignLineTaskId.value = stT55.currentTaskId;
      await flushPersistDesignDetailProgressWorkspace(rawId);
    } catch (e) {
      if (designDetailSessionGeneration !== epochAtStart) return;
      removeTask55L3LlmWorkingSpinnerLine(rawId);
      removeTask55L3SyncSpinnerLine(rawId);
      withTask55L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ 任务 5.5 推理失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    }
  }

  /**
   * 任务 6：按 5.5 价值流阶段循环关键场景推理；落库成功后 `holdPastTask6`。
   */
  async function runTask6L3ScenarioPipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) {
      withTask6L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          '→ 任务 6 推理已中止（页面会话已重置，请对本线步「重启当前」重跑）',
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }
    await awaitUsageModePriorLineTaskDisplayComplete('pain_point_extraction');
    await runTask6L3ScenarioPipelineCore({
      pipelineOpts: _opts,
      designDetailSessionGeneration,
      epochAtStart,
      rawId,
      llmAbort,
      mergedItem,
      isOnlineMode,
      cloneDynamics,
      setDynamicsCards: (cards) => {
        dynamicsCards.value = cards;
      },
      appendLineToCard,
      flushPersistDesignDetailProgressWorkspace,
      withLlmAuditCtx,
      saveDesignDetailLineState,
      reconcileDesignDetailLineTaskId,
      loadDesignDetailLineState,
      setCurrentDesignLineTaskId: (id) => {
        currentDesignLineTaskId.value = id as DesignDetailLineTaskId;
      },
      lastHydratedMessages,
      task1CustomerRequirementPhase,
      logicTreeGraphRefreshTick,
      exitTask6PipelineIfSessionStale: (rid, epoch) => designDetailSessionGeneration !== epoch,
      withTask6L3DynamicsCard,
      removeTask6L3SyncSpinnerLine,
      waitUntilDynamicsFullyRevealed,
      stashAlignmentPainTargetsForLineTask,
      deferredAlignmentQuestionnaireJob,
      pendingDebugPipelineContinueAction,
      appendTask6L3AlignmentQuestionnaireFromConflict,
      designDetailDebugGate,
      DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE,
      DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_65,
      scheduleDebugContinueAfterTask6L3SegmentIfReady,
      runTask65ItGapPipeline,
      pickTask6TokensFeaturesFromGraphTasks,
      formatTask5FeatureKvDebugLine,
      pushTask6PhaseDebugProgressSerial,
      onTask6CurrentStateCanvasRefresh: (rid) => refreshCurrentStateUnderstandingFromTaskGraph(rid),
    });
  }

  /**
   * 任务 6.5：按「价值流阶段-流程环节」循环三维 IT-Gap 分析；落库成功后 `holdPastTask65`。
   */
  async function runTask65ItGapPipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) {
      withTask65L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          '→ 任务 6.5 推理已中止（页面会话已重置，请对本线步「重启当前」重跑）',
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }
    await awaitUsageModePriorLineTaskDisplayComplete('three_dimension_itgap_analysis');
    await runTask65ItGapPipelineCore({
      pipelineOpts: _opts,
      designDetailSessionGeneration,
      epochAtStart,
      rawId,
      llmAbort,
      mergedItem,
      isOnlineMode,
      cloneDynamics,
      setDynamicsCards: (cards) => {
        dynamicsCards.value = cards;
      },
      appendLineToCard,
      flushPersistDesignDetailProgressWorkspace,
      withLlmAuditCtx,
      saveDesignDetailLineState,
      reconcileDesignDetailLineTaskId,
      loadDesignDetailLineState,
      setCurrentDesignLineTaskId: (id) => {
        currentDesignLineTaskId.value = id as DesignDetailLineTaskId;
      },
      lastHydratedMessages,
      task1CustomerRequirementPhase,
      logicTreeGraphRefreshTick,
      exitTask65PipelineIfSessionStale: (rid, epoch) => designDetailSessionGeneration !== epoch,
      withTask65L3DynamicsCard,
      removeTask65L3SyncSpinnerLine,
      waitUntilDynamicsFullyRevealed,
      stashAlignmentPainTargetsForLineTask,
      deferredAlignmentQuestionnaireJob,
      pendingDebugPipelineContinueAction,
      appendTask65SubtaskAlignmentQuestionnaireFromConflict,
      designDetailDebugGate,
      DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE,
      DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_7,
      scheduleDebugContinueAfterTask65SegmentIfReady,
      runTask7L4CollaborationPipeline,
      pickTask6TokensFeaturesFromGraphTasks,
      formatTask5FeatureKvDebugLine,
      pushTask65StepDebugProgressSerial,
      onTask65DiagnosticReviewCanvasStart: () => {
        startTask65DiagnosticReviewCanvas();
        queuePersistDesignDetailProgressWorkspace();
      },
      onTask65SubtaskItGapCanvasUpdate: (_rid, sub, stepRaw) => {
        applyTask65SubtaskDiagnosticReviewCanvas(sub, stepRaw);
        queuePersistDesignDetailProgressWorkspace();
      },
    });
  }

  /**
   * 任务 7 L4：按「价值流阶段-流程环节」循环多栈工具选型；落库成功后 `holdPastTask7`。
   */
  async function runTask7L4CollaborationPipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    const stBeforeT7 = loadDesignDetailLineState(rawId);
    if (stBeforeT7?.holdPastTask6 === true && stBeforeT7.holdPastTask65 !== true) {
      await runTask65ItGapPipeline(rawId, epochAtStart, llmAbort, mergedItem, _opts);
      return;
    }
    await awaitUsageModePriorLineTaskDisplayComplete('key_requirement_scenarios');
    await runTask7L4CollaborationPipelineCore({
      pipelineOpts: _opts,
      designDetailSessionGeneration,
      epochAtStart,
      rawId,
      llmAbort,
      mergedItem,
      isOnlineMode,
      cloneDynamics,
      setDynamicsCards: (cards) => {
        dynamicsCards.value = cards as typeof dynamicsCards.value;
      },
      appendLineToCard,
      flushPersistDesignDetailProgressWorkspace,
      withLlmAuditCtx,
      saveDesignDetailLineState,
      reconcileDesignDetailLineTaskId,
      loadDesignDetailLineState,
      setCurrentDesignLineTaskId: (id) => {
        currentDesignLineTaskId.value = id as DesignDetailLineTaskId;
      },
      lastHydratedMessages,
      task1CustomerRequirementPhase,
      logicTreeGraphRefreshTick,
      exitTask7PipelineIfSessionStale: (rid, epoch) => designDetailSessionGeneration !== epoch,
      withTask7L4DynamicsCard,
      removeTask7L4SyncSpinnerLine,
      pushFeatureInferenceConclusionsAfterSync,
      normalizeLogicGraphTasksFromApiPayload,
      pickTask1Task2FeaturesFromGraphTasks,
      readTask7L4DeepInsightText,
      readTask7L4UserRectificationText,
      stashAlignmentPainTargetsForLineTask,
      deferredAlignmentQuestionnaireJob,
      appendTask7L4AlignmentQuestionnaireFromConflict,
      designDetailDebugGate,
      DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE,
      DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_8,
      scheduleDebugContinueAfterTask7L4SegmentIfReady,
      runTask8L45PrototypePipeline,
      pickTask7TokensFeaturesFromGraphTasks,
      formatTask5FeatureKvDebugLine,
      pushTask7SubtaskProgressAfterInference,
      isDesignDetailDebugExperienceActive,
    });
  }

  /**
   * 任务 8 L4.5：角色、对象与状态转移矩阵；Input 1=任务 7 协作节点、Input 2=任务 0 工具原语、Input 3=任务 1~3；落库前 sync 任务 0 原语；落库成功后 `holdPastTask8`。
   */
  async function runTask8L45PrototypePipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    await awaitUsageModePriorLineTaskDisplayComplete('role_object_stm_inference');

    const w = window as unknown as {
      inferDesignDetailL4PrototypeFromContext?: (
        p: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{ rawOutput?: string; content?: string }>;
    };
    if (typeof w.inferDesignDetailL4PrototypeFromContext !== 'function') {
      const c8b = cloneDynamics().find((c) => c.lineTaskId === 'role_object_stm_inference');
      if (c8b) {
        appendLineToCard(
          c8b,
          '→ 任务 8 推理失败：未加载 inferDesignDetailL4PrototypeFromContext（请确认已加载 designDetailL4PrototypeSystemPrompt.js）',
          'default',
          { startFullyRevealed: true },
        );
      }
      return;
    }

    let cards = cloneDynamics();
    let c8 = cards.find((c) => c.lineTaskId === 'role_object_stm_inference');
    if (!c8) {
      c8 = {
        key: `role_object_stm_inference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineTaskId: 'role_object_stm_inference',
        status: 'running',
        startedAtMs: Date.now(),
        completedAtMs: null,
        lines: [],
        extraTailConsumed: 0,
        completionQueued: false,
        thanksAppended: false,
      };
      cards = [...cards, c8];
      dynamicsCards.value = cards;
    }

    appendLineToCard(c8, TASK8_PROTOTYPE_START_LINE, 'scope_green', { startFullyRevealed: true });
    await flushPersistDesignDetailProgressWorkspace(rawId);

    const getGraph = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (id: string) => Promise<{
              ok?: boolean;
              data?: { tasks?: unknown[] };
            } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;

    let task7L4Features: Task2L1TaskGraphFeatureRow[] = [];
    let task1Features: Task2L1TaskGraphFeatureRow[] = [];
    let task1Through4Features: Task2L1TaskGraphFeatureRow[] = [];
    let mergedGraphForTask8: DesignDetailLogicGraphTaskDto[] | undefined;
    if (typeof getGraph === 'function') {
      try {
        const gr = await getGraph(rawId);
        if (gr?.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
          mergedGraphForTask8 = normalizeLogicGraphTasksFromApiPayload(
            gr.data.tasks as DesignDetailLogicGraphTaskDto[],
          );
          task7L4Features = pickTask7L4CollaborationFeaturesFromGraphTasks(gr.data.tasks);
          task1Features = pickTask1FeaturesFromGraphTasksForTask8(gr.data.tasks);
          task1Through4Features = pickTask1Through4FeaturesFromGraphTasks(gr.data.tasks);
        }
      } catch {
        /* 空图仍送模 */
      }
    }

    const upstreamForTask8 = mergedGraphForTask8?.length
      ? buildTask1PainPointConfirmedConsistencyMap(mergedGraphForTask8)
      : undefined;

    const task8InferenceUserBlock = buildTask8L45PrototypeInferenceUserBlock(
      task7L4Features,
      task1Features,
      task1Through4Features,
      readTask8L45DeepInsightText(rawId),
      readTask8L45UserRectificationText(rawId),
      upstreamForTask8,
    );

    let l4PrototypeRaw = '';
    withTask8L45DynamicsCard((card) => {
      appendLineToCard(card, TASK8_L45_LLM_WORKING_LINE, 'bmc_generating', {
        bmcGenUi: 'spinner',
        spinnerBlue: true,
        startFullyRevealed: true,
      });
    }, rawId);
    await flushPersistDesignDetailProgressWorkspace(rawId);

    try {
      const res = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: designLinePillLabel('role_object_stm_inference'),
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L4_PROTOTYPE,
        },
        () =>
          w.inferDesignDetailL4PrototypeFromContext!(
            { task8InferenceUserBlock },
            { signal: llmAbort.signal },
          ),
      );
      if (exitTask8PipelineIfSessionStale(rawId, epochAtStart)) return;

      removeTask8L45LlmWorkingSpinnerLine(rawId);
      l4PrototypeRaw = String(res.rawOutput || res.content || '').trim();
      withTask8L45DynamicsCard((card) => {
        appendLineToCard(card, TASK8_DEBUG_INFERENCE_DONE_LINE, 'default', { startFullyRevealed: true });
        appendLineToCard(
          card,
          truncateTask8L45DebugProgressText(l4PrototypeRaw || '（模型无输出）'),
          'task8_inference_sub',
          { startFullyRevealed: true },
        );
        appendLineToCard(card, TASK8_LOGIC_EXTRACT_LINE, 'scope_green', { startFullyRevealed: true });
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);

      let allowTask8SyncOk = false;
      if (isOnlineMode() && l4PrototypeRaw) {
        const postT8 = (
          window as unknown as {
            SmartCto?: {
              problemCaseApi?: {
                postDesignDetailSyncTask8L45PrototypeTargetKvTokens?: (
                  id: string,
                  body: Record<string, unknown>,
                ) => Promise<{ ok?: boolean; message?: string; status?: number } | null>;
              };
            };
          }
        ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask8L45PrototypeTargetKvTokens;
        if (typeof postT8 === 'function') {
          try {
            const normT8 = normalizeL4PrototypeInferenceRawForServerSync(l4PrototypeRaw);
            if (!normT8.ok) {
              removeTask8L45SyncSpinnerLine(rawId);
              withTask8L45DynamicsCard((card) => {
                appendLineToCard(card, `→ Target_KV 落库失败：${normT8.message}`, 'default', {
                  startFullyRevealed: true,
                });
              }, rawId);
            } else {
              withTask8L45DynamicsCard((card) => {
                appendLineToCard(card, TASK8_SYNC_TARGET_KV_LINE, 'bmc_generating', {
                  bmcGenUi: 'spinner',
                  spinnerBlue: true,
                  startFullyRevealed: true,
                });
              }, rawId);
              await flushPersistDesignDetailProgressWorkspace(rawId);
              let syncRes: { ok?: boolean; message?: string; status?: number } | null = null;
              try {
                syncRes = await postT8(
                  rawId,
                  mergeTargetKvSyncBodyWithAlignmentMeta(
                    { l3ProcessInferenceRaw: normT8.normalized },
                    buildTask8L45TargetKvSyncAlignmentMeta(rawId),
                  ),
                );
              } finally {
                removeTask8L45SyncSpinnerLine(rawId);
              }
              if (exitTask8PipelineIfSessionStale(rawId, epochAtStart)) return;
              if (syncRes?.ok === true) {
                allowTask8SyncOk = true;
                withTask8L45DynamicsCard((card) => {
                  appendLineToCard(card, TASK8_SYNC_TARGET_KV_OK_LINE, 'scope_green', {
                    startFullyRevealed: true,
                  });
                }, rawId);
                await flushPersistDesignDetailProgressWorkspace(rawId);
                if (typeof getGraph === 'function') {
                  const gr2 = await getGraph(rawId);
                  if (gr2?.ok === true && gr2.data && Array.isArray(gr2.data.tasks)) {
                    const mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                      gr2.data.tasks as DesignDetailLogicGraphTaskDto[],
                    );
                    await pushFeatureInferenceConclusionsAfterSync(
                      rawId,
                      'role_object_stm_inference',
                      mergedForProgress,
                      llmAbort.signal,
                    );
                    withTask8L45DynamicsCard((card) => {
                      appendLineToCard(card, '→ 任务 8：开始提炼正向归纳链接', 'scope_green', {
                        startFullyRevealed: true,
                      });
                      for (const ln of buildForwardInductionLinkUiLinesTask7(mergedForProgress)) {
                        appendLineToCard(card, ln, 'bmc_result_quote', { startFullyRevealed: true });
                      }
                      appendLineToCard(card, '→ 更新 tree 视图', 'scope_green', { startFullyRevealed: true });
                      appendLineToCard(card, TASK8_DEBUG_TOKEN_KV_LINE, 'default', {
                        startFullyRevealed: true,
                      });
                      const tf = pickTask8TokensFeaturesFromGraphTasks(gr2.data.tasks);
                      const tokenLines = tf.tokens
                        .map((row) => String(row.tokenId ?? '').trim())
                        .filter(Boolean)
                        .map((tid) => `任务 8-token-${tid}`);
                      appendLineToCard(
                        card,
                        tokenLines.length ? tokenLines.join('\n') : '（无 token）',
                        'task8_inference_sub',
                        { startFullyRevealed: true },
                      );
                      appendLineToCard(card, TASK8_DEBUG_FEATURE_KV_LINE, 'default', {
                        startFullyRevealed: true,
                      });
                      const featLines = tf.features.map((f) => formatTask5FeatureKvDebugLine(f));
                      appendLineToCard(
                        card,
                        featLines.length ? featLines.join('\n') : '（无 feature）',
                        'task8_inference_sub',
                        { startFullyRevealed: true },
                      );
                    }, rawId);
                    logicTreeGraphRefreshTick.value += 1;
                  }
                }
              } else {
                const hint =
                  syncRes && typeof syncRes.message === 'string' ? syncRes.message : '同步失败';
                withTask8L45DynamicsCard((card) => {
                  appendLineToCard(card, `→ Target_KV 落库失败：${hint}`, 'default', {
                    startFullyRevealed: true,
                  });
                  if (syncRes && syncRes.status === 404) {
                    appendLineToCard(
                      card,
                      '→ 多为监听端口上的后端仍是旧构建（未注册 sync-task8 路由）。请在 backend 执行 npm run build 后重启本地后端，再对本线步「重启当前」重跑。',
                      'default',
                      { startFullyRevealed: true },
                    );
                  }
                }, rawId);
              }
            }
          } catch (eKv) {
            removeTask8L45SyncSpinnerLine(rawId);
            withTask8L45DynamicsCard((card) => {
              appendLineToCard(
                card,
                `→ Target_KV 落库失败：${eKv instanceof Error ? eKv.message : String(eKv)}`,
                'default',
                { startFullyRevealed: true },
              );
            }, rawId);
          }
        }
      } else if (!isOnlineMode() && l4PrototypeRaw) {
        allowTask8SyncOk = true;
      }

      async function runTask8L45TvmGateAndMaybeAlignmentQuestionnaire(
        pipelineOpts?: DesignDetailPipelineRunOpts,
      ): Promise<boolean> {
        const raw = String(l4PrototypeRaw || '').trim();
        if (!raw) return false;
        const tvmRowsForAlign = parseTask8L45TokenValidationMappingForAlignment(raw);
        const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
        const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
        const conflictCount = conflictRows.length;
        withTask8L45DynamicsCard((card) => {
          appendLineToCard(
            card,
            `→ 反向验证校验｜Token_Validation_Mapping ${tvmRowsForAlign.length} 条｜${
              hasUnresolvedTvmConflict
                ? `存在 ${conflictCount} 处潜在冲突，需对齐确认后方可进入任务 8.5`
                : 'Consistency 均已消解，可进入任务 8.5'
            }`,
            'scope_green',
            { startFullyRevealed: true },
          );
        }, rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
        if (!hasUnresolvedTvmConflict) return true;
        if (!conflictCount) return false;
        const conflictBlock = buildTask8L45ConflictDatasetUserBlock(conflictRows);
        stashAlignmentPainTargetsForLineTask(rawId, 'role_object_stm_inference', conflictRows);
        if (pipelineOpts?.deferAlignmentQuestionnaire) {
          deferredAlignmentQuestionnaireJob.value = {
            caseId: rawId,
            lineTaskId: 'role_object_stm_inference',
            epochAtStart,
            conflictDatasetUserBlock: conflictBlock,
            tier: 'task8',
          };
          await flushPersistDesignDetailProgressWorkspace(rawId);
          return false;
        }
        await appendTask8L45AlignmentQuestionnaireFromConflict(rawId, epochAtStart, conflictBlock);
        return false;
      }

      let allowTask85Kickoff = false;
      if (allowTask8SyncOk && l4PrototypeRaw) {
        allowTask85Kickoff = await runTask8L45TvmGateAndMaybeAlignmentQuestionnaire(_opts);
        if (exitTask8PipelineIfSessionStale(rawId, epochAtStart)) return;
      }

      if (l4PrototypeRaw) {
        removeTask8L45LlmWorkingSpinnerLine(rawId);
        withTask8L45DynamicsCard((card) => {
          if (allowTask8SyncOk && allowTask85Kickoff) {
            card.status = 'completed';
            card.completedAtMs = Date.now();
            card.completionQueued = true;
          } else if (allowTask8SyncOk && !allowTask85Kickoff) {
            card.status = 'running';
            card.completedAtMs = null;
            card.completionQueued = false;
          } else {
            card.status = 'completed';
            card.completedAtMs = Date.now();
            appendLineToCard(
              card,
              '→ 任务 8 未收官（Target_KV 落库失败）；请修复后端后对本线步「重启当前」重跑',
              'default',
              { startFullyRevealed: true },
            );
          }
        }, rawId);
      }
      const task8Done = !!(allowTask8SyncOk && l4PrototypeRaw && allowTask85Kickoff);
      saveDesignDetailLineState(rawId, {
        schemaVersion: 1,
        currentTaskId: task8Done ? 'physical_hook_integration_inference' : 'role_object_stm_inference',
        holdPastTask3: false,
        holdPastTask4: false,
        holdPastTask5: false,
        holdPastTask55: true,
        holdPastTask6: true,
        holdPastTask7: true,
        holdPastTask8: task8Done,
        holdPastTask85: false,
        holdPastTask9: false,
      });
      if (mergedItem) {
        reconcileDesignDetailLineTaskId(
          rawId,
          mergedItem,
          lastHydratedMessages.value,
          task1CustomerRequirementPhase.value,
        );
      }
      const stT8 = loadDesignDetailLineState(rawId);
      if (stT8?.currentTaskId) currentDesignLineTaskId.value = stT8.currentTaskId;
      if (task8Done) {
        if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_85)) {
          await scheduleDebugContinueAfterTask8ToTask85IfReady(rawId, mergedItem);
        } else {
          await runTask85PhysicalHookPipelineImpl(rawId, epochAtStart, llmAbort, mergedItem, _opts);
        }
      }
      await flushPersistDesignDetailProgressWorkspace(rawId);
    } catch (e) {
      if (exitTask8PipelineIfSessionStale(rawId, epochAtStart)) return;
      removeTask8L45LlmWorkingSpinnerLine(rawId);
      removeTask8L45SyncSpinnerLine(rawId);
      withTask8L45DynamicsCard((card) => {
        appendLineToCard(
          card,
          `→ 任务 8 推理失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    }
  }

  async function runTask51ValuePropositionPipelineImpl(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    await awaitUsageModePriorLineTaskDisplayComplete('value_proposition_capability_units');
    await runTask51ValuePropositionPipeline({
      pipelineOpts: _opts,
      readTask51L3DeepInsightText,
      readTask51L3UserRectificationText,
      appendTask51L3AlignmentQuestionnaireFromConflict,
      stashAlignmentPainTargetsForLineTask,
      setDeferredAlignmentQuestionnaireJob: (job) => {
        deferredAlignmentQuestionnaireJob.value = job;
      },
      pickTask1Task2FeaturesFromGraphTasks,
      pickTask3FeaturesFromGraphTasks,
      pickTask4FeaturesFromGraphTasks,
      designDetailSessionGeneration,
      epochAtStart,
      rawId,
      llmAbort,
      mergedItem,
      isOnlineMode,
      cloneDynamics,
      setDynamicsCards: (cards) => {
        dynamicsCards.value = cards;
      },
      appendLineToCard,
      flushPersistDesignDetailProgressWorkspace,
      withLlmAuditCtx,
      saveDesignDetailLineState,
      reconcileDesignDetailLineTaskId,
      loadDesignDetailLineState,
      setCurrentDesignLineTaskId: (id) => {
        currentDesignLineTaskId.value = id as DesignDetailLineTaskId;
      },
      lastHydratedMessages,
      task1CustomerRequirementPhase,
      logicTreeGraphRefreshTick,
      exitTask51PipelineIfSessionStale: (rid, epoch) => designDetailSessionGeneration !== epoch,
      withTask51L3DynamicsCard,
      removeTask51L3LlmWorkingSpinnerLine,
      removeTask51L3SyncSpinnerLine,
      waitUntilDynamicsFullyRevealed,
      onTask51MatrixReady: (raw) => {
        applyTask51CurrentStateUnderstandingCanvas(raw);
        void flushPersistDesignDetailProgressWorkspace(rawId);
      },
      onTask51Done: async (rid, epoch, abort, item, opts) => {
        if (
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_52) &&
          !opts?.deferDebugContinue
        ) {
          await scheduleDebugContinueAfterTask51SegmentIfReady(rid, item);
          return;
        }
        await runTask52AssetFieldSetPipelineImpl(rid, epoch, abort, item, opts);
      },
    });
  }

  async function runTask52AssetFieldSetPipelineImpl(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) {
      withTask52L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          '→ 任务 5.2 推理已中止（页面会话已重置，请对本线步「重启当前」重跑）',
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }
    await awaitUsageModePriorLineTaskDisplayComplete('capability_field_set_mapping');
    await runTask52AssetFieldSetPipeline({
      pipelineOpts: _opts,
      stashAlignmentPainTargetsForLineTask,
      designDetailSessionGeneration,
      epochAtStart,
      rawId,
      llmAbort,
      mergedItem,
      isOnlineMode,
      cloneDynamics,
      setDynamicsCards: (cards) => {
        dynamicsCards.value = cards;
      },
      appendLineToCard,
      flushPersistDesignDetailProgressWorkspace,
      withLlmAuditCtx,
      saveDesignDetailLineState,
      reconcileDesignDetailLineTaskId,
      loadDesignDetailLineState,
      setCurrentDesignLineTaskId: (id) => {
        currentDesignLineTaskId.value = id as DesignDetailLineTaskId;
      },
      lastHydratedMessages,
      task1CustomerRequirementPhase,
      logicTreeGraphRefreshTick,
      exitTask52PipelineIfSessionStale: (rid, epoch) => designDetailSessionGeneration !== epoch,
      withTask52L3DynamicsCard,
      removeTask52L3LlmWorkingSpinnerLine,
      removeTask52L3SyncSpinnerLine,
      waitUntilDynamicsFullyRevealed,
      pushTask52TableDebugProgressSerial,
      pickTask1Task2FeaturesFromGraphTasks,
      onTask52CurrentStateCanvasRefresh: (rid) => refreshCurrentStateUnderstandingFromTaskGraph(rid),
      onTask52Done: async (rid, epoch, abort, item, opts) => {
        if (
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_53) &&
          !opts?.deferDebugContinue
        ) {
          await scheduleDebugContinueAfterTask52SegmentIfReady(rid, item);
          return;
        }
        await runTask53WorkflowFlowPipelineImpl(rid, epoch, abort, item, opts);
      },
    });
  }

  async function runTask53WorkflowFlowPipelineImpl(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) {
      withTask53L3DynamicsCard((card) => {
        appendLineToCard(
          card,
          '→ 任务 5.3 推理已中止（页面会话已重置，请对本线步「重启当前」重跑）',
          'default',
          { startFullyRevealed: true },
        );
      }, rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      return;
    }
    await awaitUsageModePriorLineTaskDisplayComplete('key_scenario_temporal_flow_inference');
    await runTask53WorkflowFlowPipeline({
      pipelineOpts: _opts,
      stashAlignmentPainTargetsForLineTask,
      designDetailSessionGeneration,
      epochAtStart,
      rawId,
      llmAbort,
      mergedItem,
      isOnlineMode,
      cloneDynamics,
      setDynamicsCards: (cards) => {
        dynamicsCards.value = cards;
      },
      appendLineToCard,
      flushPersistDesignDetailProgressWorkspace,
      withLlmAuditCtx,
      saveDesignDetailLineState,
      reconcileDesignDetailLineTaskId,
      loadDesignDetailLineState,
      setCurrentDesignLineTaskId: (id) => {
        currentDesignLineTaskId.value = id as DesignDetailLineTaskId;
      },
      lastHydratedMessages,
      task1CustomerRequirementPhase,
      logicTreeGraphRefreshTick,
      exitTask53PipelineIfSessionStale: (rid, epoch) => designDetailSessionGeneration !== epoch,
      withTask53L3DynamicsCard,
      removeTask53L3LlmWorkingSpinnerLine,
      removeTask53L3SyncSpinnerLine,
      waitUntilDynamicsFullyRevealed,
      pickTask1Task2FeaturesFromGraphTasks,
      pushTask53ProcessDebugProgressSerial,
      pushTask53ProcessForwardLinkDebugProgressSerial,
      onTask53CurrentStateCanvasRefresh: (rid) => refreshCurrentStateUnderstandingFromTaskGraph(rid),
      onTask53Done: async (rid, epoch, abort, item, opts) => {
        if (
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_55) &&
          !opts?.deferDebugContinue
        ) {
          await scheduleDebugContinueAfterTask53SegmentIfReady(rid, item);
          return;
        }
        await runTask55L3VsmStagePipeline(rid, epoch, abort, item, opts);
      },
    });
  }

  async function runTask85PhysicalHookPipelineImpl(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    await awaitUsageModePriorLineTaskDisplayComplete('physical_hook_integration_inference');
    await runTask85PhysicalHookPipeline({
      pipelineOpts: _opts,
      readTask85L475DeepInsightText,
      readTask85L475UserRectificationText,
      appendTask85L475AlignmentQuestionnaireFromConflict,
      stashAlignmentPainTargetsForLineTask,
      setDeferredAlignmentQuestionnaireJob: (job) => {
        deferredAlignmentQuestionnaireJob.value = job;
      },
      designDetailSessionGeneration,
      epochAtStart,
      rawId,
      llmAbort,
      mergedItem,
      isOnlineMode,
      cloneDynamics,
      setDynamicsCards: (cards) => {
        dynamicsCards.value = cards;
      },
      appendLineToCard,
      flushPersistDesignDetailProgressWorkspace,
      withLlmAuditCtx,
      saveDesignDetailLineState,
      reconcileDesignDetailLineTaskId,
      loadDesignDetailLineState,
      setCurrentDesignLineTaskId: (id) => {
        currentDesignLineTaskId.value = id as DesignDetailLineTaskId;
      },
      lastHydratedMessages,
      task1CustomerRequirementPhase,
      logicTreeGraphRefreshTick,
      exitTask85PipelineIfSessionStale,
      withTask85DynamicsCard,
      removeTask85LlmWorkingSpinnerLine,
      removeTask85SyncSpinnerLine,
      waitUntilDynamicsFullyRevealed,
      onTask85Done: async (rid, epoch, abort, item) => {
        if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_9)) {
          await scheduleDebugContinueAfterTask85ToTask9IfReady(rid, item);
        } else {
          await runTask9L5BlueprintPipeline(rid, epoch, abort, item, _opts);
        }
      },
    });
  }

  async function runTask9L5BlueprintPipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    await awaitUsageModePriorLineTaskDisplayComplete('business_capability_positioning');
    await runTask9L5BlueprintPipelineImpl({
      pipelineOpts: _opts,
      readTask9L5DeepInsightText,
      readTask9L5UserRectificationText,
      appendTask9L5AlignmentQuestionnaireFromConflict,
      stashAlignmentPainTargetsForLineTask,
      setDeferredAlignmentQuestionnaireJob: (job) => {
        deferredAlignmentQuestionnaireJob.value = job;
      },
      designDetailSessionGeneration,
      epochAtStart,
      rawId,
      llmAbort,
      mergedItem,
      isOnlineMode,
      cloneDynamics,
      setDynamicsCards: (cards) => {
        dynamicsCards.value = cards;
      },
      appendLineToCard,
      flushPersistDesignDetailProgressWorkspace,
      readTask5L3UserRectificationText,
      withLlmAuditCtx,
      saveDesignDetailLineState,
      reconcileDesignDetailLineTaskId,
      loadDesignDetailLineState,
      setCurrentDesignLineTaskId: (id) => {
        currentDesignLineTaskId.value = id as DesignDetailLineTaskId;
      },
      lastHydratedMessages,
      task1CustomerRequirementPhase,
      logicTreeGraphRefreshTick,
      exitTask9PipelineIfSessionStale,
      withTask9L5DynamicsCard,
      removeTask9L5LlmWorkingSpinnerLine,
      removeTask9L5SyncSpinnerLine,
      waitUntilDynamicsFullyRevealed,
      onTask9Done: async (rid, epoch, abort, item) => {
        if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10)) {
          await scheduleDebugContinueAfterTask9ToTask10IfReady(rid, item, {
            forceAfterTask9Success: true,
          });
        } else {
          await runTask10L5TechnicalDdlPipeline(rid, epoch, abort, item, _opts);
        }
      },
    });
  }

  async function runTask10L5TechnicalDdlPipeline(
    rawId: string,
    epochAtStart: number,
    llmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    _opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (designDetailSessionGeneration !== epochAtStart) return;
    await awaitUsageModePriorLineTaskDisplayComplete('process_type_derivation');
    await runTask10L5TechnicalDdlPipelineImpl({
      pipelineOpts: _opts,
      readTask10L5DeepInsightText,
      readTask10L5UserRectificationText,
      appendTask10L5AlignmentQuestionnaireFromConflict,
      stashAlignmentPainTargetsForLineTask,
      setDeferredAlignmentQuestionnaireJob: (job) => {
        deferredAlignmentQuestionnaireJob.value = job;
      },
      designDetailSessionGeneration,
      epochAtStart,
      rawId,
      llmAbort,
      mergedItem,
      isOnlineMode,
      cloneDynamics,
      setDynamicsCards: (cards) => {
        dynamicsCards.value = cards;
      },
      appendLineToCard,
      flushPersistDesignDetailProgressWorkspace,
      withLlmAuditCtx,
      saveDesignDetailLineState,
      reconcileDesignDetailLineTaskId,
      loadDesignDetailLineState,
      setCurrentDesignLineTaskId: (id) => {
        currentDesignLineTaskId.value = id as DesignDetailLineTaskId;
      },
      lastHydratedMessages,
      task1CustomerRequirementPhase,
      logicTreeGraphRefreshTick,
      exitTask10PipelineIfSessionStale,
      withTask10DynamicsCard: withTask10L5DynamicsCard,
      removeTask10LlmWorkingSpinnerLine,
      removeTask10SyncSpinnerLine,
      waitUntilDynamicsFullyRevealed,
      onTask10Done: async (rid) => {
        logTask10ArchGate('on_task10_done_enter', { caseId: rid });
        if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_11)) {
          await scheduleDebugContinueAfterTask10ToTask11IfReady(rid, {
            forceAfterTask10Success: true,
          });
        } else {
          logTask10ArchGate('on_task10_done_direct_task11', { caseId: rid });
          await runTask11AnalysisReportThenMaybeTask12(rid);
        }
      },
    });
  }

  /** 任务 2 L1：拉推理图 → 进度区 → 调用大模型 → online 落库 Target_KV（与「补充需求→否」提取为共用，供「重启当前」重开任务 2） */
  /** 任务 2 L1 前：将合并需求中的痛点雷达/核心痛点总结同步入推理图，确保 Input 2 含最新 FeatureID */
  async function ensureTask1PainPointRadarGraphSyncedBeforeTask2L1(
    rawId: string,
    mergedItem: Record<string, unknown> | null,
  ): Promise<void> {
    if (!isOnlineMode() || !mergedItem) return;
    const requirementParsed = mergedRequirementParsedOverride.value;
    if (!requirementParsed || typeof requirementParsed !== 'object') return;
    const summary =
      typeof requirementParsed.corePainPointSummary === 'string'
        ? requirementParsed.corePainPointSummary.trim()
        : '';
    const radar = requirementParsed.painPointRadar;
    const hasRadar = Array.isArray(radar) && radar.length > 0;
    if (!summary && !hasRadar) return;
    const caseIdForApi = getCaseIdForBackend(mergedItem);
    if (!caseIdForApi) return;
    const postSection = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            postDesignDetailSyncCustomerReqSectionGraph?: (
              cid: string,
              body: { sectionKey: string; requirementParsed: Record<string, unknown> },
            ) => Promise<{ ok?: boolean; message?: string }>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.postDesignDetailSyncCustomerReqSectionGraph;
    if (typeof postSection !== 'function') return;
    try {
      const res = await postSection(caseIdForApi, {
        sectionKey: 'painPointRadar',
        requirementParsed,
      });
      if (!res?.ok) {
        console.warn('[design-detail:task2-l1-pain-radar-sync]', {
          caseId: rawId,
          ok: false,
          message: typeof res?.message === 'string' ? res.message : undefined,
        });
      }
    } catch (e) {
      console.warn('[design-detail:task2-l1-pain-radar-sync]', {
        caseId: rawId,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function runTask2L1EntityPortraitPipeline(
    rawId: string,
    epochAtStart: number,
    task2LlmAbort: AbortController,
    mergedItem: Record<string, unknown> | null,
    opts?: DesignDetailPipelineRunOpts,
  ): Promise<void> {
    if (!mergedItem) {
      let cardsErr = cloneDynamics();
      const c2e = cardsErr.find((c) => c.lineTaskId === 'scale_org_mode_extract');
      if (c2e) {
        const spinIdx = findLastProgressLineIndex(
          c2e.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK2_L1_ENTITY_LLM_WORKING_LINE,
        );
        if (spinIdx >= 0) c2e.lines.splice(spinIdx, 1);
        appendLineToCard(c2e, '→ 推理中止：案例数据未加载', 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsErr;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      void runHydrationCycle();
      return;
    }

    await awaitUsageModePriorLineTaskDisplayComplete('scale_org_mode_extract');

    const w = window as unknown as {
      inferDesignDetailL1EntityPortraitFromContext?: (
        p: Record<string, unknown>,
        fetchOpts?: { signal?: AbortSignal },
      ) => Promise<{
        rawOutput?: string;
        content?: string;
        usage?: Record<string, unknown>;
        model?: string;
        durationMs?: number;
      }>;
    };
    if (typeof w.inferDesignDetailL1EntityPortraitFromContext !== 'function') {
      let cardsScr = cloneDynamics();
      const c2s = cardsScr.find((c) => c.lineTaskId === 'scale_org_mode_extract');
      if (c2s) {
        const spinIdx = findLastProgressLineIndex(
          c2s.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK2_L1_ENTITY_LLM_WORKING_LINE,
        );
        if (spinIdx >= 0) c2s.lines.splice(spinIdx, 1);
        appendLineToCard(
          c2s,
          '→ 推理失败：未加载 task1BusinessInsight（inferDesignDetailL1EntityPortraitFromContext）',
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cardsScr;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      void runHydrationCycle();
      return;
    }

    let task2InferenceUserBlock = buildTask2L1InferenceUserBlock(
      [],
      readTask2L1DeepInsightText(rawId),
      readTask2L1UserRectificationText(rawId),
    );
    await ensureTask1PainPointRadarGraphSyncedBeforeTask2L1(rawId, mergedItem);

    let task2GraphFeatureRows: Task2L1TaskGraphFeatureRow[] = [];
    const getGraph = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (
              id: string,
            ) => Promise<{
              ok?: boolean;
              data?: { tasks?: Array<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }> };
              errorMessage?: string;
            }>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;
    let task2GraphWarn = '';
    if (typeof getGraph === 'function') {
      try {
        const gr = await getGraph(rawId);
        if (gr && gr.ok === true && gr.data && Array.isArray(gr.data.tasks)) {
          const t1 = gr.data.tasks.find((t) => String(t?.taskId || '').trim() === 'customer_basic');
          task2GraphFeatureRows = Array.isArray(t1?.features) ? t1!.features! : [];
          task2InferenceUserBlock = buildTask2L1InferenceUserBlock(
            task2GraphFeatureRows,
            readTask2L1DeepInsightText(rawId),
            readTask2L1UserRectificationText(rawId),
          );
        } else {
          const em =
            gr && typeof (gr as { errorMessage?: string }).errorMessage === 'string'
              ? String((gr as { errorMessage: string }).errorMessage).trim()
              : '未知原因';
          task2GraphWarn = em ? `推理图拉取失败（${em}），将以空特征列表继续推理` : '推理图拉取失败，将以空特征列表继续推理';
        }
      } catch (eg) {
        task2GraphWarn = `推理图拉取异常：${eg instanceof Error ? eg.message : String(eg)}`;
      }
    } else {
      task2GraphWarn = '未加载 getDesignDetailTaskGraph，任务 2 输入为空';
    }

    let cardsInput = cloneDynamics();
    const c2i = cardsInput.find((c) => c.lineTaskId === 'scale_org_mode_extract');
    if (c2i) {
      if (task2GraphWarn) {
        appendLineToCard(c2i, `→ ${task2GraphWarn}`, 'default', { startFullyRevealed: true });
      }
      const task2ProgressDebugBlock = truncateTask2L1InferenceBlockForProgress(
        buildTask2L1InferenceProgressDebugText(task2GraphFeatureRows),
      );
      if (String(task2ProgressDebugBlock).trim()) {
        appendLineToCard(c2i, task2ProgressDebugBlock, 'bmc_result_quote', {
          revealRate: PROGRESS_REVEAL_RATE_DEBUG,
        });
      }
      appendLineToCard(c2i, TASK2_L1_ENTITY_LLM_WORKING_LINE, 'bmc_generating', {
        bmcGenUi: 'spinner',
        spinnerBlue: true,
        startFullyRevealed: true,
      });
    }
    dynamicsCards.value = cardsInput;
    ensureRevealTicker(rawId);
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
    await flushPersistDesignDetailProgressWorkspace(rawId);
    queuePersistDesignDetailProgressWorkspace();

    task2EntityPortraitBusy.value = true;
    try {
      const task2AuditId = designLinePillLabel('scale_org_mode_extract');
      const result = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: task2AuditId,
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_L1_ENTITY_PORTRAIT,
        },
        () =>
          w.inferDesignDetailL1EntityPortraitFromContext!(
            {
              task2InferenceUserBlock,
            },
            { signal: task2LlmAbort.signal },
          ),
      );
      let cardsOut = cloneDynamics();
      const c2b = cardsOut.find((c) => c.lineTaskId === 'scale_org_mode_extract');
      if (c2b) {
        removeTask2L1EntityLlmWorkingSpinnerLine(c2b);
        const out = String(result.rawOutput || result.content || '').trim();
        appendLineToCard(c2b, out || '（模型无输出）', 'bmc_result_quote', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsOut;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
      if (designDetailSessionGeneration !== epochAtStart) {
        return;
      }

      const outForSync = String(result.rawOutput || result.content || '').trim();
      const painPointInput2Rows = listTask2L1PainPointRadarInput2FeatureRows(task2GraphFeatureRows);
      const outForSyncEffective = outForSync
        ? mergeSupplementedPainPointTvmIntoL1InferenceRaw(outForSync, painPointInput2Rows)
        : outForSync;
      if (designDetailSessionGeneration !== epochAtStart) {
        return;
      }
      let cardsSync = cloneDynamics();
      const c2s = cardsSync.find((c) => c.lineTaskId === 'scale_org_mode_extract');
      if (c2s) {
        if (!outForSync) {
          appendLineToCard(c2s, '→ Feature_Key 落库跳过：模型无可用 JSON 输出', 'default', {
            startFullyRevealed: true,
          });
        } else {
          try {
            if (isOnlineMode()) {
              const postFn = (
                window as unknown as {
                  SmartCto?: {
                    problemCaseApi?: {
                      postDesignDetailSyncTask2L1TargetKvTokens?: (
                        id: string,
                        body: Record<string, unknown>,
                      ) => Promise<{
                        ok?: boolean;
                        data?: {
                          tokenCount?: number;
                          featureCount?: number;
                          linkCount?: number;
                        };
                        message?: string;
                      } | null>;
                    };
                  };
                }
              ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask2L1TargetKvTokens;
              if (typeof postFn === 'function') {
                appendLineToCard(c2s, TASK2_SYNC_TARGET_KV_LINE, 'default', { startFullyRevealed: true });
                const syncRes = await postFn(
                  rawId,
                  mergeTargetKvSyncBodyWithAlignmentMeta(
                    { l1InferenceRaw: outForSyncEffective },
                    buildTask2L1TargetKvSyncAlignmentMeta(rawId),
                  ),
                );
                try {
                  const sr = syncRes as { ok?: boolean; message?: string; data?: { tokenCount?: number; featureCount?: number; linkCount?: number } } | null;
                  console.warn('[design-detail:task2-l1-sync]', {
                    caseId: rawId,
                    ok: sr?.ok === true,
                    message: typeof sr?.message === 'string' ? sr.message : undefined,
                    tokenCount: sr?.ok === true ? sr.data?.tokenCount : undefined,
                    featureCount: sr?.ok === true ? sr.data?.featureCount : undefined,
                    linkCount: sr?.ok === true ? sr.data?.linkCount : undefined,
                    l1RawLen: outForSync.length,
                    l1RawHasTokenValidationKey: /Token_Validation_Mapping/i.test(outForSync),
                  });
                } catch {
                  /* ignore */
                }
                if (syncRes && syncRes.ok === true) {
                  /** 落库完成后：正向/反向逻辑链叙事 + Tree 刷新 tick，再可选 Evidence 调试行与统计行 */
                  let mergedForProgress: DesignDetailLogicGraphTaskDto[] = [];
                  if (typeof getGraph === 'function') {
                    try {
                      const grp = await getGraph(rawId);
                      if (grp && grp.ok === true && grp.data && Array.isArray(grp.data.tasks)) {
                        mergedForProgress = normalizeLogicGraphTasksFromApiPayload(
                          grp.data.tasks as DesignDetailLogicGraphTaskDto[],
                        );
                      }
                    } catch {
                      /* 推理图拉取失败时仍推占位明细行 */
                    }
                  }
                  await pushFeatureInferenceConclusionsAfterSync(
                    rawId,
                    'scale_org_mode_extract',
                    mergedForProgress,
                    task2LlmAbort.signal,
                    c2s,
                    cardsSync,
                  );
                  appendLineToCard(c2s, '→ 开始提炼正向归纳链接', 'default', { startFullyRevealed: true });
                  for (const ln of buildForwardInductionLinkUiLines(mergedForProgress)) {
                    appendLineToCard(c2s, ln, 'bmc_result_quote', { startFullyRevealed: true });
                  }
                  appendLineToCard(c2s, '→ 更新 tree 视图', 'default', { startFullyRevealed: true });
                  logicTreeGraphRefreshTick.value += 1;

                  appendLineToCard(c2s, '→ Token_Validation_Mapping：', 'default', { startFullyRevealed: true });
                  appendLineToCard(
                    c2s,
                    buildTask2L1TvmProgressSnippetWithPainPointCoverage(outForSync, task2GraphFeatureRows),
                    'token_validation_mapping_quote',
                    {
                      startFullyRevealed: true,
                    },
                  );

                  appendLineToCard(c2s, '→ 开始提炼反向验证链接', 'default', { startFullyRevealed: true });
                  for (const ln2 of buildReverseValidationLinkUiLines(mergedForProgress)) {
                    appendLineToCard(c2s, ln2, 'bmc_result_quote', { startFullyRevealed: true });
                  }
                  appendLineToCard(c2s, '→ 更新 tree 视图', 'default', { startFullyRevealed: true });
                  logicTreeGraphRefreshTick.value += 1;

                  for (const dbg of buildTask2PostSyncEvidenceInputDebugLines(task2GraphFeatureRows)) {
                    appendLineToCard(c2s, dbg, 'bmc_result_quote', { startFullyRevealed: true });
                  }
                  const d = syncRes.data;
                  const tc = typeof d?.tokenCount === 'number' ? d.tokenCount : 0;
                  const fc = typeof d?.featureCount === 'number' ? d.featureCount : 0;
                  const lc = typeof d?.linkCount === 'number' ? d.linkCount : 0;
                  appendLineToCard(
                    c2s,
                    `→ 推理结果已提炼｜token ${tc} 条、特征 ${fc} 个｜逻辑边 ${lc} 条`,
                    'default',
                    { startFullyRevealed: true },
                  );
                  let tvmRowsForAlign = parseTask2L1TokenValidationMappingWithPainPointCoverage(
                    outForSync,
                    task2GraphFeatureRows,
                  );
                  if (mergedForProgress.length) {
                    tvmRowsForAlign = applyPainPointConfirmedImmunityFromGraph(
                      tvmRowsForAlign,
                      mergedForProgress,
                    );
                  }
                  const hasUnresolvedTvmConflict = !task2L1AllValidationRowsResolved(tvmRowsForAlign);
                  if (hasUnresolvedTvmConflict) {
                    pendingDebugPipelineContinueAction.value = null;
                    const conflictRows = task2L1FilterPotentialConflictRows(tvmRowsForAlign);
                    const conflictBlock = buildTask2L1ConflictDatasetUserBlock(conflictRows);
                    stashAlignmentPainTargetsForLineTask(rawId, 'scale_org_mode_extract', conflictRows);
                    try {
                      console.warn('[design-detail:task2-l1-alignment]', {
                        caseId: rawId,
                        conflictRows: conflictRows.length,
                        tvmParsedTotal: tvmRowsForAlign.length,
                      });
                    } catch {
                      /* ignore */
                    }
                    if (opts?.deferAlignmentQuestionnaire) {
                      deferredAlignmentQuestionnaireJob.value = {
                        caseId: rawId,
                        lineTaskId: 'scale_org_mode_extract',
                        epochAtStart,
                        conflictDatasetUserBlock: conflictBlock,
                        tier: 'task2',
                      };
                      dynamicsCards.value = cardsSync;
                      ensureRevealTicker(rawId);
                      await flushPersistDesignDetailProgressWorkspace(rawId);
                    } else {
                      await appendTask2L1AlignmentQuestionnaireFromConflict(
                        rawId,
                        epochAtStart,
                        conflictBlock,
                      );
                    }
                  } else {
                    c2s.status = 'completed';
                    c2s.completedAtMs = Date.now();
                    c2s.completionQueued = true;
                    saveDesignDetailLineState(rawId, {
                      schemaVersion: 1,
                      currentTaskId: 'industry_business_profile_extract',
                    });
                    currentDesignLineTaskId.value = 'industry_business_profile_extract';
                    dynamicsCards.value = cardsSync;
                    ensureRevealTicker(rawId);
                    await flushPersistDesignDetailProgressWorkspace(rawId);
                    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && !opts?.deferDebugContinue) {
                      appendDebugContinueAtLineTaskEnd(rawId, 'scale_org_mode_extract', async () => {
                        const task3LlmAbort = takeDesignDetailLlmAbortController();
                        await runTask3L2IndustryBusinessPipeline(
                          rawId,
                          epochAtStart,
                          task3LlmAbort,
                          mergedItem,
                        );
                      });
                      /** 勿写回陈旧 `cardsSync`：`appendDebugContinueAtLineTaskEnd` 已 `cloneDynamics()` 追加门闩行 */
                      ensureRevealTicker(rawId);
                      await flushPersistDesignDetailProgressWorkspace(rawId);
                    } else if (!designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) {
                      const task3LlmAbort = takeDesignDetailLlmAbortController();
                      await runTask3L2IndustryBusinessPipeline(
                        rawId,
                        epochAtStart,
                        task3LlmAbort,
                        mergedItem,
                      );
                    }
                  }
                } else {
                  const hint =
                    syncRes && typeof (syncRes as { message?: string }).message === 'string'
                      ? (syncRes as { message: string }).message
                      : '同步失败';
                  appendLineToCard(c2s, `→ Feature_Key 落库失败：${hint}`, 'default', {
                    startFullyRevealed: true,
                  });
                }
              } else {
                appendLineToCard(
                  c2s,
                  '→ 未加载 postDesignDetailSyncTask2L1TargetKvTokens，跳过服务端 token 写入',
                  'default',
                  { startFullyRevealed: true },
                );
              }
            } else {
              appendLineToCard(c2s, '→ 离线模式：未将 Feature_Key 写入服务端', 'default', {
                startFullyRevealed: true,
              });
            }
          } catch (errSync) {
            const msgSync = errSync instanceof Error ? errSync.message : String(errSync);
            appendLineToCard(c2s, `→ Feature_Key 落库失败：${msgSync}`, 'default', {
              startFullyRevealed: true,
            });
          }
        }
        dynamicsCards.value = cloneDynamics();
        ensureRevealTicker(rawId);
        await flushPersistDesignDetailProgressWorkspace(rawId);
      }
    } catch (e) {
      if (designDetailSessionGeneration !== epochAtStart) {
        return;
      }
      let cardsE = cloneDynamics();
      const c2e = cardsE.find((c) => c.lineTaskId === 'scale_org_mode_extract');
      if (c2e) {
        removeTask2L1EntityLlmWorkingSpinnerLine(c2e);
        const aborted =
          (e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message))) ||
          (typeof e === 'object' &&
            e !== null &&
            'name' in e &&
            String((e as { name?: unknown }).name) === 'AbortError');
        appendLineToCard(
          c2e,
          aborted ? '→ 推理已取消（会话已重置）' : `→ 推理失败：${e instanceof Error ? e.message : String(e)}`,
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cardsE;
      ensureRevealTicker(rawId);
      await flushPersistDesignDetailProgressWorkspace(rawId);
    } finally {
      task2EntityPortraitBusy.value = false;
      const cardsFin = cloneDynamics();
      const c2fin = cardsFin.find((c) => c.lineTaskId === 'scale_org_mode_extract');
      if (removeTask2L1EntityLlmWorkingSpinnerLine(c2fin)) {
        dynamicsCards.value = cardsFin;
        ensureRevealTicker(rawId);
        void flushPersistDesignDetailProgressWorkspace(rawId);
      }
    }

    if (designDetailSessionGeneration === epochAtStart) {
      void runHydrationCycle();
    }
  }

  function cardHasTask1ScopePromptLine(card: DynamicsCardModel): boolean {
    return card.lines.some(
      (l) => l.full === TASK1_SCOPE_PROMPT_LINE || l.full === TASK1_SCOPE_PROMPT_LINE_LEGACY,
    );
  }

  /** 旧会话内存卡仅有「即将开始」行时，补写绿色引导行 */
  function ensureTask1ScopePromptLine(card: DynamicsCardModel): boolean {
    if (card.lineTaskId !== 'customer_basic') return false;
    if (cardHasTask1ScopePromptLine(card)) return false;
    if (!card.lines.some((l) => l.full.includes('我即将开始'))) return false;
    appendLineToCard(card, TASK1_SCOPE_PROMPT_LINE, 'scope_green');
    return true;
  }

  /**
   * 任务 1 未完成时保证左侧任务动态出现「即将开始」+ 绿色工商引导（tryRecover 空快照 / 抑制回放 / 空聊天指纹跳过后兜底）。
   */
  function ensureTask1StartupProgressUi(rawId: string) {
    const cid = String(rawId || '').trim();
    if (!cid) return;
    if (currentDesignLineTaskId.value === 'optional_toolbox_primitive') return;
    const item = lastResolvedItem.value ?? lastHydratedItem.value;
    const messages = lastHydratedMessages.value;
    if (!item || isTaskCompleted(item, TASK1_ID, messages as Array<Record<string, unknown>>)) return;

    const tsIdx = lastIndexOfTaskStart(messages as Array<Record<string, unknown>>, TASK1_ID);
    const tsRow = tsIdx >= 0 ? (messages[tsIdx] as { confirmed?: boolean } | null) : null;
    const instantReveal =
      !hasTaskStartNotificationRow(messages as Array<Record<string, unknown>>, TASK1_ID) ||
      !tsRow?.confirmed;
    const lineOpts = instantReveal ? ({ startFullyRevealed: true } as const) : undefined;

    let cards = cloneDynamics();
    let c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) {
      c1 = makeCard();
      if (instantReveal) {
        for (const row of c1.lines) {
          row.cursor = cpLen(row.full);
        }
      }
      dynamicsCards.value = cards.concat(c1);
      ensureRevealTicker(cid);
      return;
    }

    let changed = false;
    if (!c1.lines.some((l) => l.full.includes('我即将开始'))) {
      appendLineToCard(
        c1,
        `→ 我即将开始${designLineTaskDisplayName('customer_basic')} ...`,
        'default',
        lineOpts,
      );
      changed = true;
    }
    if (!cardHasTask1ScopePromptLine(c1)) {
      appendLineToCard(c1, TASK1_SCOPE_PROMPT_LINE, 'scope_green', lineOpts);
      changed = true;
    }
    if (changed) {
      dynamicsCards.value = cards;
      ensureRevealTicker(cid);
    } else if (c1.lines.some((r) => r.cursor < cpLen(r.full))) {
      ensureRevealTicker(cid);
    }
  }

  /** 历史 API：「接收到用户输入」+ 用户原文灰块；设计页 task1 主路径见 `appendTask1ExtractingCustomerBasicProgress` + JSON 灰块 */
  function appendTask1UserCapturedProgress(caseId: string, userText: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    appendLineToCard(c1, '→ 接收到用户输入', 'default');
    const body = String(userText || '').replace(/\r\n/g, '\n');
    appendLineToCard(c1, `「${body}`, 'user_quote');
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  /** task1：展示「正在提炼客户基本信息」+ 行尾蓝色环形动画（大模型返回前） */
  function appendTask1ExtractingCustomerBasicProgress(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    appendLineToCard(c1, TASK1_EXTRACTING_CUSTOMER_BASIC_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  /** 将提炼进度行的行尾动画由 spinner 换为绿色 ✓（随后追加 JSON 灰块） */
  function finalizeTask1ExtractingLineToCheck(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    const idx = c1
      ? findLastProgressLineIndex(
          c1.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK1_EXTRACTING_CUSTOMER_BASIC_LINE,
        )
      : -1;
    if (c1 && idx >= 0) c1.lines[idx]!.bmcGenUi = 'check';
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  /** 脚本未就绪等：移除「正在提炼」行（避免悬停 spinner） */
  function appendTask1DerivingLogicProgress(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    appendLineToCard(c1, TASK1_DERIVING_LOGIC_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function finalizeTask1DerivingLogicLineToCheck(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    const idx = c1
      ? findLastProgressLineIndex(
          c1.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK1_DERIVING_LOGIC_LINE,
        )
      : -1;
    if (c1 && idx >= 0) c1.lines[idx]!.bmcGenUi = 'check';
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function removeTask1DerivingLogicProgressLine(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    const idx = findLastProgressLineIndex(c1.lines, (l) => l.full === TASK1_DERIVING_LOGIC_LINE);
    if (idx >= 0) c1.lines.splice(idx, 1);
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function removeTask1ExtractingProgressLine(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    const idx = findLastProgressLineIndex(c1.lines, (l) => l.full === TASK1_EXTRACTING_CUSTOMER_BASIC_LINE);
    if (idx >= 0) c1.lines.splice(idx, 1);
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  /** 提炼成功后：「正在绘制客户基本信息画布」+ 行尾蓝色环 */
  /** 再次提炼前去掉上一次的「绘制画布」行，避免进度区堆叠 */
  function stripTask1CanvasDrawingProgressLines(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    c1.lines = c1.lines.filter(
      (l) => l.full !== TASK1_DRAWING_CUSTOMER_BASIC_CANVAS_LINE && l.full !== TASK1_DERIVING_LOGIC_LINE,
    );
    dynamicsCards.value = cards;
  }

  /** 再次走工商提炼前去掉「请输入用户需求 / 正在解析需求」行并重置本页阶段键 */
  function stripTask1CustomerRequirementUiLines(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    const sectionSync = collectCustomerRequirementSectionSyncLineTexts();
    c1.lines = c1.lines.filter(
      (l) =>
        l.full !== TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE &&
        l.full !== TASK1_PARSING_CUSTOMER_REQUIREMENT_LINE &&
        l.full !== TASK1_RENDERING_REQUIREMENT_CANVAS_LINE &&
        !sectionSync.has(l.full) &&
        !String(l.full || '').startsWith('→ 需求逻辑图同步失败'),
    );
    dynamicsCards.value = cards;
  }

  function appendTask1CanvasDrawingProgress(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    appendLineToCard(c1, TASK1_DRAWING_CUSTOMER_BASIC_CANVAS_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function finalizeTask1CanvasDrawingLineToCheck(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    const idx = c1
      ? findLastProgressLineIndex(
          c1.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK1_DRAWING_CUSTOMER_BASIC_CANVAS_LINE,
        )
      : -1;
    if (c1 && idx >= 0) c1.lines[idx]!.bmcGenUi = 'check';
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  /** task1：「正在解析需求」+ 行尾蓝色环 */
  function appendTask1ParsingCustomerRequirementProgress(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    appendLineToCard(c1, TASK1_PARSING_CUSTOMER_REQUIREMENT_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function finalizeTask1ParsingCustomerRequirementLineToCheck(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    const idx = c1
      ? findLastProgressLineIndex(
          c1.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK1_PARSING_CUSTOMER_REQUIREMENT_LINE,
        )
      : -1;
    if (c1 && idx >= 0) c1.lines[idx]!.bmcGenUi = 'check';
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function removeTask1ParsingCustomerRequirementProgressLine(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    const idx = findLastProgressLineIndex(c1.lines, (l) => l.full === TASK1_PARSING_CUSTOMER_REQUIREMENT_LINE);
    if (idx >= 0) c1.lines.splice(idx, 1);
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  /** task1：「正在渲染需求画布」+ 行尾蓝色环 */
  function appendTask1RenderingRequirementCanvasProgress(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    appendLineToCard(c1, TASK1_RENDERING_REQUIREMENT_CANVAS_LINE, 'bmc_generating', {
      bmcGenUi: 'spinner',
      spinnerBlue: true,
      startFullyRevealed: true,
    });
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function finalizeTask1RenderingRequirementCanvasLineToCheck(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    const idx = c1
      ? findLastProgressLineIndex(
          c1.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK1_RENDERING_REQUIREMENT_CANVAS_LINE,
        )
      : -1;
    if (c1 && idx >= 0) c1.lines[idx]!.bmcGenUi = 'check';
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function resetDesignCanvasWorkspace() {
    designCanvasTabs.value = [{ id: 'case_overview', label: '案例概览', kind: 'case_overview' }];
    activeDesignCanvasTabId.value = 'case_overview';
    task51L3MatrixRawOutput.value = '';
    currentStateUnderstandingRefreshTick.value = 0;
    diagnosticReviewStepCards.value = {};
    diagnosticReviewRefreshTick.value = 0;
    customerBasicCanvasRows.value = [];
    customerRequirementCanvasEntries.value = [];
    mergedRequirementActiveSubTabKey.value = CUSTOMER_REQUIREMENT_CANVAS_FIELDS[0]?.key ?? 'businessContext';
    mergedRequirementParsedOverride.value = null;
    lastMergedRequirementEntryCount.value = 0;
    mergedBaselinePreviewGen += 1;
    mergedRequirementBaselinePreview.value = null;
    if (mergedBaselinePreviewTimer) {
      clearTimeout(mergedBaselinePreviewTimer);
      mergedBaselinePreviewTimer = null;
    }
  }

  /** 「重启当前」保留任务 1 画布：从持久化聊天与 `basicInfo` 重建 Tab；**不**修改 `designDynamicsSuppressPersistedReplay`（否则轮询 hydrate 会全量 reconcile，线步易被拽回 `customer_basic`） */
  function rehydrateDesignCanvasTabsKeepTask1(
    rawId: string,
    item: Record<string, unknown>,
    messages: Array<Record<string, unknown>>,
  ) {
    const cid = String(rawId || '').trim();
    syncCustomerRequirementCanvasEntriesFromMessages(messages);
    const merged = mergeResolvedItemForDesign(item) || item;
    const bi = merged.basicInfo as Record<string, unknown> | undefined;
    if (bi && typeof bi === 'object' && !Array.isArray(bi) && Object.keys(bi).length > 0) {
      customerBasicCanvasRows.value = buildCustomerBasicCanvasRows(bi);
      const tabs = designCanvasTabs.value.slice();
      if (!tabs.some((t) => t.id === 'customer_basic')) {
        const ovIdx = tabs.findIndex((t) => t.id === 'case_overview');
        const insertAt = ovIdx >= 0 ? ovIdx + 1 : tabs.length;
        tabs.splice(insertAt, 0, { id: 'customer_basic', label: '客户基本信息', kind: 'customer_basic' });
      }
      designCanvasTabs.value = tabs;
    }
    if (customerRequirementCanvasEntries.value.length > 0) {
      ensureRequirementDistillTab();
      activeDesignCanvasTabId.value = REQUIREMENT_DISTILL_TAB_ID;
    } else if (customerBasicCanvasRows.value.length > 0) {
      const tabs = designCanvasTabs.value.slice();
      if (!tabs.some((t) => t.id === 'customer_basic')) {
        const ovIdx = tabs.findIndex((t) => t.id === 'case_overview');
        const insertAt = ovIdx >= 0 ? ovIdx + 1 : tabs.length;
        tabs.splice(insertAt, 0, { id: 'customer_basic', label: '客户基本信息', kind: 'customer_basic' });
      }
      designCanvasTabs.value = tabs;
      activeDesignCanvasTabId.value = 'customer_basic';
    } else {
      activeDesignCanvasTabId.value = 'case_overview';
    }
    if (cid) ensureRevealTicker(cid);
  }

  function applyDesignDetailProgressWorkspaceSnapshot(rawId: string, snap: DesignDetailProgressSnapshotV1) {
    const cid = String(rawId || '').trim();
    /** 快照里的 `task1CustomerRequirementPhase` 可能落后于 debounce 落库；用户点「是否继续补充需求 → 是」后已同步写入 localStorage `awaiting`，此处必须先读再合并，避免恢复快照时把阶段写回 `completed` 并覆盖 localStorage（表现为无「请输入用户需求」引导、交互像直接结束）。 */
    const customerReqPhaseFromStorage = cid ? loadDesignDetailCustomerRequirementPhase(cid) : 'idle';
    /** 快照可能滞后（如「重启当前」已把线步写回任务 2，远端 PUT 尚未带上）；与 localStorage 线步取较晚者，避免紫标回到任务 1 */
    const persistedLine = cid ? loadDesignDetailLineState(cid)?.currentTaskId : null;
    currentDesignLineTaskId.value =
      persistedLine != null
        ? pickLaterDesignLineTaskId(snap.currentDesignLineTaskId, persistedLine)
        : snap.currentDesignLineTaskId;
    designOnlyProgressTail.value = snap.designOnlyProgressTail.map((s) => String(s ?? ''));
    const snapDynLineCount = snap.dynamicsCards.reduce(
      (n, c) => n + (Array.isArray(c.lines) ? c.lines.length : 0),
      0,
    );
    const liveDynLineCount = dynamicsCards.value.reduce(
      (n, c) => n + (Array.isArray(c.lines) ? c.lines.length : 0),
      0,
    );
    const normalizeSnapDynamicsCards = (): DynamicsCardModel[] =>
      snap.dynamicsCards.map((c) => {
        const lines = c.lines
          .map((r) => {
            let full =
              r.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE_LEGACY
                ? TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE
                : r.full;
            if (c.lineTaskId === 'capability_field_set_mapping') {
              full = migrateTask52ProgressLineFull(full);
            }
            if (c.lineTaskId === 'key_scenario_temporal_flow_inference') {
              full = migrateTask53ProgressLineFull(full);
            }
            return { ...r, full };
          })
          .filter((r) => String(r.full ?? '').trim().length > 0);
        return { ...c, lines };
      }) as DynamicsCardModel[];

    /**
     * 消息指纹与快照一致时仍可能：本地刚追加进度行（如任务 3 TVM 门禁/问卷），debounce PUT 尚未到服务端；
     * 若远端快照总行数更多（旧会话残留）会整表覆盖本地，表现为 token/feature 调试行后流程卡住、无问卷。
     */
    if (snapDynLineCount === 0) {
      try {
        console.info('[design-detail:progress-ws]', {
          phase: 'apply_snapshot_skip_empty_dynamics',
          caseId: cid,
          liveDynLineCount,
        });
      } catch {
        /* ignore */
      }
    } else if (liveDynLineCount === 0) {
      dynamicsCards.value = migrateDesignDetailProgressLinesInDynamicsCards(normalizeSnapDynamicsCards());
    } else {
      const liveT0 = dynamicsCards.value.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
      const snapNorm = normalizeSnapDynamicsCards();
      const snapT0 = snapNorm.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
      const merged = mergeDynamicsCardsPreferRicherProgress(dynamicsCards.value, snapNorm);
      const mergedT0 = merged.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
      if (liveT0 && (snapT0 || mergedT0)) {
        const liveT0Lines = liveT0.lines.length;
        const mergedT0Lines = mergedT0?.lines.length ?? 0;
        const wouldRegressTask0 =
          liveT0.status === 'running' &&
          (mergedT0?.status === 'completed' ? false : mergedT0Lines < liveT0Lines) &&
          mergedT0Lines <= 2 &&
          liveT0Lines <= 2;
        if (wouldRegressTask0 || (liveT0.status === 'running' && mergedT0?.status === 'completed' && !liveT0.completionQueued)) {
          logDesignDetailHydrate('apply_snapshot_task0_regression_risk', {
            caseId: cid,
            liveT0Status: liveT0.status,
            mergedT0Status: mergedT0?.status,
            liveT0Lines,
            snapT0Lines: snapT0?.lines.length ?? 0,
            mergedT0Lines,
            snapDynLineCount,
            liveDynLineCount,
            pendingStreamAdvance,
            task0FinalizeInFlight,
            task0AutoAdvanceDone,
          });
        }
      }
      if (liveDynLineCount > snapDynLineCount) {
        try {
          console.info('[design-detail:progress-ws]', {
            phase: 'apply_snapshot_merge_prefer_richer_per_card',
            caseId: cid,
            liveDynLineCount,
            snapDynLineCount,
            mergedLineCount: merged.reduce((n, c) => n + c.lines.length, 0),
          });
        } catch {
          /* ignore */
        }
      }
      dynamicsCards.value = migrateDesignDetailProgressLinesInDynamicsCards(merged);
    }
    const st = customerReqPhaseFromStorage;
    const sp = snap.task1CustomerRequirementPhase;
    /** localStorage `awaiting`：用户刚点「继续补充 → 是」；快照若仍为 completed/idle/**paused** 均不得覆盖，否则阶段被写回 paused 时 `ensureCustomerRequirementAwaitingProgressUi` 直接 return，进度区仍留「是/否」且不发绿字引导。 */
    let resolvedCustomerReqPhase = sp;
    if (st === 'awaiting' && (sp === 'completed' || sp === 'idle' || sp === 'paused')) {
      resolvedCustomerReqPhase = 'awaiting';
    } else if (st === 'paused' && (sp === 'completed' || sp === 'idle')) {
      resolvedCustomerReqPhase = 'paused';
    }
    const snapSupplementRows = snap.dynamicsCards.reduce(
      (acc, c) => acc + c.lines.filter((l) => l.kind === 'requirement_supplement_prompt').length,
      0,
    );
    logSupplementYesDiag('apply_workspace_snapshot', {
      cid,
      phaseLocalStorage: st,
      phaseSnap: sp,
      phaseResolved: resolvedCustomerReqPhase,
      snapSupplementRows,
    });
    task1CustomerRequirementPhase.value = resolvedCustomerReqPhase;
    if (cid) saveDesignDetailCustomerRequirementPhase(cid, resolvedCustomerReqPhase);
    designCanvasTabs.value = snap.designCanvasTabs.map((t) => ({ ...t })) as DesignCanvasTab[];
    const activeTabRaw = String(snap.activeDesignCanvasTabId || '').trim();
    activeDesignCanvasTabId.value =
      activeTabRaw === 'data_architecture' ? ARCHITECTURE_INVENTORY_TAB_ID : activeTabRaw;
    customerBasicCanvasRows.value = snap.customerBasicCanvasRows.map((r) => ({ ...r }));
    const reqEntries = snap.customerRequirementCanvasEntries.map((e) => ({
      ...e,
      parsed: { ...e.parsed },
    }));
    reqEntries.sort((a, b) => String(b.isoTimestamp).localeCompare(String(a.isoTimestamp)));
    customerRequirementCanvasEntries.value = reqEntries;
    mergedRequirementActiveSubTabKey.value = snap.mergedRequirementActiveSubTabKey;
    mergedRequirementParsedOverride.value = snap.mergedRequirementParsedOverride
      ? (JSON.parse(JSON.stringify(snap.mergedRequirementParsedOverride)) as Record<string, unknown>)
      : null;
    lastMergedRequirementEntryCount.value = snap.mergedRequirementParsedOverride ? reqEntries.length : 0;
    if (snap.mergedRequirementParsedOverride) {
      mergedBaselinePreviewGen += 1;
      mergedRequirementBaselinePreview.value = null;
      if (mergedBaselinePreviewTimer) {
        clearTimeout(mergedBaselinePreviewTimer);
        mergedBaselinePreviewTimer = null;
      }
    } else if (reqEntries.length >= 2) {
      scheduleMergedRequirementBaselinePreviewRefresh();
    } else {
      mergedBaselinePreviewGen += 1;
      mergedRequirementBaselinePreview.value = null;
      if (mergedBaselinePreviewTimer) {
        clearTimeout(mergedBaselinePreviewTimer);
        mergedBaselinePreviewTimer = null;
      }
    }
    const snapT51Raw =
      typeof (snap as { task51L3MatrixRawOutput?: unknown }).task51L3MatrixRawOutput === 'string'
        ? String((snap as { task51L3MatrixRawOutput?: string }).task51L3MatrixRawOutput).trim()
        : '';
    let hydratedT51Raw = snapT51Raw;
    if (!hydratedT51Raw) {
      hydratedT51Raw = recoverTask51RawFromDynamicsInferenceSub(snap.dynamicsCards);
    }
    if (hydratedT51Raw) {
      task51L3MatrixRawOutput.value = hydratedT51Raw;
      currentStateUnderstandingRefreshTick.value += 1;
      void refreshCurrentStateUnderstandingFromTaskGraph(rawId);
      if (!designCanvasTabs.value.some((t) => t.kind === 'current_state_understanding')) {
        const tabs = designCanvasTabs.value.slice();
        const newTab: DesignCanvasTab = {
          id: CURRENT_STATE_UNDERSTANDING_TAB_ID,
          label: '现状理解',
          kind: 'current_state_understanding',
        };
        const reqIdx = tabs.findIndex((t) => t.kind === 'requirement_distill');
        if (reqIdx >= 0) {
          tabs.splice(reqIdx + 1, 0, newTab);
        } else {
          tabs.push(newTab);
        }
        designCanvasTabs.value = tabs;
      }
    } else {
      task51L3MatrixRawOutput.value = '';
    }
    const hydratedDrvSteps = parseDiagnosticReviewStepsSnapshot(
      (snap as { task65DiagnosticReviewSteps?: unknown }).task65DiagnosticReviewSteps,
    );
    if (Object.keys(hydratedDrvSteps).length) {
      diagnosticReviewStepCards.value = hydratedDrvSteps;
      diagnosticReviewRefreshTick.value += 1;
      if (!designCanvasTabs.value.some((t) => t.kind === 'diagnostic_review')) {
        ensureDiagnosticReviewTab(false);
      }
    } else if (!snap.designCanvasTabs.some((t) => t.kind === 'diagnostic_review')) {
      diagnosticReviewStepCards.value = {};
    }
    /** 快照常早于「重启当前」仍为 false；若用其覆盖本地 true，下一轮 hydrate 会 reconcile 把线步拽回任务 1。合并：任一为 true 则保持抑制，直至发送等路径显式置 false 并落库 */
    const liveSuppressReplay = designDynamicsSuppressPersistedReplay.value;
    designDynamicsSuppressPersistedReplay.value =
      !!snap.designDynamicsSuppressPersistedReplay || liveSuppressReplay;
    const prevLlmIdx = llmStatsIncludeFromMessageIndex.value;
    llmStatsIncludeFromMessageIndex.value = snap.llmStatsIncludeFromMessageIndex;
    logLlmStatsDiag('applyProgressWorkspaceSnapshot', {
      rawId: cid,
      llmStatsBefore: prevLlmIdx,
      llmStatsFromSnap: snap.llmStatsIncludeFromMessageIndex,
      suppressReplaySnap: snap.designDynamicsSuppressPersistedReplay,
      suppressReplayEffective: designDynamicsSuppressPersistedReplay.value,
      snapFingerprintLen: snap.messagesFingerprint.len,
      snapFingerprintLastId: snap.messagesFingerprint.lastId,
    });
    lastProgressTailFingerprint = snap.lastProgressTailFingerprint;
    designDetailChatDraft.value = snap.chatDraft;
    const preserveTask0ToTask1DebugGate =
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
      designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1) &&
      isTask0AwaitingDebugContinueToTask1();
    if (!preserveTask0ToTask1DebugGate) {
      pendingDebugPipelineContinueAction.value = null;
      dynamicsCards.value = stripDebugStepContinueFromDynamicsCards(dynamicsCards.value);
    } else if (!dynamicsCardsHaveDebugStepContinuePrompt()) {
      void scheduleDebugContinueAfterTask0IfReady(cid);
    }
    applyLeftPanelUiFromSnapshot(snap.leftPanelUi);
    syncAlignmentPendingStatesFromPersisted(cid);
    if (cid) ensureRevealTicker(cid);
  }

  async function tryRecoverDesignDetailProgressWorkspace(
    rawId: string,
    messages: Array<Record<string, unknown>>,
  ): Promise<void> {
    const fp = buildMessagesFingerprint(messages);
    logDesignDetailHydrate('tryRecover_enter', {
      caseId: rawId,
      msgFp: { len: fp.len, lastId: fp.lastId },
      appliedFp: appliedProgressWorkspaceMessagesFp
        ? { len: appliedProgressWorkspaceMessagesFp.len, lastId: appliedProgressWorkspaceMessagesFp.lastId }
        : null,
      suppressPersistedReplay: designDynamicsSuppressPersistedReplay.value,
      fullRestartBusy: fullRestartBusy.value,
      restartBusy: restartBusy.value,
      ...diagTask0PipelineState(rawId),
    });
    if (fullRestartBusy.value || restartBusy.value) {
      logDesignDetailHydrate('tryRecover_skip_restart_busy', {
        caseId: rawId,
        fullRestartBusy: fullRestartBusy.value,
        restartBusy: restartBusy.value,
      });
      return;
    }
    if (
      appliedProgressWorkspaceMessagesFp &&
      messagesFingerprintsEqual(appliedProgressWorkspaceMessagesFp, fp)
    ) {
      logDesignDetailHydrate('tryRecover_skip_fp_unchanged', {
        caseId: rawId,
        msgFp: { len: fp.len, lastId: fp.lastId },
        ...diagTask0PipelineState(rawId),
      });
      logSupplementYesDiag('tryRecover_skip', { rawId, reason: 'fingerprint_unchanged_since_last_apply' });
      if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && !dynamicsCardsHaveDebugStepContinuePrompt()) {
        const merged = (lastResolvedItem.value ?? lastHydratedItem.value) as Record<string, unknown> | null;
        await reattachDebugPipelineContinueGatesFromLineState(rawId, merged);
      } else {
        const merged = (lastResolvedItem.value ?? lastHydratedItem.value) as Record<string, unknown> | null;
        await resumeDesignDetailPipelineAfterHydrateIfNeeded(rawId, merged);
      }
      return;
    }
    const remoteRaw = await fetchRemoteDesignDetailProgressWorkspacePayload(rawId);
    const localRaw = readLocalDesignDetailProgressWorkspacePayload(rawId);
    const rawPayload = pickProgressWorkspaceRawForHydrate(remoteRaw, localRaw, fp, messages);
    if (!rawPayload) {
      logDesignDetailHydrate('tryRecover_no_payload', {
        caseId: rawId,
        msgLen: messages.length,
        msgFp: { len: fp.len, lastId: fp.lastId },
        hadRemote: remoteRaw != null,
        hadLocal: localRaw != null,
      });
      logSupplementYesDiag('tryRecover_skip', {
        rawId,
        reason: 'no_workspace_payload',
        msgLen: messages.length,
        liveFp: { len: fp.len, lastId: fp.lastId },
      });
      appliedProgressWorkspaceMessagesFp = fp;
      return;
    }
    const snap = parseDesignDetailProgressSnapshot(rawPayload);
    if (!snap || !progressSnapshotMatchesMessages(snap.messagesFingerprint, fp, messages)) {
      logDesignDetailHydrate('tryRecover_fp_mismatch_or_bad_snap', {
        caseId: rawId,
        reason: !snap ? 'parse_snap_null' : 'fingerprint_mismatch',
        msgFp: { len: fp.len, lastId: fp.lastId },
        snapFp: snap
          ? { len: snap.messagesFingerprint.len, lastId: snap.messagesFingerprint.lastId }
          : null,
        snapDynLineCount: snap?.dynamicsCards.reduce((n, c) => n + c.lines.length, 0) ?? 0,
        snapLineTaskId: snap?.currentDesignLineTaskId,
        snapSuppressReplay: snap?.designDynamicsSuppressPersistedReplay,
        hadRemote: remoteRaw != null,
        hadLocal: localRaw != null,
        pickedLocal: rawPayload === localRaw,
      });
      logSupplementYesDiag('tryRecover_skip', {
        rawId,
        reason: !snap ? 'parse_snap_null' : 'fingerprint_mismatch',
        msgLen: messages.length,
        liveFp: { len: fp.len, lastId: fp.lastId },
        snapFp: snap ? { len: snap.messagesFingerprint.len, lastId: snap.messagesFingerprint.lastId } : null,
        snapPhase: snap?.task1CustomerRequirementPhase,
      });
      appliedProgressWorkspaceMessagesFp = fp;
      return;
    }
    logLlmStatsDiag('tryRecover_apply_snapshot', {
      rawId,
      msgLen: messages.length,
      snapLlmStats: snap.llmStatsIncludeFromMessageIndex,
      ...diagTask1LlmBlockSummary(messages, snap.llmStatsIncludeFromMessageIndex),
    });
    logDesignDetailHydrate('tryRecover_will_apply_snapshot', {
      caseId: rawId,
      snapDynLineCount: snap.dynamicsCards.reduce((n, c) => n + c.lines.length, 0),
      liveDynLineCount: dynamicsCards.value.reduce((n, c) => n + c.lines.length, 0),
      snapLineTaskId: snap.currentDesignLineTaskId,
      liveLineTaskId: currentDesignLineTaskId.value,
      snapSuppressReplay: snap.designDynamicsSuppressPersistedReplay,
      liveSuppressReplay: designDynamicsSuppressPersistedReplay.value,
      ...diagTask0PipelineState(rawId),
    });
    applyDesignDetailProgressWorkspaceSnapshot(rawId, snap);
    logSupplementYesDiag('tryRecover_applied', {
      rawId,
      phaseAfter: task1CustomerRequirementPhase.value,
      supplementPending: dynamicsHasRequirementSupplementPromptChoice(),
      dynamics: diagDynamicsSupplementSnapshot(),
    });
    logLlmStatsDiag('tryRecover_after_apply', {
      rawId,
      msgLen: messages.length,
      llmStatsAfterApply: llmStatsIncludeFromMessageIndex.value,
      ...diagTask1LlmBlockSummary(messages, llmStatsIncludeFromMessageIndex.value),
    });
    /** 快照损坏时 `llmStatsIncludeFromMessageIndex` 可能大于当前消息条数，导致与聊天中早期 `task1LlmQueryBlock` 不一致 */
    if (llmStatsIncludeFromMessageIndex.value > messages.length) {
      logLlmStatsDiag('tryRecover clamp_llm_stats_to_zero', {
        rawId,
        msgLen: messages.length,
        hadLlmIdx: llmStatsIncludeFromMessageIndex.value,
      });
      llmStatsIncludeFromMessageIndex.value = 0;
    } else if (llmStatsIncludeFromMessageIndex.value === messages.length && messages.length > 0) {
      /** 与「重启当前」语义一致：索引与消息长度对齐；便于与误恢复快照对照 */
      logLlmStatsDiag('tryRecover llm_stats_equals_msg_len', {
        rawId,
        msgLen: messages.length,
        llmStatsIdx: llmStatsIncludeFromMessageIndex.value,
        ...diagTask1LlmBlockSummary(messages, llmStatsIncludeFromMessageIndex.value),
      });
    }
    appliedProgressWorkspaceMessagesFp = fp;
    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) {
      const merged = (lastResolvedItem.value ?? lastHydratedItem.value) as Record<string, unknown> | null;
      await reattachDebugPipelineContinueGatesFromLineState(rawId, merged);
      const st52 = loadDesignDetailLineState(rawId);
      if (st52?.currentTaskId === 'capability_field_set_mapping') {
        const t52 = findDynamicsCardByLineTaskId(
          cloneDynamics(),
          'capability_field_set_mapping',
        );
        if (
          t52 &&
          t52.lines.some((l) => l.full.includes('我即将开始')) &&
          isTask52PipelineKickoffPending(t52)
        ) {
          const abort52 = takeDesignDetailLlmAbortController();
          await runTask52AssetFieldSetPipelineImpl(
            rawId,
            designDetailSessionGeneration,
            abort52,
            merged,
          );
        }
      }
      const st53 = loadDesignDetailLineState(rawId);
      if (st53?.currentTaskId === 'key_scenario_temporal_flow_inference') {
        const t53 = findDynamicsCardByLineTaskId(
          cloneDynamics(),
          'key_scenario_temporal_flow_inference',
        );
        if (
          t53 &&
          t53.lines.some((l) => l.full.includes('我即将开始')) &&
          isTask53PipelineKickoffPending(t53)
        ) {
          const abort53 = takeDesignDetailLlmAbortController();
          await runTask53WorkflowFlowPipelineImpl(
            rawId,
            designDetailSessionGeneration,
            abort53,
            merged,
          );
        }
      }
      const st85 = loadDesignDetailLineState(rawId);
      if (st85?.currentTaskId === 'physical_hook_integration_inference') {
        const t85 = cloneDynamics().find((c) => c.lineTaskId === 'physical_hook_integration_inference');
        if (isTask85PipelineKickoffPending(t85)) {
          const hasStalePrefaceOnlyCard =
            !!t85 &&
            t85.lines.some((l) => l.full.includes('我即将开始')) &&
            isTask85PipelineKickoffPending(t85);
          if (hasStalePrefaceOnlyCard) {
            const abort = takeDesignDetailLlmAbortController();
            await runTask85PhysicalHookPipelineImpl(
              rawId,
              designDetailSessionGeneration,
              abort,
              merged,
            );
          }
        }
      }
    } else {
      const merged = (lastResolvedItem.value ?? lastHydratedItem.value) as Record<string, unknown> | null;
      await resumeDesignDetailPipelineAfterHydrateIfNeeded(rawId, merged);
    }
  }

  function queuePersistDesignDetailProgressWorkspace(): void {
    const rawId = String(caseIdRef.value || '').trim();
    if (!rawId || loadError.value || !designDetailProgressWorkspaceSaveEnabled) return;
    if (designDetailProgressPersistTimer) clearTimeout(designDetailProgressPersistTimer);
    designDetailProgressPersistTimer = setTimeout(() => {
      designDetailProgressPersistTimer = null;
      void flushPersistDesignDetailProgressWorkspace(rawId);
    }, 520);
  }

  async function flushPersistDesignDetailProgressWorkspace(rawId: string): Promise<void> {
    const cid = String(rawId || '').trim();
    if (!cid || loadError.value) return;
    const messages = lastHydratedMessages.value;
    const fp = buildMessagesFingerprint(messages);
    const lidx = llmStatsIncludeFromMessageIndex.value;
    if (messages.length > 0 && lidx >= messages.length) {
      logLlmStatsDiag('flushPersist_warn_llm_stats_gte_msg_len', {
        rawId: cid,
        msgLen: messages.length,
        llmStatsIncludeFromMessageIndex: lidx,
        ...diagTask1LlmBlockSummary(messages, lidx),
      });
    }
    const liveCards = cloneDynamics();
    const liveLines = countLiveDynamicsCardLines(liveCards);
    if (liveLines <= 3 && isOnlineMode()) {
      try {
        const remotePayload = await fetchDesignDetailProgressWorkspacePayload(cid);
        const remoteSnap = remotePayload ? parseDesignDetailProgressSnapshot(remotePayload) : null;
        const remoteLines = countDynamicsSnapshotLines(remoteSnap?.dynamicsCards);
        const remoteFpMatch =
          remoteSnap != null && messagesFingerprintsEqual(remoteSnap.messagesFingerprint, fp);
        if (remoteFpMatch && remoteLines > liveLines + 3) {
          logDesignDetailHydrate('flushPersist_skip_clobber_richer_remote', {
            caseId: cid,
            liveLines,
            remoteLines,
            liveCardCount: liveCards.length,
            remoteCardCount: remoteSnap?.dynamicsCards.length ?? 0,
          });
          return;
        }
      } catch {
        /* 读远端失败仍落库 */
      }
    }
    const snap: Omit<DesignDetailProgressSnapshotV1, 'v'> = {
      messagesFingerprint: fp,
      currentDesignLineTaskId: currentDesignLineTaskId.value,
      designOnlyProgressTail: designOnlyProgressTail.value.map((s) => String(s ?? '')),
      dynamicsCards: JSON.parse(JSON.stringify(cloneDynamics())) as DesignDetailProgressSnapshotV1['dynamicsCards'],
      task1CustomerRequirementPhase: task1CustomerRequirementPhase.value,
      designCanvasTabs: designCanvasTabs.value.map((t) => ({ ...t })),
      activeDesignCanvasTabId: activeDesignCanvasTabId.value,
      customerBasicCanvasRows: customerBasicCanvasRows.value.map((r) => ({ ...r })),
      customerRequirementCanvasEntries: customerRequirementCanvasEntries.value.map((e) => ({
        ...e,
        parsed: { ...e.parsed },
      })),
      mergedRequirementActiveSubTabKey: mergedRequirementActiveSubTabKey.value,
      mergedRequirementParsedOverride: mergedRequirementParsedOverride.value
        ? (JSON.parse(JSON.stringify(mergedRequirementParsedOverride.value)) as Record<string, unknown>)
        : null,
      designDynamicsSuppressPersistedReplay: designDynamicsSuppressPersistedReplay.value,
      llmStatsIncludeFromMessageIndex: llmStatsIncludeFromMessageIndex.value,
      lastProgressTailFingerprint,
      chatDraft: designDetailChatDraft.value,
      leftPanelUi: readLeftPanelUiForPersist(),
      ...(task51L3MatrixRawOutput.value.trim()
        ? { task51L3MatrixRawOutput: task51L3MatrixRawOutput.value }
        : {}),
      ...(Object.keys(diagnosticReviewStepCards.value).length
        ? {
            task65DiagnosticReviewSteps: Object.values(diagnosticReviewStepCards.value).map((c) => ({
              ...c,
            })),
          }
        : {}),
    };
    const payload = buildDesignDetailProgressSnapshotV1(snap);
    const persistResult = await persistDesignDetailProgressWorkspacePayload(cid, payload);
    if (persistResult.persistedRemote) {
      appliedProgressWorkspaceMessagesFp = fp;
      designDetailProgressPersistPending = false;
    } else if (persistResult.persistedLocal) {
      appliedProgressWorkspaceMessagesFp = fp;
      designDetailProgressPersistPending = true;
      logDesignDetailHydrate('flushPersist_remote_failed_local_mirror', {
        caseId: cid,
        remoteStatus: persistResult.remoteStatus,
        liveLines,
        liveCardCount: liveCards.length,
      });
    }
  }

  function cancelDebouncedProgressWorkspacePersist(): void {
    if (designDetailProgressPersistTimer) {
      clearTimeout(designDetailProgressPersistTimer);
      designDetailProgressPersistTimer = null;
    }
  }

  /** LLM 日志 / 逻辑树落库后立刻 flush，与业务真源对齐 */
  function flushProgressWorkspaceOnArtifactSync(): void {
    const rawId = String(caseIdRef.value || '').trim();
    if (!rawId || loadError.value || !designDetailProgressWorkspaceSaveEnabled) return;
    cancelDebouncedProgressWorkspacePersist();
    void flushPersistDesignDetailProgressWorkspace(rawId);
  }

  function onPageLifecycleFlushProgressWorkspace(): void {
    const rawId = String(caseIdRef.value || '').trim();
    if (!rawId || !designDetailProgressWorkspaceSaveEnabled) return;
    cancelDebouncedProgressWorkspacePersist();
    void flushPersistDesignDetailProgressWorkspace(rawId);
  }

  /**
   * 进度区已含提炼 JSON 后：先追加「正在绘制客户基本信息画布」行尾态，**再**更新右侧画布 Tab/表格（中间留短暂间隔便于阅读）。
   * **不**在此推送「→ 请输入用户需求」：须在推导逻辑 **成功写入库**（或离线完成推导行）之后由 `pushTask1CustomerRequirementPromptAfterDerivation` 追加。
   */
  async function runCustomerBasicCanvasTabSequence(caseId: string, parsed: Record<string, unknown>) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    appendTask1CanvasDrawingProgress(cid);
    await delayMs(220);
    finalizeTask1CanvasDrawingLineToCheck(cid);
    await delayMs(120);
    customerBasicCanvasRows.value = buildCustomerBasicCanvasRows(parsed);
    const tabs = designCanvasTabs.value.slice();
    const exists = tabs.some((t) => t.id === 'customer_basic');
    if (!exists) {
      tabs.push({ id: 'customer_basic', label: '客户基本信息', kind: 'customer_basic' });
    }
    designCanvasTabs.value = tabs;
    activeDesignCanvasTabId.value = 'customer_basic';
    ensureRevealTicker(cid);
  }

  /** 推导逻辑同步成功后：阶段置 `awaiting` 并推送绿色「→ 请输入用户需求」 */
  function pushTask1CustomerRequirementPromptAfterDerivation(caseId: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    saveDesignDetailCustomerRequirementPhase(cid, 'awaiting');
    task1CustomerRequirementPhase.value = 'awaiting';
    ensureTask1DynamicsCard();
    const cardsAfter = cloneDynamics();
    const cReq = cardsAfter.find((c) => c.lineTaskId === 'customer_basic');
    if (
      cReq &&
      !cReq.lines.some((l) => l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE && l.kind === 'scope_green')
    ) {
      appendLineToCard(cReq, TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE, 'scope_green');
    }
    dynamicsCards.value = cardsAfter;
    ensureRevealTicker(cid);
    queuePersistDesignDetailProgressWorkspace();
  }

  /** 灰色引用块：展示经营信息提炼 JSON（替代用户原文） */
  function appendTask1GrayJsonQuoteProgress(caseId: string, jsonBody: string) {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    ensureTask1DynamicsCard();
    const cards = cloneDynamics();
    const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
    if (!c1) return;
    const body = String(jsonBody || '').replace(/\r\n/g, '\n');
    /** 与默认进度行一致：从 cursor=0 起由 `ensureRevealTicker` 逐码点揭示（含 JSON 内换行） */
    appendLineToCard(c1, `「${body}`, 'user_quote');
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  function makeCard(): DynamicsCardModel {
    const name = designLineTaskDisplayName('customer_basic');
    const card: DynamicsCardModel = {
      key: `customer_basic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lineTaskId: 'customer_basic',
      status: 'running',
      startedAtMs: Date.now(),
      completedAtMs: null,
      lines: [],
      extraTailConsumed: 0,
      completionQueued: false,
      thanksAppended: false,
    };
    appendLineToCard(card, `→ 我即将开始${name} ...`, 'default');
    appendLineToCard(card, TASK1_SCOPE_PROMPT_LINE, 'scope_green');
    return card;
  }

  /**
   * 任务 0 线步收官：先落库 token/feature，再刷新 Tree 任务 0 层，最后进入任务 1。
   */
  async function finalizeTask0CompletionWithSync(caseId: string): Promise<void> {
    const cidUrl = String(caseId || '').trim();
    const mergedItem = lastResolvedItem.value ?? lastHydratedItem.value;
    const cidApi = getCaseIdForBackend(mergedItem) || cidUrl;
    if (!cidUrl) {
      logDesignDetailTask0Pipeline('finalize_skip', { reason: 'no_case_id' });
      return;
    }
    if (task0AutoAdvanceDone) {
      logDesignDetailTask0Pipeline('finalize_skip', {
        reason: 'task0_auto_advance_done',
        ...diagTask0PipelineState(cidUrl),
      });
      return;
    }
    if (task0FinalizeInFlight) {
      logDesignDetailTask0Pipeline('finalize_skip', {
        reason: 'finalize_in_flight',
        ...diagTask0PipelineState(cidUrl),
      });
      return;
    }
    if (currentDesignLineTaskId.value !== 'optional_toolbox_primitive') {
      logDesignDetailTask0Pipeline('finalize_skip', {
        reason: 'line_not_task0',
        lineTaskId: currentDesignLineTaskId.value,
        ...diagTask0PipelineState(cidUrl),
      });
      return;
    }
    logDesignDetailTask0Sync('finalize_enter', {
      caseIdUrl: cidUrl,
      caseIdApi: cidApi,
      caseIdMismatch: cidApi !== cidUrl,
      online: isOnlineMode(),
    });
    logDesignDetailTask0Pipeline('finalize_enter', { ...diagTask0PipelineState(cidUrl) });
    task0FinalizeInFlight = true;
    pendingStreamAdvance = null;
    clearTask0AdvanceWatchdogs();

    try {
    await hydrateToolSuiteKnowledgeForDesign();
    const primitiveCount = buildToolSuitePrimitiveGraphFeatures().length;

    let cards = cloneDynamics();
    let t0 = cards.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
    if (t0 && primitiveCount > 0) {
      if (isOnlineMode()) {
        appendLineToCard(t0, TASK0_SYNC_SPINNER_LINE, 'bmc_generating', {
          bmcGenUi: 'spinner',
          spinnerBlue: true,
          startFullyRevealed: true,
        });
      } else {
        appendLineToCard(
          t0,
          `→ 已识别 ${primitiveCount} 个工具原语（离线模式，跳过落库）`,
          'default',
          { startFullyRevealed: true },
        );
      }
      dynamicsCards.value = cards;
      await flushPersistDesignDetailProgressWorkspace(cidUrl);
    }

    if (primitiveCount > 0 && isOnlineMode()) {
      const task0Sync = await syncToolSuitePrimitivesToDesignGraph(cidApi, true);
      logDesignDetailTask0Sync('finalize_sync_done', {
        caseIdApi: cidApi,
        primitiveCount: task0Sync.primitiveCount,
        synced: task0Sync.synced,
        syncRejectReason: task0Sync.syncRejectReason,
        featureCount: task0Sync.featureCount,
        sampleFeatureIds: task0Sync.features?.slice(0, 3).map((f) => f.featureId),
      });
      removeTask0SyncSpinnerLine(cidUrl);
      cards = cloneDynamics();
      t0 = cards.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
      if (t0) {
        if (task0Sync.synced) {
          logicTreeGraphRefreshTick.value += 1;
          const fc =
            typeof task0Sync.featureCount === 'number' ? task0Sync.featureCount : task0Sync.primitiveCount;
          appendLineToCard(t0, `→ 任务 0 落库完成（${fc} 个 feature）`, 'scope_green', {
            startFullyRevealed: true,
          });
          appendLineToCard(t0, '→ 更新 tree 视图（任务 0 层）', 'scope_green', {
            startFullyRevealed: true,
          });
          const verify = await verifyTask0GraphAfterSync(cidApi);
          logDesignDetailTask0Sync('post_get_verify', {
            caseIdApi: cidApi,
            ...verify,
            readbackMismatch:
              verify.getOk &&
              (verify.task0FeatureCount <= 0 ||
                verify.task0FeatureCount !== (task0Sync.featureCount ?? task0Sync.primitiveCount)),
          });
        } else {
          const reasonHint = task0Sync.syncRejectReason ? `（${task0Sync.syncRejectReason}）` : '';
          appendLineToCard(
            t0,
            `→ 任务 0 落库未成功${reasonHint}；请检查 Network 中 sync-task0 与控制台 [design-detail:task0-sync]`,
            'default',
            { startFullyRevealed: true },
          );
        }
        dynamicsCards.value = cards;
        await flushPersistDesignDetailProgressWorkspace(cidUrl);
      }
    }

    removeTask0SyncSpinnerLine(cidUrl);
    completeTask0DynamicsCardOnly(cidUrl);

    if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) && designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1)) {
      await ensureTask0ToTask1DebugContinueGate(cidUrl);
    } else {
      kickoffTask1AfterTask0Gate(cidUrl);
    }
    const itemAfterT0 = (lastResolvedItem.value ?? lastHydratedItem.value) as Record<string, unknown> | null;
    if (itemAfterT0) {
      syncDesignChatInputPlaceholderFromTaskState(itemAfterT0, lastHydratedMessages.value);
    }
    logDesignDetailTask0Pipeline('finalize_done', { ...diagTask0PipelineState(cidUrl) });
    } catch (e) {
      logDesignDetailTask0Pipeline('finalize_error', {
        caseId: cidUrl,
        message: e instanceof Error ? e.message : String(e),
        ...diagTask0PipelineState(cidUrl),
      });
      throw e;
    } finally {
      task0FinalizeInFlight = false;
      removeTask0SyncSpinnerLine(cidUrl);
    }
  }

  /**
   * 任务 0 收官：动态卡淡绿完成行、线步写 `customer_basic`（不挂载任务 1 卡，由调试门闩或 `beginTask1AfterTask0` 衔接）。
   */
  function completeTask0DynamicsCardOnly(caseId: string): void {
    const cid = String(caseId || '').trim();
    if (!cid || task0AutoAdvanceDone) {
      logDesignDetailTask0Pipeline('complete_card_only_skip', {
        reason: !cid ? 'no_case' : 'auto_advance_done',
        ...diagTask0PipelineState(cid || caseId),
      });
      return;
    }
    if (currentDesignLineTaskId.value !== 'optional_toolbox_primitive') {
      logDesignDetailTask0Pipeline('complete_card_only_skip', {
        reason: 'line_not_task0',
        lineTaskId: currentDesignLineTaskId.value,
        ...diagTask0PipelineState(cid),
      });
      return;
    }
    logDesignDetailTask0Pipeline('complete_card_only_enter', { ...diagTask0PipelineState(cid) });
    task0AutoAdvanceDone = true;
    pendingStreamAdvance = null;

    const cards = cloneDynamics();
    const t0 = cards.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
    if (t0 && t0.status === 'running') {
      for (const row of t0.lines) {
        row.cursor = cpLen(row.full);
      }
      const sec = Math.max(0, Math.round((Date.now() - t0.startedAtMs) / 1000));
      appendLineToCard(
        t0,
        formatCompletionLine(designLinePillLabel('optional_toolbox_primitive'), sec, '—', '—'),
        'default',
      );
      for (const row of t0.lines) {
        row.cursor = cpLen(row.full);
      }
      t0.status = 'completed';
      t0.completedAtMs = Date.now();
      t0.displayDurationSec = sec;
      t0.completionQueued = true;
    }

    advanceDesignDetailLineTask(cid, 'optional_toolbox_primitive');
    currentDesignLineTaskId.value = 'customer_basic';
    const prevHold = loadDesignDetailLineState(cid);
    saveDesignDetailLineState(cid, {
      schemaVersion: 1,
      currentTaskId: 'customer_basic',
      holdPastTask3: prevHold?.holdPastTask3,
      holdPastTask4: prevHold?.holdPastTask4,
    });
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  /** 调试门闩通过后（或关闭门闩时）：挂载任务 1 引导动态卡 */
  function beginTask1AfterTask0(caseId: string): void {
    const cid = String(caseId || '').trim();
    if (!cid) return;
    if (currentDesignLineTaskId.value !== 'customer_basic') return;

    let cards = cloneDynamics();
    if (!cards.some((c) => c.lineTaskId === 'customer_basic')) {
      cards = sortDynamicsCardsByLineTaskOrder([...cards, makeCard()]);
    } else {
      cards = sortDynamicsCardsByLineTaskOrder(cards);
    }
    dynamicsCards.value = cards;
    ensureRevealTicker(cid);
  }

  /**
   * 按当前线步、任务 1 阶段与进度卡引导同步底部占位（须在 `tryRecover` / `reconcileDesignLineStepForTask1InputUi` 之后调用）。
   */
  function syncDesignChatInputPlaceholderFromTaskState(
    item: Record<string, unknown>,
    messages: Array<Record<string, unknown>>,
  ): void {
    if (isTaskCompleted(item, TASK1_ID, messages)) {
      designChatInputPlaceholder.value = '描述设计意图或约束…';
      return;
    }
    const mergedForPh = mergeResolvedItemForDesign(item) || item;
    if (
      currentDesignLineTaskId.value === 'optional_toolbox_primitive' &&
      !task1InputUiBlocksTask0FootLock.value
    ) {
      designChatInputPlaceholder.value =
        '任务 0 进行中：工具原语将同步至逻辑树，完成后自动进入任务 1。';
      return;
    }
    if (isTask1ActivePreliminaryFollowupPhaseDesign(messages, mergedForPh)) {
      designChatInputPlaceholder.value =
        '当前为初步需求跟进/补充阶段；本页仅展示进度，请在案例详情页聊天区输入。';
      return;
    }
    if (task1CustomerRequirementPhase.value === 'awaiting') {
      designChatInputPlaceholder.value = TASK1_CUSTOMER_REQUIREMENT_INPUT_PLACEHOLDER;
      return;
    }
    const c1 = dynamicsCards.value.find((c) => c.lineTaskId === 'customer_basic');
    if (
      c1?.lines.some(
        (l) =>
          l.kind === 'scope_green' &&
          (l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE ||
            l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE_LEGACY),
      )
    ) {
      designChatInputPlaceholder.value = TASK1_CUSTOMER_REQUIREMENT_INPUT_PLACEHOLDER;
      return;
    }
    designChatInputPlaceholder.value =
      '可粘贴企业基本工商信息（关键词触发提炼），或发送客户工商及经营范围等描述（本页将提炼为结构化 JSON）。';
  }

  /**
   * 任务 1 已进入工商/需求输入态但线步仍停在任务 0 时，写回 `customer_basic`（与底部输入解禁一致）。
   */
  function reconcileDesignLineStepForTask1InputUi(caseId: string): void {
    const cid = String(caseId || '').trim();
    if (!cid || currentDesignLineTaskId.value !== 'optional_toolbox_primitive') return;
    if (!task1InputUiBlocksTask0FootLock.value) return;
    currentDesignLineTaskId.value = 'customer_basic';
    task0AutoAdvanceDone = true;
    const prev = loadDesignDetailLineState(cid);
    saveDesignDetailLineState(cid, {
      schemaVersion: 1,
      currentTaskId: 'customer_basic',
      holdPastTask3: prev?.holdPastTask3,
      holdPastTask4: prev?.holdPastTask4,
    });
    const item = (lastResolvedItem.value ?? lastHydratedItem.value) as Record<string, unknown> | null;
    const msgs = lastHydratedMessages.value;
    if (item) {
      syncDesignChatInputPlaceholderFromTaskState(item, msgs);
    }
  }

  /** Tree 任务 0 层已从落库图绘制就绪（与进度 reveal 收口二选一，仅首次生效） */
  function onLogicTreeTask0LayerReady(): void {
    const cid = String(caseIdRef.value || '').trim();
    logDesignDetailTask0Pipeline('tree_task0_layer_ready', { ...diagTask0PipelineState(cid) });
    if (!cid || task0AutoAdvanceDone || task0FinalizeInFlight) return;
    if (currentDesignLineTaskId.value !== 'optional_toolbox_primitive') return;
    void finalizeTask0CompletionWithSync(cid);
  }

  /**
   * 新案 / 线步在任务 0：hydrate 工具知识集、挂载任务 0 动态卡；**落库与 Tree 绘制推迟至任务 0 收官**。
   */
  async function bootstrapTask0ForDesignCase(caseId: string): Promise<void> {
    const cid = String(caseId || '').trim();
    if (!cid || currentDesignLineTaskId.value !== 'optional_toolbox_primitive') {
      logDesignDetailHydrate('bootstrap_skip_line_not_task0', {
        caseId: cid,
        lineTaskId: currentDesignLineTaskId.value,
      });
      return;
    }

    await hydrateToolSuiteKnowledgeForDesign();
    const primitiveCount = buildToolSuitePrimitiveGraphFeatures().length;

    let cards = cloneDynamics();
    const t0 = cards.find((c) => c.lineTaskId === 'optional_toolbox_primitive');
    const t0Done = t0?.status === 'completed' || t0?.completionQueued === true;

    logDesignDetailHydrate('bootstrap_enter', {
      caseId: cid,
      primitiveCount,
      hasT0Card: !!t0,
      t0Done,
      task0AutoAdvanceDone,
      ...diagTask0PipelineState(cid),
    });

    if (!t0) {
      const withoutStaleT1 = cards.filter((c) => c.lineTaskId !== 'customer_basic');
      dynamicsCards.value = sortDynamicsCardsByLineTaskOrder([
        ...withoutStaleT1,
        makeTask0DynamicsCard(primitiveCount),
      ]);
      if (!task0AutoAdvanceDone) {
        kickoffTask0StreamAdvance(cid, 'bootstrap_new_t0_card');
      }
      return;
    }

    if (!t0Done && !task0AutoAdvanceDone) {
      kickoffTask0StreamAdvance(cid, 'bootstrap_existing_t0_running');
      return;
    }

    /** 快照/刷新后任务 0 卡已 completed 但未走过线步收官：补线步与调试门闩 */
    if (t0Done && !task0AutoAdvanceDone) {
      logDesignDetailTask0Pipeline('bootstrap_t0_done_repair', {
        caseId: cid,
        t0Status: t0?.status,
        ...diagTask0PipelineState(cid),
      });
      if (t0?.status === 'completed') {
        task0AutoAdvanceDone = true;
        syncLineStateAfterTask0CompletedGate(cid);
        if (
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE) &&
          designDetailDebugGate(DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1)
        ) {
          void ensureTask0ToTask1DebugContinueGate(cid);
        } else {
          kickoffTask1AfterTask0Gate(cid);
        }
      } else {
        kickoffTask0StreamAdvance(cid, 'bootstrap_t0_completion_queued');
      }
    }
  }

  /** 「完全重启」后任务 0 动态卡：首句 + 原语识别提示（落库在收官时执行） */
  function makeTask0DynamicsCard(primitiveCount: number): DynamicsCardModel {
    const card = makeFreshLineTaskDynamicsCard('optional_toolbox_primitive');
    /** 完全重启后首屏仅两句：须立即 fully-reveal，避免轮询 hydrate 与 reveal 竞态导致 `try_finalize_skip_not_revealed` 永卡 */
    for (const row of card.lines) {
      row.cursor = cpLen(row.full);
    }
    if (primitiveCount > 0) {
      appendLineToCard(
        card,
        isOnlineMode()
          ? `已识别 ${primitiveCount} 个工具原语；任务 0 收官时将落库至推理图并刷新 Tree 任务 0 层。`
          : `已识别 ${primitiveCount} 个工具原语（离线模式，收官时不落库）。`,
        'default',
        { startFullyRevealed: true },
      );
    } else {
      appendLineToCard(card, '当前工具集「特征」视图无原语数据，可跳过进入任务 1。', 'default', {
        startFullyRevealed: true,
      });
    }
    return card;
  }

  /** 「重启当前」非任务 1 锚点：新建一张当前线步动态卡（仅首句进度，后续由各自 kickoff 填充） */
  function makeFreshLineTaskDynamicsCard(lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>): DynamicsCardModel {
    const card: DynamicsCardModel = {
      key: `${lineTaskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lineTaskId,
      status: 'running',
      startedAtMs: Date.now(),
      completedAtMs: null,
      lines: [],
      extraTailConsumed: 0,
      completionQueued: false,
      thanksAppended: false,
    };
    appendLineToCard(card, `→ 我即将开始${designLinePillLabel(lineTaskId)} ...`, 'default');
    return card;
  }

  /** 按设计线顺序排序动态卡（仅含已知线步 id） */
  function sortDynamicsCardsByLineTaskOrder(cards: DynamicsCardModel[]): DynamicsCardModel[] {
    return [...cards].sort(
      (a, b) =>
        DESIGN_MODE_LINE_TASK_ORDER.indexOf(a.lineTaskId as Exclude<DesignDetailLineTaskId, 'all_done'>) -
        DESIGN_MODE_LINE_TASK_ORDER.indexOf(b.lineTaskId as Exclude<DesignDetailLineTaskId, 'all_done'>),
    );
  }

  /**
   * 「重启当前」重建左栏动态卡：保留**锚点之前**线步已有卡（深拷贝快照）；若无任务 1 完成卡则用聊天聚合补一条。
   * 避免先 `catchUpTask1DoneWithoutAnimation` 再拼 fresh 时把任务 2 等前置卡整表清空。
   */
  function buildPriorDynamicsPreservingCompletedSteps(
    restartAnchor: Exclude<DesignDetailLineTaskId, 'all_done'>,
    snapshotBeforeRestart: DynamicsCardModel[],
    messages: Array<Record<string, unknown>>,
    item: Record<string, unknown>,
    opts?: { /** 锚点为任务 1 重启时勿注入「任务 1 已完成」补卡 */ injectCatchUpTask1IfMissing?: boolean },
  ): DynamicsCardModel[] {
    const anchorIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(restartAnchor);
    if (anchorIdx <= 0) return [];
    const preserved = sortDynamicsCardsByLineTaskOrder(
      snapshotBeforeRestart.filter((c) => {
        const i = DESIGN_MODE_LINE_TASK_ORDER.indexOf(c.lineTaskId as Exclude<DesignDetailLineTaskId, 'all_done'>);
        return i >= 0 && i < anchorIdx;
      }),
    );
    const seen = new Set<string>();
    const deduped: DynamicsCardModel[] = [];
    for (const c of preserved) {
      const id = c.lineTaskId;
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push({
        ...c,
        lines: c.lines.map((r) => ({ ...r })),
      });
    }
    const sorted = sortDynamicsCardsByLineTaskOrder(deduped);
    if (opts?.injectCatchUpTask1IfMissing === false) return sorted;
    if (sorted.some((c) => c.lineTaskId === 'customer_basic')) return sorted;
    return sortDynamicsCardsByLineTaskOrder([buildCatchUpTask1DoneCard(messages, item), ...sorted]);
  }

  const SYNTHETIC_PRIOR_STEP_RESTORE_LINE =
    '→ 本线步产物已落库（工作区未保留历史进度明细，可打开逻辑树/逻辑详情查看）';

  function buildGraphSummaryLineForLineStep(
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
    graphTasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  ): string | null {
    const task = graphTasks.find((t) => normLogicTaskId(t.taskId) === lineTaskId);
    if (!task) {
      return '→ 推理图：本线步任务卡暂无数据（选择重启可能已清除该线步之后落库，锚点之前线步仍应保留）';
    }
    const fc = task.features?.length ?? 0;
    const lc = task.links?.length ?? 0;
    if (fc === 0 && lc === 0) {
      return '→ 推理图：本线步暂无特征/逻辑链（请打开逻辑树确认）';
    }
    return `→ 推理图摘要：${fc} 个特征、${lc} 条逻辑链（完整推理/TVM/问卷明细未写入工作区快照）`;
  }

  /** 锚点之前线步：工作区快照缺卡时补一张「已收官」占位卡（推理图/LLM 仍可保留） */
  function buildSyntheticCompletedDynamicsCardForLineStep(
    lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
    graphTasks?: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  ): DynamicsCardModel {
    const card: DynamicsCardModel = {
      key: `${lineTaskId}-synthetic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lineTaskId,
      status: 'completed',
      startedAtMs: Date.now() - 60_000,
      completedAtMs: Date.now() - 30_000,
      lines: [],
      extraTailConsumed: 0,
      completionQueued: true,
      thanksAppended: false,
      displayDurationSec: 30,
    };
    appendLineToCard(card, `→ 我即将开始${designLinePillLabel(lineTaskId)} ...`, 'default', {
      startFullyRevealed: true,
    });
    appendLineToCard(card, SYNTHETIC_PRIOR_STEP_RESTORE_LINE, 'scope_green', {
      startFullyRevealed: true,
    });
    for (const row of card.lines) {
      row.cursor = cpLen(row.full);
    }
    return card;
  }

  function normalizeTask1CardToCatchUpIfDone(
    cards: DynamicsCardModel[],
    messages: Array<Record<string, unknown>>,
    item: Record<string, unknown>,
    t1Done: boolean,
  ): DynamicsCardModel[] {
    if (!t1Done) return cards;
    const idx = cards.findIndex((c) => c.lineTaskId === 'customer_basic');
    if (idx < 0) return cards;
    const c1 = cards[idx]!;
    if (c1.completionQueued && c1.status === 'completed') return cards;
    const out = cards.map((c) => ({ ...c, lines: c.lines.map((r) => ({ ...r })) }));
    out[idx] = buildCatchUpTask1DoneCard(messages, item);
    return out;
  }

  /** 选择/重启当前（锚点非任务 1）：快照缺任务 2～N-1 动态卡时按线步顺序补占位，避免左栏只剩任务 1+锚点 */
  function fillMissingPriorDynamicsBeforeRestartAnchor(
    restartAnchor: Exclude<DesignDetailLineTaskId, 'all_done'>,
    prior: DynamicsCardModel[],
    messages: Array<Record<string, unknown>>,
    item: Record<string, unknown>,
    t1Done: boolean,
  ): DynamicsCardModel[] {
    const anchorIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(restartAnchor);
    if (anchorIdx <= 0) return prior;
    let sorted = normalizeTask1CardToCatchUpIfDone(prior, messages, item, t1Done);
    const have = new Set(sorted.map((c) => c.lineTaskId));
    const synth: DynamicsCardModel[] = [];
    for (let i = 0; i < anchorIdx; i++) {
      const stepId = DESIGN_MODE_LINE_TASK_ORDER[i]!;
      if (have.has(stepId)) continue;
      if (stepId === 'customer_basic') {
        if (t1Done) synth.push(buildCatchUpTask1DoneCard(messages, item));
        continue;
      }
      synth.push(buildSyntheticCompletedDynamicsCardForLineStep(stepId));
    }
    if (!synth.length) return sorted;
    try {
      logDesignDetailHydrate('restart_fill_synthetic_prior_cards', {
        restartAnchor,
        syntheticSteps: synth.map((c) => c.lineTaskId),
        priorCardCount: sorted.length,
      });
    } catch {
      /* ignore */
    }
    return sortDynamicsCardsByLineTaskOrder([...sorted, ...synth]);
  }

  /** 选择重启：按 B～A 线步清空内存工作区字段（保留严格早于 B 的快照动态卡） */
  function pruneWorkspaceMemoryFieldsForSelectRestart(
    pruneSteps: ReadonlyArray<Exclude<DesignDetailLineTaskId, 'all_done'>>,
  ): void {
    if (!pruneSteps.length) return;
    const pruneIdx = pruneSteps.map((s) => designLineTaskIndexInOrder(s));
    const minPrune = Math.min(...pruneIdx.filter((i) => i >= 0));
    const idx51 = designLineTaskIndexInOrder('value_proposition_capability_units');
    const idx65 = designLineTaskIndexInOrder('three_dimension_itgap_analysis');
    const idx6 = designLineTaskIndexInOrder('pain_point_extraction');
    if (minPrune >= 0 && idx51 >= 0 && minPrune <= idx51) {
      task51L3MatrixRawOutput.value = '';
      currentStateUnderstandingGraphTasks.value = [];
      currentStateUnderstandingRefreshTick.value += 1;
      designCanvasTabs.value = designCanvasTabs.value.filter((t) => t.kind !== 'current_state_understanding');
    } else if (minPrune >= 0 && idx6 >= 0 && minPrune <= idx6 && currentStateUnderstandingGraphTasks.value.length) {
      currentStateUnderstandingGraphTasks.value =
        stripTask6FromGraphTasksForCurrentStateUnderstanding(currentStateUnderstandingGraphTasks.value);
      currentStateUnderstandingRefreshTick.value += 1;
    }
    if (minPrune >= 0 && idx65 >= 0 && minPrune <= idx65) {
      diagnosticReviewStepCards.value = {};
      diagnosticReviewRefreshTick.value += 1;
      designCanvasTabs.value = designCanvasTabs.value.filter((t) => t.kind !== 'diagnostic_review');
    }
    const pruneSet = new Set(pruneSteps);
    if (pruneSet.has('scale_org_mode_extract')) task2L1AlignmentPending.value = null;
    if (pruneSet.has('industry_business_profile_extract')) task3L2AlignmentPending.value = null;
    if (pruneSet.has('core_value_driver_inference')) task4L2AlignmentPending.value = null;
    if (pruneSet.has('macro_process_flow_inference')) task5L3AlignmentPending.value = null;
    if (pruneSet.has('value_proposition_capability_units')) task51L3AlignmentPending.value = null;
    if (pruneSet.has('vsm_stage_decomposition')) task55L3AlignmentPending.value = null;
    if (pruneSet.has('pain_point_extraction')) task6L3AlignmentPending.value = null;
    if (pruneSet.has('three_dimension_itgap_analysis')) task65L3AlignmentPending.value = null;
    if (pruneSet.has('key_requirement_scenarios')) task7L4AlignmentPending.value = null;
  }

  function normalizeProgressWsDynamicsCardsForRestart(
    cards: DesignDetailProgressSnapshotV1['dynamicsCards'],
  ): DynamicsCardModel[] {
    return cards.map((c) => {
      const lines = c.lines
        .map((r) => {
          let full =
            r.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE_LEGACY
              ? TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE
              : r.full;
          if (c.lineTaskId === 'capability_field_set_mapping') {
            full = migrateTask52ProgressLineFull(full);
          }
          if (c.lineTaskId === 'key_scenario_temporal_flow_inference') {
            full = migrateTask53ProgressLineFull(full);
          }
          return { ...r, full };
        })
        .filter((r) => String(r.full ?? '').trim().length > 0);
      return { ...c, lines } as DynamicsCardModel;
    });
  }

  /** 重启前合并 live 与尚未删除的工作区快照，避免清库后前置任务动态卡丢失 */
  function buildRestartMergedDynamicsSnapshot(
    live: DynamicsCardModel[],
    wsSnap: DesignDetailProgressSnapshotV1 | null,
  ): DynamicsCardModel[] {
    const liveClone = live.map((c) => ({ ...c, lines: c.lines.map((r) => ({ ...r })) }));
    if (!wsSnap?.dynamicsCards?.length) return liveClone;
    const snapNorm = normalizeProgressWsDynamicsCardsForRestart(wsSnap.dynamicsCards);
    return migrateDesignDetailProgressLinesInDynamicsCards(
      mergeDynamicsCardsPreferRicherProgress(liveClone, snapNorm) as DynamicsCardModel[],
    );
  }

  /** 选择/重启当前：锚点之前线步的画布 Tab 与「现状理解」数据（6.5 重启须保留任务 1～6 绘制） */
  async function restoreDesignCanvasPriorToRestartAnchor(
    rawId: string,
    restartAffectedSteps: ReturnType<typeof resolveRestartAffectedLineSteps>,
    canvasTabsBefore: DesignCanvasTab[],
    task51RawBefore: string,
  ): Promise<void> {
    if (restartAffectedSteps.includes('value_proposition_capability_units')) return;

    const clearsDiagnostic = restartAffectedSteps.includes('three_dimension_itgap_analysis');
    const preservedKinds = new Set([
      'case_overview',
      'customer_basic',
      'requirement_distill',
      'current_state_understanding',
    ]);
    const tabsFromBefore = canvasTabsBefore.filter((t) => {
      if (t.kind === 'diagnostic_review' && clearsDiagnostic) return false;
      return preservedKinds.has(t.kind);
    });

    if (tabsFromBefore.length) {
      const merged: DesignCanvasTab[] = [];
      const seen = new Set<string>();
      for (const t of [...designCanvasTabs.value, ...tabsFromBefore]) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        merged.push({ ...t });
      }
      designCanvasTabs.value = merged;
    }

    const task51Raw = String(task51RawBefore ?? '').trim();
    if (task51Raw) {
      task51L3MatrixRawOutput.value = task51Raw;
      currentStateUnderstandingRefreshTick.value += 1;
    }

    if (
      task51L3MatrixRawOutput.value.trim() &&
      !designCanvasTabs.value.some((t) => t.kind === 'current_state_understanding')
    ) {
      ensureCurrentStateUnderstandingTab(false);
    }

    await refreshCurrentStateUnderstandingFromTaskGraph(rawId);
  }

  /** 仅构造任务 1 已完成动态卡（不写 ref）；供 hydrate 空表与「重启当前」合并前置卡 */
  function buildCatchUpTask1DoneCard(
    messages: Array<Record<string, unknown>>,
    _item: Record<string, unknown>,
  ): DynamicsCardModel {
    const usage = aggregateTask1LlmUsage(messages);
    const inStr = formatTokenDisplay(usage.inputTok, usage.hasAny);
    const outStr = formatTokenDisplay(usage.outputTok, usage.hasAny);
    const name = designLineTaskDisplayName('customer_basic');
    const card = makeCard();
    /** 瞬时填满首行「即将开始」与镜像摘要略：仅收口完成行 */
    for (const row of card.lines) {
      row.cursor = cpLen(row.full);
    }
    const wallSec = Math.max(0, Math.round((Date.now() - card.startedAtMs) / 1000));
    const sec = deriveTask1ProgressDisplaySec(messages, wallSec);
    const doneLine = formatCompletionLine(name, sec, inStr, outStr);
    appendLineToCard(card, doneLine, 'default');
    for (const row of card.lines) {
      row.cursor = cpLen(row.full);
    }
    card.status = 'completed';
    card.completedAtMs = Date.now();
    card.displayDurationSec = sec;
    card.completionQueued = true;
    return card;
  }

  function ensureTask1DynamicsCard() {
    if (dynamicsCards.value.some((c) => c.lineTaskId === 'customer_basic')) return;
    dynamicsCards.value = cloneDynamics().concat(makeCard());
  }

  function catchUpTask1DoneWithoutAnimation(
    _caseId: string,
    messages: Array<Record<string, unknown>>,
    item: Record<string, unknown>,
  ) {
    dynamicsCards.value = [buildCatchUpTask1DoneCard(messages, item)];
    /** 线步由 hydrate /「重启当前」等调用方统一 reconcile 或写回锚点；此处不再推断，避免与外层 `currentDesignLineTaskId` 竞态 */
  }

  /** 任务 1 任务动态卡进度区：仅追加 `designOnlyProgressTail`（如发送工商后的本地提示）。 */
  function buildTask1DynamicsExtraLines(): string[] {
    return designOnlyProgressTail.value.map((s) => String(s || '')).filter((s) => s.trim().length > 0);
  }

  watch(
    () => caseIdRef.value,
    () => {
      task0AutoAdvanceDone = false;
      task0FinalizeInFlight = false;
      clearTask0AdvanceWatchdogs();
      clearRevealInterval();
      dynamicsCards.value = [];
      lastProgressTailFingerprint = '';
      designOnlyProgressTail.value = [];
      lastResolvedItem.value = null;
      pendingStreamAdvance = null;
      designDynamicsSuppressPersistedReplay.value = false;
      llmStatsIncludeFromMessageIndex.value = 0;
      task1CustomerRequirementPhase.value = 'idle';
      task2L1AlignmentPending.value = null;
      task2L1AlignmentQuestionnaireBusy.value = false;
      task3L2AlignmentPending.value = null;
      task3L2AlignmentQuestionnaireBusy.value = false;
      task4L2AlignmentPending.value = null;
      task4L2AlignmentQuestionnaireBusy.value = false;
      task5L3AlignmentPending.value = null;
      task5L3AlignmentQuestionnaireBusy.value = false;
      task51L3AlignmentPending.value = null;
      task51L3AlignmentQuestionnaireBusy.value = false;
      task55L3AlignmentPending.value = null;
      task55L3AlignmentQuestionnaireBusy.value = false;
      task6L3AlignmentPending.value = null;
      task6L3AlignmentQuestionnaireBusy.value = false;
      task65L3AlignmentPending.value = null;
      task65L3AlignmentQuestionnaireBusy.value = false;
      task7L4AlignmentPending.value = null;
      task7L4AlignmentQuestionnaireBusy.value = false;
      task8L45AlignmentPending.value = null;
      task8L45AlignmentQuestionnaireBusy.value = false;
      task85L475AlignmentPending.value = null;
      task85L475AlignmentQuestionnaireBusy.value = false;
      task9L5AlignmentPending.value = null;
      task9L5AlignmentQuestionnaireBusy.value = false;
      task10L5AlignmentPending.value = null;
      task10L5AlignmentQuestionnaireBusy.value = false;
      deferredAlignmentQuestionnaireJob.value = null;
      appliedProgressWorkspaceMessagesFp = null;
      designDetailProgressWorkspaceSaveEnabled = false;
      designDetailChatDraft.value = '';
      resetDesignCanvasWorkspace();
      void runHydrationCycle();
    },
  );

  /** 原「确认启动」：在线 POST task1/start + 聊天补丁；无按钮时由轮询自动触发 */
  async function applyTask1StartAutoConfirm(
    rawId: string,
    item: Record<string, unknown>,
    chatKey: string,
  ): Promise<void> {
    const bundle = await refreshBundle(rawId);
    let msgs = Array.isArray(bundle?.messages) ? bundle!.messages.slice() : [];

    if (isOnlineMode()) {
      const caseId = getCaseIdForBackend(item);
      const api = (window as unknown as { SmartCto?: { problemCaseApi?: { postProblemCaseTaskAction?: unknown } } })
        .SmartCto?.problemCaseApi;
      const postFn = api?.postProblemCaseTaskAction as
        | ((a: string, b: string, c: string, d: unknown) => Promise<unknown>)
        | undefined;
      if (caseId && typeof postFn === 'function') {
        const backendTid = mapFrontendTaskIdToBackendTaskId(TASK1_ID);
        await postFn(caseId, backendTid, 'start', { timestamp: new Date().toISOString() });
      }
      const after = await refreshBundle(rawId);
      msgs = Array.isArray(after?.messages) ? after!.messages.slice() : msgs;
    }

    const patched = applyTask1StartConfirmToMessages(msgs as Array<Record<string, unknown>>);
    persistChatMessages(chatKey, patched);
  }

  async function runHydrationCycle(): Promise<void> {
    const rawId = String(caseIdRef.value || '').trim();
    if (!rawId) {
      designDetailProgressWorkspaceSaveEnabled = false;
      lastHydratedMessages.value = [];
      lastHydratedItem.value = null;
      lastHydratedPreliminaryFollowupActive.value = false;
      dynamicsCards.value = [];
      return;
    }
    if (fullRestartBusy.value || restartBusy.value) {
      logDesignDetailHydrate('cycle_skip_restart_busy', {
        caseId: rawId,
        fullRestartBusy: fullRestartBusy.value,
        restartBusy: restartBusy.value,
        suppressPersistedReplay: designDynamicsSuppressPersistedReplay.value,
        ...diagTask0PipelineState(rawId),
      });
      return;
    }
    try {
      const bundle = _pendingPollBundle ?? await refreshBundle(rawId);
      if (!bundle?.item) {
        designDetailProgressWorkspaceSaveEnabled = false;
        loadError.value = '无法加载案例或无权访问';
        lastHydratedMessages.value = [];
        lastResolvedItem.value = null;
        lastHydratedPreliminaryFollowupActive.value = false;
        dynamicsCards.value = [];
        return;
      }
      const newMsgFp = _pendingMsgFp ?? buildMessagesFingerprint(bundle.messages as ReadonlyArray<Record<string, unknown>>);
      const localMsgFp = _cachedMsgFp ?? buildMessagesFingerprint(lastHydratedMessages.value as ReadonlyArray<Record<string, unknown>>);
      const messagesChanged = !messagesFingerprintsEqual(localMsgFp, newMsgFp);

      /** 新建案聊天为空时指纹恒为 `{len:0}`，若与 `lastHydratedMessages` 同为空会误判为「无变化」而跳过整轮 hydrate */
      if (!messagesChanged && lastHydratedItem.value != null) {
        logDesignDetailHydrate('cycle_skip_messages_unchanged', {
          caseId: rawId,
          msgFp: { len: newMsgFp.len, lastId: newMsgFp.lastId },
          suppressPersistedReplay: designDynamicsSuppressPersistedReplay.value,
          ...diagTask0PipelineState(rawId),
        });
        return;
      }

      _cachedMsgFp = newMsgFp;
      _pendingMsgFp = null;
      loadError.value = null;
      task1CustomerRequirementPhase.value = loadDesignDetailCustomerRequirementPhase(rawId);
      let item = mergeResolvedItemForDesign(bundle.item) || bundle.item;
      lastResolvedItem.value = item;
      const chatKey = getProblemDetailChatStorageKey(item);
      let messages = bundle.messages.slice();

      if (chatKey && shouldPersistTask1StartNotification(item, messages)) {
        const nextMsg = buildTaskStartNotificationMessage();
        const mergedMsgs = [...messages, nextMsg];
        persistChatMessages(chatKey, mergedMsgs);
        messages = mergedMsgs;
      }

      const tsIdxPending = lastIndexOfTaskStart(messages, TASK1_ID);
      const tsRowPending = tsIdxPending >= 0 ? messages[tsIdxPending] : null;
      const hasPendingTask1Start =
        tsIdxPending >= 0 &&
        !(tsRowPending as { confirmed?: boolean } | null)?.confirmed &&
        !isTaskCompleted(item, TASK1_ID, messages);

      /** 设计页不再展示「确认启动」：检测到 task1 未确认启动时自动 PATCH（含 online POST） */
      if (hasPendingTask1Start && chatKey) {
        try {
          await applyTask1StartAutoConfirm(rawId, item, chatKey);
          const bundleAfter = await refreshBundle(rawId);
          if (bundleAfter?.item) {
            item = mergeResolvedItemForDesign(bundleAfter.item) || bundleAfter.item;
            lastResolvedItem.value = item;
          }
          if (Array.isArray(bundleAfter?.messages)) messages = bundleAfter.messages.slice();
          designOnlyProgressTail.value = [];
        } catch (e) {
          loadError.value = e instanceof Error ? e.message : String(e);
        }
      }

      if (!designDynamicsSuppressPersistedReplay.value) {
        ensureDesignDetailLineRecord(rawId, item, messages);
      } else if (!loadDesignDetailLineState(rawId)) {
        /** 抑制回放期间避免 `ensure` 按全案 task1 误把线步写回 customer_basic；无本地线记录时仍须初始化 */
        ensureDesignDetailLineRecord(rawId, item, messages);
      }

      /** 须先于聊天回放/catchUp：否则空内存会先注入任务 1 引导卡，再 merge 快照时易只剩 2 行 */
      await tryRecoverDesignDetailProgressWorkspace(rawId, messages as Array<Record<string, unknown>>);

      const t1Done = isTaskCompleted(item, TASK1_ID, messages);

      const mergedProgressTails = buildTask1DynamicsExtraLines();
      const fp = mergedProgressTails.join('\u0001');
      const tailChanged = fp !== lastProgressTailFingerprint;
      if (tailChanged) lastProgressTailFingerprint = fp;

      let reconciled: DesignDetailLineTaskId;
      if (designDynamicsSuppressPersistedReplay.value) {
        const diskLine = loadDesignDetailLineState(rawId);
        reconciled =
          diskLine?.currentTaskId ??
          reconcileDesignDetailLineTaskId(
            rawId,
            item,
            messages as Array<Record<string, unknown>>,
            task1CustomerRequirementPhase.value,
          );
      } else {
        reconciled = reconcileDesignDetailLineTaskId(
          rawId,
          item,
          messages as Array<Record<string, unknown>>,
          task1CustomerRequirementPhase.value,
        );
      }
      currentDesignLineTaskId.value = reconciled;
      const persistedLine = reconciled;

      /** —— 任务动态卡：按当前任务线挂载（持久化步独立）；本页重启后抑制聊天回放改写卡片 —— */
      if (!designDynamicsSuppressPersistedReplay.value) {
      if (!t1Done && persistedLine !== 'optional_toolbox_primitive') {
        ensureTask1DynamicsCard();
        let cards = cloneDynamics();
        const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
        if (c1) {
          const scopeAdded = ensureTask1ScopePromptLine(c1);
          if (tailChanged) {
            while (c1.extraTailConsumed < mergedProgressTails.length) {
              appendLineToCard(c1, mergedProgressTails[c1.extraTailConsumed]!, 'default');
              c1.extraTailConsumed += 1;
            }
          }
          const bmcSynced = syncDesignDetailBmcFromPersistedMessages(
            c1,
            messages as Array<Record<string, unknown>>,
          );
          let reqPromptAdded = false;
          if (
            task1CustomerRequirementPhase.value === 'awaiting' &&
            !c1.lines.some((l) => l.full === TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE && l.kind === 'scope_green')
          ) {
            appendLineToCard(c1, TASK1_CUSTOMER_REQUIREMENT_PROMPT_LINE, 'scope_green');
            reqPromptAdded = true;
          }
          if (scopeAdded || tailChanged || bmcSynced || reqPromptAdded) {
            dynamicsCards.value = cards;
            if (scopeAdded || tailChanged || bmcSynced || reqPromptAdded) ensureRevealTicker(rawId);
          }
        }
      } else if (t1Done) {
        const cardsSnapshot = cloneDynamics();
        const c1 = cardsSnapshot.find((c) => c.lineTaskId === 'customer_basic');
        if (!cardsSnapshot.length) {
          catchUpTask1DoneWithoutAnimation(rawId, messages as Array<Record<string, unknown>>, item);
        } else if (c1 && !c1.completionQueued) {
          let cards = cloneDynamics();
          const live = cards.find((x) => x.lineTaskId === 'customer_basic');
          if (live) {
            while (live.extraTailConsumed < mergedProgressTails.length) {
              appendLineToCard(live, mergedProgressTails[live.extraTailConsumed]!, 'default');
              live.extraTailConsumed += 1;
            }
            const usage = aggregateTask1LlmUsage(messages as Array<Record<string, unknown>>);
            const inStr = formatTokenDisplay(usage.inputTok, usage.hasAny);
            const outStr = formatTokenDisplay(usage.outputTok, usage.hasAny);
            const wallSec = Math.max(0, Math.round((Date.now() - live.startedAtMs) / 1000));
            const sec = deriveTask1ProgressDisplaySec(messages as Array<Record<string, unknown>>, wallSec);
            live.displayDurationSec = sec;
            appendLineToCard(
              live,
              formatCompletionLine(designLineTaskDisplayName('customer_basic'), sec, inStr, outStr),
              'default',
            );
            live.completionQueued = true;
            dynamicsCards.value = cards;
            pendingStreamAdvance = 't1';
            ensureRevealTicker(rawId);
          }
        }
      }

      if (t1Done) {
        const snap = dynamicsCards.value.find((c) => c.lineTaskId === 'customer_basic');
        if (snap?.status === 'completed') {
          const needsDurationRepair =
            snap.displayDurationSec == null ||
            snap.displayDurationSec === 0 ||
            snap.lines.some(
              (l) => isCompletedProgressLine(l.full) && String(l.full).includes('耗时0秒'),
            );
          if (needsDurationRepair) {
            const cardsR = cloneDynamics();
            const c1r = cardsR.find((c) => c.lineTaskId === 'customer_basic');
            if (
              c1r &&
              reconcileTask1CompletedCardDuration(c1r, messages as Array<Record<string, unknown>>)
            ) {
              dynamicsCards.value = cardsR;
              ensureRevealTicker(rawId);
            }
          }
        }
      }

      if (persistedLine === 'all_done') {
        let cards = cloneDynamics();
        const c1 = cards.find((c) => c.lineTaskId === 'customer_basic');
        if (c1 && c1.status === 'running') {
          c1.status = 'completed';
          c1.completedAtMs = Date.now();
          dynamicsCards.value = cards;
        }
        cards = cloneDynamics();
        const c1b = cards.find((c) => c.lineTaskId === 'customer_basic');
        if (
          c1b &&
          !c1b.thanksAppended &&
          allLinesFullyRevealed([c1b]) &&
          c1b.lines.some((l) => isCompletedProgressLine(l.full))
        ) {
          appendLineToCard(c1b, '→ 任务已完成！谢谢', 'default');
          c1b.thanksAppended = true;
          dynamicsCards.value = cards;
          ensureRevealTicker(rawId);
        }
      }

      } /* !designDynamicsSuppressPersistedReplay */

      if (dynamicsCards.value.some((c) => c.lines.some((r) => r.cursor < cpLen(r.full)))) {
        ensureRevealTicker(rawId);
      }

      lastHydratedMessages.value = messages as Array<Record<string, unknown>>;
      lastHydratedItem.value = item;
      lastHydratedPreliminaryFollowupActive.value = isTask1ActivePreliminaryFollowupPhaseDesign(
        messages as Array<Record<string, unknown>>,
        item,
      );
      /** 「重启当前」后 `designDynamicsSuppressPersistedReplay` 为真：右侧画布已与聊天解耦清空，勿再从持久化消息重建 Tab */
      if (!designDynamicsSuppressPersistedReplay.value) {
        syncCustomerRequirementCanvasEntriesFromMessages(messages as Array<Record<string, unknown>>);
      }

      syncDesignChatInputPlaceholderFromTaskState(item, messages as Array<Record<string, unknown>>);

      if (
        !isTaskCompleted(item, TASK1_ID, messages) &&
        !hasMeaningfulProgressFromWorkspace(dynamicsCards.value)
      ) {
        if (fullRestartBusy.value || restartBusy.value) {
          logDesignDetailHydrate('bootstrap_skipped_restart_busy', { caseId: rawId });
        } else if (currentDesignLineTaskId.value === 'optional_toolbox_primitive') {
          await bootstrapTask0ForDesignCase(rawId);
        } else {
          ensureTask1StartupProgressUi(rawId);
        }
      }
      const beforeSanitizeLlmStats = llmStatsIncludeFromMessageIndex.value;
      llmStatsIncludeFromMessageIndex.value = sanitizeLlmStatsIncludeFromIndex(
        messages as ReadonlyArray<Record<string, unknown>>,
        llmStatsIncludeFromMessageIndex.value,
      );
      if (beforeSanitizeLlmStats !== llmStatsIncludeFromMessageIndex.value) {
        logLlmStatsDiag('hydrate_llm_stats_sanitized', {
          rawId,
          msgLen: messages.length,
          before: beforeSanitizeLlmStats,
          after: llmStatsIncludeFromMessageIndex.value,
          ...diagTask1LlmBlockSummary(
            messages as ReadonlyArray<Record<string, unknown>>,
            llmStatsIncludeFromMessageIndex.value,
          ),
        });
      }
      const _statsIdx = llmStatsIncludeFromMessageIndex.value;
      const _msgArr = messages as ReadonlyArray<Record<string, unknown>>;
      const _diag = diagTask1LlmBlockSummary(_msgArr, _statsIdx);
      const _tot = Number(_diag.task1LlmBlockCount ?? 0);
      const _inWin = Number(_diag.task1LlmInStatWindowCount ?? 0);
      const _anomalyLlmStats =
        _msgArr.length > 0 && _statsIdx >= _msgArr.length
          ? 'llm_stats_gte_msg_len'
          : _tot > 0 && _inWin === 0
            ? 'task1_blocks_all_below_stats_from'
            : '';
      if (_anomalyLlmStats) {
        logLlmStatsDiag('hydrate_post_tryRecover_anomaly', {
          rawId,
          anomaly: _anomalyLlmStats,
          msgLen: _msgArr.length,
          llmStatsIncludeFromMessageIndex: _statsIdx,
          suppressPersistedReplay: designDynamicsSuppressPersistedReplay.value,
          ..._diag,
        });
      }
      /** 工作区快照可能刚恢复旧动态卡；若阶段已为 `awaiting`（如用户点「继续补充 → 是」），补全绿字引导避免轮询后界面像「直接结束」。 */
      const hydrateTailInterest =
        task1CustomerRequirementPhase.value === 'awaiting' || dynamicsHasRequirementSupplementPromptChoice();
      if (hydrateTailInterest) {
        logSupplementYesDiag('hydrate_tail_before', {
          rawId,
          phase: task1CustomerRequirementPhase.value,
          supplementPending: dynamicsHasRequirementSupplementPromptChoice(),
          dynamics: diagDynamicsSupplementSnapshot(),
        });
      }
      if (task1CustomerRequirementPhase.value === 'awaiting') {
        ensureCustomerRequirementAwaitingProgressUi(rawId, 'hydrate_tail');
      }
      reconcileDesignLineStepForTask1InputUi(rawId);
      syncDesignChatInputPlaceholderFromTaskState(item, messages as Array<Record<string, unknown>>);
      if (hydrateTailInterest) {
        logSupplementYesDiag('hydrate_tail_after', {
          rawId,
          phase: task1CustomerRequirementPhase.value,
          supplementPending: dynamicsHasRequirementSupplementPromptChoice(),
          dynamics: diagDynamicsSupplementSnapshot(),
        });
      }
      if (!loadError.value) {
        designDetailProgressWorkspaceSaveEnabled = true;
        queuePersistDesignDetailProgressWorkspace();
        if (designDetailProgressPersistPending) {
          void flushPersistDesignDetailProgressWorkspace(rawId);
        }
      }
      syncAlignmentPendingStatesFromPersisted(rawId);
      if (!loadError.value) {
        const mergedHydrate = (lastResolvedItem.value ?? item) as Record<string, unknown> | null;
        await resumeDesignDetailPipelineAfterHydrateIfNeeded(rawId, mergedHydrate);
      }
      /** 聊天结束后 hydration 完成，通知浮动面板刷新数据 */
      bumpLlmLogAuditRefresh();
    } catch (e) {
      designDetailProgressWorkspaceSaveEnabled = false;
      loadError.value = e instanceof Error ? e.message : String(e);
    }
  }

  type DesignDetailExtractWindow = {
    extractDesignDetailBusinessInfoFromUserFeedback?: (t: string) => Promise<{
      parsed: Record<string, unknown>;
      usage?: unknown;
      model?: string;
      durationMs?: number;
      fullPrompt: string;
      rawOutput: string;
    }>;
    buildTask1LlmQueryMessage?: (a: Record<string, unknown>) => Record<string, unknown>;
  };

  /**
   * 设计页 task1：用户回复工商/经营范围 → 专用提示词提炼 → 进度区「提炼 ✓」+ **整段** JSON 灰行 → 持久化 → 短停顿 →「正在绘制客户基本信息画布」行尾态 → **再**更新右侧画布 Tab；**不**调用 BMC。
   */
  async function runDesignDetailTask1BusinessInfoExtractSubmit(params: {
    rawId: string;
    chatKey: string;
    messages: Array<Record<string, unknown>>;
    userText: string;
  }): Promise<{ ok: boolean; error?: string; messages: Array<Record<string, unknown>> }> {
    const { rawId, chatKey, userText } = params;
    let messages = params.messages;
    const ts = formatChatTimestampForMessage();
    messages = [...messages, { role: 'user', content: userText, timestamp: ts }];
    persistChatMessages(chatKey, messages);

    saveDesignDetailCustomerRequirementPhase(rawId, 'idle');
    task1CustomerRequirementPhase.value = 'idle';
    stripTask1CustomerRequirementUiLines(rawId);
    stripTask1CanvasDrawingProgressLines(rawId);
    appendTask1ExtractingCustomerBasicProgress(rawId);

    try {
      await ensureDesignDetailTask1ScriptsReady();
    } catch (scriptErr) {
      const errMsg =
        scriptErr instanceof Error ? scriptErr.message : '经营信息提炼脚本未加载，请刷新页面后重试。';
      removeTask1ExtractingProgressLine(rawId);
      const cardsM = cloneDynamics();
      const cM = cardsM.find((c) => c.lineTaskId === 'customer_basic');
      if (cM) {
        appendLineToCard(cM, '→ 经营信息提炼失败：脚本未就绪', 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsM;
      ensureRevealTicker(rawId);
      await runHydrationCycle();
      return { ok: false, error: errMsg, messages };
    }

    const wExt = window as unknown as DesignDetailExtractWindow;

    try {
      const parsedResult = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: DESIGN_DETAIL_TASK1_LLM_AUDIT_TASK_ID,
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_BUSINESS_EXTRACT,
        },
        () => wExt.extractDesignDetailBusinessInfoFromUserFeedback!(userText),
      );
      const { parsed, usage, model, durationMs, fullPrompt, rawOutput } = parsedResult;
      finalizeTask1ExtractingLineToCheck(rawId);
      appendTask1GrayJsonQuoteProgress(
        rawId,
        buildTask1BasicInfoProgressPreview(parsed as Record<string, unknown>),
      );

      const llmRow = wExt.buildTask1LlmQueryMessage!({
        noteName: DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE,
        fullPrompt,
        parsed,
        rawOutput,
        timestamp: formatChatTimestampForMessage(),
        usage,
        model,
        durationMs,
      });
      messages = [...messages, llmRow as Record<string, unknown>];
      messages.push({
        role: 'system',
        type: 'basicInfoCard',
        data: parsed,
        timestamp: formatChatTimestampForMessage(),
        confirmed: false,
        llmMeta: { usage, model, durationMs },
      } as Record<string, unknown>);
      persistChatMessages(chatKey, messages);
      /** 先 reveal 提炼 JSON 灰行，再绘制右侧客户基本信息画布（**先于**「提炼推导逻辑」） */
      await nextTick();
      await waitUntilDynamicsFullyRevealed();
      await delayMs(160);
      await runCustomerBasicCanvasTabSequence(rawId, parsed as Record<string, unknown>);

      /** 画布完毕后：「提炼推导逻辑」→ 写库；**仅成功**后再推送「→ 请输入用户需求」 */
      appendTask1DerivingLogicProgress(rawId);
      await nextTick();
      ensureRevealTicker(rawId);
      let derivationSyncOk = false;
      try {
        if (isOnlineMode()) {
          const api = (
            window as unknown as {
              SmartCto?: {
                problemCaseApi?: {
                  postDesignDetailSyncTask1BasicInfoGraph?: (
                    id: string,
                    bi: unknown,
                  ) => Promise<{ ok?: boolean; message?: string } | null>;
                };
              };
            }
          ).SmartCto?.problemCaseApi;
          const postFn = api?.postDesignDetailSyncTask1BasicInfoGraph;
          if (typeof postFn === 'function') {
            const res = await postFn(rawId, parsed);
            if (!res || res.ok !== true) {
              const hint = res && typeof (res as { message?: string }).message === 'string' ? (res as { message: string }).message : '同步失败';
              removeTask1DerivingLogicProgressLine(rawId);
              const cardsErr = cloneDynamics();
              const cErr = cardsErr.find((c) => c.lineTaskId === 'customer_basic');
              if (cErr) {
                appendLineToCard(cErr, `→ 提炼推导逻辑失败：${hint}`, 'default', { startFullyRevealed: true });
              }
              dynamicsCards.value = cardsErr;
              ensureRevealTicker(rawId);
            } else {
              finalizeTask1DerivingLogicLineToCheck(rawId);
              derivationSyncOk = true;
            }
          } else {
            finalizeTask1DerivingLogicLineToCheck(rawId);
            derivationSyncOk = true;
          }
        } else {
          finalizeTask1DerivingLogicLineToCheck(rawId);
          derivationSyncOk = true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        removeTask1DerivingLogicProgressLine(rawId);
        const cardsEx = cloneDynamics();
        const cEx = cardsEx.find((c) => c.lineTaskId === 'customer_basic');
        if (cEx) {
          appendLineToCard(cEx, `→ 提炼推导逻辑失败：${msg}`, 'default', { startFullyRevealed: true });
        }
        dynamicsCards.value = cardsEx;
        ensureRevealTicker(rawId);
      }
      if (derivationSyncOk) {
        pushTask1CustomerRequirementPromptAfterDerivation(rawId);
      }
      await nextTick();
      await waitUntilDynamicsFullyRevealed();
      await runHydrationCycle();
      return { ok: true, messages };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const cardsE = cloneDynamics();
      const cE = cardsE.find((c) => c.lineTaskId === 'customer_basic');
      if (cE) {
        const idxEx = findLastProgressLineIndex(
          cE.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK1_EXTRACTING_CUSTOMER_BASIC_LINE,
        );
        if (idxEx >= 0) delete cE.lines[idxEx]!.bmcGenUi;
        appendLineToCard(cE, `→ 经营信息提炼失败：${msg}`, 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsE;
      ensureRevealTicker(rawId);
      await runHydrationCycle();
      return { ok: false, error: msg, messages };
    }
  }

  type DesignDetailCustomerReqWindow = {
    extractDesignDetailCustomerRequirementFromUserFeedback?: (
      userText: string,
      basicInfoJsonStr: string,
    ) => Promise<{
      parsed: Record<string, unknown>;
      usage?: unknown;
      model?: string;
      durationMs?: number;
      fullPrompt: string;
      rawOutput: string;
    }>;
    buildTask1LlmQueryMessage?: (a: Record<string, unknown>) => Record<string, unknown>;
    DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME?: string;
  };

  /**
   * 设计页 task1：画布已就绪且阶段为 awaiting 时，用户发送需求 →「正在解析需求」行尾环 → 专用提示词提炼 → ✓ + JSON 灰行 + `task1LlmQueryBlock` →「正在渲染需求画布」行尾态 → 同步 **需求提炼** 画布层叠卡片；阶段置为 completed。
   */
  async function runDesignDetailCustomerRequirementSubmit(params: {
    rawId: string;
    chatKey: string;
    messages: Array<Record<string, unknown>>;
    userText: string;
    mergedItem: Record<string, unknown>;
  }): Promise<{ ok: boolean; error?: string; messages: Array<Record<string, unknown>> }> {
    const { rawId, chatKey, userText, mergedItem } = params;
    let messages = params.messages;
    const ts = formatChatTimestampForMessage();
    messages = [...messages, { role: 'user', content: userText, timestamp: ts }];
    persistChatMessages(chatKey, messages);

    logLlmStatsDiag('customerRequirementSubmit_after_user_persist', {
      rawId,
      messagesLen: messages.length,
      llmStatsIncludeFromMessageIndex: llmStatsIncludeFromMessageIndex.value,
      ...diagTask1LlmBlockSummary(messages, llmStatsIncludeFromMessageIndex.value),
    });

    appendTask1ParsingCustomerRequirementProgress(rawId);

    try {
      await ensureDesignDetailTask1ScriptsReady();
    } catch (scriptErr) {
      const errMsg =
        scriptErr instanceof Error ? scriptErr.message : '客户需求提炼脚本未加载，请刷新页面后重试。';
      removeTask1ParsingCustomerRequirementProgressLine(rawId);
      const cardsM = cloneDynamics();
      const cM = cardsM.find((c) => c.lineTaskId === 'customer_basic');
      if (cM) {
        appendLineToCard(cM, '→ 客户需求提炼失败：脚本未就绪', 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsM;
      ensureRevealTicker(rawId);
      await runHydrationCycle();
      return { ok: false, error: errMsg, messages };
    }

    const wExt = window as unknown as DesignDetailCustomerReqWindow;
    const noteName =
      typeof wExt.DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME === 'string' &&
      wExt.DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME.trim()
        ? wExt.DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME.trim()
        : DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE;

    const basicInfoForPrompt = (mergeResolvedItemForDesign(mergedItem) || mergedItem).basicInfo as
      | Record<string, unknown>
      | undefined;
    const basicInfoJsonStr = safeJsonStringify(basicInfoForPrompt ?? {});

    /** 与即将写入的 `task1LlmQueryBlock.task1RequirementDistillOrdinal` 同源，供 `ProblemCaseLlmLog.callTarget`「需求提炼#n」 */
    const task1RequirementDistillOrdinal = nextRequirementDistillOrdinalForChatAppend(messages);
    const llmLogCallTargetForRequirement = `需求提炼#${task1RequirementDistillOrdinal}`;

    try {
      const parsedResult = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: DESIGN_DETAIL_TASK1_LLM_AUDIT_TASK_ID,
          callTarget: llmLogCallTargetForRequirement,
        },
        () =>
          wExt.extractDesignDetailCustomerRequirementFromUserFeedback!(userText, basicInfoJsonStr),
      );
      const { parsed: parsedRaw, usage, model, durationMs, fullPrompt, rawOutput } = parsedResult;
      const parsed = sanitizeRequirementParsedDeprecatedFields(
        (parsedRaw && typeof parsedRaw === 'object' && !Array.isArray(parsedRaw)
          ? parsedRaw
          : {}) as Record<string, unknown>,
      );
      const jsonPretty =
        typeof rawOutput === 'string' && rawOutput.trim()
          ? rawOutput.trim()
          : safeJsonStringify(parsed);
      finalizeTask1ParsingCustomerRequirementLineToCheck(rawId);
      appendTask1GrayJsonQuoteProgress(
        rawId,
        buildCustomerRequirementProgressBriefForCard(parsed as Record<string, unknown>),
      );

      const llmTs = formatChatTimestampForMessage();
      const llmRow = wExt.buildTask1LlmQueryMessage!({
        noteName,
        fullPrompt,
        parsed,
        rawOutput,
        timestamp: llmTs,
        usage,
        model,
        durationMs,
        task1RequirementDistillOrdinal,
      });
      messages = [...messages, llmRow as Record<string, unknown>];
      persistChatMessages(chatKey, messages);
      logLlmStatsDiag('customerRequirementSubmit_after_llm_row_persist', {
        rawId,
        messagesLen: messages.length,
        llmStatsIncludeFromMessageIndex: llmStatsIncludeFromMessageIndex.value,
        task1RequirementDistillOrdinal,
        ...diagTask1LlmBlockSummary(messages, llmStatsIncludeFromMessageIndex.value),
      });

      /** 与「绘制客户基本信息画布」一致：先让需求 JSON 灰行 reveal 完毕，再渲染画布进度与右侧 Tab */
      await nextTick();
      await waitUntilDynamicsFullyRevealed();
      await delayMs(120);
      appendTask1RenderingRequirementCanvasProgress(rawId);
      await nextTick();
      await delayMs(220);
      finalizeTask1RenderingRequirementCanvasLineToCheck(rawId);

      syncCustomerRequirementCanvasEntriesFromMessages(messages);
      ensureRequirementDistillTab();
      activeDesignCanvasTabId.value = REQUIREMENT_DISTILL_TAB_ID;

      saveDesignDetailCustomerRequirementPhase(rawId, 'completed');
      task1CustomerRequirementPhase.value = 'completed';
      await nextTick();
      await waitUntilDynamicsFullyRevealed();

      /** 需求画布就绪后：按业务背景 → … → 管理资源同步推理图（taskId = customer_requirement）；**全部成功**后再增量合并并推送「是否继续补充需求」 */
      const parsedRec = parsed as Record<string, unknown>;
      let customerReqSectionSyncFullyOk = true;
      if (isOnlineMode()) {
        const api = (window as unknown as { SmartCto?: { problemCaseApi?: Record<string, unknown> } }).SmartCto
          ?.problemCaseApi;
        const postSection = api?.postDesignDetailSyncCustomerReqSectionGraph as
          | ((
              cid: string,
              body: { sectionKey: string; requirementParsed: Record<string, unknown> },
            ) => Promise<{ ok: boolean; message?: string }>)
          | undefined;
        const caseIdForApi = getCaseIdForBackend(mergedItem);
        if (caseIdForApi && typeof postSection === 'function') {
          for (let si = 0; si < CUSTOMER_REQUIREMENT_GRAPH_SYNC_AFTER_DISTILL.length; si += 1) {
            const { key, label } = CUSTOMER_REQUIREMENT_GRAPH_SYNC_AFTER_DISTILL[si]!;
            const { start: startLine, done: doneLine } = customerRequirementSectionSyncProgressLines(key);
            const cardsP = cloneDynamics();
            const cP = cardsP.find((c) => c.lineTaskId === 'customer_basic');
            if (cP) {
              appendLineToCard(cP, startLine, 'bmc_generating', {
                bmcGenUi: 'spinner',
                spinnerBlue: true,
                startFullyRevealed: true,
              });
            }
            dynamicsCards.value = cardsP;
            ensureRevealTicker(rawId);
            await nextTick();
            await waitUntilDynamicsFullyRevealed();

            const res = await postSection(caseIdForApi, { sectionKey: key, requirementParsed: parsedRec });
            if (!res?.ok) {
              customerReqSectionSyncFullyOk = false;
              removeCustomerRequirementSectionDerivingLine(rawId, startLine);
              const cardsErr = cloneDynamics();
              const cErr = cardsErr.find((c) => c.lineTaskId === 'customer_basic');
              if (cErr) {
                appendLineToCard(
                  cErr,
                  `→ 需求逻辑图同步失败（${label}）：${String(res?.message ?? '网络或服务错误').trim()}`,
                  'default',
                  { startFullyRevealed: true },
                );
              }
              dynamicsCards.value = cardsErr;
              ensureRevealTicker(rawId);
              break;
            }

            finalizeCustomerRequirementSectionDerivingLine(rawId, startLine);
            await nextTick();

            const cardsD = cloneDynamics();
            const cD = cardsD.find((c) => c.lineTaskId === 'customer_basic');
            if (cD) {
              appendLineToCard(cD, doneLine, 'default', { startFullyRevealed: true, bmcGenUi: 'check' });
            }
            dynamicsCards.value = cardsD;
            ensureRevealTicker(rawId);
            await nextTick();
            await waitUntilDynamicsFullyRevealed();
            /** 上一分域「完成」行 reveal 结束后再进入下一分域的「正在提炼」，避免两条进度同时堆叠 */
            if (si < CUSTOMER_REQUIREMENT_GRAPH_SYNC_AFTER_DISTILL.length - 1) {
              await delayMs(180);
            }
          }
        }
      }

      if (customerReqSectionSyncFullyOk) {
        await runIncrementalMergeTotalRequirementAfterDistill(rawId, task1RequirementDistillOrdinal, parsedRec);
        appendTask1RequirementSupplementPrompt(rawId);
      }

      logLlmStatsDiag('customerRequirementSubmit_before_final_hydrate', {
        rawId,
        messagesLenAfterLlmRow: messages.length,
        llmStatsIncludeFromMessageIndex: llmStatsIncludeFromMessageIndex.value,
      });
      await runHydrationCycle();
      logLlmStatsDiag('customerRequirementSubmit_after_final_hydrate', {
        rawId,
        hydratedLen: lastHydratedMessages.value.length,
        llmStatsIncludeFromMessageIndex: llmStatsIncludeFromMessageIndex.value,
      });
      return { ok: true, messages };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const cardsE = cloneDynamics();
      const cE = cardsE.find((c) => c.lineTaskId === 'customer_basic');
      if (cE) {
        const idxParse = findLastProgressLineIndex(
          cE.lines,
          (l) => l.kind === 'bmc_generating' && l.full === TASK1_PARSING_CUSTOMER_REQUIREMENT_LINE,
        );
        if (idxParse >= 0) delete cE.lines[idxParse]!.bmcGenUi;
        appendLineToCard(cE, `→ 客户需求提炼失败：${msg}`, 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsE;
      ensureRevealTicker(rawId);
      await runHydrationCycle();
      return { ok: false, error: msg, messages };
    }
  }

  type DesignDetailBmcWindow = {
    generateDesignDetailBmcFromContext?: (ctx: {
      basicInfo?: Record<string, unknown>;
      preliminaryReq?: unknown;
      userSupplementText: string;
    }) => Promise<{
      parsed: Record<string, unknown>;
      usage?: unknown;
      model?: string;
      durationMs?: number;
      fullPrompt: string;
      rawOutput: string;
    }>;
    buildTask1LlmQueryMessage?: (a: Record<string, unknown>) => Record<string, unknown>;
  };

  /**
   * 工商提炼后 / 进度路径用户输入后：统一 BMC 大模型链路与任务动态 UI。
   */
  async function runDesignDetailBmcChain(args: {
    rawId: string;
    mergedItem: Record<string, unknown>;
    chatKey: string;
    messages: Array<Record<string, unknown>>;
    userSupplementText: string;
    basicInfoForBmc: Record<string, unknown>;
  }): Promise<{
    messages: Array<Record<string, unknown>>;
    scriptMissing: boolean;
    error?: string;
  }> {
    const { rawId, mergedItem, chatKey, userSupplementText, basicInfoForBmc } = args;
    let messages = args.messages;

    ensureTask1DynamicsCard();
    const cardsGen = cloneDynamics();
    const cGen = cardsGen.find((c) => c.lineTaskId === 'customer_basic');
    if (cGen) {
      appendLineToCard(cGen, '→ 正在生成 bmc', 'bmc_generating', {
        bmcGenUi: 'spinner',
        startFullyRevealed: true,
      });
    }
    dynamicsCards.value = cardsGen;
    ensureRevealTicker(rawId);

    const wBmc = window as unknown as DesignDetailBmcWindow;
    if (typeof wBmc.generateDesignDetailBmcFromContext !== 'function') {
      const cardsErr = cloneDynamics();
      const cErr = cardsErr.find((c) => c.lineTaskId === 'customer_basic');
      const genLine = cErr?.lines.find((l) => l.kind === 'bmc_generating');
      if (genLine) delete genLine.bmcGenUi;
      if (cErr) {
        appendLineToCard(cErr, '→ bmc 生成失败：脚本未就绪', 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsErr;
      ensureRevealTicker(rawId);
      return { messages, scriptMissing: true };
    }

    try {
      const mergedForBmc = mergeResolvedItemForDesign(mergedItem) || mergedItem;
      const result = await withLlmAuditCtx(
        {
          caseId: rawId,
          taskId: DESIGN_DETAIL_TASK1_LLM_AUDIT_TASK_ID,
          callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_BMC,
        },
        () =>
          wBmc.generateDesignDetailBmcFromContext!({
            basicInfo: basicInfoForBmc,
            preliminaryReq: mergedForBmc.preliminaryReq ?? null,
            userSupplementText,
          }),
      );
      const cardsOk = cloneDynamics();
      const cOk = cardsOk.find((c) => c.lineTaskId === 'customer_basic');
      const genRow = cOk?.lines.find((l) => l.kind === 'bmc_generating' && l.full === '→ 正在生成 bmc');
      if (genRow) genRow.bmcGenUi = 'check';
      if (cOk) {
        appendLineToCard(cOk, '→ bmc 生成', 'default', { startFullyRevealed: true });
        const bmcPretty =
          typeof result.rawOutput === 'string' && result.rawOutput.trim()
            ? result.rawOutput.trim()
            : safeJsonStringify(result.parsed);
        appendLineToCard(cOk, bmcPretty, 'bmc_result_quote', { startFullyRevealed: true });
        const llmTs = formatChatTimestampForMessage();
        const llmRow = wBmc.buildTask1LlmQueryMessage!({
          noteName: DESIGN_DETAIL_BMC_NOTE,
          fullPrompt: result.fullPrompt,
          parsed: result.parsed,
          rawOutput: result.rawOutput,
          timestamp: llmTs,
          usage: result.usage,
          model: result.model,
          durationMs: result.durationMs,
        });
        messages = [...messages, llmRow as Record<string, unknown>];
        persistChatMessages(chatKey, messages);
        cOk.lastDesignBmcHydratedKey = llmTs;
      }
      dynamicsCards.value = cardsOk;
      ensureRevealTicker(rawId);
      return { messages, scriptMissing: false };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const cardsFail = cloneDynamics();
      const cFail = cardsFail.find((c) => c.lineTaskId === 'customer_basic');
      const genRowF = cFail?.lines.find((l) => l.kind === 'bmc_generating');
      if (genRowF) delete genRowF.bmcGenUi;
      if (cFail) {
        appendLineToCard(cFail, `→ bmc 生成失败：${errMsg}`, 'default', { startFullyRevealed: true });
      }
      dynamicsCards.value = cardsFail;
      ensureRevealTicker(rawId);
      return { messages, scriptMissing: false, error: errMsg };
    }
  }

  async function submitDesignDetailChatDraft(rawText: string): Promise<void> {
    const text = String(rawText || '').trim();
    if (!text || sendBusy.value) return;
    const rawId = String(caseIdRef.value || '').trim();
    const cachedItem = lastResolvedItem.value;
    if (!rawId || !cachedItem) return;
    const chatKey = getProblemDetailChatStorageKey(cachedItem);
    if (!chatKey) return;

    sendBusy.value = true;
    designDynamicsSuppressPersistedReplay.value = false;
    try {
      const bundle = await refreshBundle(rawId);
      if (!bundle?.item) {
        loadError.value = '无法加载案例或无权访问';
        return;
      }
      const mergedItem = mergeResolvedItemForDesign(bundle.item) || bundle.item;
      lastResolvedItem.value = mergedItem;
      let messages = Array.isArray(bundle.messages) ? bundle.messages.slice() : [];

      syncAlignmentPendingStatesFromPersisted(rawId);

      const t2Align = task2L1AlignmentPending.value;
      if (t2Align && String(t2Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t2LineTaskId: AlignmentDynamicsLineTaskId = 'scale_org_mode_extract';
        await appendAlignmentFeedbackReceivedProgress(rawId, t2LineTaskId, text);
        try {
          const wSyn = window as unknown as {
            synthesizeDesignDetailTask2L1DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{
              rawOutput?: string;
              content?: string;
              usage?: Record<string, unknown>;
              model?: string;
              durationMs?: number;
            }>;
          };
          if (typeof wSyn.synthesizeDesignDetailTask2L1DeepInsightFromAlignmentReply !== 'function') {
            loadError.value = '深访合成脚本未加载（synthesizeDesignDetailTask2L1DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlock = [
            '【原始冲突清单】',
            String(t2Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t2Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT2 = {
            caseId: rawId,
            taskId: designLinePillLabel('scale_org_mode_extract'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK2_L1_DEEP_INSIGHT_SYNTHESIS,
          };
          const synRes = await withLlmAuditCtx(synAuditCtxT2, () =>
            wSyn.synthesizeDesignDetailTask2L1DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlock },
              designDetailLlmFetchOpts(synAuditCtxT2),
            ),
          );
          const deepText = String(synRes.rawOutput || synRes.content || '').trim();
          writeTask2L1DeepInsightText(rawId, deepText);
          writeTask2L1UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t2LineTaskId,
              t2Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task2L1AlignmentPending.value = null;
          const ts = formatChatTimestampForMessage();
          messages = [...messages, { role: 'user', content: text, timestamp: ts }];
          persistChatMessages(chatKey, messages);
          const cardsA = cloneDynamics();
          const c2p = cardsA.find((c) => c.lineTaskId === 'scale_org_mode_extract');
          if (c2p) {
            appendLineToCard(c2p, TASK2_L1_ALIGNMENT_SYNTH_DONE_LINE, 'default', { startFullyRevealed: true });
          }
          dynamicsCards.value = cardsA;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          loadError.value = null;
          const beforeT2Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t2LineTaskId);
          const epochAlignRerun = designDetailSessionGeneration;
          const task2LlmAbortAlign = takeDesignDetailLlmAbortController();
          await runTask2L1EntityPortraitPipeline(rawId, epochAlignRerun, task2LlmAbortAlign, mergedItem, {
            deferDebugContinue: true,
            deferAlignmentQuestionnaire: true,
          });
          await appendAlignmentRerunDiffProgress(rawId, t2LineTaskId, beforeT2Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
          await scheduleDebugContinueAfterTask2L1SegmentIfReady(rawId, mergedItem);
        } catch (eAl) {
          loadError.value = eAl instanceof Error ? eAl.message : String(eAl);
        }
        return;
      }

      const t4Align = task4L2AlignmentPending.value;
      if (t4Align && String(t4Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t4LineTaskId: AlignmentDynamicsLineTaskId = 'core_value_driver_inference';
        await appendAlignmentFeedbackReceivedProgress(rawId, t4LineTaskId, text);
        try {
          const wSyn4 = window as unknown as {
            synthesizeDesignDetailTask4L2DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{
              rawOutput?: string;
              content?: string;
              usage?: Record<string, unknown>;
              model?: string;
              durationMs?: number;
            }>;
          };
          if (typeof wSyn4.synthesizeDesignDetailTask4L2DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask4L2DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT4 = [
            '【原始冲突清单】',
            String(t4Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t4Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT4 = {
            caseId: rawId,
            taskId: designLinePillLabel('core_value_driver_inference'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK4_L2_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT4 = await withLlmAuditCtx(synAuditCtxT4, () =>
            wSyn4.synthesizeDesignDetailTask4L2DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT4 },
              designDetailLlmFetchOpts(synAuditCtxT4),
            ),
          );
          const deepTextT4 = String(synResT4.rawOutput || synResT4.content || '').trim();
          writeTask4L2DeepInsightText(rawId, deepTextT4);
          writeTask4L2UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t4LineTaskId,
              t4Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task4L2AlignmentPending.value = null;
          const tsT4 = formatChatTimestampForMessage();
          messages = [...messages, { role: 'user', content: text, timestamp: tsT4 }];
          persistChatMessages(chatKey, messages);
          const cardsA4 = cloneDynamics();
          const c4p = cardsA4.find((c) => c.lineTaskId === 'core_value_driver_inference');
          if (c4p) {
            appendLineToCard(c4p, TASK4_L2_ALIGNMENT_SYNTH_DONE_LINE, 'default', { startFullyRevealed: true });
          }
          dynamicsCards.value = cardsA4;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          loadError.value = null;
          const beforeT4Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t4LineTaskId);
          const epochAlignRerun4 = designDetailSessionGeneration;
          const task4LlmAbortAlign = takeDesignDetailLlmAbortController();
          await runTask4L2CoreValueDriverPipeline(rawId, epochAlignRerun4, task4LlmAbortAlign, mergedItem, {
            deferDebugContinue: true,
            deferAlignmentQuestionnaire: true,
          });
          await appendAlignmentRerunDiffProgress(rawId, t4LineTaskId, beforeT4Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
          await scheduleDebugContinueAfterTask4L2SegmentIfReady(rawId, mergedItem);
        } catch (eAl4) {
          loadError.value = eAl4 instanceof Error ? eAl4.message : String(eAl4);
        }
        return;
      }

      const t3Align = task3L2AlignmentPending.value;
      if (t3Align && String(t3Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t3LineTaskId: AlignmentDynamicsLineTaskId = 'industry_business_profile_extract';
        await appendAlignmentFeedbackReceivedProgress(rawId, t3LineTaskId, text);
        try {
          const wSyn3 = window as unknown as {
            synthesizeDesignDetailTask3L2DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{
              rawOutput?: string;
              content?: string;
              usage?: Record<string, unknown>;
              model?: string;
              durationMs?: number;
            }>;
          };
          if (typeof wSyn3.synthesizeDesignDetailTask3L2DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask3L2DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT3 = [
            '【原始冲突清单】',
            String(t3Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t3Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT3 = {
            caseId: rawId,
            taskId: designLinePillLabel('industry_business_profile_extract'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK3_L2_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT3 = await withLlmAuditCtx(synAuditCtxT3, () =>
            wSyn3.synthesizeDesignDetailTask3L2DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT3 },
              designDetailLlmFetchOpts(synAuditCtxT3),
            ),
          );
          const deepTextT3 = String(synResT3.rawOutput || synResT3.content || '').trim();
          writeTask3L2DeepInsightText(rawId, deepTextT3);
          writeTask3L2UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t3LineTaskId,
              t3Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task3L2AlignmentPending.value = null;
          const tsT3 = formatChatTimestampForMessage();
          messages = [...messages, { role: 'user', content: text, timestamp: tsT3 }];
          persistChatMessages(chatKey, messages);
          const cardsA3 = cloneDynamics();
          const c3p = cardsA3.find((c) => c.lineTaskId === 'industry_business_profile_extract');
          if (c3p) {
            appendLineToCard(c3p, TASK3_L2_ALIGNMENT_SYNTH_DONE_LINE, 'default', { startFullyRevealed: true });
          }
          dynamicsCards.value = cardsA3;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          loadError.value = null;
          const beforeT3Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t3LineTaskId);
          const epochAlignRerun3 = designDetailSessionGeneration;
          const task3LlmAbortAlign = takeDesignDetailLlmAbortController();
          await runTask3L2IndustryBusinessPipeline(rawId, epochAlignRerun3, task3LlmAbortAlign, mergedItem, {
            deferDebugContinue: true,
            deferAlignmentQuestionnaire: true,
          });
          await appendAlignmentRerunDiffProgress(rawId, t3LineTaskId, beforeT3Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
          await scheduleDebugContinueAfterTask3L2SegmentIfReady(rawId, mergedItem);
        } catch (eAl3) {
          loadError.value = eAl3 instanceof Error ? eAl3.message : String(eAl3);
        }
        return;
      }

      const t5Align = task5L3AlignmentPending.value;
      if (t5Align && String(t5Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t5LineTaskId: AlignmentDynamicsLineTaskId = 'macro_process_flow_inference';
        await appendAlignmentFeedbackReceivedProgress(rawId, t5LineTaskId, text);
        try {
          const wSyn5 = window as unknown as {
            synthesizeDesignDetailTask5L3DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{
              rawOutput?: string;
              content?: string;
            }>;
          };
          if (typeof wSyn5.synthesizeDesignDetailTask5L3DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask5L3DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT5 = [
            '【原始冲突清单】',
            String(t5Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t5Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT5 = {
            caseId: rawId,
            taskId: designLinePillLabel('macro_process_flow_inference'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK5_L3_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT5 = await withLlmAuditCtx(synAuditCtxT5, () =>
            wSyn5.synthesizeDesignDetailTask5L3DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT5 },
              designDetailLlmFetchOpts(synAuditCtxT5),
            ),
          );
          const deepTextT5 = String(synResT5.rawOutput || synResT5.content || '').trim();
          writeTask5L3DeepInsightText(rawId, deepTextT5);
          writeTask5L3UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t5LineTaskId,
              t5Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task5L3AlignmentPending.value = null;
          const tsT5 = formatChatTimestampForMessage();
          messages = [...messages, { role: 'user', content: text, timestamp: tsT5 }];
          persistChatMessages(chatKey, messages);
          const cardsA5 = cloneDynamics();
          const c5p = cardsA5.find((c) => c.lineTaskId === 'macro_process_flow_inference');
          if (c5p) {
            appendLineToCard(c5p, TASK5_L3_ALIGNMENT_SYNTH_DONE_LINE, 'default', { startFullyRevealed: true });
          }
          dynamicsCards.value = cardsA5;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          loadError.value = null;
          const beforeT5Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t5LineTaskId);
          const epochAlignRerun5 = designDetailSessionGeneration;
          const task5LlmAbortAlign = takeDesignDetailLlmAbortController();
          await runTask5L3MacroProcessPipeline(rawId, epochAlignRerun5, task5LlmAbortAlign, mergedItem, {
            deferDebugContinue: true,
            deferAlignmentQuestionnaire: true,
          });
          await appendAlignmentRerunDiffProgress(rawId, t5LineTaskId, beforeT5Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
        } catch (eAl5) {
          loadError.value = eAl5 instanceof Error ? eAl5.message : String(eAl5);
        }
        return;
      }

      const t51Align = task51L3AlignmentPending.value;
      if (t51Align && String(t51Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t51LineTaskId: AlignmentDynamicsLineTaskId = 'value_proposition_capability_units';
        await appendAlignmentFeedbackReceivedProgress(rawId, t51LineTaskId, text);
        try {
          const wSyn51 = window as unknown as {
            synthesizeDesignDetailTask51L3DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{
              rawOutput?: string;
              content?: string;
            }>;
          };
          if (typeof wSyn51.synthesizeDesignDetailTask51L3DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask51L3DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT51 = [
            '【原始冲突清单】',
            String(t51Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t51Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT51 = {
            caseId: rawId,
            taskId: designLinePillLabel('value_proposition_capability_units'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK51_L3_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT51 = await withLlmAuditCtx(synAuditCtxT51, () =>
            wSyn51.synthesizeDesignDetailTask51L3DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT51 },
              designDetailLlmFetchOpts(synAuditCtxT51),
            ),
          );
          const deepTextT51 = String(synResT51.rawOutput || synResT51.content || '').trim();
          writeTask51L3DeepInsightText(rawId, deepTextT51);
          writeTask51L3UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t51LineTaskId,
              t51Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task51L3AlignmentPending.value = null;
          const tsT51 = formatChatTimestampForMessage();
          messages = [...messages, { role: 'user', content: text, timestamp: tsT51 }];
          persistChatMessages(chatKey, messages);
          const cardsA51 = cloneDynamics();
          const c51p = cardsA51.find((c) => c.lineTaskId === 'value_proposition_capability_units');
          if (c51p) {
            appendLineToCard(c51p, TASK51_L3_ALIGNMENT_SYNTH_DONE_LINE, 'default', { startFullyRevealed: true });
          }
          dynamicsCards.value = cardsA51;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          loadError.value = null;
          const beforeT51Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t51LineTaskId);
          const epochAlignRerun51 = designDetailSessionGeneration;
          const task51LlmAbortAlign = takeDesignDetailLlmAbortController();
          await runTask51ValuePropositionPipelineImpl(rawId, epochAlignRerun51, task51LlmAbortAlign, mergedItem, {
            deferDebugContinue: true,
            deferAlignmentQuestionnaire: true,
          });
          await appendAlignmentRerunDiffProgress(rawId, t51LineTaskId, beforeT51Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
          await scheduleDebugContinueAfterTask51SegmentIfReady(rawId, mergedItem);
        } catch (eAl51) {
          loadError.value = eAl51 instanceof Error ? eAl51.message : String(eAl51);
        }
        return;
      }

      const t55Align = task55L3AlignmentPending.value;
      if (t55Align && String(t55Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t55LineTaskId: AlignmentDynamicsLineTaskId = 'vsm_stage_decomposition';
        await appendAlignmentFeedbackReceivedProgress(rawId, t55LineTaskId, text);
        try {
          const wSyn55 = window as unknown as {
            synthesizeDesignDetailTask55L3DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{
              rawOutput?: string;
              content?: string;
            }>;
          };
          if (typeof wSyn55.synthesizeDesignDetailTask55L3DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask55L3DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT55 = [
            '【原始冲突清单】',
            String(t55Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t55Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT55 = {
            caseId: rawId,
            taskId: designLinePillLabel('vsm_stage_decomposition'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK55_L3_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT55 = await withLlmAuditCtx(synAuditCtxT55, () =>
            wSyn55.synthesizeDesignDetailTask55L3DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT55 },
              designDetailLlmFetchOpts(synAuditCtxT55),
            ),
          );
          const deepTextT55 = String(synResT55.rawOutput || synResT55.content || '').trim();
          writeTask55L3DeepInsightText(rawId, deepTextT55);
          writeTask55L3UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t55LineTaskId,
              t55Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task55L3AlignmentPending.value = null;
          const tsT55 = formatChatTimestampForMessage();
          messages = [...messages, { role: 'user', content: text, timestamp: tsT55 }];
          persistChatMessages(chatKey, messages);
          const cardsA55 = cloneDynamics();
          const c55p = cardsA55.find((c) => c.lineTaskId === 'vsm_stage_decomposition');
          if (c55p) {
            appendLineToCard(c55p, TASK55_L3_ALIGNMENT_SYNTH_DONE_LINE, 'default', { startFullyRevealed: true });
          }
          dynamicsCards.value = cardsA55;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          loadError.value = null;
          const beforeT55Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t55LineTaskId);
          const epochAlignRerun55 = designDetailSessionGeneration;
          const task55LlmAbortAlign = takeDesignDetailLlmAbortController();
          await runTask55L3VsmStagePipeline(rawId, epochAlignRerun55, task55LlmAbortAlign, mergedItem, {
            deferDebugContinue: true,
            deferAlignmentQuestionnaire: true,
          });
          await appendAlignmentRerunDiffProgress(rawId, t55LineTaskId, beforeT55Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
          await scheduleDebugContinueAfterTask55L3SegmentIfReady(rawId, mergedItem);
        } catch (eAl55) {
          loadError.value = eAl55 instanceof Error ? eAl55.message : String(eAl55);
        }
        return;
      }

      const t9Align = task9L5AlignmentPending.value;
      if (t9Align && String(t9Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t9LineTaskId: AlignmentDynamicsLineTaskId = 'business_capability_positioning';
        await appendAlignmentFeedbackReceivedProgress(rawId, t9LineTaskId, text);
        try {
          const wSyn9 = window as unknown as {
            synthesizeDesignDetailTask9L5DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{ rawOutput?: string; content?: string }>;
          };
          if (typeof wSyn9.synthesizeDesignDetailTask9L5DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask9L5DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT9 = [
            '【原始冲突清单】',
            String(t9Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t9Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT9 = {
            caseId: rawId,
            taskId: designLinePillLabel('business_capability_positioning'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK9_L5_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT9 = await withLlmAuditCtx(synAuditCtxT9, () =>
            wSyn9.synthesizeDesignDetailTask9L5DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT9 },
              designDetailLlmFetchOpts(synAuditCtxT9),
            ),
          );
          writeTask9L5DeepInsightText(rawId, String(synResT9.rawOutput || synResT9.content || '').trim());
          writeTask9L5UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t9LineTaskId,
              t9Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task9L5AlignmentPending.value = null;
          messages = [
            ...messages,
            { role: 'user', content: text, timestamp: formatChatTimestampForMessage() },
          ];
          persistChatMessages(chatKey, messages);
          const cardsA9 = cloneDynamics();
          const c9p = cardsA9.find((c) => c.lineTaskId === 'business_capability_positioning');
          if (c9p) {
            appendLineToCard(c9p, TASK9_L5_ALIGNMENT_SYNTH_DONE_LINE, 'default', {
              startFullyRevealed: true,
            });
          }
          dynamicsCards.value = cardsA9;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          const beforeT9Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t9LineTaskId);
          const epochAlignRerun9 = designDetailSessionGeneration;
          await runTask9L5BlueprintPipeline(
            rawId,
            epochAlignRerun9,
            takeDesignDetailLlmAbortController(),
            mergedItem,
            { deferDebugContinue: true, deferAlignmentQuestionnaire: true },
          );
          await appendAlignmentRerunDiffProgress(rawId, t9LineTaskId, beforeT9Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
        } catch (eAl9) {
          loadError.value = eAl9 instanceof Error ? eAl9.message : String(eAl9);
        }
        return;
      }

      const t85Align = task85L475AlignmentPending.value;
      if (t85Align && String(t85Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t85LineTaskId: AlignmentDynamicsLineTaskId = 'physical_hook_integration_inference';
        await appendAlignmentFeedbackReceivedProgress(rawId, t85LineTaskId, text);
        try {
          const wSyn85 = window as unknown as {
            synthesizeDesignDetailTask85L475DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{ rawOutput?: string; content?: string }>;
          };
          if (typeof wSyn85.synthesizeDesignDetailTask85L475DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask85L475DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT85 = [
            '【原始冲突清单】',
            String(t85Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t85Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT85 = {
            caseId: rawId,
            taskId: designLinePillLabel('physical_hook_integration_inference'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK85_L475_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT85 = await withLlmAuditCtx(synAuditCtxT85, () =>
            wSyn85.synthesizeDesignDetailTask85L475DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT85 },
              designDetailLlmFetchOpts(synAuditCtxT85),
            ),
          );
          writeTask85L475DeepInsightText(rawId, String(synResT85.rawOutput || synResT85.content || '').trim());
          writeTask85L475UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t85LineTaskId,
              t85Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task85L475AlignmentPending.value = null;
          messages = [
            ...messages,
            { role: 'user', content: text, timestamp: formatChatTimestampForMessage() },
          ];
          persistChatMessages(chatKey, messages);
          const cardsA85 = cloneDynamics();
          const c85p = cardsA85.find((c) => c.lineTaskId === 'physical_hook_integration_inference');
          if (c85p) {
            appendLineToCard(c85p, TASK85_L475_ALIGNMENT_SYNTH_DONE_LINE, 'default', {
              startFullyRevealed: true,
            });
          }
          dynamicsCards.value = cardsA85;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          const beforeT85Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t85LineTaskId);
          const epochAlignRerun85 = designDetailSessionGeneration;
          await runTask85PhysicalHookPipelineImpl(
            rawId,
            epochAlignRerun85,
            takeDesignDetailLlmAbortController(),
            mergedItem,
            { deferDebugContinue: true, deferAlignmentQuestionnaire: true },
          );
          await appendAlignmentRerunDiffProgress(rawId, t85LineTaskId, beforeT85Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
        } catch (eAl85) {
          loadError.value = eAl85 instanceof Error ? eAl85.message : String(eAl85);
        }
        return;
      }

      const t8Align = task8L45AlignmentPending.value;
      if (t8Align && String(t8Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t8LineTaskId: AlignmentDynamicsLineTaskId = 'role_object_stm_inference';
        await appendAlignmentFeedbackReceivedProgress(rawId, t8LineTaskId, text);
        try {
          const wSyn8 = window as unknown as {
            synthesizeDesignDetailTask8L45DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{ rawOutput?: string; content?: string }>;
          };
          if (typeof wSyn8.synthesizeDesignDetailTask8L45DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask8L45DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT8 = [
            '【原始冲突清单】',
            String(t8Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t8Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT8 = {
            caseId: rawId,
            taskId: designLinePillLabel('role_object_stm_inference'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK8_L45_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT8 = await withLlmAuditCtx(synAuditCtxT8, () =>
            wSyn8.synthesizeDesignDetailTask8L45DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT8 },
              designDetailLlmFetchOpts(synAuditCtxT8),
            ),
          );
          writeTask8L45DeepInsightText(rawId, String(synResT8.rawOutput || synResT8.content || '').trim());
          writeTask8L45UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t8LineTaskId,
              t8Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task8L45AlignmentPending.value = null;
          messages = [
            ...messages,
            { role: 'user', content: text, timestamp: formatChatTimestampForMessage() },
          ];
          persistChatMessages(chatKey, messages);
          const cardsA8 = cloneDynamics();
          const c8p = cardsA8.find((c) => c.lineTaskId === 'role_object_stm_inference');
          if (c8p) {
            appendLineToCard(c8p, TASK8_L45_ALIGNMENT_SYNTH_DONE_LINE, 'default', {
              startFullyRevealed: true,
            });
          }
          dynamicsCards.value = cardsA8;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          const beforeT8Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t8LineTaskId);
          const epochAlignRerun8 = designDetailSessionGeneration;
          await runTask8L45PrototypePipeline(
            rawId,
            epochAlignRerun8,
            takeDesignDetailLlmAbortController(),
            mergedItem,
            { deferDebugContinue: true, deferAlignmentQuestionnaire: true },
          );
          await appendAlignmentRerunDiffProgress(rawId, t8LineTaskId, beforeT8Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
        } catch (eAl8) {
          loadError.value = eAl8 instanceof Error ? eAl8.message : String(eAl8);
        }
        return;
      }

      const t7Align = task7L4AlignmentPending.value;
      if (t7Align && String(t7Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t7LineTaskId: AlignmentDynamicsLineTaskId = 'key_requirement_scenarios';
        await appendAlignmentFeedbackReceivedProgress(rawId, t7LineTaskId, text);
        try {
          const wSyn7 = window as unknown as {
            synthesizeDesignDetailTask7L4DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{ rawOutput?: string; content?: string }>;
          };
          if (typeof wSyn7.synthesizeDesignDetailTask7L4DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask7L4DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT7 = [
            '【原始冲突清单】',
            String(t7Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t7Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT7 = {
            caseId: rawId,
            taskId: designLinePillLabel('key_requirement_scenarios'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK7_L4_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT7 = await withLlmAuditCtx(synAuditCtxT7, () =>
            wSyn7.synthesizeDesignDetailTask7L4DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT7 },
              designDetailLlmFetchOpts(synAuditCtxT7),
            ),
          );
          writeTask7L4DeepInsightText(rawId, String(synResT7.rawOutput || synResT7.content || '').trim());
          writeTask7L4UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t7LineTaskId,
              t7Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task7L4AlignmentPending.value = null;
          messages = [
            ...messages,
            { role: 'user', content: text, timestamp: formatChatTimestampForMessage() },
          ];
          persistChatMessages(chatKey, messages);
          const cardsA7 = cloneDynamics();
          const c7p = cardsA7.find((c) => c.lineTaskId === 'key_requirement_scenarios');
          if (c7p) {
            appendLineToCard(c7p, TASK7_L4_ALIGNMENT_SYNTH_DONE_LINE, 'default', {
              startFullyRevealed: true,
            });
          }
          dynamicsCards.value = cardsA7;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          const beforeT7Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t7LineTaskId);
          const epochAlignRerun7 = designDetailSessionGeneration;
          await runTask7L4CollaborationPipeline(
            rawId,
            epochAlignRerun7,
            takeDesignDetailLlmAbortController(),
            mergedItem,
            { deferDebugContinue: true, deferAlignmentQuestionnaire: true },
          );
          await appendAlignmentRerunDiffProgress(rawId, t7LineTaskId, beforeT7Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
        } catch (eAl7) {
          loadError.value = eAl7 instanceof Error ? eAl7.message : String(eAl7);
        }
        return;
      }

      const t10Align = task10L5AlignmentPending.value;
      if (t10Align && String(t10Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t10LineTaskId: AlignmentDynamicsLineTaskId = 'process_type_derivation';
        await appendAlignmentFeedbackReceivedProgress(rawId, t10LineTaskId, text);
        try {
          const wSyn10 = window as unknown as {
            synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{
              rawOutput?: string;
              content?: string;
            }>;
          };
          if (typeof wSyn10.synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT10 = [
            '【原始冲突清单】',
            String(t10Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t10Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT10 = {
            caseId: rawId,
            taskId: designLinePillLabel('process_type_derivation'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK10_L5_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT10 = await withLlmAuditCtx(synAuditCtxT10, () =>
            wSyn10.synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT10 },
              designDetailLlmFetchOpts(synAuditCtxT10),
            ),
          );
          const deepTextT10 = String(synResT10.rawOutput || synResT10.content || '').trim();
          writeTask10L5DeepInsightText(rawId, deepTextT10);
          writeTask10L5UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t10LineTaskId,
              t10Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task10L5AlignmentPending.value = null;
          const tsT10 = formatChatTimestampForMessage();
          messages = [...messages, { role: 'user', content: text, timestamp: tsT10 }];
          persistChatMessages(chatKey, messages);
          const cardsA10 = cloneDynamics();
          const c10p = cardsA10.find((c) => c.lineTaskId === 'process_type_derivation');
          if (c10p) {
            appendLineToCard(c10p, TASK10_L5_ALIGNMENT_SYNTH_DONE_LINE, 'default', {
              startFullyRevealed: true,
            });
          }
          dynamicsCards.value = cardsA10;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          loadError.value = null;
          const beforeT10Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t10LineTaskId);
          const epochAlignRerun10 = designDetailSessionGeneration;
          const task10LlmAbortAlign = takeDesignDetailLlmAbortController();
          await runTask10L5TechnicalDdlPipeline(rawId, epochAlignRerun10, task10LlmAbortAlign, mergedItem, {
            deferDebugContinue: true,
            deferAlignmentQuestionnaire: true,
          });
          await appendAlignmentRerunDiffProgress(rawId, t10LineTaskId, beforeT10Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
          await scheduleDebugContinueAfterTask10ToTask11IfReady(rawId, mergedItem, {
            forceAfterTask10Success: true,
          });
        } catch (eAl10) {
          loadError.value = eAl10 instanceof Error ? eAl10.message : String(eAl10);
        }
        return;
      }

      const t65Align = task65L3AlignmentPending.value;
      if (t65Align && String(t65Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t65LineTaskId: AlignmentDynamicsLineTaskId = 'three_dimension_itgap_analysis';
        const t65SubLabel = String(t65Align.progressLabel || '').trim();
        const t65ResumeStepIndex = t65Align.stepIndex;
        const t65ResumeOutputs = [...t65Align.perStepRawOutputs];
        if (t65SubLabel) {
          await pushTask65SubtaskAlignmentProgressSerial(rawId, t65SubLabel, [
            { full: ALIGNMENT_FEEDBACK_RECEIVED_LINE, kind: 'default', startFullyRevealed: true },
            {
              full: formatAlignmentUserFeedbackProgressText(text),
              kind: 'alignment_user_feedback_sub',
              startFullyRevealed: true,
            },
          ]);
        } else {
          await appendAlignmentFeedbackReceivedProgress(rawId, t65LineTaskId, text);
        }
        try {
          const wSyn65 = window as unknown as {
            synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{
              rawOutput?: string;
              content?: string;
            }>;
          };
          if (typeof wSyn65.synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT65 = [
            '【当前工位】',
            t65SubLabel || '（未指定）',
            '',
            '【原始冲突清单】',
            String(t65Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t65Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT65 = {
            caseId: rawId,
            taskId: designLinePillLabel('three_dimension_itgap_analysis'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK6_L3_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT65 = await withLlmAuditCtx(synAuditCtxT65, () =>
            wSyn65.synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT65 },
              designDetailLlmFetchOpts(synAuditCtxT65),
            ),
          );
          const deepTextT65 = String(synResT65.rawOutput || synResT65.content || '').trim();
          if (t65SubLabel && deepTextT65) {
            appendTask65L3DeepInsightSection(rawId, t65SubLabel, deepTextT65);
          }
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t65LineTaskId,
              t65Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task65L3AlignmentPending.value = null;
          messages = [
            ...messages,
            { role: 'user', content: text, timestamp: formatChatTimestampForMessage() },
          ];
          persistChatMessages(chatKey, messages);
          if (t65SubLabel) {
            await pushTask65SubtaskAlignmentProgressSerial(rawId, t65SubLabel, [
              { full: TASK65_L3_ALIGNMENT_SYNTH_DONE_LINE, kind: 'default', startFullyRevealed: true },
            ]);
          } else {
            const cardsA65 = cloneDynamics();
            const c65p = cardsA65.find((c) => c.lineTaskId === 'three_dimension_itgap_analysis');
            if (c65p) {
              appendLineToCard(c65p, TASK65_L3_ALIGNMENT_SYNTH_DONE_LINE, 'default', {
                startFullyRevealed: true,
              });
            }
            dynamicsCards.value = cardsA65;
            ensureRevealTicker(rawId);
            await flushPersistDesignDetailProgressWorkspace(rawId);
          }
          queuePersistDesignDetailProgressWorkspace();
          loadError.value = null;
          const beforeT65Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t65LineTaskId);
          const epochAlignRerun65 = designDetailSessionGeneration;
          const task65LlmAbortAlign = takeDesignDetailLlmAbortController();
          await runTask65ItGapPipeline(
            rawId,
            epochAlignRerun65,
            task65LlmAbortAlign,
            mergedItem,
            {
              deferDebugContinue: true,
              deferAlignmentQuestionnaire: true,
              task65ResumeFrom: {
                stepIndex: t65ResumeStepIndex,
                perStepRawOutputs: t65ResumeOutputs,
              },
              task65SkipIntro: true,
            },
          );
          await appendAlignmentRerunDiffProgress(rawId, t65LineTaskId, beforeT65Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
          await continuePipelineAfterTask65SegmentForExperience(rawId, mergedItem, epochAlignRerun65);
        } catch (eAl65) {
          loadError.value = eAl65 instanceof Error ? eAl65.message : String(eAl65);
        }
        return;
      }

      const t6Align = task6L3AlignmentPending.value;
      if (t6Align && String(t6Align.caseId).trim() === rawId) {
        loadError.value = null;
        const t6LineTaskId: AlignmentDynamicsLineTaskId = 'pain_point_extraction';
        await appendAlignmentFeedbackReceivedProgress(rawId, t6LineTaskId, text);
        try {
          const wSyn6 = window as unknown as {
            synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply?: (
              payload: Record<string, unknown>,
              fetchOpts?: { signal?: AbortSignal },
            ) => Promise<{
              rawOutput?: string;
              content?: string;
              usage?: Record<string, unknown>;
              model?: string;
              durationMs?: number;
            }>;
          };
          if (typeof wSyn6.synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply !== 'function') {
            loadError.value =
              '深访合成脚本未加载（synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply）';
            return;
          }
          const synthesisUserBlockT6 = [
            '【原始冲突清单】',
            String(t6Align.conflictDatasetUserBlock || '').trim(),
            '',
            '【对齐问卷（Agent 展示稿）】',
            String(t6Align.questionnaireMarkdown || '').trim(),
            '',
            '【用户对齐回复】',
            String(text || '').trim(),
          ].join('\n');
          const synAuditCtxT6 = {
            caseId: rawId,
            taskId: designLinePillLabel('pain_point_extraction'),
            callTarget: DESIGN_DETAIL_LLM_CALL_TARGET_TASK6_L3_DEEP_INSIGHT_SYNTHESIS,
          };
          const synResT6 = await withLlmAuditCtx(synAuditCtxT6, () =>
            wSyn6.synthesizeDesignDetailTask6L3DeepInsightFromAlignmentReply!(
              { alignmentSynthesisUserBlock: synthesisUserBlockT6 },
              designDetailLlmFetchOpts(synAuditCtxT6),
            ),
          );
          const deepTextT6 = String(synResT6.rawOutput || synResT6.content || '').trim();
          writeTask6L3DeepInsightText(rawId, deepTextT6);
          writeTask6L3UserRectificationText(rawId, text);
          if (
            !(await ensureTask1ValidationResolvedBeforeAlignmentRerun(
              rawId,
              t6LineTaskId,
              t6Align.painPointTargetFeatureIds,
            ))
          ) {
            return;
          }
          task6L3AlignmentPending.value = null;
          const tsT6 = formatChatTimestampForMessage();
          messages = [...messages, { role: 'user', content: text, timestamp: tsT6 }];
          persistChatMessages(chatKey, messages);
          const cardsA6 = cloneDynamics();
          const c6p = cardsA6.find((c) => c.lineTaskId === 'pain_point_extraction');
          if (c6p) {
            appendLineToCard(c6p, TASK6_L3_ALIGNMENT_SYNTH_DONE_LINE, 'default', { startFullyRevealed: true });
          }
          dynamicsCards.value = cardsA6;
          ensureRevealTicker(rawId);
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
          loadError.value = null;
          const beforeT6Snap = await fetchAlignmentFeatureSnapshotForCase(rawId, t6LineTaskId);
          const epochAlignRerun6 = designDetailSessionGeneration;
          const task6LlmAbortAlign = takeDesignDetailLlmAbortController();
          await runTask6L3ScenarioPipeline(rawId, epochAlignRerun6, task6LlmAbortAlign, mergedItem, {
            deferDebugContinue: true,
            deferAlignmentQuestionnaire: true,
          });
          await appendAlignmentRerunDiffProgress(rawId, t6LineTaskId, beforeT6Snap);
          await flushDeferredAlignmentQuestionnaireIfAny(rawId);
          await continuePipelineAfterTask6SegmentForExperience(rawId, mergedItem, epochAlignRerun6);
        } catch (eAl6) {
          loadError.value = eAl6 instanceof Error ? eAl6.message : String(eAl6);
        }
        return;
      }

      const crPhase = task1CustomerRequirementPhase.value;
      const supplementPending = dynamicsHasRequirementSupplementPromptChoice();
      const gateReq = canDesignPageRunTask1CustomerRequirementParse(
        mergedItem,
        messages,
        text,
        crPhase,
        supplementPending,
      );
      const gateBasic = canDesignPageRunTask1BasicInfoExtract(mergedItem, messages, text, crPhase, supplementPending);
      const gateProgress = canDesignPageRunTask1ProgressChatInput(
        mergedItem,
        messages,
        text,
        crPhase,
        supplementPending,
      );

      if (
        anyDynamicsCardAwaitingAlignmentReply(dynamicsCards.value, ALIGNMENT_PENDING_RESTORE_SPECS) &&
        !hasAnyAlignmentPendingRef()
      ) {
        loadError.value =
          '进度区仍有待回复的深访问卷，但会话状态未恢复；请刷新页面后重新提交回复。';
        return;
      }

      if (gateReq.ok) {
        loadError.value = null;
        let msgs = pruneTrailingUnconfirmedBasicInfoForDesignResubmit(messages);
        if (msgs.length !== messages.length) {
          persistChatMessages(chatKey, msgs);
        }
        const reqRes = await runDesignDetailCustomerRequirementSubmit({
          rawId,
          chatKey,
          messages: msgs,
          userText: text,
          mergedItem,
        });
        messages = reqRes.messages;
        if (!reqRes.ok) {
          loadError.value = reqRes.error || '客户需求提炼失败';
        } else {
          loadError.value = null;
        }
        return;
      }

      if (gateBasic.ok) {
        loadError.value = null;
        let msgs = pruneTrailingUnconfirmedBasicInfoForDesignResubmit(messages);
        if (msgs.length !== messages.length) {
          persistChatMessages(chatKey, msgs);
        }
        const extRes = await runDesignDetailTask1BusinessInfoExtractSubmit({
          rawId,
          chatKey,
          messages: msgs,
          userText: text,
        });
        messages = extRes.messages;
        if (!extRes.ok) {
          loadError.value = extRes.error || '经营信息提炼失败';
        } else {
          loadError.value = null;
        }
        return;
      }

      if (gateProgress.ok && hasAnyAlignmentPendingRef()) {
        loadError.value = '请先完成进度区深访问卷回复（勿将问卷回复当作普通聊天发送）。';
        return;
      }

      if (gateProgress.ok) {
        loadError.value = null;
        let msgs = pruneTrailingUnconfirmedBasicInfoForDesignResubmit(messages);
        if (msgs.length !== messages.length) {
          persistChatMessages(chatKey, msgs);
        }
        const ts = formatChatTimestampForMessage();
        msgs = [...msgs, { role: 'user', content: text, timestamp: ts }];
        persistChatMessages(chatKey, msgs);
        const mergedForBi = mergeResolvedItemForDesign(mergedItem) || mergedItem;
        const basicInfoForBmc = (mergedForBi.basicInfo as Record<string, unknown> | undefined) ?? {};
        const bmcRes = await runDesignDetailBmcChain({
          rawId,
          mergedItem,
          chatKey,
          messages: msgs,
          userSupplementText: text,
          basicInfoForBmc,
        });
        if (bmcRes.scriptMissing) {
          loadError.value = 'bmc 生成脚本未加载，请刷新页面后重试。';
        } else if (bmcRes.error) {
          loadError.value = bmcRes.error;
        } else {
          loadError.value = null;
        }
        await runHydrationCycle();
        return;
      }

      loadError.value =
        gateBasic.reason === 'not_basic_info_like'
          ? '当前内容既不是工商照面格式，也无法在本任务阶段写入（如初需跟进等），请到案例详情页继续。'
          : '当前阶段无法在此写入，请到案例详情页对应任务继续。';
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e);
    } finally {
      sendBusy.value = false;
    }
  }

  const selectRestartStageOptions = computed(() => {
    const item = lastResolvedItem.value;
    const messages = (lastHydratedMessages.value ?? []) as Array<Record<string, unknown>>;
    const t1Done =
      item != null
        ? isTaskCompleted(item, TASK1_ID, messages) ||
          getLatestCustomerRequirementParsed(messages) != null
        : false;
    return listCompletedDesignLineTasksForSelectRestart(
      currentDesignLineTaskId.value,
      dynamicsCards.value,
      t1Done,
    );
  });

  /**
   * 设计页按锚点重启（「重启当前」与「选择重启」共用，口径见 `designDetailRestartScope.ts`）：
   * - **重启当前**（`source: current`）：仅清空**当前线步 X** 的推理图 / LLM 审计 / 修订记录等；保留 X 之后线步数据。
   * - **选择重启**（`source: select`）：清空 **Y 及之后** 线步产物；保留 Y 之前数据。
   * 任务进展工作区快照均整表删除后重 hydrate；聊天修剪见 `pruneDesignDetailPersistedChatForRestartAtLineTask`。
   * **不**调用 `SmartCto.problemDetailRestart`。
   */
  async function restartDesignDetailFromLineTaskAnchor(
    restartAnchor: Exclude<DesignDetailLineTaskId, 'all_done'>,
    source: 'current' | 'select' = 'current',
  ): Promise<void> {
    const rawId = String(caseIdRef.value || '').trim();
    if (!rawId || restartBusy.value || fullRestartBusy.value) return;

    restartBusy.value = true;
    loadError.value = null;
    const restartScope = resolveDesignDetailRestartScope(source);
    const currentLineBeforeRestart =
      currentDesignLineTaskId.value && currentDesignLineTaskId.value !== 'all_done'
        ? currentDesignLineTaskId.value
        : restartAnchor;
    const useSelectiveWorkspaceRetain =
      source === 'select' &&
      restartAnchor !== 'customer_basic' &&
      restartAnchor !== 'optional_toolbox_primitive';
    const workspacePruneSteps = useSelectiveWorkspaceRetain
      ? resolveRestartWorkspacePruneLineSteps(restartAnchor, currentLineBeforeRestart)
      : [];
    /** 清库前捕获：内存动态卡 + 工作区快照 + 画布 Tab，避免仅 clone 内存导致前置任务进度/绘制丢失 */
    const liveDynamicsBeforeRestart = cloneDynamics();
    const progressWsPayloadBeforeClear = await fetchDesignDetailProgressWorkspacePayload(rawId);
    const progressWsSnapBeforeClear = progressWsPayloadBeforeClear
      ? parseDesignDetailProgressSnapshot(progressWsPayloadBeforeClear)
      : null;
    const canvasTabsBeforeRestart = designCanvasTabs.value.map((t) => ({ ...t }));
    const task51RawBeforeRestart =
      task51L3MatrixRawOutput.value.trim() ||
      String(progressWsSnapBeforeClear?.task51L3MatrixRawOutput ?? '').trim();
    const restartDynamicsSnapshot = buildRestartMergedDynamicsSnapshot(
      liveDynamicsBeforeRestart,
      progressWsSnapBeforeClear,
    );
    try {
      try {
        console.info('[design-detail:restart-at-anchor]', {
          phase: 'start',
          source,
          restartScope,
          caseId: rawId,
          restartAnchor,
          sliceSteps: resolveRestartAffectedLineSteps(restartAnchor, restartScope),
          liveDynCardCount: liveDynamicsBeforeRestart.length,
          wsDynCardCount: progressWsSnapBeforeClear?.dynamicsCards.length ?? 0,
          mergedDynCardCount: restartDynamicsSnapshot.length,
        });
      } catch {
        /* ignore */
      }

      abortDesignDetailInFlightLlm('design_detail_restart_current');
      bumpDesignDetailSessionGeneration();
      pendingDebugPipelineContinueAction.value = null;
      task2L1AlignmentPending.value = null;
      task2L1AlignmentQuestionnaireBusy.value = false;
      task3L2AlignmentPending.value = null;
      task3L2AlignmentQuestionnaireBusy.value = false;
      task4L2AlignmentPending.value = null;
      task4L2AlignmentQuestionnaireBusy.value = false;
      task5L3AlignmentPending.value = null;
      task5L3AlignmentQuestionnaireBusy.value = false;
      task51L3AlignmentPending.value = null;
      task51L3AlignmentQuestionnaireBusy.value = false;
      task55L3AlignmentPending.value = null;
      task55L3AlignmentQuestionnaireBusy.value = false;
      task6L3AlignmentPending.value = null;
      task6L3AlignmentQuestionnaireBusy.value = false;
      task65L3AlignmentPending.value = null;
      task65L3AlignmentQuestionnaireBusy.value = false;
      task7L4AlignmentPending.value = null;
      task7L4AlignmentQuestionnaireBusy.value = false;
      task8L45AlignmentPending.value = null;
      task8L45AlignmentQuestionnaireBusy.value = false;
      task85L475AlignmentPending.value = null;
      task85L475AlignmentQuestionnaireBusy.value = false;
      task9L5AlignmentPending.value = null;
      task9L5AlignmentQuestionnaireBusy.value = false;
      task10L5AlignmentPending.value = null;
      task10L5AlignmentQuestionnaireBusy.value = false;
      deferredAlignmentQuestionnaireJob.value = null;
      clearDesignDetailAlignmentLocalStoresFromAnchor(rawId, restartAnchor, restartScope);
      if (shouldClearDesignReportNarrativeOnRestart(restartAnchor, restartScope)) {
        clearDesignReportNarrativeCache(rawId);
        ensureArchitectureInventoryTab();
        setActiveArchitectureInventoryTab();
        designReportContentRefreshTick.value += 1;
        designReportSubTabFocusTick.value += 1;
        architectureInventoryGraphRefreshTick.value += 1;
        await refreshDesignReportCanvasFromCache(rawId);
      }
      const epochAfterBump = designDetailSessionGeneration;

      appliedProgressWorkspaceMessagesFp = null;
      if (!useSelectiveWorkspaceRetain) {
        await clearDesignDetailProgressWorkspace(rawId);
      } else {
        try {
          console.info('[design-detail:restart-workspace]', {
            phase: 'selective_retain_skip_full_delete',
            caseId: rawId,
            restartAnchor,
            currentLineBeforeRestart,
            workspacePruneSteps,
            preservedLineCount: restartDynamicsSnapshot.filter((c) => {
              const i = designLineTaskIndexInOrder(
                c.lineTaskId as Exclude<DesignDetailLineTaskId, 'all_done'>,
              );
              const a = designLineTaskIndexInOrder(restartAnchor);
              return i >= 0 && a >= 0 && i < a;
            }).length,
          });
        } catch {
          /* ignore */
        }
      }

      const bundle = await refreshBundle(rawId);
      if (!bundle?.item) {
        loadError.value = '无法加载案例或无权访问';
        return;
      }
      const item = mergeResolvedItemForDesign(bundle.item) || bundle.item;
      lastResolvedItem.value = item;
      const chatKey = getProblemDetailChatStorageKey(item);
      let messages = Array.isArray(bundle.messages) ? bundle.messages.slice() : [];

      if (chatKey) {
        const pruned = pruneDesignDetailPersistedChatForRestartAtLineTask(restartAnchor, messages);
        if (
          restartAnchor === 'customer_basic' &&
          !pruned.some((m) => m?.type === 'taskStartNotification' && String(m.taskId || '') === TASK1_ID)
        ) {
          const startMsg = buildTaskStartNotificationMessage();
          startMsg.confirmed = true;
          pruned.push(startMsg);
        }
        persistChatMessages(chatKey, pruned);
        messages = pruned;
      }

      if (isOnlineMode()) {
        const taskIds = buildTaskGraphDeleteTaskIdsForRestart(restartAnchor, restartScope);
        const api = (
          window as unknown as {
            SmartCto?: {
              problemCaseApi?: {
                deleteDesignDetailTaskGraph?: (caseId: string, taskId: string) => Promise<unknown>;
                clearDesignDetailInferenceRevisionRecords?: (
                  caseId: string,
                  body: { scope: 'line_step' | 'from_line_step'; lineStepId: string },
                ) => Promise<{ ok?: boolean; deleted?: number }>;
                resetDesignDetailTask1PainPointConfirmed?: (
                  caseId: string,
                  body: { scope: 'line_step' | 'from_line_step' | 'all'; lineStepId?: string },
                ) => Promise<{ ok?: boolean; updated?: number }>;
                postClearCaseLlmLogsByTaskIds?: (
                  caseId: string,
                  ids: string[],
                ) => Promise<{ ok?: boolean; deleted?: number }>;
              };
            };
          }
        ).SmartCto?.problemCaseApi;
        const resetPainFn = api?.resetDesignDetailTask1PainPointConfirmed;
        if (typeof resetPainFn === 'function') {
          const painScope =
            restartAnchor === 'customer_basic' ? 'all' : source === 'current' ? 'line_step' : 'from_line_step';
          const shouldResetPain =
            painScope === 'all' ||
            lineStepIdsForPainPointResetOnRestart(restartAnchor, restartScope).length > 0;
          if (shouldResetPain) {
            try {
              await resetPainFn(rawId, {
                scope: painScope,
                ...(painScope !== 'all' ? { lineStepId: restartAnchor } : {}),
              });
            } catch (e) {
              console.warn('[design-detail] reset task1 pain-point-confirmed on restart failed', e);
            }
          }
        }
        const clearRevisionFn = api?.clearDesignDetailInferenceRevisionRecords;
        if (
          typeof clearRevisionFn === 'function' &&
          isDesignDetailInferenceRevisionRestartLineStep(restartAnchor)
        ) {
          try {
            const revRes = await clearRevisionFn(rawId, {
              scope: source === 'current' ? 'line_step' : 'from_line_step',
              lineStepId: restartAnchor,
            });
            console.info('[design-detail:restart-inference-revision-clear]', {
              caseId: rawId,
              restartAnchor,
              source,
              clientClearReturn: revRes,
            });
          } catch (e) {
            console.warn('[design-detail] clear inference-revision on restart failed', e);
          }
        }
        const delFn = api?.deleteDesignDetailTaskGraph;
        if (typeof delFn === 'function') {
          for (const tid of taskIds) {
            try {
              await delFn(rawId, tid);
            } catch (e) {
              console.warn('[design-detail] delete task-graph on restart failed', tid, e);
            }
          }
        }
        const clearLlmFn = api?.postClearCaseLlmLogsByTaskIds;
        if (typeof clearLlmFn === 'function') {
          try {
            const idsToClear = buildLlmLogTaskIdsForRestart(restartAnchor, restartScope);
            console.info('[design-detail:restart-llm-clear]', {
              caseId: rawId,
              restartAnchor,
              restartScope,
              taskIdCount: idsToClear.length,
              taskIdHead: idsToClear.slice(0, 12),
            });
            if (idsToClear.length > 0) {
              const clearRes = await clearLlmFn(rawId, idsToClear);
              console.info('[design-detail:restart-llm-clear]', {
                caseId: rawId,
                clientClearReturn: clearRes,
              });
            }
          } catch (e) {
            console.warn('[design-detail] clear llm logs on restart failed', e);
          }
        } else {
          console.info('[design-detail:restart-llm-clear]', {
            caseId: rawId,
            skip: 'postClearCaseLlmLogsByTaskIds_missing',
            hint: '检查 SmartCto.problemCaseApi 是否挂载（problem-case-api.js）',
          });
        }
      }

      clearRevealInterval();
      lastProgressTailFingerprint = '';
      designOnlyProgressTail.value = [];
      pendingStreamAdvance = null;

      if (restartAnchor === 'customer_basic') {
        resetDesignCanvasWorkspace();
        saveDesignDetailCustomerRequirementPhase(rawId, 'idle');
        task1CustomerRequirementPhase.value = 'idle';
      } else {
        saveDesignDetailCustomerRequirementPhase(rawId, 'completed');
        task1CustomerRequirementPhase.value = 'completed';
      }

      designDynamicsSuppressPersistedReplay.value = true;

      ensureDesignDetailLineRecord(rawId, item, messages);
      const t1DoneCanonical = isTaskCompleted(item, TASK1_ID, messages);
      /** 与 `designDetailLineState.reconcile` 护栏一致：锚点非任务 1 时，全案 `isTaskCompleted(task1)` 假阴性但聊天仍含需求提炼 JSON → 视为任务 1 已收口，避免 `dynamicsCards=[]` 且不跑任务 2 kickoff */
      const t1Done =
        t1DoneCanonical ||
        (restartAnchor !== 'customer_basic' &&
          restartAnchor !== 'all_done' &&
          getLatestCustomerRequirementParsed(messages as Array<Record<string, unknown>>) != null);

      /** 不在此处 `reconcile`：推断结果会写盘且可能与用户当前锚点（如任务 2）短暂不一致；锚点以下行由 `saveDesignDetailLineState` 与 ref 显式写回 */
      if (restartAnchor === 'process_node_design') {
        saveLineStepHoldThroughTask10(rawId, 'process_node_design');
      } else {
        saveDesignDetailLineState(rawId, {
          schemaVersion: 1,
          currentTaskId: restartAnchor,
          holdPastTask3: false,
          holdPastTask4: false,
          holdPastTask5: false,
          holdPastTask51: false,
          holdPastTask52: false,
          holdPastTask53: false,
          holdPastTask55: false,
          holdPastTask6: false,
          holdPastTask7: false,
          holdPastTask8: false,
          holdPastTask85: false,
          holdPastTask9: false,
          holdPastTask10: false,
        });
      }
      currentDesignLineTaskId.value = restartAnchor;

      if (restartAnchor === 'customer_basic') {
        const priorOrdered = buildPriorDynamicsPreservingCompletedSteps(
          'customer_basic',
          restartDynamicsSnapshot,
          messages as Array<Record<string, unknown>>,
          item,
          { injectCatchUpTask1IfMissing: false },
        );
        dynamicsCards.value = [...priorOrdered, makeCard()];
        ensureRevealTicker(rawId);
      } else if (restartAnchor === 'optional_toolbox_primitive' && !t1Done) {
        task0AutoAdvanceDone = false;
        task0FinalizeInFlight = false;
        await bootstrapTask0ForDesignCase(rawId);
      } else if (!t1Done) {
        dynamicsCards.value = [];
      } else {
        const anchorStep = restartAnchor as Exclude<DesignDetailLineTaskId, 'all_done'>;
        const priorOrdered = fillMissingPriorDynamicsBeforeRestartAnchor(
          anchorStep,
          buildPriorDynamicsPreservingCompletedSteps(
            anchorStep,
            restartDynamicsSnapshot,
            messages as Array<Record<string, unknown>>,
            item,
          ),
          messages as Array<Record<string, unknown>>,
          item,
          t1Done,
        );
        const fresh = makeFreshLineTaskDynamicsCard(anchorStep);
        dynamicsCards.value = [...priorOrdered, fresh];
        if (useSelectiveWorkspaceRetain) {
          pruneWorkspaceMemoryFieldsForSelectRestart(workspacePruneSteps);
        }
        ensureRevealTicker(rawId);
      }

      const restartAffectedStepsForCanvas = resolveRestartAffectedLineSteps(restartAnchor, restartScope);

      if (restartAnchor !== 'customer_basic' && t1Done) {
        rehydrateDesignCanvasTabsKeepTask1(rawId, item, messages as Array<Record<string, unknown>>);
        await restoreDesignCanvasPriorToRestartAnchor(
          rawId,
          restartAffectedStepsForCanvas,
          canvasTabsBeforeRestart,
          task51RawBeforeRestart,
        );
        /** 画布已从聊天拉回后，继续抑制「任务动态」hydrate 回放，避免与刚清空的进度卡打架；任务 2 kickoff 仍写动态卡 */
        designDynamicsSuppressPersistedReplay.value = true;
      }

      const mergedForPh = mergeResolvedItemForDesign(item) || item;
      if (isTask1ActivePreliminaryFollowupPhaseDesign(messages as Array<Record<string, unknown>>, mergedForPh)) {
        designChatInputPlaceholder.value =
          '当前为初步需求跟进/补充阶段；本页仅展示进度，请在案例详情页聊天区输入。';
      } else if (!t1Done) {
        /** 本函数上文已将阶段写为 `idle`（锚点任务 1）或 `completed`（锚点非任务 1），不会出现 `awaiting` */
        designChatInputPlaceholder.value =
          '可粘贴企业基本工商信息（关键词触发提炼），或发送客户工商及经营范围等描述（本页将提炼为结构化 JSON）。';
      } else {
        designChatInputPlaceholder.value = '描述设计意图或约束…';
      }

      lastHydratedMessages.value = messages as Array<Record<string, unknown>>;
      lastHydratedItem.value = item;
      lastHydratedPreliminaryFollowupActive.value = isTask1ActivePreliminaryFollowupPhaseDesign(
        messages as Array<Record<string, unknown>>,
        item,
      );
      llmStatsIncludeFromMessageIndex.value = messages.length;
      logLlmStatsDiag('restartCurrentTask_llm_stats_reset', {
        rawId,
        messagesLenAfterPrune: messages.length,
        llmStatsSetTo: llmStatsIncludeFromMessageIndex.value,
      });
      bumpLlmLogAuditRefresh();
      logicTreeGraphRefreshTick.value += 1;

      const restartAffectedSteps = restartAffectedStepsForCanvas;
      if (restartAffectedSteps.includes('value_proposition_capability_units')) {
        task51L3MatrixRawOutput.value = '';
        currentStateUnderstandingGraphTasks.value = [];
        currentStateUnderstandingRefreshTick.value += 1;
      } else {
        if (restartAffectedSteps.includes('pain_point_extraction')) {
          if (currentStateUnderstandingGraphTasks.value.length) {
            currentStateUnderstandingGraphTasks.value =
              stripTask6FromGraphTasksForCurrentStateUnderstanding(
                currentStateUnderstandingGraphTasks.value,
              );
            currentStateUnderstandingRefreshTick.value += 1;
          }
        }
        if (
          restartAffectedSteps.some(
            (s) =>
              s === 'capability_field_set_mapping' ||
              s === 'key_scenario_temporal_flow_inference' ||
              s === 'vsm_stage_decomposition' ||
              s === 'pain_point_extraction',
          )
        ) {
          await refreshCurrentStateUnderstandingFromTaskGraph(rawId);
        }
      }

      if (restartAnchor === 'scale_org_mode_extract' && t1Done) {
        const cardsT = cloneDynamics();
        const c2 = cardsT.find((c) => c.lineTaskId === 'scale_org_mode_extract');
        if (c2) {
          appendLineToCard(c2, TASK2_FETCH_GRAPH_INPUT_LINE, 'default', { startFullyRevealed: true });
          dynamicsCards.value = cardsT;
          ensureRevealTicker(rawId);
          if (designDetailProgressPersistTimer) {
            clearTimeout(designDetailProgressPersistTimer);
            designDetailProgressPersistTimer = null;
          }
          await flushPersistDesignDetailProgressWorkspace(rawId);
          queuePersistDesignDetailProgressWorkspace();
        }
        const task2LlmAbort = takeDesignDetailLlmAbortController();
        await runTask2L1EntityPortraitPipeline(rawId, epochAfterBump, task2LlmAbort, item);
      }

      if (restartAnchor === 'industry_business_profile_extract' && t1Done) {
        const task3LlmAbort = takeDesignDetailLlmAbortController();
        await runTask3L2IndustryBusinessPipeline(rawId, epochAfterBump, task3LlmAbort, item);
      }

      if (restartAnchor === 'core_value_driver_inference' && t1Done) {
        const task4LlmAbort = takeDesignDetailLlmAbortController();
        await runTask4L2CoreValueDriverPipeline(rawId, epochAfterBump, task4LlmAbort, item);
      }

      if (restartAnchor === 'macro_process_flow_inference' && t1Done) {
        const task5LlmAbort = takeDesignDetailLlmAbortController();
        await runTask5L3MacroProcessPipeline(rawId, epochAfterBump, task5LlmAbort, item);
      }

      if (restartAnchor === 'value_proposition_capability_units' && t1Done) {
        const task51LlmAbort = takeDesignDetailLlmAbortController();
        await runTask51ValuePropositionPipelineImpl(rawId, epochAfterBump, task51LlmAbort, item);
      }

      if (restartAnchor === 'capability_field_set_mapping' && t1Done) {
        const task52LlmAbort = takeDesignDetailLlmAbortController();
        await runTask52AssetFieldSetPipelineImpl(rawId, epochAfterBump, task52LlmAbort, item);
      }

      if (restartAnchor === 'key_scenario_temporal_flow_inference' && t1Done) {
        const task53LlmAbort = takeDesignDetailLlmAbortController();
        await runTask53WorkflowFlowPipelineImpl(rawId, epochAfterBump, task53LlmAbort, item);
      }

      if (restartAnchor === 'vsm_stage_decomposition' && t1Done) {
        const task55LlmAbort = takeDesignDetailLlmAbortController();
        await runTask55L3VsmStagePipeline(rawId, epochAfterBump, task55LlmAbort, item);
      }

      if (restartAnchor === 'pain_point_extraction' && t1Done) {
        const task6LlmAbort = takeDesignDetailLlmAbortController();
        await runTask6L3ScenarioPipeline(rawId, epochAfterBump, task6LlmAbort, item);
      }

      if (restartAnchor === 'three_dimension_itgap_analysis' && t1Done) {
        const task65LlmAbort = takeDesignDetailLlmAbortController();
        await runTask65ItGapPipeline(rawId, epochAfterBump, task65LlmAbort, item);
      }

      if (restartAnchor === 'key_requirement_scenarios' && t1Done) {
        const task7LlmAbort = takeDesignDetailLlmAbortController();
        await runTask7L4CollaborationPipeline(rawId, epochAfterBump, task7LlmAbort, item);
      }

      if (restartAnchor === 'role_object_stm_inference' && t1Done) {
        const task8LlmAbort = takeDesignDetailLlmAbortController();
        await runTask8L45PrototypePipeline(rawId, epochAfterBump, task8LlmAbort, item);
      }

      if (restartAnchor === 'physical_hook_integration_inference' && t1Done) {
        const task85LlmAbort = takeDesignDetailLlmAbortController();
        await runTask85PhysicalHookPipelineImpl(rawId, epochAfterBump, task85LlmAbort, item);
      }

      if (restartAnchor === 'business_capability_positioning' && t1Done) {
        const task9LlmAbort = takeDesignDetailLlmAbortController();
        await runTask9L5BlueprintPipeline(rawId, epochAfterBump, task9LlmAbort, item);
      }

      if (restartAnchor === 'process_type_derivation' && t1Done) {
        logTask10ArchGate('restart_kick_task10', {
          caseId: rawId,
          epochAfterBump,
          sessionGeneration: designDetailSessionGeneration,
        });
        const task10LlmAbort = takeDesignDetailLlmAbortController();
        await runTask10L5TechnicalDdlPipeline(rawId, epochAfterBump, task10LlmAbort, item);
      } else if (restartAnchor === 'process_type_derivation' && !t1Done) {
        logTask10ArchGate('restart_kick_skip_task10_t1_not_done', { caseId: rawId });
      }

      if (restartAnchor === 'process_node_design' && t1Done) {
        try {
          console.info('[design-detail:restart-kick-task11]', {
            caseId: rawId,
            epochAfterBump,
            sessionGeneration: designDetailSessionGeneration,
          });
        } catch {
          /* ignore */
        }
        ensureArchitectureInventoryTab();
        setActiveArchitectureInventoryTab();
        designReportSubTabFocusTick.value += 1;
        const task11LlmAbort = takeDesignDetailLlmAbortController();
        await runTask11AnalysisReportThenMaybeTask12(rawId);
      }

      const lineAfterKickoff = loadDesignDetailLineState(rawId);
      if (lineAfterKickoff?.currentTaskId) {
        currentDesignLineTaskId.value = lineAfterKickoff.currentTaskId;
      } else {
        saveDesignDetailLineState(rawId, {
          schemaVersion: 1,
          currentTaskId: restartAnchor,
          holdPastTask3: false,
          holdPastTask4: false,
        });
        currentDesignLineTaskId.value = restartAnchor;
      }

      if (designDetailDebugGate(DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE)) {
        await reattachDebugPipelineContinueGatesFromLineState(rawId, item);
      }

      if (designDetailProgressPersistTimer) {
        clearTimeout(designDetailProgressPersistTimer);
        designDetailProgressPersistTimer = null;
      }
      await flushPersistDesignDetailProgressWorkspace(rawId);
      queuePersistDesignDetailProgressWorkspace();
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e);
    } finally {
      restartBusy.value = false;
    }
  }

  /** 设计页「重启当前」：锚点为 `currentDesignLineTaskId`，仅清空当前线步 X（见 `designDetailRestartScope.ts`）。 */
  async function restartCurrentTaskFromDesignPage(): Promise<void> {
    const restartAnchor = currentDesignLineTaskId.value;
    if (!restartAnchor || restartAnchor === 'all_done') {
      loadError.value =
        restartAnchor === 'all_done'
          ? '当前已处于全部完成状态；若要回到任务 1 请使用「完全重启」。'
          : '无法解析当前设计线任务，无法重启。';
      return;
    }
    const pill = designLinePillLabel(restartAnchor);
    const subchainHint =
      restartAnchor === 'value_proposition_capability_units' ||
      restartAnchor === 'capability_field_set_mapping' ||
      restartAnchor === 'key_scenario_temporal_flow_inference' ||
      restartAnchor === 'vsm_stage_decomposition'
        ? '\n\n**任务 5.1～5.5**：「重启当前」会同时清空本子链中**该任务及之后至 5.5** 的推理图与 LLM 审计（例如当前 5.3 会连带清除 5.5）；**不会**清除任务 6 及之后（如 8.5）。'
        : '';
    const msg = `将清空**当前任务**「${pill}」的任务进展、LLM 调用日志、逻辑树与逻辑详情，并从该任务第一步重新开始。\n\n**不会**清空之后阶段（如任务 7）的数据；若需回到更早阶段并清除**所选任务及之后全部**产物，请使用「选择重启」或「完全重启」。${subchainHint}\n\n确定继续？`;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(msg)) {
      return;
    }
    await restartDesignDetailFromLineTaskAnchor(restartAnchor, 'current');
  }

  /** 设计页「选择重启」：锚点由用户从已完成阶段列表指定。 */
  async function restartFromSelectedLineTaskAnchor(
    anchor: Exclude<DesignDetailLineTaskId, 'all_done'>,
  ): Promise<void> {
    await restartDesignDetailFromLineTaskAnchor(anchor, 'select');
  }

  /**
   * 设计页「完全重启」：**全案**任务 1 持久化回退 + 同源聊天清空（见 `applyDesignDetailFullSessionResetForCaseId`）；
   * **online**：`DELETE …/design-detail/task-graph` 清空**全部**设计推理图、`POST …/llm-logs/clear` `{ all: true }` 清空**全部**案例 LLM 审计；
   * 删除任务进展工作区、重置画布与 Tab、需求阶段 idle、`designDynamicsSuppressPersistedReplay`；
   * 设计任务线强制为 `optional_toolbox_primitive`（任务 0）；清图后同步工具原语并刷新 Tree 任务 0 层。
   * 与「重启当前」区别：不保留聊天历史（非仅修剪设计块）、清**所有**线步图与审计，不仅当前线步。
   */
  async function fullRestartDesignDetailFromPage(): Promise<void> {
    const rawId = String(caseIdRef.value || '').trim();
    if (!rawId || fullRestartBusy.value || restartBusy.value) {
      logDesignDetailFullRestart('handler_skip_busy_or_no_case', {
        caseId: rawId || null,
        fullRestartBusy: fullRestartBusy.value,
        restartBusy: restartBusy.value,
      });
      return;
    }
    fullRestartBusy.value = true;
    loadError.value = null;
    task0AutoAdvanceDone = false;
    task0FinalizeInFlight = false;
    clearTask0AdvanceWatchdogs();
    pendingStreamAdvance = null;
    logDesignDetailFullRestart('handler_start', { caseId: rawId, online: isOnlineMode() });
    try {
      /** 取消可能尚未返回的任务 2 L1 等 /ai/chat，避免清库后旧请求成功又写入一条审计 */
      const abortedInFlightLlm = abortDesignDetailInFlightLlm('design_detail_full_restart');
      bumpDesignDetailSessionGeneration();
      pendingDebugPipelineContinueAction.value = null;
      /** 须早于 `refreshBundle`/清库：否则轮询 hydrate 可能用任务 3 工作区快照覆盖即将挂载的任务 0 卡 */
      designDynamicsSuppressPersistedReplay.value = true;
      appliedProgressWorkspaceMessagesFp = null;
      logDesignDetailFullRestart('suppress_replay_early', {
        caseId: rawId,
        abortedInFlightLlm,
        sessionGeneration: designDetailSessionGeneration,
        ...diagTask0PipelineState(rawId),
      });
      logDesignDetailFullRestart('after_abort_and_session_bump', {
        caseId: rawId,
        abortedInFlightLlm,
        sessionGeneration: designDetailSessionGeneration,
      });
      await clearDesignDetailProgressWorkspace(rawId);
      logDesignDetailFullRestart('progress_workspace_deleted', { caseId: rawId });
      const okPersist = await applyDesignDetailFullSessionResetForCaseId(rawId);
      logDesignDetailFullRestart('persist_apply_returned', { caseId: rawId, okPersist });
      if (!okPersist) {
        loadError.value = '无法完全重启（未找到案例或存储不可用）';
        return;
      }

      const bundle = await refreshBundle(rawId);
      logDesignDetailFullRestart('bundle_refreshed', {
        caseId: rawId,
        hasItem: !!bundle?.item,
        messagesLen: Array.isArray(bundle?.messages) ? bundle.messages.length : -1,
      });
      if (!bundle?.item) {
        loadError.value = '无法加载案例或无权访问';
        return;
      }

      if (isOnlineMode()) {
        const api = (
          window as unknown as {
            SmartCto?: {
              problemCaseApi?: {
                deleteAllDesignDetailTaskGraph?: (caseId: string) => Promise<{ ok?: boolean } | unknown>;
                postClearCaseLlmLogsAll?: (
                  caseId: string,
                ) => Promise<{ ok?: boolean; deleted?: number } | unknown>;
              };
            };
          }
        ).SmartCto?.problemCaseApi;
        const hasDelAll = typeof api?.deleteAllDesignDetailTaskGraph === 'function';
        const hasClearAll = typeof api?.postClearCaseLlmLogsAll === 'function';
        logDesignDetailFullRestart('online_api_probe', {
          caseId: rawId,
          hasDeleteAllDesignDetailTaskGraph: hasDelAll,
          hasPostClearCaseLlmLogsAll: hasClearAll,
        });
        const resetPainAllFn = api?.resetDesignDetailTask1PainPointConfirmed;
        if (typeof resetPainAllFn === 'function') {
          try {
            await resetPainAllFn(rawId, { scope: 'all' });
          } catch (e) {
            console.warn('[design-detail] reset all pain-point-confirmed on full restart failed', e);
          }
        }
        const delAllFn = api?.deleteAllDesignDetailTaskGraph;
        if (typeof delAllFn === 'function') {
          try {
            const delRes = (await delAllFn(rawId)) as { ok?: boolean; status?: number; message?: string };
            logDesignDetailFullRestart('delete_all_task_graph_done', {
              caseId: rawId,
              ok: delRes?.ok === true,
              status: delRes?.status,
            });
          } catch (e) {
            logDesignDetailFullRestart('delete_all_task_graph_error', {
              caseId: rawId,
              message: e instanceof Error ? e.message : String(e),
            });
            console.warn('[design-detail] delete all task-graph on full restart failed', e);
          }
        }
        const clearAllFn = api?.postClearCaseLlmLogsAll;
        if (typeof clearAllFn === 'function') {
          try {
            const res = (await clearAllFn(rawId)) as { ok?: boolean; deleted?: number; status?: number; message?: string };
            logDesignDetailFullRestart('llm_logs_clear_all_first', {
              caseId: rawId,
              ok: res?.ok === true,
              deleted: typeof res?.deleted === 'number' ? res.deleted : undefined,
              status: res?.status,
            });
          } catch (e) {
            logDesignDetailFullRestart('llm_logs_clear_all_first_error', {
              caseId: rawId,
              message: e instanceof Error ? e.message : String(e),
            });
            console.warn('[design-detail] clear all llm logs on full restart failed', e);
          }
          /** 极少数情况下服务端在清库后才落审计：延迟再清一次并刷新浮层 */
          window.setTimeout(() => {
            void (async () => {
              try {
                const res2 = (await clearAllFn(rawId)) as {
                  ok?: boolean;
                  deleted?: number;
                  status?: number;
                  message?: string;
                };
                logDesignDetailFullRestart('llm_logs_clear_all_delayed', {
                  caseId: rawId,
                  ok: res2?.ok === true,
                  deleted: typeof res2?.deleted === 'number' ? res2.deleted : undefined,
                  status: res2?.status,
                });
              } catch (e2) {
                logDesignDetailFullRestart('llm_logs_clear_all_delayed_error', {
                  caseId: rawId,
                  message: e2 instanceof Error ? e2.message : String(e2),
                });
                console.warn('[design-detail] delayed clear all llm logs failed', e2);
              }
              bumpLlmLogAuditRefresh();
              logDesignDetailFullRestart('llm_audit_refresh_after_delayed_clear', { caseId: rawId });
            })();
          }, 2200);
        } else {
          logDesignDetailFullRestart('llm_logs_clear_all_skipped', {
            caseId: rawId,
            reason: 'postClearCaseLlmLogsAll_missing',
            hint: '设计详情入口应经 `design-detail/main.ts` 打包注入 `frontend/js/core/problem-case-api.js`；若缺失则 `SmartCto.problemCaseApi.postClearCaseLlmLogsAll` 不存在，清审计请求不会发出',
          });
        }
      } else {
        logDesignDetailFullRestart('offline_skip_backend_graph_and_llm_clear', { caseId: rawId });
      }

      await hydrateToolSuiteKnowledgeForDesign();
      const task0PrimitiveCount = buildToolSuitePrimitiveGraphFeatures().length;
      logDesignDetailFullRestart('task0_primitive_hydrate_done', {
        caseId: rawId,
        primitiveCount: task0PrimitiveCount,
      });

      const item = mergeResolvedItemForDesign(bundle.item) || bundle.item;
      lastResolvedItem.value = item;
      const messages = Array.isArray(bundle.messages) ? bundle.messages.slice() : [];

      clearRevealInterval();
      lastProgressTailFingerprint = '';
      designOnlyProgressTail.value = [];
      pendingStreamAdvance = null;
      resetDesignCanvasWorkspace();
      saveDesignDetailCustomerRequirementPhase(rawId, 'idle');
      task1CustomerRequirementPhase.value = 'idle';
      clearTask2L1DeepInsightText(rawId);
      clearTask2L1AlignmentQuestionnaireText(rawId);
      clearTask2L1UserRectificationText(rawId);
      clearTask3L2DeepInsightText(rawId);
      clearTask3L2UserRectificationText(rawId);
      clearTask3L2AlignmentQuestionnaireText(rawId);
      clearTask4L2DeepInsightText(rawId);
      clearTask4L2UserRectificationText(rawId);
      clearTask4L2AlignmentQuestionnaireText(rawId);
      clearTask5L3DeepInsightText(rawId);
      clearTask5L3UserRectificationText(rawId);
      clearTask5L3AlignmentQuestionnaireText(rawId);
      clearTask55L3DeepInsightText(rawId);
      clearTask55L3UserRectificationText(rawId);
      clearTask55L3AlignmentQuestionnaireText(rawId);
      clearTask6L3DeepInsightText(rawId);
      clearTask6L3UserRectificationText(rawId);
      clearTask6L3AlignmentQuestionnaireText(rawId);
      clearTask7L4DeepInsightText(rawId);
      clearTask7L4UserRectificationText(rawId);
      clearTask7L4AlignmentQuestionnaireText(rawId);
      clearTask8L45DeepInsightText(rawId);
      clearTask8L45UserRectificationText(rawId);
      clearTask8L45AlignmentQuestionnaireText(rawId);
      clearTask85L475DeepInsightText(rawId);
      clearTask85L475UserRectificationText(rawId);
      clearTask85L475AlignmentQuestionnaireText(rawId);
      clearTask9L5DeepInsightText(rawId);
      clearTask9L5UserRectificationText(rawId);
      clearTask9L5AlignmentQuestionnaireText(rawId);
      task2L1AlignmentPending.value = null;
      task2L1AlignmentQuestionnaireBusy.value = false;
      task3L2AlignmentPending.value = null;
      task3L2AlignmentQuestionnaireBusy.value = false;
      task4L2AlignmentPending.value = null;
      task4L2AlignmentQuestionnaireBusy.value = false;
      task5L3AlignmentPending.value = null;
      task5L3AlignmentQuestionnaireBusy.value = false;
      task51L3AlignmentPending.value = null;
      task51L3AlignmentQuestionnaireBusy.value = false;
      task55L3AlignmentPending.value = null;
      task55L3AlignmentQuestionnaireBusy.value = false;
      task6L3AlignmentPending.value = null;
      task6L3AlignmentQuestionnaireBusy.value = false;
      designDetailChatDraft.value = '';
      loadError.value = null;

      ensureDesignDetailLineRecord(rawId, item, messages as Array<Record<string, unknown>>);
      /** 完全重启产品口径：设计线从任务 0 开始（勿被推断短暂顶到后续步） */
      currentDesignLineTaskId.value = 'optional_toolbox_primitive';
      saveDesignDetailLineState(rawId, {
        schemaVersion: 1,
        currentTaskId: 'optional_toolbox_primitive',
        holdPastTask3: false,
        holdPastTask4: false,
      });

      dynamicsCards.value = [makeTask0DynamicsCard(task0PrimitiveCount)];
      lastHydratedMessages.value = messages as Array<Record<string, unknown>>;
      lastHydratedItem.value = item;
      lastHydratedPreliminaryFollowupActive.value = isTask1ActivePreliminaryFollowupPhaseDesign(
        messages as Array<Record<string, unknown>>,
        item,
      );
      kickoffTask0StreamAdvance(rawId, 'full_restart');

      llmStatsIncludeFromMessageIndex.value = messages.length;
      logLlmStatsDiag('fullRestartDesignDetail_llm_stats_reset', {
        rawId,
        messagesLen: messages.length,
        llmStatsSetTo: llmStatsIncludeFromMessageIndex.value,
      });
      logDesignDetailFullRestart('handler_ui_reset_done_bump_llm_audit', {
        caseId: rawId,
        currentDesignLineTaskId: currentDesignLineTaskId.value,
        llmStatsIncludeFromMessageIndex: llmStatsIncludeFromMessageIndex.value,
        task0Pipeline: diagTask0PipelineState(rawId),
      });
      bumpLlmLogAuditRefresh();
    } catch (e) {
      logDesignDetailFullRestart('handler_caught_error', {
        caseId: String(caseIdRef.value || '').trim(),
        message: e instanceof Error ? e.message : String(e),
      });
      loadError.value = e instanceof Error ? e.message : String(e);
    } finally {
      fullRestartBusy.value = false;
    }
  }

  /** startPoll 预检时复用已 fetch 的 bundle，避免 runHydrationCycle 重复请求 */
  let _pendingPollBundle: Awaited<ReturnType<typeof refreshBundle>> | null = null;

  function startPoll() {
    if (pollTimer.value) clearInterval(pollTimer.value);
    pollTimer.value = setInterval(async () => {
      /** 轮询时先取本地指纹，只有消息真正变化才走完整 hydration */
      const rawId = String(caseIdRef.value || '').trim();
      if (!rawId) return;
      const localFp = _cachedMsgFp;
      _pendingPollBundle = await refreshBundle(rawId);
      if (!_pendingPollBundle?.messages) return;
      const newFp = buildMessagesFingerprint(_pendingPollBundle.messages as ReadonlyArray<Record<string, unknown>>);
      if (localFp && messagesFingerprintsEqual(localFp, newFp)) {
        _pendingPollBundle = null;
        return; // 无变化，跳过完整 hydration（含 UI 更新）
      }
      _pendingMsgFp = newFp;
      void runHydrationCycle();
      _pendingPollBundle = null;
    }, POLL_MS);
  }

  onMounted(() => {
    const boot = async () => {
      try {
        await ensureDesignDetailTask1ScriptsReady();
      } catch (e) {
        console.warn('[design-detail:task1-scripts] preload on mount failed', e);
      }
      await runHydrationCycle();
      // startPoll(); // TODO: 临时注释掉排查刷新问题
    };
    const go = () => void boot();
    if (isOnlineMode()) {
      const w = window as unknown as Window;
      const run = () => go();
      if ((w as unknown as { __STORAGE_HTTP_HYDRATED?: boolean }).__STORAGE_HTTP_HYDRATED) run();
      else w.addEventListener('storageBackendReady', run, { once: true });
      setTimeout(run, 8000);
    } else {
      go();
    }
    window.addEventListener('problemCasesChanged', onCasesChanged);
    window.addEventListener('storageIndexedDbReady', onCasesChanged, { once: true });
    window.addEventListener('pagehide', onPageLifecycleFlushProgressWorkspace);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        onPageLifecycleFlushProgressWorkspace();
      } else if (document.visibilityState === 'visible' && designDetailProgressPersistPending) {
        const rawId = String(caseIdRef.value || '').trim();
        if (rawId && designDetailProgressWorkspaceSaveEnabled) {
          void flushPersistDesignDetailProgressWorkspace(rawId);
        }
      }
    });
  });

  onUnmounted(() => {
    if (pollTimer.value) clearInterval(pollTimer.value);
    cancelDebouncedProgressWorkspacePersist();
    clearTask0AdvanceWatchdogs();
    clearRevealInterval();
    window.removeEventListener('problemCasesChanged', onCasesChanged);
    window.removeEventListener('pagehide', onPageLifecycleFlushProgressWorkspace);
  });

  watch([llmLogAuditRefreshTick, logicTreeGraphRefreshTick], () => {
    flushProgressWorkspaceOnArtifactSync();
  });

  watch(mergedRequirementActiveSubTabKey, () => {
    queuePersistDesignDetailProgressWorkspace();
  });

  // TODO: 临时注释掉 watch 排查刷新问题
  // watch(
  //   [
  //     dynamicsCards,
  //     designOnlyProgressTail,
  //     task1CustomerRequirementPhase,
  //     designCanvasTabs,
  //     activeDesignCanvasTabId,
  //     customerBasicCanvasRows,
  //     customerRequirementCanvasEntries,
  //     currentDesignLineTaskId,
  //     designDynamicsSuppressPersistedReplay,
  //     llmStatsIncludeFromMessageIndex,
  //     designDetailChatDraft,
  //     lastHydratedMessages,
  //   ],
  //   () => {
  //     /** 指纹比较：快照无变化时跳过 PUT 请求 */
  //     const fp = buildWorkspaceFingerprint();
  //     if (fp === _cachedWorkspaceFp) return;
  //     _cachedWorkspaceFp = fp;
  //     queuePersistDesignDetailProgressWorkspace();
  //   },
  //   { deep: true },
  // );

  return {
    currentDesignLinePillText,
    currentDesignLineTaskId,
    dynamicsCardsView,
    designChatTimeline,
    designDetailChatPanelMode,
    leftPanelUiRestoreTick,
    leftPanelScrollProgress,
    leftPanelScrollChat,
    noteLeftPanelScroll,
    setDesignDetailChatPanelModeAndPersist,
    lastHydratedMessages,
    lastHydratedPreliminaryFollowupActive,
    loadError,
    runHydrationCycle,
    sendBusy,
    restartBusy,
    fullRestartBusy,
    designChatInputPlaceholder,
    designChatInputPlaceholderEffective,
    designChatInputHighlightTask1ScopeAwait,
    designChatInputHighlightTask1CustomerRequirementAwait,
    designChatInputHighlightTask1ScopeOrRequirementAwait,
    designChatInputSendDisabled,
    designChatInputSendTriggersTask0DebugContinue,
    onRequirementSupplementChoiceYes,
    onRequirementSupplementChoiceNo,
    onDebugPipelineStepContinue,
    designDetailExperienceMode,
    setDesignDetailExperienceMode,
    submitDesignDetailChatDraft,
    restartCurrentTaskFromDesignPage,
    restartFromSelectedLineTaskAnchor,
    selectRestartStageOptions,
    fullRestartDesignDetailFromPage,
    designCanvasTabs,
    activeDesignCanvasTabId,
    customerBasicCanvasRows,
    customerRequirementCanvasEntries,
    mergedCustomerRequirementParsed,
    mergedRequirementActiveSubTabKey,
    mergedRequirementMergeDoneTick,
    customerRequirementFieldDefs: CUSTOMER_REQUIREMENT_CANVAS_FIELDS,
    formatCustomerRequirementSubTabValue,
    llmLogAuditRefreshTick,
    logicTreeGraphRefreshTick,
    architectureInventoryGraphRefreshTick,
    designReportContentRefreshTick,
    designReportSubTabFocusTick,
    businessProcessSubTabFocusTick,
    functionInventorySubTabFocusTick,
    onLogicTreeTask0LayerReady,
    designDetailChatDraft,
    task51L3MatrixRawOutput,
    currentStateUnderstandingGraphTasks,
    currentStateUnderstandingRefreshTick,
    refreshCurrentStateUnderstandingFromTaskGraph,
    diagnosticReviewStepCards,
    diagnosticReviewRefreshTick,
  };
}
