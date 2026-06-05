/**
 * [INPUT]: 案例聊天消息数组（含 `task1LlmQueryBlock`）、`ProblemCaseLlmLog.callTarget` 展示口径
 * [OUTPUT]: 设计详情 **LLM 审计与聊天写入** 共用常量；`sanitizeLlmStatsIncludeFromIndex` / `clampLlmStatsIncludeFromIndex` 供工作区快照与「重启当前」后消息对齐（避免快照下标损坏导致 hydrate 异常）；`formatCallTargetForStatsDisplay` 供顶栏 LLM 浮层等展示「调用目标」；需求提炼全案序号辅助函数
 * [POS]: `DesignDetailLlmLogFloatingPanel.vue`、`useDesignDetailChat.ts`、`designDetailTaskMirror.ts` 等
 *
 * [PROTOCOL]: 若设计页新增写入聊天的 LLM 块类型或备注名规则、或 `ProblemCaseLlmLog` 的 taskId/callTarget 与 **`DESIGN_DETAIL_TASK1_LLM_AUDIT_TASK_ID`** / 各 `DESIGN_DETAIL_LLM_CALL_TARGET_*` 不一致、或「重启当前」清审计集合变化，须同步本文件与 `useDesignDetailChat.ts`；任务 2 L1 审计 **`callTarget`** 若更名，须在 **`formatCallTargetForStatsDisplay`** 保留对历史字面量的归一；**任务 2 L1 对齐问卷 / 深访合成**见 **`DESIGN_DETAIL_LLM_CALL_TARGET_TASK2_L1_*`**；**任务 3 L2 对齐问卷 / 深访合成**见 **`DESIGN_DETAIL_LLM_CALL_TARGET_TASK3_L2_*`**；**任务 4 L2 对齐问卷 / 深访合成**见 **`DESIGN_DETAIL_LLM_CALL_TARGET_TASK4_L2_*`**；**任务 4** 主推理审计 `callTarget`=`价值链分析推理（L2 价值矩阵）`（历史字面量见 **`DESIGN_DETAIL_LLM_CALL_TARGET_L2_CORE_VALUE_DRIVER_LEGACY`**）；**需求提炼全案序号**以 `task1LlmQueryBlock` 上的 **`task1RequirementDistillOrdinal`** 为准
 */

import { designLinePillLabel, designLineTaskDisplayName, type DesignDetailLineTaskId } from './designModeTaskPipeline';

/** 与 `useDesignDetailChat` 写入 `ProblemCaseLlmLog.taskId` 一致：task1 子环节统一为顶栏「任务 N：…」 */
export const DESIGN_DETAIL_TASK1_LLM_AUDIT_TASK_ID = designLinePillLabel('customer_basic');

/** 审计「调用目标」— 工商提炼（与产品文案一致，非聊天 `noteName`） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_BUSINESS_EXTRACT = '客户工商及经营范围信息提炼';

/** 审计「调用目标」— BMC */
export const DESIGN_DETAIL_LLM_CALL_TARGET_BMC = '客户商业画布（BMC）生成';

/** 历史审计 `callTarget`（更名前）；`formatCallTargetForStatsDisplay` 归一为现用文案 */
const DESIGN_DETAIL_LLM_CALL_TARGET_L1_ENTITY_PORTRAIT_LEGACY = '行业与业务属性推理（L1 实体画像）';

