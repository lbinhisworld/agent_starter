<!--
  [INPUT]: `src/api/client.ts`、`src/stores/auth.ts`、`model-config.html` query `redirect`
  [OUTPUT]: 当前登录用户的个人模型配置页（保存并验证 / 退出登录）
  [POS]: 首次登录门禁与后续手动访问共用的最小模型配置页面

  [PROTOCOL]: 不得把用户明文 Key 写入 localStorage/sessionStorage；登录首跳与业务页二次门禁都必须回到这一页，变更时同步更新 `frontend/js/auth-runtime.js` 与 `frontend-vue/AGENTS.md`
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  backendApi,
  isMyAiConfigGatePassed,
  type MyAiConfigStatus,
} from '../api/client';
import { useAuthStore } from '../stores/auth';

declare global {
  interface Window {
    APP_CONFIG?: { MODE?: string };
    AUTH_RUNTIME?: { clearAuth?: () => void };
    postLogoutToBackend?: () => Promise<boolean>;
  }
}

const auth = useAuthStore();

const mode = ref<'local' | 'online'>('local');
const loading = ref(true);
const submitting = ref(false);
const error = ref('');
const statusText = ref('');

const apiKey = ref('');
const apiUrl = ref('');
const model = ref('');

const isOnline = computed(() => mode.value === 'online');

const gateHint = computed(() => {
  if (!isOnline.value) {
    return '当前为 local 模式，本页不参与在线模型门禁。';
  }
  return '请先为当前登录账号填写并验证 DeepSeek Key。明文 Key 只保留在本次页面输入中，不会写入浏览器持久存储。';
});

async function waitForAppConfig(timeoutMs = 3000) {
  const start = Date.now();
  return new Promise<void>((resolve) => {
    const tick = () => {
      const cfg = (window as any).APP_CONFIG;
      if (cfg && typeof cfg.MODE !== 'undefined') return resolve();
      if (Date.now() - start > timeoutMs) return resolve();
      setTimeout(tick, 50);
    };
    tick();
  });
}

function getRedirectTarget() {
  try {
    const url = new URL(location.href);
    const raw = url.searchParams.get('redirect') || '';
    if (!raw) return 'home.html';
    const target = new URL(raw, location.href);
    const pathname = String(target.pathname || '').replace(/\/+$/, '');
    if (/\/(?:login|model-config|admin)(?:\.html)?$/i.test(pathname)) {
      return 'home.html';
    }
    return target.pathname + target.search + target.hash;
  } catch {
    return 'home.html';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(value);
  }
}

function applyStatus(status: MyAiConfigStatus | null | undefined) {
  if (!status || typeof status !== 'object') {
    statusText.value = '当前账号尚未完成模型配置。';
    return;
  }

  apiUrl.value = status.apiUrl ? String(status.apiUrl) : '';
  model.value = status.model ? String(status.model) : '';

  if (isMyAiConfigGatePassed(status)) {
    const verifiedAtText = formatDateTime(status.verifiedAt);
    statusText.value = verifiedAtText
      ? `当前账号已完成验证，上次验证时间：${verifiedAtText}`
      : '当前账号已完成模型验证。';
    return;
  }

  statusText.value = '当前账号尚未完成模型配置或验证，请先保存并验证后再进入系统。';
}

async function loadStatus() {
  if (!isOnline.value) {
    statusText.value = '当前为 local 模式，无需配置个人模型 Key。';
    return;
  }
  const status = await backendApi.getMyAiConfigStatus();
  applyStatus(status);
}

async function onSubmit() {
  error.value = '';
  if (!isOnline.value) {
    error.value = '当前仅 online 模式支持保存并验证。';
    return;
  }

  const key = String(apiKey.value || '').trim();
  if (!key) {
    error.value = '请先填写 DeepSeek API Key';
    return;
  }

  submitting.value = true;
  try {
    const result = await backendApi.saveMyAiConfig({
      apiKey: key,
      apiUrl: apiUrl.value,
      model: model.value,
    });
    apiKey.value = '';
    applyStatus(result);
    statusText.value = '保存并验证成功，正在进入系统…';
    location.replace(getRedirectTarget());
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    submitting.value = false;
  }
}

