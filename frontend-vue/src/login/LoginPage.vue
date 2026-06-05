<template>
  <div class="auth-page auth-page--gold">
    <div class="auth-card auth-card--gold">
      <h2 style="margin:0 0 1rem;">Smart CTO 用户登录</h2>
      <p style="margin:0 0 1rem;color:var(--text-muted);">{{ modeText }}</p>

      <form @submit.prevent="onSubmit" style="display:flex;flex-direction:column;gap:0.75rem;">
        <label style="display:flex;flex-direction:column;gap:0.4rem;">
          <span>用户名</span>
          <input
            v-model="username"
            type="text"
            required
            style="padding:0.75rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);"
          />
        </label>
        <label style="display:flex;flex-direction:column;gap:0.4rem;">
          <span>密码</span>
          <input
            v-model="password"
            type="password"
            required
            style="padding:0.75rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);"
          />
        </label>

        <div style="display:flex;gap:0.75rem;align-items:center;margin-top:0.5rem;">
          <button
            type="submit"
            style="padding:0.7rem 1rem;border-radius:10px;border:1px solid transparent;background:var(--accent);color:#0a0a0a;cursor:pointer;width: 100%;"
            :disabled="loading"
          >
            {{ loading ? '登录中…' : '登录' }}
          </button>
        </div>
      </form>

      <div style="margin-top:1rem;color:var(--error);min-height:1.2em;" v-if="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * [INPUT]: `src/api/client.ts`、`src/stores/auth.ts`、`login.html` query `redirect`
 * [OUTPUT]: 登录页；online 成功后按当前用户 AI 配置状态决定去业务页还是 `model-config.html`
 * [POS]: Vue 登录入口根组件
 *
 * [PROTOCOL]: 变更登录首跳门禁时，需同步更新 `frontend/js/auth-runtime.js` 的业务页二次门禁与 `frontend-vue/AGENTS.md`
 */
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { backendApi, buildModelConfigUrl, isMyAiConfigGatePassed } from '../api/client';

const auth = useAuthStore();

// local 模式仅用于联调/占位：不做后端校验；用户名/密码由用户手动输入
const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const mode = ref<'local' | 'online'>('local');

const modeText = computed(() => (mode.value === 'online' ? '在线模式：使用后端账号密码登录' : '本地模式：默认可用 root/root（仅用于联调）'));

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

function getRedirect() {
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

onMounted(async () => {
  auth.initFromStorage();
  await waitForAppConfig();
  const m = backendApi.getMode();
  mode.value = (m === 'online' ? 'online' : 'local') as any;
});

async function onSubmit() {
  error.value = '';
  const u = String(username.value || '').trim();
  const p = String(password.value || '');
  if (!u || !p) return;
  const redirectTarget = getRedirect();

  loading.value = true;
  try {
    if (mode.value !== 'online') {
      // local：不与后端挂钩，直接签发一个“用户”会话以放通前端链路
      auth.signIn({ token: 'local_' + Date.now(), role: 'user', username: u });
      location.replace(redirectTarget);
      return;
    }

    const data = await backendApi.login({ username: u, password: p });
    const token = data.token;
    const role = (data.user?.role || 'user') as 'admin' | 'user';
    if (!token) throw new Error('登录成功但未收到 token');

    auth.signIn({ token, role, username: u });
    if (role !== 'admin') {
      const status = await backendApi.getMyAiConfigStatus();
      if (!isMyAiConfigGatePassed(status)) {
        location.replace(buildModelConfigUrl(redirectTarget));
        return;
      }
    }

    location.replace(redirectTarget);
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-page--gold {
  position: fixed;
  inset: 0;
  overflow: auto;
  /* 全屏背景 + 表单居中 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  /* 参考 test.html：更亮的金色 + 深色科技底 + 毛玻璃卡片 */
  background-color: #080a0f; /* test.html: --bg-color */
  --accent: #e6b325;
  --accent-dim: rgba(230, 179, 37, 0.34);
  --border: rgba(230, 179, 37, 0.38);
  --surface: rgba(0, 0, 0, 0.22);
  --surface-elevated: rgba(255, 255, 255, 0.05);
  --text: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.62);
  min-height: 100vh;
}

.auth-page--gold::before {
  content: '';
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.2;
  z-index: 0;
  background-color: #e6b325;
  top: 10%;
  left: 10%;
  pointer-events: none;
}

.auth-page--gold::after {
  content: '';
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.2;
  z-index: 0;
  background-color: #7b2cbf; /* test.html purple glow */
  bottom: 10%;
  right: 10%;
  pointer-events: none;
}

.auth-card--gold {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 520px;
  padding: 2.2rem 2.0rem;

  /* 避免 Chromium 下 backdrop-filter + fixed 祖先导致的「首屏不绘制、改窗口/DevTools 才显示」合成层问题 */
  background-color: rgba(8, 10, 15, 0.82);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);

  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.auth-card--gold:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.65);
}

.auth-page--gold > * {
  position: relative;
  z-index: 1;
}

.auth-page--gold h2 {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 0.25rem;
}

.auth-page--gold input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 12px rgba(230, 179, 37, 0.5);
}

.auth-page--gold button {
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}

.auth-page--gold button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
  filter: brightness(1.03);
}

.auth-page--gold a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
