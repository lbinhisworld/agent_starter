<!--
  [INPUT]: legacy `frontend/index.html` 首页壳层 + `src/home/problem-follow-home.ts` + storage 全局 API
  [OUTPUT]: 与 legacy 同 id/class 的首页影子 DOM（不含 ProblemDetail）
  [POS]: Vue 首页影子页根组件

  [PROTOCOL]: DOM 结构变更须对齐 `frontend/index.html` 与 `main.js` 中 `renderProblemFollowList` 模板；须监听 `storageBackendReady` / `storageIndexedDbReady` 与 `main.js` 同源，避免 online/IDB 异步回填后列表仍为空。`loadList()` 必须用新数组 + 项浅拷贝（见 FE-20260406-home），禁止 `rawList = getDigitalProblems()` 直接引用缓存。`getRenderableProblemFollowList` 按 `createdAt`/`updatedAt` **新→旧** 排序；高亮仅影响卡片样式，不调整顺序。FE-20260408：顶栏补「模型配置」永久入口，需与主站 `index.html` / `main.js` 使用同一 `model-config.html?redirect=...` 口径。FE-20260409：档案编号读 `archiveNo`/`archive_no`（与 `storage-http-adapter` 粘滞兜底一致）。FE-20260422：案例列表工具栏右侧「工具经验」→ `tool-experience.html`（Vue 独立入口，见 `src/tool-experience/`）。FE-20260428：客户档案卡「设计」→ `design-detail.html?caseId=&customerName=&archiveNo=`（`src/design-detail/`）。
  验收前：`HomePage.vue` 为整页主实现，不主动拆 `ProblemFollowCard.vue` 等展示子组件；仅允许抽离 bridge/helper、caseKey/highlight、API、import-export 等（见 `docs/design/home-shadow-migration-map.md`「验收前收口」）。
  若抽 `.ts` 或极薄子组件：须工程层拆分、DOM 零漂移；回报含工程拆分清单、各拆分是否改 DOM、固定句「本拆分为工程层拆分，非语义层重构」。
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import {
  formatProblemDateTime,
  getProblemFollowCardStageLabel,
  getProblemFollowCaseKey,
  getProblemFollowHighlightedCaseKey,
  getRenderableProblemFollowList,
  PROBLEM_FOLLOW_CARD_ICONS,
  setProblemFollowHighlightedCaseKey,
} from './problem-follow-home';

declare global {
  interface Window {
    APP_CONFIG?: { MODE?: string; BACKEND_API_URL?: string };
    escapeHtml?: (s: string) => string;
    getDigitalProblems?: () => unknown[];
    saveDigitalProblem?: (item: Record<string, unknown>) => void;
    removeDigitalProblem?: (index: number) => void;
    getProblemDetailChats?: () => Record<string, unknown[]>;
    saveProblemDetailChat?: (key: string, msgs: unknown[]) => void;
    getTaskTrackingData?: () => Record<string, unknown>;
    saveTaskTrackingData?: (key: string, data: unknown) => void;
    buildCaseRequirementHeadlineParts?: (item: Record<string, unknown>) => {
      requirementTitle?: string;
    } | null;
    SmartCto?: {
      problemCaseApi?: {
        getBackendBaseUrl?: () => string;
        refreshProblemDetailBundle?: (caseId: string) => Promise<{
          item?: Record<string, unknown> | null;
          messages?: unknown[];
          taskSummaries?: unknown[];
        } | null>;
        postProblemCaseImport: (pkg: unknown) => Promise<{
          ok: boolean;
          data?: unknown;
          errorMessage?: string;
          status?: number;
        }>;
        extractImportedProblemCaseId: (data: unknown) => string;
        fetchProblemCaseDetail: (baseUrl: string, caseId: string) => Promise<Record<string, unknown>>;
      };
    };
    AUTH_RUNTIME?: {
      getCurrentRole?: () => string;
      clearAuth?: () => void;
      buildModelConfigUrl?: (redirect?: string) => string;
    };
    getUsername?: () => string;
    postLogoutToBackend?: () => Promise<boolean>;
    clearAuth?: () => void;
    STORAGE_HTTP_ADAPTER?: { clearProblemDetailCaches?: () => void; upsertCaseFromDetailPayload?: (item: unknown) => void; reloadCachesFromBackend?: () => Promise<void> };
    showError?: (msg: string) => void;
  }
}

