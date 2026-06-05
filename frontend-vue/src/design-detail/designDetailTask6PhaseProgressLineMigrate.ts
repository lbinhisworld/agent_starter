/**
 * [INPUT]: 任务 6 动态卡历史进度行 `full` 文案
 * [OUTPUT]: 价值流阶段子任务行识别与装饰剥离
 * [POS]: 与 `runTask6L3ScenarioPipeline.ts` 进度常量一致
 *
 * [PROTOCOL]: 变更任务 6 子任务行文案时同步 `buildTask6L3ScenarioInferenceInputFromTaskGraph.ts`
 */

import { task6PhaseScenarioProgressLine } from './buildTask6L3ScenarioInferenceInputFromTaskGraph';

/** 与 `runTask6L3ScenarioPipeline` 中 TASK6_PROGRESS_START_LINE 一致 */
export const TASK6_PROGRESS_START_LINE =
  '→ 开始进行关键场景推理（按任务 5.5 价值流阶段逐步推理）';

/** 去掉行尾 ✅ 等后缀，保留「→ {阶段}｜关键场景推理」主文案 */
export function stripTask6PhaseProgressLineDecorations(full: string): string {
  return String(full ?? '')
    .replace(/\s*✅\s*$/u, '')
    .replace(/\s*✔️?\s*$/u, '')
    .trim();
}

export function isTask6PhaseProgressLineForPhase(full: string, phaseLabel: string): boolean {
  const prefix = task6PhaseScenarioProgressLine(phaseLabel);
  const bare = stripTask6PhaseProgressLineDecorations(full);
  if (bare === prefix || bare.startsWith(`${prefix} `)) return true;
  /** 历史进度行：→ 关键场景：{阶段名} */
  const legacy = `→ 关键场景：${String(phaseLabel ?? '').trim()}`;
  return bare === legacy || bare.startsWith(`${legacy} `);
}

/** 是否为任务 6 任一价值流阶段子任务主行（含历史文案） */
export function isTask6PhaseProgressLineAny(full: string): boolean {
  const bare = stripTask6PhaseProgressLineDecorations(full);
  if (bare.startsWith('→ 关键场景：')) return true;
  return bare.startsWith('→ ') && /阶段｜关键场景推理$/u.test(bare);
}
