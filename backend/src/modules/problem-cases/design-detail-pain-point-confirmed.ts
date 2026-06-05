/**
 * [INPUT]: `GET …/task-graph` 任务 1 特征；TVM 解析计划；对齐 sync 请求体
 * [OUTPUT]: 任务 1 `featureId`/token 键 → 已确认痛点；TVM 免疫合并；线步重置范围
 * [POS]: 历史痛点免疫真源（`painPointConfirmed` 字段），替代仅靠反向边 Consistency 推断
 */

import type { DesignDetailTaskGraphTaskDto } from './types';
import type { Task2L1TokenValidationLinkPlan } from './design-detail-task2-l1-target-kv-tokens';
import { DESIGN_DETAIL_TASK1_LINE_TASK_ID } from './design-detail-task1-basic-graph';
import {
  DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER,
  designDetailLineStepIdsForLineStep,
  designDetailLineStepIdsFromAnchorInclusive,
} from './design-detail-task-graph-catalog';

/** TVM / 反向边 `validationConsistency`：已确认痛点，不再生成问卷 */
export const DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY = '已确认为痛点' as const;

export function isPainPointConfirmedConsistencyLabel(consistencyRaw: string): boolean {
  return String(consistencyRaw ?? '').trim().includes(DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY);
}

function canonicalGraphTaskKey(dbTaskId: string): string {
  const t = String(dbTaskId || '').trim();
  if (t === '任务 1：客户基本情况了解' || t === 'customer_basic' || t === 'customer_requirement') {
    return DESIGN_DETAIL_TASK1_LINE_TASK_ID;
  }
  return t;
}

export function normalizeTask1TokenKeyForPainImmunity(raw: string): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  const head = t.split(/\s*·\s*/)[0]?.trim() ?? t;
  return head.replace(/\s+/g, '');
}

export type Task1PainPointConfirmedIndex = ReadonlyMap<string, true>;

/** 从推理图任务 1 卡构建已确认痛点索引（`featureId` + token 展示键） */
export function buildTask1PainPointConfirmedIndex(
  tasks: DesignDetailTaskGraphTaskDto[],
): Task1PainPointConfirmedIndex {
  const t1 = tasks.find((t) => canonicalGraphTaskKey(t.taskId) === DESIGN_DETAIL_TASK1_LINE_TASK_ID);
  const out = new Map<string, true>();
  for (const f of t1?.features ?? []) {
    if (f.painPointConfirmed !== true) continue;
    const fid = String(f.featureId ?? '').trim();
    if (fid) out.set(fid, true);
    const tok = normalizeTask1TokenKeyForPainImmunity(String(f.name ?? '').trim());
    if (tok && !/^ft_\d{12}$/i.test(tok)) out.set(tok, true);
    const td = normalizeTask1TokenKeyForPainImmunity(String(f.tokenDisplay ?? '').trim());
    if (td && !/^ft_\d{12}$/i.test(td)) out.set(td, true);
  }
  return out;
}

function resolvePainConfirmedForPlan(
  p: Task2L1TokenValidationLinkPlan,
  confirmed: Task1PainPointConfirmedIndex,
): boolean {
  const tgt = String(p.targetFeatureId || '').trim();
  if (tgt && confirmed.has(tgt)) return true;
  const tok = normalizeTask1TokenKeyForPainImmunity(String(p.mappedL1FeatureKey || '').trim());
  return Boolean(tok && confirmed.has(tok));
}

/** 落库前：已确认痛点的任务 1 节点不再标「潜在冲突」 */
export function mergeTokenValidationPlansWithPainPointConfirmedImmunity(
  plans: Task2L1TokenValidationLinkPlan[],
  confirmed: Task1PainPointConfirmedIndex,
): Task2L1TokenValidationLinkPlan[] {
  if (!confirmed.size) return plans;
  return plans.map((p) => {
    if (!resolvePainConfirmedForPlan(p, confirmed)) return p;
    const note = `任务 1 节点已确认痛点（历史痛点免疫），Consistency 统一为「${DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY}」`;
    const logic = String(p.validationLogic || '').trim();
    return {
      ...p,
      consistencyLabel: DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY,
      validationLogic: logic.includes('已确认痛点') ? logic : logic ? `${logic}（${note}）` : note,
    };
  });
}

export function resolveLineStepIdsForPainPointReset(
  scope: 'line_step' | 'from_line_step' | 'all',
  lineStepId?: string,
): string[] | 'all' {
  if (scope === 'all') return 'all';
  const anchor = String(lineStepId ?? '').trim();
  if (!anchor) return [];
  return scope === 'line_step'
    ? designDetailLineStepIdsForLineStep(anchor)
    : designDetailLineStepIdsFromAnchorInclusive(anchor);
}

export function isDesignDetailInferenceLineStepId(lineStepId: string): boolean {
  const t = String(lineStepId || '').trim();
  return (DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER as readonly string[]).includes(t);
}
