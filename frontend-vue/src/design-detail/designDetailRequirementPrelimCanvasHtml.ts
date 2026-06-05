/**
 * [INPUT]: 设计详情客户需求提炼 JSON 片段（与 `CUSTOMER_REQUIREMENT_CANVAS_FIELDS` 对齐）及可选 `coreBusinessEntities`（仅状态矩阵 entity 名归一）
 * [OUTPUT]: 与详情页初步需求 **view** 分区同构的 HTML 字符串（`dd-prelim-*` 区壳 + 与 `DesignDetailRequirementCoreEntitiesPanel` 一致的 **`dd-req-cbe-*` 子卡**；供 `DesignDetailRequirementPrelimPanels.vue` 注入）；**不**执行 Mermaid 渲染，矩阵区展示转移列表 + Mermaid 源码块；状态矩阵按实体分组时剥除 `entity` 末尾 ` (1)` / `（１）` 等与后端 `design-detail-customer-req-section-graph.ts` 一致，避免同名序号重复分桶
 * [POS]: 设计详情「需求提炼」画布子 Tab 专用展示层
 *
 * [PROTOCOL]: 布局与字段顺序须与 `frontend/js/preliminaryRequirement.js` 中同名 builder（商业背景 / 状态矩阵 / 痛点 / IT 现状 / 人员组织与价值流 / 分析备注等）保持语义对齐；痛点 / IT / 运营 / 管理资源 / 路线图 / 分析师备注等子卡 DOM 与 **`DesignDetailRequirementCoreEntitiesPanel` 的 `dd-req-cbe-*` 一致**（样式由 `DesignDetailRequirementPrelimPanels.vue` 在 `.dd-prelim-root` 下复刻）；**现有表格**：`buildExistingSpreadsheetsHtml` 输出 `dd-prelim-ess-stack` 等宽纵向子卡、**绿色表名 + Excel 图标**（`designDetailExcelFieldIconUrl`）+ `dd-prelim-ess-chip` 横向 pill；**痛点雷达**：`IT 缺口` 嵌于「痛点表现」块内（`buildPainPointManifestWithEmbeddedItGap`）；`mergedPainPointRadarLayout` 时按 `dimension` 分类 `details` 垂直排列，组内 `dd-prelim-pp-merged-item-grid` 一行 4 卡；变更其一须同步审查本文件与上述 Vue 样式
 */

import { DESIGN_DETAIL_EXCEL_FIELD_ICON_URL } from './designDetailExcelFieldIconUrl';

export type DesignDetailPrelimSectionKey =
  | 'businessContext'
  | 'stateTransitionMatrix'
  | 'painPointRadar'
  | 'itLandscape'
  | 'existingSpreadsheets'
  | 'operationModel'
  | 'managementResources'
  | 'roadmap';

/** `buildDesignDetailRequirementSectionHtml` 可选展示变体（如合并需求痛点雷达按类别折叠 + 网格） */
export type BuildDesignDetailRequirementSectionOptions = {
  mergedPainPointRadarLayout?: boolean;
  /** 痛点雷达 Tab 顶部「核心痛点总结」正文（可与 `value` 数组分传） */
  corePainPointSummary?: string;
};

const PRELIM_BC_TOP_ORDER = ['clientName', 'industryDomain', 'orgTopology'] as const;
const PRELIM_BC_TOP_LABELS: Record<string, string> = {
  clientName: '企业/项目名称',
  industryDomain: '行业与商业模式',
  orgTopology: '组织拓扑',
};
const PRELIM_PP_CORE_SUMMARY_LABEL = '核心痛点总结';
/** 已迁至痛点雷达 `corePainPointSummary`，商业背景区不再展示 */
const PRELIM_BC_LEGACY_HIDDEN_KEYS = new Set(['businessStatus', 'digitalMaturity']);
const PRELIM_BC_ORG_ORDER = ['type', 'scale', 'dataIsolation', 'managementDepth'] as const;
const PRELIM_BC_ORG_LABELS: Record<string, string> = {
  type: '拓扑类型',
  scale: '规模与扩张',
  dataIsolation: '数据隔离与审计汇总',
  managementDepth: '管理层级',
};
const PRELIM_PP_RADAR_LABELS = { description: '痛点表现', itGap: 'IT 缺口' };
const PRELIM_STM_EDGE_LABEL_MAX = 56;

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFallbackLabel(key: string): string {
  const s = String(key || '').replace(/_/g, ' ');
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase());
}

function safeJsonStringify(x: unknown): string {
  try {
    return JSON.stringify(x ?? null, null, 2);
  } catch {
    return String(x);
  }
}

function renderWsText(text: string): string {
  const t = String(text || '').trim();
  if (!t) return '—';
  return esc(t).replace(/\n/g, '<br>');
}

/** 与「核心业务对象」业务对象子卡一致的字段块（`innerHtml` 已为安全 HTML） */
function cbeNestField(labelZh: string, innerHtml: string, opts?: { prewrap?: boolean }): string {
  const pre = opts?.prewrap === false ? '' : ' dd-req-cbe-prewrap';
  return (
    `<div class="dd-req-cbe-nest">` +
    `<div class="dd-req-cbe-nest-h">${esc(labelZh)}</div>` +
    `<div class="dd-req-cbe-nest-b${pre}">${innerHtml}</div>` +
    `</div>`
  );
}

/** 分析备注条目中与 schema 示例重复的前缀，子卡内不再重复展示（与 preliminaryRequirement.js 一致） */
const PRELIM_ANALYST_NOTE_BOILERPLATE_RE = /^提取中发现的逻辑矛盾点[：:\s]*/u;

function splitPrelimColonTitleBody(raw: string): { title: string; body: string } {
  const s = String(raw || '').trim();
  if (!s || s === 'NOT_SPECIFIED') return { title: '', body: '' };
  const iCn = s.indexOf('：');
  const iEn = s.indexOf(':');
  let i = -1;
  if (iCn >= 0 && (iEn < 0 || iCn <= iEn)) i = iCn;
  else if (iEn >= 0) i = iEn;
  if (i < 0) return { title: '', body: s };
  const title = s.slice(0, i).trim();
  const body = s.slice(i + 1).trim();
  if (!title) return { title: '', body: s };
  return { title, body: body || '—' };
}

function normalizeOrgStakeholderTitleKey(titleRaw: string): string {
  const t = String(titleRaw || '')
    .trim()
    .replace(/\s+/g, '');
  return t || '__untitled__';
}

function parseOrgStakeholderBodyRoleTokens(body: string): string[] {
  const s = String(body || '').trim();
  if (!s || s === 'NOT_SPECIFIED') return [];
  return s
    .split(/[,，、；;]\s*|\s+(?:与|和|及)\s+/)
    .map((x) => String(x).trim())
    .filter((x) => x && x !== 'NOT_SPECIFIED');
}

function mergeOrgStakeholderTokenListsPreserveOrder(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const tok of list) {
      const trimmed = String(tok).trim();
      const nk = trimmed.replace(/\s+/g, '');
      if (!nk || seen.has(nk)) continue;
      seen.add(nk);
      out.push(trimmed);
    }
  }
  return out;
}

