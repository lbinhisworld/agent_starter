/**
 * [INPUT]: caseId、进度写行、LLM 审计包装、章节渲染等待
 * [OUTPUT]: 任务 11「分析报告生成」（第一～三章 LLM + 画布渲染）
 * [POS]: 用户确认任务 10→11 调试门闩后执行
 *
 * [PROTOCOL]: 第三章渲染完成后再由调用方挂任务 11→12 调试门闩
 */

import { fetchTaskGraphTasksForDesignReport } from './fetchDesignDetailTaskGraphForReport';
import {
  mergeChapter1IntoDesignReportCache,
  mergeChapter2IntoDesignReportCache,
  mergeChapter3IntoDesignReportCache,
} from './designReportChapter1Cache';
import { runDesignReportChapter1Llm } from './runDesignReportChapter1Llm';
import { runDesignReportChapter2Llm } from './runDesignReportChapter2Llm';
import { runDesignReportChapter3Llm } from './runDesignReportChapter3Llm';
import {
  TASK11_CHAPTER1_GENERATING_DONE_LINE,
  TASK11_CHAPTER1_GENERATING_LINE,
  TASK11_CHAPTER1_RENDERED_LINE,
  TASK11_CHAPTER2_GENERATING_DONE_LINE,
  TASK11_CHAPTER2_GENERATING_LINE,
  TASK11_CHAPTER2_RENDERED_LINE,
  TASK11_CHAPTER3_GENERATING_DONE_LINE,
  TASK11_CHAPTER3_GENERATING_LINE,
  TASK11_CHAPTER3_RENDERED_LINE,
} from './postTask10DeliverablesCanvas';
import type { DesignReportProgressLineOpts } from './runDesignReportGenerationPipeline';

export type RunTask11AnalysisReportDeps = {
  rawId: string;
  companyName: string;
  appendProgressLine: (line: string, opts?: DesignReportProgressLineOpts) => void;
  finishProgressSpinnerLine: (workingLine: string, doneLine: string) => void;
  invokeChapter1Llm: (
    fn: () => Promise<{ chapter1: string; raw: string; error?: string }>,
  ) => Promise<{ chapter1: string; raw: string; error?: string }>;
  invokeChapter2Llm: (
    fn: () => Promise<{ chapter2: string; raw: string; error?: string }>,
  ) => Promise<{ chapter2: string; raw: string; error?: string }>;
  invokeChapter3Llm: (
    fn: () => Promise<{ chapter3: string; raw: string; error?: string }>,
  ) => Promise<{ chapter3: string; raw: string; error?: string }>;
  bumpDesignReportContentTick: () => void;
  designReportSubTabFocusTick: () => void;
  ensureArchitectureInventoryTab: () => void;
  setActiveArchitectureInventoryTab: () => void;
  awaitDesignReportChapter1Rendered: (caseId: string) => Promise<void>;
  awaitDesignReportChapter2Rendered: (caseId: string) => Promise<void>;
  awaitDesignReportChapter3Rendered: (caseId: string) => Promise<void>;
  flushPersistDesignDetailProgressWorkspace: (caseId: string) => Promise<void>;
};

export async function runTask11AnalysisReportPipelineImpl(deps: RunTask11AnalysisReportDeps): Promise<void> {
  const { rawId } = deps;
  deps.ensureArchitectureInventoryTab();
  deps.setActiveArchitectureInventoryTab();
  deps.designReportSubTabFocusTick();
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  let tasks;
  try {
    tasks = await fetchTaskGraphTasksForDesignReport(rawId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    deps.appendProgressLine(`→ 分析报告生成失败（拉取推理图：${msg}）`, { startFullyRevealed: true });
    await deps.flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  const workingLine1 = TASK11_CHAPTER1_GENERATING_LINE;
  deps.appendProgressLine(workingLine1, {
    kind: 'bmc_generating',
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  const llmRes1 = await deps.invokeChapter1Llm(() =>
    runDesignReportChapter1Llm({
      tasks,
      companyName: deps.companyName,
    }),
  );

  if (llmRes1.chapter1) {
    deps.finishProgressSpinnerLine(workingLine1, TASK11_CHAPTER1_GENERATING_DONE_LINE);
    mergeChapter1IntoDesignReportCache(rawId, llmRes1.chapter1);
    deps.bumpDesignReportContentTick();
    await deps.awaitDesignReportChapter1Rendered(rawId);
    deps.appendProgressLine(TASK11_CHAPTER1_RENDERED_LINE, { startFullyRevealed: true });
  } else {
    deps.finishProgressSpinnerLine(workingLine1, '→ 生成「对需求痛点的理解」失败');
    if (llmRes1.error) {
      deps.appendProgressLine(`    ↳ ${llmRes1.error}`, { startFullyRevealed: true });
    }
    await deps.flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  const workingLine2 = TASK11_CHAPTER2_GENERATING_LINE;
  deps.appendProgressLine(workingLine2, {
    kind: 'bmc_generating',
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  const llmRes2 = await deps.invokeChapter2Llm(() =>
    runDesignReportChapter2Llm({
      tasks,
      companyName: deps.companyName,
    }),
  );

  if (llmRes2.chapter2) {
    deps.finishProgressSpinnerLine(workingLine2, TASK11_CHAPTER2_GENERATING_DONE_LINE);
    mergeChapter2IntoDesignReportCache(rawId, llmRes2.chapter2);
    deps.bumpDesignReportContentTick();
    await deps.awaitDesignReportChapter2Rendered(rawId);
    deps.appendProgressLine(TASK11_CHAPTER2_RENDERED_LINE, { startFullyRevealed: true });
  } else {
    deps.finishProgressSpinnerLine(workingLine2, '→ 生成「剖析与诊断」失败');
    if (llmRes2.error) {
      deps.appendProgressLine(`    ↳ ${llmRes2.error}`, { startFullyRevealed: true });
    }
    await deps.flushPersistDesignDetailProgressWorkspace(rawId);
    return;
  }

  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  const workingLine3 = TASK11_CHAPTER3_GENERATING_LINE;
  deps.appendProgressLine(workingLine3, {
    kind: 'bmc_generating',
    bmcGenUi: 'spinner',
    spinnerBlue: true,
  });
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  const llmRes3 = await deps.invokeChapter3Llm(() =>
    runDesignReportChapter3Llm({
      tasks,
      companyName: deps.companyName,
    }),
  );

  if (llmRes3.chapter3) {
    deps.finishProgressSpinnerLine(workingLine3, TASK11_CHAPTER3_GENERATING_DONE_LINE);
    mergeChapter3IntoDesignReportCache(rawId, llmRes3.chapter3);
    deps.bumpDesignReportContentTick();
    await deps.awaitDesignReportChapter3Rendered(rawId);
    deps.appendProgressLine(TASK11_CHAPTER3_RENDERED_LINE, { startFullyRevealed: true });
  } else {
    deps.finishProgressSpinnerLine(workingLine3, '→ 生成「方案构建」失败');
    if (llmRes3.error) {
      deps.appendProgressLine(`    ↳ ${llmRes3.error}`, { startFullyRevealed: true });
    }
  }

  await deps.flushPersistDesignDetailProgressWorkspace(rawId);
}
