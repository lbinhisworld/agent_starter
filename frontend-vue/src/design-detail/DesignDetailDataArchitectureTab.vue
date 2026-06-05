<!--
  [INPUT]: caseId、refreshTick（架构清单「功能清单」子页）
  [OUTPUT]: 可折叠层叠 + 「设计逻辑」子卡 + 跨平台集成接口卡
  [POS]: 架构清单「功能清单」子页（原数据架构层叠视图）
  [PROTOCOL]: 数据来自 buildDataArchitectureFromTaskGraph；变更时同步 AGENTS.md
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  buildDataArchitectureFromTaskGraph,
  type DataArchitectureModel,
} from './buildDataArchitectureFromTaskGraph';
import DataArchDesignLogicPanel from './DataArchDesignLogicPanel.vue';
import { normalizeLogicGraphTasksFromApiPayload } from './designDetailTask2L1SyncUiProgress';
import type { DesignDetailLogicGraphLinkDto } from './designDetailLogicGraphMerge';

const props = defineProps<{
  caseId: string;
  refreshTick: number;
}>();

const loading = ref(false);
const loadError = ref<string | null>(null);
const model = ref<DataArchitectureModel | null>(null);

const hasContent = computed(() => {
  const m = model.value;
  if (!m || m.emptyMessage) return false;
  return m.platforms.length > 0 || (m.crossPlatformIntegration?.interfaces.length ?? 0) > 0;
});

const hasPlatformStack = computed(() => (model.value?.platforms.length ?? 0) > 0);

const crossPlatformBlock = computed(() => model.value?.crossPlatformIntegration ?? null);

