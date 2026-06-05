/**
 * [INPUT]: caseId、进度写行、架构清单 Tab 与子 Tab 聚焦
 * [OUTPUT]: 任务 12「流程图生成」（业务流程子 Tab；流程图内容待后续接入 task-graph）
 * [POS]: 用户确认任务 11→12 调试门闩后执行
 *
 * [PROTOCOL]: 变更进度文案时同步 `postTask10DeliverablesCanvas.ts`
 */

import {
  TASK12_FLOWCHART_DONE_LINE,
  TASK12_FLOWCHART_START_LINE,
} from './postTask10DeliverablesCanvas';

export type RunTask12FlowchartDeps = {
  rawId: string;
  appendProgressLine: (line: string) => void;
  ensureArchitectureInventoryTab: () => void;
  setActiveArchitectureInventoryTab: () => void;
  focusBusinessProcessSubTab: () => void;
  flushPersistDesignDetailProgressWorkspace: (caseId: string) => Promise<void>;
};

export async function runTask12FlowchartPipelineImpl(deps: RunTask12FlowchartDeps): Promise<void> {
  const { rawId } = deps;
  deps.ensureArchitectureInventoryTab();
  deps.setActiveArchitectureInventoryTab();
  deps.focusBusinessProcessSubTab();
  deps.appendProgressLine(TASK12_FLOWCHART_START_LINE);
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  deps.appendProgressLine('  · 已打开架构清单「业务流程」子页（流程挂接视图待后续版本接入）');
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  deps.appendProgressLine(TASK12_FLOWCHART_DONE_LINE);
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);
}
