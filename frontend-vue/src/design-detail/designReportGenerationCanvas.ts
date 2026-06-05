/**
 * [INPUT]: 无
 * [OUTPUT]: 设计报告分章生成进度文案与子任务清单
 * [POS]: `runDesignReportGenerationPipeline`、任务 10 收官进度区
 *
 * [PROTOCOL]: 新增子任务须同步 `runDesignReportGenerationPipeline.ts` 与 AGENTS.md
 */

export const DESIGN_REPORT_GENERATION_START_LINE = '→ 开始生成分析报告';

export type DesignReportSubTaskDef = {
  id: string;
  label: string;
  workingLine: string;
  doneLine: string;
};

/** 当前已启用的 LLM 子任务（按序执行） */
export const DESIGN_REPORT_LLM_SUB_TASKS: readonly DesignReportSubTaskDef[] = [
  {
    id: 'chapter1_pain_understanding',
    label: '生成第一章：对需求痛点的理解',
    workingLine: '  · 正在生成第一章：对需求痛点的理解…',
    doneLine: '  · 第一章：对需求痛点的理解 — 已完成 ✓',
  },
] as const;

export function designReportSubTaskWorkingLine(def: DesignReportSubTaskDef, index: number, total: number): string {
  return `  · [${index + 1}/${total}] ${def.label}…`;
}

export function designReportSubTaskDoneLine(def: DesignReportSubTaskDef, index: number, total: number): string {
  return `  · [${index + 1}/${total}] ${def.label} — 已完成 ✓`;
}
