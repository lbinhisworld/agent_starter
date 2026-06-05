/**
 * [INPUT]: 需求提炼 JSON 中的 `coreBusinessEntities` 切片（与 `task1BusinessInsight` schema 一致）
 * [OUTPUT]: 供「需求提炼」画布子 Tab 渲染用的视图模型（人/财/物/事分组、对象卡字段），逻辑对齐 `frontend/js/preliminaryRequirement.js` 中初步需求「核心对象」Tab
 * [POS]: 设计详情页需求画布专用，不依赖 `main.js` / `preliminaryRequirement.js` 运行时
 *
 * [PROTOCOL]: 分组或截断规则变更时同步更新本 Header 与目录 `AGENTS.md`
 */

const PRELIMINARY_CBE_CONCEPT_CATEGORIES = ['人', '财', '物', '事'] as const;
export type ConceptCategory = (typeof PRELIMINARY_CBE_CONCEPT_CATEGORIES)[number];

const CATEGORY_HEAD_UI: Record<ConceptCategory, { icon: string; title: string }> = {
  人: { icon: '👤', title: '人' },
  财: { icon: '💰', title: '财' },
  物: { icon: '📦', title: '物' },
  事: { icon: '📋', title: '事' },
};

/** 与 preliminaryRequirement 中 `PRELIMINARY_CBE_CONCEPT_EXPL_MAX_UNICODE` 一致 */
const CONCEPT_EXPL_MAX_UNICODE = 100;

const LIFECYCLE_TONE_COUNT = 6;

function safeJsonStringify(x: unknown): string {
  try {
    return JSON.stringify(x ?? null, null, 2);
  } catch {
    return String(x);
  }
}

function normalizeCoreEntityConceptCategory(raw: unknown): ConceptCategory {
  const s = String(raw ?? '').trim();
  if ((PRELIMINARY_CBE_CONCEPT_CATEGORIES as readonly string[]).includes(s)) {
    return s as ConceptCategory;
  }
  return '事';
}

function getCoreEntityConceptCategoryRaw(item: Record<string, unknown>): string {
  const v = item.conceptCategory ?? item['概念类别'];
  return v != null ? String(v).trim() : '';
}

function getCoreEntityConceptExplanationRaw(item: Record<string, unknown>): string {
  const v = item.conceptExplanation ?? item['概念解释'];
  return v != null ? String(v).trim() : '';
}

/**
 * 概念解释：最多 maxChars 个 Unicode 字符；超长时优先在句末标点处收束（与 preliminaryRequirement 一致）。
 */
function truncateConceptExplanationUnicodeChars(text: string, maxChars: number): string {
  const ch = Array.from(String(text ?? ''));
  if (ch.length <= maxChars) return ch.join('');
  const slice = ch.slice(0, maxChars);
  const sentenceEnds = new Set(['。', '！', '？', '；']);
  const lookbackSentence = 40;
  const startS = Math.max(0, maxChars - lookbackSentence);
  for (let i = maxChars - 1; i >= startS; i--) {
    if (sentenceEnds.has(slice[i]!)) {
      return slice.slice(0, i + 1).join('');
    }
  }
  const lookbackComma = 22;
  const startC = Math.max(0, maxChars - lookbackComma);
  for (let i = maxChars - 1; i >= startC; i--) {
    if (slice[i] === '，' || slice[i] === '、') {
      return slice.slice(0, i + 1).join('');
    }
  }
  return slice.join('');
}

function parseLifecycleStates(item: Record<string, unknown>): string[] {
  const statesRaw = item.lifecycleStates;
  if (Array.isArray(statesRaw)) {
    return statesRaw.map((x) => String(x != null ? x : '').trim()).filter(Boolean);
  }
  if (statesRaw != null && String(statesRaw).trim() !== '') {
    return [String(statesRaw).trim()];
  }
  return [];
}

export type CoreEntityCardVm =
  | {
      kind: 'entity';
      index: number;
      title: string;
      conceptExpl: string;
      states: string[];
      ownership: string;
    }
  | {
      kind: 'raw';
      index: number;
      title: string;
      jsonPretty: string;
    };

export type CoreEntityCategoryVm = {
  category: ConceptCategory;
  icon: string;
  categoryTitle: string;
  cards: CoreEntityCardVm[];
};

export type CoreEntitiesPanelVm =
  | { mode: 'categories'; categories: CoreEntityCategoryVm[] }
  | { mode: 'fallback'; jsonText: string };

export function lifecycleChipToneIndex(index: number): number {
  return index % LIFECYCLE_TONE_COUNT;
}

function buildSingleCoreEntityCard(item: unknown, n: number): CoreEntityCardVm {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return {
      kind: 'raw',
      index: n,
      title: `条目 ${n}`,
      jsonPretty: safeJsonStringify(item),
    };
  }
  const o = item as Record<string, unknown>;
  const title =
    o.entityName != null && String(o.entityName).trim() !== ''
      ? String(o.entityName).trim()
      : `核心业务对象 ${n}`;
  const explRaw = getCoreEntityConceptExplanationRaw(o);
  const explTrunc = truncateConceptExplanationUnicodeChars(explRaw, CONCEPT_EXPL_MAX_UNICODE);
  const conceptExpl =
    explTrunc && explTrunc !== 'NOT_SPECIFIED' ? explTrunc : '';
  const states = parseLifecycleStates(o);
  const ownRaw = o.ownershipLogic != null ? String(o.ownershipLogic).trim() : '';
  const ownership = ownRaw && ownRaw !== 'NOT_SPECIFIED' ? ownRaw : '';
  return {
    kind: 'entity',
    index: n,
    title,
    conceptExpl,
    states,
    ownership,
  };
}

/**
 * 将 `coreBusinessEntities` 转为与详情页「客户基本需求 → 核心对象」Tab 同构的分组视图。
 */
export function buildCustomerRequirementCoreEntitiesPanelVm(value: unknown): CoreEntitiesPanelVm {
  if (!Array.isArray(value)) {
    return { mode: 'fallback', jsonText: safeJsonStringify(value) };
  }
  if (value.length === 0) {
    return { mode: 'fallback', jsonText: '[]' };
  }

  const byCat: Record<ConceptCategory, unknown[]> = { 人: [], 财: [], 物: [], 事: [] };
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      byCat['事'].push(item);
      continue;
    }
    const cat = normalizeCoreEntityConceptCategory(getCoreEntityConceptCategoryRaw(item as Record<string, unknown>));
    byCat[cat].push(item);
  }

  let globalIdx = 0;
  const categories: CoreEntityCategoryVm[] = PRELIMINARY_CBE_CONCEPT_CATEGORIES.map((cat) => {
    const ui = CATEGORY_HEAD_UI[cat];
    const items = byCat[cat] || [];
    const cards: CoreEntityCardVm[] = items.map((it) => {
      globalIdx += 1;
      return buildSingleCoreEntityCard(it, globalIdx);
    });
    return {
      category: cat,
      icon: ui.icon,
      categoryTitle: ui.title,
      cards,
    };
  });

  return { mode: 'categories', categories };
}
