/**
 * [INPUT]: 单「价值流阶段-流程环节」LLM 原文、任务 7 动态卡进度行
 * [OUTPUT]: 子任务下调试 JSON / 逻辑提取进度插入
 * [POS]: `runTask7L4CollaborationPipeline` 调试模式子块
 */

import { task7L4CollaborationProgressLine, truncateTask7L4DebugProgressText } from './buildTask7L4CollaborationInferenceInputFromTaskGraph';
import { TASK6_DEBUG_LLM_JSON_ARROW_LINE } from './designDetailTask6PhaseDebugProgress';
import {
  buildTask7ItSelectionExtractProgressLines,
  parseTask7L4StepRawForItSelectionLines,
} from './designDetailTask7L4LogicExtract';

export function stripTask7L4ProgressLineDecorations(full: string): string {
  return String(full ?? '')
    .replace(/\s*✅\s*$/u, '')
    .replace(/\s*✔️?\s*$/u, '')
    .trim();
}

export function isTask7L4ProgressLineForSubtask(full: string, progressLabel: string): boolean {
  const prefix = task7L4CollaborationProgressLine(progressLabel);
  const bare = stripTask7L4ProgressLineDecorations(full);
  return bare === prefix || bare.startsWith(`${prefix} `);
}

export function isTask7L4SubtaskProgressLineAny(full: string): boolean {
  const bare = stripTask7L4ProgressLineDecorations(full);
  return bare.startsWith('→ ') && /｜任务节点IT选型$/u.test(bare);
}

export function isTask7L4LlmJsonProgressLine(full: string, kind?: string | null): boolean {
  const k = String(kind ?? '').trim();
  if (k === 'task7_inference_sub') return true;
  const bare = stripTask7L4ProgressLineDecorations(full);
  return bare === TASK6_DEBUG_LLM_JSON_ARROW_LINE;
}

export function isTask7L4LogicExtractProgressLine(full: string, kind?: string | null): boolean {
  const k = String(kind ?? '').trim();
  if (k === 'task7_logic_extract_sub') return true;
  const bare = stripTask7L4ProgressLineDecorations(full);
  return bare === '→ 正在提取逻辑' || /^→ (交互工具选型|存储工具选型|集成行为选型|技术判断|业务价值预判)：/.test(bare);
}

export function isTask7L4SubtaskDebugChildLine(full: string, kind?: string | null): boolean {
  return isTask7L4LlmJsonProgressLine(full, kind) || isTask7L4LogicExtractProgressLine(full, kind);
}

export function findTask7L4SubtaskBlockEndIndex(
  lines: Array<{ full?: string | null; kind?: string | null }>,
  progressLabel: string,
): number {
  let subIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isTask7L4ProgressLineForSubtask(String(lines[i]?.full ?? ''), progressLabel)) {
      subIdx = i;
      break;
    }
  }
  if (subIdx < 0) return -1;
  let end = subIdx + 1;
  while (end < lines.length) {
    const full = String(lines[end]?.full ?? '');
    const kind = lines[end]?.kind;
    if (isTask7L4SubtaskProgressLineAny(full) && !isTask7L4ProgressLineForSubtask(full, progressLabel)) {
      break;
    }
    if (isTask7L4SubtaskDebugChildLine(full, kind)) {
      end++;
      continue;
    }
    break;
  }
  return end;
}

export type Task7L4DebugProgressEntry = {
  full: string;
  kind: 'default' | 'task7_inference_sub' | 'task7_logic_extract_sub';
  startFullyRevealed?: boolean;
};

export type BuildTask7L4SubtaskProgressOpts = {
  includeLlmJson?: boolean;
  includeLogicExtract?: boolean;
};

export function buildTask7L4SubtaskProgressEntries(
  stepRaw: string,
  opts?: BuildTask7L4SubtaskProgressOpts,
): Task7L4DebugProgressEntry[] {
  const out: Task7L4DebugProgressEntry[] = [];
  if (opts?.includeLlmJson !== false) {
    out.push({ full: TASK6_DEBUG_LLM_JSON_ARROW_LINE, kind: 'default', startFullyRevealed: true });
    out.push({
      full: truncateTask7L4DebugProgressText(String(stepRaw ?? '').trim() || '（无）'),
      kind: 'task7_inference_sub',
      startFullyRevealed: true,
    });
  }
  if (opts?.includeLogicExtract !== false) {
    const extractLines = buildTask7ItSelectionExtractProgressLines(
      parseTask7L4StepRawForItSelectionLines(stepRaw),
    );
    for (const ln of extractLines) {
      out.push({
        full: ln,
        kind: ln === '→ 正在提取逻辑' ? 'default' : 'task7_logic_extract_sub',
        startFullyRevealed: true,
      });
    }
  }
  return out;
}
