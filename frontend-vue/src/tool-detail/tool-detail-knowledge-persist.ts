/**
 * [INPUT]: 工具 id、L0.5 提炼 JSON、工具集注册表；`window.fetchToolDetailWorkspace` / `saveToolDetailWorkspace`
 * [OUTPUT]: 工具知识集读写（localStorage 缓存 + online 入库）；工作画布节点汇总；value 增删改
 * [POS]: `useToolDetailSession` / 工作画布树组件
 *
 * [PROTOCOL]: 存储结构变更时同步后端 Zod、`api.js` 与 `AGENTS.md`
 */
import {
  mergeL05ParsedIntoFeatureGroups,
  readL05TargetKv,
  readL05TechSummary,
  type ToolDetailFeatureKeyGroup,
  type ToolDetailWorkspaceToolNode,
} from './toolDetailL05Format';

const STORAGE_KEY = 'smart_cto_tool_detail_knowledge_v1';

export type ToolDetailKnowledgeToolEntry = {
  groups: ToolDetailFeatureKeyGroup[];
  summary?: string;
};

export type ToolDetailKnowledgeStore = {
  version: 1;
  byToolId: Record<string, ToolDetailKnowledgeToolEntry>;
};

export type ToolDetailValueLocator = {
  toolId: string;
  featureKey: string;
  valueIndex: number;
};

let memoryStore: ToolDetailKnowledgeStore | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let hydratePromise: Promise<void> | null = null;

function emptyEntry(): ToolDetailKnowledgeToolEntry {
  return { groups: [] };
}

function emptyStore(): ToolDetailKnowledgeStore {
  return { version: 1, byToolId: {} };
}

function normalizeEntry(raw: unknown): ToolDetailKnowledgeToolEntry {
  if (!raw || typeof raw !== 'object') return emptyEntry();
  const o = raw as ToolDetailKnowledgeToolEntry;
  const groups = Array.isArray(o.groups)
    ? o.groups
        .filter((g) => g && typeof g === 'object')
        .map((g) => ({
          featureKey: String(g.featureKey ?? '—').trim() || '—',
          values: Array.isArray(g.values)
            ? g.values
                .filter((v) => v && typeof v === 'object')
                .map((v) => ({
                  value: String(v.value ?? '—').trim() || '—',
                  featureId: v.featureId ? String(v.featureId).trim() : undefined,
                }))
            : [],
        }))
        .filter((g) => g.values.length > 0)
    : [];
  const summary = typeof o.summary === 'string' ? o.summary.trim() : undefined;
  return { groups, summary: summary || undefined };
}

function normalizeStore(raw: unknown): ToolDetailKnowledgeStore {
  if (!raw || typeof raw !== 'object') return emptyStore();
  const o = raw as Partial<ToolDetailKnowledgeStore>;
  const byToolId: Record<string, ToolDetailKnowledgeToolEntry> = {};
  if (o.byToolId && typeof o.byToolId === 'object') {
    for (const [id, entry] of Object.entries(o.byToolId)) {
      const norm = normalizeEntry(entry);
      if (norm.groups.length) byToolId[id] = norm;
    }
  }
  return { version: 1, byToolId };
}

function readLocalStore(): ToolDetailKnowledgeStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

function writeLocalStore(store: ToolDetailKnowledgeStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[tool-detail-knowledge] localStorage write failed', e);
  }
}

function getStore(): ToolDetailKnowledgeStore {
  if (!memoryStore) memoryStore = readLocalStore();
  return memoryStore;
}

function commitStore(store: ToolDetailKnowledgeStore) {
  memoryStore = normalizeStore(store);
  writeLocalStore(memoryStore);
  schedulePersistKnowledgeToServer();
}

export function schedulePersistKnowledgeToServer() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistKnowledgeNow().catch((e) => {
      console.warn('[tool-detail-knowledge] remote save failed', e);
    });
  }, 600);
}

export async function persistKnowledgeNow(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const saveFn =
    typeof window !== 'undefined'
      ? (window as Window & { saveToolDetailWorkspace?: (s: ToolDetailKnowledgeStore) => Promise<unknown> })
          .saveToolDetailWorkspace
      : undefined;
  if (typeof saveFn !== 'function') return;
  await saveFn(getStore());
}