const digitalProblemInput = ref('');
const parsePreviewHidden = ref(true);
const parseBusy = ref(false);
const problemCaseImportInput = ref<HTMLInputElement | null>(null);

const rawList = ref<Record<string, unknown>[]>([]);

const isOnline = () =>
  !!(window.APP_CONFIG && String(window.APP_CONFIG.MODE || '').toLowerCase() === 'online');

const escapeH = (s: string) => (typeof window.escapeHtml === 'function' ? window.escapeHtml(s) : s);

/**
 * 从全局 store 读取后生成**新数组 + 每项浅拷贝**再赋给 `rawList`。
 * FE-20260406-home：online `problemCasesCache` 被 `saveDigitalProblem`/`removeDigitalProblem` 原地 mutate；
 * 若写 `rawList.value = g` 与缓存同引用，Vue 不触发更新。禁止改回直接赋值。
 */
const loadList = () => {
  const g = typeof window.getDigitalProblems === 'function' ? window.getDigitalProblems() : [];
  if (!Array.isArray(g)) {
    rawList.value = [];
    return;
  }
  const snapshot = (g as Record<string, unknown>[]).map((it) =>
    it !== null && typeof it === 'object' ? { ...it } : ({} as Record<string, unknown>),
  );
  rawList.value = snapshot;
};

const displayList = computed(() => {
  const list = rawList.value.slice();
  return getRenderableProblemFollowList(list);
});

const problemFollowCountText = computed(() => {
  const n = rawList.value.length;
  return `共有 ${n} 个客户档案`;
});

const isAdmin = computed(() => {
  try {
    const r = window.AUTH_RUNTIME?.getCurrentRole?.() || '';
    return String(r).toLowerCase() === 'admin';
  } catch {
    return false;
  }
});

const navUserInfo = computed(() => {
  const u = typeof window.getUsername === 'function' ? window.getUsername() : '';
  return u ? `用户：${u}` : '';
});

const cardIcons = computed(() => PROBLEM_FOLLOW_CARD_ICONS);

const cards = computed(() => {
  return displayList.value.map((item, index) => {
    const caseKey = getProblemFollowCaseKey(item);
    const customerName = String(item.customerName ?? item.customer_name ?? '').trim() || '未命名';
    const createdByStr = item.createdBy == null ? '' : String(item.createdBy);
    const createdByRow = isAdmin.value
      ? `<div class="problem-follow-card-date">创建用户：${escapeH(createdByStr)}</div>`
      : '';
    const dateTimeStr = formatProblemDateTime(item.createdAt);
    const archiveNoNum = Number(item.archiveNo ?? item.archive_no);
    const archiveLabel = (() => {
      if (Number.isFinite(archiveNoNum) && archiveNoNum > 0) {
        return `档案编号 ${String(Math.floor(archiveNoNum)).padStart(4, '0')}`;
      }
      return '档案编号 —';
    })();
    const gradientClass = index % 2 === 0 ? 'problem-follow-card-accent-a' : 'problem-follow-card-accent-b';
    const hk = getProblemFollowHighlightedCaseKey();
    const isHighlighted = !!(caseKey && caseKey === hk);
    const stageLabel = getProblemFollowCardStageLabel(item);
    const reqParts =
      typeof window.buildCaseRequirementHeadlineParts === 'function'
        ? window.buildCaseRequirementHeadlineParts(item)
        : null;
    const requirementTitleOnly =
      reqParts && reqParts.requirementTitle ? String(reqParts.requirementTitle) : '';
    return {
      caseKey,
      customerName,
      createdByRow,
      dateTimeStr,
      archiveLabel,
      gradientClass,
      isHighlighted,
      stageLabel,
      requirementTitleOnly,
      index,
    };
  });
});

