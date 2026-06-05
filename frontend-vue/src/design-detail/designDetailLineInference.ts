/**
 * [INPUT]: 案例 `item`、持久化聊天 `messages`、本页「客户需求」阶段
 * [OUTPUT]: 设计详情**独立任务线**当前步 `DesignDetailLineTaskId`（与详情 canonical task2 **解耦**）
 * [POS]: 由 `designDetailLineState.reconcileDesignDetailLineTaskId` 与 hydrate 调用
 *
 * [PROTOCOL]: 与 `designModeTaskPipeline.ts` 中 13 步顺序一致；变更推断规则时须同步 `design_mode_tasks.md`
 */

import type { DesignDetailCustomerRequirementPhase } from './designDetailCustomerRequirementPhase';
import { DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE } from './designDetailLlmStats';
import type { DesignDetailLineTaskId } from './designModeTaskPipeline';
import { DESIGN_MODE_LINE_TASK_ORDER } from './designModeTaskPipeline';
import { isTaskCompleted, TASK1_ID } from './designDetailTaskMirror';

function nonEmptyString(v: unknown): boolean {
  const s = v == null ? '' : String(v).trim();
  return s.length > 0 && s !== 'NOT_SPECIFIED';
}

function nonEmptyArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

function meaningfulOrgTopology(v: unknown): boolean {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return nonEmptyString(v);
  const o = v as Record<string, unknown>;
  return Object.keys(o).some((k) => nonEmptyString(o[k]));
}

function meaningfulManagementResources(v: unknown): boolean {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return ['peopleResource', 'financeResource', 'assetResource', 'informationAsset'].some((k) => nonEmptyString(o[k]));
}

function meaningfulItLandscape(v: unknown): boolean {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    nonEmptyArray(o.legacySystems) ||
    nonEmptyArray(o.integrationRequirements) ||
    nonEmptyString(o.deploymentMode)
  );
}

function meaningfulRoadmap(v: unknown): boolean {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    o.phase1_Critical != null ||
    o.phase2_Strategic != null ||
    nonEmptyString(o.overallUrgency)
  );
}

function meaningfulOrgAndRoles(v: unknown): boolean {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return nonEmptyArray(o.stakeholders) || nonEmptyString(o.governanceLogic) || o.incentiveHooks != null;
}

function meaningfulOperationModelForFlow(v: unknown): boolean {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (nonEmptyArray(o.fullValueStreams)) return true;
  if (nonEmptyArray(o.valueStreamMapping as unknown)) return true;
  return false;
}

/** 从聊天中取最近一次「设计详情客户需求提炼」结构化 JSON */
export function getLatestCustomerRequirementParsed(
  messages: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.type !== 'task1LlmQueryBlock') continue;
    if (String((m as { noteName?: string }).noteName || '') !== DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE) continue;
    const j = (m as { llmOutputJson?: unknown }).llmOutputJson;
    if (j && typeof j === 'object' && !Array.isArray(j)) return j as Record<string, unknown>;
  }
  return null;
}

/**
 * 推断当前任务线步：任务 1 绑定 canonical task1；任务 2～12 按需求 JSON 分域填充进度；任务 13「字段设计」在阶段 `completed` 后收官 `all_done`。
 */
export function inferDesignLineTaskId(
  item: Record<string, unknown>,
  messages: Array<Record<string, unknown>>,
  requirementPhase: DesignDetailCustomerRequirementPhase,
): DesignDetailLineTaskId {
  const t1Done = isTaskCompleted(item, TASK1_ID, messages);
  if (!t1Done) return 'optional_toolbox_primitive';

  const parsed = getLatestCustomerRequirementParsed(messages);
  if (!parsed) {
    return DESIGN_MODE_LINE_TASK_ORDER[2]!;
  }

  const bc = parsed.businessContext as Record<string, unknown> | undefined;
  const om = parsed.operationModel as Record<string, unknown> | undefined;

  /** 任务 2～12：依次为 11 个门槛；未满足的第一项即当前步 */
  const gates: boolean[] = [
    meaningfulOrgTopology(bc?.orgTopology),
    nonEmptyString(bc?.industryDomain),
    nonEmptyString(parsed.corePainPointSummary) || nonEmptyString(bc?.businessStatus),
    meaningfulOperationModelForFlow(parsed.operationModel),
    nonEmptyArray(parsed.painPointRadar),
    nonEmptyArray(parsed.stateTransitionMatrix),
    nonEmptyArray(parsed.coreBusinessEntities),
    meaningfulItLandscape(parsed.itLandscape),
    meaningfulRoadmap(parsed.roadmap),
    om != null && meaningfulOrgAndRoles(om.orgAndRoles),
    meaningfulManagementResources(parsed.managementResources),
  ];

  let failIdx = -1;
  for (let i = 0; i < gates.length; i++) {
    if (!gates[i]) {
      failIdx = i;
      break;
    }
  }

  if (failIdx >= 0) {
    return DESIGN_MODE_LINE_TASK_ORDER[failIdx + 2]!;
  }

  /** 任务 14（ER 图生成）：需求阶段已完成则收官至 all_done */
  if (requirementPhase === 'completed') {
    return 'all_done';
  }
  return 'field_design';
}
