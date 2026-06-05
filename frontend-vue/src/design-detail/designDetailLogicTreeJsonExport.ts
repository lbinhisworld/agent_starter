/**
 * [INPUT]: `GET …/design-detail/task-graph` 归一化后的 `tasks[]`
 * [OUTPUT]: 浏览器本地下载完整 DAG JSON 文件
 * [POS]: `DesignDetailLogicTreeModal.vue` 标题栏「下载 JSON」
 *
 * [PROTOCOL]: 变更导出字段或文件名规则时同步 Modal 与 `AGENTS.md`
 */

import type { DesignDetailLogicGraphTaskDto } from './designDetailLogicGraphMerge';

export const DESIGN_DETAIL_TASK_GRAPH_EXPORT_FORMAT = 'smart-cto-design-detail-task-graph' as const;
export const DESIGN_DETAIL_TASK_GRAPH_EXPORT_VERSION = 1 as const;

export type DesignDetailTaskGraphExportDocument = {
  format: typeof DESIGN_DETAIL_TASK_GRAPH_EXPORT_FORMAT;
  version: typeof DESIGN_DETAIL_TASK_GRAPH_EXPORT_VERSION;
  caseId: string;
  exportedAt: string;
  tasks: DesignDetailLogicGraphTaskDto[];
};

export function buildLogicTreeJsonFilename(caseId?: string): string {
  const id = String(caseId ?? '').trim();
  const base = id ? `逻辑树_${id}` : '逻辑树';
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}_${stamp}.json`;
}

/** 深拷贝任务图，避免 Vue Proxy 与循环引用影响序列化 */
function cloneTasksForExport(tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>): DesignDetailLogicGraphTaskDto[] {
  return JSON.parse(JSON.stringify(tasks)) as DesignDetailLogicGraphTaskDto[];
}

export function buildLogicTreeDagExportDocument(
  caseId: string,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): DesignDetailTaskGraphExportDocument {
  return {
    format: DESIGN_DETAIL_TASK_GRAPH_EXPORT_FORMAT,
    version: DESIGN_DETAIL_TASK_GRAPH_EXPORT_VERSION,
    caseId: String(caseId ?? '').trim(),
    exportedAt: new Date().toISOString(),
    tasks: cloneTasksForExport(tasks),
  };
}

export function triggerBrowserJsonDownload(jsonText: string, filename: string): void {
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadLogicTreeDagJson(
  caseId: string,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): void {
  const doc = buildLogicTreeDagExportDocument(caseId, tasks);
  const json = JSON.stringify(doc, null, 2);
  triggerBrowserJsonDownload(json, buildLogicTreeJsonFilename(caseId));
}
