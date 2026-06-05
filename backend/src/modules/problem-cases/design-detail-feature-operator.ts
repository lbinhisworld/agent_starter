/**
 * [INPUT]: 任意原始比较符（模型 JSON、历史 `eq`/`=`/`CONTAINS` 等）
 * [OUTPUT]: `DesignFeatureNode.operator` 规范中文八值之一（长度 ≤64）；供写库与 `GET …/design-detail/task-graph` 端点 DTO 归一化
 * [POS]: problem-cases / 设计详情推理图
 *
 * [PROTOCOL]: 别名表或规范枚举变更时须同步 `prisma-problem-case.repository.ts`（`insertDesignFeatureNodeFeatureRow`）、`task1BusinessInsight.js` 任务 2 L1 提示词（含 `Target_KV` 摘要键 **inference_summary**）、`design-detail-task2-l1-target-kv-tokens.ts`、`schema.prisma` 中本字段三斜杠说明、`docs/agents/backend/01-context.md`
 */

/** 对外契约：特征比较符仅允许以下八种中文表述 */
export const DESIGN_DETAIL_FEATURE_OPERATORS = [
  '等于',
  '不等于',
  '小于',
  '大于',
  '小于等于',
  '大于等于',
  '包含',
  '属于',
] as const;

const CANONICAL = new Set<string>(DESIGN_DETAIL_FEATURE_OPERATORS as unknown as string[]);

function preprocess(raw: string): string {
  return raw
    .trim()
    .replace(/≠/g, '!=')
    .replace(/＝/g, '=')
    .replace(/＜/g, '<')
    .replace(/＞/g, '>')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=');
}

/**
 * 将模型或历史落库中的比较符统一为 **等于 / 不等于 / 小于 / 大于 / 小于等于 / 大于等于 / 包含 / 属于** 之一。
 * 无法识别时回退为「等于」（避免写入空串或超长噪声）。
 */
export function normalizeDesignDetailFeatureOperator(raw: unknown): string {
  const s0 = String(raw ?? '').trim();
  if (!s0) return '等于';
  if (CANONICAL.has(s0)) return s0;

  const p = preprocess(s0);
  if (CANONICAL.has(p)) return p;

  if (p === '<=') return '小于等于';
  if (p === '>=') return '大于等于';
  if (p === '!==' || p === '!=' || p === '<>') return '不等于';
  if (p === '=' || p === '==') return '等于';
  if (p === '<') return '小于';
  if (p === '>') return '大于';

  const pl = p.toLowerCase();
  const WORD: Record<string, string> = {
    ne: '不等于',
    neq: '不等于',
    not_equal: '不等于',
    notequal: '不等于',
    eq: '等于',
    equals: '等于',
    equal: '等于',
    lt: '小于',
    less: '小于',
    less_than: '小于',
    gt: '大于',
    greater: '大于',
    greater_than: '大于',
    le: '小于等于',
    lte: '小于等于',
    ge: '大于等于',
    gte: '大于等于',
    contains: '包含',
    contain: '包含',
    containing: '包含',
    including: '包含',
    includes: '包含',
    include: '包含',
    in: '属于',
    belongs: '属于',
    belongs_to: '属于',
    belonging: '属于',
    member_of: '属于',
  };
  const hit = WORD[pl];
  if (hit) return hit;

  if (p.toUpperCase() === 'CONTAINS') return '包含';

  return '等于';
}