/** 与 `preliminaryRequirement.js` 中 `consolidateOrgAndRolesStakeholdersArray` 同构 */
function consolidateOrgAndRolesStakeholdersArray(sh: unknown[]): unknown[] {
  if (!Array.isArray(sh) || sh.length === 0) return Array.isArray(sh) ? sh.slice() : [];
  const byTitle = new Map<string, { displayTitle: string; tokensLists: string[][] }>();
  const titleOrder: string[] = [];
  const rawObjects: unknown[] = [];
  for (const item of sh) {
    if (item != null && typeof item === 'object' && !Array.isArray(item)) {
      rawObjects.push(item);
      continue;
    }
    const fullText = item == null ? '' : String(item).trim();
    if (!fullText || fullText === 'NOT_SPECIFIED') continue;
    const { title, body } = splitPrelimColonTitleBody(fullText);
    const key = normalizeOrgStakeholderTitleKey(title);
    if (!byTitle.has(key)) {
      byTitle.set(key, { displayTitle: title.trim(), tokensLists: [] });
      titleOrder.push(key);
    }
    const rec = byTitle.get(key)!;
    const bodyTokens = title.trim()
      ? parseOrgStakeholderBodyRoleTokens(body)
      : parseOrgStakeholderBodyRoleTokens(fullText);
    rec.tokensLists.push(bodyTokens);
  }
  if (titleOrder.length === 0) return sh.slice();

  const preferredOrder = ['总部角色', '分支角色'];
  function prefRank(key: string): number {
    const dt = String(byTitle.get(key)?.displayTitle || '').replace(/\s+/g, '');
    const pi = preferredOrder.findIndex((p) => p.replace(/\s+/g, '') === dt);
    return pi >= 0 ? pi : 100 + titleOrder.indexOf(key);
  }
  const sortedKeys = [...titleOrder].sort((a, b) => prefRank(a) - prefRank(b));

  const out: string[] = [];
  for (const k of sortedKeys) {
    const rec = byTitle.get(k)!;
    const merged = mergeOrgStakeholderTokenListsPreserveOrder(rec.tokensLists);
    const displayTitle = rec.displayTitle || (k === '__untitled__' ? '干系人 / 角色' : k);
    if (merged.length === 0) {
      out.push(`${displayTitle}：—`);
    } else {
      out.push(`${displayTitle}：${merged.join('、')}`);
    }
  }
  return [...out, ...rawObjects];
}

const PRELIM_ORG_ROLES_KNOWN_KEYS = ['stakeholders', 'governanceLogic', 'incentiveHooks'] as const;
const PRELIM_IT_LANDSCAPE_KNOWN_KEYS = ['legacySystems', 'integrationRequirements', 'deploymentMode'] as const;

const PRELIM_FVS_BODY_FIELD_ORDER = ['nodes', 'actor', 'scope', 'logicAndRules', 'dataAsset'] as const;
const PRELIM_FVS_FIELD_LABELS: Record<string, string> = {
  domain: '业务域',
  processName: '流程名称',
  nodes: '环节链',
  actor: '主责角色',
  scope: '组织覆盖范围',
  logicAndRules: '业务规则',
  dataAsset: '数据资产',
};
const PRELIM_FVS_SKIP = new Set(['domain', 'processName']);

const PRELIM_MR_LABELS: Record<string, string> = {
  peopleResource: '人力资源',
  financeResource: '财务资源',
  assetResource: '实物资产',
  informationAsset: '信息资产',
};

function scalarDisplayOrg(v: unknown): string {
  if (v == null) return '—';
  const t = String(v).trim();
  if (t === '' || t === 'NOT_SPECIFIED') return '—';
  return renderWsText(t);
}

function buildOrgAndRolesHtml(obj: unknown): string {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(obj))}</pre>`;
  }
  const o = obj as Record<string, unknown>;
  const cardParts: string[] = [];

  const sh = o.stakeholders;
  const shRows = Array.isArray(sh) && sh.length > 0 ? consolidateOrgAndRolesStakeholdersArray(sh) : sh;
  if (Array.isArray(shRows) && shRows.length > 0) {
    shRows.forEach((item, idx) => {
      const n = idx + 1;
      if (item != null && typeof item === 'object' && !Array.isArray(item)) {
        cardParts.push(
          `<article class="dd-req-cbe-card dd-req-cbe-card--raw" data-org-field="stakeholders" data-index="${n}">` +
            `<div class="dd-req-cbe-card-head">${esc(`干系人 ${n}`)}</div>` +
            `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">` +
            `<pre class="dd-req-cbe-raw-pre">${esc(safeJsonStringify(item))}</pre>` +
            `</div></article>`,
        );
        return;
      }
      const fullText = item == null ? '' : String(item).trim();
      if (fullText === '' || fullText === 'NOT_SPECIFIED') {
        cardParts.push(
          `<article class="dd-req-cbe-card" data-org-field="stakeholders" data-index="${n}">` +
            `<div class="dd-req-cbe-card-head">${esc(`干系人 ${n}`)}</div>` +
            `<div class="dd-req-cbe-card-body">` +
            `<div class="dd-req-cbe-nest"><div class="dd-req-cbe-nest-b dd-req-cbe-prewrap dd-prelim-org-stakeholder-value">—</div></div>` +
            `</div></article>`,
        );
        return;
      }
      const { title, body } = splitPrelimColonTitleBody(fullText);
      const head = title || `干系人 ${n}`;
      const inner = body === '' || body === '—' ? '—' : renderWsText(body);
      cardParts.push(
        `<article class="dd-req-cbe-card" data-org-field="stakeholders" data-index="${n}">` +
          `<div class="dd-req-cbe-card-head">${esc(head)}</div>` +
          `<div class="dd-req-cbe-card-body">` +
          `<div class="dd-req-cbe-nest"><div class="dd-req-cbe-nest-b dd-req-cbe-prewrap dd-prelim-org-stakeholder-value">${inner}</div></div>` +
          `</div></article>`,
      );
    });
  } else if (sh != null && !Array.isArray(sh)) {
    if (typeof sh === 'object') {
      cardParts.push(
        `<article class="dd-req-cbe-card dd-req-cbe-card--raw" data-org-field="stakeholders">` +
          `<div class="dd-req-cbe-card-head">${esc('干系人 / 角色')}</div>` +
          `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">` +
          `<pre class="dd-req-cbe-raw-pre">${esc(safeJsonStringify(sh))}</pre>` +
          `</div></article>`,
      );
    } else {
      const fullText = String(sh).trim();
      const { title, body } = splitPrelimColonTitleBody(fullText);
      const head = title || '干系人 / 角色';
      const inner =
        fullText === '' || fullText === 'NOT_SPECIFIED'
          ? '—'
          : body === '' || body === '—'
            ? '—'
            : renderWsText(body);
      cardParts.push(
        `<article class="dd-req-cbe-card" data-org-field="stakeholders">` +
          `<div class="dd-req-cbe-card-head">${esc(head)}</div>` +
          `<div class="dd-req-cbe-card-body">` +
          `<div class="dd-req-cbe-nest"><div class="dd-req-cbe-nest-b dd-req-cbe-prewrap dd-prelim-org-stakeholder-value">${inner}</div></div>` +
          `</div></article>`,
      );
    }
  }

  const gov = o.governanceLogic;
  if (gov != null && String(gov).trim() !== '' && String(gov).trim() !== 'NOT_SPECIFIED') {
    cardParts.push(
      `<article class="dd-req-cbe-card" data-org-field="governanceLogic">` +
        `<div class="dd-req-cbe-card-head">${esc('治理逻辑')}</div>` +
        `<div class="dd-req-cbe-card-body">` +
        `${cbeNestField('统分与权责', scalarDisplayOrg(gov), { prewrap: false })}` +
        `</div></article>`,
    );
  }

  const inc = o.incentiveHooks;
  if (inc != null) {
    let incInner = '';
    if (Array.isArray(inc)) {
      const parts = inc
        .map((x) => {
          if (x == null) return '';
          const t = String(x).trim();
          if (t === '' || t === 'NOT_SPECIFIED') return '';
          return renderWsText(t);
        })
        .filter(Boolean);
      incInner = parts.length ? parts.join('<br>') : '';
    } else if (typeof inc === 'object') {
      incInner = `<pre class="dd-req-cbe-raw-pre">${esc(safeJsonStringify(inc))}</pre>`;
    } else {
      const t = String(inc).trim();
      incInner = t === '' || t === 'NOT_SPECIFIED' ? '' : renderWsText(t);
    }
    if (incInner) {
      cardParts.push(
        `<article class="dd-req-cbe-card" data-org-field="incentiveHooks">` +
          `<div class="dd-req-cbe-card-head">${esc('激励挂钩')}</div>` +
          `<div class="dd-req-cbe-card-body">` +
          `${cbeNestField('利益与激励', incInner, { prewrap: false })}` +
          `</div></article>`,
      );
    }
  }

  const extraKeys = Object.keys(o).filter((k) => !(PRELIM_ORG_ROLES_KNOWN_KEYS as readonly string[]).includes(k));
  for (const k of extraKeys) {
    const v = o[k];
    if (v != null && typeof v === 'object') {
      cardParts.push(
        `<article class="dd-req-cbe-card dd-req-cbe-card--raw" data-org-field="${esc(k)}">` +
          `<div class="dd-req-cbe-card-head">${esc(formatFallbackLabel(k))}</div>` +
          `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">` +
          `<pre class="dd-req-cbe-raw-pre">${esc(safeJsonStringify(v))}</pre>` +
          `</div></article>`,
      );
    } else {
      cardParts.push(
        `<article class="dd-req-cbe-card" data-org-field="${esc(k)}">` +
          `<div class="dd-req-cbe-card-head">${esc(formatFallbackLabel(k))}</div>` +
          `<div class="dd-req-cbe-card-body">` +
          `<div class="dd-req-cbe-nest"><div class="dd-req-cbe-nest-b dd-req-cbe-prewrap">${scalarDisplayOrg(v)}</div></div>` +
          `</div></article>`,
      );
    }
  }

  if (cardParts.length === 0) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(o))}</pre>`;
  }
  return (
    `<div class="dd-prelim-pp-wrap dd-prelim-pp-wrap--org-roles">` +
    `<div class="dd-prelim-pp-strip dd-prelim-pp-strip--org-roles">${cardParts.join('')}</div></div>`
  );
}

function collectItLandscapeListStrings(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const el of v) {
      if (el == null) continue;
      if (typeof el === 'object') {
        out.push(safeJsonStringify(el));
      } else {
        const t = String(el).trim();
        if (t && t !== 'NOT_SPECIFIED') out.push(t);
      }
    }
    return out;
  }
  if (typeof v === 'object') {
    return [safeJsonStringify(v)];
  }
  const t = String(v).trim();
  if (!t || t === 'NOT_SPECIFIED') return [];
  return [t];
}

function buildItLandscapeHtml(data: unknown): string {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(data))}</pre>`;
  }
  const obj = data as Record<string, unknown>;
  function renderItLandscapeListUl(strings: string[]): string {
    if (!strings.length) {
      return `<ul class="dd-prelim-it-list dd-prelim-it-list--empty" role="list"><li>—</li></ul>`;
    }
    const lis = strings
      .map((s) => {
        if (s.indexOf('\n') >= 0) {
          return `<li><pre class="dd-prelim-it-li-pre">${esc(s)}</pre></li>`;
        }
        return `<li>${renderWsText(s)}</li>`;
      })
      .join('');
    return `<ul class="dd-prelim-it-list" role="list">${lis}</ul>`;
  }
  function itLandscapeSectionHtml(titleZh: string, dataField: string, strings: string[]): string {
    return (
      `<article class="dd-req-cbe-card" data-it-section="${esc(dataField)}">` +
      `<div class="dd-req-cbe-card-head">${esc(titleZh)}</div>` +
      `<div class="dd-req-cbe-card-body">` +
      `<div class="dd-req-cbe-nest"><div class="dd-req-cbe-nest-b">${renderItLandscapeListUl(strings)}</div></div>` +
      `</div></article>`
    );
  }
  const parts = [
    itLandscapeSectionHtml('现有系统', 'legacySystems', collectItLandscapeListStrings(obj.legacySystems)),
    itLandscapeSectionHtml('待集成系统', 'integrationRequirements', collectItLandscapeListStrings(obj.integrationRequirements)),
    itLandscapeSectionHtml('部署形态', 'deploymentMode', collectItLandscapeListStrings(obj.deploymentMode)),
  ];
  const extraKeys = Object.keys(obj).filter((k) => !(PRELIM_IT_LANDSCAPE_KNOWN_KEYS as readonly string[]).includes(k));
  for (const k of extraKeys) {
    parts.push(itLandscapeSectionHtml(formatFallbackLabel(k), k, collectItLandscapeListStrings(obj[k])));
  }
  return `<div class="dd-prelim-it-stack">${parts.join('')}</div>`;
}

