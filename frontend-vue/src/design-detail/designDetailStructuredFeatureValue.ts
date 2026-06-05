/**
 * [INPUT]: task-graph `features[]` 行（`featureValue` / `name`）
 * [OUTPUT]: 剥壳后的结构化 JSON 根对象（5.5 阶段 / 6 关键场景等）
 * [POS]: 现状理解第四层、Evidence 补链；与 `parseTask53FeatureValueRoot` 口径对齐
 */

import type { DesignDetailLogicGraphFeatureDto } from './designDetailLogicGraphMerge';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

export type StructuredFeatureValueRow = Pick<
  DesignDetailLogicGraphFeatureDto | Task2L1TaskGraphFeatureRow,
  'featureValue' | 'feature_value' | 'name'
>;

function asRec(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const s = String(raw ?? '').trim();
  if (!s || (!s.startsWith('{') && !s.startsWith('['))) return null;
  try {
    const v = JSON.parse(s) as unknown;
    return asRec(v);
  } catch {
    return null;
  }
}

function structuredPayloadLooksValid(rec: Record<string, unknown>): boolean {
  return !!(
    rec.phase_name ||
    rec.Phase_Name ||
    rec.classified_workflows ||
    rec.Classified_Workflows ||
    rec.scenario_name ||
    rec.targeted_value_phase ||
    rec.associated_pain_point ||
    rec.workflow_name ||
    rec.Workflow_Name
  );
}

function peelStructuredFeatureValueLayers(raw: unknown, maxDepth = 10): unknown {
  let cur: unknown = raw;
  for (let i = 0; i < maxDepth; i++) {
    if (cur == null) return cur;
    if (typeof cur === 'string') {
      const t = cur.trim();
      if (!t) return cur;
      const parsed = parseJsonObject(t);
      if (parsed) {
        cur = parsed;
        continue;
      }
      return cur;
    }
    const rec = asRec(cur);
    if (!rec) return cur;
    if (structuredPayloadLooksValid(rec)) return rec;
    const nested =
      rec.Feature_Value ??
      rec.feature_value ??
      rec.featureValue ??
      rec.value ??
      rec.Value;
    if (nested === undefined || nested === null) return rec;
    cur = nested;
  }
  return cur;
}

function tryParseStructuredPayload(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  const peeled = peelStructuredFeatureValueLayers(raw);
  const rec = asRec(peeled);
  if (rec && structuredPayloadLooksValid(rec)) return rec;
  if (typeof raw === 'string') {
    const parsed = parseJsonObject(raw);
    if (parsed && structuredPayloadLooksValid(parsed)) return parsed;
  }
  return rec && Object.keys(rec).length > 0 ? rec : null;
}

/** 解析落库 `DesignFeatureNode.value`（优先 `featureValue`，回退 `name` 内 JSON） */
export function parseStructuredFeatureValueRoot(
  row: StructuredFeatureValueRow,
): Record<string, unknown> | null {
  const fromFv = tryParseStructuredPayload(row.featureValue ?? row.feature_value);
  if (fromFv) return fromFv;
  return tryParseStructuredPayload(row.name);
}

export function readPhaseNameFromStructuredRow(row: StructuredFeatureValueRow): string {
  const root = parseStructuredFeatureValueRoot(row);
  if (root) {
    const phase = String(root.phase_name ?? root.Phase_Name ?? '').trim();
    if (phase) return phase;
  }
  const nm = String(row.name ?? '').trim();
  if (nm && !nm.startsWith('{') && nm.length <= 120) return nm;
  return '';
}

export type ClassifiedWorkflowRef = {
  workflow_feature_id: string;
  workflow_name: string;
};

export function readClassifiedWorkflowsFromStructuredRow(
  row: StructuredFeatureValueRow,
): ClassifiedWorkflowRef[] {
  const root = parseStructuredFeatureValueRoot(row);
  if (!root) return [];
  const arr = root.classified_workflows ?? root.Classified_Workflows;
  if (!Array.isArray(arr)) return [];
  const out: ClassifiedWorkflowRef[] = [];
  for (const item of arr) {
    const w = asRec(item);
    if (!w) continue;
    const workflow_name = String(w.workflow_name ?? w.Workflow_Name ?? '').trim();
    const workflow_feature_id = String(
      w.workflow_feature_id ?? w.Workflow_Feature_Id ?? w.Workflow_Feature_ID ?? '',
    ).trim();
    if (!workflow_name && !workflow_feature_id) continue;
    out.push({ workflow_feature_id, workflow_name });
  }
  return out;
}
