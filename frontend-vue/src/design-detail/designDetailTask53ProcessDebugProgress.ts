/**
 * [INPUT]: 单流程 LLM 原始 JSON、落库后 `task-graph`；`key_scenario_temporal_flow_inference` 动态卡进度行
 * [OUTPUT]: 流程子任务子进度文案；`buildTask53ProcessSubtaskProgressEntries`（使用模式不含 JSON/正向归纳行）
 * [POS]: 任务 5.3 按流程「流程理解」子任务下的调试子进度（JSON、环节链、正向归纳链接）
 *
 * [PROTOCOL]: 与 `runTask53WorkflowFlowPipeline.ts`、`designDetailTask53ProgressLineMigrate.ts` 同步
 */

import { truncateTask53L3DebugProgressText } from './buildTask53WorkflowFlowInferenceInputFromTaskGraph';
import type {
  DesignDetailLogicGraphLinkDto,
  DesignDetailLogicGraphTaskDto,
} from './designDetailLogicGraphMerge';
import {
  DESIGN_DETAIL_TASK53_LINE_TASK_ID,
  logicGraphLinkIdOf,
  normLogicTaskId,
} from './designDetailLogicGraphMerge';
import {
  isTask53WorkflowGraphFeatureRow,
  isTask53WorkflowStepGraphFeatureRow,
  orderTask53WorkflowStepsFromRoot,
  parseTask53FeatureValueRoot,
  readTask53WorkflowNameFromRoot,
  task53StepMetaFromNode,
} from './designDetailLogicTreeTask53Layout';
import type { DesignDetailLogicGraphFeatureDto } from './designDetailLogicGraphMerge';
import {
  isTask53ProcessProgressLineForProcess,
  stripTask53ProcessProgressLineDecorations,
} from './designDetailTask53ProgressLineMigrate';
import { normalizeL53WorkflowFlowRawForServerSync } from './designDetailTask2L1SyncUiProgress';
import { isTask53L3TargetKvSyncableFeatureKey } from './designDetailTask53L3SyncContract';

/** 调试模式：流程子任务下「大模型返回」箭头行 */
export const TASK53_DEBUG_LLM_JSON_ARROW_LINE = '→ 大模型返回 json';

/** 进度行正文中「理解环节链」标签（绿色 scope 行） */
export const TASK53_STEP_CHAIN_PROGRESS_LABEL = '理解环节链：';

/** 调试：落库后正向归纳链接行前缀 */
export const TASK53_FORWARD_LINK_PROGRESS_PREFIX = '→ 形成如下正向归纳链接：';

function normProcessName(name: string): string {
  return String(name ?? '').trim();
}

function isForwardInductionGraphLink(l: DesignDetailLogicGraphLinkDto): boolean {
  const k = String(l.linkKind ?? '').trim();
  return k === '正向归纳' || k === 'FORWARD_INDUCTION';
}

function linkSrcTgtIds(l: DesignDetailLogicGraphLinkDto): { src: string; tgt: string } {
  return {
    src: String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim(),
    tgt: String(l.targetFeatureId ?? l.target?.featureId ?? '').trim(),
  };
}

export function task53WorkflowForwardLinkProgressLine(
  workflowName: string,
  sourceFeatureId: string,
  targetFeatureId: string,
): string {
  const wf = normProcessName(workflowName) || '（未命名流程）';
  const src = String(sourceFeatureId || '').trim() || '—';
  const tgt = String(targetFeatureId || '').trim() || '—';
  return `${TASK53_FORWARD_LINK_PROGRESS_PREFIX}${wf}：${src}→ ${tgt}；`;
}

export function task53StepForwardLinkProgressLine(
  workflowName: string,
  stepName: string,
  sourceFeatureId: string,
  targetFeatureId: string,
): string {
  const wf = normProcessName(workflowName) || '（未命名流程）';
  const step = normProcessName(stepName) || '（未命名环节）';
  const src = String(sourceFeatureId || '').trim() || '—';
  const tgt = String(targetFeatureId || '').trim() || '—';
  return `${TASK53_FORWARD_LINK_PROGRESS_PREFIX}${wf}-${step}：${src}→ ${tgt}；`;
}

