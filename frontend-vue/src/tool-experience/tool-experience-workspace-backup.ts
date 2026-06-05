/**
 * [INPUT]: `ToolExpKnowledgePayload`、`ToolExpHistoryEntry[]`
 * [OUTPUT]: 知识工作区（知识树 + 上传历史）导出 JSON 与导入校验
 * [POS]: 工具经验页「知识工作区」导出/导入
 *
 * [PROTOCOL]: 变更 `format`/`version` 或字段时同步 `ToolExperiencePage.vue` 与 `AGENTS.md`
 */
import { emptyKnowledgePayload, type ToolExpKnowledgePayload } from './knowledge-tree-payload';
import type { ToolExpHistoryEntry } from './upload-history-storage';

export const TOOL_EXP_WORKSPACE_BACKUP_FORMAT = 'smart-cto-tool-experience-knowledge-workspace' as const;
export const TOOL_EXP_WORKSPACE_BACKUP_VERSION = 1 as const;

export type ToolExpWorkspaceBackupV1 = {
  format: typeof TOOL_EXP_WORKSPACE_BACKUP_FORMAT;
  version: typeof TOOL_EXP_WORKSPACE_BACKUP_VERSION;
  exportedAt: string;
  knowledgeTree: ToolExpKnowledgePayload;
  uploadHistory: ToolExpHistoryEntry[];
};

export function buildWorkspaceBackupExport(
  knowledge: ToolExpKnowledgePayload,
  history: ToolExpHistoryEntry[],
): ToolExpWorkspaceBackupV1 {
  return {
    format: TOOL_EXP_WORKSPACE_BACKUP_FORMAT,
    version: TOOL_EXP_WORKSPACE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    knowledgeTree: knowledge,
    uploadHistory: history.slice(),
  };
}

function normalizeImportedKnowledge(raw: unknown): ToolExpKnowledgePayload {
  const base = emptyKnowledgePayload();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  const version =
    typeof o.version === 'number' && Number.isFinite(o.version) ? Math.floor(o.version) : 1;
  return {
    version,
    productEntries: Array.isArray(o.productEntries)
      ? (o.productEntries as ToolExpKnowledgePayload['productEntries'])
      : [],
    comparisonEntries: Array.isArray(o.comparisonEntries)
      ? (o.comparisonEntries as ToolExpKnowledgePayload['comparisonEntries'])
      : [],
    scenarioEntries: Array.isArray(o.scenarioEntries)
      ? (o.scenarioEntries as ToolExpKnowledgePayload['scenarioEntries'])
      : [],
  };
}

function normalizeImportedHistory(raw: unknown): ToolExpHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is ToolExpHistoryEntry =>
      Boolean(x) &&
      typeof x === 'object' &&
      typeof (x as ToolExpHistoryEntry).id === 'string' &&
      typeof (x as ToolExpHistoryEntry).createdAt === 'string',
  );
}

export function parseWorkspaceBackupImport(
  raw: unknown,
):
  | { ok: true; knowledge: ToolExpKnowledgePayload; history: ToolExpHistoryEntry[] }
  | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: '文件内容不是 JSON 对象' };
  }
  const o = raw as Record<string, unknown>;
  if (o.format !== TOOL_EXP_WORKSPACE_BACKUP_FORMAT || o.version !== TOOL_EXP_WORKSPACE_BACKUP_VERSION) {
    return {
      ok: false,
      message: `不是本页导出的备份文件（需 format="${TOOL_EXP_WORKSPACE_BACKUP_FORMAT}" 且 version=${TOOL_EXP_WORKSPACE_BACKUP_VERSION}）`,
    };
  }
  const knowledge = normalizeImportedKnowledge(o.knowledgeTree);
  const history = normalizeImportedHistory(o.uploadHistory);
  return { ok: true, knowledge, history };
}
