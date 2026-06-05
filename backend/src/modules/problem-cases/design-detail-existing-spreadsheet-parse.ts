/**
 * [INPUT]: 用户需求原文、LLM 提炼 JSON 中的 `existingSpreadsheets`
 * [OUTPUT]: 解析/合并 **用户原文明确点名的表名**（非「数据表 1」占位、非字段语义归纳）；供 `design-detail-customer-req-section-graph.ts` 与前端 `task1BusinessInsight.js` 同口径
 * [POS]: problem-cases / 设计详情 task1 现有表格
 *
 * [PROTOCOL]: 正则或归纳规则变更时须同步 `frontend/js/task1BusinessInsight.js` 与 `design-detail-customer-req-section-graph.test.ts`
 */

export type ExistingSpreadsheetRow = {
  tableName: string;
  columnHeaders: string[];
};

const FIELD_SPLIT_RE = /[,，、;；]\s*/u;

/** 是否为无业务含义的「数据表 N」占位名 */
export function isGenericSpreadsheetTablePlaceholder(name: string): boolean {
  const compact = String(name || '')
    .trim()
    .replace(/\s+/g, '');
  if (!compact) return true;
  if (compact === '数据表') return true;
  return /^数据表[\d０-９一二三四五六七八九十百千]+$/.test(compact);
}

/** 是否为可用于落库/同步的**具名**表（用户原文或 LLM 逐字给出的业务表名，非编号占位） */
export function isExplicitExistingSpreadsheetTableName(name: string): boolean {
  const tn = String(name || '').trim();
  if (!tn || isGenericSpreadsheetTablePlaceholder(tn)) return false;
  return true;
}

/** @deprecated 产品口径已禁止按字段推测表名；保留仅供历史测试对照 */
export function inferTableNameFromColumnHeaders(headers: ReadonlyArray<string>): string {
  const blob = headers.join(' ');
  const rules: ReadonlyArray<{ name: string; test: RegExp }> = [
    { name: '密炼排产与机台状态表', test: /密炼|机台|排产|车间|留样|报警|状态位/ },
    { name: '配方与化学品主数据表', test: /配方|CAS|化学品|添加剂|母体|安全.*浮动|研发员|签字/ },
    { name: '前线接单与订单业务表', test: /接单|订单|合同|办事处|交付|业务员工号|沟通群/ },
    { name: '客户与组织主数据表', test: /客户|信用代码|办事处|所有权/ },
  ];
  for (const r of rules) {
    if (r.test.test(blob)) return r.name;
  }
  const first = String(headers[0] ?? '').trim();
  if (first) {
    const arr = Array.from(first);
    const short = arr.length > 12 ? `${arr.slice(0, 11).join('')}…` : first;
    return `${short}字段表`;
  }
  return '业务数据表';
}

/** 丢弃无具名表名的行（不再根据 columnHeaders 归纳表名） */
export function refineExistingSpreadsheetTableNames(
  rows: ReadonlyArray<ExistingSpreadsheetRow>,
): ExistingSpreadsheetRow[] {
  return rows
    .map((row) => ({
      tableName: String(row.tableName || '').trim(),
      columnHeaders: [...row.columnHeaders],
    }))
    .filter((row) => isExplicitExistingSpreadsheetTableName(row.tableName) && row.columnHeaders.length > 0);
}

