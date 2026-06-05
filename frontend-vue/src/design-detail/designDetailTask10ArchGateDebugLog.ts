/**
 * [INPUT]: 任务 10 收官 / 数据架构调试门闩各阶段调用方传入上下文
 * [OUTPUT]: 统一前缀 `[design-detail:task10-arch-gate]` 控制台日志，便于过滤查证
 * [POS]: `runTask10L5TechnicalDdlPipeline` / `useDesignDetailChat` / `runTask10DataArchitecturePipeline`
 *
 * [PROTOCOL]: 变更门闩判定字段时同步本文件 diagnostic 与 `designDetailDebugFlags.ts` 说明
 */

import {
  DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10_DATA_ARCH,
  DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE,
} from './designDetailDebugFlags';

export const TASK10_ARCH_GATE_LOG_PREFIX = '[design-detail:task10-arch-gate]';

/** 控制台过滤：`[design-detail:task10-arch-gate]` */
export function logTask10ArchGate(phase: string, details?: Record<string, unknown>): void {
  try {
    console.info(TASK10_ARCH_GATE_LOG_PREFIX, { phase, ts: Date.now(), ...(details ?? {}) });
  } catch {
    /* ignore */
  }
}

export type Task10ArchGateDiagnostic = {
  awaiting: boolean;
  blockers: string[];
  t10CardFound: boolean;
  t10CardStatus?: string;
  t10LineCount?: number;
  hasSyncOkLine: boolean;
  hasDataArchStartLine: boolean;
  holdPastTask10?: boolean;
  currentTaskId?: string;
  debugFlags: {
    pipelineStepContinue: boolean;
    pauseBeforeTask10DataArch: boolean;
  };
};

/** 汇总「可否挂数据架构调试门闩」判定口径（与 `isTask10AwaitingDebugContinueToDataArch` 一致） */
export function buildTask10ArchGateDiagnostic(input: {
  t10Card: { status: string; lines: ReadonlyArray<{ full: string }> } | null | undefined;
  holdPastTask10?: boolean;
  currentTaskId?: string;
}): Task10ArchGateDiagnostic {
  const blockers: string[] = [];
  const t10 = input.t10Card;
  const hasSyncOkLine = !!t10?.lines.some((l) => l.full.includes('Target_KV 落库完成（任务 10）'));
  const hasDataArchStartLine = !!t10?.lines.some(
    (l) => l.full.includes('即将生成架构清单') || l.full.includes('即将开始数据结构绘制'),
  );

  if (!t10) blockers.push('no_t10_dynamics_card');
  else if (t10.status !== 'completed') blockers.push(`t10_status_not_completed:${t10.status}`);
  if (hasDataArchStartLine) blockers.push('data_arch_start_line_already_present');
  if (input.holdPastTask10 !== true && !hasSyncOkLine) {
    blockers.push('missing_holdPastTask10_and_sync_ok_line');
  }

  const awaiting = blockers.length === 0;

  return {
    awaiting,
    blockers,
    t10CardFound: !!t10,
    t10CardStatus: t10?.status,
    t10LineCount: t10?.lines.length,
    hasSyncOkLine,
    hasDataArchStartLine,
    holdPastTask10: input.holdPastTask10,
    currentTaskId: input.currentTaskId,
    debugFlags: {
      pipelineStepContinue: DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE,
      pauseBeforeTask10DataArch: DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_10_DATA_ARCH,
    },
  };
}
