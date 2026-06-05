/**
 * [INPUT]: 设计线锚点线步、`重启当前` vs `选择重启` 来源
 * [OUTPUT]: 推理图 `DELETE …/task-graph/:taskId` 列表、LLM 审计 `taskIds` 列表（与 `useDesignDetailChat` 重启流程一致）
 * [POS]: 设计详情三种重启口径的**单一真源**（避免「重启当前」误用「锚点及之后」切片）
 *
 * [PROTOCOL]: 与 `designModeTaskPipeline.ts` 线步顺序、`designDetailLogicGraphMerge.ts` 落库 taskId 别名对齐；**任务 5.1～5.5**「重启当前」级联清空子链下游；**任务 8.5** 等须含中文落库 taskId；变更时同步 `design_mode_ux.md` §6、`useDesignDetailChat.ts`
 */

import {
  designLinePillLabel,
  designLineTasksFromStepInclusive,
  designLineTasksFromStepRangeInclusive,
  type DesignDetailLineTaskId,
} from './designModeTaskPipeline';
import {
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
} from './designDetailLogicGraphMerge';
import { DESIGN_DETAIL_TASK1_LLM_AUDIT_TASK_ID } from './designDetailLlmStats';
import { buildDesignReportTask11RestartLlmLogTaskIds } from './designDetailRestartDesignReport';

/** 与后端 `DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID` 一致 */
export const DESIGN_DETAIL_CUSTOMER_REQUIREMENT_GRAPH_TASK_ID = 'customer_requirement';

/** `restartDesignDetailFromLineTaskAnchor` 的 `source` 参数 */
export type DesignDetailRestartSource = 'current' | 'select';

/**
 * - `current_line_step`：**重启当前** — 默认仅锚点线步 X；**任务 5.1～5.5** 另级联锚点之后至 5.5 的子链（与流水线依赖一致）
 * - `from_line_step_inclusive`：**选择重启** — 线步 Y 及之后（含 Y）
 */
export type DesignDetailRestartScope = 'current_line_step' | 'from_line_step_inclusive';

/** 任务 5.1 → 5.5 紧耦合子链（重启 5.2/5.3 须连带清空 5.5 等下游） */
export const DESIGN_DETAIL_L35_RESTART_SUBCHAIN_STEPS: readonly Exclude<
  DesignDetailLineTaskId,
  'all_done'
>[] = [
  'value_proposition_capability_units',
  'capability_field_set_mapping',
  'key_scenario_temporal_flow_inference',
  'vsm_stage_decomposition',
];

export function resolveDesignDetailRestartScope(source: DesignDetailRestartSource): DesignDetailRestartScope {
  return source === 'current' ? 'current_line_step' : 'from_line_step_inclusive';
}

type ActiveLineStep = Exclude<DesignDetailLineTaskId, 'all_done'>;

/**
 * 本次重启实际影响的线步列表（推理图 DELETE / LLM clear / 对齐 localStorage 共用）。
 */
export function resolveRestartAffectedLineSteps(
  anchor: DesignDetailLineTaskId,
  scope: DesignDetailRestartScope,
): ActiveLineStep[] {
  if (anchor === 'all_done') return [];
  if (scope === 'from_line_step_inclusive') {
    return designLineTasksFromStepInclusive(anchor) as ActiveLineStep[];
  }
  const anchorStep = anchor as ActiveLineStep;
  const subIdx = (DESIGN_DETAIL_L35_RESTART_SUBCHAIN_STEPS as readonly string[]).indexOf(anchorStep);
  if (subIdx >= 0) {
    return DESIGN_DETAIL_L35_RESTART_SUBCHAIN_STEPS.slice(subIdx) as ActiveLineStep[];
  }
  return [anchorStep];
}

/**
 * 选择重启：工作区仅裁剪 **锚点 Y～重启前当前线步 A**（含），保留严格早于 Y 的进展快照。
 * 推理图/LLM 仍用 `resolveRestartAffectedLineSteps`（Y 及之后）；在 1≤Y≤A 且 A 之后无产物时与产品语义一致。
 */
export function resolveRestartWorkspacePruneLineSteps(
  anchor: DesignDetailLineTaskId,
  currentLineAtRestart: DesignDetailLineTaskId,
): ActiveLineStep[] {
  if (anchor === 'all_done' || currentLineAtRestart === 'all_done') return [];
  return designLineTasksFromStepRangeInclusive(anchor, currentLineAtRestart) as ActiveLineStep[];
}

export { designLineTaskIndexInOrder as lineStepIndexInDesignOrder } from './designModeTaskPipeline';

/**
 * 与后端 `DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER` 一致（任务 2～10；无任务 11+）。
 * 用于重启时是否调用 `inference-revision-records/clear` 与 `task1-pain-point-confirmed/reset`。
 */
export const DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER: readonly Exclude<
  DesignDetailLineTaskId,
  | 'all_done'
  | 'optional_toolbox_primitive'
  | 'customer_basic'
  | 'process_node_design'
  | 'role_and_business_object_derivation'
  | 'module_abstract_design'
  | 'field_design'
>[] = [
  'scale_org_mode_extract',
  'industry_business_profile_extract',
  'core_value_driver_inference',
  'macro_process_flow_inference',
  'value_proposition_capability_units',
  'capability_field_set_mapping',
  'key_scenario_temporal_flow_inference',
  'vsm_stage_decomposition',
  'pain_point_extraction',
  'three_dimension_itgap_analysis',
  'key_requirement_scenarios',
  'role_object_stm_inference',
  'physical_hook_integration_inference',
  'business_capability_positioning',
  'process_type_derivation',
];