/** 审计「调用目标」— 任务 2：规模与组织模式推理（L1 实体画像） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L1_ENTITY_PORTRAIT = '规模与组织模式推理（L1 实体画像）';

/** 审计「调用目标」— 任务 2：L1 反向验证潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK2_L1_ALIGNMENT_QUESTIONNAIRE = '任务2-L1需求对齐问卷生成';

/** 审计「调用目标」— 任务 2：用户对齐回复 → 深访洞察合成（Input 5） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK2_L1_DEEP_INSIGHT_SYNTHESIS = '任务2-L1深访洞察合成';

/** 审计「调用目标」— 任务 3：L2 Token_Validation_Mapping 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK3_L2_ALIGNMENT_QUESTIONNAIRE = '任务3-L2反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 3：用户对齐回复 → 深访洞察合成（Input 3） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK3_L2_DEEP_INSIGHT_SYNTHESIS = '任务3-L2深访洞察合成';

/** 审计「调用目标」— 任务 4：L2 Token_Validation_Mapping 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK4_L2_ALIGNMENT_QUESTIONNAIRE = '任务4-L2反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 4：用户对齐回复 → 深访洞察合成（Input 4） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK4_L2_DEEP_INSIGHT_SYNTHESIS = '任务4-L2深访洞察合成';

/** 审计「调用目标」— 任务 5：L3 Token_Validation_Mapping 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK5_L3_ALIGNMENT_QUESTIONNAIRE =
  '任务5-L3反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 5：用户对齐回复 → 深访洞察合成 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK5_L3_DEEP_INSIGHT_SYNTHESIS = '任务5-L3深访洞察合成';

/** 审计「调用目标」— 任务 5.5：L3.5 Token_Validation_Mapping 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK55_L3_ALIGNMENT_QUESTIONNAIRE =
  '任务5.5-L3.5反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 5.1：L3.1 Token_Validation_Mapping 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK51_L3_ALIGNMENT_QUESTIONNAIRE =
  '任务5.1-L3.1反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 5.1：用户对齐回复 → 深访洞察合成 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK51_L3_DEEP_INSIGHT_SYNTHESIS =
  '任务5.1-L3.1深访洞察合成';

/** 审计「调用目标」— 任务 5.5：用户对齐回复 → 深访洞察合成 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK55_L3_DEEP_INSIGHT_SYNTHESIS =
  '任务5.5-L3.5深访洞察合成';

/** 审计「调用目标」— 任务 6：L3 Token_Validation_Mapping 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK6_L3_ALIGNMENT_QUESTIONNAIRE =
  '任务6-L3反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 6.5：子任务 IT-Gap TVM 潜在冲突 → 对齐问卷（通俗化） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK65_L3_ALIGNMENT_QUESTIONNAIRE =
  '任务6.5-L3子任务IT-Gap对齐问卷生成';

/** 审计「调用目标」— 任务 6：用户对齐回复 → 深访洞察合成（Input 3） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK6_L3_DEEP_INSIGHT_SYNTHESIS = '任务6-L3深访洞察合成';

/** 审计「调用目标」— 任务 10：L5 TVM 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK10_L5_ALIGNMENT_QUESTIONNAIRE =
  '任务10-L5反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 10：用户对齐回复 → 深访洞察合成（Input 3） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK10_L5_DEEP_INSIGHT_SYNTHESIS = '任务10-L5深访洞察合成';

/** 审计「调用目标」— 任务 7：L4 TVM 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK7_L4_ALIGNMENT_QUESTIONNAIRE =
  '任务7-L4反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 7：用户对齐回复 → 深访洞察合成 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK7_L4_DEEP_INSIGHT_SYNTHESIS = '任务7-L4深访洞察合成';

/** 审计「调用目标」— 任务 8：L4.5 TVM 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK8_L45_ALIGNMENT_QUESTIONNAIRE =
  '任务8-L4.5反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 8：用户对齐回复 → 深访洞察合成 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK8_L45_DEEP_INSIGHT_SYNTHESIS = '任务8-L4.5深访洞察合成';

/** 审计「调用目标」— 任务 8.5：L4.7 TVM 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK85_L475_ALIGNMENT_QUESTIONNAIRE =
  '任务8.5-L4.7反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 8.5：用户对齐回复 → 深访洞察合成 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK85_L475_DEEP_INSIGHT_SYNTHESIS =
  '任务8.5-L4.7深访洞察合成';

/** 审计「调用目标」— 任务 9：L5 TVM 潜在冲突 → 对齐问卷 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK9_L5_ALIGNMENT_QUESTIONNAIRE =
  '任务9-L5反向验证对齐问卷生成';

/** 审计「调用目标」— 任务 9：用户对齐回复 → 深访洞察合成 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK9_L5_DEEP_INSIGHT_SYNTHESIS = '任务9-L5深访洞察合成';

/** 审计「调用目标」— 任务 3：行业与业务属性推理（L2） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L2_INDUSTRY_BUSINESS = '行业与业务属性推理（L2 业务底色）';

/** 审计「调用目标」— 任务 4：价值链分析推理（L2 价值矩阵） */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L2_CORE_VALUE_DRIVER = '价值链分析推理（L2 价值矩阵）';

