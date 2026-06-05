import { defineStore } from 'pinia';

const AUTH_TOKEN_STORAGE_KEY = 'smart_cto_auth_token';
const AUTH_ROLE_STORAGE_KEY = 'smart_cto_auth_role';
const AUTH_USERNAME_STORAGE_KEY =
  (typeof window !== 'undefined' && (window as any).APP_CONFIG?.AUTH_USERNAME_STORAGE_KEY) || 'smart_cto_auth_username';
const AUTH_EXPIRES_AT_STORAGE_KEY = 'smart_cto_auth_expires_at';

export type AuthRole = 'admin' | 'user';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    role: '' as AuthRole | '',
    username: '' as string,
  }),
  actions: {
    initFromStorage() {
      try {
        const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
        const role = (localStorage.getItem(AUTH_ROLE_STORAGE_KEY) || '') as AuthRole | '';
        const username = localStorage.getItem(AUTH_USERNAME_STORAGE_KEY) || '';
        this.token = token;
        this.role = role;
        this.username = username;
      } catch {
        // ignore
      }
    },
    signIn(payload: { token: string; role: AuthRole; username?: string }) {
      this.token = payload.token;
      this.role = payload.role;
      this.username = payload.username || '';
      try {
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, payload.token);
        localStorage.setItem(AUTH_ROLE_STORAGE_KEY, payload.role);
        if (payload.username) localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, payload.username);
      } catch {
        // ignore
      }
    },
    signOut() {
      this.token = '';
      this.role = '';
      this.username = '';
      try {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        localStorage.removeItem(AUTH_ROLE_STORAGE_KEY);
        localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
        localStorage.removeItem(AUTH_EXPIRES_AT_STORAGE_KEY);
      } catch {
        // ignore
      }
    },
  },
});

