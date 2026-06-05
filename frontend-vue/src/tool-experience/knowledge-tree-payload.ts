/**
 * [INPUT]: 工具经验解析结果 `result`（与 capability-prompt V3 对齐）
 * [OUTPUT]: 知识树持久化载荷类型与合并逻辑
 * [POS]: 工具经验页；与后端 `tool-experience-knowledge.service` 字段名对齐
 *
 * [PROTOCOL]: 变更 JSON 形状时同步后端 Zod、api.js `normalizeTreePayload`、`ToolExpKnowledgeTreePanel.vue`；工具对比见 `groupComparisonEntriesForTree`、`formatComparisonDetailLines`；典型场景见 `groupScenarioEntriesByIndustry`、`segmentTextWithProductNames`（描述内联；`products_used` 全量在「功能实现」标题栏由面板去重展示）、`scenarioProductsWithoutTextMatch`（仍导出，面板已不再用）；产品 `core_functions` V3、`capability_fingerprint` 与 `ToolExpResultCard` 对齐
 */

export type ToolExpKnowledgeProductEntry = {
  product_name: string;
  core_functions: unknown;
  capability_fingerprint: unknown;
  identified_issues: unknown;
  architecture_advice: unknown;
  importedAt: string;
};

export type ToolExpKnowledgeComparisonEntry = {
  comparison_tools: string[];
  dimension: string;
  comparison_detail: string;
  importedAt: string;
};

export type ToolExpKnowledgeScenarioEntry = {
  industry: string;
  description: string;
  function_achieved: string;
  products_used: string[];
  importedAt: string;
};

export type ToolExpKnowledgePayload = {
  version: number;
  productEntries: ToolExpKnowledgeProductEntry[];
  comparisonEntries: ToolExpKnowledgeComparisonEntry[];
  scenarioEntries: ToolExpKnowledgeScenarioEntry[];
};

/** 典型场景：按行业聚类（知识树二级=行业，三级=单条场景） */
export type ToolExpScenarioIndustryGroup = {
  industryKey: string;
  industryLabel: string;
  scenarios: ToolExpKnowledgeScenarioEntry[];
};

export function groupScenarioEntriesByIndustry(
  entries: ToolExpKnowledgeScenarioEntry[],
): ToolExpScenarioIndustryGroup[] {
  const orderKeys: string[] = [];
  const bucket = new Map<string, { label: string; items: ToolExpKnowledgeScenarioEntry[] }>();
  for (const e of entries) {
    const label = (e.industry || '').trim() || '行业未填';
    if (!bucket.has(label)) {
      bucket.set(label, { label, items: [] });
      orderKeys.push(label);
    }
    bucket.get(label)!.items.push(e);
  }
  return orderKeys.map((k) => ({
    industryKey: k,
    industryLabel: bucket.get(k)!.label,
    scenarios: bucket.get(k)!.items,
  }));
}

/** 场景描述/功能实现正文中，将 `products_used` 匹配到的名称拆成普通文本与标签段 */
export type ScenarioTextSegment = { kind: 'text' | 'pill'; value: string };

