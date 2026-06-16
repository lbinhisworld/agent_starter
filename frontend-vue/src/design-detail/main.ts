/**
 * [INPUT]: `frontend` 已注入 config / auth-runtime / api（见 `design-detail.html`）
 * [OUTPUT]: 挂载设计详情页 `#design-detail-app`
 * [POS]: `design-detail.html` 入口
 *
 * [PROTOCOL]: 勿引入 `main.js`；侧载 `problemDetailRestartFromCase` 注册 `SmartCto.problemDetailRestart`；变更布局或鉴权依赖时同步 `frontend-vue/AGENTS.md` 与本目录 `AGENTS.md`
 */
import '../legacy/core/problem-case-api.js';
/** 任务 6 L3 / 任务 7 L4 系统提示词须在 task1BusinessInsight 之前挂到 window */
import '../legacy/designDetailFeatureConclusionHumanize.js';
import '../legacy/designDetailL3ScenarioSystemPrompt.js';
import '../legacy/designDetailL65ItGapSystemPrompt.js';
import '../legacy/designDetailL4CollaborationSystemPrompt.js';
import '../legacy/designDetailL4PrototypeSystemPrompt.js';
import '../legacy/designDetailL475PhysicalHookSystemPrompt.js';
import '../legacy/designDetailL5BlueprintSystemPrompt.js';
import '../legacy/designDetailL5TechnicalDdlSystemPrompt.js';
import '../legacy/designDetailL1OriginalFeatureSystemPrompt.js';
import '../legacy/designDetailL2L1EntityPortraitSystemPrompt.js';
import '../legacy/designDetailL3L2IndustryBusinessSystemPrompt.js';
import '../legacy/designDetailL4L2ValueDriverSystemPrompt.js';
import '../legacy/designDetailL5L3MacroProcessSystemPrompt.js';
import '../legacy/designDetailL51ValuePropositionSystemPrompt.js';
import '../legacy/designDetailL52AssetFieldSetSystemPrompt.js';
import '../legacy/designDetailL53WorkflowFlowSystemPrompt.js';
import '../legacy/designDetailL55L3VsmStageSystemPrompt.js';
import '../legacy/designDetailDesignReportSystemPrompt.js';
import '../legacy/designDetailDesignReportChapter1SystemPrompt.js';
import '../legacy/designDetailDesignReportChapter2SystemPrompt.js';
import '../legacy/designDetailDesignReportChapter3SystemPrompt.js';
/** 与 `design-detail.html` 中 `<script src="…/task1BusinessInsight.js">` 双轨，避免仅加载 bundle 时 window 全局缺失 */
import '../legacy/task1BusinessInsight.js';
import './problemDetailRestartFromCase';
import { createApp } from 'vue';
import DesignDetailPage from './DesignDetailPage.vue';

createApp(DesignDetailPage).mount('#design-detail-app');
