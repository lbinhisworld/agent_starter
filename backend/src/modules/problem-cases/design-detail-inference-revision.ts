/**
 * [INPUT]: 推理 sync 前后 `task-graph` 特征行、模型 JSON 原文、TVM 解析计划
 * [OUTPUT]: `DesignDetailInferenceRevisionRecord` 写入行；`parseCausalityAnalysisFromInferenceRaw` 抽取 Causality 字段
 * [POS]: 任务 2–5 `sync-task*-target-kv-tokens` 成功后的修订审计落库
 *
 * [PROTOCOL]: Causality 键名或矩阵根键变更时须同步 `design-detail-task2-l1-target-kv-tokens.ts` 与 `task1BusinessInsight.js`
 */
import type { DesignDetailTaskGraphFeatureDto } from './types';
import { normalizeDesignDetailFeatureOperator } from './design-detail-feature-operator';
import type {
  ParsedCausalityAnalysis,
  ParsedDiagnosticPainPoint,
} from './design-detail-task2-l1-target-kv-tokens';

export type { ParsedCausalityAnalysis, ParsedDiagnosticPainPoint } from './design-detail-task2-l1-target-kv-tokens';

/** 写入仓储前的单行（`recordKind` 由仓储映射为 Prisma ENUM） */
export type DesignDetailInferenceRevisionRowInput = {
  recordKind: 'FEATURE_VALUE' | 'TOKEN_VALIDATION' | 'DIAGNOSTIC_PAIN_POINT';
  featureId: string;
  fieldLabel?: string;
  valueBefore?: string;
  valueAfter?: string;
  validationLogic?: string;
  logicGapReport?: string;
  insightResolutionSummary?: string;
  alignmentQuestionnaire?: string;
  alignmentUserReply?: string;
  conflictDescription?: string;
  insightConfirmation?: string;
  rootCauseAnalysis?: string;
  designConstraint?: string;
};

export type DesignDetailInferenceRevisionAlignmentMeta = {
  alignmentQuestionnaire?: string;
  alignmentUserReply?: string;
};

/** 与 `parseTask*TargetKvSyncRows` 行对齐，用于「变更后」取值（不依赖 sync 后立刻读 task-graph） */
export type TargetKvSyncRowForRevision = {
  featureKey: string;
  operator?: string;
  featureValue?: unknown;
};

function designDetailTaskTokenSurfaceChinesePrimary(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const parts = s.split(/\s*·\s*/);
  const left = parts[0]?.trim() ?? '';
  return left || s;
}

function targetKvRowStableKey(featureKey: string, operator?: string): string {
  const chinese = designDetailTaskTokenSurfaceChinesePrimary(featureKey);
  const op = normalizeDesignDetailFeatureOperator(operator ?? '等于');
  if (chinese && op) return `${chinese}｜${op}`;
  return chinese || String(featureKey || '').trim();
}

function formatTargetKvFeatureValueDisplay(featureValue: unknown, operator?: string): string {
  const op = normalizeDesignDetailFeatureOperator(operator ?? '等于');
  let val = '';
  if (featureValue !== null && featureValue !== undefined) {
    if (typeof featureValue === 'object' && !Array.isArray(featureValue)) {
      const o = featureValue as Record<string, unknown>;
      const fv = o.Feature_Value ?? o.feature_value ?? o.value;
      if (fv !== null && fv !== undefined) {
        val = typeof fv === 'string' ? fv.trim() : String(fv).trim();
      }
    } else {
      val = String(featureValue).trim();
    }
  }
  if (val && op && op !== '—') return `${op} ${val}`;
  return val || '—';
}

function applyAlignmentMetaToRows(
  rows: DesignDetailInferenceRevisionRowInput[],
  alignment?: DesignDetailInferenceRevisionAlignmentMeta,
): DesignDetailInferenceRevisionRowInput[] {
  const questionnaire = String(alignment?.alignmentQuestionnaire ?? '').trim();
  const userReply = String(alignment?.alignmentUserReply ?? '').trim();
  if (!questionnaire && !userReply) return rows;
  return rows.map((r) => ({
    ...r,
    alignmentQuestionnaire: questionnaire || r.alignmentQuestionnaire,
    alignmentUserReply: userReply || r.alignmentUserReply,
  }));
}