export function segmentTextWithProductNames(
  text: string,
  productsUsed: string[],
): ScenarioTextSegment[] {
  const raw = (text ?? '').trim();
  const names = [...new Set(productsUsed.map((p) => String(p).trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  if (!raw) return [{ kind: 'text', value: '—' }];
  if (!names.length) return [{ kind: 'text', value: raw }];

  try {
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = escaped.length === 1 ? escaped[0] : `(?:${escaped.join('|')})`;
    const re = new RegExp(pattern, 'g');
    const out: ScenarioTextSegment[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) {
        out.push({ kind: 'text', value: raw.slice(last, m.index) });
      }
      out.push({ kind: 'pill', value: m[0] });
      last = m.index + m[0].length;
    }
    if (last < raw.length) {
      out.push({ kind: 'text', value: raw.slice(last) });
    }
    return out.length ? out : [{ kind: 'text', value: raw }];
  } catch {
    return [{ kind: 'text', value: raw }];
  }
}

/**
 * 在「场景描述 + 功能实现」全文里都未出现的 `products_used` 名称。
 * 正文子串未命中时仍要在场景内容区展示彩色标签，避免列表有产品但 UI 无标签。
 */
export function scenarioProductsWithoutTextMatch(
  description: string,
  functionAchieved: string,
  productsUsed: string[],
): string[] {
  const d = description ?? '';
  const f = functionAchieved ?? '';
  const names = [...new Set(productsUsed.map((p) => String(p).trim()).filter(Boolean))];
  return names.filter((n) => !d.includes(n) && !f.includes(n));
}

/** 为产品标签配色提供稳定下标 */
export function productNamePillVariantIndex(name: string, mod = 5): number {
  let h = 0;
  const s = String(name);
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return mod ? h % mod : 0;
}

/** 工具对比树：二级=工具组合（V.S. 串联），三级=维度，四级=内容块列表 */
export type ToolExpComparisonComboGroup = {
  /** 分组用稳定键（排序后的工具名拼接） */
  toolsKey: string;
  /** 展示标题：按首次出现的工具顺序用 ` V.S. ` 串联 */
  toolsDisplay: string;
  /** 与标题一致的工具顺序，供对比正文按工具拆行 */
  toolsOrder: string[];
  dimensions: {
    dimension: string;
    blocks: { text: string; importedAt: string }[];
  }[];
};

/**
 * 将扁平 comparisonEntries 聚合成树形展示结构（不改变持久化结构）。
 * 同一组工具（名称集合相同）合并为二级节点；其下按维度再分三级。
 */
export function groupComparisonEntriesForTree(
  entries: ToolExpKnowledgeComparisonEntry[],
): ToolExpComparisonComboGroup[] {
  type ComboAcc = {
    toolsOrder: string[];
    byDim: Map<string, { text: string; importedAt: string }[]>;
  };
  const comboMap = new Map<string, ComboAcc>();

  for (const e of entries) {
    const tools = e.comparison_tools.map((t) => String(t).trim()).filter(Boolean);
    const toolsKey = tools.length ? [...tools].sort().join('\0') : '__no_tools__';

    if (!comboMap.has(toolsKey)) {
      comboMap.set(toolsKey, { toolsOrder: tools.length ? [...tools] : [], byDim: new Map() });
    }
    const combo = comboMap.get(toolsKey)!;
    if (combo.toolsOrder.length === 0 && tools.length > 0) {
      combo.toolsOrder = [...tools];
    }

    const dim = (e.dimension || '').trim() || '未标注维度';
    if (!combo.byDim.has(dim)) {
      combo.byDim.set(dim, []);
    }
    combo.byDim.get(dim)!.push({
      text: (e.comparison_detail || '').trim() || '—',
      importedAt: e.importedAt,
    });
  }

  return Array.from(comboMap.entries()).map(([toolsKey, acc]) => ({
    toolsKey,
    toolsDisplay: acc.toolsOrder.length ? acc.toolsOrder.join(' V.S. ') : '（未列工具）',
    toolsOrder: [...acc.toolsOrder],
    dimensions: Array.from(acc.byDim.entries()).map(([dimension, blocks]) => ({
      dimension,
      blocks,
    })),
  }));
}

/** 对比内容块内单行展示：工具名 + 情感符号 + 描述 */
export type ComparisonDetailLine = {
  tool: string;
  /** ✅ 正面 / ❌ 负面；无法判断时为空 */
  emoji: string;
  body: string;
};

/** 在正文中定位工具名（兼容「+」与「与」等写法） */
function findToolIndexInText(text: string, tool: string): number {
  if (!tool || !text) return -1;
  const candidates = [
    tool,
    tool.replace(/\+/g, '与'),
    tool.replace(/\+/g, '和'),
    tool.replace(/＋/g, '与'),
  ];
  let best = -1;
  for (const c of candidates) {
    if (!c) continue;
    const i = text.indexOf(c);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  if (best >= 0) return best;
  const head = tool.split(/[+＋]/)[0]?.trim() ?? '';
  if (head.length >= 2) {
    const i = text.indexOf(head);
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * 按工具在正文中的出现顺序，把一段对比说明拆成多段（每段归属一个工具）。
 */
function splitComparisonTextByTools(
  raw: string,
  toolsOrder: string[],
): { tool: string; chunk: string }[] {
  const text = (raw || '').trim();
  if (!text) return [];
  if (!toolsOrder.length) return [{ tool: '', chunk: text }];

  const hits = toolsOrder
    .map((tool) => ({ tool, idx: findToolIndexInText(text, tool) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  if (hits.length === 0) {
    return [{ tool: '', chunk: text }];
  }

  const parts: { tool: string; chunk: string }[] = [];
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].idx;
    const end = i + 1 < hits.length ? hits[i + 1].idx : text.length;
    parts.push({ tool: hits[i].tool, chunk: text.slice(start, end).trim() });
  }

  const firstIdx = hits[0].idx;
  if (firstIdx > 0) {
    const prefix = text.slice(0, firstIdx).trim();
    if (prefix) {
      parts[0] = { tool: parts[0].tool, chunk: `${prefix} ${parts[0].chunk}`.trim() };
    }
  }

  return parts;
}

function stripComparisonMarkers(s: string): string {
  return s.replace(/（负面点）|（正面点）|负面点|正面点/g, '').trim();
}

function inferComparisonEmoji(chunk: string): '✅' | '❌' | '' {
  const hasNegTag = /（负面点）|负面点/.test(chunk);
  const hasPosTag = /（正面点）|正面点/.test(chunk);
  if (hasNegTag && !hasPosTag) return '❌';
  if (hasPosTag && !hasNegTag) return '✅';
  if (hasNegTag && hasPosTag) {
    const li = Math.max(chunk.lastIndexOf('（负面点）'), chunk.lastIndexOf('负面点'));
    const lp = Math.max(chunk.lastIndexOf('（正面点）'), chunk.lastIndexOf('正面点'));
    return lp > li ? '✅' : '❌';
  }

  const negKw =
    /数据孤岛|版本混乱|手动同步|存在[^。]{0,30}问题|不足之处|缺点|薄弱|负面|混乱|孤岛|静态记录(?!.*质变)/;
  /** 含「实时数据同步」等常见正面表述（勿过宽以免与含「实时」的否定句冲突） */
  const posKw =
    /实时汇聚|实时数据同步|实时同步|实时计算|数据整合|毫秒级|流动智能|质变|优势|能实时|正面/;

  const n = negKw.test(chunk);
  const p = posKw.test(chunk);
  if (n && !p) return '❌';
  if (p && !n) return '✅';
  return '';
}

function polishComparisonBody(chunk: string, tool: string): string {
  let s = stripComparisonMarkers(chunk);
  if (tool) {
    const alts = [tool, tool.replace(/\+/g, '与'), tool.replace(/\+/g, '和'), tool.replace(/＋/g, '与')];
    for (const a of alts) {
      if (a && s.startsWith(a)) {
        s = s.slice(a.length).replace(/^[：:，,、\s]+/, '').trim();
        break;
      }
    }
  }
  return s || stripComparisonMarkers(chunk);
}

/**
 * 将单条 comparison_detail 拆成多行：`工具名：✅/❌ 描述`（每工具一行）。
 * 无法可靠拆分时退回单行原文（tool/emoji 为空）。
 */
export function formatComparisonDetailLines(
  toolsOrder: string[],
  raw: string,
): ComparisonDetailLine[] {
  const text = (raw || '').trim();
  if (!text || text === '—') {
    return [{ tool: '', emoji: '', body: text || '—' }];
  }

  const parts = splitComparisonTextByTools(text, toolsOrder);
  if (parts.length === 0) {
    return [{ tool: '', emoji: '', body: text }];
  }

  let lines: ComparisonDetailLine[] = parts.map(({ tool, chunk }) => ({
    tool,
    emoji: inferComparisonEmoji(chunk),
    body: polishComparisonBody(chunk, tool),
  }));

  if (lines.length === 2 && lines.every((l) => !l.emoji)) {
    lines = [
      { ...lines[0], emoji: '❌' },
      { ...lines[1], emoji: '✅' },
    ];
  } else if (lines.length === 2) {
    // 仅一侧被关键词命中时（常见 Excel❌ / 智能表格✅），补全另一侧，避免第二行空白
    const [a, b] = lines;
    if (a.emoji === '❌' && !b.emoji) lines = [a, { ...b, emoji: '✅' }];
    else if (b.emoji === '❌' && !a.emoji) lines = [{ ...a, emoji: '✅' }, b];
  }

  return lines;
}

export function emptyKnowledgePayload(): ToolExpKnowledgePayload {
  return {
    version: 1,
    productEntries: [],
    comparisonEntries: [],
    scenarioEntries: [],
  };
}

/** 将单次提炼结果并入知识树（追加，保留历史批次） */
export function mergeExtractIntoKnowledgeTree(
  prev: ToolExpKnowledgePayload,
  result: Record<string, unknown>,
): ToolExpKnowledgePayload {
  const importedAt = new Date().toISOString();
  const next: ToolExpKnowledgePayload = {
    version: 1,
    productEntries: [...prev.productEntries],
    comparisonEntries: [...prev.comparisonEntries],
    scenarioEntries: [...prev.scenarioEntries],
  };

  const products = Array.isArray(result.products) ? result.products : [];
  for (const raw of products) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const p = raw as Record<string, unknown>;
    next.productEntries.push({
      product_name: String(p.product_name ?? '').trim() || '未命名产品',
      core_functions: p.core_functions ?? [],
      capability_fingerprint: p.capability_fingerprint ?? null,
      identified_issues: p.identified_issues ?? null,
      architecture_advice: p.architecture_advice ?? null,
      importedAt,
    });
  }

  const tc = result.tool_comparison;
  if (Array.isArray(tc)) {
    for (const raw of tc) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const c = raw as Record<string, unknown>;
      next.comparisonEntries.push({
        comparison_tools: Array.isArray(c.comparison_tools)
          ? c.comparison_tools.map((x) => String(x))
          : [],
        dimension: String(c.dimension ?? ''),
        comparison_detail: String(c.comparison_detail ?? ''),
        importedAt,
      });
    }
  } else if (tc && typeof tc === 'object' && !Array.isArray(tc)) {
    for (const [dim, desc] of Object.entries(tc as Record<string, unknown>)) {
      next.comparisonEntries.push({
        comparison_tools: [],
        dimension: dim,
        comparison_detail: String(desc ?? ''),
        importedAt,
      });
    }
  }

  const scenarios = Array.isArray(result.scenarios) ? result.scenarios : [];
  for (const raw of scenarios) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const s = raw as Record<string, unknown>;
    next.scenarioEntries.push({
      industry: String(s.industry ?? ''),
      description: String(s.description ?? ''),
      function_achieved: String(s.function_achieved ?? ''),
      products_used: Array.isArray(s.products_used) ? s.products_used.map((x) => String(x)) : [],
      importedAt,
    });
  }

  return next;
}
