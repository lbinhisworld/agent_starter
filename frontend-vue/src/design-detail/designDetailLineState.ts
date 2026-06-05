/**
 * [INPUT]: `caseId`、同源 `item`/`messages`（`isTaskCompleted` 判定）；`localStorage`
 * [OUTPUT]: 设计详情页**独立任务线**「当前任务」读写；**自动推进**由 `useDesignDetailChat` 在任务动态卡完成展示后调用 `reconcileDesignDetailLineTaskId` / `advanceDesignDetailLineTask`；当全案 `isTaskCompleted(task1)` 假阴性但聊天仍含「设计详情客户需求提炼」JSON 时，`ensure`/`reconcile` **不**把线步误拽回 `customer_basic`
 * [POS]: 与 `problem_detail_chats` 并行：本页任务标签与任务动态与 `caseId` 绑定；刷新可恢复
 *
 * [PROTOCOL]: 变更任务线 id、顺序或持久化键时须同步 `design_mode_tasks.md`、`designModeTaskPipeline.ts`、`designDetailLineInference.ts`、`useDesignDetailChat.ts` 与 `AGENTS.md`
 */

import type { DesignDetailCustomerRequirementPhase } from './designDetailCustomerRequirementPhase';
import { getLatestCustomerRequirementParsed, inferDesignLineTaskId } from './designDetailLineInference';
import { isTaskCompleted, TASK1_ID } from './designDetailTaskMirror';
import {
  DESIGN_MODE_LINE_TASK_ORDER,
  type DesignDetailLineTaskId,
} from './designModeTaskPipeline';

export type { DesignDetailLineTaskId } from './designModeTaskPipeline';

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_line_v1:';
const SCHEMA_VERSION = 1;

const LEGACY_LINE_TASK_IDS = new Set(['business_capability_flow']);

function isKnownLineTaskId(id: string): id is DesignDetailLineTaskId {
  if (id === 'all_done') return true;
  return (DESIGN_MODE_LINE_TASK_ORDER as readonly string[]).includes(id);
}

/** 读旧版持久化 id → 新枚举（旧 task2 线已废弃，回落到任务 2 起点） */
function migratePersistedLineTaskId(raw: string | undefined): DesignDetailLineTaskId | null {
  if (!raw) return null;
  if (LEGACY_LINE_TASK_IDS.has(raw)) return 'scale_org_mode_extract';
  if (isKnownLineTaskId(raw)) return raw;
  return null;
}

export type DesignDetailLinePersisted = {
  schemaVersion: number;
  /** 设计页任务线当前步（与详情 canonical 步骤条解耦） */
  currentTaskId: DesignDetailLineTaskId;
  /**
   * 任务 3 L2+Target_KV 流水线已收官：阻止 `reconcile` 将线步推断顶过任务 3。
   * 写入 `false` 或与 `currentTaskId` 组合由 `saveDesignDetailLineState` 自动清除。
   */
  holdPastTask3?: boolean;
  /**
   * 任务 4 L2+Target_KV 与「推理逻辑提取」已收官：阻止 `reconcile` 将线步推断顶过任务 4（流程停在本步）。
   */
  holdPastTask4?: boolean;
  /** 任务 5 L3 宏观特征已收官 */
  holdPastTask5?: boolean;
  /** 任务 5.1 L3.1 战略价值主张已收官 */
  holdPastTask51?: boolean;
  /** 任务 5.2 L3.2 存量 Excel 字段集映射已收官 */
  holdPastTask52?: boolean;
  /** 任务 5.3 L3.3 关键场景时序流转已收官 */
  holdPastTask53?: boolean;
  /** 任务 5.5 L3.5 VSM 已收官 */
  holdPastTask55?: boolean;
  /** 任务 6 L3 关键场景已收官 */
  holdPastTask6?: boolean;
  /** 任务 6.5 L3 三维 IT-Gap 已收官 */
  holdPastTask65?: boolean;
  /** 任务 7 L4 协作节点已收官 */
  holdPastTask7?: boolean;
  /** 任务 8 L4.5 业务对象/FSM 已收官 */
  holdPastTask8?: boolean;
  /** 任务 8.5 物理外挂集成已收官 */
  holdPastTask85?: boolean;
  /** 任务 9 L5 领域容器与工具宿主已收官 */
  holdPastTask9?: boolean;
  /** 任务 10 L5 物理 Schema 与 RBAC 已收官 */
  holdPastTask10?: boolean;
};

