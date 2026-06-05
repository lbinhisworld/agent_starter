/**
 * [INPUT]: `frontend` 已注入 config / auth-runtime / api（见 `tool-experience.html`）
 * [OUTPUT]: 挂载工具经验页 `#tool-exp-app`
 * [POS]: `tool-experience.html` 入口
 *
 * [PROTOCOL]: 与 `HomePage` 一致依赖全局脚本顺序；勿在此引入 `main.js`
 */
import { createApp } from 'vue';
import ToolExperiencePage from './ToolExperiencePage.vue';

createApp(ToolExperiencePage).mount('#tool-exp-app');