/** 与 `design-detail-existing-spreadsheet-parse.ts` / `task1BusinessInsight.js` 同口径 */
function isGenericSpreadsheetTablePlaceholder(name: string): boolean {
  const compact = String(name || '')
    .trim()
    .replace(/\s+/g, '');
  if (!compact) return true;
  if (compact === '数据表') return true;
  return /^数据表[\d０-９一二三四五六七八九十百千]+$/.test(compact);
}

function resolveExistingSpreadsheetDisplayName(
  rawName: string,
  _headers: ReadonlyArray<string>,
): string {
  const tn = rawName.trim();
  if (tn && !isGenericSpreadsheetTablePlaceholder(tn)) return tn;
  return '';
}

/** `existingSpreadsheets`：每表一张等宽子卡，表头字段为横向圆角 pill */
function buildExistingSpreadsheetsHtml(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) {
    return `<p class="dd-prelim-empty">—</p>`;
  }
  const cards: string[] = [];
  for (let i = 0; i < data.length; i += 1) {
    const item = data[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const headers = Array.isArray(o.columnHeaders)
      ? o.columnHeaders
          .map((x) => (typeof x === 'string' ? x.trim() : ''))
          .filter(Boolean)
      : [];
    const rawTableName = typeof o.tableName === 'string' ? o.tableName : '';
    const tableName = resolveExistingSpreadsheetDisplayName(rawTableName, headers);
    if (!tableName) continue;
    const chipsHtml =
      headers.length > 0
        ? `<div class="dd-prelim-ess-chip-strip" role="list">${headers
            .map(
              (h) =>
                `<span class="dd-prelim-ess-chip" role="listitem">${renderWsText(h)}</span>`,
            )
            .join('')}</div>`
        : `<p class="dd-prelim-empty">—</p>`;
    const iconSrc = esc(DESIGN_DETAIL_EXCEL_FIELD_ICON_URL);
    cards.push(
      `<article class="dd-prelim-ess-table-card" data-ess-table="${esc(tableName)}">` +
        `<div class="dd-prelim-ess-table-card-head">` +
        `<img class="dd-prelim-ess-table-excel-icon" src="${iconSrc}" alt="" width="14" height="14" aria-hidden="true" />` +
        `<span class="dd-prelim-ess-table-title">${esc(tableName)}</span>` +
        `</div>` +
        `<div class="dd-prelim-ess-table-card-body">${chipsHtml}</div>` +
        `</article>`,
    );
  }
  if (!cards.length) return `<p class="dd-prelim-empty">—</p>`;
  return `<div class="dd-prelim-ess-stack">${cards.join('')}</div>`;
}

function fvsFieldValueHtml(v: unknown): string {
  if (v === undefined || v === null) {
    return '<p class="dd-prelim-fvs-field-empty">—</p>';
  }
  if (typeof v === 'object') {
    return `<pre class="dd-prelim-section-json dd-prelim-fvs-json-pre">${esc(safeJsonStringify(v))}</pre>`;
  }
  const t = String(v).trim();
  if (t === '' || t === 'NOT_SPECIFIED') {
    return '<p class="dd-prelim-fvs-field-empty">—</p>';
  }
  return `<div class="dd-prelim-fvs-field-scalar">${renderWsText(t)}</div>`;
}

