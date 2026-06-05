/**
 * [INPUT]: 单阶段 LLM 原始 JSON、`pain_point_extraction` 动态卡进度行
 * [OUTPUT]: 阶段子任务子进度文案；`buildTask6PhaseSubtaskProgressEntries`
 * [POS]: 任务 6 按 5.5 价值流阶段循环时，子任务下的大模型 JSON（仅调试模式）
 *
 * [PROTOCOL]: 与 `runTask6L3ScenarioPipeline.ts`、`designDetailTask6PhaseProgressLineMigrate.ts` 同步
 */

import { truncateTask6L3DebugProgressText } from './buildTask6L3ScenarioInferenceInputFromTaskGraph';
import {
  isTask6PhaseProgressLineAny,
  isTask6PhaseProgressLineForPhase,
  stripTask6PhaseProgressLineDecorations,
} from './designDetailTask6PhaseProgressLineMigrate';

/** 调试模式：阶段子任务下「大模型返回」箭头行 */
export const TASK6_DEBUG_LLM_JSON_ARROW_LINE = '→ 大模型返回 json';

export function isTask6PhaseLlmJsonProgressLine(full: string, kind?: string | null): boolean {
  const k = String(kind ?? '').trim();
  if (k === 'task6_inference_sub') return true;
  const bare = stripTask6PhaseProgressLineDecorations(full);
  return bare === TASK6_DEBUG_LLM_JSON_ARROW_LINE;
}

/** 是否属于某价值流阶段「关键场景」子任务下的子进度行 */
export function isTask6PhaseSubtaskDebugChildLine(full: string, kind?: string | null): boolean {
  return isTask6PhaseLlmJsonProgressLine(full, kind);
}

/** 在对应「→ {阶段}｜关键场景推理」行之后、下一阶段子任务行之前的 splice 插入位置 */
export function findTask6PhaseSubtaskBlockEndIndex(
  lines: Array<{ full?: string | null; kind?: string | null }>,
  phaseLabel: string,
): number {
  let phaseIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isTask6PhaseProgressLineForPhase(String(lines[i]?.full ?? ''), phaseLabel)) {
      phaseIdx = i;
      break;
    }
  }
  if (phaseIdx < 0) return -1;
  let end = phaseIdx + 1;
  while (end < lines.length) {
    const full = String(lines[end]?.full ?? '');
    const kind = lines[end]?.kind;
    if (isTask6PhaseProgressLineAny(full) && !isTask6PhaseProgressLineForPhase(full, phaseLabel)) {
      break;
    }
    if (isTask6PhaseSubtaskDebugChildLine(full, kind)) {
      end++;
      continue;
    }
    break;
  }
  return end;
}

export type Task6PhaseDebugProgressEntry = {
  full: string;
  kind: 'default' | 'task6_inference_sub';
  startFullyRevealed?: boolean;
};

export type BuildTask6PhaseSubtaskProgressOpts = {
  /** 为 false 时不推送 JSON 灰块（使用模式） */
  includeLlmJson?: boolean;
};

/** 单阶段 LLM 返回后的子进度行序列 */
export function buildTask6PhaseSubtaskProgressEntries(
  phaseRaw: string,
  opts?: BuildTask6PhaseSubtaskProgressOpts,
): Task6PhaseDebugProgressEntry[] {
  if (opts?.includeLlmJson === false) return [];
  return [
    { full: TASK6_DEBUG_LLM_JSON_ARROW_LINE, kind: 'default', startFullyRevealed: true },
    {
      full: truncateTask6L3DebugProgressText(String(phaseRaw ?? '').trim() || '（无）'),
      kind: 'task6_inference_sub',
      startFullyRevealed: true,
    },
  ];
}