async function fetchGraph(): Promise<void> {
  const cid = String(props.caseId || '').trim();
  if (!cid) {
    model.value = null;
    loadError.value = '缺少 caseId';
    return;
  }
  loading.value = true;
  loadError.value = null;
  try {
    const api = (
      window as unknown as {
        SmartCto?: {
          problemCaseApi?: {
            getDesignDetailTaskGraph?: (id: string) => Promise<{
              ok?: boolean;
              data?: { tasks?: unknown[]; links?: unknown[] };
              message?: string;
            } | null>;
          };
        };
      }
    ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;
    if (typeof api !== 'function') {
      loadError.value = '未加载 problemCaseApi.getDesignDetailTaskGraph';
      model.value = null;
      return;
    }
    const res = await api(cid);
    if (!res?.ok || !res.data) {
      loadError.value = res?.message || '拉取 task-graph 失败';
      model.value = null;
      return;
    }
    const tasks = normalizeLogicGraphTasksFromApiPayload(res.data.tasks ?? []);
    const links = (Array.isArray(res.data.links) ? res.data.links : []) as DesignDetailLogicGraphLinkDto[];
    model.value = buildDataArchitectureFromTaskGraph(tasks, links);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
    model.value = null;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.caseId, props.refreshTick] as const,
  () => {
    void fetchGraph();
  },
  { immediate: true },
);
</script>

<template>
  <section class="dd-data-arch-root" aria-label="功能清单">
    <header class="dd-data-arch-toolbar">
      <span class="dd-data-arch-toolbar-title">功能清单</span>
      <span class="dd-data-arch-toolbar-hint">
        工具平台 / 表 Schema / 跨平台集成；一级卡可折叠，各层含「设计逻辑」
      </span>
    </header>

    <div v-if="loading" class="dd-data-arch-state">正在加载 task-graph…</div>
    <div v-else-if="loadError" class="dd-data-arch-state dd-data-arch-state--err">{{ loadError }}</div>
    <div v-else-if="model?.emptyMessage" class="dd-data-arch-state">{{ model.emptyMessage }}</div>
    <div v-else-if="!hasContent" class="dd-data-arch-state">
      暂无功能清单内容。请确认任务 10 已落库且 task-graph 含「物理表结构Schema」或「跨平台接口同步Schema」特征。
    </div>

    <div v-else class="dd-data-arch-page">
      <div v-if="hasPlatformStack" class="dd-data-arch-stack">
        <details
          v-for="(platform, pi) in model!.platforms"
          :key="platform.platformKey"
          class="dd-data-arch-fold dd-data-arch-fold--platform"
          :class="'dd-data-arch-platform--' + platform.platformKey"
          :open="pi === 0"
        >
          <summary class="dd-data-arch-fold-summary dd-data-arch-fold-summary--platform">
            <span class="dd-data-arch-platform-badge">工具平台</span>
            <span class="dd-data-arch-fold-title">{{ platform.platformLabel }}</span>
            <span class="dd-data-arch-fold-meta">{{ platform.level1Modules.length }} 个一级模块</span>
          </summary>

          <div class="dd-data-arch-fold-body">
            <DataArchDesignLogicPanel :logic="platform.designLogic" />

            <details
              v-for="l1 in platform.level1Modules"
              :key="l1.featureId || l1.name"
              class="dd-data-arch-fold dd-data-arch-fold--l1"
              open
            >
              <summary class="dd-data-arch-fold-summary dd-data-arch-fold-summary--l1">
                <span class="dd-data-arch-tier">一级模块</span>
                <span class="dd-data-arch-fold-title">{{ l1.name }}</span>
                <span class="dd-data-arch-fold-meta">{{ l1.level2Modules.length }} 张表</span>
              </summary>

              <div class="dd-data-arch-fold-body dd-data-arch-fold-body--l1">
                <DataArchDesignLogicPanel :logic="l1.designLogic" />

                <details
                  v-for="l2 in l1.level2Modules"
                  :key="l2.featureId || l2.name"
                  class="dd-data-arch-fold dd-data-arch-fold--l2"
                  open
                >
                  <summary class="dd-data-arch-fold-summary dd-data-arch-fold-summary--l2">
                    <span class="dd-data-arch-tier">表 Schema</span>
                    <span class="dd-data-arch-fold-title">{{ l2.name }}</span>
                    <span v-if="l2.tableCategory" class="dd-data-arch-l2-cat">{{ l2.tableCategory }}</span>
                  </summary>

                  <div class="dd-data-arch-fold-body dd-data-arch-fold-body--l2">
                    <DataArchDesignLogicPanel :logic="l2.designLogic" />

                    <section v-if="l2.fields.length" class="dd-data-arch-fields">
                      <h6 class="dd-data-arch-fields-title">物理表设计</h6>
                      <div class="dd-data-arch-field-grid">
                        <article
                          v-for="(field, fi) in l2.fields"
                          :key="l2.featureId + '-' + field.fieldName + '-' + fi"
                          class="dd-data-arch-field-card"
                        >
                          <header class="dd-data-arch-field-head">{{ field.fieldName }}</header>
                          <dl class="dd-data-arch-field-props">
                            <div
                              v-for="prop in field.properties"
                              :key="prop.key"
                              class="dd-data-arch-field-row"
                            >
                              <dt>{{ prop.key }}</dt>
                              <dd>{{ prop.value }}</dd>
                            </div>
                          </dl>
                        </article>
                      </div>
                    </section>

                    <section v-if="l2.initDesigns.length" class="dd-data-arch-json-block">
                      <h6 class="dd-data-arch-json-title">基础表初始化</h6>
                      <article
                        v-for="leaf in l2.initDesigns"
                        :key="leaf.featureId || leaf.label"
                        class="dd-data-arch-json-card"
                      >
                        <header class="dd-data-arch-json-card-head">{{ leaf.label }}</header>
                        <pre class="dd-data-arch-json-pre">{{ leaf.jsonText }}</pre>
                      </article>
                    </section>

                    <section v-if="l2.permissionDesigns.length" class="dd-data-arch-json-block">
                      <h6 class="dd-data-arch-json-title">权限设计</h6>
                      <article
                        v-for="leaf in l2.permissionDesigns"
                        :key="leaf.featureId || leaf.label"
                        class="dd-data-arch-json-card dd-data-arch-json-card--perm"
                      >
                        <header class="dd-data-arch-json-card-head">{{ leaf.label }}</header>
                        <pre class="dd-data-arch-json-pre">{{ leaf.jsonText }}</pre>
                      </article>
                    </section>

                    <p
                      v-if="!l2.fields.length && !l2.initDesigns.length && !l2.permissionDesigns.length"
                      class="dd-data-arch-empty-leaf"
                    >
                      （暂无字段 / 权限设计）
                    </p>
                  </div>
                </details>
              </div>
            </details>
          </div>
        </details>
      </div>

      <details
        v-if="crossPlatformBlock?.interfaces.length"
        class="dd-data-arch-fold dd-data-arch-fold--integration"
        open
      >
        <summary class="dd-data-arch-fold-summary dd-data-arch-fold-summary--integration">
          <span class="dd-data-arch-platform-badge dd-data-arch-platform-badge--integration">跨平台集成</span>
          <span class="dd-data-arch-fold-title">跨平台集成</span>
          <span class="dd-data-arch-fold-meta">{{ crossPlatformBlock.interfaces.length }} 个接口</span>
        </summary>

        <div class="dd-data-arch-fold-body dd-data-arch-fold-body--integration">
          <DataArchDesignLogicPanel :logic="crossPlatformBlock.designLogic" />

          <div class="dd-data-arch-integration-row">
            <article
              v-for="iface in crossPlatformBlock.interfaces"
              :key="iface.featureId || iface.interfaceName"
              class="dd-data-arch-integration-card"
            >
              <header class="dd-data-arch-integration-card-head">
                <h4 class="dd-data-arch-integration-card-title">{{ iface.interfaceName }}</h4>
                <p v-if="iface.communicationCategory" class="dd-data-arch-integration-meta">
                  {{ iface.communicationCategory }}
                </p>
                <p
                  v-if="iface.dataPipeline"
                  class="dd-data-arch-integration-pipeline"
                  :title="iface.dataPipeline"
                >
                  {{ iface.dataPipeline }}
                </p>
                <p v-if="iface.techHostPlatform" class="dd-data-arch-integration-host">
                  {{ iface.techHostPlatform }}
                </p>
              </header>

              <div class="dd-data-arch-integration-sections">
                <section class="dd-data-arch-integration-section">
                  <h5 class="dd-data-arch-integration-section-title">触发端配置</h5>
                  <pre class="dd-data-arch-json-pre dd-data-arch-integration-pre">{{
                    iface.triggerSourceJson
                  }}</pre>
                </section>
                <section class="dd-data-arch-integration-section">
                  <h5 class="dd-data-arch-integration-section-title">接收端配置</h5>
                  <pre class="dd-data-arch-json-pre dd-data-arch-integration-pre">{{
                    iface.receiverConfigJson
                  }}</pre>
                </section>
                <section class="dd-data-arch-integration-section dd-data-arch-integration-section--mapping">
                  <h5 class="dd-data-arch-integration-section-title">字段映射字典</h5>
                  <pre class="dd-data-arch-json-pre dd-data-arch-integration-pre">{{
                    iface.fieldMappingJson
                  }}</pre>
                </section>
              </div>
            </article>
          </div>
        </div>
      </details>
    </div>
  </section>
</template>

<style scoped>
.dd-data-arch-root {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  height: 100%;
}

.dd-data-arch-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
}

