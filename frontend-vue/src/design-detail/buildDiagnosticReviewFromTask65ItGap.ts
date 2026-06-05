/**
 * [INPUT]: 任务 6.5 单环节 LLM 原始 JSON、子任务元数据
 * [OUTPUT]: 「诊断梳理」画布视图模型（价值流阶段 → 流程环节 → Gap 类型 → 观察/建议）
 * [POS]: `DesignDetailDiagnosticReviewTab.vue`；子任务完成或深访重推后覆盖同 progressLabel
 */

import type { Task65ItGapSubtask } from './buildTask65ItGapInferenceInputFromTaskGraph';
import { normalizeL65ItGapInferenceRawForServerSync } from './designDetailTask2L1SyncUiProgress';

export type DiagnosticReviewGapPair = {
  gapObservation: string;
  solutionProposal: string;
};

export type DiagnosticReviewStepCard = {
  /** 与进度区子任务行一致，作为覆盖键 */
  progressLabel: string;
  phaseLabel: string;
  workflowName: string;
  stepName: string;
  optimizedWorkflowSegment: string;
  interactionExperienceGap: DiagnosticReviewGapPair;
  dataRecordGap: DiagnosticReviewGapPair;
  calculationAnalysisGap: DiagnosticReviewGapPair;
  inferenceSummary: string;
};

export type DiagnosticReviewPhaseColumn = {
  id: string;
  phaseName: string;
  steps: DiagnosticReviewStepCard[];
};

export type DiagnosticReviewGapKind = 'interaction' | 'data' | 'calculation';

export const DIAGNOSTIC_REVIEW_GAP_KIND_LABELS: Record<DiagnosticReviewGapKind, string> = {
  interaction: '交互体验 Gap',
  data: '数据记录 Gap',
  calculation: '计算分析 Gap',
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function parseFeatureValueObject(fv: unknown): Record<string, unknown> | null {
  if (fv != null && typeof fv === 'object' && !Array.isArray(fv)) {
    return fv as Record<string, unknown>;
  }
  if (typeof fv === 'string') {
    try {
      const inner = JSON.parse(fv);
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        return inner as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function readGapPair(
  fv: Record<string, unknown>,
  nestedKey: string,
  legacyFlatKey: string,
): DiagnosticReviewGapPair {
  const nested = asRecord(fv[nestedKey]);
  if (nested) {
    return {
      gapObservation: readStr(nested, 'gap_observation', 'Gap_Observation'),
      solutionProposal: readStr(nested, 'solution_proposal', 'Solution_Proposal'),
    };
  }
  const legacy = readStr(fv, legacyFlatKey);
  if (legacy) {
    return { gapObservation: '', solutionProposal: legacy };
  }
  return { gapObservation: '', solutionProposal: '' };
}

function pickGapSolutionRow(targetKv: unknown[]): Record<string, unknown> | null {
  for (const item of targetKv) {
    const row = asRecord(item);
    if (!row) continue;
    const key = readStr(row, 'Feature_Key', 'feature_key', 'FeatureKey');
    if (key === '流程优化Gap方案') return row;
  }
  return asRecord(targetKv[0]) ?? null;
}

function readGapPairFromSnapshot(raw: unknown): DiagnosticReviewGapPair {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      gapObservation: readStr(o, 'gapObservation', 'gap_observation'),
      solutionProposal: readStr(o, 'solutionProposal', 'solution_proposal'),
    };
  }
  if (typeof raw === 'string' && raw.trim()) {
    return { gapObservation: '', solutionProposal: raw.trim() };
  }
  return { gapObservation: '', solutionProposal: '' };
}

/** 自单步 IT-Gap 模型输出解析环节三向 Gap 子卡；失败返回 null */
export function parseDiagnosticReviewStepCardFromTask65Raw(
  stepRaw: string,
  sub: Pick<Task65ItGapSubtask, 'progressLabel' | 'phaseLabel' | 'workflowName' | 'stepName'>,
): DiagnosticReviewStepCard | null {
  const norm = normalizeL65ItGapInferenceRawForServerSync(stepRaw);
  if (!norm.ok) return null;
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(norm.normalized) as Record<string, unknown>;
  } catch {
    return null;
  }
  const matrix =
    asRecord(root.L3_IT_Gap_Analysis_Matrix) ??
    asRecord(root.l3_it_gap_analysis_matrix) ??
    root;
  const tk = matrix.Target_KV ?? matrix.target_kv;
  if (!Array.isArray(tk) || !tk.length) return null;
  const row = pickGapSolutionRow(tk);
  if (!row) return null;
  const fv = parseFeatureValueObject(row.Feature_Value ?? row.feature_value ?? row.featureValue);
  if (!fv) return null;

  const progressLabel = String(sub.progressLabel ?? '').trim();
  if (!progressLabel) return null;

  return {
    progressLabel,
    phaseLabel: readStr(fv, 'targeted_value_phase') || String(sub.phaseLabel ?? '').trim(),
    workflowName: String(sub.workflowName ?? '').trim(),
    stepName: readStr(fv, 'current_process_step_name') || String(sub.stepName ?? '').trim(),
    optimizedWorkflowSegment: readStr(fv, 'optimized_workflow_segment'),
    interactionExperienceGap: readGapPair(
      fv,
      'interaction_experience_gap',
      'interaction_experience_gap_solution',
    ),
    dataRecordGap: readGapPair(fv, 'data_record_gap', 'data_record_gap_solution'),
    calculationAnalysisGap: readGapPair(
      fv,
      'calculation_analysis_gap',
      'calculation_analysis_gap_solution',
    ),
    inferenceSummary: readStr(row, 'inference_summary', 'Inference_Summary'),
  };
}

/** 按 progressLabel 覆盖写入（深访重推同环节时替换） */
export function upsertDiagnosticReviewStepCard(
  store: Record<string, DiagnosticReviewStepCard>,
  card: DiagnosticReviewStepCard,
): Record<string, DiagnosticReviewStepCard> {
  const key = String(card.progressLabel ?? '').trim();
  if (!key) return store;
  return { ...store, [key]: card };
}

/** 将环节子卡按价值流阶段分组（阶段顺序为子卡首次出现顺序） */
export function buildDiagnosticReviewPhaseColumns(
  steps: ReadonlyArray<DiagnosticReviewStepCard>,
): DiagnosticReviewPhaseColumn[] {
  const phaseOrder: string[] = [];
  const byPhase = new Map<string, DiagnosticReviewStepCard[]>();
  for (const step of steps) {
    const phaseName = String(step.phaseLabel ?? '').trim() || '（未命名价值流阶段）';
    if (!byPhase.has(phaseName)) {
      byPhase.set(phaseName, []);
      phaseOrder.push(phaseName);
    }
    byPhase.get(phaseName)!.push(step);
  }
  return phaseOrder.map((phaseName, idx) => ({
    id: `phase-${idx}-${phaseName}`,
    phaseName,
    steps: byPhase.get(phaseName) ?? [],
  }));
}

export function diagnosticReviewStepsRecordToList(
  store: Readonly<Record<string, DiagnosticReviewStepCard>>,
): DiagnosticReviewStepCard[] {
  return Object.values(store);
}

export function parseDiagnosticReviewStepsSnapshot(raw: unknown): Record<string, DiagnosticReviewStepCard> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, DiagnosticReviewStepCard> = {};
  const entries = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
  for (const item of entries) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const progressLabel = String(o.progressLabel ?? '').trim();
    if (!progressLabel) continue;
    out[progressLabel] = {
      progressLabel,
      phaseLabel: String(o.phaseLabel ?? '').trim(),
      workflowName: String(o.workflowName ?? '').trim(),
      stepName: String(o.stepName ?? '').trim(),
      optimizedWorkflowSegment: String(o.optimizedWorkflowSegment ?? '').trim(),
      interactionExperienceGap: readGapPairFromSnapshot(o.interactionExperienceGap),
      dataRecordGap: readGapPairFromSnapshot(o.dataRecordGap),
      calculationAnalysisGap: readGapPairFromSnapshot(o.calculationAnalysisGap),
      inferenceSummary: String(o.inferenceSummary ?? '').trim(),
    };
  }
  return out;
}