function buildFullValueStreamsHtml(arr: unknown): string {
  if (!Array.isArray(arr) || arr.length === 0) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(arr))}</pre>`;
  }
  const byDomain = new Map<string, { item: unknown; idx: number }[]>();
  arr.forEach((item, idx) => {
    let domainKey = '未分类领域';
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const d = (item as Record<string, unknown>).domain;
      if (d != null && String(d).trim() !== '' && String(d).trim() !== 'NOT_SPECIFIED') {
        domainKey = String(d).trim();
      }
    } else if (item != null) {
      domainKey = '其他';
    }
    if (!byDomain.has(domainKey)) byDomain.set(domainKey, []);
    byDomain.get(domainKey)!.push({ item, idx });
  });

  const domainSections: string[] = [];
  byDomain.forEach((entries, domainLabel) => {
    const processCards = entries
      .map(({ item, idx }) => {
        const n = idx + 1;
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return (
            `<article class="dd-req-cbe-card dd-req-cbe-card--raw" data-fvs-index="${n}">` +
            `<div class="dd-req-cbe-card-head">${esc(`流程 ${n}`)}</div>` +
            `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">` +
            `<pre class="dd-prelim-section-json dd-prelim-fvs-json-pre dd-req-cbe-raw-pre">${esc(safeJsonStringify(item))}</pre>` +
            `</div></article>`
          );
        }
        const it = item as Record<string, unknown>;
        const pName = it.processName != null ? String(it.processName).trim() : '';
        const headTitle = pName !== '' && pName !== 'NOT_SPECIFIED' ? pName : `流程 ${n}`;
        const fvsOrderStr = PRELIM_FVS_BODY_FIELD_ORDER as readonly string[];
        const keys = [
          ...PRELIM_FVS_BODY_FIELD_ORDER.filter((k) => Object.prototype.hasOwnProperty.call(it, k)),
          ...Object.keys(it).filter((k) => !fvsOrderStr.includes(k) && !PRELIM_FVS_SKIP.has(k)),
        ];
        let bodyInner: string;
        if (keys.length === 0) {
          bodyInner = '<p class="dd-prelim-fvs-field-empty">—</p>';
        } else {
          const rows = keys
            .map((k) => {
              const lbl = PRELIM_FVS_FIELD_LABELS[k] || formatFallbackLabel(k);
              return cbeNestField(lbl, fvsFieldValueHtml(it[k]), { prewrap: false });
            })
            .join('');
          bodyInner = rows;
        }
        return (
          `<article class="dd-req-cbe-card" data-fvs-index="${n}">` +
          `<div class="dd-req-cbe-card-head">${esc(headTitle)}</div>` +
          `<div class="dd-req-cbe-card-body">${bodyInner}</div></article>`
        );
      })
      .join('');
    const processCount = entries.length;
    domainSections.push(
      `<section class="dd-req-cbe-cat dd-prelim-fvs-domain" data-fvs-domain="${esc(domainLabel)}">` +
        `<header class="dd-req-cbe-cat-head">` +
        `<span class="dd-req-cbe-cat-icon" aria-hidden="true">◇</span>` +
        `<span class="dd-req-cbe-cat-title">${esc(domainLabel)}</span>` +
        `<span class="dd-prelim-fvs-domain-head-count" title="该类目下流程条数">${esc(`(${processCount})`)}</span>` +
        `</header>` +
        `<div class="dd-req-cbe-cat-body"><div class="dd-req-cbe-grid dd-prelim-fvs-domain-grid">${processCards}</div></div>` +
        `</section>`,
    );
  });
  return `<div class="dd-prelim-fvs-stack">${domainSections.join('')}</div>`;
}

const OM_BLOCK_ORDER = ['orgAndRoles', 'fullValueStreams', 'valueStreamMapping', 'businessProcess'] as const;

function buildOperationModelHtml(data: unknown): string {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(data))}</pre>`;
  }
  const om = data as Record<string, unknown>;
  const blocks: string[] = [];

  const org = om.orgAndRoles;
  if (org != null && typeof org === 'object' && !Array.isArray(org)) {
    blocks.push(
      `<article class="dd-req-cbe-card dd-prelim-om-top-card" aria-label="人员组织">` +
        `<div class="dd-req-cbe-card-head">${esc('人员组织')}</div>` +
        `<div class="dd-req-cbe-card-body">${buildOrgAndRolesHtml(org)}</div></article>`,
    );
  }

  const fvs = om.fullValueStreams;
  if (Array.isArray(fvs) && fvs.length > 0) {
    blocks.push(
      `<article class="dd-req-cbe-card dd-prelim-om-top-card" aria-label="业务流程">` +
        `<div class="dd-req-cbe-card-head">${esc('业务流程（价值流）')}</div>` +
        `<div class="dd-req-cbe-card-body">${buildFullValueStreamsHtml(fvs)}</div></article>`,
    );
  }

  const orderedExtra = [
    ...OM_BLOCK_ORDER.filter((k) => Object.prototype.hasOwnProperty.call(om, k) && k !== 'orgAndRoles' && k !== 'fullValueStreams'),
    ...Object.keys(om).filter((k) => !OM_BLOCK_ORDER.includes(k as (typeof OM_BLOCK_ORDER)[number])),
  ];
  const seen = new Set<string>(['orgAndRoles', 'fullValueStreams']);
  for (const k of orderedExtra) {
    if (seen.has(k)) continue;
    seen.add(k);
    const v = om[k];
    if (v === undefined) continue;
    if ((k === 'valueStreamMapping' || k === 'businessProcess') && v != null && typeof v === 'object') {
      blocks.push(
        `<article class="dd-req-cbe-card dd-req-cbe-card--raw dd-prelim-om-top-card" aria-label="${esc(k)}">` +
          `<div class="dd-req-cbe-card-head">${esc(formatFallbackLabel(k))}</div>` +
          `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">` +
          `<pre class="dd-prelim-section-json dd-req-cbe-raw-pre">${esc(safeJsonStringify(v))}</pre>` +
          `</div></article>`,
      );
      continue;
    }
    blocks.push(
      `<article class="dd-req-cbe-card dd-req-cbe-card--raw dd-prelim-om-top-card">` +
        `<div class="dd-req-cbe-card-head">${esc(formatFallbackLabel(k))}</div>` +
        `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw"><pre class="dd-prelim-section-json dd-req-cbe-raw-pre">${esc(safeJsonStringify(v))}</pre></div>` +
        `</article>`,
    );
  }

  if (blocks.length === 0) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(om))}</pre>`;
  }
  return `<div class="dd-prelim-om-stack">${blocks.join('')}</div>`;
}

function buildManagementResourcesHtml(data: unknown): string {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(data))}</pre>`;
  }
  const d = data as Record<string, unknown>;
  const order = ['peopleResource', 'financeResource', 'assetResource', 'informationAsset'].filter((k) =>
    Object.prototype.hasOwnProperty.call(d, k),
  );
  const rest = Object.keys(d).filter((k) => !order.includes(k));
  const keys = [...order, ...rest];
  const parts = keys.map((key) => {
    const v = d[key];
    const title = PRELIM_MR_LABELS[key] || formatFallbackLabel(key);
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      return (
        `<article class="dd-req-cbe-card">` +
        `<div class="dd-req-cbe-card-head">${esc(title)}</div>` +
        `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">` +
        `<pre class="dd-req-cbe-raw-pre">${esc(safeJsonStringify(v))}</pre>` +
        `</div></article>`
      );
    }
    if (Array.isArray(v)) {
      return (
        `<article class="dd-req-cbe-card">` +
        `<div class="dd-req-cbe-card-head">${esc(title)}</div>` +
        `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">` +
        `<pre class="dd-req-cbe-raw-pre">${esc(safeJsonStringify(v))}</pre>` +
        `</div></article>`
      );
    }
    const text = v == null ? '' : typeof v === 'boolean' ? (v ? '是' : '否') : String(v).trim();
    const inner = text === '' || text === 'NOT_SPECIFIED' ? '—' : renderWsText(text);
    return (
      `<article class="dd-req-cbe-card">` +
      `<div class="dd-req-cbe-card-head">${esc(title)}</div>` +
      `<div class="dd-req-cbe-card-body">` +
      `<div class="dd-req-cbe-nest"><div class="dd-req-cbe-nest-b dd-req-cbe-prewrap">${inner}</div></div>` +
      `</div></article>`
    );
  });
  return `<div class="dd-prelim-bc-tree"><div class="dd-prelim-req-card-stack">${parts.join('')}</div></div>`;
}

