/**
 * [INPUT]: 单阶段 LLM 原始 JSON、5.5 阶段子任务、5.3 工作流特征行
 * [OUTPUT]: 注入三源 `Evidence_Support_Chain` 后的 JSON 字符串
 * [POS]: `runTask6L3ScenarioPipeline` 合并落库前；与后端 `synthesizeTask6ScenarioEvidenceLinks` 口径一致
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import type { Task6VsmPhaseSubtask } from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import { readClassifiedWorkflowsFromStructuredRow } from './designDetailStructuredFeatureValue';

type JsonRec = Record<string, unknown>;

function asRec(v: unknown): JsonRec | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonRec) : null;
}

function isValidFtId(id: string): boolean {
  const s = String(id ?? '').trim();
  return /^ft_\d{12}$/i.test(s) && !/^ft_0{12}$/i.test(s);
}

function peelScenarioFeatureValue(raw: unknown): JsonRec | null {
  let cur: unknown = raw;
  for (let i = 0; i < 6; i++) {
    const rec = asRec(cur);
    if (!rec) return null;
    const phase = String(rec.scenario_name ?? rec.targeted_value_phase ?? '').trim();
    if (phase) return rec;
    const nested = rec.Feature_Value ?? rec.feature_value;
    if (nested === undefined || nested === null) return rec;
    if (typeof nested === 'string') {
      try {
        cur = JSON.parse(nested);
      } catch {
        return rec;
      }
    } else {
      cur = nested;
    }
  }
  return asRec(cur);
}

export type Task6ClassifiedWorkflowRef = {
  workflow_feature_id?: string;
  workflow_name?: string;
};

export function readClassifiedWorkflowsFromPhaseFeature(
  f: Task2L1TaskGraphFeatureRow,
): Task6ClassifiedWorkflowRef[] {
  return readClassifiedWorkflowsFromStructuredRow(f);
}

function task53WorkflowNameFromGraphFeature(f: Task2L1TaskGraphFeatureRow): string {
  const raw = f.featureValue ?? f.feature_value;
  let cur: unknown = raw;
  if (typeof raw === 'string') {
    try {
      cur = JSON.parse(raw);
    } catch {
      return String(f.name ?? '').trim();
    }
  }
  const rec = asRec(cur);
  if (!rec) return String(f.name ?? '').trim();
  const wf = String(rec.workflow_name ?? rec.Workflow_Name ?? '').trim();
  if (wf) return wf;
  return String(f.name ?? '').trim();
}

export function resolveTask53WorkflowFeatureId(
  workflowName: string,
  classified: readonly Task6ClassifiedWorkflowRef[],
  task53Features: readonly Task2L1TaskGraphFeatureRow[],
): string {
  const name = String(workflowName ?? '').trim();
  if (!name) return '';
  for (const w of classified) {
    if (String(w.workflow_name ?? '').trim() !== name) continue;
    const id = String(w.workflow_feature_id ?? '').trim();
    if (isValidFtId(id)) return id;
  }
  for (const f of task53Features) {
    if (task53WorkflowNameFromGraphFeature(f) === name) {
      const id = String(f.featureId ?? '').trim();
      if (isValidFtId(id)) return id;
    }
  }
  return '';
}

function buildEvidenceChainItem(
  featureId: string,
  sourceType: 'Derived_Feature' | 'Structured_Feature',
  logic: string,
): JsonRec {
  return {
    SourceType: sourceType,
    FeatureID: featureId,
    logic,
    contribution: 1.0,
  };
}

function existingChainSourceIds(chain: unknown): Set<string> {
  const seen = new Set<string>();
  if (!Array.isArray(chain)) return seen;
  for (const item of chain) {
    const rec = asRec(item);
    if (!rec) continue;
    const nested = asRec(rec.SourceFeature);
    const id = String(
      nested?.FeatureID ??
        nested?.featureId ??
        rec.FeatureID ??
        rec.featureId ??
        '',
    ).trim();
    if (isValidFtId(id)) seen.add(id);
  }
  return seen;
}

function synthesizeChainForScenarioRow(
  scenario: JsonRec,
  phaseFeatureId: string,
  classified: readonly Task6ClassifiedWorkflowRef[],
  task53Features: readonly Task2L1TaskGraphFeatureRow[],
): JsonRec[] {
  const out: JsonRec[] = [];
  const phaseId = String(phaseFeatureId ?? '').trim();
  if (isValidFtId(phaseId)) {
    out.push(
      buildEvidenceChainItem(
        phaseId,
        'Derived_Feature',
        '任务 5.5 价值流阶段主权领土正向归纳至本关键场景',
      ),
    );
  }
  const workflows = scenario.belonging_core_workflows ?? scenario.Belonging_Core_Workflows;
  const wfName = Array.isArray(workflows)
    ? String(asRec(workflows[0])?.workflow_name ?? asRec(workflows[0])?.Workflow_Name ?? '').trim()
    : '';
  const wfId = resolveTask53WorkflowFeatureId(wfName, classified, task53Features);
  if (isValidFtId(wfId)) {
    out.push(
      buildEvidenceChainItem(
        wfId,
        'Derived_Feature',
        '任务 5.3 核心工作流正向归纳至本关键场景',
      ),
    );
  }
  const pp = asRec(scenario.associated_pain_point ?? scenario.Associated_Pain_Point);
  const painId = String(pp?.pain_point_feature_id ?? pp?.Pain_Point_Feature_Id ?? '').trim();
  if (isValidFtId(painId)) {
    out.push(
      buildEvidenceChainItem(
        painId,
        'Structured_Feature',
        '任务 1 痛点雷达/现有表格化石正向归纳至本关键场景',
      ),
    );
  }
  return out;
}

/** 单阶段 LLM 输出：为每个「关键场景」行补全三源 Evidence_Support_Chain */
export function enrichTask6PhaseL3RawWithEvidenceChains(
  phaseRaw: string,
  phaseSubtask: Task6VsmPhaseSubtask,
  task53Features: readonly Task2L1TaskGraphFeatureRow[],
): string {
  const raw = String(phaseRaw ?? '').trim();
  if (!raw.length) return raw;
  let root: JsonRec;
  try {
    root = JSON.parse(raw.replace(/^\uFEFF/, '')) as JsonRec;
  } catch {
    return raw;
  }
  const matrix = asRec(root.L3_Scenario_Inference_Matrix ?? root.l3_scenario_inference_matrix);
  if (!matrix) return raw;
  const tk = matrix.Target_KV ?? matrix.target_kv;
  if (!Array.isArray(tk)) return raw;

  const phaseFeatureId = String(phaseSubtask.phaseFeature.featureId ?? '').trim();
  const classified = readClassifiedWorkflowsFromPhaseFeature(phaseSubtask.phaseFeature);

  for (const item of tk) {
    const rec = asRec(item);
    if (!rec) continue;
    const key = String(rec.Feature_Key ?? rec.feature_key ?? '').trim();
    if (key !== '关键场景' && !/^关键场景[_\s]*\d+/i.test(key)) continue;
    const scenario = peelScenarioFeatureValue(rec.Feature_Value ?? rec.feature_value);
    if (!scenario) continue;
    const synthesized = synthesizeChainForScenarioRow(
      scenario,
      phaseFeatureId,
      classified,
      task53Features,
    );
    if (!synthesized.length) continue;
    const existing = rec.Evidence_Support_Chain ?? rec.evidence_support_chain;
    const seen = existingChainSourceIds(existing);
    const merged = Array.isArray(existing) ? [...existing] : [];
    for (const link of synthesized) {
      const id = String(link.FeatureID ?? '').trim();
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(link);
    }
    rec.Evidence_Support_Chain = merged;
  }

  try {
    return JSON.stringify(root);
  } catch {
    return raw;
  }
}
