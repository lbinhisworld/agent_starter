<!--
  [INPUT]: URL query（`tool` 工具名）；`window` 注入 auth-runtime / api.js；`useToolDetailSession`
  [OUTPUT]: 工具详情页：返回首页 + 左侧对话（含当前工具蓝标）+ 右侧工作画布
  [POS]: `tool-detail.html` 根组件

  [PROTOCOL]: 聊天区「选择或新增工具」+ 当前工具蓝标；「添加」见 `useToolDetailSession`；变更时同步 `AGENTS.md` 并 `npm run build`
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import ToolDetailFeatureAxisTreePanel from './ToolDetailFeatureAxisTreePanel.vue';
import ToolDetailFeatureTreePanel from './ToolDetailFeatureTreePanel.vue';
import ToolDetailToolPickerModal from './ToolDetailToolPickerModal.vue';
import { buildWorkspaceFeatureNodes } from './toolDetailL05Format';
import { useToolDetailSession } from './useToolDetailSession';
import { useToolSuiteSelection } from './useToolSuiteSelection';

type WorkspaceTab = 'tool' | 'feature';
const workspaceTab = ref<WorkspaceTab>('tool');

const {
  tools,
  activeToolId,
  activeToolName,
  pickerOpen,
  addMode,
  newToolName,
  registryError,
  openPicker,
  closePicker,
  selectTool,
  startAddTool,
  cancelAddTool,
  confirmAddTool,
  removeToolFromSuite,
} = useToolSuiteSelection();

function goHome() {
  window.location.href = 'home.html';
}

const {
  inputText,
  chatMessages,
  sending,
  parseError,
  chatScrollRef,
  previewUserInputThreeLines,
  previewExtractSubText,
  workspaceTools,
  hasWorkspaceTools,
  workspaceSaveError,
  knowledgeHydrating,
  onUpdateWorkspaceValue,
  onDeleteWorkspaceValue,
  onSend,
  onKeydown,
  removeWorkspaceTool,
  confirmIntegrateYes,
  confirmIntegrateNo,
} = useToolDetailSession(activeToolId, tools);

const workspaceFeatures = computed(() => buildWorkspaceFeatureNodes(workspaceTools.value));

function onDeleteWorkspaceTool(toolId: string) {
  removeWorkspaceTool(toolId);
  removeToolFromSuite(toolId);
}
</script>

