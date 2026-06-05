/**
 * [INPUT]: caseId、进度写行、架构清单 Tab 与 task-graph 刷新
 * [OUTPUT]: 任务 13「功能清单生成」
 * [POS]: 用户确认任务 12→13 调试门闩后执行
 *
 * [PROTOCOL]: 由原任务 10 收官「架构清单」直刷拆出；不含 LLM
 */

import { TASK13_FUNCTION_INVENTORY_DONE_LINE, TASK13_FUNCTION_INVENTORY_START_LINE } from './postTask10DeliverablesCanvas';

export type RunTask13FunctionInventoryDeps = {
  rawId: string;
  appendProgressLine: (line: string) => void;
  ensureArchitectureInventoryTab: () => void;
  setActiveArchitectureInventoryTab: () => void;
  focusFunctionInventorySubTab: () => void;
  bumpArchitectureInventoryRefreshTick: () => void;
  flushPersistDesignDetailProgressWorkspace: (caseId: string) => Promise<void>;
};

export async function runTask13FunctionInventoryPipelineImpl(
  deps: RunTask13FunctionInventoryDeps,
): Promise<void> {
  const { rawId } = deps;
  deps.appendProgressLine(TASK13_FUNCTION_INVENTORY_START_LINE);
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  deps.ensureArchitectureInventoryTab();
  deps.setActiveArchitectureInventoryTab();
  deps.focusFunctionInventorySubTab();
  deps.bumpArchitectureInventoryRefreshTick();
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);

  deps.appendProgressLine(TASK13_FUNCTION_INVENTORY_DONE_LINE);
  await deps.flushPersistDesignDetailProgressWorkspace(rawId);
}