function featureStableKey(f: DesignDetailTaskGraphFeatureDto): string {
  const td = String(f.tokenDisplay ?? '').trim();
  const chinese = td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
  const op = String(f.operator ?? '').trim();
  if (chinese && op) return `${chinese}｜${op}`;
  if (chinese) return chinese;
  return String(f.featureId ?? '').trim();
}

function featureDisplayValue(f: DesignDetailTaskGraphFeatureDto): string {
  const val = String(f.name ?? '').trim();
  const op = String(f.operator ?? '').trim();
  if (val && op && op !== '—') return `${op} ${val}`;
  return val || '—';
}

type FeatureSnapshotEntry = {
  featureId: string;
  fieldLabel: string;
  displayValue: string;
};

function buildFeatureSnapshotEntries(
  features: ReadonlyArray<DesignDetailTaskGraphFeatureDto>,
): FeatureSnapshotEntry[] {
  const byKey = new Map<string, FeatureSnapshotEntry>();
  for (const f of features) {
    const fieldLabel = featureStableKey(f);
    const featureId = String(f.featureId ?? '').trim();
    if (!fieldLabel && !featureId) continue;
    const key = fieldLabel || featureId;
    byKey.set(key, {
      featureId: featureId || key,
      fieldLabel: fieldLabel || featureId,
      displayValue: featureDisplayValue(f),
    });
  }
  return [...byKey.values()];
}

export function buildFeatureValueRevisionRows(
  before: ReadonlyArray<DesignDetailTaskGraphFeatureDto>,
  after: ReadonlyArray<DesignDetailTaskGraphFeatureDto>,
  causality: ParsedCausalityAnalysis,
): DesignDetailInferenceRevisionRowInput[] {
  const beforeEntries = buildFeatureSnapshotEntries(before);
  const afterEntries = buildFeatureSnapshotEntries(after);
  const beforeByLabel = new Map(beforeEntries.map((e) => [e.fieldLabel, e]));
  const afterByLabel = new Map(afterEntries.map((e) => [e.fieldLabel, e]));
  const keys = new Set([...beforeByLabel.keys(), ...afterByLabel.keys()]);
  const rows: DesignDetailInferenceRevisionRowInput[] = [];
  const sorted = [...keys].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  for (const fieldLabel of sorted) {
    const b = beforeByLabel.get(fieldLabel);
    const a = afterByLabel.get(fieldLabel);
    const valueBefore = b?.displayValue ?? '—';
    const valueAfter = a?.displayValue ?? '—';
    if (valueBefore === valueAfter) continue;
    rows.push({
      recordKind: 'FEATURE_VALUE',
      featureId: (a?.featureId || b?.featureId || fieldLabel).trim(),
      fieldLabel,
      valueBefore,
      valueAfter,
      logicGapReport: causality.logicGapReport || undefined,
      insightResolutionSummary: causality.insightResolutionSummary || undefined,
    });
  }
  return rows;
}

/** 以本次 sync 解析出的 Target_KV 为「变更后」口径，与 sync 前 task-graph 快照比对（与前端 alignment diff 一致） */
export function buildFeatureValueRevisionRowsFromTargetKv(
  before: ReadonlyArray<DesignDetailTaskGraphFeatureDto>,
  afterTargetKvRows: ReadonlyArray<TargetKvSyncRowForRevision>,
  causality: ParsedCausalityAnalysis,
): DesignDetailInferenceRevisionRowInput[] {
  const beforeByKey = new Map<string, { featureId: string; displayValue: string }>();
  for (const f of before) {
    const key = featureStableKey(f);
    if (!key) continue;
    beforeByKey.set(key, {
      featureId: String(f.featureId ?? '').trim() || key,
      displayValue: featureDisplayValue(f),
    });
  }
  const rows: DesignDetailInferenceRevisionRowInput[] = [];
  const seenAfter = new Set<string>();
  for (const r of afterTargetKvRows) {
    const fieldLabel = targetKvRowStableKey(r.featureKey, r.operator);
    if (!fieldLabel || seenAfter.has(fieldLabel)) continue;
    seenAfter.add(fieldLabel);
    const valueAfter = formatTargetKvFeatureValueDisplay(r.featureValue, r.operator);
    const b = beforeByKey.get(fieldLabel);
    const valueBefore = b?.displayValue ?? '—';
    if (valueBefore === valueAfter) continue;
    rows.push({
      recordKind: 'FEATURE_VALUE',
      featureId: (b?.featureId || fieldLabel).trim(),
      fieldLabel,
      valueBefore,
      valueAfter,
      logicGapReport: causality.logicGapReport || undefined,
      insightResolutionSummary: causality.insightResolutionSummary || undefined,
    });
  }
  return rows;
}