/** 历史审计 `callTarget`（任务 4 更名前）；`formatCallTargetForStatsDisplay` 归一为现用文案 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L2_CORE_VALUE_DRIVER_LEGACY = '核心价值驱动推理（L2 价值矩阵）';

/** 历史审计 `callTarget`（推理结论合成更名前）；`formatCallTargetForStatsDisplay` 仍原样展示 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_FEATURE_CONCLUSION_HUMANIZE_LEGACY = '推理特征结论整理';

/** @deprecated 请用 `buildFeatureConclusionHumanizeCallTarget` */
export const DESIGN_DETAIL_LLM_CALL_TARGET_FEATURE_CONCLUSION_HUMANIZE =
  DESIGN_DETAIL_LLM_CALL_TARGET_FEATURE_CONCLUSION_HUMANIZE_LEGACY;

/** 从 feature token 分域路径取 callTarget 用词根（`组织模式/…` → `组织模式`） */
export function tokenStrHeadForFeatureConclusionCallTarget(token: string): string {
  const t = String(token || '').trim();
  if (!t || t === '—') return '';
  const head = t.split(/[/·／]/)[0]?.trim() ?? t;
  return head;
}

/**
 * 推理结论合成 LLM 审计「调用目标」：`{tokenstr}推理结论合成`（如 `组织模式推理结论合成`）。
 * 优先取本批首条 feature 的 token 词根；缺省回退为线步展示名去尾「推理」后再拼后缀。
 */
export function buildFeatureConclusionHumanizeCallTarget(
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
  primaryTokenStr?: string,
): string {
  const fromToken = tokenStrHeadForFeatureConclusionCallTarget(primaryTokenStr ?? '');
  if (fromToken) return `${fromToken}推理结论合成`;
  const display = designLineTaskDisplayName(lineTaskId).replace(/推理$/, '').trim();
  return `${display || designLineTaskDisplayName(lineTaskId)}推理结论合成`;
}

/** 任务 5 L3 宏观流程特征主推理 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L3_MACRO_PROCESS = 'L3 宏观流程特征推理';

/** 任务 5.1 L3.1 战略价值主张与业务能力单元 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L51_VALUE_PROPOSITION =
  'L3.1 企业战略价值主张与部门级业务能力编排';

/** 任务 5.2 LLM 审计 taskId（按表循环，与顶栏线步 pill 可不同） */
export const DESIGN_DETAIL_TASK52_LLM_AUDIT_TASK_ID = '5.2：表格字段功能理解';

/** 单表现有表格字段功能理解 callTarget */
export function buildTask52TableFieldUnderstandingCallTarget(tableName: string): string {
  const name = String(tableName ?? '').trim();
  return `功能理解：${name || '（未命名表）'}`;
}

/** @deprecated 历史整批送模 callTarget */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L52_ASSET_FIELD_SET =
  'L3.2 存量 Excel 资产与业务能力字段集层次映射';

/** 任务 5.3 LLM 审计 taskId（按业务流程循环，与顶栏线步 pill 可不同） */
export const DESIGN_DETAIL_TASK53_LLM_AUDIT_TASK_ID = '5.3：流程环节功能理解';

