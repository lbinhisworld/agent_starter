/**
 * [INPUT]: `window` 注入 `api.js`（`fetchDeepSeekChat`）；`activeToolId`；`tool-detail-chat-persist`
 * [OUTPUT]: 工具详情页会话：按工具分桶对话持久化、L0.5 提炼、工作画布结果
 * [POS]: `ToolDetailPage.vue` 组合式逻辑
 *
 * [PROTOCOL]: L0.5 提示词以 `tool-detail-l05-prompt.ts` 为单一真源；变更时同步 `AGENTS.md`
 */
import { computed, nextTick, onMounted, ref, watch, type Ref } from 'vue';
import {
  buildWorkspaceToolNodes,
  loadToolDetailChatForTool,
  saveToolDetailChatForTool,
  type ToolDetailWorkspaceToolNode,
} from './tool-detail-chat-persist';
import {
  clearToolDetailKnowledgeForTool,
  hydrateToolDetailKnowledgeFromServer,
  mergeParsedIntoToolKnowledge,
  persistKnowledgeNow,
  removeToolDetailKnowledgeValue,
  updateToolDetailKnowledgeValue,
  type ToolDetailValueLocator,
} from './tool-detail-knowledge-persist';
import { readL05TargetKv } from './toolDetailL05Format';
import type { ToolDetailChatMsg, ToolDetailChatSub } from './tool-detail-chat-types';
import { TOOL_DETAIL_L0_5_PRIMITIVE_SYSTEM_PROMPT } from './tool-detail-l05-prompt';
import { formatL05MatrixForChatReveal } from './toolDetailL05Format';
import {
  maxRevealLenForThreeLinePreview,
  previewUserInputThreeLines,
  runCharReveal,
} from './toolDetailChatReveal';

export type { ToolDetailChatMsg, ToolDetailChatSub } from './tool-detail-chat-types';

declare global {
  interface Window {
    fetchDeepSeekChat?: (
      messages: { role: string; content: string }[],
      options?: { taskTag?: string; maxOutputTokens?: number; timeoutMs?: number },
    ) => Promise<{ content: string; usage?: unknown; model?: string; durationMs?: number }>;
    hasAiConfig?: () => boolean;
    fetchToolDetailWorkspace?: () => Promise<{ version: 1; byToolId: Record<string, unknown> }>;
    saveToolDetailWorkspace?: (store: { version: 1; byToolId: Record<string, unknown> }) => Promise<unknown>;
  }
}

