/**
 * [INPUT]: URL `tool` 参数、`tool-suite-registry`
 * [OUTPUT]: 当前选中工具、工具列表、选择器开关与增删选动作
 * [POS]: `ToolDetailPage.vue`
 */
import { computed, onMounted, ref } from 'vue';
import {
  addToolToRegistry,
  ensureToolInRegistry,
  isReservedToolSuiteEntryName,
  loadToolSuiteRegistry,
  removeToolFromRegistry,
  type ToolSuiteEntry,
} from './tool-suite-registry';

function readToolFromUrl(): string {
  try {
    const u = new URL(window.location.href);
    return (u.searchParams.get('tool') || u.searchParams.get('toolId') || '').trim();
  } catch {
    return '';
  }
}

function replaceUrlToolParam(name: string) {
  try {
    const u = new URL(window.location.href);
    if (name) u.searchParams.set('tool', name);
    else u.searchParams.delete('tool');
    window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
  } catch {
    /* ignore */
  }
}

export function useToolSuiteSelection() {
  const tools = ref<ToolSuiteEntry[]>([]);
  const activeToolId = ref('');
  const pickerOpen = ref(false);
  const addMode = ref(false);
  const newToolName = ref('');
  const registryError = ref('');

  const activeTool = computed(() => tools.value.find((t) => t.id === activeToolId.value) ?? null);

  const activeToolName = computed(() => activeTool.value?.name ?? '');

  function refreshTools() {
    tools.value = loadToolSuiteRegistry();
    if (activeToolId.value && !tools.value.some((t) => t.id === activeToolId.value)) {
      const next = tools.value[0];
      if (next) applyActive(next);
      else {
        activeToolId.value = '';
        replaceUrlToolParam('');
      }
    }
  }

  function applyActive(entry: ToolSuiteEntry) {
    activeToolId.value = entry.id;
    replaceUrlToolParam(entry.name);
  }

  function openPicker() {
    registryError.value = '';
    addMode.value = false;
    newToolName.value = '';
    pickerOpen.value = true;
    refreshTools();
  }

  function closePicker() {
    pickerOpen.value = false;
    addMode.value = false;
    newToolName.value = '';
    registryError.value = '';
  }

  function selectTool(entry: ToolSuiteEntry) {
    applyActive(entry);
    closePicker();
  }

  function startAddTool() {
    registryError.value = '';
    addMode.value = true;
    newToolName.value = '';
  }

  function cancelAddTool() {
    addMode.value = false;
    newToolName.value = '';
    registryError.value = '';
  }

  function confirmAddTool() {
    registryError.value = '';
    try {
      const entry = addToolToRegistry(newToolName.value);
      refreshTools();
      applyActive(entry);
      closePicker();
    } catch (e) {
      registryError.value = e instanceof Error ? e.message : String(e);
    }
  }

  /** 工作画布删除工具后，从名录移除并修正当前选中 */
  function removeToolFromSuite(toolId: string) {
    const id = toolId.trim();
    if (!id) return;
    removeToolFromRegistry(id);
    refreshTools();
    if (activeToolId.value !== id) return;
    const next = tools.value[0];
    if (next) {
      applyActive(next);
    } else {
      activeToolId.value = '';
      replaceUrlToolParam('');
    }
  }

  onMounted(() => {
    refreshTools();
    const fromUrl = readToolFromUrl();
    if (fromUrl && isReservedToolSuiteEntryName(fromUrl)) {
      replaceUrlToolParam('');
      if (tools.value.length > 0) {
        applyActive(tools.value[0]);
      }
      return;
    }
    if (fromUrl) {
      const entry = ensureToolInRegistry(fromUrl);
      refreshTools();
      if (entry) {
        activeToolId.value = entry.id;
      }
      return;
    }
    if (tools.value.length > 0) {
      activeToolId.value = tools.value[0].id;
      replaceUrlToolParam(tools.value[0].name);
    }
  });

  return {
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
  };
}
