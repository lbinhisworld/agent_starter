<!--
  [INPUT]: `frontend` 注入的 `config` / `auth-runtime` / `api.js`（`fetchDeepSeekChat` / `hasAiConfig`）/ `utils`（`escapeHtml`）
  [OUTPUT]: 工具经验页：左侧对话 + 右侧「知识工作区」三 Tab（解析工作区、沉淀知识树、上传历史）；标题栏导出/导入知识树与上传历史 JSON
  [POS]: `tool-experience.html` 挂载根

  [PROTOCOL]: 提示词正文以 `capability-prompt.ts` 为单一真源；上传历史样式复用 `preliminary-history-*`；布局 class 与案例详情对话区对齐；**左右栏间隔见文末 scoped `<style>`**（须进 Vite 产物）；对话区经 `api.js` `fetchToolExpChatState` / `saveToolExpChatState` 持久化（online 入库，否则 localStorage）；知识工作区导出/导入见 `tool-experience-workspace-backup.ts`。
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { TOOL_EXPERIENCE_CAPABILITY_SYSTEM_PROMPT } from './capability-prompt';
import ToolExpKnowledgeTreePanel from './ToolExpKnowledgeTreePanel.vue';
import ToolExpResultCard from './ToolExpResultCard.vue';
import {
  emptyKnowledgePayload,
  mergeExtractIntoKnowledgeTree,
  type ToolExpKnowledgePayload,
} from './knowledge-tree-payload';
import {
  formatUploadHistoryCode,
  loadUploadHistory,
  saveUploadHistory,
  type ToolExpHistoryEntry,
} from './upload-history-storage';
import {
  buildWorkspaceBackupExport,
  parseWorkspaceBackupImport,
} from './tool-experience-workspace-backup';

type WorkspaceTab = 'history' | 'parse' | 'tree';