const onParseClick = async () => {
  const text = digitalProblemInput.value.trim();
  if (!text) {
    alert('请输入企业名称');
    return;
  }
  parseBusy.value = true;
  parsePreviewHidden.value = true;
  try {
    const item = {
      customerName: text,
      requirementDetail: '',
      requirementDetailHistory: [],
    };
    if (typeof window.saveDigitalProblem === 'function') window.saveDigitalProblem(item);
    digitalProblemInput.value = '';
    loadList();
    await nextTick();
    const first = document.querySelector('#problemFollowListContent .problem-follow-card');
    if (first) {
      first.classList.add('problem-follow-card-enter');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => first.classList.add('problem-follow-card-enter-active'));
      });
      setTimeout(() => {
        first.classList.remove('problem-follow-card-enter', 'problem-follow-card-enter-active');
      }, 500);
    }
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    alert(m);
  } finally {
    parseBusy.value = false;
  }
};

const findIndexByCaseKey = (caseKey: string) => {
  const list = typeof window.getDigitalProblems === 'function' ? window.getDigitalProblems() : [];
  if (!Array.isArray(list)) return -1;
  return list.findIndex(
    (it: unknown) => getProblemFollowCaseKey(it as Record<string, unknown>) === caseKey,
  );
};

const findItemByCaseKey = (caseKey: string) => {
  const list = typeof window.getDigitalProblems === 'function' ? window.getDigitalProblems() : [];
  if (!Array.isArray(list)) return null;
  const it = list.find(
    (x: unknown) => getProblemFollowCaseKey(x as Record<string, unknown>) === caseKey,
  );
  return (it as Record<string, unknown>) || null;
};

const loadChatsForCaseCopy = async (item: Record<string, unknown>) => {
  const sourceChatKey = getProblemFollowCaseKey(item);
  const sourceCreatedAt = item.createdAt;
  const readCached = () => {
    const chats = typeof window.getProblemDetailChats === 'function' ? window.getProblemDetailChats() : {};
    if (Array.isArray(chats?.[sourceChatKey])) return chats[sourceChatKey] as unknown[];
    if (sourceCreatedAt != null && Array.isArray(chats?.[String(sourceCreatedAt)])) {
      return chats[String(sourceCreatedAt)] as unknown[];
    }
    return [];
  };

  const cached = readCached();
  if (cached.length > 0 || !isOnline()) {
    return { ok: true as const, chats: cached, sourceChatKey, sourceCreatedAt };
  }

  const caseId = item.id ?? item.createdAt;
  if (caseId == null) {
    return { ok: true as const, chats: cached, sourceChatKey, sourceCreatedAt };
  }

  try {
    await window.SmartCto?.problemCaseApi?.refreshProblemDetailBundle?.(String(caseId));
    return { ok: true as const, chats: readCached(), sourceChatKey, sourceCreatedAt };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false as const,
      chats: [] as unknown[],
      sourceChatKey,
      sourceCreatedAt,
      errorMessage: message,
    };
  }
};

