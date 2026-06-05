/**
 * [INPUT]: caseId
 * [OUTPUT]: 规范化后的 task-graph tasks[]
 * [POS]: 设计报告 / 任务 11 拉取 DAG
 */

import { normalizeLogicGraphTasksFromApiPayload } from './designDetailTask2L1SyncUiProgress';
import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';

export async function fetchTaskGraphTasksForDesignReport(
  caseId: string,
): Promise<ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>> {
  const api = (
    window as unknown as {
      SmartCto?: {
        problemCaseApi?: {
          getDesignDetailTaskGraph?: (id: string) => Promise<{
            ok?: boolean;
            data?: { tasks?: unknown[] };
            message?: string;
          } | null>;
        };
      };
    }
  ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;
  if (typeof api !== 'function') {
    throw new Error('未加载 problemCaseApi.getDesignDetailTaskGraph');
  }
  const res = await api(caseId);
  if (!res?.ok || !res.data) {
    throw new Error(res?.message || '拉取 task-graph 失败');
  }
  return normalizeLogicGraphTasksFromApiPayload(res.data.tasks ?? []);
}
