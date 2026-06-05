/**
 * [INPUT]: `frontend` 已注入 config / auth-runtime / api（见 `tool-detail.html`）
 * [OUTPUT]: 挂载工具详情页 `#tool-detail-app`
 * [POS]: `tool-detail.html` 入口
 *
 * [PROTOCOL]: 与 `tool-experience` 一致依赖全局脚本顺序
 */
import { createApp } from 'vue';
import ToolDetailPage from './ToolDetailPage.vue';

createApp(ToolDetailPage).mount('#tool-detail-app');