export function isDesignDetailInferenceRevisionRestartLineStep(lineStepId: string): boolean {
  const t = String(lineStepId || '').trim();
  return (DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER as readonly string[]).includes(t);
}

/** 与后端 `designDetailLineStepIdsForLineStep` / `designDetailLineStepIdsFromAnchorInclusive` 口径一致 */
export function lineStepIdsForPainPointResetOnRestart(
  anchor: DesignDetailLineTaskId,
  scope: DesignDetailRestartScope,
): string[] {
  if (anchor === 'all_done' || anchor === 'customer_basic') return [];
  if (scope === 'current_line_step') {
    return isDesignDetailInferenceRevisionRestartLineStep(anchor) ? [anchor] : [];
  }
  const idx = DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER.indexOf(
    anchor as (typeof DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER)[number],
  );
  if (idx < 0) return [];
  return [...DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER.slice(idx)];
}

/** 单线步 → 线步 id + 中文落库 taskId + 历史别名（推理图与 LLM 审计共用） */
function appendArtifactTaskIdsForLineStep(step: ActiveLineStep, ids: Set<string>): void {
  ids.add(step);
  const pill = designLinePillLabel(step);
  if (pill && pill !== step) ids.add(pill);
  switch (step) {
    case 'scale_org_mode_extract':
      ids.add(DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID);
      ids.add(DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY);
      break;
    case 'industry_business_profile_extract':
      ids.add(DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID);
      break;
    case 'core_value_driver_inference':
      ids.add(DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID);
      ids.add(DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY);
      break;
    case 'macro_process_flow_inference':
      ids.add(DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID);
      ids.add(DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY);
      break;
    case 'value_proposition_capability_units':
      ids.add(DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID);
      break;
    case 'capability_field_set_mapping':
      ids.add(DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID);
      ids.add(DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID_LEGACY);
      break;
    case 'key_scenario_temporal_flow_inference':
      ids.add(DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID);
      break;
    case 'vsm_stage_decomposition':
      ids.add(DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID);
      break;
    case 'pain_point_extraction':
      ids.add(DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID);
      break;
    case 'three_dimension_itgap_analysis':
      ids.add(DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID);
      break;
    case 'key_requirement_scenarios':
      ids.add(DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID);
      ids.add(DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID_LEGACY);
      break;
    case 'role_object_stm_inference':
      ids.add(DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID);
      ids.add(DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID_LEGACY);
      break;
    case 'physical_hook_integration_inference':
      ids.add(DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID);
      break;
    case 'business_capability_positioning':
      ids.add(DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID);
      break;
    case 'process_type_derivation':
      ids.add(DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID);
      break;
    case 'process_node_design':
      for (const t of buildDesignReportTask11RestartLlmLogTaskIds()) ids.add(t);
      break;
    default:
      break;
  }
}

/**
 * 推理图删除 id 列表。
 */
export function buildTaskGraphDeleteTaskIdsForRestart(
  anchor: DesignDetailLineTaskId,
  scope: DesignDetailRestartScope,
): string[] {
  if (anchor === 'all_done') return [];
  const ids = new Set<string>();
  const steps = resolveRestartAffectedLineSteps(anchor, scope);
  for (const step of steps) {
    appendArtifactTaskIdsForLineStep(step, ids);
  }
  const touchesTask1 =
    anchor === 'customer_basic' || steps.includes('customer_basic');
  if (touchesTask1 && (scope === 'from_line_step_inclusive' || anchor === 'customer_basic')) {
    ids.add(DESIGN_DETAIL_CUSTOMER_REQUIREMENT_GRAPH_TASK_ID);
  }
  return Array.from(ids);
}

/** @deprecated 仅兼容旧调用；新代码请传 `resolveDesignDetailRestartScope(source)` */
export function buildTaskGraphDeleteTaskIdsForRestartAnchor(anchor: DesignDetailLineTaskId): string[] {
  return buildTaskGraphDeleteTaskIdsForRestart(anchor, 'from_line_step_inclusive');
}

function buildDesignDetailTask1RestartLlmLogTaskIds(): string[] {
  const ids = new Set<string>();
  ids.add(DESIGN_DETAIL_TASK1_LLM_AUDIT_TASK_ID);
  ids.add('customer_basic');
  ids.add(DESIGN_DETAIL_CUSTOMER_REQUIREMENT_GRAPH_TASK_ID);
  for (let i = 1; i <= 64; i += 1) {
    ids.add(`合并需求#${i}`);
  }
  return Array.from(ids);
}

/**
 * LLM 审计清理 taskId 列表（与写库 `ProblemCaseLlmLog.taskId`、推理图落库 id 对齐）。
 */
export function buildLlmLogTaskIdsForRestart(
  anchor: DesignDetailLineTaskId,
  scope: DesignDetailRestartScope,
): string[] {
  if (anchor === 'all_done') return [];
  if (scope === 'from_line_step_inclusive' && anchor === 'customer_basic') {
    return buildDesignDetailTask1RestartLlmLogTaskIds();
  }
  const ids = new Set<string>();
  const steps = resolveRestartAffectedLineSteps(anchor, scope);
  for (const step of steps) {
    appendArtifactTaskIdsForLineStep(step, ids);
  }
  if (anchor === 'customer_basic' || steps.includes('customer_basic')) {
    for (const t of buildDesignDetailTask1RestartLlmLogTaskIds()) ids.add(t);
  }
  return Array.from(ids);
}
