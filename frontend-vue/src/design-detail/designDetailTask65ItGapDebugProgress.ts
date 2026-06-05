/**
 * [INPUT]: 单「价值流阶段-流程环节」LLM 原始 JSON、`three_dimension_itgap_analysis` 动态卡进度行
 * [OUTPUT]: 子任务下的大模型 JSON 插入位置与行序列
 * [POS]: 任务 6.5 按 5.5×5.3 环节循环时，子任务下的大模型 JSON（仅调试模式）
 *
 * [PROTOCOL]: 与 `runTask65ItGapPipeline.ts`、`buildTask65ItGapInferenceInputFromTaskGraph.ts` 同步
 */

import { task65ItGapProgressLine, truncateTask65ItGapDebugProgressText } from './buildTask65ItGapInferenceInputFromTaskGraph';
import { ALIGNMENT_FEEDBACK_RECEIVED_LINE } from './designDetailAlignmentInferenceDiff';
import { TASK6_DEBUG_LLM_JSON_ARROW_LINE } from './designDetailTask6PhaseDebugProgress';

/** 与子任务块内深访问卷闭环相关的固定进度行（须计入子块边界） */
export const TASK65_SUBTASK_ALIGNMENT_CHILD_LINE_MARKERS = [
  '→ 正在生成 L3 三维 IT-Gap 反向验证对齐问卷（大模型）',
  '→ 产生疑问',
  '→ 请在下方回复上述问卷',
  '→ 深访洞察已写入。正在结合该洞察重新推理三维 IT-Gap 分析…',
  ALIGNMENT_FEEDBACK_RECEIVED_LINE,
] as const;

/** 去掉行尾 ✅ / 转圈装饰，保留主文案 */
export function stripTask65ItGapProgressLineDecorations(full: string): string {
  return String(full ?? '')
    .replace(/\s*✅\s*$/u, '')
    .replace(/\s*✔️?\s*$/u, '')
    .trim();
}

export function isTask65ItGapProgressLineForSubtask(full: string, progressLabel: string): boolean {
  const prefix = task65ItGapProgressLine(progressLabel);
  const bare = stripTask65ItGapProgressLineDecorations(full);
  return bare === prefix || bare.startsWith(`${prefix} `);
}

/** 是否为任务 6.5 任一「价值流阶段-流程环节」子任务主行 */
export function isTask65ItGapSubtaskProgressLineAny(full: string): boolean {
  const bare = stripTask65ItGapProgressLineDecorations(full);
  return bare.startsWith('→ ') && /｜三维 IT-Gap 分析$/u.test(bare);
}

export function isTask65ItGapLlmJsonProgressLine(full: string, kind?: string | null): boolean {
  const k = String(kind ?? '').trim();
  if (k === 'task65_inference_sub') return true;
  const bare = stripTask65ItGapProgressLineDecorations(full);
  return bare === TASK6_DEBUG_LLM_JSON_ARROW_LINE;
}

export function isTask65ItGapSubtaskAlignmentChildLine(full: string, kind?: string | null): boolean {
  const k = String(kind ?? '').trim();
  if (k === 'task65_alignment_questionnaire_sub' || k === 'alignment_user_feedback_sub') return true;
  const bare = stripTask65ItGapProgressLineDecorations(full);
  return TASK65_SUBTASK_ALIGNMENT_CHILD_LINE_MARKERS.some(
    (m) => bare === m || bare.startsWith(`${m}`),
  );
}

/** 是否属于某环节子任务下的子进度行（推理 JSON + 深访问卷闭环） */
export function isTask65ItGapSubtaskDebugChildLine(full: string, kind?: string | null): boolean {
  return (
    isTask65ItGapLlmJsonProgressLine(full, kind) || isTask65ItGapSubtaskAlignmentChildLine(full, kind)
  );
}

/** 在对应「→ {阶段-环节}｜三维 IT-Gap 分析」行之后、下一环节子任务行之前的 splice 插入位置 */
export function findTask65ItGapSubtaskBlockEndIndex(
  lines: Array<{ full?: string | null; kind?: string | null }>,
  progressLabel: string,
): number {
  let subIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isTask65ItGapProgressLineForSubtask(String(lines[i]?.full ?? ''), progressLabel)) {
      subIdx = i;
      break;
    }
  }
  if (subIdx < 0) return -1;
  let end = subIdx + 1;
  while (end < lines.length) {
    const full = String(lines[end]?.full ?? '');
    const kind = lines[end]?.kind;
    if (isTask65ItGapSubtaskProgressLineAny(full) && !isTask65ItGapProgressLineForSubtask(full, progressLabel)) {
      break;
    }
    if (isTask65ItGapSubtaskDebugChildLine(full, kind)) {
      end++;
      continue;
    }
    break;
  }
  return end;
}

export type Task65ItGapDebugProgressEntry = {
  full: string;
  kind: 'default' | 'task65_inference_sub' | 'task65_alignment_questionnaire_sub';
  startFullyRevealed?: boolean;
};

export type Task65ItGapSubtaskAlignmentProgressEntry = Task65ItGapDebugProgressEntry;

export type BuildTask65ItGapSubtaskProgressOpts = {
  includeLlmJson?: boolean;
};

export function buildTask65ItGapSubtaskProgressEntries(
  stepRaw: string,
  opts?: BuildTask65ItGapSubtaskProgressOpts,
): Task65ItGapDebugProgressEntry[] {
  if (opts?.includeLlmJson === false) return [];
  return [
    { full: TASK6_DEBUG_LLM_JSON_ARROW_LINE, kind: 'default', startFullyRevealed: true },
    {
      full: truncateTask65ItGapDebugProgressText(String(stepRaw ?? '').trim() || '（无）'),
      kind: 'task65_inference_sub',
      startFullyRevealed: true,
    },
  ];
}