/** 提炼完成通知卡展示的调用元信息 */
type ToolExpRunMeta = {
  model: string;
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

type ChatMsg = {
  key: string;
  role: 'user' | 'assistant';
  /** 普通气泡文案；通知卡可不填 */
  content?: string;
  parsing?: boolean;
  /** 提炼完成 / 知识树整合 通知卡 */
  kind?: 'tool-exp-done' | 'tool-exp-tree';
  meta?: ToolExpRunMeta;
};

declare global {
  interface Window {
    fetchDeepSeekChat?: (
      messages: { role: string; content: string }[],
      options?: { taskTag?: string; maxOutputTokens?: number; timeoutMs?: number },
    ) => Promise<{ content: string; usage?: unknown; model?: string; durationMs?: number }>;
    hasAiConfig?: () => boolean;
    escapeHtml?: (s: string) => string;
    AUTH_RUNTIME?: {
      clearAuth?: () => void;
      buildModelConfigUrl?: (redirect?: string) => string;
    };
    getUsername?: () => string;
    postLogoutToBackend?: () => Promise<boolean>;
    clearAuth?: () => void;
    fetchToolExpKnowledgeTree?: () => Promise<import('./knowledge-tree-payload').ToolExpKnowledgePayload>;
    saveToolExpKnowledgeTree?: (
      p: import('./knowledge-tree-payload').ToolExpKnowledgePayload,
    ) => Promise<unknown>;
    fetchToolExpChatState?: () => Promise<{
      version: number;
      messages: ChatMsg[];
      inputDraft: string;
    }>;
    saveToolExpChatState?: (s: {
      version: number;
      messages: ChatMsg[];
      inputDraft: string;
    }) => Promise<unknown>;
  }
}

function newMsgKey(): string {
  const c = typeof window !== 'undefined' ? window.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function newHistoryId(): string {
  const c = typeof window !== 'undefined' ? window.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `h-${Date.now()}`;
}

const inputText = ref('');
const chatMessages = ref<ChatMsg[]>([]);
const sending = ref(false);
const parseError = ref('');
const result = ref<Record<string, unknown> | null>(null);
const chatScrollRef = ref<HTMLElement | null>(null);

const workspaceTab = ref<WorkspaceTab>('parse');
const uploadHistory = ref<ToolExpHistoryEntry[]>([]);
/** 时间线条目是否展开正文（输入摘要） */
const expandedHistory = ref<Record<string, boolean>>({});
/** 上传历史「复制」成功反馈（条目 id） */
const historyCopyFlashId = ref<string | null>(null);
let historyCopyTimer: ReturnType<typeof setTimeout> | null = null;

const knowledgePayload = ref<ToolExpKnowledgePayload>(emptyKnowledgePayload());
const knowledgeTreeLoading = ref(false);
const knowledgeTreeLoadError = ref('');
const knowledgeTreeSaveError = ref('');

const workspaceImportFileRef = ref<HTMLInputElement | null>(null);
const knowledgeWorkspaceTip = ref('');
const knowledgeWorkspaceTipKind = ref<'ok' | 'err'>('ok');
let knowledgeWorkspaceTipTimer: ReturnType<typeof setTimeout> | null = null;

/** 为 true 后才对对话区做防抖写库，避免首屏 hydrate 触发多余 PUT */
const chatPersistReady = ref(false);
let chatSaveTimer: ReturnType<typeof setTimeout> | null = null;

const navUserInfo = computed(() => {
  const u = typeof window.getUsername === 'function' ? window.getUsername() : '';
  return u ? `用户：${u}` : '';
});

async function loadKnowledgeTree() {
  knowledgeTreeLoadError.value = '';
  knowledgeTreeLoading.value = true;
  try {
    if (typeof window.fetchToolExpKnowledgeTree === 'function') {
      knowledgePayload.value = await window.fetchToolExpKnowledgeTree();
    } else {
      knowledgePayload.value = emptyKnowledgePayload();
    }
  } catch (e) {
    knowledgeTreeLoadError.value = e instanceof Error ? e.message : String(e);
    knowledgePayload.value = emptyKnowledgePayload();
  } finally {
    knowledgeTreeLoading.value = false;
  }
}

async function loadChatState() {
  try {
    if (typeof window.fetchToolExpChatState !== 'function') return;
    const s = await window.fetchToolExpChatState();
    if (s && typeof s === 'object') {
      chatMessages.value = Array.isArray(s.messages) ? s.messages : [];
      if (typeof s.inputDraft === 'string') inputText.value = s.inputDraft;
    }
  } catch (e) {
    console.warn('[tool-exp] chat state load failed', e);
  }
}

function schedulePersistChatState() {
  if (!chatPersistReady.value) return;
  if (chatSaveTimer) clearTimeout(chatSaveTimer);
  chatSaveTimer = setTimeout(() => {
    chatSaveTimer = null;
    void persistChatState();
  }, 700);
}

async function persistChatState() {
  if (typeof window.saveToolExpChatState !== 'function') return;
  try {
    await window.saveToolExpChatState({
      version: 1,
      messages: chatMessages.value.filter((m) => !m.parsing),
      inputDraft: inputText.value,
    });
  } catch (e) {
    console.warn('[tool-exp] chat state save failed', e);
  }
}

onMounted(async () => {
  uploadHistory.value = loadUploadHistory();
  await Promise.all([loadKnowledgeTree(), loadChatState()]);
  chatPersistReady.value = true;
});

watch([chatMessages, inputText], () => schedulePersistChatState(), { deep: true });

function showKnowledgeWorkspaceTip(kind: 'ok' | 'err', text: string) {
  knowledgeWorkspaceTipKind.value = kind;
  knowledgeWorkspaceTip.value = text;
  if (knowledgeWorkspaceTipTimer) clearTimeout(knowledgeWorkspaceTipTimer);
  knowledgeWorkspaceTipTimer = setTimeout(() => {
    knowledgeWorkspaceTip.value = '';
    knowledgeWorkspaceTipTimer = null;
  }, 5000);
}

function onExportKnowledgeWorkspace() {
  try {
    const bundle = buildWorkspaceBackupExport(knowledgePayload.value, uploadHistory.value);
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    a.href = url;
    a.download = `tool-experience-knowledge-workspace-${stamp}.json`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showKnowledgeWorkspaceTip('ok', '已导出当前知识树与上传历史');
  } catch (e) {
    showKnowledgeWorkspaceTip('err', e instanceof Error ? e.message : String(e));
  }
}

function onClickImportKnowledgeWorkspace() {
  workspaceImportFileRef.value?.click();
}

async function onWorkspaceImportFile(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const raw = JSON.parse(text) as unknown;
    const parsed = parseWorkspaceBackupImport(raw);
    if (!parsed.ok) {
      showKnowledgeWorkspaceTip('err', parsed.message);
      return;
    }
    knowledgePayload.value = parsed.knowledge;
    uploadHistory.value = saveUploadHistory(parsed.history);
    expandedHistory.value = {};
    knowledgeTreeSaveError.value = '';
    try {
      if (typeof window.saveToolExpKnowledgeTree === 'function') {
        await window.saveToolExpKnowledgeTree(knowledgePayload.value);
      }
    } catch (e) {
      knowledgeTreeSaveError.value = e instanceof Error ? e.message : String(e);
      showKnowledgeWorkspaceTip(
        'err',
        `已写入本机，知识树同步服务器失败：${knowledgeTreeSaveError.value}`,
      );
      workspaceTab.value = 'tree';
      return;
    }
    showKnowledgeWorkspaceTip('ok', '已导入并保存知识树与上传历史');
    workspaceTab.value = 'tree';
  } catch (e) {
    showKnowledgeWorkspaceTip('err', `导入失败：${e instanceof Error ? e.message : String(e)}`);
  }
}

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

/** 各解析卡片对应的 JSON 切片（与 json 子标签一致） */
const sliceDoc = computed(() => {
  const r = result.value;
  if (!r) return {};
  return {
    identification_timestamp: r.identification_timestamp ?? null,
    document_summary: r.document_summary ?? null,
  };
});

const sliceScenarios = computed(() =>
  Array.isArray(result.value?.scenarios) ? result.value!.scenarios : [],
);

const sliceToolComparison = computed(() => {
  const r = result.value;
  const tc = r?.tool_comparison;
  if (Array.isArray(tc)) return tc;
  if (tc !== undefined && tc !== null && typeof tc === 'object' && !Array.isArray(tc)) {
    return tc as Record<string, unknown>;
  }
  return [];
});

const sliceCore = computed(() => {
  const r = result.value;
  const products = Array.isArray(r?.products) ? r.products : [];
  return products.map((p: unknown) => {
    if (!p || typeof p !== 'object') return p;
    const o = p as Record<string, unknown>;
    return {
      product_name: o.product_name ?? null,
      core_functions: o.core_functions ?? [],
    };
  });
});

const sliceFingerprint = computed(() => {
  const r = result.value;
  const products = Array.isArray(r?.products) ? r.products : [];
  return products.map((p: unknown) => {
    if (!p || typeof p !== 'object') return p;
    const o = p as Record<string, unknown>;
    return {
      product_name: o.product_name ?? null,
      capability_fingerprint: o.capability_fingerprint ?? null,
      identified_issues: o.identified_issues ?? null,
      architecture_advice: o.architecture_advice ?? null,
    };
  });
});

function historyCopyPlainText(entry: ToolExpHistoryEntry): string {
  const preview = (entry.inputPreview || '').trim();
  if (entry.success) return preview || '—';
  const err = (entry.errorMessage || '').trim();
  return [preview, err].filter(Boolean).join('\n\n') || '—';
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function copyHistoryBodyText(entry: ToolExpHistoryEntry) {
  const text = historyCopyPlainText(entry);
  const ok = await writeClipboard(text);
  if (!ok) return;
  historyCopyFlashId.value = entry.id;
  if (historyCopyTimer) clearTimeout(historyCopyTimer);
  historyCopyTimer = setTimeout(() => {
    historyCopyFlashId.value = null;
    historyCopyTimer = null;
  }, 2000);
}

function stripParsingMessages() {
  chatMessages.value = chatMessages.value.filter((m) => !m.parsing);
}

function normalizeTokenUsage(u: unknown): {
  prompt: number | null;
  completion: number | null;
  total: number | null;
} {
  if (!u || typeof u !== 'object') {
    return { prompt: null, completion: null, total: null };
  }
  const o = u as Record<string, unknown>;
  const readNum = (a: unknown, b?: unknown): number | null => {
    const x = a !== undefined && a !== null ? a : b;
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    if (typeof x === 'string' && x.trim() !== '') {
      const n = Number(x);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  return {
    prompt: readNum(o.prompt_tokens, o.promptTokens),
    completion: readNum(o.completion_tokens, o.completionTokens),
    total: readNum(o.total_tokens, o.totalTokens),
  };
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} 秒`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m} 分 ${rs} 秒`;
}

function tokenLabel(n: number | null): string {
  return n !== null && Number.isFinite(n) ? String(n) : '—';
}

function confirmToolExpDone(key: string) {
  chatMessages.value = chatMessages.value.filter((m) => m.key !== key);
  chatMessages.value.push({ key: newMsgKey(), role: 'assistant', kind: 'tool-exp-tree' });
  scrollChatToBottom();
}

async function confirmToolExpTree(key: string) {
  chatMessages.value = chatMessages.value.filter((m) => m.key !== key);
  knowledgeTreeSaveError.value = '';
  if (result.value) {
    knowledgePayload.value = mergeExtractIntoKnowledgeTree(knowledgePayload.value, result.value);
    try {
      if (typeof window.saveToolExpKnowledgeTree === 'function') {
        await window.saveToolExpKnowledgeTree(knowledgePayload.value);
      }
    } catch (e) {
      knowledgeTreeSaveError.value = e instanceof Error ? e.message : String(e);
    }
  }
  workspaceTab.value = 'tree';
  scrollChatToBottom();
}

function formatHistoryTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

function historyEntryTitle(e: ToolExpHistoryEntry): string {
  if (!e.success) {
    const m = (e.errorMessage || '解析失败').trim();
    return m.length > 30 ? `${m.slice(0, 30)}…` : m;
  }
  const s = String(e.result?.document_summary ?? '').trim().replace(/\s+/g, ' ');
  if (s) return s.length > 30 ? `${s.slice(0, 30)}…` : s;
  return '提取成功';
}

function toggleHistoryBody(id: string) {
  expandedHistory.value = { ...expandedHistory.value, [id]: !expandedHistory.value[id] };
}

function deleteHistoryEntry(id: string, ev: Event) {
  ev.stopPropagation();
  const next = uploadHistory.value.filter((x) => x.id !== id);
  uploadHistory.value = saveUploadHistory(next);
  const { [id]: _, ...rest } = expandedHistory.value;
  expandedHistory.value = rest;
}

function openHistoryEntry(e: ToolExpHistoryEntry) {
  parseError.value = '';
  workspaceTab.value = 'parse';
  if (e.success && e.result && typeof e.result === 'object') {
    result.value = e.result;
    return;
  }
  result.value = null;
  parseError.value = e.success ? '该条未保存完整解析结果，请重新发送原文。' : e.errorMessage || '解析失败';
}

async function onSend() {
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
  result.value = null;
  workspaceTab.value = 'parse';

  chatMessages.value = [
    ...chatMessages.value,
    { key: newMsgKey(), role: 'user', content: text },
    { key: newMsgKey(), role: 'assistant', content: '正在解析提取内容…', parsing: true },
  ];
  inputText.value = '';
  sending.value = true;
  scrollChatToBottom();

  try {
    const resp = await window.fetchDeepSeekChat(
      [
        { role: 'system', content: TOOL_EXPERIENCE_CAPABILITY_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      { taskTag: 'tool-experience-capability', maxOutputTokens: 8192, timeoutMs: 240_000 },
    );
    const content = resp.content;
    const tok = normalizeTokenUsage(resp.usage);
    const parsed = extractJsonFromModelText(content);
    result.value = parsed;

    const entry: ToolExpHistoryEntry = {
      id: newHistoryId(),
      createdAt: new Date().toISOString(),
      inputPreview: text.slice(0, 12000),
      success: true,
      result: parsed,
    };
    const merged = [...uploadHistory.value, entry];
    uploadHistory.value = saveUploadHistory(merged);

    stripParsingMessages();
    chatMessages.value.push({
      key: newMsgKey(),
      role: 'assistant',
      kind: 'tool-exp-done',
      meta: {
        model: String(resp.model || '—').trim() || '—',
        durationMs: typeof resp.durationMs === 'number' ? resp.durationMs : 0,
        promptTokens: tok.prompt,
        completionTokens: tok.completion,
        totalTokens: tok.total,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    parseError.value = msg;

    const entry: ToolExpHistoryEntry = {
      id: newHistoryId(),
      createdAt: new Date().toISOString(),
      inputPreview: text.slice(0, 12000),
      success: false,
      errorMessage: msg,
    };
    const merged = [...uploadHistory.value, entry];
    uploadHistory.value = saveUploadHistory(merged);

    stripParsingMessages();
    chatMessages.value = [...chatMessages.value, { key: newMsgKey(), role: 'assistant', content: `处理失败：${msg}` }];
  } finally {
    sending.value = false;
    scrollChatToBottom();
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void onSend();
  }
}

function goHome() {
  window.location.href = 'home.html';
}

function goModelConfig() {
  const redirect = window.location.pathname + window.location.search + window.location.hash;
  const next =
    window.AUTH_RUNTIME?.buildModelConfigUrl?.(redirect) ||
    `model-config.html?redirect=${encodeURIComponent(redirect)}`;
  window.location.href = next;
}

async function onLogout() {
  try {
    await window.postLogoutToBackend?.();
  } catch {
    /* ignore */
  }
  try {
    window.AUTH_RUNTIME?.clearAuth?.();
  } catch {
    /* ignore */
  }
  window.location.href = 'login.html';
}
</script>

<template>
  <div class="app tool-experience-app">
    <nav id="topNav" class="top-nav">
      <button type="button" class="btn-nav" @click="goHome">← 返回首页</button>
      <span class="btn-nav btn-nav-active">工具经验</span>
      <div class="top-nav-right">
        <span class="nav-user-info">{{ navUserInfo }}</span>
        <button type="button" id="btnModelConfig" class="btn-nav" @click="goModelConfig">模型配置</button>
        <button type="button" id="btnLogout" class="btn-nav btn-logout" @click="onLogout">退出登录</button>
      </div>
    </nav>

    <div class="tool-experience-view problem-detail-view">
      <div class="problem-detail-body tool-experience-body">
        <aside class="problem-detail-chat tool-experience-chat">
          <div class="problem-detail-chat-header">
            <span>文档输入</span>
            <span class="problem-detail-chat-header-label">粘贴或输入待分析文档后发送</span>
          </div>
          <div
            id="toolExpChatMessages"
            ref="chatScrollRef"
            class="problem-detail-chat-body"
            aria-live="polite"
          >
            <template v-if="chatMessages.length === 0">
              <p class="tool-exp-chat-placeholder">
                在下方输入框粘贴产品/方案文档片段，点击发送后将按约定维度提取 JSON，并在右侧「解析工作区」展示。
              </p>
            </template>
            <template v-else>
              <template v-for="m in chatMessages" :key="m.key">
                <div
                  v-if="m.parsing"
                  class="problem-detail-chat-msg problem-detail-chat-msg-system tool-exp-chat-msg-parsing"
                  role="status"
                  aria-busy="true"
                >
                  <div class="problem-detail-chat-msg-content tool-exp-parsing-bubble">
                    <span class="tool-exp-parsing-label">{{ m.content }}</span>
                    <span class="tool-exp-parsing-dots" aria-hidden="true">
                      <span class="tool-exp-parsing-dot" />
                      <span class="tool-exp-parsing-dot" />
                      <span class="tool-exp-parsing-dot" />
                    </span>
                  </div>
                </div>
                <div
                  v-else-if="m.kind === 'tool-exp-done' && m.meta"
                  class="problem-detail-chat-msg problem-detail-chat-msg-system"
                >
                  <div class="problem-detail-chat-msg-content tool-exp-chat-notice-wrap">
                    <div class="tool-exp-chat-notice-card" role="status">
                      <div class="tool-exp-chat-notice-title">工具经验提炼完毕</div>
                      <div class="tool-exp-chat-notice-meta">
                        <div class="tool-exp-chat-notice-meta-row">
                          <span class="tool-exp-chat-notice-meta-k">大模型型号</span>
                          <span class="tool-exp-chat-notice-meta-v">{{ m.meta.model }}</span>
                        </div>
                        <div class="tool-exp-chat-notice-meta-row">
                          <span class="tool-exp-chat-notice-meta-k">处理时长</span>
                          <span class="tool-exp-chat-notice-meta-v">{{
                            formatDurationMs(m.meta.durationMs)
                          }}</span>
                        </div>
                        <div class="tool-exp-chat-notice-meta-row">
                          <span class="tool-exp-chat-notice-meta-k">输入 token 数</span>
                          <span class="tool-exp-chat-notice-meta-v">{{
                            tokenLabel(m.meta.promptTokens)
                          }}</span>
                        </div>
                        <div class="tool-exp-chat-notice-meta-row">
                          <span class="tool-exp-chat-notice-meta-k">输出 token 数</span>
                          <span class="tool-exp-chat-notice-meta-v">{{
                            tokenLabel(m.meta.completionTokens)
                          }}</span>
                        </div>
                        <div
                          v-if="
                            m.meta.promptTokens === null &&
                            m.meta.completionTokens === null &&
                            m.meta.totalTokens !== null
                          "
                          class="tool-exp-chat-notice-meta-row tool-exp-chat-notice-meta-row-sub"
                        >
                          <span class="tool-exp-chat-notice-meta-k">token 合计（接口未分项）</span>
                          <span class="tool-exp-chat-notice-meta-v">{{
                            tokenLabel(m.meta.totalTokens)
                          }}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="tool-exp-chat-notice-btn"
                        @click="confirmToolExpDone(m.key)"
                      >
                        确定
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  v-else-if="m.kind === 'tool-exp-tree'"
                  class="problem-detail-chat-msg problem-detail-chat-msg-system"
                >
                  <div class="problem-detail-chat-msg-content tool-exp-chat-notice-wrap">
                    <div class="tool-exp-chat-notice-card tool-exp-chat-notice-card-tree" role="status">
                      <div class="tool-exp-chat-notice-title">知识树整合</div>
                      <p class="tool-exp-chat-notice-body">
                        我将把本次提炼内容整合到知识树当中
                      </p>
                      <button
                        type="button"
                        class="tool-exp-chat-notice-btn"
                        @click="void confirmToolExpTree(m.key)"
                      >
                        确定
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  v-else
                  :class="[
                    'problem-detail-chat-msg',
                    m.role === 'user' ? 'problem-detail-chat-msg-user' : 'problem-detail-chat-msg-system',
                  ]"
                >
                  <div class="problem-detail-chat-msg-content">{{ m.content ?? '' }}</div>
                </div>
              </template>
            </template>
          </div>
          <div class="problem-detail-chat-input-wrap">
            <div class="problem-detail-chat-input-row">
              <textarea
                id="toolExpChatInput"
                v-model="inputText"
                class="problem-detail-chat-input"
                placeholder="粘贴待分析的文档内容…"
                rows="4"
                :disabled="sending"
                @keydown="onKeydown"
              />
              <button
                id="toolExpChatSend"
                type="button"
                class="problem-detail-chat-send"
                :disabled="sending || !inputText.trim()"
                aria-label="发送"
                @click="onSend"
              >
                ↑
              </button>
            </div>
          </div>
        </aside>

        <main class="tool-exp-workspace" aria-label="知识工作区">
          <div class="tool-exp-workspace-head">
            <h2 class="tool-exp-workspace-title">知识工作区</h2>
            <div class="tool-exp-workspace-head-actions">
              <button
                type="button"
                class="tool-exp-workspace-backup-btn"
                title="导出知识树与上传历史为 JSON"
                @click="onExportKnowledgeWorkspace"
              >
                导出
              </button>
              <button
                type="button"
                class="tool-exp-workspace-backup-btn"
                title="从 JSON 恢复知识树与上传历史"
                @click="onClickImportKnowledgeWorkspace"
              >
                导入
              </button>
            </div>
          </div>
          <input
            ref="workspaceImportFileRef"
            type="file"
            class="tool-exp-workspace-file-input"
            accept="application/json,.json"
            aria-hidden="true"
            tabindex="-1"
            @change="onWorkspaceImportFile"
          />
          <p
            v-if="knowledgeWorkspaceTip"
            class="tool-exp-workspace-backup-tip"
            :class="{
              'tool-exp-workspace-backup-tip-ok': knowledgeWorkspaceTipKind === 'ok',
              'tool-exp-workspace-backup-tip-err': knowledgeWorkspaceTipKind === 'err',
            }"
            role="status"
          >
            {{ knowledgeWorkspaceTip }}
          </p>
          <div class="tool-exp-workspace-tablist" role="tablist" aria-label="知识工作区分区">
            <button
              type="button"
              role="tab"
              class="problem-detail-card-tab"
              :class="{ 'problem-detail-card-tab-active': workspaceTab === 'parse' }"
              :aria-selected="workspaceTab === 'parse'"
              @click="workspaceTab = 'parse'"
            >
              解析工作区
            </button>
            <button
              type="button"
              role="tab"
              class="problem-detail-card-tab"
              :class="{ 'problem-detail-card-tab-active': workspaceTab === 'tree' }"
              :aria-selected="workspaceTab === 'tree'"
              @click="workspaceTab = 'tree'"
            >
              沉淀知识树
            </button>
            <button
              type="button"
              role="tab"
              class="problem-detail-card-tab"
              :class="{ 'problem-detail-card-tab-active': workspaceTab === 'history' }"
              :aria-selected="workspaceTab === 'history'"
              @click="workspaceTab = 'history'"
            >
              上传历史
            </button>
          </div>

          <div
            v-show="workspaceTab === 'parse'"
            class="tool-exp-tab-panel tool-exp-tab-panel-parse"
            role="tabpanel"
            aria-label="解析工作区"
          >
            <p v-if="parseError && !result" class="tool-exp-parse-error">{{ parseError }}</p>
            <p v-if="!result && !parseError && !sending" class="tool-exp-workspace-hint">
              发送文档内容后，此处展示提取结果（五个可折叠卡片；每张含 view / json 子标签）。
            </p>
            <p v-if="sending" class="tool-exp-workspace-hint tool-exp-parse-loading-hint">
              正在调用模型提取，请稍候…
            </p>

            <template v-if="result">
              <ToolExpResultCard
                title="文档概要（识别时间戳 + 摘要）"
                variant="doc"
                :data="sliceDoc"
              />
              <ToolExpResultCard title="场景提炼" variant="scenarios" :data="sliceScenarios" />
              <ToolExpResultCard title="工具对比" variant="tool_comparison" :data="sliceToolComparison" />
              <ToolExpResultCard title="核心功能与操作" variant="core" :data="sliceCore" />
              <ToolExpResultCard title="工具能力画像" variant="fingerprint" :data="sliceFingerprint" />
            </template>
          </div>

          <div
            v-show="workspaceTab === 'tree'"
            class="tool-exp-tab-panel tool-exp-tab-panel-tree"
            role="tabpanel"
            aria-label="沉淀知识树"
          >
            <p v-if="knowledgeTreeLoading" class="tool-exp-workspace-hint">正在加载知识树…</p>
            <template v-else>
              <p v-if="knowledgeTreeLoadError" class="tool-exp-parse-error">{{ knowledgeTreeLoadError }}</p>
              <p v-if="knowledgeTreeSaveError" class="tool-exp-parse-error">{{ knowledgeTreeSaveError }}</p>
              <p class="tool-exp-tree-placeholder">
                目录树按主题组织：产品工具、工具对比、典型场景。online 已登录时与服务器同步；local 或离线时使用本机缓存。
              </p>
              <ToolExpKnowledgeTreePanel :payload="knowledgePayload" />
            </template>
          </div>

          <div
            v-show="workspaceTab === 'history'"
            class="tool-exp-tab-panel tool-exp-tab-panel-history"
            role="tabpanel"
            aria-label="上传历史"
          >
            <p v-if="uploadHistory.length === 0" class="preliminary-history-empty">暂无上传记录</p>
            <div v-else class="tool-exp-history-timeline">
              <div
                v-for="(entry, index) in uploadHistory"
                :key="entry.id"
                class="preliminary-history-item"
                :class="{ 'preliminary-history-item-expanded': expandedHistory[entry.id] }"
              >
                <div class="preliminary-history-item-header tool-exp-history-item-header">
                  <div
                    class="preliminary-history-item-header-main"
                    role="button"
                    tabindex="0"
                    :aria-expanded="Boolean(expandedHistory[entry.id])"
                    @click="toggleHistoryBody(entry.id)"
                    @keydown.enter.prevent="toggleHistoryBody(entry.id)"
                    @keydown.space.prevent="toggleHistoryBody(entry.id)"
                  >
                    <span class="preliminary-history-item-code" title="上传编号">{{
                      formatUploadHistoryCode(index + 1)
                    }}</span>
                    <span
                      class="preliminary-history-item-title"
                      :class="{ 'tool-exp-history-title-fail': !entry.success }"
                      :title="historyEntryTitle(entry)"
                      >{{ historyEntryTitle(entry) }}</span>
                    <span class="preliminary-history-item-time">{{ formatHistoryTime(entry.createdAt) }}</span>
                    <span class="preliminary-history-item-arrow" aria-hidden="true">▾</span>
                  </div>
                  <div class="tool-exp-history-header-actions">
                    <button
                      type="button"
                      class="tool-exp-history-copy-btn"
                      :title="historyCopyFlashId === entry.id ? '已复制到剪贴板' : '复制正文到剪贴板'"
                      @click="copyHistoryBodyText(entry)"
                    >
                      {{ historyCopyFlashId === entry.id ? '已复制' : '复制' }}
                    </button>
                    <button
                      type="button"
                      class="tool-exp-history-open-btn"
                      title="在解析工作区打开"
                      @click="openHistoryEntry(entry)"
                    >
                      打开解析
                    </button>
                    <button
                      type="button"
                      class="preliminary-history-item-delete-btn"
                      title="删除该条"
                      aria-label="删除该条上传记录"
                      @click="deleteHistoryEntry(entry.id, $event)"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div
                  class="preliminary-history-item-body tool-exp-history-item-body-scroll"
                  :hidden="!expandedHistory[entry.id]"
                >
                  {{ entry.inputPreview || '—' }}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * 对话区与工作区间隔：须打进 Vite 产物（shared.css），勿仅写在 frontend/styles.css——
 * 否则 tool-experience.html 未链入 styles.css 时间隔不生效。
 * 与案例详情 .problem-detail-workspace 一致：flex 间隙 + 左侧加粗分隔线。
 */
.tool-experience-body {
  gap: 1rem;
  align-items: stretch;
}

.tool-exp-workspace {
  margin-left: 0;
  border-left: 3px solid var(--border, #2d3a4d);
}

/* 通知卡：须在此 scoped 中保留一份，保证打入 tool-experience.css（与 styles.css 同步维护） */
.tool-exp-chat-notice-wrap {
  width: 100%;
  max-width: 100%;
}

.tool-exp-chat-notice-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(88, 166, 255, 0.4);
  background: linear-gradient(165deg, rgba(88, 166, 255, 0.14), rgba(0, 0, 0, 0.22));
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
}

.tool-exp-chat-notice-card-tree {
  border-color: rgba(63, 185, 80, 0.45);
  background: linear-gradient(165deg, rgba(63, 185, 80, 0.12), rgba(0, 0, 0, 0.2));
}

.tool-exp-chat-notice-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.02em;
}

.tool-exp-chat-notice-body {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--text-muted);
}

.tool-exp-chat-notice-meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.45rem 0.5rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tool-exp-chat-notice-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.65rem;
  font-size: 0.78rem;
  line-height: 1.4;
}

.tool-exp-chat-notice-meta-row-sub {
  opacity: 0.92;
  padding-top: 0.15rem;
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
  margin-top: 0.1rem;
}

.tool-exp-chat-notice-meta-k {
  flex: 0 0 6.5rem;
  color: var(--text-muted);
  font-weight: 500;
}

.tool-exp-chat-notice-meta-v {
  flex: 1;
  min-width: 0;
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.76rem;
  word-break: break-all;
}

.tool-exp-chat-notice-btn {
  align-self: flex-end;
  margin-top: 0.15rem;
  padding: 0.35rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #0f1419;
  background: var(--accent);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: filter 0.2s, transform 0.15s;
}

.tool-exp-chat-notice-btn:hover {
  filter: brightness(1.08);
}

.tool-exp-chat-notice-btn:active {
  transform: scale(0.98);
}

.tool-exp-chat-notice-card-tree .tool-exp-chat-notice-btn {
  background: var(--success, #3fb950);
  color: #0d1117;
}

.tool-exp-workspace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
}

.tool-exp-workspace-head .tool-exp-workspace-title {
  margin: 0;
}

.tool-exp-workspace-head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.tool-exp-workspace-backup-btn {
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border, #2d3a4d);
  border-radius: 6px;
  cursor: pointer;
}

.tool-exp-workspace-backup-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent, #58a6ff);
  color: var(--accent, #58a6ff);
}

.tool-exp-workspace-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.tool-exp-workspace-backup-tip {
  margin: -0.35rem 0 0.65rem;
  font-size: 0.8rem;
  line-height: 1.45;
}

.tool-exp-workspace-backup-tip-ok {
  color: var(--success, #3fb950);
}

.tool-exp-workspace-backup-tip-err {
  color: var(--error, #f85149);
}
</style>