/** 单条业务流程环节功能理解 callTarget */
export function buildTask53ProcessUnderstandingCallTarget(processName: string): string {
  const name = String(processName ?? '').trim();
  return `流程理解：${name || '（未命名流程）'}`;
}

/** @deprecated 历史整批送模 callTarget */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L53_WORKFLOW_FLOW =
  'L3.3 关键工作流拓扑编排';

/** 任务 5.5 L3.5 VSM 阶段拆解 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L3_VSM_STAGE = 'L3.5 价值流图 VSM 阶段拆解';

/** 任务 6 关键场景推理 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L3_SCENARIO = '关键场景推理';

/** 任务 6：按 5.5 价值流阶段的 LLM 审计 callTarget */
export function buildTask6VsmPhaseScenarioCallTarget(phaseLabel: string): string {
  const label = String(phaseLabel ?? '').trim() || '（未命名价值流阶段）';
  return `关键场景：${label}`;
}

export const DESIGN_DETAIL_TASK65_LLM_AUDIT_TASK_ID = '6.5：三维 IT-Gap 分析';

export function buildTask65ItGapStepCallTarget(progressLabel: string): string {
  const label = String(progressLabel ?? '').trim() || '（未命名环节）';
  return `IT-Gap：${label}`;
}

export const DESIGN_DETAIL_LLM_CALL_TARGET_L4_COLLABORATION = 'L4 任务节点IT选型推理';

export function buildTask7L4CollaborationStepCallTarget(progressLabel: string): string {
  const label = String(progressLabel ?? '').trim() || '（未命名环节）';
  return `IT选型：${label}`;
}

/** 任务 8 L4.5 业务对象与有限状态机矩阵推理 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L4_PROTOTYPE =
  'L4.5 业务对象与有限状态机矩阵推理';

/** 任务 8.5 L4.7 技术栈组件与外挂 Hook 集成推理 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L475_PHYSICAL_HOOK =
  'L4.7 技术栈组件与外挂 Hook 集成推理';

/** 任务 9 L5 领域驱动逻辑容器与工具宿主定义推理 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L5_BLUEPRINT =
  'L5 领域驱动逻辑容器与工具宿主定义推理';

/** 任务 10 L5 物理建表 Schema 与 RBAC 初始化推理 */
export const DESIGN_DETAIL_LLM_CALL_TARGET_L5_TECHNICAL_DDL =
  'L5 物理建表 Schema 与 RBAC 初始化推理';

/** 任务 11 线步审计 taskId（与 `designLinePillLabel('process_node_design')` 一致） */
export const DESIGN_DETAIL_TASK11_LLM_AUDIT_TASK_ID = designLinePillLabel('process_node_design');

/** 任务 11：设计报告第一章 LLM */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER1_PAIN =
  '分析报告第一章：对需求痛点的理解';

/** 任务 11：设计报告第二章 LLM */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER2_DIAGNOSIS =
  '分析报告第二章：剖析与诊断';

/** 任务 11：设计报告第三章 LLM */
export const DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER3_SOLUTION =
  '分析报告第三章：方案构建';

/** 工作区快照若损坏（下标大于消息条数），钳制为合法区间，过大则回退为 0 */
export function clampLlmStatsIncludeFromIndex(messageCount: number, rawIdx: number | undefined): number {
  const n = Math.max(0, Math.floor(messageCount));
  let i = Math.max(0, Math.floor(rawIdx ?? 0));
  if (i > n) return 0;
  return i;
}

/**
 * 工作区快照里的 `llmStatsIncludeFromMessageIndex` 常与「重启当前」后消息长度对齐；若聊天里仍留有更早的 `task1LlmQueryBlock`（修剪未完全同步等），保留原 idx 会导致内部一致性检查失真。
 * 规则：存在任意 task1 块下标 `< idx` 时改为 `0`；仅当全部 task1 块均 `>= idx`（或无任何 task1 块）时保留 `idx`。
 */
