/**
 * [INPUT]: 任务 10 收官后由 `useDesignDetailChat` 注入依赖
 * [OUTPUT]: 进度区「即将生成架构清单」+ 工作画布「架构清单」Tab 激活与刷新
 * [POS]: 任务 10 收官后的只读可视化环节（无 LLM）
 *
 * [PROTOCOL]: 变更进度文案或 Tab 键时同步 `useDesignDetailChat.ts` 与本文件
 */

import { logTask10ArchGate } from './designDetailTask10ArchGateDebugLog';

export const TASK10_ARCH_INVENTORY_START_LINE = '→ 即将生成架构清单';

/** @deprecated 兼容旧进度行文案检测 */
export const TASK10_DATA_ARCH_START_LINE = TASK10_ARCH_INVENTORY_START_LINE;

export { ARCHITECTURE_INVENTORY_TAB_ID } from './architectureInventoryCanvas';

/** @deprecated 使用 `ARCHITECTURE_INVENTORY_TAB_ID` */
export const DATA_ARCHITECTURE_TAB_ID = 'architecture_inventory';

export type RunTask10DataArchDeps = {
  rawId: string;
  appendLineToTask10Card: (line: string) => void;
  ensureArchitectureInventoryTab: () => void;
  setActiveArchitectureInventoryTab: () => void;
  bumpArchitectureInventoryRefreshTick: () => void;
  flushPersistDesignDetailProgressWorkspace: (caseId: string) => Promise<void>;
  /** 架构清单 Tab 就绪后推进线步至任务 11 或挂下一调试门闩 */
  onAfterDataArchitectureReady: (caseId: string) => void | Promise<void>;
};

export async function runTask10DataArchitecturePipelineImpl(deps: RunTask10DataArchDeps): Promise<void> {
  const {
    rawId,
    appendLineToTask10Card,
    ensureArchitectureInventoryTab,
    setActiveArchitectureInventoryTab,
    bumpArchitectureInventoryRefreshTick,
    flushPersistDesignDetailProgressWorkspace,
    onAfterDataArchitectureReady,
  } = deps;

  logTask10ArchGate('data_arch_pipeline_start', { caseId: rawId });
  appendLineToTask10Card(TASK10_ARCH_INVENTORY_START_LINE);
  await flushPersistDesignDetailProgressWorkspace(rawId);

  ensureArchitectureInventoryTab();
  setActiveArchitectureInventoryTab();
  bumpArchitectureInventoryRefreshTick();
  await flushPersistDesignDetailProgressWorkspace(rawId);

  await onAfterDataArchitectureReady(rawId);
  logTask10ArchGate('data_arch_pipeline_done', { caseId: rawId });
}
