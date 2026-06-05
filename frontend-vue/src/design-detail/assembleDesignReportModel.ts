/**
 * [INPUT]: 公司名称、LLM 叙事、静态对账 payload
 * [OUTPUT]: 设计报告合龙模型（双轴 Assembler）
 * [POS]: `runDesignReportHybridEngine` 步骤 3
 *
 * [PROTOCOL]: 标题固定为「公司名称+数字化方案」
 */

import type { DesignReportLlmNarrative } from './parseDesignReportLlmChapters';
import type { DesignReportStaticPayload } from './buildDesignReportStaticFromTaskGraph';

export type DesignReportAxisStatus = 'idle' | 'loading' | 'ok' | 'error' | 'empty';

export type DesignReportModel = {
  title: string;
  companyName: string;
  generatedAt: string;
  llm: DesignReportLlmNarrative | null;
  llmStatus: DesignReportAxisStatus;
  llmError?: string;
  staticPayload: DesignReportStaticPayload;
  staticStatus: DesignReportAxisStatus;
};

export function buildDesignReportTitle(companyName: string): string {
  const corp = String(companyName ?? '').trim() || '客户';
  return `${corp}数字化方案`;
}

/** 高压合龙：LLM 三章 + JS 直刷第四、五章 */
export function assembleDesignReportModel(args: {
  companyName: string;
  llm: DesignReportLlmNarrative | null;
  llmStatus: DesignReportAxisStatus;
  llmError?: string;
  staticPayload: DesignReportStaticPayload;
  generatedAt?: string;
}): DesignReportModel {
  const staticStatus: DesignReportAxisStatus =
    args.staticPayload.fieldSyncSections.length || args.staticPayload.schemaTables.length
      ? 'ok'
      : args.staticPayload.emptyStaticMessage
        ? 'empty'
        : 'idle';

  return {
    title: buildDesignReportTitle(args.companyName),
    companyName: String(args.companyName ?? '').trim() || '客户',
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    llm: args.llm,
    llmStatus: args.llmStatus,
    llmError: args.llmError,
    staticPayload: args.staticPayload,
    staticStatus,
  };
}