.dd-data-arch-toolbar-title {
  font-weight: 600;
  color: #0f172a;
}

.dd-data-arch-toolbar-hint {
  flex: 1;
  font-size: 12px;
  color: #64748b;
}

.dd-data-arch-state {
  padding: 24px;
  color: #64748b;
  font-size: 14px;
}

.dd-data-arch-state--err {
  color: #b91c1c;
}

.dd-data-arch-page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.dd-data-arch-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

/* 可折叠层级 */
.dd-data-arch-fold {
  border-radius: 14px;
  background: #f8fafc;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

.dd-data-arch-fold--platform {
  border: 2px solid #cbd5e1;
}

.dd-data-arch-platform--wecom.dd-data-arch-fold--platform {
  border-color: #059669;
  background: linear-gradient(180deg, #ecfdf5 0%, #f8fafc 56px);
}

.dd-data-arch-platform--qiqiao.dd-data-arch-fold--platform {
  border-color: #1e40af;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 56px);
}

.dd-data-arch-fold--integration {
  border: 2px solid #818cf8;
  background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 56px);
  flex-shrink: 0;
}

.dd-data-arch-fold--l1 {
  margin: 10px 0 0;
  border: 1.5px solid #cbd5e1;
  background: #fff;
}

.dd-data-arch-fold--l2 {
  margin: 8px 0 0;
  border: 1px solid #e2e8f0;
  background: #fafafa;
}

.dd-data-arch-fold-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 14px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.dd-data-arch-fold-summary::-webkit-details-marker {
  display: none;
}

.dd-data-arch-fold-summary::before {
  content: '';
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 7px solid #64748b;
  margin-right: 4px;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.dd-data-arch-fold[open] > .dd-data-arch-fold-summary::before {
  transform: rotate(90deg);
}

.dd-data-arch-fold-summary--platform {
  padding: 14px;
}

.dd-data-arch-fold-summary--integration .dd-data-arch-fold-title {
  color: #312e81;
}

.dd-data-arch-fold-title {
  font-weight: 700;
  color: #0f172a;
  font-size: 15px;
}

.dd-data-arch-fold-summary--l1 .dd-data-arch-fold-title {
  font-size: 14px;
  color: #1e293b;
}

.dd-data-arch-fold-summary--l2 .dd-data-arch-fold-title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.dd-data-arch-fold-meta {
  margin-left: auto;
  font-size: 11px;
  color: #64748b;
}

.dd-data-arch-fold-body {
  padding: 0 14px 14px;
}

.dd-data-arch-fold-body--l1 {
  padding-left: 12px;
  padding-right: 12px;
}

.dd-data-arch-fold-body--l2 {
  padding: 0 10px 10px;
}

.dd-data-arch-fold-body--integration {
  padding-bottom: 14px;
}

.dd-data-arch-platform-badge,
.dd-data-arch-tier {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  background: #e2e8f0;
  border-radius: 999px;
  padding: 2px 8px;
  flex-shrink: 0;
}

.dd-data-arch-platform-badge--integration {
  color: #4338ca;
  background: #e0e7ff;
}

.dd-data-arch-l2-cat {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px 8px;
}

.dd-data-arch-integration-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 6px;
  align-items: stretch;
}

.dd-data-arch-integration-card {
  flex: 0 0 auto;
  min-width: 320px;
  max-width: 420px;
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.12);
}