const onListClick = async (e: MouseEvent) => {
  const t = e.target as HTMLElement;
  const delBtn = t.closest?.('.btn-problem-follow-delete') as HTMLElement | null;
  if (delBtn) {
    e.stopPropagation();
    const caseKey = delBtn.getAttribute('data-case-key') || '';
    if (!caseKey) return;
    const item = findItemByCaseKey(caseKey);
    const name = String(item?.customerName ?? item?.customer_name ?? '').trim() || '该客户';
    if (!confirm(`确定删除「${name}」吗？此操作不可恢复。`)) return;
    const index = findIndexByCaseKey(caseKey);
    if (index < 0) return;
    if (getProblemFollowHighlightedCaseKey() === caseKey) {
      setProblemFollowHighlightedCaseKey('');
    }
    if (typeof window.removeDigitalProblem === 'function') window.removeDigitalProblem(index);
    loadList();
    return;
  }
  const copyBtn = t.closest?.('.btn-problem-follow-copy') as HTMLElement | null;
  if (copyBtn) {
    e.stopPropagation();
    const caseKey = copyBtn.getAttribute('data-case-key') || '';
    const item = findItemByCaseKey(caseKey);
    if (!item) return;
    const sourceBundle = await loadChatsForCaseCopy(item);
    if (!sourceBundle.ok) {
      (window.showError || alert)(`复制失败：无法读取源案例消息：${sourceBundle.errorMessage}`);
      return;
    }
    const { sourceChatKey, sourceCreatedAt } = sourceBundle;
    const copyItem = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
    delete copyItem.createdAt;
    delete copyItem.archiveNo;
    delete copyItem.id;
    const baseName = String(copyItem.customerName ?? copyItem.customer_name ?? '').trim() || '未命名';
    const suffix = ' (copy)';
    copyItem.customerName = baseName + suffix;
    if (copyItem.customer_name != null) copyItem.customer_name = baseName + suffix;
    if (typeof window.saveDigitalProblem === 'function') window.saveDigitalProblem(copyItem);
    const listAfter =
      typeof window.getDigitalProblems === 'function' ? window.getDigitalProblems() : [];
    const newItem = Array.isArray(listAfter) ? (listAfter[0] as Record<string, unknown>) : null;
    const newChatKey = newItem ? getProblemFollowCaseKey(newItem) : '';
    if (
      newChatKey &&
      typeof window.getProblemDetailChats === 'function' &&
      typeof window.saveProblemDetailChat === 'function'
    ) {
      const sourceChats = sourceBundle.chats;
      if (Array.isArray(sourceChats) && sourceChats.length > 0) {
        window.saveProblemDetailChat(newChatKey, sourceChats.slice() as unknown[]);
      }
    }
    if (
      newItem?.createdAt &&
      typeof window.getTaskTrackingData === 'function' &&
      typeof window.saveTaskTrackingData === 'function'
    ) {
      const tracking = window.getTaskTrackingData();
      const sourceTracking =
        tracking?.[sourceChatKey] ??
        (sourceCreatedAt != null ? tracking?.[String(sourceCreatedAt)] : undefined);
      if (sourceTracking) {
        window.saveTaskTrackingData(
          newItem.createdAt as string,
          JSON.parse(JSON.stringify(sourceTracking)),
        );
      }
    }
    loadList();
    return;
  }
  const designBtn = t.closest?.('.btn-problem-follow-design') as HTMLElement | null;
  if (designBtn) {
    e.stopPropagation();
    const ck = designBtn.getAttribute('data-case-key') || '';
    const row = findItemByCaseKey(ck);
    if (!row) return;
    const cid = row.id ?? row.createdAt;
    if (cid == null) {
      (window.showError || alert)('无法打开设计页：案例标识缺失。');
      return;
    }
    const u = new URL('design-detail.html', window.location.href);
    u.searchParams.set('caseId', String(cid));
    const cn = String(row.customerName ?? row.customer_name ?? '').trim();
    if (cn) u.searchParams.set('customerName', cn);
    const an = row.archiveNo ?? row.archive_no;
    if (an != null && String(an).trim() !== '') u.searchParams.set('archiveNo', String(an));
    window.location.href = u.pathname + u.search;
    return;
  }
};

const onImportClick = () => {
  if (!isOnline()) {
    (window.showError || alert)('导入/导出仅支持 online 模式（需配置 BACKEND_API_URL 并登录）。');
    return;
  }
  problemCaseImportInput.value?.click();
};

