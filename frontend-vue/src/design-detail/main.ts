/**
 * [INPUT]: `frontend` 已注入 config / auth-runtime / api（见 `design-detail.html`）
 * [OUTPUT]: 挂载设计详情页 `#design-detail-app`
 * [POS]: `design-detail.html` 入口
 *
 * [PROTOCOL]: 勿引入 `main.js`；侧载 `problemDetailRestartFromCase` 注册 `SmartCto.problemDetailRestart`；变更布局或鉴权依赖时同步 `frontend-vue/AGENTS.md` 与本目录 `AGENTS.md`
 */
import '../../../frontend/js/core/problem-case-api.js';
/** 任务 6 L3 / 任务 7 L4 系统提示词须在 task1BusinessInsight 之前挂到 window */
import '../../../frontend/js/designDetailFeatureConclusionHumanize.js';
import '../../../frontend/js/designDetailL3ScenarioSystemPrompt.js';
import '../../../frontend/js/designDetailL65ItGapSystemPrompt.js';
import '../../../frontend/js/designDetailL4CollaborationSystemPrompt.js';
import '../../../frontend/js/designDetailL4PrototypeSystemPrompt.js';
import '../../../frontend/js/designDetailL475PhysicalHookSystemPrompt.js';
import '../../../frontend/js/designDetailL5BlueprintSystemPrompt.js';
import '../../../frontend/js/designDetailL5TechnicalDdlSystemPrompt.js';
import '../../../frontend/js/designDetailL1OriginalFeatureSystemPrompt.js';
import '../../../frontend/js/designDetailL2L1EntityPortraitSystemPrompt.js';
import '../../../frontend/js/designDetailL3L2IndustryBusinessSystemPrompt.js';
import '../../../frontend/js/designDetailL4L2ValueDriverSystemPrompt.js';
import '../../../frontend/js/designDetailL5L3MacroProcessSystemPrompt.js';
import '../../../frontend/js/designDetailL51ValuePropositionSystemPrompt.js';
import '../../../frontend/js/designDetailL52AssetFieldSetSystemPrompt.js';
import '../../../frontend/js/designDetailL53WorkflowFlowSystemPrompt.js';
import '../../../frontend/js/designDetailL55L3VsmStageSystemPrompt.js';
import '../../../frontend/js/designDetailDesignReportSystemPrompt.js';
import '../../../frontend/js/designDetailDesignReportChapter1SystemPrompt.js';
import '../../../frontend/js/designDetailDesignReportChapter2SystemPrompt.js';
import '../../../frontend/js/designDetailDesignReportChapter3SystemPrompt.js';
/** 与 `design-detail.html` 中 `<script src="…/task1BusinessInsight.js">` 双轨，避免仅加载 bundle 时 window 全局缺失 */
import '../../../frontend/js/task1BusinessInsight.js';
import './problemDetailRestartFromCase';
import { createApp } from 'vue';
import DesignDetailPage from './DesignDetailPage.vue';

createApp(DesignDetailPage).mount('#design-detail-app');
