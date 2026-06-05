/**
 * [INPUT]: `GET …/task-graph` 任务 1 特征 `painPointConfirmed`；TVM 对齐行
 * [OUTPUT]: 历史痛点免疫（Consistency →「已确认为痛点」、清空问卷文案）
 * [POS]: 任务 2–5 对齐门禁；与后端 `design-detail-pain-point-confirmed.ts` 口径一致
 */

import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import { normLogicTaskId } from './designDetailLogicGraphMerge';

const TASK1_LOGIC_TREE_LAYER_KEY = 'customer_basic';
import {
  isTokenValidationMappingPotentialConflict,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';

export const DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY = '已确认为痛点';

export function normalizeTask1TokenKeyForPainImmunity(raw: string): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  const head = t.split(/\s*·\s*/)[0]?.trim() ?? t;
  return head.replace(/\s+/g, '');
}

export type Task1PainPointConfirmedIndex = ReadonlyMap<string, true>;

export function buildTask1PainPointConfirmedIndex(
  mergedTasks: DesignDetailLogicGraphTaskDto[],
): Task1PainPointConfirmedIndex {
  const t1 = mergedTasks.find((t) => normLogicTaskId(t.taskId) === TASK1_LOGIC_TREE_LAYER_KEY);
  const out = new Map<string, true>();
  for (const f of t1?.features ?? []) {
    const confirmed =
      f.painPointConfirmed === true ||
      (f as { pain_point_confirmed?: boolean }).pain_point_confirmed === true;
    if (!confirmed) continue;
    const fid = String(f.featureId ?? '').trim();
    if (fid) out.set(fid, true);
    const td = normalizeTask1TokenKeyForPainImmunity(
      String(f.tokenDisplay ?? (f as { token_display?: string }).token_display ?? '').trim(),
    );
    if (td) out.set(td, true);
    const nm = normalizeTask1TokenKeyForPainImmunity(String(f.name ?? '').trim());
    if (nm && !/^ft_\d{12}$/i.test(nm)) out.set(nm, true);
  }
  return out;
}

export function resolvePainConfirmedForTvmRow(
  row: Task2L1TvmParsedRow,
  confirmed: Task1PainPointConfirmedIndex,
): boolean {
  const fid = String(row.targetFeatureId ?? '').trim();
  if (fid && confirmed.has(fid)) return true;
  const keys = [
    normalizeTask1TokenKeyForPainImmunity(row.tokenStr),
    normalizeTask1TokenKeyForPainImmunity(row.clientFactToken),
    normalizeTask1TokenKeyForPainImmunity(row.anchorModelFeature),
  ].filter(Boolean);
  return keys.some((k) => confirmed.has(k));
}

/** 对已确认痛点的任务 1 节点：统一 Consistency，免予生成问卷 */
export function applyPainPointConfirmedImmunityToTvmRows(
  rows: Task2L1TvmParsedRow[],
  confirmed: Task1PainPointConfirmedIndex,
): Task2L1TvmParsedRow[] {
  if (!confirmed.size) return rows;
  return rows.map((r) => {
    if (!resolvePainConfirmedForTvmRow(r, confirmed)) return r;
    const note = `任务 1 节点已确认痛点（历史痛点免疫），Consistency 统一为「${DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY}」`;
    const logic = String(r.validationLogic ?? '').trim();
    return {
      ...r,
      consistency: DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY,
      interviewQuestion: '',
      validationLogic: logic.includes('已确认痛点') ? logic : logic ? `${logic}（${note}）` : note,
    };
  });
}

export function extractPainPointTargetFeatureIdsFromTvmRows(
  rows: ReadonlyArray<Task2L1TvmParsedRow>,
): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    const fid = String(r.targetFeatureId ?? '').trim();
    if (fid) out.add(fid);
  }
  return [...out];
}

export function isTask1FeaturePainPointConfirmed(
  f: { painPointConfirmed?: boolean; pain_point_confirmed?: boolean },
): boolean {
  return f.painPointConfirmed === true || f.pain_point_confirmed === true;
}

/** 供 L2 推理 Input 2 TSV 第五列：已确认痛点节点统一为「已确认为痛点」 */
export function buildTask1PainPointConfirmedConsistencyMap(
  mergedTasks: DesignDetailLogicGraphTaskDto[],
): Map<string, string> {
  const index = buildTask1PainPointConfirmedIndex(mergedTasks);
  const out = new Map<string, string>();
  for (const key of index.keys()) {
    out.set(key, DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY);
  }
  return out;
}