.dd-data-arch-integration-card-head {
  padding: 10px 12px;
  border-bottom: 1px solid #e0e7ff;
  background: linear-gradient(180deg, #eef2ff 0%, #fff 100%);
}

.dd-data-arch-integration-card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #3730a3;
  line-height: 1.35;
}

.dd-data-arch-integration-meta,
.dd-data-arch-integration-pipeline,
.dd-data-arch-integration-host {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: #64748b;
}

.dd-data-arch-integration-pipeline {
  color: #4f46e5;
  word-break: break-word;
}

.dd-data-arch-integration-sections {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  min-height: 0;
}

.dd-data-arch-integration-section {
  border-top: 1px solid #e2e8f0;
  padding: 8px 10px 10px;
}

.dd-data-arch-integration-section--mapping {
  background: #fafafa;
}

.dd-data-arch-integration-section-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  color: #4338ca;
}

.dd-data-arch-integration-pre {
  max-height: 160px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.dd-data-arch-fields-title,
.dd-data-arch-json-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  color: #92400e;
}

.dd-data-arch-field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.dd-data-arch-field-card {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.dd-data-arch-field-head {
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
}

.dd-data-arch-field-props {
  margin: 0;
  padding: 8px 10px 10px;
}

.dd-data-arch-field-row {
  display: grid;
  grid-template-columns: 5.5em 1fr;
  gap: 6px 8px;
  font-size: 11px;
  line-height: 1.45;
  padding: 3px 0;
  border-bottom: 1px dashed #f1f5f9;
}

.dd-data-arch-field-row:last-child {
  border-bottom: none;
}

.dd-data-arch-field-row dt {
  margin: 0;
  color: #64748b;
  font-weight: 600;
}

.dd-data-arch-field-row dd {
  margin: 0;
  color: #1e293b;
  word-break: break-word;
}

.dd-data-arch-json-block {
  margin-top: 12px;
}

.dd-data-arch-json-block + .dd-data-arch-json-block {
  margin-top: 10px;
}

.dd-data-arch-json-card {
  border: 1px solid #fcd34d;
  border-radius: 8px;
  background: #fffbeb;
  overflow: hidden;
  margin-bottom: 8px;
}

.dd-data-arch-json-card--perm {
  border-color: #c4b5fd;
  background: #f5f3ff;
}

.dd-data-arch-json-card-head {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #78350f;
  border-bottom: 1px solid #fde68a;
  background: #fef3c7;
}

.dd-data-arch-json-card--perm .dd-data-arch-json-card-head {
  color: #5b21b6;
  border-bottom-color: #ddd6fe;
  background: #ede9fe;
}

.dd-data-arch-json-pre {
  margin: 0;
  padding: 10px;
  font-size: 11px;
  line-height: 1.45;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  color: #1e293b;
  max-height: 240px;
  overflow: auto;
  user-select: text;
}

.dd-data-arch-empty-leaf {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}
</style>