const FT_FEATURE_ID_RE = /\bft_\d{12}\b/gi;

/** 从文本中提取 `ft_` + 12 位数字的特征 id（去重保序） */
export function extractFtFeatureIdsFromText(...textParts: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of textParts) {
    const s = String(part ?? '');
    const matches = s.match(FT_FEATURE_ID_RE);
    if (!matches) continue;
    for (const m of matches) {
      const id = m.toLowerCase();
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

function isTvmPotentialConflictLabel(consistencyRaw: string | undefined): boolean {
  const c0 = String(consistencyRaw ?? '').trim();
  if (!c0) return false;
  if (c0.includes('已通过洞察修正') || c0.includes('已通过纠偏修正') || c0.includes('逻辑一致')) {
    return false;
  }
  const c = c0.replace(/\s+/g, '');
  if (!c.includes('潜在冲突')) return false;
  if (
    /无潜在冲突|非潜在冲突|没有潜在冲突|不存在潜在冲突|不含潜在冲突|暂无潜在冲突|未现潜在冲突/.test(c)
  ) {
    return false;
  }
  return true;
}

/** 诊断痛点行的 `featureId` 须为 `ft_` 格式；`Conflict_ID`（如 DIA-L2-001）写入 `fieldLabel` */
export function resolveDiagnosticPainPointFeatureId(
  pain: ParsedDiagnosticPainPoint,
  index: number,
  tvPlans: ReadonlyArray<{ targetFeatureId: string; consistencyLabel?: string }>,
): string {
  const conflictTvTargets = tvPlans
    .filter((p) => isTvmPotentialConflictLabel(p.consistencyLabel))
    .map((p) => String(p.targetFeatureId || '').trim())
    .filter((id) => /^ft_\d{12}$/i.test(id));

  const fromText = extractFtFeatureIdsFromText(
    pain.conflictDescription,
    pain.insightConfirmation,
    pain.rootCauseAnalysis,
    pain.designConstraint,
    pain.painPointId,
  );
  for (const id of fromText) {
    if (/^ft_\d{12}$/i.test(id)) return id.toLowerCase();
  }
  if (conflictTvTargets[index]) return conflictTvTargets[index]!;
  if (conflictTvTargets.length === 1) return conflictTvTargets[0]!;
  if (conflictTvTargets.length > 0) return conflictTvTargets[0]!;
  return `ft_${String(900000000000 + index + 1).padStart(12, '0').slice(-12)}`;
}

export function buildTokenValidationRevisionRows(
  tvPlans: ReadonlyArray<{ targetFeatureId: string; validationLogic: string }>,
  causality: ParsedCausalityAnalysis,
): DesignDetailInferenceRevisionRowInput[] {
  const rows: DesignDetailInferenceRevisionRowInput[] = [];
  for (const p of tvPlans) {
    const featureId = String(p.targetFeatureId || '').trim();
    if (!featureId) continue;
    const validationLogic = String(p.validationLogic || '').trim() || '（无说明）';
    rows.push({
      recordKind: 'TOKEN_VALIDATION',
      featureId,
      validationLogic,
      logicGapReport: causality.logicGapReport || undefined,
      insightResolutionSummary: causality.insightResolutionSummary || undefined,
    });
  }
  return rows;
}

export function buildDiagnosticPainPointRevisionRows(
  painPoints: ReadonlyArray<ParsedDiagnosticPainPoint>,
  causality: ParsedCausalityAnalysis,
  tvPlans: ReadonlyArray<{ targetFeatureId: string; consistencyLabel?: string }> = [],
): DesignDetailInferenceRevisionRowInput[] {
  const rows: DesignDetailInferenceRevisionRowInput[] = [];
  painPoints.forEach((p, index) => {
    const featureId = resolveDiagnosticPainPointFeatureId(p, index, tvPlans);
    const conflictId = String(p.painPointId || '').trim();
    const fieldLabel = conflictId && !/^ft_\d{12}$/i.test(conflictId) ? conflictId : `诊断痛点-${index + 1}`;
    rows.push({
      recordKind: 'DIAGNOSTIC_PAIN_POINT',
      featureId,
      fieldLabel,
      conflictDescription: p.conflictDescription || undefined,
      insightConfirmation: p.insightConfirmation || undefined,
      rootCauseAnalysis: p.rootCauseAnalysis || undefined,
      designConstraint: p.designConstraint || undefined,
      logicGapReport: causality.logicGapReport || undefined,
      insightResolutionSummary: causality.insightResolutionSummary || undefined,
    });
  });
  return rows;
}

export function buildDesignDetailInferenceRevisionRows(input: {
  beforeFeatures: ReadonlyArray<DesignDetailTaskGraphFeatureDto>;
  afterFeatures: ReadonlyArray<DesignDetailTaskGraphFeatureDto>;
  afterTargetKvRows?: ReadonlyArray<TargetKvSyncRowForRevision>;
  tvPlans: ReadonlyArray<{
    targetFeatureId: string;
    validationLogic: string;
    consistencyLabel?: string;
  }>;
  causality: ParsedCausalityAnalysis;
  painPoints?: ReadonlyArray<ParsedDiagnosticPainPoint>;
  alignment?: DesignDetailInferenceRevisionAlignmentMeta;
}): DesignDetailInferenceRevisionRowInput[] {
  const featureRows =
    input.afterTargetKvRows && input.afterTargetKvRows.length > 0
      ? buildFeatureValueRevisionRowsFromTargetKv(
          input.beforeFeatures,
          input.afterTargetKvRows,
          input.causality,
        )
      : buildFeatureValueRevisionRows(input.beforeFeatures, input.afterFeatures, input.causality);
  const tvRows = buildTokenValidationRevisionRows(input.tvPlans, input.causality);
  const painRows = buildDiagnosticPainPointRevisionRows(
    input.painPoints ?? [],
    input.causality,
    input.tvPlans,
  );
  const questionnaire = String(input.alignment?.alignmentQuestionnaire ?? '').trim();
  const userReply = String(input.alignment?.alignmentUserReply ?? '').trim();
  const merged = [...featureRows, ...tvRows, ...painRows];
  if (!merged.length) {
    const { logicGapReport, insightResolutionSummary } = input.causality;
    if (logicGapReport || insightResolutionSummary || questionnaire || userReply) {
      return applyAlignmentMetaToRows(
        [
          {
            recordKind: 'FEATURE_VALUE',
            featureId: 'ft_999999999999',
            fieldLabel: 'Causality_Analysis',
            logicGapReport: logicGapReport || undefined,
            insightResolutionSummary: insightResolutionSummary || undefined,
          },
        ],
        input.alignment,
      );
    }
    return [];
  }
  return applyAlignmentMetaToRows(merged, input.alignment);
}

/** 从 `GET …/task-graph` 任务列表中按 taskId 别名选取特征行 */
export function pickGraphFeaturesForTaskIds(
  tasks: ReadonlyArray<{ taskId?: string; features?: DesignDetailTaskGraphFeatureDto[] }>,
  taskIds: ReadonlyArray<string>,
): DesignDetailTaskGraphFeatureDto[] {
  const idSet = new Set(taskIds.map((t) => String(t || '').trim()).filter(Boolean));
  for (const t of tasks) {
    const tid = String(t?.taskId || '').trim();
    if (!idSet.has(tid)) continue;
    return Array.isArray(t.features) ? t.features : [];
  }
  return [];
}