<template>
  <div class="td-app">
    <nav class="td-top-nav" aria-label="工具详情导航">
      <button type="button" class="td-btn td-btn--ghost" @click="goHome">← 返回首页</button>
    </nav>

    <div class="td-main">
      <aside class="td-chat" aria-label="工具对话">
        <div class="td-chat-head">
          <div class="td-chat-head-row">
            <button
              type="button"
              class="td-chat-head-picker-btn"
              aria-haspopup="dialog"
              :aria-expanded="pickerOpen"
              @click="openPicker"
            >
              选择或新增工具
            </button>
            <span
              v-if="activeToolName"
              class="td-active-tool-tag"
              :title="activeToolName"
            >{{ activeToolName }}</span>
          </div>
          <span class="td-chat-head-hint">粘贴工具介绍文字后点击添加</span>
        </div>
        <div ref="chatScrollRef" class="td-chat-body" aria-live="polite">
          <p v-if="parseError" class="td-chat-error" role="alert">{{ parseError }}</p>
          <template v-if="chatMessages.length === 0">
            <p class="td-chat-placeholder">
              在下方输入工具介绍文字，点击「添加」后将逐字展示接收记录并调用 L0.5 原语特征提炼，结果同步至右侧解析工作区。
            </p>
          </template>
          <template v-else>
            <template v-for="m in chatMessages" :key="m.key">
              <div
                v-if="m.kind === 'tool-received' && m.sub"
                class="td-chat-msg td-chat-msg--sys td-chat-msg--flow"
              >
                <div class="td-chat-flow-line">{{ m.lineText }}</div>
                <div class="td-chat-sub" aria-label="用户原始输入">
                  <pre class="td-chat-sub-pre">{{
                    previewUserInputThreeLines(m.sub.fullText, m.sub.revealedLen)
                  }}</pre>
                </div>
              </div>
              <div
                v-else-if="m.kind === 'tool-extracting' && m.sub"
                class="td-chat-msg td-chat-msg--sys td-chat-msg--flow"
                :aria-busy="m.sub.revealInProgress"
              >
                <div class="td-chat-flow-line">{{ m.lineText }}</div>
                <div class="td-chat-sub" aria-label="提炼结果">
                  <pre v-if="m.sub.fullText" class="td-chat-sub-pre">{{ previewExtractSubText(m.sub) }}</pre>
                  <p v-else-if="m.sub.revealInProgress" class="td-extract-wait">
                    正在调用大模型提炼 L0.5 技术原语特征…
                  </p>
                  <span
                    v-if="m.sub.revealInProgress && !m.sub.fullText"
                    class="td-parsing-dots"
                    aria-hidden="true"
                  >
                    <span /><span /><span />
                  </span>
                </div>
              </div>
              <div
                v-else-if="m.kind === 'tool-integrate-prompt'"
                class="td-chat-msg td-chat-msg--sys td-chat-msg--flow"
              >
                <div class="td-chat-flow-line">{{ m.lineText }}</div>
                <div v-if="m.integrateStatus === 'pending'" class="td-integrate-actions" role="group" aria-label="整合确认">
                  <button type="button" class="td-btn td-btn--primary td-integrate-btn" @click="confirmIntegrateYes(m.key)">
                    是
                  </button>
                  <button type="button" class="td-btn td-btn--ghost td-integrate-btn" @click="confirmIntegrateNo(m.key)">
                    否
                  </button>
                </div>
                <p v-else-if="m.integrateStatus === 'yes'" class="td-integrate-result td-integrate-result--ok">
                  已整合到工具知识集，可在右侧工作画布查看。
                </p>
                <p v-else class="td-integrate-result">未整合到工具知识集。</p>
              </div>
            </template>
          </template>
        </div>
        <div class="td-chat-foot">
          <textarea
            v-model="inputText"
            class="td-chat-input"
            placeholder="粘贴工具介绍文字…"
            rows="4"
            :disabled="sending"
            @keydown="onKeydown"
          />
          <button
            type="button"
            class="td-btn td-btn--primary td-chat-send"
            :disabled="sending || !activeToolId || !inputText.trim()"
            :title="!activeToolId ? '请先在顶部选择或新增工具' : undefined"
            @click="onSend"
          >
            {{ sending ? '添加中…' : '添加' }}
          </button>
        </div>
      </aside>

      <section class="td-workspace" aria-label="工作画布">
        <div class="td-workspace-inner">
          <div class="td-workspace-head">
            <h2 class="td-workspace-title">工作画布</h2>
            <div
              v-if="hasWorkspaceTools"
              class="td-workspace-tabs"
              role="tablist"
              aria-label="工作画布视图"
            >
              <button
                type="button"
                role="tab"
                class="td-workspace-tab"
                :class="{ 'td-workspace-tab--active': workspaceTab === 'tool' }"
                :aria-selected="workspaceTab === 'tool'"
                @click="workspaceTab = 'tool'"
              >
                工具
              </button>
              <button
                type="button"
                role="tab"
                class="td-workspace-tab"
                :class="{ 'td-workspace-tab--active': workspaceTab === 'feature' }"
                :aria-selected="workspaceTab === 'feature'"
                @click="workspaceTab = 'feature'"
              >
                特征
              </button>
            </div>
          </div>

          <div class="td-workspace-body">
            <div class="td-panel" aria-label="工作概览">
              <p v-if="workspaceTab === 'tool'" class="td-overview-lead">
                <strong>工具</strong>视图：一级为工具名，二级为特征键，三级为取值（可编辑/删除）。已整合数据会同步至服务端数据库（online 已登录时）。
              </p>
              <p v-else class="td-overview-lead">
                <strong>特征</strong>视图：一级为特征键，二级为工具名，三级为取值（可编辑/删除）；与「工具」视图同源，仅展示维度不同。
              </p>
              <p v-if="workspaceSaveError" class="td-workspace-error" role="alert">{{ workspaceSaveError }}</p>
              <p v-if="parseError && !hasWorkspaceTools" class="td-workspace-error" role="alert">{{ parseError }}</p>
              <p v-if="knowledgeHydrating" class="td-workspace-hint">正在从服务端加载工具知识集…</p>
              <p v-else-if="sending && !hasWorkspaceTools" class="td-workspace-hint">正在调用模型提取，请稍候…</p>
              <p v-else-if="!hasWorkspaceTools && !parseError" class="td-workspace-hint">
                完成「添加」提取后，在聊天区选择「是」整合到工具知识集，即可在「工具」「特征」视图中查看。
              </p>
              <ToolDetailFeatureTreePanel
                v-if="hasWorkspaceTools && workspaceTab === 'tool'"
                :tools="workspaceTools"
                @delete-tool="onDeleteWorkspaceTool"
                @update-value="onUpdateWorkspaceValue"
                @delete-value="onDeleteWorkspaceValue"
              />
              <ToolDetailFeatureAxisTreePanel
                v-if="hasWorkspaceTools && workspaceTab === 'feature'"
                :features="workspaceFeatures"
                @update-value="onUpdateWorkspaceValue"
                @delete-value="onDeleteWorkspaceValue"
              />
            </div>
          </div>
        </div>
      </section>
    </div>

    <ToolDetailToolPickerModal
      :open="pickerOpen"
      :tools="tools"
      :active-tool-id="activeToolId"
      :add-mode="addMode"
      :new-tool-name="newToolName"
      :error-text="registryError"
      @close="closePicker"
      @select="selectTool"
      @start-add="startAddTool"
      @cancel-add="cancelAddTool"
      @update:new-tool-name="newToolName = $event"
      @confirm-add="confirmAddTool"
    />
  </div>
