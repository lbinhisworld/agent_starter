/**
 * [INPUT]: localStorage
 * [OUTPUT]: 工具集名称列表的读写与去重追加
 * [POS]: 工具详情页「选择或新增工具」数据源
 *
 * [PROTOCOL]: 变更存储键或条目结构时同步 `AGENTS.md`
 */

export type ToolSuiteEntry = {
  id: string;
  name: string;
  createdAt: string;
};

const STORAGE_KEY = 'smart_cto_tool_suite_registry_v1';

/** 首页入口占位名，仅用于跳转工具详情页，不作为可选工具写入名录 */
export const TOOL_SUITE_STUB_ENTRY_NAME = '工具集';

export function isReservedToolSuiteEntryName(name: string): boolean {
  return name.trim() === TOOL_SUITE_STUB_ENTRY_NAME;
}

function newToolId(): string {
  const c = typeof window !== 'undefined' ? window.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `tool-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadToolSuiteRegistry(): ToolSuiteEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const rawCount = parsed.filter((x) => x && typeof x === 'object').length;
    const entries = parsed
      .filter((x) => x && typeof x === 'object')
      .map((x) => {
        const o = x as Record<string, unknown>;
        const name = String(o.name ?? '').trim();
        if (!name) return null;
        return {
          id: String(o.id ?? newToolId()),
          name,
          createdAt: String(o.createdAt ?? new Date().toISOString()),
        } satisfies ToolSuiteEntry;
      })
      .filter((x): x is ToolSuiteEntry => x !== null && !isReservedToolSuiteEntryName(x.name));

    if (entries.length !== rawCount) {
      saveToolSuiteRegistry(entries);
    }
    return entries;
  } catch {
    return [];
  }
}

export function saveToolSuiteRegistry(tools: ToolSuiteEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tools));
}

/** 按名称查找；不存在则追加并返回 */
export function ensureToolInRegistry(name: string): ToolSuiteEntry | null {
  const trimmed = name.trim();
  if (isReservedToolSuiteEntryName(trimmed)) return null;
  const label = trimmed || '未命名工具';
  const list = loadToolSuiteRegistry();
  const hit = list.find((t) => t.name === label);
  if (hit) return hit;
  const entry: ToolSuiteEntry = {
    id: newToolId(),
    name: label,
    createdAt: new Date().toISOString(),
  };
  saveToolSuiteRegistry([...list, entry]);
  return entry;
}

/** 从工具集名录移除（工作画布删除工具时同步调用） */
export function removeToolFromRegistry(toolId: string): void {
  const id = toolId.trim();
  if (!id) return;
  const list = loadToolSuiteRegistry().filter((t) => t.id !== id);
  saveToolSuiteRegistry(list);
}

export function addToolToRegistry(name: string): ToolSuiteEntry {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('请输入工具名称');
  if (isReservedToolSuiteEntryName(trimmed)) {
    throw new Error('「工具集」为页面入口名称，请填写具体工具名称');
  }
  const list = loadToolSuiteRegistry();
  if (list.some((t) => t.name === trimmed)) {
    throw new Error('该工具名称已存在');
  }
  const entry: ToolSuiteEntry = {
    id: newToolId(),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  saveToolSuiteRegistry([...list, entry]);
  return entry;
}
