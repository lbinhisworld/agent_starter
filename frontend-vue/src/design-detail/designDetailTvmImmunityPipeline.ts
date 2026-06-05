/**
 * [INPUT]: 任务 3/4 L2 模型 TVM 行、推理图任务卡、原始 L2 JSON
 * [OUTPUT]: 免疫后 TVM 行、进度区「已继承任务 N 对齐结论，跳过问卷」文案、可落库的 mergedRaw
 * [POS]: `useDesignDetailChat` 任务 3/4 落库前与门禁共用；与后端 `design-detail-upstream-validation-immunity.ts` 口径一致
 *
 * [PROTOCOL]: 变更免疫规则时同步 `designDetailUpstreamValidationImmunity.ts`、后端 immunity 模块与 `design_mode_ux.md`
 */

import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import {
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
} from './designDetailLogicGraphMerge';
import {
  buildTask1PainPointConfirmedIndex,
  DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY,
  resolvePainConfirmedForTvmRow,
} from './designDetailPainPointConfirmed';
import {
  buildTask2Task3UpstreamConsistencyForTask4Immunity,
  buildTask2UpstreamConsistencyForTask3Immunity,
  type UpstreamConsistencyEntry,
} from './designDetailUpstreamValidationImmunity';
import {
  isTokenValidationMappingPotentialConflict,
  mergeSupplementTvmRowsFromReverseValidationLinks,
  mergeTvmRowsIntoL2BusinessInferenceRaw,
  mergeTvmRowsIntoL2ValueInferenceRaw,
  type Task2L1TvmParsedRow,
} from './designDetailTask2L1SyncUiProgress';

export type TvmImmunitySkipKind = 'upstream' | 'pain_point_confirmed';

export type TvmImmunitySkipLine = {
  kind: TvmImmunitySkipKind;
  sourceTaskDisplay: string;
  targetFeatureId: string;
  consistency: string;
};

/** 进度区单行：已继承上游对齐结论 / 任务 1 痛点确认，跳过问卷 */
export function formatTvmImmunitySkipProgressLine(line: TvmImmunitySkipLine): string {
  const fid = String(line.targetFeatureId || '').trim() || '—';
  const c = String(line.consistency || '').trim() || '—';
  if (line.kind === 'pain_point_confirmed') {
    return `→ 已继承${line.sourceTaskDisplay}对齐结论，跳过问卷｜${fid}｜${c}`;
  }
  return `→ 已继承${line.sourceTaskDisplay}对齐结论，跳过问卷｜${fid}｜${c}`;
}

function applyUpstreamImmunityWithSkipLines(
  rows: Task2L1TvmParsedRow[],
  upstream: ReadonlyMap<string, UpstreamConsistencyEntry>,
): { rows: Task2L1TvmParsedRow[]; skipLines: TvmImmunitySkipLine[] } {
  const skipLines: TvmImmunitySkipLine[] = [];
  const next = rows.map((r) => {
    const fid = String(r.targetFeatureId ?? '').trim();
    const entry =
      (fid ? upstream.get(fid) : undefined) ??
      resolveUpstreamEntryForTvmRow(r, upstream);
    if (!entry) return r;
    const immuneNote = `已继承${entry.sourceTaskDisplay}对齐结论（${entry.consistency}），免予重复问卷`;
    const logic = String(r.validationLogic ?? '').trim();
    skipLines.push({
      kind: 'upstream',
      sourceTaskDisplay: entry.sourceTaskDisplay,
      targetFeatureId: fid || r.tokenStr,
      consistency: entry.consistency,
    });
    return {
      ...r,
      consistency: entry.consistency,
      interviewQuestion: 'N/A',
      validationLogic: logic.includes('已继承') ? logic : logic ? `${logic}（${immuneNote}）` : immuneNote,
    };
  });
  return { rows: next, skipLines };
}

function resolveUpstreamEntryForTvmRow(
  row: Task2L1TvmParsedRow,
  upstream: ReadonlyMap<string, UpstreamConsistencyEntry>,
): UpstreamConsistencyEntry | undefined {
  const keys = [
    String(row.targetFeatureId ?? '').trim(),
    normalizeTokenKeyForLookup(row.tokenStr),
    normalizeTokenKeyForLookup(row.clientFactToken),
    normalizeTokenKeyForLookup(row.anchorModelFeature),
  ].filter(Boolean);
  for (const k of keys) {
    const e = upstream.get(k);
    if (e) return e;
  }
  return undefined;
}

function normalizeTokenKeyForLookup(raw: string): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  const head = t.split(/\s*·\s*/)[0]?.trim() ?? t;
  return head.replace(/\s+/g, '');
}