</template>

<style scoped>
.td-app {
  --td-bg: #f1f5f9;
  --td-surface: #ffffff;
  --td-border: #e2e8f0;
  --td-text: #0f172a;
  --td-muted: #64748b;
  --td-accent: #2563eb;
  --td-accent-soft: #dbeafe;
  --td-main-height: min(720px, calc(100vh - 11rem));

  max-width: 1600px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 2rem;
  min-height: 100vh;
  box-sizing: border-box;
  font-family: inherit;
  background: var(--td-bg);
  color: var(--td-text);
}

.td-top-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-bottom: 1rem;
}

.td-btn {
  font-family: inherit;
  font-size: 0.9rem;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  padding: 0.45rem 0.9rem;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.td-btn--ghost {
  color: var(--td-accent);
  background: #fff;
  border-color: var(--td-accent);
}

.td-btn--ghost:hover {
  background: var(--td-accent-soft);
}

.td-btn--primary {
  color: #fff;
  background: var(--td-accent);
  border-color: var(--td-accent);
}

.td-btn--primary:hover {
  filter: brightness(1.05);
}

.td-main {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 1rem;
  min-height: var(--td-main-height);
}

.td-chat {
  flex: 0 0 33%;
  max-width: 33%;
  min-width: 280px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--td-surface);
  border: 1px solid var(--td-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.td-chat-head {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--td-border);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.td-chat-head-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}

.td-chat-head-picker-btn {
  flex: 0 1 auto;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--td-accent);
  background: #fff;
  border: 1px solid var(--td-accent);
  border-radius: 8px;
  padding: 0.32rem 0.65rem;
  cursor: pointer;
  transition: background 0.2s;
}

.td-chat-head-picker-btn:hover {
  background: var(--td-accent-soft);
}

.td-active-tool-tag {
  flex: 0 1 auto;
  max-width: min(14rem, 58%);
  padding: 0.28rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.25;
  color: #fff;
  background: var(--td-accent);
  border: 1px solid #1d4ed8;
  border-radius: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25);
}

.td-chat-head-hint {
  font-size: 0.78rem;
  color: var(--td-muted);
}

.td-chat-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.td-chat-placeholder {
  margin: 0;
  font-size: 0.82rem;
  color: var(--td-muted);
  line-height: 1.5;
}

.td-chat-error {
  margin: 0 0 0.5rem;
  padding: 0.45rem 0.55rem;
  font-size: 0.82rem;
  color: #b91c1c;
  background: #fee2e2;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

.td-extract-wait {
  margin: 0;
  font-size: 0.8rem;
  color: var(--td-muted);
  line-height: 1.45;
}

.td-chat-msg {
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--td-border);
  max-width: 100%;
}

.td-chat-msg--user {
  align-self: flex-end;
  background: var(--td-accent-soft);
  border-color: #93c5fd;
}

