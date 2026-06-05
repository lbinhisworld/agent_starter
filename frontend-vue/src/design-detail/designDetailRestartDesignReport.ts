/**
 * [INPUT]: 重启锚点线步与范围
 * [OUTPUT]: 是否/如何清除设计报告叙事缓存与 LLM 审计 taskId 列表
 * [POS]: `restartDesignDetailFromLineTaskAnchor` 与任务 11 重启 kickoff 配合
 */

import {
  DESIGN_MODE_LINE_TASK_ORDER,
  designLinePillLabel,
  designLineTasksFromStepInclusive,
  type DesignDetailLineTaskId,
} from './designModeTaskPipeline';
import type { DesignDetailRestartScope } from './designDetailRestartScope';
import {
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER1_PAIN,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER2_DIAGNOSIS,
  DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER3_SOLUTION,
  DESIGN_DETAIL_TASK11_LLM_AUDIT_TASK_ID,
} from './designDetailLlmStats';

const REPORT_CACHE_FROM_STEP: DesignDetailLineTaskId = 'process_node_design';

/** 任务 11 重启当前时 `postClearCaseLlmLogsByTaskIds` 须覆盖的 taskId（线步 id + pill + 子章节 callTarget 兜底） */
export function buildDesignReportTask11RestartLlmLogTaskIds(): string[] {
  const ids = new Set<string>();
  ids.add('process_node_design');
  ids.add(designLinePillLabel('process_node_design'));
  ids.add(DESIGN_DETAIL_TASK11_LLM_AUDIT_TASK_ID);
  ids.add(DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER1_PAIN);
  ids.add(DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER2_DIAGNOSIS);
  ids.add(DESIGN_DETAIL_LLM_CALL_TARGET_TASK11_CHAPTER3_SOLUTION);
  return Array.from(ids);
}

/** 重启范围触及任务 11（分析报告）或之后线步时清除报告叙事缓存 */
export function shouldClearDesignReportNarrativeOnRestart(
  anchor: DesignDetailLineTaskId,
  scope: DesignDetailRestartScope,
): boolean {
  if (anchor === 'all_done') return false;
  const steps =
    scope === 'current_line_step'
      ? [anchor]
      : designLineTasksFromStepInclusive(anchor);
  const idx11 = DESIGN_MODE_LINE_TASK_ORDER.indexOf(REPORT_CACHE_FROM_STEP);
  if (idx11 < 0) return false;
  return steps.some((s) => {
    const i = DESIGN_MODE_LINE_TASK_ORDER.indexOf(s);
    return i >= 0 && i >= idx11;
  });
}