function buildRoadmapPhaseCard(title: string, phase: unknown): string {
  if (phase == null || typeof phase !== 'object' || Array.isArray(phase)) {
    return (
      `<article class="dd-req-cbe-card dd-req-cbe-card--raw">` +
      `<div class="dd-req-cbe-card-head">${esc(title)}</div>` +
      `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">` +
      `<pre class="dd-prelim-section-json dd-req-cbe-raw-pre">${esc(safeJsonStringify(phase))}</pre>` +
      `</div></article>`
    );
  }
  const p = phase as Record<string, unknown>;
  const focus = p.focus != null ? String(p.focus).trim() : '';
  const del = p.deliverables;
  let delBlock = '';
  if (Array.isArray(del) && del.length > 0) {
    const lis = del
      .map((x) => {
        const t = x == null ? '' : String(x).trim();
        if (!t || t === 'NOT_SPECIFIED') return '';
        return `<li>${renderWsText(t)}</li>`;
      })
      .filter(Boolean)
      .join('');
    if (lis) {
      delBlock = cbeNestField('交付项', `<ul class="dd-prelim-rm-del-list" role="list">${lis}</ul>`, { prewrap: false });
    }
  }
  const focusHtml = focus && focus !== 'NOT_SPECIFIED' ? renderWsText(focus) : '—';
  const extraKeys = Object.keys(p).filter((k) => !['focus', 'deliverables'].includes(k));
  const extra = extraKeys
    .map((k) => {
      const v = p[k];
      return cbeNestField(formatFallbackLabel(k), fvsFieldValueHtml(v), { prewrap: false });
    })
    .join('');
  return (
    `<article class="dd-req-cbe-card">` +
    `<div class="dd-req-cbe-card-head">${esc(title)}</div>` +
    `<div class="dd-req-cbe-card-body">` +
    `${cbeNestField('重点', focusHtml, { prewrap: true })}` +
    delBlock +
    extra +
    `</div></article>`
  );
}

function buildRoadmapHtml(data: unknown): string {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(data))}</pre>`;
  }
  const r = data as Record<string, unknown>;
  const parts: string[] = [];
  if (r.phase1_Critical != null) {
    parts.push(buildRoadmapPhaseCard('优先上线（第一阶段）', r.phase1_Critical));
  }
  if (r.phase2_Strategic != null) {
    parts.push(buildRoadmapPhaseCard('后续上线（战略阶段）', r.phase2_Strategic));
  }
  const urg = r.overallUrgency;
  if (urg != null && String(urg).trim() !== '' && String(urg).trim() !== 'NOT_SPECIFIED') {
    parts.push(
      `<article class="dd-req-cbe-card">` +
        `<div class="dd-req-cbe-card-head">${esc('整体紧急度')}</div>` +
        `<div class="dd-req-cbe-card-body">` +
        `<div class="dd-req-cbe-nest"><div class="dd-req-cbe-nest-b dd-req-cbe-prewrap">${renderWsText(String(urg))}</div></div>` +
        `</div></article>`,
    );
  }
  const known = new Set(['phase1_Critical', 'phase2_Strategic', 'overallUrgency']);
  for (const k of Object.keys(r)) {
    if (known.has(k)) continue;
    parts.push(
      `<article class="dd-req-cbe-card dd-req-cbe-card--raw">` +
        `<div class="dd-req-cbe-card-head">${esc(formatFallbackLabel(k))}</div>` +
        `<div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">` +
        `<pre class="dd-prelim-section-json dd-req-cbe-raw-pre">${esc(safeJsonStringify(r[k]))}</pre>` +
        `</div></article>`,
    );
  }
  if (parts.length === 0) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(r))}</pre>`;
  }
  return `<div class="dd-prelim-rm-stack">${parts.join('')}</div>`;
}

function stripPrelimAnalystNoteBoilerplate(text: string): string {
  return String(text ?? '')
    .replace(PRELIM_ANALYST_NOTE_BOILERPLATE_RE, '')
    .trim();
}

function buildAnalystNotesPanelInner(arr: unknown[]): string {
  const cards = arr
    .map((item, idx) => {
      const n = idx + 1;
      const raw =
        typeof item === 'string'
          ? item
          : item != null && typeof item === 'object'
            ? safeJsonStringify(item)
            : String(item ?? '');
      const cleaned = typeof item === 'string' ? stripPrelimAnalystNoteBoilerplate(raw) : raw.trim();
      const body =
        cleaned && cleaned !== 'NOT_SPECIFIED'
          ? typeof item === 'string'
            ? renderWsText(cleaned)
            : `<pre class="dd-prelim-section-json dd-prelim-an-note-pre dd-req-cbe-raw-pre">${esc(cleaned)}</pre>`
          : '<span class="dd-prelim-an-note-empty">—</span>';
      return (
        `<article class="dd-req-cbe-card" data-index="${n}">` +
        `<div class="dd-req-cbe-card-head">${esc(`备注 ${n}`)}</div>` +
        `<div class="dd-req-cbe-card-body">` +
        `<div class="dd-req-cbe-nest"><div class="dd-req-cbe-nest-b dd-req-cbe-prewrap">${body}</div></div>` +
        `</div></article>`
      );
    })
    .join('');
  return `<div class="dd-prelim-an-notes-stack">${cards}</div>`;
}

function buildAnalystNotesHtml(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(data))}</pre>`;
  }
  return `<div class="dd-prelim-an-notes-wrap">${buildAnalystNotesPanelInner(data)}</div>`;
}

function normalizeCoreEntityNameKey(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s || s === 'NOT_SPECIFIED') return '';
  return s.replace(/\s+/g, '');
}

function buildCanonicalEntityNameLookup(coreEntities: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(coreEntities)) return map;
  for (const e of coreEntities) {
    if (!e || typeof e !== 'object') continue;
    const disp = String((e as Record<string, unknown>).entityName ?? '').trim();
    if (!disp || disp === 'NOT_SPECIFIED') continue;
    const k = normalizeCoreEntityNameKey(disp);
    if (!k) continue;
    if (!map.has(k)) map.set(k, disp);
  }
  return map;
}