.td-chat-msg--sys {
  background: #f8fafc;
  border-left: 3px solid var(--td-accent);
}

.td-chat-msg--parsing .td-chat-msg-body {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.td-parsing-dots span {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin: 0 2px;
  border-radius: 50%;
  background: var(--td-accent);
  animation: td-dot 1.2s ease-in-out infinite;
}

.td-parsing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.td-parsing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes td-dot {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

.td-chat-msg-body {
  font-size: 0.84rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.td-chat-msg--flow {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.td-chat-flow-line {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--td-text);
}

.td-chat-sub {
  margin-left: 0.35rem;
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  background: #f1f5f9;
  border: 1px dashed #cbd5e1;
}

.td-chat-sub-pre {
  margin: 0;
  font-family: inherit;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #64748b;
  white-space: pre-wrap;
  word-break: break-word;
}

.td-integrate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-left: 0.35rem;
}

.td-integrate-btn {
  min-width: 3.25rem;
  padding: 0.35rem 0.85rem;
  font-size: 0.84rem;
}

.td-integrate-result {
  margin: 0 0 0 0.35rem;
  font-size: 0.82rem;
  color: #64748b;
}

.td-integrate-result--ok {
  color: #15803d;
}

.td-chat-foot {
  flex-shrink: 0;
  padding: 0.65rem 1rem;
  border-top: 1px solid var(--td-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #fff;
}

.td-chat-input {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 3.5rem;
  border: 1px solid var(--td-border);
  border-radius: 10px;
  padding: 0.5rem 0.65rem;
  font-family: inherit;
  font-size: 0.88rem;
}

.td-chat-send {
  align-self: flex-end;
}

.td-notice-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: 1px solid #93c5fd;
  background: linear-gradient(165deg, #eff6ff, #fff);
}

.td-notice-card--tree {
  border-color: #86efac;
  background: linear-gradient(165deg, #f0fdf4, #fff);
}

.td-notice-title {
  font-weight: 700;
  font-size: 0.92rem;
}

.td-notice-body {
  margin: 0;
  font-size: 0.85rem;
  color: var(--td-muted);
}

.td-notice-meta {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.78rem;
}

.td-notice-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
}

.td-notice-meta-k {
  color: var(--td-muted);
  min-width: 5.5rem;
}

.td-notice-btn {
  align-self: flex-start;
}

.td-workspace {
  flex: 1 1 67%;
  min-width: 0;
  background: var(--td-surface);
  border: 1px solid var(--td-border);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.td-workspace-inner {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.td-workspace-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem 0.35rem;
  border-bottom: 1px solid var(--td-border);
}

.td-workspace-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.td-workspace-head-actions {
  display: flex;
  gap: 0.5rem;
}

.td-workspace-tabs {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.td-workspace-tab {
  border: 1px solid var(--td-border);
  background: #fff;
  color: var(--td-muted);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
}

.td-workspace-tab:hover {
  background: #f8fafc;
  color: var(--td-text);
}

.td-workspace-tab--active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.td-workspace-tab--active:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #fff;
}

.td-workspace-hint {
  margin: 0 0 0.75rem;
  font-size: 0.84rem;
  color: var(--td-muted);
  line-height: 1.5;
}

.td-workspace-error {
  margin: 0 0 0.75rem;
  font-size: 0.84rem;
  color: #b91c1c;
  padding: 0.45rem 0.55rem;
  background: #fee2e2;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

.td-workspace-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.td-panel {
  padding: 0.85rem 1rem 1.25rem;
}

.td-overview-lead {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--td-text);
}

.td-overview-list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.86rem;
  line-height: 1.55;
  color: var(--td-muted);
}

@media (min-width: 901px) {
  .td-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-height: 100vh;
    overflow: hidden;
  }

  .td-top-nav {
    flex-shrink: 0;
  }

  .td-main {
    flex: 1 1 auto;
    min-height: 0;
    align-items: stretch;
  }

  .td-chat {
    align-self: stretch;
    max-height: none;
  }

  .td-workspace {
    align-self: stretch;
    min-height: 0;
  }
}

@media (max-width: 900px) {
  .td-main {
    flex-direction: column;
  }

  .td-chat {
    flex: 0 0 auto;
    max-width: none;
    width: 100%;
    min-height: 280px;
  }

  .td-workspace {
    min-height: 360px;
  }
}
</style>
