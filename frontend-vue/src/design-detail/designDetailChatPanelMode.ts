/**
 * [INPUT]: 用户点击左栏「进展 / 聊天」分段
 * [OUTPUT]: `designDetailChatPanelMode` 与读写 `localStorage`（离线兜底）；在线时以 `DesignDetailProgressWorkspace.payload.leftPanelUi` 为准
 * [POS]: `DesignDetailPage.vue` 左栏主内容区切换
 *
 * [PROTOCOL]: 键名变更时同步 `design_mode_ux.md` 与 `AGENTS.md`
 */

import { ref } from 'vue';

export type DesignDetailChatPanelMode = 'progress' | 'chat';

const STORAGE_KEY = 'smart_cto_design_detail_chat_panel_mode_v1';

function readStoredMode(): DesignDetailChatPanelMode {
  if (typeof localStorage === 'undefined') return 'progress';
  try {
    const raw = String(localStorage.getItem(STORAGE_KEY) || '').trim();
    if (raw === 'chat' || raw === 'progress') return raw;
  } catch {
    /* ignore */
  }
  return 'progress';
}

export const designDetailChatPanelMode = ref<DesignDetailChatPanelMode>(readStoredMode());

export function setDesignDetailChatPanelMode(mode: DesignDetailChatPanelMode): void {
  designDetailChatPanelMode.value = mode;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}
