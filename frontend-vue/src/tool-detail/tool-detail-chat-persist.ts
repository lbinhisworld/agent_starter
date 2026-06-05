/**
 * [INPUT]: 当前工具 id、聊天消息与输入草稿
 * [OUTPUT]: 按工具分桶的 localStorage 读写（与工具经验页隔离）
 * [POS]: `useToolDetailSession`
 *
 * [PROTOCOL]: 变更存储结构时同步 `AGENTS.md`
 */
import type { ToolDetailChatMsg } from './tool-detail-chat-types';

export type { ToolDetailWorkspaceToolNode } from './toolDetailL05Format';
export { buildWorkspaceToolNodes } from './tool-detail-knowledge-persist';

const STORAGE_KEY = 'smart_cto_tool_detail_chat_by_tool_v1';

type ToolDetailChatBucket = {
  messages: ToolDetailChatMsg[];
  inputDraft: string;
  /** 最近一次 L0.5 提炼 JSON，供工作画布展示 */
  lastResult?: Record<string, unknown> | null;
};

type ToolDetailChatStore = {
  version: 1;
  byToolId: Record<string, ToolDetailChatBucket>;
};

function emptyBucket(): ToolDetailChatBucket {
  return { messages: [], inputDraft: '', lastResult: null };
}

/** 仅保留工具详情页协议内的消息形态，丢弃工具经验页遗留的普通气泡 */
export function sanitizeToolDetailMessages(raw: unknown): ToolDetailChatMsg[] {
  if (!Array.isArray(raw)) return [];
  const out: ToolDetailChatMsg[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as ToolDetailChatMsg;
    if (typeof m.key !== 'string' || !m.key) continue;
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (m.kind === 'tool-received' || m.kind === 'tool-extracting') {
      out.push(m);
      continue;
    }
    if (m.kind === 'tool-integrate-prompt') {
      const status = m.integrateStatus;
      if (status === 'yes' || status === 'no') {
        out.push(m);
        continue;
      }
      if (
        status === 'pending' &&
        m.integrateParsed &&
        typeof m.integrateParsed === 'object' &&
        !Array.isArray(m.integrateParsed)
      ) {
        out.push(m);
      }
    }
  }
  return out;
}

function readStore(): ToolDetailChatStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, byToolId: {} };
    const parsed = JSON.parse(raw) as Partial<ToolDetailChatStore>;
    if (!parsed || typeof parsed !== 'object' || !parsed.byToolId) {
      return { version: 1, byToolId: {} };
    }
    return { version: 1, byToolId: parsed.byToolId };
  } catch {
    return { version: 1, byToolId: {} };
  }
}

function writeStore(store: ToolDetailChatStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[tool-detail-chat] localStorage write failed', e);
  }
}

export function loadToolDetailChatForTool(toolId: string): ToolDetailChatBucket {
  const id = toolId.trim();
  if (!id) return emptyBucket();
  const store = readStore();
  const hit = store.byToolId[id];
  if (!hit) return emptyBucket();
  const lastResult =
    hit.lastResult && typeof hit.lastResult === 'object' && !Array.isArray(hit.lastResult)
      ? (hit.lastResult as Record<string, unknown>)
      : null;
  return {
    messages: sanitizeToolDetailMessages(hit.messages),
    inputDraft: typeof hit.inputDraft === 'string' ? hit.inputDraft : '',
    lastResult,
  };
}

/** 从工作画布移除某工具的提炼结果（保留该工具聊天记录） */
export function clearToolDetailWorkspaceResult(toolId: string): void {
  const id = toolId.trim();
  if (!id) return;
  const store = readStore();
  const hit = store.byToolId[id];
  if (!hit) return;
  store.byToolId[id] = {
    messages: hit.messages,
    inputDraft: hit.inputDraft,
    lastResult: null,
  };
  writeStore(store);
}

export function saveToolDetailChatForTool(toolId: string, bucket: ToolDetailChatBucket): void {
  const id = toolId.trim();
  if (!id) return;
  const store = readStore();
  store.byToolId[id] = {
    messages: bucket.messages,
    inputDraft: bucket.inputDraft,
    lastResult: bucket.lastResult ?? null,
  };
  writeStore(store);
}