function applyPainPointConfirmedWithSkipLines(
  rows: Task2L1TvmParsedRow[],
  mergedTasks: DesignDetailLogicGraphTaskDto[],
): { rows: Task2L1TvmParsedRow[]; skipLines: TvmImmunitySkipLine[] } {
  const confirmed = buildTask1PainPointConfirmedIndex(mergedTasks);
  if (!confirmed.size) return { rows, skipLines: [] };
  const skipLines: TvmImmunitySkipLine[] = [];
  const next = rows.map((r) => {
    if (!resolvePainConfirmedForTvmRow(r, confirmed)) return r;
    const fid = String(r.targetFeatureId ?? '').trim() || r.tokenStr;
    skipLines.push({
      kind: 'pain_point_confirmed',
      sourceTaskDisplay: '任务 1',
      targetFeatureId: fid,
      consistency: DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY,
    });
    const note = `任务 1 节点已确认痛点，Consistency 统一为「${DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY}」`;
    const logic = String(r.validationLogic ?? '').trim();
    return {
      ...r,
      consistency: DESIGN_DETAIL_PAIN_POINT_CONFIRMED_CONSISTENCY,
      interviewQuestion: 'N/A',
      validationLogic: logic.includes('已确认痛点') ? logic : logic ? `${logic}（${note}）` : note,
    };
  });
  return { rows: next, skipLines };
}

export type TvmImmunityPipelineTier = 'task3' | 'task4';

/**
 * 任务 3/4：补全图边 → 上游免疫 → 痛点确认免疫 → 写回 L2 JSON（供落库与进度 TVM 灰块）。
 */
export function runTvmImmunityPipelineForTask3Or4(
  l2Raw: string,
  mergedTasks: DesignDetailLogicGraphTaskDto[] | null | undefined,
  tier: TvmImmunityPipelineTier,
  parseAlignment: (raw: string) => Task2L1TvmParsedRow[],
): {
  rows: Task2L1TvmParsedRow[];
  progressLines: string[];
  mergedRaw: string;
} {
  const raw = String(l2Raw || '').trim();
  if (!raw) {
    return { rows: [], progressLines: [], mergedRaw: raw };
  }
  let rows = parseAlignment(raw);
  const progressLines: string[] = [];
  const graph = mergedTasks?.length ? mergedTasks : null;
  if (!graph?.length) {
    const mergedRaw =
      tier === 'task3'
        ? mergeTvmRowsIntoL2BusinessInferenceRaw(raw, rows)
        : mergeTvmRowsIntoL2ValueInferenceRaw(raw, rows);
    return { rows, progressLines, mergedRaw };
  }

  const sourceLineTaskId =
    tier === 'task3' ? DESIGN_DETAIL_TASK3_LINE_TASK_ID : DESIGN_DETAIL_TASK4_LINE_TASK_ID;
  rows = mergeSupplementTvmRowsFromReverseValidationLinks(rows, graph, sourceLineTaskId);

  const upstream =
    tier === 'task3'
      ? buildTask2UpstreamConsistencyForTask3Immunity(graph)
      : buildTask2Task3UpstreamConsistencyForTask4Immunity(graph);
  if (upstream.size) {
    const up = applyUpstreamImmunityWithSkipLines(rows, upstream);
    rows = up.rows;
    for (const sl of up.skipLines) {
      progressLines.push(formatTvmImmunitySkipProgressLine(sl));
    }
  }

  const pp = applyPainPointConfirmedWithSkipLines(rows, graph);
  rows = pp.rows;
  for (const sl of pp.skipLines) {
    progressLines.push(formatTvmImmunitySkipProgressLine(sl));
  }

  const mergedRaw =
    tier === 'task3'
      ? mergeTvmRowsIntoL2BusinessInferenceRaw(raw, rows)
      : mergeTvmRowsIntoL2ValueInferenceRaw(raw, rows);
  return { rows, progressLines, mergedRaw };
}

/** 门禁用：在推理图已归一化前提下，对 TVM 行做与 pipeline 一致的免疫（不重复写回 raw）。 */
export function applyTvmImmunityToRowsForGate(
  rows: Task2L1TvmParsedRow[],
  graph: DesignDetailLogicGraphTaskDto[],
  tier: TvmImmunityPipelineTier,
): { rows: Task2L1TvmParsedRow[]; progressLines: string[] } {
  const sourceLineTaskId =
    tier === 'task3' ? DESIGN_DETAIL_TASK3_LINE_TASK_ID : DESIGN_DETAIL_TASK4_LINE_TASK_ID;
  let out = mergeSupplementTvmRowsFromReverseValidationLinks(rows, graph, sourceLineTaskId);
  const progressLines: string[] = [];
  const upstream =
    tier === 'task3'
      ? buildTask2UpstreamConsistencyForTask3Immunity(graph)
      : buildTask2Task3UpstreamConsistencyForTask4Immunity(graph);
  if (upstream.size) {
    const up = applyUpstreamImmunityWithSkipLines(out, upstream);
    out = up.rows;
    for (const sl of up.skipLines) {
      progressLines.push(formatTvmImmunitySkipProgressLine(sl));
    }
  }
  const pp = applyPainPointConfirmedWithSkipLines(out, graph);
  out = pp.rows;
  for (const sl of pp.skipLines) {
    progressLines.push(formatTvmImmunitySkipProgressLine(sl));
  }
  return { rows: out, progressLines };
}

/** 去重：同一 featureId 仅展示一条跳过问卷提示 */
export function dedupeTvmImmunityProgressLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ln of lines) {
    const k = ln.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(ln);
  }
  return out;
}
