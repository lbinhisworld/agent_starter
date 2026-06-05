/**
 * [INPUT]: `GET …/task-graph` 归一化后的 `tasks[]`；`humanizeDesignDetailFeatureConclusionsFromContext`（`designDetailFeatureConclusionHumanize.js`）
 * [OUTPUT]: 任务进展卡「推理结论」行（`inference_conclusion_sub`）；使用/调试模式均展示
 * [POS]: Target_KV 落库后、**反向校验门禁之前**，按本线步 Feature 逐条推送说人话结论（已推送永不擦除）
 *
 * [PROTOCOL]: 变更时同步 `useDesignDetailChat.ts`、`designDetailLlmStats.ts`、`designDetailExperienceMode.ts`、`DesignTaskDynamicsCard.vue`、`designDetailProgressWorkspace.ts`（`mergeDynamicsCardsPreferRicherProgress` / `scoreInferenceConclusionProgressRichness`）、`designDetailTask10InferenceConclusionFormat.ts`、`designDetailTask52InferenceConclusionFormat.ts`、`frontend/js/designDetailFeatureConclusionHumanize.js`
 */

import {
  designLinePillLabel,
  DESIGN_MODE_LINE_TASK_ORDER,
  type DesignDetailLineTaskId,
} from './designModeTaskPipeline';
import type { DesignDetailLogicGraphFeatureDto, DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';
import {
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
  DESIGN_DETAIL_TASK52_LINE_TASK_ID,
  normLogicTaskId,
} from './designDetailLogicGraphMerge';
import { buildFeatureConclusionHumanizeCallTarget } from './designDetailLlmStats';
import {
  buildTask10InferenceConclusionUnits,
  listRemainingTask10ConclusionUnits,
  type Task10ConclusionUnit,
} from './designDetailTask10InferenceConclusionFormat';
import {
  buildTask52InferenceConclusionUnits,
  listRemainingTask52ConclusionUnits,
  type Task52ConclusionUnit,
} from './designDetailTask52InferenceConclusionFormat';

export type FeatureConclusionInput = {
  featureId: string;
  token: string;
  operator: string;
  value: string;
  rationale: string;
};

const MAX_FEATURES_PER_BATCH = 36;

/** 与 `useDesignDetailChat.appendLineToCard` 写入的标题行一致 */
export const INFERENCE_CONCLUSION_ORGANIZE_LINE = '→ 推理结论整理';

const INFERENCE_CONCLUSION_EMPTY_LINE = '（本步未解析到可展示的推理特征节点）';

const INFERENCE_CONCLUSION_COUNT_LINE_RE = /^→ 本步共形成 (\d+) 条推理结论$/;

export type InferenceConclusionProgressLineLike = {
  kind: string;
  full: string;
  cursor: number;
  /** 与 graph `featureId` 对齐；旧快照无此字段时按 body 行序回退 */
  inferenceFeatureId?: string;
};

function cpLen(s: string): number {
  return Array.from(s).length;
}

function isLineFullyRevealed(line: InferenceConclusionProgressLineLike): boolean {
  return line.cursor >= cpLen(line.full);
}

/** 动态卡上是否已有「推理结论整理」标题行 */
export function hasFeatureInferenceConclusionOrganizeLine(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
): boolean {
  return lines.some((l) => l.kind === 'scope_green' && l.full === INFERENCE_CONCLUSION_ORGANIZE_LINE);
}

function hasInferenceConclusionEmptyMarkerLine(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
): boolean {
  return lines.some(
    (l) => l.kind === 'inference_conclusion_sub' && l.full === INFERENCE_CONCLUSION_EMPTY_LINE,
  );
}

function hasInferenceConclusionCountLine(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
): boolean {
  return lines.some(
    (l) =>
      l.kind === 'inference_conclusion_sub' &&
      INFERENCE_CONCLUSION_COUNT_LINE_RE.test(l.full.trim()),
  );
}

function listInferenceConclusionBodyLines(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
): InferenceConclusionProgressLineLike[] {
  return lines.filter(
    (l) =>
      l.kind === 'inference_conclusion_sub' &&
      l.full !== INFERENCE_CONCLUSION_EMPTY_LINE &&
      !INFERENCE_CONCLUSION_COUNT_LINE_RE.test(l.full.trim()),
  );
}

/** 从动态卡行收集已推送的 featureId（永不擦除已推送结论） */
export function collectPushedInferenceFeatureIds(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
  inputs: ReadonlyArray<FeatureConclusionInput>,
): Set<string> {
  const ids = new Set<string>();
  for (const l of lines) {
    const fid = String(l.inferenceFeatureId ?? '').trim();
    if (fid && fid !== '—') ids.add(fid);
  }
  if (ids.size > 0) return ids;
  /** 旧快照无 `inferenceFeatureId`：按 body 行序与 inputs 对齐 */
  const bodies = listInferenceConclusionBodyLines(lines);
  for (let i = 0; i < bodies.length && i < inputs.length; i += 1) {
    const fid = String(inputs[i]!.featureId).trim();
    if (fid && fid !== '—') ids.add(fid);
  }
  return ids;
}

/** 尚未写入动态卡的 feature 结论输入 */
export function listRemainingFeatureConclusionInputs(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
  inputs: ReadonlyArray<FeatureConclusionInput>,
): FeatureConclusionInput[] {
  if (!inputs.length) return [];
  const pushed = collectPushedInferenceFeatureIds(lines, inputs);
  return inputs.filter((inp) => {
    const fid = String(inp.featureId).trim();
    return fid && fid !== '—' && !pushed.has(fid);
  });
}

function parseInferenceConclusionExpectedCount(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
): number | null {
  for (const l of lines) {
    if (l.kind !== 'inference_conclusion_sub') continue;
    const m = INFERENCE_CONCLUSION_COUNT_LINE_RE.exec(String(l.full || '').trim());
    if (m) {
      const n = parseInt(m[1]!, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  return null;
}

/** 本线步推理结论是否已推满（按条数计，不因 graph featureId 重分配而重推） */
export function hasCompletedFeatureInferenceConclusionPushForLineStep(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
  mergedTasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
): boolean {
  if (hasInferenceConclusionEmptyMarkerLine(lines)) return true;
  if (lineTaskId === DESIGN_DETAIL_TASK10_LINE_TASK_ID) {
    const units = listTask10ConclusionUnitsForLineStep(mergedTasks);
    if (!units.length) return false;
    if (isFeatureInferenceConclusionPushInProgress(lines)) return false;
    return listRemainingTask10ConclusionUnits(lines, units).length === 0;
  }
  if (lineTaskId === DESIGN_DETAIL_TASK52_LINE_TASK_ID) {
    const units = listTask52ConclusionUnitsForLineStep(mergedTasks);
    if (!units.length) return false;
    if (isFeatureInferenceConclusionPushInProgress(lines)) return false;
    return listRemainingTask52ConclusionUnits(lines, units).length === 0;
  }
  const inputs = listFeatureConclusionInputsForLineStep(mergedTasks, lineTaskId);
  const bodies = listInferenceConclusionBodyLines(lines);
  if (!bodies.length) return false;
  if (isFeatureInferenceConclusionPushInProgress(lines)) return false;

  const expectedCount = parseInferenceConclusionExpectedCount(lines);
  if (expectedCount != null && bodies.length >= expectedCount) return true;

  if (
    inputs.length > 0 &&
    bodies.length >= inputs.length &&
    hasFeatureInferenceConclusionOrganizeLine(lines) &&
    hasInferenceConclusionCountLine(lines)
  ) {
    return true;
  }

  return listRemainingFeatureConclusionInputs(lines, inputs).length === 0;
}

/** hydrate 合并动态卡时：推理结论 reveal 进度越高越优先保留 */
export function scoreInferenceConclusionProgressRichness(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
): number {
  let score = 0;
  for (const l of lines) {
    if (l.kind !== 'inference_conclusion_sub') continue;
    const full = String(l.full || '').trim();
    if (full === INFERENCE_CONCLUSION_EMPTY_LINE) continue;
    if (INFERENCE_CONCLUSION_COUNT_LINE_RE.test(full)) {
      score += 500;
      continue;
    }
    const cursor = typeof l.cursor === 'number' ? l.cursor : 0;
    score += 10_000 + cursor;
  }
  return score;
}

/** 仍有 `inference_conclusion_sub` 在逐码点 reveal 中 */
export function isFeatureInferenceConclusionPushInProgress(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
): boolean {
  return lines.some(
    (l) => l.kind === 'inference_conclusion_sub' && !isLineFullyRevealed(l),
  );
}

/**
 * 是否应继续推送推理结论（返回 false = 全部已推送或正在 reveal，**不**擦除已有行）。
 */
export function shouldProceedWithFeatureInferenceConclusionPush(
  lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
  mergedTasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
): boolean {
  if (lineTaskId === DESIGN_DETAIL_TASK10_LINE_TASK_ID) {
    const units = listTask10ConclusionUnitsForLineStep(mergedTasks);
    if (!units.length) return !hasInferenceConclusionEmptyMarkerLine(lines);
    if (hasCompletedFeatureInferenceConclusionPushForLineStep(lines, mergedTasks, lineTaskId)) {
      return false;
    }
    if (isFeatureInferenceConclusionPushInProgress(lines)) return false;
    return listRemainingTask10ConclusionUnits(lines, units).length > 0;
  }
  if (lineTaskId === DESIGN_DETAIL_TASK52_LINE_TASK_ID) {
    const units = listTask52ConclusionUnitsForLineStep(mergedTasks);
    if (!units.length) return !hasInferenceConclusionEmptyMarkerLine(lines);
    if (hasCompletedFeatureInferenceConclusionPushForLineStep(lines, mergedTasks, lineTaskId)) {
      return false;
    }
    if (isFeatureInferenceConclusionPushInProgress(lines)) return false;
    return listRemainingTask52ConclusionUnits(lines, units).length > 0;
  }
  const inputs = listFeatureConclusionInputsForLineStep(mergedTasks, lineTaskId);
  if (!inputs.length) {
    return !hasInferenceConclusionEmptyMarkerLine(lines);
  }
  if (hasCompletedFeatureInferenceConclusionPushForLineStep(lines, mergedTasks, lineTaskId)) {
    return false;
  }
  if (isFeatureInferenceConclusionPushInProgress(lines)) return false;
  return listRemainingFeatureConclusionInputs(lines, inputs).length > 0;
}

/** 「任务 4」= `core_value_driver_inference`；严格大于该步时适用「等于 → 引入」等文案规则 */
export function isInferenceConclusionLineStepAfterDesignTask4(
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
): boolean {
  const idx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(lineTaskId);
  const t4End = DESIGN_MODE_LINE_TASK_ORDER.indexOf('core_value_driver_inference');
  if (idx < 0 || t4End < 0) return false;
  return idx > t4End;
}

/** 与后端规范化比较符口径对齐的「等于」判断（简体 + 少量英文等价） */
export function isFeatureConclusionEqualityOperator(operator: string): boolean {
  const o = String(operator || '')
    .trim()
    .toLowerCase()
    .normalize('NFKC');
  if (!o) return true;
  if (o === '等于') return true;
  if (o === '=' || o === '==' || o === 'eq' || o === 'equals' || o === 'equal') return true;
  return false;
}

function structuredFeatureValueLabel(raw: unknown, ...keys: string[]): string {
  let cur: unknown = raw;
  if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
    const rec = cur as Record<string, unknown>;
    const nested = rec.Feature_Value ?? rec.feature_value;
    if (nested !== undefined && nested !== null) cur = nested;
  }
  if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
    const rec = cur as Record<string, unknown>;
    for (const k of keys) {
      const v = String(rec[k] ?? '').trim();
      if (v) return v;
    }
  }
  if (typeof cur === 'string') return cur.trim();
  return '';
}

function formatFeatureValueBrief(f: DesignDetailLogicGraphFeatureDto): string {
  const scenario = structuredFeatureValueLabel(
    f.featureValue ?? f.feature_value,
    'scenario_name',
  );
  if (scenario) return scenario;
  const phase = structuredFeatureValueLabel(f.featureValue ?? f.feature_value, 'phase_name');
  if (phase) return phase;
  const raw = f.featureValue ?? f.feature_value ?? f.name;
  if (raw == null) return '—';
  if (typeof raw === 'string') return raw.trim() || '—';
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  try {
    const s = JSON.stringify(raw);
    return s.length > 240 ? `${s.slice(0, 240)}…` : s;
  } catch {
    return String(raw);
  }
}

function tokenLabelFromFeature(f: DesignDetailLogicGraphFeatureDto): string {
  const td = String(f.tokenDisplay ?? f.token_display ?? '').trim();
  if (td) {
    const head = td.split(/\s*·\s*/)[0]?.trim();
    return head || td;
  }
  const nm = String(f.name ?? '').trim();
  if (nm.includes('·')) return nm.split(/\s*·\s*/)[0]?.trim() || nm;
  return nm || '—';
}

/** 从 task-graph 特征行抽取四要素（推理依据优先 inference_summary） */
export function buildFeatureConclusionInput(
  f: DesignDetailLogicGraphFeatureDto,
): FeatureConclusionInput {
  const featureId = String(f.featureId ?? '').trim() || '—';
  const token = tokenLabelFromFeature(f);
  const operator = String(f.operator ?? '').trim() || '等于';
  const nameRaw = String(f.name ?? '').trim();
  const value =
    nameRaw && nameRaw !== '[object Object]' && !nameRaw.startsWith('{')
      ? nameRaw
      : formatFeatureValueBrief(f);
  const rationale =
    String(f.inferenceSummary ?? f.inference_summary ?? '').trim() || '（模型未提供推理依据）';
  return { featureId, token, operator, value, rationale };
}

export function formatFeatureConclusionRuleBased(
  input: FeatureConclusionInput,
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
): string {
  const basis =
    input.rationale && input.rationale !== '（模型未提供推理依据）'
      ? `依据：${input.rationale}`
      : '';
  const afterT4 = isInferenceConclusionLineStepAfterDesignTask4(lineTaskId);
  if (
    afterT4 &&
    isFeatureConclusionEqualityOperator(input.operator) &&
    input.token.trim() &&
    input.value.trim()
  ) {
    let core = `${input.token.trim()} 引入 ${input.value.trim()}`;
    if (basis) core += `；${basis}`;
    return core;
  }
  return `【${input.token}】${input.operator}「${input.value}」${basis ? `；${basis}` : ''}`;
}

/** LLM 句后处理：任务 5+ 且本行 operator 语义为等于时，将「等于/等同于」收口为「引入」句式，并去掉句首「→」 */
export function polishFeatureConclusionSentenceForEqualityIntro(
  sentence: string,
  input: FeatureConclusionInput | undefined,
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
): string {
  let s = String(sentence || '')
    .trim()
    .replace(/^→\s*/u, '')
    .trim();
  if (
    !input ||
    !s ||
    !isInferenceConclusionLineStepAfterDesignTask4(lineTaskId) ||
    !isFeatureConclusionEqualityOperator(input.operator)
  ) {
    return s;
  }
  const tok = input.token.trim();
  const val = input.value.trim();
  if (!tok || !val) return s;

  /** 已为规范句式则不覆盖（保留模型对依据等补充） */
  if (new RegExp(`^${escapeRegExp(tok)}\\s+引入\\s+${escapeRegExp(val)}`).test(s)) {
    return s;
  }

  const br = /^【([\s\S]+)】$/u.exec(s);
  const core = br?.[1] ? String(br[1]).trim() : s;

  const tr = escapeRegExp(tok);
  const vr = escapeRegExp(val);

  /** token + 「/『 value 』/」+ 后缀 */
  const qm = new RegExp(`^${tr}\\s*(?:等于|等同于)\\s*[「『]${vr}[」』]([\\s\\S]*)$`, 'u').exec(core);
  if (qm) return `${tok} 引入 ${val}${qm[1] ?? ''}`.trim();

  const fm = new RegExp(`^${tr}\\s*(?:等于|等同于)\\s*${vr}([\\s\\S]*)$`, 'u').exec(core);
  if (fm) return `${tok} 引入 ${val}${fm[1] ?? ''}`.trim();

  const nm = new RegExp(`^${tr}等于${vr}([\\s\\S]*)$`, 'u').exec(core);
  if (nm) return `${tok} 引入 ${val}${nm[1] ?? ''}`.trim();

  /** 首尾无法匹配时使用规则句式（尽量不丢依据段） */
  const basisIdx = core.search(/；\s*依据[:：]/u);
  if (basisIdx >= 0 && core.startsWith(tok)) {
    const basis = core.slice(basisIdx);
    return `${tok} 引入 ${val}${basis}`;
  }
  return `${tok} 引入 ${val}`;
}

function escapeRegExp(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pickGraphTaskByNormLineStep(
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
): DesignDetailLogicGraphTaskDto | undefined {
  return merged.find((t) => normLogicTaskId(t.taskId) === lineTaskId);
}

export function listFeatureConclusionInputsForLineStep(
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>,
): FeatureConclusionInput[] {
  const task = pickGraphTaskByNormLineStep(merged, lineTaskId);
  const features = Array.isArray(task?.features) ? task!.features : [];
  return features.map((f) => buildFeatureConclusionInput(f));
}

function listTask10FeaturesForLineStep(
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): DesignDetailLogicGraphFeatureDto[] {
  const task = pickGraphTaskByNormLineStep(merged, DESIGN_DETAIL_TASK10_LINE_TASK_ID);
  return Array.isArray(task?.features) ? task!.features : [];
}

export function listTask10ConclusionUnitsForLineStep(
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Task10ConclusionUnit[] {
  return buildTask10InferenceConclusionUnits(listTask10FeaturesForLineStep(merged));
}

function listTask52FeaturesForLineStep(
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): DesignDetailLogicGraphFeatureDto[] {
  const task = pickGraphTaskByNormLineStep(merged, DESIGN_DETAIL_TASK52_LINE_TASK_ID);
  return Array.isArray(task?.features) ? task!.features : [];
}

export function listTask52ConclusionUnitsForLineStep(
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Task52ConclusionUnit[] {
  return buildTask52InferenceConclusionUnits(listTask52FeaturesForLineStep(merged));
}

type HumanizeWindow = {
  humanizeDesignDetailFeatureConclusionsFromContext?: (
    payload: { items: Array<{ i: number; token: string; operator: string; value: string; rationale: string }> },
    fetchOpts?: {
      signal?: AbortSignal;
      llmLog?: { caseId: string; taskId: string; callTarget: string };
    },
  ) => Promise<{ sentences: string[]; rawOutput?: string }>;
};

async function humanizeConclusionsViaLlm(
  inputs: FeatureConclusionInput[],
  audit: { caseId: string; lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>; callTarget: string },
  signal?: AbortSignal,
): Promise<string[] | null> {
  const fn = (window as unknown as HumanizeWindow).humanizeDesignDetailFeatureConclusionsFromContext;
  if (typeof fn !== 'function' || !inputs.length) return null;
  try {
    const items = inputs.map((x, i) => ({
      i,
      token: x.token,
      operator: x.operator,
      value: x.value,
      rationale: x.rationale,
    }));
    const res = await fn(
      { items },
      {
        ...(signal ? { signal } : {}),
        llmLog: {
          caseId: audit.caseId,
          taskId: designLinePillLabel(audit.lineTaskId),
          callTarget: audit.callTarget,
        },
      },
    );
    const sentences = Array.isArray(res?.sentences) ? res.sentences : [];
    if (sentences.length !== inputs.length) return null;
    if (sentences.some((s) => !String(s || '').trim())) return null;
    return sentences.map((s, i) =>
      polishFeatureConclusionSentenceForEqualityIntro(String(s).trim(), inputs[i], audit.lineTaskId),
    );
  } catch {
    return null;
  }
}

/** `instant`：立即展示；`typing_reveal`：与任务动态其它行一致逐码点 reveal */
export type AppendFeatureInferenceConclusionLineMode = 'instant' | 'typing_reveal';

export type AppendFeatureInferenceConclusionsDeps = {
  caseId: string;
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>;
  auditTaskIdLabel: string;
  mergedTasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>;
  /** 当前动态卡已有行（用于跳过已推送 feature、避免擦除） */
  existingLines?: ReadonlyArray<InferenceConclusionProgressLineLike>;
  appendLine: (
    text: string,
    mode?: AppendFeatureInferenceConclusionLineMode,
    featureId?: string,
  ) => void | Promise<void>;
  /** 上一条 `typing_reveal` 结论写完后，等待当前进度区 reveal 结束再推送下一条 */
  waitRevealComplete?: () => Promise<void>;
  withLlmAudit: <T>(callTarget: string, fn: () => Promise<T>) => Promise<T>;
  signal?: AbortSignal;
};

/**
 * 将本线步落库 Feature 整理为说人话结论并写入任务进展卡（仅追加未推送的 feature；已存在行不删改）。
 */
async function appendStructuredInferenceConclusionUnits(
  deps: AppendFeatureInferenceConclusionsDeps,
  existing: ReadonlyArray<InferenceConclusionProgressLineLike>,
  units: ReadonlyArray<Task10ConclusionUnit | Task52ConclusionUnit>,
  listRemaining: (
    lines: ReadonlyArray<InferenceConclusionProgressLineLike>,
    u: ReadonlyArray<Task10ConclusionUnit | Task52ConclusionUnit>,
  ) => Array<Task10ConclusionUnit | Task52ConclusionUnit>,
): Promise<void> {
  const remaining = listRemaining(existing, units);

  if (!units.length) {
    if (hasInferenceConclusionEmptyMarkerLine(existing)) return;
    await Promise.resolve(deps.appendLine(INFERENCE_CONCLUSION_EMPTY_LINE, 'instant'));
    return;
  }

  if (!remaining.length) return;

  if (!hasInferenceConclusionCountLine(existing)) {
    await Promise.resolve(deps.appendLine(`→ 本步共形成 ${units.length} 条推理结论`, 'instant'));
  }

  const existingBodyTexts = new Set(
    listInferenceConclusionBodyLines(existing).map((l) => String(l.full || '').trim()),
  );

  for (const unit of remaining) {
    for (const row of unit.lines) {
      const trimmed = String(row.text || '').trim();
      if (trimmed && existingBodyTexts.has(trimmed)) continue;
      await Promise.resolve(
        deps.appendLine(row.text, 'typing_reveal', row.inferenceFeatureId),
      );
      if (trimmed) existingBodyTexts.add(trimmed);
      if (deps.waitRevealComplete) {
        await deps.waitRevealComplete();
      }
    }
  }
}

async function appendTask10StructuredInferenceConclusions(
  deps: AppendFeatureInferenceConclusionsDeps,
  existing: ReadonlyArray<InferenceConclusionProgressLineLike>,
): Promise<void> {
  await appendStructuredInferenceConclusionUnits(
    deps,
    existing,
    listTask10ConclusionUnitsForLineStep(deps.mergedTasks),
    listRemainingTask10ConclusionUnits,
  );
}

async function appendTask52StructuredInferenceConclusions(
  deps: AppendFeatureInferenceConclusionsDeps,
  existing: ReadonlyArray<InferenceConclusionProgressLineLike>,
): Promise<void> {
  await appendStructuredInferenceConclusionUnits(
    deps,
    existing,
    listTask52ConclusionUnitsForLineStep(deps.mergedTasks),
    listRemainingTask52ConclusionUnits,
  );
}

export async function appendFeatureInferenceConclusionsForLineTask(
  deps: AppendFeatureInferenceConclusionsDeps,
): Promise<void> {
  const existing = deps.existingLines ?? [];
  if (deps.lineTaskId === DESIGN_DETAIL_TASK10_LINE_TASK_ID) {
    await appendTask10StructuredInferenceConclusions(deps, existing);
    return;
  }
  if (deps.lineTaskId === DESIGN_DETAIL_TASK52_LINE_TASK_ID) {
    await appendTask52StructuredInferenceConclusions(deps, existing);
    return;
  }
  const inputs = listFeatureConclusionInputsForLineStep(deps.mergedTasks, deps.lineTaskId);
  const remaining = listRemainingFeatureConclusionInputs(existing, inputs);

  if (!inputs.length) {
    if (hasInferenceConclusionEmptyMarkerLine(existing)) return;
    await Promise.resolve(deps.appendLine(INFERENCE_CONCLUSION_EMPTY_LINE, 'instant'));
    return;
  }

  if (!remaining.length) return;

  if (!hasInferenceConclusionCountLine(existing)) {
    await Promise.resolve(deps.appendLine(`→ 本步共形成 ${inputs.length} 条推理结论`, 'instant'));
  }

  const chunks: FeatureConclusionInput[][] = [];
  for (let i = 0; i < remaining.length; i += MAX_FEATURES_PER_BATCH) {
    chunks.push(remaining.slice(i, i + MAX_FEATURES_PER_BATCH));
  }

  for (const chunk of chunks) {
    let sentences: string[] | null = null;
    if (chunk.length > 0) {
      const callTarget = buildFeatureConclusionHumanizeCallTarget(
        deps.lineTaskId,
        chunk[0]?.token,
      );
      sentences = await deps.withLlmAudit(callTarget, () =>
        humanizeConclusionsViaLlm(
          chunk,
          { caseId: deps.caseId, lineTaskId: deps.lineTaskId, callTarget },
          deps.signal,
        ),
      );
    }
    const lines =
      sentences && sentences.length === chunk.length
        ? sentences
        : chunk.map((c) => formatFeatureConclusionRuleBased(c, deps.lineTaskId));
    const existingBodyTexts = new Set(
      listInferenceConclusionBodyLines(existing).map((l) => String(l.full || '').trim()),
    );
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      const trimmed = String(line || '').trim();
      if (trimmed && existingBodyTexts.has(trimmed)) continue;
      const inp = chunk[i]!;
      await Promise.resolve(deps.appendLine(line, 'typing_reveal', inp.featureId));
      if (trimmed) existingBodyTexts.add(trimmed);
      if (deps.waitRevealComplete) {
        await deps.waitRevealComplete();
      }
    }
  }
}

export type PushPipelineFeatureConclusionsParams = {
  rawId: string;
  lineTaskId: Exclude<DesignDetailLineTaskId, 'all_done'>;
  mergedForProgress: ReadonlyArray<DesignDetailLogicGraphTaskDto>;
  /** 读取当前动态卡进度行（用于跳过已推送 feature） */
  readProgressLines?: () => ReadonlyArray<InferenceConclusionProgressLineLike>;
  /** 在首次推送前写入「→ 推理结论整理」标题行（若尚未存在） */
  ensureOrganizeLine?: () => void;
  appendToCard: (
    text: string,
    kind: 'scope_green' | 'inference_conclusion_sub',
    opts?: { startFullyRevealed?: boolean; inferenceFeatureId?: string },
  ) => void | Promise<void>;
  waitRevealComplete?: () => Promise<void>;
  withLlmAuditCtx: <T>(
    ctx: { caseId: string; taskId: string; callTarget: string },
    fn: () => Promise<T>,
  ) => Promise<T>;
  signal?: AbortSignal;
};

/** 拆出流水线（任务 8.5/9/10）在 Target_KV 落库后推送推理结论，与 `useDesignDetailChat` 内 helper 语义一致 */
export async function pushPipelineFeatureInferenceConclusions(
  params: PushPipelineFeatureConclusionsParams,
): Promise<void> {
  if (!params.mergedForProgress.length) return;
  const lines = params.readProgressLines?.() ?? [];
  if (
    !shouldProceedWithFeatureInferenceConclusionPush(
      lines,
      params.mergedForProgress,
      params.lineTaskId,
    )
  ) {
    return;
  }
  params.ensureOrganizeLine?.();
  const linesAfter = params.readProgressLines?.() ?? lines;
  await appendFeatureInferenceConclusionsForLineTask({
    caseId: params.rawId,
    lineTaskId: params.lineTaskId,
    auditTaskIdLabel: designLinePillLabel(params.lineTaskId),
    mergedTasks: params.mergedForProgress,
    existingLines: linesAfter,
    appendLine: async (text, mode, featureId) =>
      params.appendToCard(text, 'inference_conclusion_sub', {
        startFullyRevealed: mode === 'instant',
        inferenceFeatureId: featureId,
      }),
    waitRevealComplete: params.waitRevealComplete,
    withLlmAudit: (callTarget, fn) =>
      params.withLlmAuditCtx(
        { caseId: params.rawId, taskId: designLinePillLabel(params.lineTaskId), callTarget },
        fn,
      ),
    signal: params.signal,
  });
}