function newMsgKey(): string {
  const c = typeof window !== 'undefined' ? window.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useToolDetailSession(
  activeToolId: Ref<string>,
  toolRegistry: Ref<Array<{ id: string; name: string }>>,
) {
  const inputText = ref('');
  const chatMessages = ref<ToolDetailChatMsg[]>([]);
  const sending = ref(false);
  const parseError = ref('');
  const result = ref<Record<string, unknown> | null>(null);
  const chatScrollRef = ref<HTMLElement | null>(null);

  const workspaceTools = ref<ToolDetailWorkspaceToolNode[]>([]);
  const hasWorkspaceTools = computed(() => workspaceTools.value.length > 0);
  const workspaceSaveError = ref('');
  const knowledgeHydrating = ref(false);

  const chatPersistReady = ref(false);
  let chatSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function refreshWorkspace() {
    workspaceTools.value = buildWorkspaceToolNodes(toolRegistry.value);
  }

  function hydrateChatForTool(toolId: string) {
    const bucket = loadToolDetailChatForTool(toolId);
    chatMessages.value = bucket.messages;
    inputText.value = bucket.inputDraft;
    result.value = bucket.lastResult ?? null;
    parseError.value = '';
  }

  function flushChatForTool(toolId: string) {
    const id = toolId.trim();
    if (!id) return;
    saveToolDetailChatForTool(id, {
      messages: serializeMessagesForPersist(chatMessages.value),
      inputDraft: inputText.value,
      lastResult: result.value,
    });
  }

  function schedulePersistChatState() {
    if (!chatPersistReady.value) return;
    if (chatSaveTimer) clearTimeout(chatSaveTimer);
    chatSaveTimer = setTimeout(() => {
      chatSaveTimer = null;
      persistChatState();
    }, 700);
  }

  function serializeMessagesForPersist(msgs: ToolDetailChatMsg[]): ToolDetailChatMsg[] {
    return msgs
      .filter((m) => !m.parsing && !m.sub?.revealInProgress)
      .map((m) => {
        if (!m.sub?.fullText) return m;
        const len = m.sub.fullText.length;
        return {
          ...m,
          sub: {
            ...m.sub,
            revealedLen: len,
            revealDone: true,
            revealInProgress: false,
          },
        };
      });
  }

  function patchMessageSub(key: string, subPatch: Partial<ToolDetailChatSub>) {
    chatMessages.value = chatMessages.value.map((m) =>
      m.key === key && m.sub ? { ...m, sub: { ...m.sub, ...subPatch } } : m,
    );
  }

  function patchMessage(key: string, patch: Partial<ToolDetailChatMsg>) {
    chatMessages.value = chatMessages.value.map((m) => (m.key === key ? { ...m, ...patch } : m));
  }

  function pushIntegratePrompt(parsed: Record<string, unknown>) {
    const toolId = activeToolId.value.trim();
    if (!toolId || !readL05TargetKv(parsed).length) return;
    const integrateKey = newMsgKey();
    chatMessages.value = [
      ...chatMessages.value,
      {
        key: integrateKey,
        role: 'assistant',
        kind: 'tool-integrate-prompt',
        lineText: '→ 是否将内容整合到工具知识集？',
        integrateStatus: 'pending',
        sourceToolId: toolId,
        integrateParsed: parsed,
      },
    ];
    scrollChatToBottom();
  }

  function confirmIntegrateYes(messageKey: string) {
    const m = chatMessages.value.find((x) => x.key === messageKey);
    if (!m || m.kind !== 'tool-integrate-prompt' || m.integrateStatus !== 'pending') return;
    const toolId = (m.sourceToolId || '').trim();
    const parsed = m.integrateParsed;
    if (!toolId || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    mergeParsedIntoToolKnowledge(toolId, parsed);
    patchMessage(messageKey, { integrateStatus: 'yes' });
    refreshWorkspace();
    void persistKnowledgeNow().catch((e) => {
      workspaceSaveError.value = e instanceof Error ? e.message : String(e);
    });
    persistChatState();
    scrollChatToBottom();
  }

  function confirmIntegrateNo(messageKey: string) {
    const m = chatMessages.value.find((x) => x.key === messageKey);
    if (!m || m.kind !== 'tool-integrate-prompt' || m.integrateStatus !== 'pending') return;
    patchMessage(messageKey, { integrateStatus: 'no' });
    persistChatState();
    scrollChatToBottom();
  }

  function persistChatState() {
    flushChatForTool(activeToolId.value);
  }

  async function loadWorkspaceFromServer() {
    knowledgeHydrating.value = true;
    workspaceSaveError.value = '';
    try {
      await hydrateToolDetailKnowledgeFromServer();
      refreshWorkspace();
    } catch (e) {
      workspaceSaveError.value = e instanceof Error ? e.message : String(e);
      refreshWorkspace();
    } finally {
      knowledgeHydrating.value = false;
    }
  }

  function onUpdateWorkspaceValue(locator: ToolDetailValueLocator, newValue: string) {
    workspaceSaveError.value = '';
    const ok = updateToolDetailKnowledgeValue(locator, newValue);
    if (!ok) {
      workspaceSaveError.value = '无法保存：取值为空或与同键下已有取值重复。';
      return;
    }
    refreshWorkspace();
    void persistKnowledgeNow().catch((e) => {
      workspaceSaveError.value = e instanceof Error ? e.message : String(e);
    });
  }

  function onDeleteWorkspaceValue(locator: ToolDetailValueLocator) {
    workspaceSaveError.value = '';
    if (!removeToolDetailKnowledgeValue(locator)) return;
    refreshWorkspace();
    void persistKnowledgeNow().catch((e) => {
      workspaceSaveError.value = e instanceof Error ? e.message : String(e);
    });
  }

  onMounted(() => {
    chatPersistReady.value = true;
    void loadWorkspaceFromServer();
  });

  watch(toolRegistry, () => refreshWorkspace(), { deep: true });

  watch(activeToolId, (id, prevId) => {
    if (chatPersistReady.value && prevId && prevId !== id) flushChatForTool(prevId);
    if (!id) {
      chatMessages.value = [];
      inputText.value = '';
      result.value = null;
      parseError.value = '';
      return;
    }
    hydrateChatForTool(id);
  });

  watch([chatMessages, inputText], () => schedulePersistChatState(), { deep: true });

  function scrollChatToBottom() {
    nextTick(() => {
      const el = chatScrollRef.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  function extractJsonFromModelText(text: string): Record<string, unknown> {
    const raw = (text || '').trim();
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, unknown>;
    } catch {
      /* fallthrough */
    }
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const o = JSON.parse(m[0]);
        if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, unknown>;
      } catch {
        /* fallthrough */
      }
    }
    throw new Error('模型返回无法解析为 JSON，请缩短输入或重试');
  }

  function previewExtractSubText(sub: ToolDetailChatSub): string {
    const n = Math.max(0, Math.min(sub.revealedLen, sub.fullText.length));
    return sub.fullText.slice(0, n);
  }

  async function onSend() {
    if (!activeToolId.value.trim()) return;
    const text = (inputText.value || '').trim();
    if (!text || sending.value) return;

    if (typeof window.hasAiConfig === 'function' && !window.hasAiConfig()) {
      parseError.value = '请先配置 AI（local：DEEPSEEK_API_KEY；online：个人模型配置与 BACKEND_API_URL）。';
      return;
    }
    if (typeof window.fetchDeepSeekChat !== 'function') {
      parseError.value = '未加载 fetchDeepSeekChat，请确认已引入 api.js。';
      return;
    }

    parseError.value = '';
    inputText.value = '';
    sending.value = true;

    const receivedKey = newMsgKey();
    chatMessages.value = [
      ...chatMessages.value,
      {
        key: receivedKey,
        role: 'assistant',
        kind: 'tool-received',
        lineText: '→ 接收到如下的工具信息',
        sub: {
          kind: 'user_input',
          fullText: text,
          revealedLen: 0,
          revealInProgress: true,
          revealDone: false,
        },
      },
    ];
    scrollChatToBottom();

    const previewRevealLen = maxRevealLenForThreeLinePreview(text);
    await runCharReveal(previewRevealLen, (len) => {
      patchMessageSub(receivedKey, { revealedLen: len });
      if (len > 0 && len % 6 === 0) scrollChatToBottom();
    });
    patchMessageSub(receivedKey, {
      revealedLen: text.length,
      revealInProgress: false,
      revealDone: true,
    });
    scrollChatToBottom();

    const extractKey = newMsgKey();
    chatMessages.value = [
      ...chatMessages.value,
      {
        key: extractKey,
        role: 'assistant',
        kind: 'tool-extracting',
        lineText: '→ 正在对工具信息进行提取',
        sub: {
          kind: 'extract_result',
          fullText: '',
          revealedLen: 0,
          revealInProgress: true,
          revealDone: false,
        },
      },
    ];
    scrollChatToBottom();

    try {
      const resp = await window.fetchDeepSeekChat(
        [
          { role: 'system', content: TOOL_DETAIL_L0_5_PRIMITIVE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `【Input 1：非结构化外部工具/设施文本描述】\n${text}`,
          },
        ],
        { taskTag: 'tool-detail-l05-primitive', maxOutputTokens: 8192, timeoutMs: 240_000 },
      );
      const parsed = extractJsonFromModelText(resp.content);
      result.value = parsed;

      const revealText = formatL05MatrixForChatReveal(parsed);
      patchMessageSub(extractKey, { fullText: revealText });

      await runCharReveal(revealText.length, (len) => {
        patchMessageSub(extractKey, { revealedLen: len });
        if (len > 0 && len % 10 === 0) scrollChatToBottom();
      });
      patchMessageSub(extractKey, {
        revealedLen: revealText.length,
        revealInProgress: false,
        revealDone: true,
      });
      pushIntegratePrompt(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      parseError.value = msg;
      const failText = `提取失败：${msg}`;
      patchMessageSub(extractKey, {
        fullText: failText,
        revealedLen: failText.length,
        revealInProgress: false,
        revealDone: true,
      });
    } finally {
      sending.value = false;
      scrollChatToBottom();
      persistChatState();
      refreshWorkspace();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  }

  function removeWorkspaceTool(toolId: string) {
    const id = toolId.trim();
    if (!id) return;
    clearToolDetailKnowledgeForTool(id);
    refreshWorkspace();
    void persistKnowledgeNow().catch((e) => {
      workspaceSaveError.value = e instanceof Error ? e.message : String(e);
    });
  }

  return {
    inputText,
    chatMessages,
    sending,
    parseError,
    chatScrollRef,
    workspaceTools,
    hasWorkspaceTools,
    workspaceSaveError,
    knowledgeHydrating,
    onUpdateWorkspaceValue,
    onDeleteWorkspaceValue,
    previewUserInputThreeLines,
    previewExtractSubText,
    onSend,
    onKeydown,
    removeWorkspaceTool,
    confirmIntegrateYes,
    confirmIntegrateNo,
  };
}
