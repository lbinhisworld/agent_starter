/**
 * [INPUT]: caseId、公司名、任务 10 进度卡写行回调
 * [OUTPUT]: 按子任务顺序调用独立 LLM 提示词生成设计报告章节，并写入本地缓存
 * [POS]: 任务 10 收官 → 架构清单就绪后自动触发
 *
 * [PROTOCOL]: 新增子任务须登记 `DESIGN_REPORT_LLM_SUB_TASKS` 与本文件 switch
 */

import {
  DESIGN_REPORT_GENERATION_START_LINE,
  DESIGN_REPORT_LLM_SUB_TASKS,
  designReportSubTaskDoneLine,
  designReportSubTaskWorkingLine,
} from './designReportGenerationCanvas';
import { runDesignReportChapter1Llm } from './runDesignReportChapter1Llm';
import {
  loadCachedDesignReportNarrative,
  saveCachedDesignReportNarrative,
  runDesignReportStaticAxis,
} from './runDesignReportHybridEngine';
import { mergeChapter1IntoDesignReportCache } from './designReportChapter1Cache';
import { fetchTaskGraphTasksForDesignReport } from './fetchDesignDetailTaskGraphForReport';
export type DesignReportProgressLineOpts = {
  kind?: 'scope_green' | 'bmc_generating' | 'default';
  bmcGenUi?: 'spinner' | 'check';
  spinnerBlue?: boolean;
  startFullyRevealed?: boolean;
};

export type RunDesignReportGenerationDeps = {
  rawId: string;
  companyName: string;
  fetchTasks: () => Promise<
    ReadonlyArray<{ taskId?: string; features?: import('./buildTask2L1InferenceInputFromTaskGraph').Task2L1TaskGraphFeatureRow[] }>
  >;
  appendProgressLine: (line: string, opts?: DesignReportProgressLineOpts) => void;
  /** 将「正在…」行替换为完成行（去掉转圈） */
  finishProgressSpinnerLine: (workingLine: string, doneLine: string) => void;
  bumpDesignReportContentTick: () => void;
  bumpArchitectureInventoryRefreshTick: () => void;
  flushPersistDesignDetailProgressWorkspace: (caseId: string) => Promise<void>;
};

/** 手动「生成完整报告」：推送起跑线并顺序执行 LLM 子任务 */
export async function runDesignReportGenerationPipelineImpl(
  deps: RunDesignReportGenerationDeps,
): Promise<void> {
  const caseId = String(deps.rawId || '').trim();
  if (!caseId) return;

  const subTasks = DESIGN_REPORT_LLM_SUB_TASKS;
  const total = subTasks.length;

  deps.appendProgressLine(DESIGN_REPORT_GENERATION_START_LINE, { startFullyRevealed: true });
  await deps.flushPersistDesignDetailProgressWorkspace(caseId);

  const fetchTasks = deps.fetchTasks ?? (() => fetchTaskGraphTasksForDesignReport(caseId));
  let tasks: Awaited<ReturnType<typeof fetchTasks>>;
  try {
    tasks = await fetchTasks();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    deps.appendProgressLine(`  · 分析报告：拉取 task-graph 失败（${msg}）`, {
      startFullyRevealed: true,
    });
    await deps.flushPersistDesignDetailProgressWorkspace(caseId);
    return;
  }

  const companyName = String(deps.companyName || '').trim() || '客户';

  for (let i = 0; i < subTasks.length; i += 1) {
    const def = subTasks[i]!;
    const workingLine = designReportSubTaskWorkingLine(def, i, total);
    const doneLine = designReportSubTaskDoneLine(def, i, total);

    deps.appendProgressLine(workingLine, {
      kind: 'bmc_generating',
      bmcGenUi: 'spinner',
      spinnerBlue: true,
    });
    await deps.flushPersistDesignDetailProgressWorkspace(caseId);

    if (def.id === 'chapter1_pain_understanding') {
      const res = await runDesignReportChapter1Llm({ tasks, companyName });
      deps.finishProgressSpinnerLine(workingLine, res.chapter1 ? doneLine : `  · [${i + 1}/${total}] ${def.label} — 失败`);
      if (res.chapter1) {
        mergeChapter1IntoDesignReportCache(caseId, res.chapter1);
        deps.bumpDesignReportContentTick();
      } else if (res.error) {
        deps.appendProgressLine(`    ↳ ${res.error}`, { startFullyRevealed: true });
      }
    }

    await deps.flushPersistDesignDetailProgressWorkspace(caseId);
  }

  runDesignReportStaticAxis(tasks);
  await deps.flushPersistDesignDetailProgressWorkspace(caseId);
}