export function getDiagnosticReviewGapPairForStep(
  step: DiagnosticReviewStepCard,
  kind: DiagnosticReviewGapKind,
): DiagnosticReviewGapPair {
  if (kind === 'interaction') return step.interactionExperienceGap;
  if (kind === 'data') return step.dataRecordGap;
  return step.calculationAnalysisGap;
}

export const DIAGNOSTIC_REVIEW_GAP_KINDS: DiagnosticReviewGapKind[] = [
  'interaction',
  'data',
  'calculation',
];

/** 模型「暂无」平息原语：该维度在工作区不渲染树节点 */
const DIAGNOSTIC_REVIEW_GAP_OBSERVATION_NONE = new Set([
  '暂无',
  '（暂无）',
  '无',
  '（无）',
  'N/A',
  'n/a',
  'NA',
]);

/** Gap 观察为「暂无」或空时，诊断梳理工作区不展示该 Gap 类型节点 */
export function isDiagnosticReviewGapObservationNone(observation: string): boolean {
  const t = String(observation ?? '').trim();
  if (!t) return true;
  return DIAGNOSTIC_REVIEW_GAP_OBSERVATION_NONE.has(t);
}

export function shouldRenderDiagnosticReviewGapKind(
  step: DiagnosticReviewStepCard,
  kind: DiagnosticReviewGapKind,
): boolean {
  return !isDiagnosticReviewGapObservationNone(
    getDiagnosticReviewGapPairForStep(step, kind).gapObservation,
  );
}

export function getVisibleDiagnosticReviewGapKindsForStep(
  step: DiagnosticReviewStepCard,
): DiagnosticReviewGapKind[] {
  return DIAGNOSTIC_REVIEW_GAP_KINDS.filter((k) => shouldRenderDiagnosticReviewGapKind(step, k));
}

export function stepHasRenderableDiagnosticReviewGap(step: DiagnosticReviewStepCard): boolean {
  return getVisibleDiagnosticReviewGapKindsForStep(step).length > 0;
}
