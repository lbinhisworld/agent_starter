<template>
  <div class="auth-page auth-page--gold">
    <div class="auth-content">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
        <div>
          <h2 style="margin:0;">管理员后台</h2>
          <p style="margin:0.4rem 0 0;color:var(--text-muted);">{{ subTitle }}</p>
        </div>
        <a href="home.html" style="color:var(--text-muted);text-decoration:none;">返回</a>
      </div>

      <div class="auth-card auth-card--gold" style="padding:1rem;border:1px solid var(--border);border-radius:12px;background:var(--surface-elevated);">
      <div v-if="mode !== 'online'" style="color:var(--text-muted);">
        本地模式：不提供管理员后台入口（按上线后流程移除 local 分支）。
      </div>

      <div v-else>
        <div v-if="!authorized" style="color:var(--text-muted);">{{ placeholder }}</div>

        <div v-else>
          <div v-if="createError" style="color:var(--error);margin-bottom:0.75rem;">{{ createError }}</div>

          <div style="display:flex;gap:0.75rem;align-items:flex-end;margin-bottom:1rem;flex-wrap:wrap;">
            <div style="min-width:260px;flex:1;">
              <div style="color:var(--text-muted);margin-bottom:0.4rem;">创建用户</div>
              <input
                v-model="newUsername"
                placeholder="输入用户名"
                style="width:100%;padding:0.65rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);"
              />
            </div>
            <button
              type="button"
              style="padding:0.65rem 1rem;border-radius:10px;border:1px solid transparent;background:var(--accent);color:white;cursor:pointer;"
              @click="onCreateUser"
              :disabled="loadingUsers"
            >
              创建用户
            </button>
            <button
              type="button"
              style="padding:0.65rem 1rem;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;"
              @click="loadUsers"
              :disabled="loadingUsers"
            >
              刷新列表
            </button>
          </div>

          <div style="margin:0 0 1rem;padding:0.75rem;border:1px solid var(--border);border-radius:10px;background:rgba(0,0,0,0.1);">
            <div style="color:var(--text-muted);margin-bottom:0.4rem;">修改 root 管理员密码</div>
            <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
              <input
                v-model="rootPasswordDraft"
                type="password"
                placeholder="新密码（至少 6 位）"
                style="padding:0.5rem 0.65rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);min-width:200px;"
              />
              <button
                type="button"
                style="padding:0.5rem 1rem;border-radius:10px;border:1px solid transparent;background:var(--accent-dim);color:white;cursor:pointer;"
                :disabled="rootPasswordLoading || !rootPasswordDraft || rootPasswordDraft.length < 6"
                @click="updateRootPassword"
              >
                {{ rootPasswordLoading ? '提交中…' : '修改 root 密码' }}
              </button>
              <span v-if="rootPasswordSuccess" style="color:var(--accent);">已保存</span>
            </div>
          </div>

          <div v-if="lastPlainPassword" style="margin:0 0 1rem;color:var(--text-muted);">
            最近生成的明文密码（用于复制/保存）：
            <div style="margin-top:0.35rem;padding:0.65rem;border:1px solid var(--border);border-radius:10px;background:rgba(0,0,0,0.15);color:var(--text);word-break:break-all;">
              {{ lastPlainPassword }}
            </div>
          </div>

          <div v-if="loadingUsers" style="color:var(--text-muted);">加载中…</div>

          <div v-else>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="text-align:left;">
                  <th style="padding:0.6rem;border-bottom:1px solid var(--border);">用户名</th>
                  <th style="padding:0.6rem;border-bottom:1px solid var(--border);">状态</th>
                  <th style="padding:0.6rem;border-bottom:1px solid var(--border);">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in users" :key="u.username">
                  <td style="padding:0.6rem;border-bottom:1px solid rgba(0,0,0,0.1);">{{ u.username }}</td>
                  <td style="padding:0.6rem;border-bottom:1px solid rgba(0,0,0,0.1);">
                    <span
                      style="display:inline-block;padding:0.25rem 0.6rem;border-radius:999px;border:1px solid var(--border);"
                      :style="{ background: u.status === 'ENABLED' ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.12)' }"
                    >
                      {{ u.status === 'ENABLED' ? '启用' : '停用' }}
                    </span>
                  </td>
                  <td style="padding:0.6rem;border-bottom:1px solid rgba(0,0,0,0.1);">
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                      <button
                        type="button"
                        style="padding:0.45rem 0.75rem;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;"
                        @click="toggleUser(u)"
                      >
                        {{ u.status === 'ENABLED' ? '停用' : '启用' }}
                      </button>

                      <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                        <input
                          v-model="passwordDraft[u.username]"
                          placeholder="新密码（手动或随机生成）"
                          type="password"
                          style="padding:0.45rem 0.65rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);min-width:220px;"
                        />
                        <button
                          type="button"
                          style="padding:0.45rem 0.75rem;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;"
                          @click="randomizePassword(u)"
                        >
                          随机生成
                        </button>
                        <button
                          type="button"
                          style="padding:0.45rem 0.75rem;border-radius:10px;border:1px solid transparent;background:var(--accent-dim);color:white;cursor:pointer;"
                          @click="updatePassword(u)"
                        >
                          修改密码
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>

                <tr v-if="users.length === 0">
                  <td colspan="3" style="padding:1rem;color:var(--text-muted);">暂无用户</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="actionError" style="margin-top:0.75rem;color:var(--error);">{{ actionError }}</div>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { backendApi } from '../api/client';