export function designDetailLineStorageKey(caseId: string): string {
  const id = String(caseId || '').trim();
  return `${STORAGE_KEY_PREFIX}${id}`;
}

export function loadDesignDetailLineState(caseId: string): DesignDetailLinePersisted | null {
  if (typeof window === 'undefined' || !caseId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(designDetailLineStorageKey(caseId));
    if (!raw) return null;
    const o = JSON.parse(raw) as DesignDetailLinePersisted;
    if (!o || o.schemaVersion !== SCHEMA_VERSION) return null;
    const migrated = migratePersistedLineTaskId(String(o.currentTaskId || ''));
    if (!migrated) return null;
    const holdPastTask3 = o.holdPastTask3 === true;
    const holdPastTask4 = o.holdPastTask4 === true;
    const holdPastTask5 = o.holdPastTask5 === true;
    const holdPastTask51 = o.holdPastTask51 === true;
    const holdPastTask52 = o.holdPastTask52 === true;
    const holdPastTask53 = o.holdPastTask53 === true;
    const holdPastTask55 = o.holdPastTask55 === true;
    const holdPastTask6 = o.holdPastTask6 === true;
    const holdPastTask65 = o.holdPastTask65 === true;
    const holdPastTask7 = o.holdPastTask7 === true;
    const holdPastTask8 = o.holdPastTask8 === true;
    const holdPastTask85 = o.holdPastTask85 === true;
    const holdPastTask9 = o.holdPastTask9 === true;
    const holdPastTask10 = o.holdPastTask10 === true;
    const base: DesignDetailLinePersisted = {
      schemaVersion: SCHEMA_VERSION,
      currentTaskId: migrated,
      ...(holdPastTask3 ? { holdPastTask3: true } : {}),
      ...(holdPastTask4 ? { holdPastTask4: true } : {}),
      ...(holdPastTask5 ? { holdPastTask5: true } : {}),
      ...(holdPastTask51 ? { holdPastTask51: true } : {}),
      ...(holdPastTask52 ? { holdPastTask52: true } : {}),
      ...(holdPastTask53 ? { holdPastTask53: true } : {}),
      ...(holdPastTask55 ? { holdPastTask55: true } : {}),
      ...(holdPastTask6 ? { holdPastTask6: true } : {}),
      ...(holdPastTask65 ? { holdPastTask65: true } : {}),
      ...(holdPastTask7 ? { holdPastTask7: true } : {}),
      ...(holdPastTask8 ? { holdPastTask8: true } : {}),
      ...(holdPastTask85 ? { holdPastTask85: true } : {}),
      ...(holdPastTask9 ? { holdPastTask9: true } : {}),
      ...(holdPastTask10 ? { holdPastTask10: true } : {}),
    };
    return repairDesignDetailLineStateForMissingTask65(base);
  } catch {
    return null;
  }
}

/**
 * 任务 6 已收官但 6.5 尚未写入 holdPastTask65 时（旧流水线直跳任务 7），
 * 将线步钳回 `three_dimension_itgap_analysis` 以便补跑 6.5。
 */
export function repairDesignDetailLineStateForMissingTask65(
  state: DesignDetailLinePersisted,
): DesignDetailLinePersisted {
  if (state.holdPastTask6 !== true || state.holdPastTask65 === true || state.currentTaskId === 'all_done') {
    return state;
  }
  const i65 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('three_dimension_itgap_analysis');
  const curIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(state.currentTaskId);
  if (i65 >= 0 && curIdx > i65) {
    return { ...state, currentTaskId: 'three_dimension_itgap_analysis' };
  }
  return state;
}

