/**
 * [INPUT]: 页面已注入 `config` / `storage` / `SmartCto.problemFollowShared`；首页卡逻辑见同目录 `problem-follow-home.ts`；`problem-case-api` 由本入口打包注入 `SmartCto.problemCaseApi`
 * [OUTPUT]: 挂载首页影子页 Vue 应用
 * [POS]: `home.html` 入口（Vue 影子页；仅命名，非正式首页）
 *
 * [PROTOCOL]: 变更首页影子页行为时同步 `frontend-vue/AGENTS.md` 与 `docs/agents/frontend/03-active-tasks.md` 相关条目；挂载根 `#home-app`
 */
import '../../../frontend/js/core/problem-case-api.js';
import { createApp } from 'vue';
import HomePage from './HomePage.vue';

createApp(HomePage).mount('#home-app');