import { useAuthStore } from '../stores/auth';

type UserItem = {
  username: string;
  status: 'ENABLED' | 'DISABLED' | string;
};

const auth = useAuthStore();

const mode = ref<'local' | 'online'>('local');
const subTitle = computed(() => (mode.value === 'online' ? '权限验证与用户维护' : '本地模式不提供管理员后台'));

const authorized = ref(false);
const placeholder = ref('');
const users = ref<UserItem[]>([]);
const loadingUsers = ref(false);
const createError = ref('');
const actionError = ref('');
const newUsername = ref('');

const lastPlainPassword = ref('');

const passwordDraft = reactive<Record<string, string>>({});
const rootPasswordDraft = ref('');
const rootPasswordLoading = ref(false);
const rootPasswordSuccess = ref(false);

function decodeJwtRole(token: string) {
  if (!token) return '';
  const parts = token.split('.');
  if (parts.length < 2) return '';
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const role = json.role || (Array.isArray(json.roles) ? json.roles[0] : '') || '';
    return role;
  } catch {
    return '';
  }
}

function getToken() {
  try {
    return localStorage.getItem('smart_cto_auth_token') || '';
  } catch {
    return '';
  }
}

function generatePassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function setActionError(err: any) {
  actionError.value = err?.message || String(err);
  setTimeout(() => (actionError.value = ''), 4000);
}

async function loadUsers() {
  actionError.value = '';
  loadingUsers.value = true;
  try {
    const data = await backendApi.listUsers();
    const items = Array.isArray(data) ? data : (data as any).items;
    users.value = (items || []).map((x: any) => ({
      username: String(x.username || ''),
      status: (x.status || 'DISABLED') as any,
    })).filter((x: any) => x.username);
  } catch (e: any) {
    setActionError(e);
  } finally {
    loadingUsers.value = false;
  }
}

async function onCreateUser() {
  createError.value = '';
  actionError.value = '';
  lastPlainPassword.value = '';

  const u = String(newUsername.value || '').trim();
  if (!u) {
    createError.value = '请输入用户名';
    return;
  }

  loadingUsers.value = true;
  try {
    const data: any = await backendApi.createUser({ username: u });
    const user = data.user || data.item || data;
    const plain = data.passwordPlain || data.password || data.initialPassword || '';
    if (plain) lastPlainPassword.value = String(plain);

    newUsername.value = '';
    await loadUsers();
  } catch (e: any) {
    createError.value = e?.message || String(e);
  } finally {
    loadingUsers.value = false;
  }
}