/** 与后端 `stripStateTransitionEntityDuplicateSuffix` 对齐：去 `entity` 末尾编号尾缀（含全角数字） */
function stripPrelimStmEntityDuplicateSuffix(raw: string): string {
  let s = String(raw ?? '').trim();
  for (let n = 0; n < 8; n += 1) {
    const next = s.replace(/[\s]*[(（][\s]*\p{Nd}+[\s]*[)）][\s]*$/u, '').trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** 归并键：剥尾缀后去空白；空实体 → `__unnamed__`（与后端 `normalizeStateTransitionEntityGroupKey` 一致） */
function normalizePrelimStmEntityGroupKeyFromRaw(raw: string): string {
  const base = stripPrelimStmEntityDuplicateSuffix(raw);
  const compact = base.replace(/\s+/g, '');
  return compact.length > 0 ? compact : '__unnamed__';
}

function resolveStateMatrixEntityDisplayName(rawEntity: unknown, canonicalMap: Map<string, string>): string {
  const raw = rawEntity != null ? String(rawEntity).trim() : '';
  if (!raw || raw === 'NOT_SPECIFIED') return '未命名对象';
  const k = normalizeCoreEntityNameKey(raw);
  if (k && canonicalMap.size > 0 && canonicalMap.has(k)) return canonicalMap.get(k)!;
  return raw;
}

function preliminaryStateTransitionItemKey(item: Record<string, unknown>): string {
  const a = [
    stripPrelimStmEntityDuplicateSuffix(String(item.entity ?? '').trim()),
    String(item.fromState ?? '').trim(),
    String(item.toState ?? '').trim(),
    String(item.triggerEvent ?? '').trim(),
  ].join('\u0001');
  if (a.replace(/\u0001/g, '').trim() !== '') return a;
  try {
    return `__json__${JSON.stringify(item)}`;
  } catch {
    return '__unknown__';
  }
}

function dedupeStateTransitionMatrixRows(arr: unknown[]): Record<string, unknown>[] {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const map = new Map<string, Record<string, unknown>>();
  const order: string[] = [];
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const k = preliminaryStateTransitionItemKey(r);
    if (!map.has(k)) {
      map.set(k, { ...r });
      order.push(k);
    } else {
      map.set(k, { ...map.get(k)!, ...r });
    }
  }
  return order.map((k) => map.get(k)!);
}

function prelimStmNormalizeState(raw: unknown): string {
  if (raw == null) return '（未指定状态）';
  const s = String(raw).trim();
  if (!s || s === 'NOT_SPECIFIED') return '（未指定状态）';
  return s;
}

function prelimStmEscapeMermaidQuotedLabel(text: unknown, maxLen: number): string {
  let s = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, ' ');
  s = s
    .replace(/["|\\]/g, ' ')
    .replace(/\|/g, '｜')
    .replace(/\[/g, '［')
    .replace(/\]/g, '］')
    .replace(/#/g, '＃')
    .replace(/</g, '＜')
    .replace(/>/g, '＞');
  s = s.trim();
  if (!s) s = '—';
  const ch = Array.from(s);
  return ch.length <= maxLen ? s : ch.slice(0, Math.max(1, maxLen - 1)).join('') + '…';
}

function prelimStmBuildEdgeLabel(row: Record<string, unknown>): string {
  const parts: string[] = [];
  const tr = row.triggerEvent != null ? String(row.triggerEvent).trim() : '';
  if (tr && tr !== 'NOT_SPECIFIED') parts.push(tr);
  const act = row.actor != null ? String(row.actor).trim() : '';
  if (act && act !== 'NOT_SPECIFIED') parts.push(`角色：${act}`);
  const label = parts.length ? parts.join(' · ') : '转移';
  return prelimStmEscapeMermaidQuotedLabel(label, PRELIM_STM_EDGE_LABEL_MAX);
}

function prelimStmAppendEntitySubgraph(
  lines: string[],
  subgraphId: string,
  entLabel: string,
  list: Record<string, unknown>[],
): void {
  const titleEsc = prelimStmEscapeMermaidQuotedLabel(entLabel, 72);
  lines.push(`  subgraph ${subgraphId}["${titleEsc}"]`);
  lines.push('    direction LR');
  const stateKeyToId = new Map<string, string>();
  let n = 0;
  const getId = (rawState: unknown) => {
    const k = prelimStmNormalizeState(rawState);
    if (!stateKeyToId.has(k)) {
      stateKeyToId.set(k, `${subgraphId}_n${n++}`);
    }
    return stateKeyToId.get(k)!;
  };
  for (const r of list) {
    getId(r.fromState);
    getId(r.toState);
  }
  for (const [stateLabel, nid] of stateKeyToId) {
    const disp = prelimStmEscapeMermaidQuotedLabel(stateLabel, 48);
    lines.push(`    ${nid}["${disp}"]`);
  }
  for (const r of list) {
    const a = getId(r.fromState);
    const b = getId(r.toState);
    const lb = prelimStmBuildEdgeLabel(r);
    lines.push(`    ${a} -->|"${lb}"| ${b}`);
  }
  lines.push('  end');
}

function buildStateTransitionMatrixMermaidSourceForEntity(entLabel: string, list: Record<string, unknown>[]): string {
  if (!Array.isArray(list) || list.length === 0) return '';
  const lines = ['flowchart TB'];
  prelimStmAppendEntitySubgraph(lines, 'PE0', entLabel, list);
  return lines.join('\n');
}

function prelimStmGroupMatrixRowsByEntity(
  matrix: unknown[],
  canonicalEntityMap: Map<string, string>,
): Array<{ display: string; rows: Record<string, unknown>[] }> {
  if (!Array.isArray(matrix) || matrix.length === 0) return [];
  const rows = matrix.filter((r) => r && typeof r === 'object' && !Array.isArray(r)) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const buckets = new Map<string, Record<string, unknown>[]>();
  const orderKeys: string[] = [];

  for (const r of rows) {
    const raw = r.entity != null ? String(r.entity).trim() : '';
    const gk =
      !raw || raw === 'NOT_SPECIFIED' ? '__unnamed__' : normalizePrelimStmEntityGroupKeyFromRaw(raw);
    if (!buckets.has(gk)) {
      buckets.set(gk, []);
      orderKeys.push(gk);
    }
    buckets.get(gk)!.push(r);
  }

  return orderKeys.map((gk) => {
    const list = buckets.get(gk)!;
    const first = list[0]!;
    const rawFirst = first.entity != null ? String(first.entity).trim() : '';
    const display =
      gk === '__unnamed__'
        ? '未命名对象'
        : resolveStateMatrixEntityDisplayName(stripPrelimStmEntityDuplicateSuffix(rawFirst), canonicalEntityMap);
    return { display, rows: list };
  });
}

function buildPrelimStmTransitionRowsListHtml(list: Record<string, unknown>[]): string {
  if (!list.length) return '';
  const parts: string[] = [];
  for (let j = 0; j < list.length; j++) {
    const r = list[j];
    const from = r.fromState != null ? String(r.fromState).trim() : '—';
    const to = r.toState != null ? String(r.toState).trim() : '—';
    const trig = r.triggerEvent != null ? String(r.triggerEvent).trim() : '';
    const actor = r.actor != null ? String(r.actor).trim() : '';
    const guardsRaw = r.guards;
    let guards = '';
    if (guardsRaw != null && typeof guardsRaw === 'object') {
      try {
        guards = JSON.stringify(guardsRaw);
      } catch {
        guards = String(guardsRaw);
      }
    } else if (guardsRaw != null) {
      guards = String(guardsRaw).trim();
    }
    const metaBits: string[] = [];
    if (trig) metaBits.push(`触发：${trig}`);
    if (actor) metaBits.push(`执行方：${actor}`);
    if (guards) metaBits.push(`守卫：${guards.length > 120 ? `${guards.slice(0, 120)}…` : guards}`);
    const meta = metaBits.join(' · ');
    parts.push(
      `<div class="dd-prelim-stm-transition-item" role="listitem">` +
        `<div class="dd-prelim-stm-transition-main"><span class="dd-prelim-stm-transition-idx">${j + 1}.</span> ` +
        `<strong>${esc(from)}</strong> <span class="dd-prelim-stm-transition-arrow" aria-hidden="true">→</span> <strong>${esc(to)}</strong></div>` +
        (meta ? `<div class="dd-prelim-stm-transition-meta">${esc(meta)}</div>` : '') +
        `</div>`,
    );
  }
  return `<div class="dd-prelim-stm-transition-list" role="list">${parts.join('')}</div>`;
}

function buildBcNestedCard(
  title: string,
  obj: Record<string, unknown>,
  depth: number,
  maxNest: number,
): string {
  const order = [
    ...Object.keys(obj).filter((k) => Object.prototype.hasOwnProperty.call(obj, k)),
  ].sort();
  const bodyHtml = order
    .map((k) => {
      const v = obj[k];
      const lbl = PRELIM_BC_TOP_LABELS[k] || formatFallbackLabel(k);
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        if (depth >= maxNest) {
          return `<div class="dd-prelim-bc-nested-row"><span class="dd-prelim-bc-nested-label">${esc(lbl)}</span><pre class="dd-prelim-bc-inline-pre">${esc(safeJsonStringify(v))}</pre></div>`;
        }
        return `<div class="dd-prelim-bc-nested-slot">${buildBcNestedCard(lbl, v as Record<string, unknown>, depth + 1, maxNest)}</div>`;
      }
      if (Array.isArray(v)) {
        return `<div class="dd-prelim-bc-nested-row"><span class="dd-prelim-bc-nested-label">${esc(lbl)}</span><pre class="dd-prelim-bc-inline-pre">${esc(safeJsonStringify(v))}</pre></div>`;
      }
      const text = v == null ? '' : typeof v === 'boolean' ? (v ? '是' : '否') : String(v).trim();
      const inner = text === '' ? '—' : renderWsText(text);
      return `<div class="dd-prelim-bc-nested-row"><span class="dd-prelim-bc-nested-label">${esc(lbl)}</span><div class="dd-prelim-bc-nested-value">${inner}</div></div>`;
    })
    .join('');
  return `<div class="dd-prelim-bc-subcard" data-depth="${depth}">
      <div class="dd-prelim-bc-subcard-head">${esc(title)}</div>
      <div class="dd-prelim-bc-subcard-body">${bodyHtml}</div>
    </div>`;
}

function buildOrgTopologyHorizontalSubcardHtml(obj: Record<string, unknown>): string {
  const headTitle = PRELIM_BC_TOP_LABELS.orgTopology || '组织拓扑';
  const order = [
    ...PRELIM_BC_ORG_ORDER.filter((k) => Object.prototype.hasOwnProperty.call(obj, k)),
    ...Object.keys(obj).filter((k) => !PRELIM_BC_ORG_ORDER.includes(k)),
  ];
  const cards = order
    .map((k) => {
      const v = obj[k];
      const lbl = PRELIM_BC_ORG_LABELS[k] || formatFallbackLabel(k);
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        const inner = `<pre class="dd-prelim-pp-pre">${esc(safeJsonStringify(v))}</pre>`;
        return `<article class="dd-prelim-pp-card dd-prelim-pp-card--org-topo" data-field="${esc(k)}">
            <div class="dd-prelim-pp-card-head">${esc(lbl)}</div>
            <div class="dd-prelim-pp-card-body dd-prelim-pp-card-body--scalar">${inner}</div>
          </article>`;
      }
      if (Array.isArray(v)) {
        const inner = `<pre class="dd-prelim-pp-pre">${esc(safeJsonStringify(v))}</pre>`;
        return `<article class="dd-prelim-pp-card dd-prelim-pp-card--org-topo" data-field="${esc(k)}">
            <div class="dd-prelim-pp-card-head">${esc(lbl)}</div>
            <div class="dd-prelim-pp-card-body dd-prelim-pp-card-body--scalar">${inner}</div>
          </article>`;
      }
      const text = v == null ? '' : String(v).trim();
      const inner = text ? renderWsText(text) : '—';
      return `<article class="dd-prelim-pp-card dd-prelim-pp-card--org-topo" data-field="${esc(k)}">
          <div class="dd-prelim-pp-card-head">${esc(lbl)}</div>
          <div class="dd-prelim-pp-card-body dd-prelim-pp-card-body--scalar">
            <div class="dd-prelim-pp-row-value">${inner}</div>
          </div>
        </article>`;
    })
    .join('');
  return `<div class="dd-prelim-bc-subcard" data-depth="1" data-org-topology-layout="horizontal">
      <div class="dd-prelim-bc-subcard-head">${esc(headTitle)}</div>
      <div class="dd-prelim-bc-subcard-body dd-prelim-bc-subcard-body--org-hstrip">
        <div class="dd-prelim-pp-wrap dd-prelim-pp-wrap--nested-in-bc">
          <div class="dd-prelim-pp-strip dd-prelim-pp-strip--org-equal">${cards}</div>
        </div>
      </div>
    </div>`;
}

function buildBusinessContextHtml(data: unknown): string {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(data))}</pre>`;
  }
  const d = data as Record<string, unknown>;
  const topOrderSet = new Set<string>(PRELIM_BC_TOP_ORDER as unknown as string[]);
  const keys = [
    ...PRELIM_BC_TOP_ORDER.filter((k) => Object.prototype.hasOwnProperty.call(d, k)),
    ...Object.keys(d).filter((k) => !topOrderSet.has(k) && !PRELIM_BC_LEGACY_HIDDEN_KEYS.has(k)),
  ];
  const parts = keys
    .filter((key) => !PRELIM_BC_LEGACY_HIDDEN_KEYS.has(key))
    .map((key) => {
    const v = d[key];
    const title = PRELIM_BC_TOP_LABELS[key] || formatFallbackLabel(key);
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      if (key === 'orgTopology') {
        return buildOrgTopologyHorizontalSubcardHtml(v as Record<string, unknown>);
      }
      return buildBcNestedCard(title, v as Record<string, unknown>, 1, 5);
    }
    if (Array.isArray(v)) {
      return `<div class="dd-prelim-bc-field">
          <span class="dd-prelim-bc-field-label">${esc(title)}</span>
          <pre class="dd-prelim-bc-field-pre">${esc(safeJsonStringify(v))}</pre>
        </div>`;
    }
    const text = v == null ? '' : typeof v === 'boolean' ? (v ? '是' : '否') : String(v).trim();
    const inner = text === '' ? '—' : renderWsText(text);
    return `<div class="dd-prelim-bc-field">
        <span class="dd-prelim-bc-field-label">${esc(title)}</span>
        <div class="dd-prelim-bc-field-value">${inner}</div>
      </div>`;
  });
  return `<div class="dd-prelim-bc-tree"><div class="dd-prelim-bc-fields">${parts.join('')}</div></div>`;
}

/** 与产品常见痛点维度顺序一致；其余类别按拼音/ locale 排在后面 */
const PAIN_RADAR_CATEGORY_ORDER = ['系统', '人', '财', '物', '事', '管控'] as const;

function sortPainRadarCategoryKeys(keys: string[]): string[] {
  const orderSet = new Set<string>(PAIN_RADAR_CATEGORY_ORDER as unknown as string[]);
  const first: string[] = [];
  for (const k of PAIN_RADAR_CATEGORY_ORDER) {
    if (keys.includes(k)) first.push(k);
  }
  const rest = keys.filter((k) => !orderSet.has(k)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  return [...first, ...rest];
}

/** 「痛点表现」大块内嵌「IT 缺口」子卡；缺口正文类由样式标红 */
function buildPainPointManifestWithEmbeddedItGap(descHtml: string, gapHtml: string): string {
  return (
    `<div class="dd-req-cbe-nest dd-prelim-pp-manifest-nest">` +
    `<div class="dd-req-cbe-nest-h">${esc(PRELIM_PP_RADAR_LABELS.description)}</div>` +
    `<div class="dd-req-cbe-nest-b">` +
    `<div class="dd-prelim-pp-desc dd-req-cbe-prewrap">${descHtml}</div>` +
    `<div class="dd-prelim-pp-itgap-subcard">` +
    `<div class="dd-prelim-pp-itgap-subcard-h">${esc(PRELIM_PP_RADAR_LABELS.itGap)}</div>` +
    `<div class="dd-prelim-pp-itgap-subcard-b dd-req-cbe-prewrap">${gapHtml}</div>` +
    `</div></div></div>`
  );
}

function buildPainPointRadarExtraFieldsHtml(it: Record<string, unknown>): string {
  const extraKeys = Object.keys(it).filter((k) => !['dimension', 'description', 'itGap'].includes(k));
  return extraKeys
    .map((k) => {
      const v = it[k];
      let text = '';
      if (v != null && typeof v === 'object') {
        text = safeJsonStringify(v);
      } else if (v != null) {
        text = String(v).trim();
      }
      const inner = text ? renderWsText(text) : '—';
      return cbeNestField(formatFallbackLabel(k), inner, { prewrap: true });
    })
    .join('');
}

/** 合并需求视图下：同类多条时子卡标题（避免与外层类别重复） */
function buildPainPointRadarMergedCardHead(it: Record<string, unknown>, localIdx: number): string {
  const desc = it.description != null ? String(it.description).trim() : '';
  if (desc) {
    const { title } = splitPrelimColonTitleBody(desc);
    if (title) return title.length > 40 ? `${title.slice(0, 37)}…` : title;
    const line = desc.split(/\n/)[0]!.trim();
    if (line) return line.length > 40 ? `${line.slice(0, 37)}…` : line;
  }
  return `痛点 ${localIdx + 1}`;
}

function buildPainPointRadarSingleCard(
  item: unknown,
  idx: number,
  head: string,
  extraClass = '',
): string {
  const n = idx + 1;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return `<article class="dd-req-cbe-card dd-req-cbe-card--raw${extraClass}" data-index="${n}">
            <div class="dd-req-cbe-card-head">${esc(`条目 ${n}`)}</div>
            <div class="dd-req-cbe-card-body dd-req-cbe-card-body--raw">
              <pre class="dd-req-cbe-raw-pre">${esc(safeJsonStringify(item))}</pre>
            </div>
          </article>`;
  }
  const it = item as Record<string, unknown>;
  const desc = it.description != null ? String(it.description).trim() : '';
  const gap = it.itGap != null ? String(it.itGap).trim() : '';
  const descHtml = desc ? renderWsText(desc) : '—';
  const gapHtml = gap ? renderWsText(gap) : '—';
  const extraHtml = buildPainPointRadarExtraFieldsHtml(it);
  return `<article class="dd-req-cbe-card${extraClass}" data-index="${n}">
          <div class="dd-req-cbe-card-head">${esc(head)}</div>
          <div class="dd-req-cbe-card-body">
            ${buildPainPointManifestWithEmbeddedItGap(descHtml, gapHtml)}
            ${extraHtml}
          </div>
        </article>`;
}

function buildCorePainPointSummaryBlockHtml(summary: string): string {
  const text = String(summary || '').trim();
  if (!text) return '';
  return (
    `<div class="dd-prelim-pp-core-summary">` +
    `<div class="dd-prelim-pp-core-summary-h">${esc(PRELIM_PP_CORE_SUMMARY_LABEL)}</div>` +
    `<div class="dd-prelim-pp-core-summary-b dd-req-cbe-prewrap">${renderWsText(text)}</div>` +
    `</div>`
  );
}

function buildPainPointRadarHtml(
  arr: unknown,
  mergedCategoryLayout = false,
  corePainPointSummary = '',
): string {
  const summaryBlock = buildCorePainPointSummaryBlockHtml(corePainPointSummary);
  if (!Array.isArray(arr) || arr.length === 0) {
    if (summaryBlock) return summaryBlock;
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(arr))}</pre>`;
  }

  if (mergedCategoryLayout) {
    const byCat = new Map<string, { item: unknown; origIdx: number }[]>();
    arr.forEach((item, idx) => {
      let cat = '未分类';
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const d = (item as Record<string, unknown>).dimension;
        if (d != null && String(d).trim() !== '') cat = String(d).trim();
      }
      const list = byCat.get(cat) ?? [];
      list.push({ item, origIdx: idx });
      byCat.set(cat, list);
    });
    const catKeys = sortPainRadarCategoryKeys([...byCat.keys()]);
    const blocks: string[] = [];
    for (const cat of catKeys) {
      const rows = byCat.get(cat) ?? [];
      if (rows.length === 0) continue;
      const count = rows.length;
      const summaryTitle = `${cat}（${count}）`;
      const gridCards = rows
        .map(({ item, origIdx }, li) => {
          const head =
            item && typeof item === 'object' && !Array.isArray(item)
              ? buildPainPointRadarMergedCardHead(item as Record<string, unknown>, li)
              : `痛点 ${li + 1}`;
          return buildPainPointRadarSingleCard(item, origIdx, head, ' dd-prelim-pp-merged-grid-card');
        })
        .join('');
      blocks.push(
        `<details class="dd-prelim-pp-cat-details" open>` +
          `<summary class="dd-prelim-pp-cat-summary">` +
          `<span class="dd-prelim-pp-cat-chevron" aria-hidden="true"></span>` +
          `<span class="dd-prelim-pp-cat-title">${esc(summaryTitle)}</span>` +
          `</summary>` +
          `<div class="dd-prelim-pp-merged-item-grid">${gridCards}</div>` +
          `</details>`,
      );
    }
    const mergedBody = `<div class="dd-prelim-pp-wrap dd-prelim-pp-wrap--merged-categories"><div class="dd-prelim-pp-cat-stack">${blocks.join('')}</div></div>`;
    return summaryBlock ? `${summaryBlock}${mergedBody}` : mergedBody;
  }

  const cards = arr
    .map((item, idx) => {
      const n = idx + 1;
      let head = `痛点 ${n}`;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const dimRaw = (item as Record<string, unknown>).dimension;
        if (dimRaw != null && String(dimRaw).trim() !== '') head = String(dimRaw).trim();
      }
      return buildPainPointRadarSingleCard(item, idx, head, '');
    })
    .join('');
  const body = `<div class="dd-prelim-pp-wrap"><div class="dd-prelim-pp-strip">${cards}</div></div>`;
  return summaryBlock ? `${summaryBlock}${body}` : body;
}