const HYDRATE_REMOTE_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    void p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** 进入页或刷新画布前：online 优先拉库并回写本地缓存（远程拉取带超时，避免逻辑树等入口永久「加载中」） */
export function hydrateToolDetailKnowledgeFromServer(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const fetchFn =
      typeof window !== 'undefined'
        ? (window as Window & { fetchToolDetailWorkspace?: () => Promise<ToolDetailKnowledgeStore> })
            .fetchToolDetailWorkspace
        : undefined;
    if (typeof fetchFn === 'function') {
      try {
        const remote = await withTimeout(
          fetchFn(),
          HYDRATE_REMOTE_TIMEOUT_MS,
          'fetchToolDetailWorkspace',
        );
        memoryStore = normalizeStore(remote);
        writeLocalStore(memoryStore);
        return;
      } catch (e) {
        console.warn('[tool-detail-knowledge] remote fetch failed, fallback local', e);
      }
    }
    memoryStore = readLocalStore();
  })().finally(() => {
    hydratePromise = null;
  });
  return hydratePromise;
}

export function loadToolDetailKnowledgeForTool(toolId: string): ToolDetailKnowledgeToolEntry {
  const id = toolId.trim();
  if (!id) return emptyEntry();
  const store = getStore();
  return normalizeEntry(store.byToolId[id]);
}

function saveToolEntry(toolId: string, entry: ToolDetailKnowledgeToolEntry) {
  const id = toolId.trim();
  if (!id) return;
  const store = getStore();
  const norm = normalizeEntry(entry);
  if (!norm.groups.length) {
    delete store.byToolId[id];
  } else {
    store.byToolId[id] = norm;
  }
  commitStore(store);
}

/** 将单次 L0.5 提炼合并进对应工具知识集（二级键下追加去重后的三级 value） */
export function mergeParsedIntoToolKnowledge(
  toolId: string,
  parsed: Record<string, unknown>,
): ToolDetailKnowledgeToolEntry {
  const id = toolId.trim();
  if (!id) return emptyEntry();
  const rows = readL05TargetKv(parsed);
  if (!rows.length) return loadToolDetailKnowledgeForTool(id);

  const prev = loadToolDetailKnowledgeForTool(id);
  const mergedGroups = mergeL05ParsedIntoFeatureGroups(prev.groups, rows);
  const summary = readL05TechSummary(parsed) || prev.summary;
  const next: ToolDetailKnowledgeToolEntry = { groups: mergedGroups, summary };
  saveToolEntry(id, next);
  return next;
}

export function clearToolDetailKnowledgeForTool(toolId: string): void {
  const id = toolId.trim();
  if (!id) return;
  const store = getStore();
  delete store.byToolId[id];
  commitStore(store);
}

export function updateToolDetailKnowledgeValue(
  loc: ToolDetailValueLocator,
  newValue: string,
): boolean {
  const toolId = loc.toolId.trim();
  const featureKey = loc.featureKey.trim();
  const value = newValue.trim();
  if (!toolId || !featureKey || !value) return false;

  const entry = loadToolDetailKnowledgeForTool(toolId);
  const group = entry.groups.find((g) => g.featureKey === featureKey);
  if (!group || loc.valueIndex < 0 || loc.valueIndex >= group.values.length) return false;

  const others = group.values.filter((_, i) => i !== loc.valueIndex).map((v) => v.value);
  if (others.includes(value)) return false;

  group.values[loc.valueIndex] = {
    ...group.values[loc.valueIndex],
    value,
  };
  saveToolEntry(toolId, entry);
  return true;
}

export function removeToolDetailKnowledgeValue(loc: ToolDetailValueLocator): boolean {
  const toolId = loc.toolId.trim();
  const featureKey = loc.featureKey.trim();
  if (!toolId || !featureKey) return false;

  const entry = loadToolDetailKnowledgeForTool(toolId);
  const gi = entry.groups.findIndex((g) => g.featureKey === featureKey);
  if (gi < 0) return false;
  const group = entry.groups[gi];
  if (loc.valueIndex < 0 || loc.valueIndex >= group.values.length) return false;

  group.values.splice(loc.valueIndex, 1);
  if (!group.values.length) entry.groups.splice(gi, 1);
  saveToolEntry(toolId, entry);
  return true;
}

/** 工作画布：汇总已整合进工具知识集的工具（顺序与工具集注册表一致） */
export function buildWorkspaceToolNodes(
  registry: Array<{ id: string; name: string }>,
): ToolDetailWorkspaceToolNode[] {
  const store = getStore();
  const out: ToolDetailWorkspaceToolNode[] = [];
  const seen = new Set<string>();

  for (const entry of registry) {
    const hit = normalizeEntry(store.byToolId[entry.id]);
    if (!hit.groups.length) continue;
    seen.add(entry.id);
    out.push({
      toolId: entry.id,
      toolName: entry.name,
      groups: hit.groups,
      summary: hit.summary,
    });
  }

  for (const [id, raw] of Object.entries(store.byToolId)) {
    if (seen.has(id)) continue;
    const hit = normalizeEntry(raw);
    if (!hit.groups.length) continue;
    out.push({
      toolId: id,
      toolName: '未命名工具',
      groups: hit.groups,
      summary: hit.summary,
    });
  }

  return out;
}