async function onLogout() {
  try {
    if (typeof window.postLogoutToBackend === 'function') {
      await window.postLogoutToBackend();
    }
  } catch {
    // ignore
  }

  try {
    auth.signOut();
  } catch {
    // ignore
  }

  try {
    window.AUTH_RUNTIME?.clearAuth?.();
  } catch {
    // ignore
  }

  location.replace('login.html');
}

onMounted(async () => {
  auth.initFromStorage();
  await waitForAppConfig();
  const currentMode = backendApi.getMode();
  mode.value = currentMode === 'online' ? 'online' : 'local';

  if (!auth.token) {
    location.replace('login.html?redirect=' + encodeURIComponent(location.pathname + location.search + location.hash));
    return;
  }

  try {
    await loadStatus();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="auth-page auth-page--gold">
    <div class="auth-card auth-card--gold auth-card--config">
      <h2 style="margin:0 0 0.75rem;">个人模型配置</h2>
      <p style="margin:0 0 1rem;color:var(--text-muted);line-height:1.7;">
        {{ gateHint }}
      </p>

      <div
        v-if="statusText"
        style="margin:0 0 1rem;padding:0.8rem 0.9rem;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-muted);"
      >
        {{ statusText }}
      </div>

      <form @submit.prevent="onSubmit" style="display:flex;flex-direction:column;gap:0.9rem;">
        <label style="display:flex;flex-direction:column;gap:0.4rem;">
          <span>DeepSeek API Key</span>
          <input
            v-model="apiKey"
            type="password"
            autocomplete="off"
            required
            placeholder="sk-..."
            style="padding:0.75rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);"
          />
        </label>

        <details class="config-advanced">
          <summary>高级项</summary>
          <div class="config-advanced-body">
            <label style="display:flex;flex-direction:column;gap:0.4rem;">
              <span>API URL</span>
              <input
                v-model="apiUrl"
                type="url"
                placeholder="https://api.deepseek.com/v1/chat/completions"
                style="padding:0.75rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);"
              />
            </label>

            <label style="display:flex;flex-direction:column;gap:0.4rem;">
              <span>Model</span>
              <input
                v-model="model"
                type="text"
                placeholder="deepseek-chat"
                style="padding:0.75rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);"
              />
            </label>
          </div>
        </details>

        <div v-if="error" style="color:var(--error);min-height:1.2em;">{{ error }}</div>
        <div v-else style="min-height:1.2em;"></div>

        <button
          type="submit"
          style="padding:0.8rem 1rem;border-radius:10px;border:1px solid transparent;background:var(--accent);color:#0a0a0a;cursor:pointer;width:100%;"
          :disabled="loading || submitting"
        >
          {{ submitting ? '保存并验证中…' : '保存并验证' }}
        </button>

        <button
          type="button"
          style="padding:0.75rem 1rem;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;width:100%;"
          :disabled="submitting"
          @click="onLogout"
        >
          退出登录
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-page--gold {
  position: fixed;
  inset: 0;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  background-color: #080a0f;
  --accent: #e6b325;
  --accent-dim: rgba(230, 179, 37, 0.34);
  --border: rgba(230, 179, 37, 0.38);
  --surface: rgba(0, 0, 0, 0.22);
  --text: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.72);
  --error: #ff8a80;
  min-height: 100vh;
}

.auth-page--gold::before,
.auth-page--gold::after {
  content: '';
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.18;
  z-index: 0;
  pointer-events: none;
}

.auth-page--gold::before {
  background-color: #e6b325;
  top: 10%;
  left: 10%;
}

.auth-page--gold::after {
  background-color: #0f766e;
  bottom: 12%;
  right: 8%;
}

.auth-card--gold {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 560px;
  padding: 2.2rem 2rem;
  background-color: rgba(8, 10, 15, 0.84);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);
}

.auth-card--config {
  max-width: 620px;
}

.auth-page--gold input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 12px rgba(230, 179, 37, 0.45);
}

.auth-page--gold button {
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}

.auth-page--gold button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.32);
  filter: brightness(1.03);
}

.config-advanced {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.8rem 0.9rem;
  background: rgba(255, 255, 255, 0.03);
}

.config-advanced summary {
  cursor: pointer;
  color: var(--text);
  user-select: none;
}

.config-advanced-body {
  margin-top: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
</style>