function buildStateTransitionMatrixHtml(matrix: unknown, coreEntities: unknown): string {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(matrix))}</pre>`;
  }
  const deduped = dedupeStateTransitionMatrixRows(matrix as unknown[]);
  const canonMap = buildCanonicalEntityNameLookup(coreEntities);
  const byEntity = prelimStmGroupMatrixRowsByEntity(deduped, canonMap);
  if (byEntity.length === 0) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(matrix))}</pre>`;
  }
  const cells: string[] = [];
  let displayIdx = 0;
  for (const { display: entLabel, rows: list } of byEntity) {
    const src = buildStateTransitionMatrixMermaidSourceForEntity(entLabel, list);
    if (!src) continue;
    displayIdx += 1;
    const n = list.length;
    const titleWithCount = `${entLabel}（${n}）`;
    const listHtml = buildPrelimStmTransitionRowsListHtml(list);
    cells.push(
      `<div class="dd-prelim-stm-row">` +
        `<span class="dd-prelim-stm-row-index" aria-hidden="true">${displayIdx}</span>` +
        `<details class="dd-prelim-stm-entity-details" open>` +
        `<summary class="dd-prelim-stm-entity-summary">` +
        `<span class="dd-prelim-stm-entity-summary-inner">` +
        `<span class="dd-prelim-stm-entity-chevron" aria-hidden="true"></span>` +
        `<span class="dd-prelim-stm-entity-summary-title" title="${esc(titleWithCount)}">${esc(titleWithCount)}</span>` +
        `</span></summary>` +
        `<div class="dd-prelim-stm-entity-body">` +
        listHtml +
        `<div class="dd-prelim-stm-card">` +
        `<div class="dd-prelim-stm-card-head">` +
        `<span class="dd-prelim-stm-card-title">状态关系图（Mermaid 源码）</span>` +
        `</div>` +
        `<div class="dd-prelim-stm-subpanels">` +
        `<pre class="dd-prelim-stm-mermaid-src" aria-label="Mermaid flowchart 源码">${esc(src)}</pre>` +
        `</div></div></div></details></div>`,
    );
  }
  if (!cells.length) {
    return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(matrix))}</pre>`;
  }
  return `<div class="dd-prelim-stm-grid">${cells.join('')}</div>`;
}

/**
 * 生成与详情页初步需求对应分区 **结构一致** 的 HTML（类名 `dd-prelim-*` + 亮色样式由 Vue 组件提供）。
 */
export function buildDesignDetailRequirementSectionHtml(
  section: DesignDetailPrelimSectionKey,
  value: unknown,
  coreEntities?: unknown,
  options?: BuildDesignDetailRequirementSectionOptions,
): string {
  if (value === undefined || value === null) {
    return `<p class="dd-prelim-empty">—</p>`;
  }
  if (section === 'businessContext') {
    return buildBusinessContextHtml(value);
  }
  if (section === 'painPointRadar') {
    return buildPainPointRadarHtml(
      value,
      options?.mergedPainPointRadarLayout === true,
      String(options?.corePainPointSummary ?? '').trim(),
    );
  }
  if (section === 'stateTransitionMatrix') {
    return buildStateTransitionMatrixHtml(value, coreEntities);
  }
  if (section === 'itLandscape') {
    return buildItLandscapeHtml(value);
  }
  if (section === 'existingSpreadsheets') {
    return buildExistingSpreadsheetsHtml(value);
  }
  if (section === 'operationModel') {
    return buildOperationModelHtml(value);
  }
  if (section === 'managementResources') {
    return buildManagementResourcesHtml(value);
  }
  if (section === 'roadmap') {
    return buildRoadmapHtml(value);
  }
  return `<pre class="dd-prelim-section-json">${esc(safeJsonStringify(value))}</pre>`;
}
