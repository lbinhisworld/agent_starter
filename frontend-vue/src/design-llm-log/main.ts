/**
 * [INPUT]: `frontend` 注入 config / auth-runtime（见 `design-llm-log.html`）
 * [OUTPUT]: 挂载 LLM 调用审计页 `#design-llm-log-app`
 * [POS]: `design-llm-log.html` 入口
 *
 * [PROTOCOL]: 变更鉴权或 API 契约时同步 `frontend-vue/AGENTS.md`
 */
import { createApp } from 'vue';
import DesignLlmLogPage from './DesignLlmLogPage.vue';

createApp(DesignLlmLogPage).mount('#design-llm-log-app');