export function saveDesignDetailLineState(caseId: string, state: DesignDetailLinePersisted): void {
  if (typeof window === 'undefined' || !caseId.trim()) return;
  try {
    const prev = loadDesignDetailLineState(caseId);
    const i3 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('industry_business_profile_extract');
    const i4 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('core_value_driver_inference');
    const i5 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('macro_process_flow_inference');
    const i51 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('value_proposition_capability_units');
    const i52 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('capability_field_set_mapping');
    const i53 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('key_scenario_temporal_flow_inference');
    const i55 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('vsm_stage_decomposition');
    const i6 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('pain_point_extraction');
    const i65 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('three_dimension_itgap_analysis');
    const i7 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('key_requirement_scenarios');
    const i8 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('role_object_stm_inference');
    const i85 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('physical_hook_integration_inference');
    const i9 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('business_capability_positioning');
    const i10 = DESIGN_MODE_LINE_TASK_ORDER.indexOf('process_type_derivation');
    const nx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(state.currentTaskId);

    let keepHold3 = false;
    if (state.holdPastTask3 === true) keepHold3 = true;
    else if (state.holdPastTask3 === false) keepHold3 = false;
    else if (prev?.holdPastTask3 === true && nx === i3) keepHold3 = true;

    let keepHold4 = false;
    if (state.holdPastTask4 === true) keepHold4 = true;
    else if (state.holdPastTask4 === false) keepHold4 = false;
    else if (prev?.holdPastTask4 === true && nx === i4) keepHold4 = true;

    let keepHold5 = false;
    if (state.holdPastTask5 === true) keepHold5 = true;
    else if (state.holdPastTask5 === false) keepHold5 = false;
    else if (prev?.holdPastTask5 === true && nx === i5) keepHold5 = true;

    let keepHold51 = false;
    if (state.holdPastTask51 === true) keepHold51 = true;
    else if (state.holdPastTask51 === false) keepHold51 = false;
    else if (prev?.holdPastTask51 === true && nx >= i51) keepHold51 = true;

    let keepHold52 = false;
    if (state.holdPastTask52 === true) keepHold52 = true;
    else if (state.holdPastTask52 === false) keepHold52 = false;
    else if (prev?.holdPastTask52 === true && nx >= i52) keepHold52 = true;

    let keepHold53 = false;
    if (state.holdPastTask53 === true) keepHold53 = true;
    else if (state.holdPastTask53 === false) keepHold53 = false;
    else if (prev?.holdPastTask53 === true && nx >= i53) keepHold53 = true;

    let keepHold55 = false;
    if (state.holdPastTask55 === true) keepHold55 = true;
    else if (state.holdPastTask55 === false) keepHold55 = false;
    else if (prev?.holdPastTask55 === true && nx === i55) keepHold55 = true;

    let keepHold6 = false;
    if (state.holdPastTask6 === true) keepHold6 = true;
    else if (state.holdPastTask6 === false) keepHold6 = false;
    else if (prev?.holdPastTask6 === true && (nx === i6 || nx === i65)) keepHold6 = true;

    let keepHold65 = false;
    if (state.holdPastTask65 === true) keepHold65 = true;
    else if (state.holdPastTask65 === false) keepHold65 = false;
    else if (prev?.holdPastTask65 === true && nx === i65) keepHold65 = true;

    let keepHold7 = false;
    if (state.holdPastTask7 === true) keepHold7 = true;
    else if (state.holdPastTask7 === false) keepHold7 = false;
    else if (prev?.holdPastTask7 === true && nx === i7) keepHold7 = true;

    let keepHold8 = false;
    if (state.holdPastTask8 === true) keepHold8 = true;
    else if (state.holdPastTask8 === false) keepHold8 = false;
    else if (prev?.holdPastTask8 === true && (nx === i8 || nx === i85)) keepHold8 = true;

    let keepHold85 = false;
    if (state.holdPastTask85 === true) keepHold85 = true;
    else if (state.holdPastTask85 === false) keepHold85 = false;
    else if (prev?.holdPastTask85 === true && (nx === i85 || nx === i9 || nx === i10)) keepHold85 = true;

    let keepHold9 = false;
    if (state.holdPastTask9 === true) keepHold9 = true;
    else if (state.holdPastTask9 === false) keepHold9 = false;
    else if (prev?.holdPastTask9 === true && (nx === i9 || nx === i10)) keepHold9 = true;

    let keepHold10 = false;
    if (state.holdPastTask10 === true) keepHold10 = true;
    else if (state.holdPastTask10 === false) keepHold10 = false;
    else if (prev?.holdPastTask10 === true && nx === i10) keepHold10 = true;

    const payload: DesignDetailLinePersisted = {
      schemaVersion: SCHEMA_VERSION,
      currentTaskId: state.currentTaskId,
    };
    if (keepHold3) payload.holdPastTask3 = true;
    if (keepHold4) payload.holdPastTask4 = true;
    if (keepHold5) payload.holdPastTask5 = true;
    if (keepHold51) payload.holdPastTask51 = true;
    if (keepHold52) payload.holdPastTask52 = true;
    if (keepHold53) payload.holdPastTask53 = true;
    if (keepHold55) payload.holdPastTask55 = true;
    if (keepHold6) payload.holdPastTask6 = true;
    if (keepHold65) payload.holdPastTask65 = true;
    if (keepHold7) payload.holdPastTask7 = true;
    if (keepHold8) payload.holdPastTask8 = true;
    if (keepHold85) payload.holdPastTask85 = true;
    if (keepHold9) payload.holdPastTask9 = true;
    if (keepHold10) payload.holdPastTask10 = true;

    window.localStorage.setItem(designDetailLineStorageKey(caseId), JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function clearDesignDetailLineState(caseId: string): void {
  if (typeof window === 'undefined' || !caseId.trim()) return;
  try {
    window.localStorage.removeItem(designDetailLineStorageKey(caseId));
  } catch {
    /* ignore */
  }
}

/** 首次打开本案例设计页且无本地记录时，按当时 canonical task1 快照定初值 */
export function initialDesignLineTaskIdFromCanonical(
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
): DesignDetailLineTaskId {
  const t1Done = isTaskCompleted(item, TASK1_ID, messages);
  if (!t1Done) return 'optional_toolbox_primitive';
  return 'scale_org_mode_extract';
}

/**
 * 确保存在持久化记录：无则创建并写入。
 * 若 task1 已回滚未完成而本地已进后续步，则回落到任务 0（`optional_toolbox_primitive`）。
 */
export function ensureDesignDetailLineRecord(
  caseId: string,
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
): DesignDetailLineTaskId {
  const cid = String(caseId || '').trim();
  if (!cid) return 'optional_toolbox_primitive';

  const t1Done = isTaskCompleted(item, TASK1_ID, messages);

  const existing = loadDesignDetailLineState(cid);
  if (!existing) {
    const init = initialDesignLineTaskIdFromCanonical(item, messages);
    saveDesignDetailLineState(cid, { schemaVersion: SCHEMA_VERSION, currentTaskId: init });
    return init;
  }

  let next = existing.currentTaskId;
  const repaired = repairDesignDetailLineStateForMissingTask65(existing);
  if (repaired.currentTaskId !== existing.currentTaskId) {
    saveDesignDetailLineState(cid, repaired);
    return repaired.currentTaskId;
  }
  const pastFirst =
    next === 'all_done' || (DESIGN_MODE_LINE_TASK_ORDER as readonly string[]).indexOf(next) > 0;
  /** 全案 item 可能滞后未标 task1 完成，但聊天已含「设计详情客户需求提炼」JSON：不得把设计线从后续步强制拽回任务 1（与「重启当前」保留任务 1 产物一致） */
  if (!t1Done && pastFirst && getLatestCustomerRequirementParsed(messages) == null) {
    next = 'optional_toolbox_primitive';
    saveDesignDetailLineState(cid, { schemaVersion: SCHEMA_VERSION, currentTaskId: next });
  }
  return next;
}

/**
 * 按聊天与需求阶段**推断**当前步并写回 localStorage（canonical task1 完成后与 JSON 增量对齐）。
 */
export function reconcileDesignDetailLineTaskId(
  caseId: string,
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
  requirementPhase: DesignDetailCustomerRequirementPhase,
): DesignDetailLineTaskId {
  const cid = String(caseId || '').trim();
  if (!cid) return 'optional_toolbox_primitive';
  const inferred = inferDesignLineTaskId(item, messages, requirementPhase);
  const prev = loadDesignDetailLineState(cid);
  /**
   * infer 在「需求 JSON 全门槛满足 + 阶段 completed」时会直接给出 all_done；
   * 设计任务线 2～13 仍可能未执行（例如「补充需求 → 否」后进入任务 2 LLM），不得被推断一步顶掉。
   * 例外：本地已停在 ER 图线步（`field_design`）时，允许按推断收官 all_done。
   */
  let next: DesignDetailLineTaskId = inferred;
  if (inferred === 'all_done') {
    if (prev?.currentTaskId === 'field_design' || prev?.currentTaskId === 'all_done') {
      next = 'all_done';
    } else if (prev && prev.currentTaskId !== 'customer_basic') {
      next = prev.currentTaskId;
    } else {
      next = 'all_done';
    }
  }
  /** 同上：infer 因 `isTaskCompleted(task1)` 假阴性回到 `customer_basic` 时，若聊天仍保留需求提炼 JSON 且本地已进后续步，则保持本地步 */
  if (
    next === 'customer_basic' &&
    prev &&
    prev.currentTaskId !== 'customer_basic' &&
    getLatestCustomerRequirementParsed(messages) != null
  ) {
    next = prev.currentTaskId;
  }
  /**
   * 本地已离开任务 0 时，不因 `isTaskCompleted(task1)` 假阴性被 infer 拽回任务 0
   * （全案 item 可能滞后；聊天已有需求 JSON 或本地线步已推进）。
   */
  if (next === 'optional_toolbox_primitive' && prev) {
    const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(
      prev.currentTaskId as Exclude<DesignDetailLineTaskId, 'all_done'>,
    );
    if (
      prevIdx > 0 &&
      (isTaskCompleted(item, TASK1_ID, messages) || getLatestCustomerRequirementParsed(messages) != null)
    ) {
      next = prev.currentTaskId;
    } else if (prev.currentTaskId === 'customer_basic') {
      next = 'customer_basic';
    }
  }
  /** 任务 3 L2+Target_KV 完成后：不因需求 JSON 已填门槛而被 infer 顶过任务 3（任务 4 流水线启动后会清 `holdPastTask3`） */
  if (prev?.holdPastTask3 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('industry_business_profile_extract');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) next = 'industry_business_profile_extract';
  }
  /** 任务 4 价值推理与逻辑提取完成后：流程停在本步，不因 JSON 门槛被 infer 顶到任务 5+ */
  if (prev?.holdPastTask4 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('core_value_driver_inference');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) next = 'core_value_driver_inference';
  }
  if (prev?.holdPastTask5 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('macro_process_flow_inference');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) next = 'macro_process_flow_inference';
  }
  if (prev?.holdPastTask51 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('value_proposition_capability_units');
    const floorIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('capability_field_set_mapping');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'value_proposition_capability_units';
    }
    /** 5.1 已收官、等待调试门闩进 5.2 时：勿因需求 JSON 门槛未填而被 infer 拽回更早线步 */
    if (floorIdx >= 0 && nIdx >= 0 && nIdx < floorIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx >= floorIdx ? prev.currentTaskId : 'capability_field_set_mapping';
    }
  }
  if (prev?.holdPastTask52 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('capability_field_set_mapping');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'capability_field_set_mapping';
    }
  }
  if (prev?.holdPastTask53 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('key_scenario_temporal_flow_inference');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'key_scenario_temporal_flow_inference';
    }
  }
  if (prev?.holdPastTask55 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('vsm_stage_decomposition');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      /** 5.5 收官后已显式写入任务 6 线步（调试门闩 / 自动衔接）时，勿压回 5.5 */
      next = prevIdx > capIdx ? prev.currentTaskId : 'vsm_stage_decomposition';
    }
  }
  if (prev?.holdPastTask6 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('pain_point_extraction');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'pain_point_extraction';
    }
  }
  /** 任务 6 已收官但 6.5 未收官：禁止推断线步越过 6.5（兼容旧会话直跳任务 7） */
  if (prev?.holdPastTask6 === true && prev?.holdPastTask65 !== true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('three_dimension_itgap_analysis');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      next = 'three_dimension_itgap_analysis';
    }
  }
  if (prev?.holdPastTask65 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('three_dimension_itgap_analysis');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'three_dimension_itgap_analysis';
    }
  }
  if (prev?.holdPastTask7 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('key_requirement_scenarios');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'key_requirement_scenarios';
    }
  }
  if (prev?.holdPastTask8 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('role_object_stm_inference');
    const floorIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('physical_hook_integration_inference');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'role_object_stm_inference';
    }
    /** 任务 8 已收官、等待调试门闩进任务 8.5 时：勿因需求 JSON 门槛未填而被 infer 拽回更早线步 */
    if (floorIdx >= 0 && nIdx >= 0 && nIdx < floorIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx >= floorIdx ? prev.currentTaskId : 'physical_hook_integration_inference';
    }
  }
  if (prev?.holdPastTask85 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('physical_hook_integration_inference');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'physical_hook_integration_inference';
    }
  }
  if (prev?.holdPastTask9 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('business_capability_positioning');
    const floorIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('process_type_derivation');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'business_capability_positioning';
    }
    if (floorIdx >= 0 && nIdx >= 0 && nIdx < floorIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx >= floorIdx ? prev.currentTaskId : 'process_type_derivation';
    }
  }
  if (prev?.holdPastTask10 === true && next !== 'all_done') {
    const capIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf('process_type_derivation');
    const nIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(next);
    if (capIdx >= 0 && nIdx > capIdx) {
      const prevIdx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(prev.currentTaskId);
      next = prevIdx > capIdx ? prev.currentTaskId : 'process_type_derivation';
    }
  }
  if (!prev || prev.currentTaskId !== next) {
    saveDesignDetailLineState(cid, { schemaVersion: SCHEMA_VERSION, currentTaskId: next });
  }
  return next;
}

/** 顺序固定：由 `from` 推进一格（测试或极少用手动推进；主路径用 reconcile） */
export function advanceDesignDetailLineTask(caseId: string, from: DesignDetailLineTaskId): DesignDetailLineTaskId {
  const cid = String(caseId || '').trim();
  if (!cid) return from;
  if (from === 'all_done') {
    saveDesignDetailLineState(cid, { schemaVersion: SCHEMA_VERSION, currentTaskId: 'all_done' });
    return 'all_done';
  }
  const idx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(from);
  let next: DesignDetailLineTaskId =
    idx >= 0 && idx < DESIGN_MODE_LINE_TASK_ORDER.length - 1
      ? DESIGN_MODE_LINE_TASK_ORDER[idx + 1]!
      : 'all_done';
  saveDesignDetailLineState(cid, { schemaVersion: SCHEMA_VERSION, currentTaskId: next });
  return next;
}