function splitFieldList(blob: string): string[] {
  return String(blob || '')
    .split(FIELD_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

function headersSignature(headers: ReadonlyArray<string>): string {
  return [...headers].sort().join('\u0001');
}

type BucketState = { tableName: string; columnHeaders: string[] };

function ingestSpreadsheetRow(
  order: string[],
  buckets: Map<string, BucketState>,
  tableName: string,
  headers: ReadonlyArray<string>,
): void {
  const tn = String(tableName || '').trim();
  const parts = headers.map((h) => String(h ?? '').trim()).filter(Boolean);
  if (!tn || parts.length === 0) return;
  const sig = headersSignature(parts);
  const existing = buckets.get(sig);
  if (!existing) {
    buckets.set(sig, { tableName: tn, columnHeaders: [...parts] });
    order.push(sig);
    return;
  }
  if (isGenericSpreadsheetTablePlaceholder(existing.tableName) && !isGenericSpreadsheetTablePlaceholder(tn)) {
    existing.tableName = tn;
  }
  for (const p of parts) {
    if (!existing.columnHeaders.includes(p)) existing.columnHeaders.push(p);
  }
}

function ingestSpreadsheetBlock(
  order: string[],
  buckets: Map<string, BucketState>,
  tableName: string,
  fieldBlob: string,
): void {
  ingestSpreadsheetRow(order, buckets, tableName, splitFieldList(fieldBlob));
}

/**
 * 从用户需求原文解析现有 Excel/表格块（仅具名：《》/「」/ 业务表名：（字段）/ 数据表 N-具体名称：（字段））。
 * 不含「数据表 N：（字段）」纯编号块——无明确表名时不提炼。
 */
export function parseExistingSpreadsheetsFromRequirementText(text: string): ExistingSpreadsheetRow[] {
  const raw = String(text ?? '');
  if (!raw.trim()) return [];

  const order: string[] = [];
  const buckets = new Map<string, BucketState>();
  const consumed: Array<{ start: number; end: number }> = [];

  const markConsumed = (m: RegExpExecArray) => {
    consumed.push({ start: m.index, end: m.index + m[0].length });
  };

  const overlapsConsumed = (index: number, len: number): boolean => {
    const end = index + len;
    return consumed.some((c) => index < c.end && end > c.start);
  };

  // 《表名》：（字段）
  const bookTitleRe = /《([^》]{2,48})》\s*[:：]\s*[（(]([^）)]*)[）)]/gu;
  let m: RegExpExecArray | null;
  while ((m = bookTitleRe.exec(raw)) !== null) {
    markConsumed(m);
    ingestSpreadsheetBlock(order, buckets, m[1]!, m[2]!);
  }

  // 「表名」：（字段）
  const quoteRe = /「([^」]{2,48})」\s*[:：]\s*[（(]([^）)]*)[）)]/gu;
  while ((m = quoteRe.exec(raw)) !== null) {
    if (overlapsConsumed(m.index, m[0].length)) continue;
    markConsumed(m);
    ingestSpreadsheetBlock(order, buckets, m[1]!, m[2]!);
  }

  // 数据表N-具体名称：（字段） / 数据表 N — 名称
  const numberedNamedRe =
    /数据表\s*([\d０-９一二三四五六七八九十百千]+)\s*[-—－·]\s*([^\s：:（(\n]{2,48})\s*[:：]\s*[（(]([^）)]*)[）)]/gu;
  while ((m = numberedNamedRe.exec(raw)) !== null) {
    if (overlapsConsumed(m.index, m[0].length)) continue;
    markConsumed(m);
    ingestSpreadsheetBlock(order, buckets, String(m[2]!).trim(), m[3]!);
  }

  // 业务表名（以 表/台账/清单/明细/主数据/报表 结尾）：（字段）
  const namedSuffixRe =
    /(?:^|[；;\n\r])([^；;\n\r]{2,48}?(?:表|台账|清单|明细|主数据|报表))\s*[:：]\s*[（(]([^）)]*)[）)]/gu;
  while ((m = namedSuffixRe.exec(raw)) !== null) {
    if (overlapsConsumed(m.index, m[0].length)) continue;
    const name = String(m[1]!).trim();
    if (isGenericSpreadsheetTablePlaceholder(name)) continue;
    markConsumed(m);
    ingestSpreadsheetBlock(order, buckets, name, m[2]!);
  }

  const rows = order.map((sig) => buckets.get(sig)!);
  return refineExistingSpreadsheetTableNames(rows);
}

/** LLM 与正文解析按字段集合并集；**优先保留非占位 tableName** */
export function mergeExistingSpreadsheetsParsed(
  parsed: Record<string, unknown>,
  fromText: ReadonlyArray<ExistingSpreadsheetRow>,
): Record<string, unknown> {
  const out = { ...parsed };
  const llmList: ExistingSpreadsheetRow[] = [];
  const llmRaw = parsed.existingSpreadsheets;
  if (Array.isArray(llmRaw)) {
    for (const item of llmRaw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const o = item as Record<string, unknown>;
      const tableName = typeof o.tableName === 'string' ? o.tableName.trim() : '';
      const headers = Array.isArray(o.columnHeaders)
        ? o.columnHeaders
            .map((x) => (typeof x === 'string' ? x.trim() : ''))
            .filter(Boolean)
        : [];
      if (tableName && headers.length) llmList.push({ tableName, columnHeaders: headers });
    }
  }

  const order: string[] = [];
  const buckets = new Map<string, BucketState>();

  for (const row of llmList) {
    ingestSpreadsheetRow(order, buckets, row.tableName, row.columnHeaders);
  }
  for (const row of fromText) {
    ingestSpreadsheetRow(order, buckets, row.tableName, row.columnHeaders);
  }

  let arr = order.map((sig) => buckets.get(sig)!);
  arr = refineExistingSpreadsheetTableNames(arr);
  if (arr.length) out.existingSpreadsheets = arr;
  else delete out.existingSpreadsheets;
  return out;
}
