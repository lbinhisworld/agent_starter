/**
 * [INPUT]: L0.5 模型 JSON
 * [OUTPUT]: 聊天子区与画布用的可读文本 / 行列表
 * [POS]: 工具详情页提取结果展示
 */

export type ToolDetailL05KvRow = {
  FeatureID?: string;
  Feature_Key?: string;
  Feature_Value?: string;
  Operator?: string;
  inference_summary?: string;
};

export type ToolDetailFeatureKeyGroup = {
  featureKey: string;
  values: Array<{ featureId?: string; value: string }>;
};

/** 将新提炼行合并进已有分组（同二级键下追加去重后的 value） */
export function mergeL05ParsedIntoFeatureGroups(
  existing: ToolDetailFeatureKeyGroup[],
  rows: ToolDetailL05KvRow[],
): ToolDetailFeatureKeyGroup[] {
  const map = new Map<string, Array<{ featureId?: string; value: string }>>();
  for (const g of existing) {
    map.set(g.featureKey, [...g.values]);
  }
  for (const r of rows) {
    const featureKey = String(r.Feature_Key ?? '—').trim() || '—';
    const value = String(r.Feature_Value ?? '—').trim() || '—';
    const featureId = String(r.FeatureID ?? '').trim() || undefined;
    if (!map.has(featureKey)) map.set(featureKey, []);
    const list = map.get(featureKey)!;
    if (!list.some((x) => x.value === value)) {
      list.push({ featureId, value });
    }
  }
  return [...map.entries()].map(([featureKey, values]) => ({ featureKey, values }));
}

/** 按特征键分组，同一键下不同取值为三级节点 */
export function buildToolDetailFeatureTreeGroups(rows: ToolDetailL05KvRow[]): ToolDetailFeatureKeyGroup[] {
  const map = new Map<string, Array<{ featureId?: string; value: string }>>();
  for (const r of rows) {
    const featureKey = String(r.Feature_Key ?? '—').trim() || '—';
    const value = String(r.Feature_Value ?? '—').trim() || '—';
    const featureId = String(r.FeatureID ?? '').trim() || undefined;
    if (!map.has(featureKey)) map.set(featureKey, []);
    const list = map.get(featureKey)!;
    if (!list.some((x) => x.value === value)) {
      list.push({ featureId, value });
    }
  }
  return [...map.entries()].map(([featureKey, values]) => ({ featureKey, values }));
}

export type ToolDetailWorkspaceToolNode = {
  toolId: string;
  toolName: string;
  groups: ToolDetailFeatureKeyGroup[];
  summary?: string;
};

/** 特征视图：二级为工具、三级为取值 */
export type ToolDetailWorkspaceFeatureToolRef = {
  toolId: string;
  toolName: string;
  values: Array<{ featureId?: string; value: string }>;
};

export type ToolDetailWorkspaceFeatureNode = {
  featureKey: string;
  tools: ToolDetailWorkspaceFeatureToolRef[];
};

/** 由工具视图节点反查为「一级特征键 → 二级工具 → 三级 value」 */
export function buildWorkspaceFeatureNodes(
  tools: ToolDetailWorkspaceToolNode[],
): ToolDetailWorkspaceFeatureNode[] {
  const featureOrder: string[] = [];
  const featureMap = new Map<string, Map<string, ToolDetailWorkspaceFeatureToolRef>>();

  const ensureFeature = (key: string) => {
    if (!featureMap.has(key)) {
      featureMap.set(key, new Map());
      featureOrder.push(key);
    }
    return featureMap.get(key)!;
  };

  for (const tool of tools) {
    for (const g of tool.groups) {
      const bucket = ensureFeature(g.featureKey);
      let ref = bucket.get(tool.toolId);
      if (!ref) {
        ref = { toolId: tool.toolId, toolName: tool.toolName, values: [] };
        bucket.set(tool.toolId, ref);
      }
      for (const v of g.values) {
        if (!ref.values.some((x) => x.value === v.value)) {
          ref.values.push({ featureId: v.featureId, value: v.value });
        }
      }
    }
  }

  return featureOrder
    .map((featureKey) => {
      const bucket = featureMap.get(featureKey)!;
      const toolRefs: ToolDetailWorkspaceFeatureToolRef[] = [];
      for (const tool of tools) {
        const ref = bucket.get(tool.toolId);
        if (ref?.values.length) toolRefs.push(ref);
      }
      for (const ref of bucket.values()) {
        if (!toolRefs.some((t) => t.toolId === ref.toolId)) toolRefs.push(ref);
      }
      return { featureKey, tools: toolRefs };
    })
    .filter((n) => n.tools.length > 0);
}

export function readL05TechSummary(parsed: Record<string, unknown> | null): string {
  if (!parsed || typeof parsed !== 'object') return '';
  const matrix = parsed.L0_5_Tech_Primitive_Matrix;
  if (!matrix || typeof matrix !== 'object') return '';
  const ca = (matrix as Record<string, unknown>).Causality_Analysis;
  if (!ca || typeof ca !== 'object') return '';
  return String((ca as Record<string, unknown>).Tech_Primitive_Summary ?? '').trim();
}

export function readL05TargetKv(parsed: Record<string, unknown> | null): ToolDetailL05KvRow[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const matrix = parsed.L0_5_Tech_Primitive_Matrix;
  if (!matrix || typeof matrix !== 'object') return [];
  const rows = (matrix as Record<string, unknown>).Target_KV;
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => r && typeof r === 'object') as ToolDetailL05KvRow[];
}

/** 聊天子区：提炼结果逐字展示用纯文本 */
export function formatL05MatrixForChatReveal(parsed: Record<string, unknown>): string {
  const rows = readL05TargetKv(parsed);
  if (!rows.length) return JSON.stringify(parsed, null, 2);
  const lines = rows.map((r) => {
    const key = String(r.Feature_Key ?? '—').trim();
    const val = String(r.Feature_Value ?? '—').trim();
    const fid = String(r.FeatureID ?? '').trim();
    const head = fid ? `[${fid}] ${key}` : key;
    return `· ${head}：${val}`;
  });
  const summary = readL05TechSummary(parsed);
  if (summary) lines.push('', summary);
  return lines.join('\n');
}