const finalizeImport = async (baseUrl: string, newId: string, data: unknown) => {
  const api = window.SmartCto?.problemCaseApi;
  const adapter = window.STORAGE_HTTP_ADAPTER;
  if (!api?.fetchProblemCaseDetail) return;
  let item: Record<string, unknown>;
  try {
    item = (await api.fetchProblemCaseDetail(baseUrl, newId)) as Record<string, unknown>;
  } catch (err: unknown) {
    (window.showError || alert)(err instanceof Error ? err.message : String(err));
    return;
  }
  if (adapter && typeof adapter.upsertCaseFromDetailPayload === 'function') {
    adapter.upsertCaseFromDetailPayload(item);
  }
  setProblemFollowHighlightedCaseKey(getProblemFollowCaseKey(item) || newId);
  loadList();
  if (adapter && typeof adapter.reloadCachesFromBackend === 'function') {
    void adapter.reloadCachesFromBackend().catch(() => {});
  }
  const d = data as { importedMessageCount?: number; schemaVersion?: unknown };
  const nMsg = typeof d?.importedMessageCount === 'number' ? d.importedMessageCount : null;
  const ver = d?.schemaVersion != null ? String(d.schemaVersion) : null;
  const tip = [
    '已导入为新案例，正在打开详情…',
    nMsg != null ? `消息 ${nMsg} 条` : null,
    ver != null ? `schema ${ver}` : null,
  ]
    .filter(Boolean)
    .join('；');
  alert(tip);
  window.location.href = `index.html?caseId=${encodeURIComponent(String(newId))}`;
};