export function sanitizeLlmStatsIncludeFromIndex(
  messages: ReadonlyArray<Record<string, unknown>>,
  rawIdx: number | undefined,
): number {
  const idx = clampLlmStatsIncludeFromIndex(messages.length, rawIdx);
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]?.type !== 'task1LlmQueryBlock') continue;
    if (i < idx) return 0;
  }
  return idx;
}

/** 与 `useDesignDetailChat.ts` / `task1BusinessInsight.js` 备注名一致 */
export const DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE = '设计详情经营信息提炼';
export const DESIGN_DETAIL_BMC_NOTE = '设计详情 BMC 生成';
/** 与 `task1BusinessInsight.js` 中 `DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME` 一致 */
export const DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE = '设计详情客户需求提炼';

/** 持久化在 `task1LlmQueryBlock` 上：全案第几次「设计详情客户需求提炼」LLM 调用（1-based）；缺省时由 `inferRequirementDistillOrdinalFromChatPrefix` 推断 */
export const TASK1_REQUIREMENT_DISTILL_ORDINAL_KEY = 'task1RequirementDistillOrdinal';

/**
 * 读取聊天块上已持久化的需求提炼全案序号（兼容 snake_case 旧写入）。
 */
export function readPersistedRequirementDistillOrdinal(m: Record<string, unknown>): number | null {
  const raw =
    m[TASK1_REQUIREMENT_DISTILL_ORDINAL_KEY] ??
    (m as { task1_requirement_distill_ordinal?: unknown }).task1_requirement_distill_ordinal;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * 在 `messages[0..beforeIndex)` 内统计「设计详情客户需求提炼」`task1LlmQueryBlock` 条数，返回**下一条**应采的全案序号（1-based）。
 * 与写入时 `nextRequirementDistillOrdinalForChatAppend` 规则一致。
 */
export function inferRequirementDistillOrdinalFromChatPrefix(
  messages: ReadonlyArray<Record<string, unknown>>,
  beforeIndex: number,
): number {
  const lim = Math.max(0, Math.min(Math.floor(beforeIndex), messages.length));
  let c = 0;
  for (let i = 0; i < lim; i++) {
    const x = messages[i];
    if (x?.type !== 'task1LlmQueryBlock') continue;
    if (String((x as { noteName?: string }).noteName || '').trim() !== DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE) {
      continue;
    }
    c += 1;
  }
  return c + 1;
}

/** 在 `messages` 末尾再追加一条需求提炼块时应写入的 `task1RequirementDistillOrdinal` */
export function nextRequirementDistillOrdinalForChatAppend(
  messages: ReadonlyArray<Record<string, unknown>>,
): number {
  return inferRequirementDistillOrdinalFromChatPrefix(messages, messages.length);
}

/**
 * LLM 审计列表「调用目标」：去掉固定前缀「设计详情」，避免与页面语境重复（BMC 等）。
 * 持久化 `ProblemCaseLlmLog.callTarget` 若以「设计详情」开头则去前缀；已为 `需求提炼#n` / `需求#n合并#…` 等则原样展示。
 */
export function formatCallTargetForStatsDisplay(noteName: string): string {
  const s = String(noteName || '').trim();
  if (!s) return '—';
  if (s === DESIGN_DETAIL_LLM_CALL_TARGET_L1_ENTITY_PORTRAIT_LEGACY) {
    return DESIGN_DETAIL_LLM_CALL_TARGET_L1_ENTITY_PORTRAIT;
  }
  if (s === DESIGN_DETAIL_LLM_CALL_TARGET_L2_CORE_VALUE_DRIVER_LEGACY) {
    return DESIGN_DETAIL_LLM_CALL_TARGET_L2_CORE_VALUE_DRIVER;
  }
  if (s.startsWith('设计详情')) {
    const rest = s.slice(4).trim();
    return rest.length > 0 ? rest : s;
  }
  return s;
}