async function toggleUser(u: UserItem) {
  actionError.value = '';
  try {
    const next = u.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    await backendApi.updateUserStatus(u.username, next);
    await loadUsers();
  } catch (e: any) {
    setActionError(e);
  }
}

function randomizePassword(u: UserItem) {
  passwordDraft[u.username] = generatePassword(14);
}

async function updatePassword(u: UserItem) {
  actionError.value = '';
  const pwd = String(passwordDraft[u.username] || '');
  if (!pwd) {
    setActionError(new Error('请先输入/随机生成新密码'));
    return;
  }
  try {
    await backendApi.updateUserPassword(u.username, pwd);
    passwordDraft[u.username] = '';
    await loadUsers();
  } catch (e: any) {
    setActionError(e);
  }
}

async function updateRootPassword() {
  const pwd = String(rootPasswordDraft.value || '').trim();
  if (pwd.length < 6) return;
  actionError.value = '';
  rootPasswordSuccess.value = false;
  rootPasswordLoading.value = true;
  try {
    await backendApi.updateUserPassword('root', pwd);
    rootPasswordDraft.value = '';
    rootPasswordSuccess.value = true;
    setTimeout(() => { rootPasswordSuccess.value = false; }, 3000);
  } catch (e: any) {
    setActionError(e);
  } finally {
    rootPasswordLoading.value = false;
  }
}

onMounted(async () => {
  auth.initFromStorage();

  // 等待同源 config.js 注入完成，避免 Vite 把入口脚本提前到 head 导致 APP_CONFIG 尚未可用。
  const start = Date.now();
  while (true) {
    const cfg = (window as any).APP_CONFIG;
    if (cfg && typeof cfg.MODE !== 'undefined') break;
    if (Date.now() - start > 3000) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 50));
  }
  const m = backendApi.getMode();
  mode.value = (m === 'online' ? 'online' : 'local') as any;

  if (mode.value !== 'online') {
    authorized.value = false;
    placeholder.value = '本地模式不提供管理员后台。';
    return;
  }

  const token = getToken();
  if (!token) {
    authorized.value = false;
    placeholder.value = '未登录，正在跳转登录…';
    // backendApi.requestJson 在 401/403 时也会跳转；这里直接跳转提升体验。
    location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname + location.search + location.hash);
    return;
  }

  const role = decodeJwtRole(token) || auth.role;
  if (role !== 'admin') {
    authorized.value = false;
    placeholder.value = '权限不足：当前账号不是管理员。';
    return;
  }

  authorized.value = true;
  await loadUsers();
});
</script>

<style scoped>
.auth-page--gold {
  position: fixed;
  inset: 0;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.5rem 1.5rem;
  /* 参考 test.html：更亮的金色 + 深色科技底 + 毛玻璃卡片 */
  background-color: #080a0f; /* test.html: --bg-color */
  --accent: #e6b325;
  --accent-dim: rgba(230, 179, 37, 0.34);
  --border: rgba(230, 179, 37, 0.38);
  --surface: rgba(0, 0, 0, 0.22);
  --surface-elevated: rgba(255, 255, 255, 0.05);
  --text: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.62);
}

.auth-content {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
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
  background-color: #e6b325; /* test.html: --primary-glow */
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
  background-color: #7b2cbf;
  bottom: 10%;
  right: 10%;
  pointer-events: none;
}

.auth-page--gold > * {
  position: relative;
  z-index: 1;
}

.auth-card--gold {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow:
    0 22px 70px rgba(0, 0, 0, 0.62),
    0 0 0 1px rgba(230, 179, 37, 0.14);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.auth-card--gold:hover {
  transform: translateY(-4px);
  box-shadow:
    0 28px 90px rgba(0, 0, 0, 0.68),
    0 0 0 1px rgba(230, 179, 37, 0.18);
}

.auth-page--gold h2 {
  font-size: 1.75rem;
  font-weight: 850;
  letter-spacing: -0.02em;
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