const onImportFile = async (ev: Event) => {
  const el = ev.target as HTMLInputElement;
  const file = el.files?.[0];
  el.value = '';
  if (!file) return;
  if (!isOnline()) {
    (window.showError || alert)('导入/导出仅支持 online 模式（需配置 BACKEND_API_URL 并登录）。');
    return;
  }
  const api = window.SmartCto?.problemCaseApi;
  const baseUrl =
    window.SmartCto?.problemCaseApi?.getBackendBaseUrl?.() ||
    String(window.APP_CONFIG?.BACKEND_API_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    (window.showError || alert)('未配置 BACKEND_API_URL。');
    return;
  }
  let text: string;
  try {
    text = await file.text();
  } catch (e: unknown) {
    (window.showError || alert)(`导入失败：无法读取文件：${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e: unknown) {
    (window.showError || alert)(`导入失败：文件不是合法 JSON：${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  if (!api?.postProblemCaseImport || !api.extractImportedProblemCaseId) return;
  try {
    const apiResult = await api.postProblemCaseImport(parsed);
    if (!apiResult.ok) {
      if (apiResult.errorMessage) (window.showError || alert)(`导入失败：${apiResult.errorMessage}`);
      return;
    }
    const newId = api.extractImportedProblemCaseId(apiResult.data);
    if (!newId) {
      (window.showError || alert)('导入成功但未返回 caseId，请与后端确认响应 JSON（需含 caseId）。');
      return;
    }
    await finalizeImport(baseUrl, newId, apiResult.data);
  } catch (e: unknown) {
    (window.showError || alert)(`导入失败：${e instanceof Error ? e.message : String(e)}`);
  }
};

const importDisabled = ref(true);

const onCasesChanged = () => {
  loadList();
};

/** 与 `main.js` `storageBackendReady` / `storageIndexedDbReady` 对齐：online 异步拉取、local+IDB 回填后再读 `getDigitalProblems()` */
const onStorageHydrationReady = () => {
  loadList();
};

onMounted(() => {
  if (typeof window.showError !== 'function') {
    window.showError = (msg: string) => {
      alert(msg);
    };
  }
  loadList();
  importDisabled.value = !isOnline();
  window.addEventListener('problemCasesChanged', onCasesChanged);
  window.addEventListener('storageBackendReady', onStorageHydrationReady);
  window.addEventListener('storageIndexedDbReady', onStorageHydrationReady);
});

onUnmounted(() => {
  window.removeEventListener('problemCasesChanged', onCasesChanged);
  window.removeEventListener('storageBackendReady', onStorageHydrationReady);
  window.removeEventListener('storageIndexedDbReady', onStorageHydrationReady);
});

const onLogout = async () => {
  try {
    if (typeof window.postLogoutToBackend === 'function') await window.postLogoutToBackend();
  } catch (_) {}
  try {
    const mode = window.APP_CONFIG && window.APP_CONFIG.MODE ? window.APP_CONFIG.MODE : '';
    if (String(mode) === 'online') {
      const ad = window.STORAGE_HTTP_ADAPTER;
      if (ad && typeof ad.clearProblemDetailCaches === 'function') ad.clearProblemDetailCaches();
    }
  } catch (_) {}
  try {
    setProblemFollowHighlightedCaseKey('');
  } catch (_) {}
  try {
    const rk = (window as unknown as { ROUTE_STORAGE_KEY?: string }).ROUTE_STORAGE_KEY;
    if (rk) sessionStorage.removeItem(rk);
  } catch (_) {}
  try {
    window.AUTH_RUNTIME?.clearAuth?.();
  } catch (_) {}
  window.location.href = 'login.html';
};

const goMainHome = () => {
  window.location.href = 'home.html';
};

const goModelConfig = () => {
  const redirect = window.location.pathname + window.location.search + window.location.hash;
  const next =
    window.AUTH_RUNTIME?.buildModelConfigUrl?.(redirect) ||
    `model-config.html?redirect=${encodeURIComponent(redirect)}`;
  window.location.href = next;
};

const goToolDetail = () => {
  window.location.href = 'tool-detail.html';
};

const goToolExperience = () => {
  window.location.href = 'tool-experience.html';
};
</script>

<template>
  <div class="app">
    <nav id="topNav" class="top-nav">
      <button type="button" id="btnHome" class="btn-nav" @click="goMainHome">首页</button>
      <span id="navDetailLabel" class="btn-nav btn-nav-active" hidden>企业详情</span>
      <div class="top-nav-right">
        <span id="navUserInfo" class="nav-user-info">{{ navUserInfo }}</span>
        <button type="button" id="btnModelConfig" class="btn-nav" @click="goModelConfig">模型配置</button>
        <button type="button" id="btnLogout" class="btn-nav btn-logout" @click="onLogout">退出登录</button>
      </div>
    </nav>

    <div id="homeView" class="view home-intake-view">
      <div class="home-intake-center">
        <h1 class="home-intake-title">
          <span class="home-intake-title-brand">&lt;七巧 Creator:/&gt;</span>
          <span class="home-intake-title-main">请输入企业名称，创建客户档案后在详情页完成 task1</span>
        </h1>
        <div class="home-intake-row">
          <div class="home-intake-input-wrap">
            <textarea
              id="digitalProblemInput"
              v-model="digitalProblemInput"
              class="home-intake-input"
              placeholder="请输入企业名称"
              rows="3"
            />
            <div class="home-intake-parse-footer">
              <button
                id="btnParse"
                type="button"
                class="btn-parse"
                :disabled="parseBusy"
                @click="onParseClick"
              >
                {{ parseBusy ? '创建中…' : '开始' }}
              </button>
            </div>
          </div>
        </div>
        <div
          id="parsePreview"
          class="parse-preview"
          :hidden="parsePreviewHidden"
          :aria-hidden="parsePreviewHidden ? 'true' : 'false'"
        >
          <div class="parse-preview-header">
            <h3 class="parse-preview-title">解析预览</h3>
          </div>
          <dl id="parsePreviewContent" class="parse-preview-grid" />
        </div>
        <section id="problemFollowListSection" class="problem-follow-section">
          <div class="problem-follow-toolbar">
            <p id="problemFollowCount" class="problem-follow-count">{{ problemFollowCountText }}</p>
            <div class="problem-follow-toolbar-actions">
              <button
                id="btnToolSuite"
                type="button"
                class="btn-tool-suite"
                title="打开工具详情页（左对话 + 右工作画布）"
                @click="goToolDetail"
              >
                工具集
              </button>
              <button
                id="btnToolExperience"
                type="button"
                class="btn-tool-experience"
                title="多产品能力画像提炼（独立页）"
                @click="goToolExperience"
              >
                工具经验
              </button>
              <button
                id="btnProblemCaseImport"
                type="button"
                class="btn-problem-case-import"
                title="从 JSON 案例包导入为新案例"
                :disabled="importDisabled"
                @click="onImportClick"
              >
                导入
              </button>
            </div>
          </div>
          <input
            id="problemCaseImportInput"
            ref="problemCaseImportInput"
            type="file"
            accept=".json,application/json"
            hidden
            aria-hidden="true"
            @change="onImportFile"
          />
          <div id="problemFollowListContent" class="problem-follow-list" @click="onListClick">
            <p v-if="rawList.length === 0" class="problem-follow-empty">暂无案例</p>
            <div
              v-for="c in cards"
              v-else
              :key="c.caseKey"
              class="problem-follow-card"
              :class="{ 'problem-follow-card-highlight': c.isHighlighted }"
              :data-case-key="c.caseKey"
            >
              <div :class="['problem-follow-card-accent', c.gradientClass]" />
              <div class="problem-follow-card-body">
                <div class="problem-follow-card-archive-no" title="系统自动分配的档案编号">
                  {{ c.archiveLabel }}
                </div>
                <div class="problem-follow-card-title">{{ c.customerName }}</div>
                <div
                  class="problem-follow-card-requirement-title"
                  :title="c.requirementTitleOnly"
                >
                  {{ c.requirementTitleOnly }}
                </div>
                <div class="problem-follow-card-task-row" title="当前任务阶段">
                  <span class="problem-follow-card-task-badge">当前任务</span>
                  <span class="problem-follow-card-task-text">{{ c.stageLabel }}</span>
                </div>
                <div v-if="isAdmin" v-html="c.createdByRow" />
                <div class="problem-follow-card-date">时间 {{ c.dateTimeStr }}</div>
                <div class="problem-follow-card-actions">
                  <button
                    type="button"
                    class="btn-problem-follow-design"
                    :data-case-key="c.caseKey"
                    title="亮色设计工作区（独立页）"
                  >
                    设计
                  </button>
                  <button
                    type="button"
                    class="btn-problem-follow-copy"
                    :data-case-key="c.caseKey"
                    aria-label="复制"
                    v-html="cardIcons.copy"
                  />
                  <button
                    type="button"
                    class="btn-problem-follow-delete"
                    :data-case-key="c.caseKey"
                    aria-label="删除"
                    v-html="cardIcons.delete"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
:global(body) {
  background: #f1f5f9;
  color: #0f172a;
}

.app {
  --bg: #f1f5f9;
  --surface: #ffffff;
  --surface-elevated: #ffffff;
  --border: #dbe3ef;
  --text: #0f172a;
  --text-muted: #64748b;
  --accent: #2563eb;
  --accent-dim: #dbeafe;
  --success: #0f766e;
  --error: #dc2626;
}

.btn-nav,
.btn-tool-suite,
.btn-tool-experience,
.btn-problem-case-import {
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.btn-nav:hover,
.btn-tool-suite:hover,
.btn-tool-experience:hover,
.btn-problem-case-import:hover {
  color: var(--accent);
  background: #eff6ff;
  border-color: var(--accent);
}

.btn-nav-active,
.btn-nav-active:hover {
  color: var(--accent);
  background: #eff6ff;
}

.btn-logout {
  color: var(--error);
  border-color: #fecaca;
}

.btn-logout:hover {
  color: var(--error);
  background: #fef2f2;
  border-color: #fca5a5;
}

.home-intake-title-brand,
.btn-parse,
.btn-problem-follow-start {
  background: var(--accent);
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.24);
}

.home-intake-input-wrap,
.problem-follow-card {
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.home-intake-input-wrap:focus-within {
  box-shadow:
    0 0 0 1px rgba(37, 99, 235, 0.16),
    0 8px 18px rgba(37, 99, 235, 0.08);
}

.problem-follow-card:hover {
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.1);
}

.problem-follow-card-accent-a {
  background: linear-gradient(90deg, #2563eb, #60a5fa);
}

.problem-follow-card-accent-b {
  background: linear-gradient(90deg, #0f766e, #5eead4);
}

.problem-follow-card-task-badge {
  background: var(--accent);
}

.problem-follow-card-actions .btn-problem-follow-design {
  background: #eff6ff;
}

.problem-follow-card-actions .btn-problem-follow-design:hover {
  color: #fff;
  background: var(--accent);
}
</style>