function collectDedupedForwardLinks(
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): DesignDetailLogicGraphLinkDto[] {
  const out: DesignDetailLogicGraphLinkDto[] = [];
  const seen = new Set<string>();
  for (const t of merged) {
    for (const l of t.links ?? []) {
      if (!isForwardInductionGraphLink(l)) continue;
      const { src, tgt } = linkSrcTgtIds(l);
      if (!src || !tgt) continue;
      const dedup = logicGraphLinkIdOf(l) || `${src}\t${tgt}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      out.push(l);
    }
  }
  return out;
}

function resolveTask53WorkflowFeatureForProcess(
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  processName: string,
): { featureId: string; display: DesignDetailLogicGraphFeatureDto; root: Record<string, unknown> } | null {
  const needle = normProcessName(processName);
  const t53 = merged.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  if (!t53?.features?.length) return null;
  for (const f of t53.features) {
    if (!isTask53WorkflowGraphFeatureRow(f)) continue;
    const root = parseTask53FeatureValueRoot(f);
    if (!root) continue;
    const wf = readTask53WorkflowNameFromRoot(root);
    if (normProcessName(wf) !== needle) continue;
    const fid = String(f.featureId ?? '').trim();
    if (!fid) continue;
    return { featureId: fid, display: f, root };
  }
  return null;
}

function resolveTask53StepFeaturesForProcess(
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  processName: string,
): Array<{ featureId: string; stepName: string; workflowName: string }> {
  const needle = normProcessName(processName);
  const t53 = merged.find((t) => normLogicTaskId(t.taskId) === DESIGN_DETAIL_TASK53_LINE_TASK_ID);
  if (!t53?.features?.length) return [];
  const out: Array<{ featureId: string; stepName: string; workflowName: string }> = [];
  for (const f of t53.features) {
    if (!isTask53WorkflowStepGraphFeatureRow(f)) continue;
    const fid = String(f.featureId ?? '').trim();
    if (!fid) continue;
    const meta = task53StepMetaFromNode({
      featureId: fid,
      taskId: DESIGN_DETAIL_TASK53_LINE_TASK_ID,
      display: f,
    });
    if (normProcessName(meta.workflowName) !== needle) continue;
    out.push({
      featureId: fid,
      stepName: meta.stepName,
      workflowName: meta.workflowName,
    });
  }
  return out;
}

/** 落库后：按流程名从 task-graph 提炼该流程/环节相关正向归纳链接进度行（仅调试） */
export function buildTask53ProcessForwardLinkDebugProgressEntries(
  processName: string,
  merged: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Task53ProcessDebugProgressEntry[] {
  const wfRow = resolveTask53WorkflowFeatureForProcess(merged, processName);
  const wfId = wfRow?.featureId ?? '';
  const steps = resolveTask53StepFeaturesForProcess(merged, processName);
  const stepIdByName = new Map(steps.map((s) => [s.stepName, s.featureId]));
  const allLinks = collectDedupedForwardLinks(merged);
  const entries: Task53ProcessDebugProgressEntry[] = [];
  const seenLine = new Set<string>();

  const pushUnique = (full: string) => {
    if (!full || seenLine.has(full)) return;
    seenLine.add(full);
    entries.push({ full, kind: 'scope_green', startFullyRevealed: true });
  };

  if (wfId) {
    for (const l of allLinks) {
      const { src, tgt } = linkSrcTgtIds(l);
      if (tgt !== wfId || !src) continue;
      pushUnique(task53WorkflowForwardLinkProgressLine(processName, src, tgt));
    }
  }

  const stepOrder = wfRow?.root
    ? orderTask53WorkflowStepsFromRoot(wfRow.root).map((c) => c.stepName)
    : steps.map((s) => s.stepName);
  const orderedStepNames = [...stepOrder];
  for (const s of steps) {
    if (!orderedStepNames.includes(s.stepName)) orderedStepNames.push(s.stepName);
  }

  for (const stepName of orderedStepNames) {
    const stepId = stepIdByName.get(stepName);
    if (!stepId) continue;
    for (const l of allLinks) {
      const { src, tgt } = linkSrcTgtIds(l);
      if (tgt !== stepId || !src) continue;
      pushUnique(task53StepForwardLinkProgressLine(processName, stepName, src, tgt));
    }
  }

  return entries;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readWorkflowStepsTopology(fv: Record<string, unknown>): unknown[] {
  const raw =
    fv.workflow_steps_topology ??
    fv.Workflow_Steps_Topology ??
    fv.workflowStepsTopology;
  return Array.isArray(raw) ? raw : [];
}

function stepHasCapabilityUnitAndFieldSet(step: Record<string, unknown>): boolean {
  const unit = String(
    step.associated_capability_unit ?? step.Associated_Capability_Unit ?? '',
  ).trim();
  const dataset = String(
    step.associated_asset_dataset ?? step.Associated_Asset_Dataset ?? '',
  ).trim();
  if (!unit || !dataset) return false;
  if (unit === 'N/A' || dataset === 'N/A') return false;
  return true;
}

/** 自单流程模型输出解析已完成能力单元与字段集标注的环节名（按拓扑顺序） */
export function parseTask53AnnotatedStepNamesFromLlmRaw(processRaw: string): string[] {
  const norm = normalizeL53WorkflowFlowRawForServerSync(processRaw);
  if (!norm.ok) return [];
  let matrix: Record<string, unknown>;
  try {
    const root = JSON.parse(norm.normalized) as Record<string, unknown>;
    matrix = asRecord(root.L3_Workflow_Flow_Matrix) ?? {};
  } catch {
    return [];
  }
  const tk = matrix.Target_KV ?? matrix.target_kv;
  if (!Array.isArray(tk)) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of tk) {
    const row = asRecord(item);
    if (!row) continue;
    const fkRaw =
      row.Feature_Key ?? row.feature_key ?? (row as { FeatureKey?: unknown }).FeatureKey;
    if (!isTask53L3TargetKvSyncableFeatureKey(String(fkRaw ?? ''))) continue;
    const fvRaw = row.Feature_Value ?? row.feature_value ?? row.featureValue;
    const fv = asRecord(fvRaw);
    if (!fv) continue;
    const stepByName = new Map<string, Record<string, unknown>>();
    for (const st of readWorkflowStepsTopology(fv)) {
      const step = asRecord(st);
      if (!step) continue;
      const name = String(step.step_name ?? step.Step_Name ?? '').trim();
      if (name) stepByName.set(name, step);
    }
    for (const chip of orderTask53WorkflowStepsFromRoot(fv)) {
      const step = stepByName.get(chip.stepName);
      if (!step || !stepHasCapabilityUnitAndFieldSet(step)) continue;
      const dedup = chip.stepName.replace(/\s+/g, '');
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      names.push(chip.stepName);
    }
  }
  return names;
}

export function task53StepChainProgressLine(stepNames: string[]): string {
  const body =
    stepNames.length > 0
      ? stepNames.map((n) => String(n ?? '').trim()).filter(Boolean).join('｜')
      : '（暂无已完成能力单元与字段集标注的环节）';
  return `→ ${TASK53_STEP_CHAIN_PROGRESS_LABEL}${body}`;
}

/** 流程子任务下「大模型返回 json」箭头行或 JSON 灰块（使用模式须隐藏） */
export function isTask53ProcessLlmJsonProgressLine(full: string, kind?: string | null): boolean {
  const k = String(kind ?? '').trim();
  if (k === 'task53_inference_sub') return true;
  const bare = stripTask53ProcessProgressLineDecorations(full);
  return bare === TASK53_DEBUG_LLM_JSON_ARROW_LINE;
}

/** 是否属于某流程「流程理解」子任务下的子进度行 */
export function isTask53ProcessSubtaskDebugChildLine(full: string, kind?: string | null): boolean {
  if (isTask53ProcessLlmJsonProgressLine(full, kind)) return true;
  const bare = stripTask53ProcessProgressLineDecorations(full);
  if (bare.startsWith(`→ ${TASK53_STEP_CHAIN_PROGRESS_LABEL}`)) return true;
  if (bare.startsWith(TASK53_FORWARD_LINK_PROGRESS_PREFIX)) return true;
  return false;
}

/** 在对应「→ 流程理解：流程名」行之后、下一流程子任务行之前的 splice 插入位置 */
export function findTask53ProcessSubtaskBlockEndIndex(
  lines: Array<{ full?: string | null; kind?: string | null }>,
  processName: string,
): number {
  let processIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isTask53ProcessProgressLineForProcess(String(lines[i]?.full ?? ''), processName)) {
      processIdx = i;
      break;
    }
  }
  if (processIdx < 0) return -1;
  let end = processIdx + 1;
  while (end < lines.length) {
    const full = String(lines[end]?.full ?? '');
    const kind = lines[end]?.kind;
    if (full.startsWith('→ 流程理解：') && !isTask53ProcessProgressLineForProcess(full, processName)) {
      break;
    }
    if (isTask53ProcessSubtaskDebugChildLine(full, kind)) {
      end++;
      continue;
    }
    break;
  }
  return end;
}

export type Task53ProcessDebugProgressEntry = {
  full: string;
  kind: 'default' | 'task53_inference_sub' | 'scope_green';
  startFullyRevealed?: boolean;
};

export type BuildTask53ProcessSubtaskProgressOpts = {
  /** 为 false 时不推送「→ 大模型返回 json」与 `task53_inference_sub` 灰块（使用模式） */
  includeLlmJson?: boolean;
};

/** 单流程 LLM 返回后的子进度行序列；使用模式返回空数组（子任务直接绿 ✓） */
export function buildTask53ProcessSubtaskProgressEntries(
  processRaw: string,
  opts?: BuildTask53ProcessSubtaskProgressOpts,
): Task53ProcessDebugProgressEntry[] {
  const includeLlmJson = opts?.includeLlmJson !== false;
  if (!includeLlmJson) return [];
  const entries: Task53ProcessDebugProgressEntry[] = [];
  entries.push(
    { full: TASK53_DEBUG_LLM_JSON_ARROW_LINE, kind: 'default', startFullyRevealed: true },
    {
      full: truncateTask53L3DebugProgressText(String(processRaw ?? '').trim() || '（无）'),
      kind: 'task53_inference_sub',
      startFullyRevealed: true,
    },
  );
  const stepNames = parseTask53AnnotatedStepNamesFromLlmRaw(processRaw);
  entries.push({
    full: task53StepChainProgressLine(stepNames),
    kind: 'scope_green',
    startFullyRevealed: true,
  });
  return entries;
}
