/**
 * [INPUT]: 无
 * [OUTPUT]: 任务 11～13 交付物进度文案与调试「继续」提示
 * [POS]: `useDesignDetailChat` 任务 10 收官后分步门闩
 *
 * [PROTOCOL]: 与 `designModeTaskPipeline.ts` 任务 11/12/13 中文名一致
 */

import { DESIGN_REPORT_GENERATION_START_LINE } from './designReportGenerationCanvas';

/** 任务 11 起跑线（分析报告） */
export const TASK11_ANALYSIS_REPORT_START_LINE = DESIGN_REPORT_GENERATION_START_LINE;

/** 任务 11：第一章 LLM 进行中（行尾转圈） */
export const TASK11_CHAPTER1_GENERATING_LINE = '→ 正在生成「对需求痛点的理解」';

export const TASK11_CHAPTER1_GENERATING_DONE_LINE = '→ 已完成「对需求痛点的理解」';

export const TASK11_CHAPTER1_RENDERED_LINE = '→ 设计报告第一章已在画布渲染';

/** 任务 11：第二章 LLM 进行中（行尾转圈） */
export const TASK11_CHAPTER2_GENERATING_LINE = '→ 开始进行「剖析与诊断」生成';

export const TASK11_CHAPTER2_GENERATING_DONE_LINE = '→ 已完成「剖析与诊断」生成';

export const TASK11_CHAPTER2_RENDERED_LINE = '→ 设计报告第二章已在画布渲染';

/** 任务 11：第三章 LLM 进行中（行尾转圈） */
export const TASK11_CHAPTER3_GENERATING_LINE = '→ 开始进行「方案构建」生成';

export const TASK11_CHAPTER3_GENERATING_DONE_LINE = '→ 已完成「方案构建」生成';

export const TASK11_CHAPTER3_RENDERED_LINE = '→ 设计报告第三章已在画布渲染';

export const TASK11_ANALYSIS_REPORT_DONE_LINE = '→ 任务 11：分析报告生成 — 已完成';

/** 任务 12 起跑线（业务流程图） */
export const TASK12_FLOWCHART_START_LINE = '→ 开始生成业务流程图';

export const TASK12_FLOWCHART_DONE_LINE = '→ 任务 12：流程图生成 — 已完成';

/** 任务 13 起跑线（功能清单） */
export const TASK13_FUNCTION_INVENTORY_START_LINE = '→ 开始生成功能清单';

export const TASK13_FUNCTION_INVENTORY_DONE_LINE = '→ 任务 13：功能清单生成 — 已完成';

/** @deprecated 旧文案；hydrate 判定仍可能命中 */
export const TASK10_ARCH_INVENTORY_LEGACY_LINE = '→ 即将生成架构清单';

export const DEBUG_CONTINUE_TO_TASK_11_PROMPT = '→ 【调试】是否继续执行任务 11：分析报告生成？';

export const DEBUG_CONTINUE_TO_TASK_12_PROMPT = '→ 【调试】是否继续执行任务 12：流程图生成？';

export const DEBUG_CONTINUE_TO_TASK_13_PROMPT = '→ 【调试】是否继续执行任务 13：功能清单生成？';
