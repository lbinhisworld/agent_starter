/**
 * [INPUT]: `buildDataArchitectureFromTaskGraph` 输出的 `DataArchitectureModel`（任务 10 物理表同源）
 * [OUTPUT]: ER 图视图模型（按工具平台大块、表块 bucket 分类、字段 pill、外键边；布局层由 `layoutErDiagramFkRefLayers` 按被引用次数分层）
 * [POS]: `DesignDetailErDiagramTab.vue`
 *
 * [PROTOCOL]: 字段取值与排序与 `buildDataArchitectureFromTaskGraph` 契约一致；变更时同步 ER Tab 与 AGENTS.md
 */

import type { DataArchitectureModel, DataArchFieldCard, DataArchLevel2Module } from './buildDataArchitectureFromTaskGraph';

export type ErFkEdge = {
  fromStableId: string;
  toStableId: string;
};

/** 单字段 pill：字段名 + 类型分两行展示，用于 FK 连线锚点 */
export type ErFieldPillModel = {
  stableId: string;
  /** @deprecated 仅排序兼容；展示请用 fieldName + dataType */
  labelText: string;
  fieldName: string;
  dataType: string;
  isPk: boolean;
  isFk: boolean;
  /** 当被引用信息齐全时可用于画线（目标按表名+字段名消解） */
  fkRefTargetTable?: string;
  fkRefTargetField?: string;
};

export type ErTableBlockModel = {
  featureId: string;
  tableName: string;
  /** ER 表头展示：`表名@平台工具名` */
  displayTableTitle: string;
  /** 子表 → 主表引用（任务 10 parent_table_ref） */
  parentTableRef?: string;
  /** 「主表」→ main；「基础表」→ base；其它 → other（置于下层灰区） */
  bucket: 'main' | 'base' | 'other';
  pills: ErFieldPillModel[];
};

export type ErPlatformModel = {
  platformKey: string;
  platformLabel: string;
  mainTables: ErTableBlockModel[];
  baseTables: ErTableBlockModel[];
  /** 类别不清晰时仍展示，归为下层延展 */
  otherTables: ErTableBlockModel[];
};

export type ErDiagramModel = {
  platforms: ErPlatformModel[];
  edges: ErFkEdge[];
  emptyMessage?: string;
};

function propValue(card: DataArchFieldCard, key: string): string {
  const p = card.properties.find((x) => x.key === key);
  return String(p?.value ?? '').trim();
}

function readConstraintRaw(card: DataArchFieldCard): string {
  for (const key of ['外键约束', '主键约束', 'constraints']) {
    const v = propValue(card, key);
    if (v) return v;
  }
  return '';
}

/** ER 表头 `@` 后缀：七巧低代码平台 / 企业微信智能表格 等 */
export function formatErPlatformToolSuffix(platformLabel: string): string {
  let s = String(platformLabel || '').trim();
  if (!s || s === '（未标注宿主平台）') return '未知平台';
  if (s.includes('七巧') || s.includes('低代码')) return '七巧低代码平台';
  if (s.includes('企微') || s.includes('企业微信')) return '企业微信智能表格';
  return s.replace(/容器$/u, '').replace(/\/轻量填报载体$/u, '').trim() || s;
}

export function buildErDisplayTableTitle(tableName: string, platformLabel: string): string {
  const tn = String(tableName || '').trim() || '（未命名表）';
  return `${tn}@${formatErPlatformToolSuffix(platformLabel)}`;
}

function normalizeTruthyBool(v: string): boolean {
  const t = v.trim().toLowerCase();
  return t === 'true' || t === 'yes' || t === '是' || t === 'y' || t === '1';
}

function normalizeTypeBucket(dataTypeRaw: string): number {
  const s = String(dataTypeRaw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!s) return 5;

  /** 数值 / 布尔 / 枚举等：桶 3 */
  if (/^(BOOL|BOOLEAN|BIT|TINYINT|SMALLINT|INT|INTEGER|BIGINT|NUMBER|DECIMAL|NUMERIC|FLOAT|DOUBLE)/.test(s)) return 3;
  if (s.includes('ENUM') || s.includes('BOOLEAN') || s.includes('NUMERIC')) return 3;

  /** 日期时间：桶 4 */
  if (/DATE|TIME|DATETIME|TIMESTAMP|年月|日期/.test(s)) return 4;

  /** 文本：桶 5 */
  if (/CHAR|TEXT|JSON|字符串|LONGTEXT|MEDIUMTEXT|NVARCHAR|VARCHAR/.test(s)) return 5;

  return 5;
}

/** 排序：主键 → 外键字段 → 数据类型桶(数值…) → 日期 → 文本/其它 → 名字 */
function cmpFieldRank(a: ErFieldPillModel, b: ErFieldPillModel): number {
  const pk = Number(b.isPk) - Number(a.isPk);
  if (pk !== 0) return pk;
  const fk = Number(b.isFk) - Number(a.isFk);
  if (fk !== 0) return fk;

  const typeA = a.dataType.trim();
  const typeB = b.dataType.trim();
  const tbA = normalizeTypeBucket(typeA);
  const tbB = normalizeTypeBucket(typeB);
  if (tbA !== tbB) return tbA - tbB;

  return a.fieldName.localeCompare(b.fieldName, 'zh-CN');
}

function parseFkRefFromScenarioConstraints(constraints: string): {
  table?: string;
  field?: string;
} {
  const s = String(constraints ?? '');
  const m = /关联至\[(?<bt>[^\]]+)\]的\[(?<bf>[^\]]+)\]字段|关联至(?<t>[^，。]+?)的(?<f>[^，。]+?)字段/u.exec(s);
  if (!m) return {};
  const table = (m.groups?.bt ?? m.groups?.t)?.trim();
  const field = (m.groups?.bf ?? m.groups?.f)?.trim();
  return { table, field };
}

function detectFieldPk(dataType: string, pkRaw: string, constraintRaw: string): boolean {
  const dt = String(dataType ?? '').trim();
  if (dt === '主键') return true;
  if (normalizeTruthyBool(pkRaw)) return true;
  if (/主键|^pk$/iu.test(pkRaw) && !/外键/u.test(pkRaw)) return true;
  if (/主键/u.test(constraintRaw) && !/外键/u.test(constraintRaw)) return true;
  if (/自动递增唯一键|AUTO_INCREMENT|PRIMARY\s*KEY/i.test(dt)) return true;
  return false;
}

function detectFieldFk(
  dataType: string,
  fkRaw: string,
  constraintRaw: string,
  fieldName: string,
): boolean {
  const dt = String(dataType ?? '').trim();
  if (dt === '外键') return true;
  if (normalizeTruthyBool(fkRaw)) return true;
  if (/^fk$/iu.test(fkRaw) || fkRaw.includes('外键')) return true;
  if (/外键/u.test(constraintRaw)) return true;
  if (/系统主键引用|FOREIGN\s*KEY/i.test(dt)) return true;
  if (/关联.*主键/u.test(fieldName)) return true;
  return false;
}

function fieldCardToPills(featureId: string, cards: DataArchFieldCard[]): ErFieldPillModel[] {
  const pills: ErFieldPillModel[] = [];
  for (const card of cards) {
    const fieldName = String(card.fieldName || '').trim();
    if (!fieldName) continue;

    const dataTypeRaw = propValue(card, '数据类型');
    const labelText = dataTypeRaw ? `${fieldName}/${dataTypeRaw}` : fieldName;

    const pkRaw = propValue(card, '主键约束');
    const fkRaw = propValue(card, '是否外键');
    const constraintRaw = readConstraintRaw(card);
    const isPk = detectFieldPk(dataTypeRaw, pkRaw, constraintRaw);
    const isFk = !isPk && detectFieldFk(dataTypeRaw, fkRaw, constraintRaw, fieldName);

    const refTb = propValue(card, '被引用的表名');
    const refFd = propValue(card, '被引用的字段名');
    const fromConstraints = parseFkRefFromScenarioConstraints(constraintRaw);

    const stableId = `${featureId}|||${fieldName}`;

    pills.push({
      stableId,
      labelText,
      fieldName,
      dataType: dataTypeRaw || '—',
      isPk,
      isFk,
      ...(refTb && refFd
        ? { fkRefTargetTable: stripTablePrefix(refTb), fkRefTargetField: stripTablePrefix(refFd) }
        : fromConstraints.table && fromConstraints.field
          ? {
              fkRefTargetTable: stripTablePrefix(fromConstraints.table),
              fkRefTargetField: stripTablePrefix(fromConstraints.field),
            }
          : {}),
    });
  }

  pills.sort(cmpFieldRank);
  return pills;
}

/** 对齐树/功能清单：`01_表格名` 剥前缀 */
export function stripTablePrefix(raw: string): string {
  const s = String(raw || '').trim();
  return s.replace(/^\d+_/, '');
}

export function classifyTableBucket(tableCategoryRaw: string): 'main' | 'base' | 'other' {
  const s = stripTablePrefix(String(tableCategoryRaw || '').trim());
  if (s.includes('主表')) return 'main';
  if (s.includes('基础')) return 'base';
  return 'other';
}

function flattenL2FromPlatform(dm: DataArchitectureModel): ErPlatformModel[] {
  return dm.platforms.map((p) => {
    const mainTables: ErTableBlockModel[] = [];
    const baseTables: ErTableBlockModel[] = [];
    const otherTables: ErTableBlockModel[] = [];

    const seenFeat = new Set<string>();

    const pushBlock = (l2: DataArchLevel2Module, platformToolLabel: string) => {
      const fid = String(l2.featureId || '').trim();
      if (!fid || seenFeat.has(fid)) return;
      seenFeat.add(fid);
      const bucket = classifyTableBucket(l2.tableCategory);
      const pills = fieldCardToPills(fid, l2.fields);
      if (!pills.length && !l2.name) return;
      const tableName = l2.name || '（未命名表）';
      const block: ErTableBlockModel = {
        featureId: fid,
        tableName,
        displayTableTitle: buildErDisplayTableTitle(tableName, platformToolLabel),
        parentTableRef: l2.parentTableRef,
        bucket,
        pills,
      };
      if (bucket === 'main') mainTables.push(block);
      else if (bucket === 'base') baseTables.push(block);
      else otherTables.push(block);
    };

    for (const l1 of p.level1Modules) {
      const platformTool =
        String(l1.techHostPlatform || '').trim() || p.platformLabel;
      for (const l2 of l1.level2Modules) {
        pushBlock(l2 as DataArchLevel2Module, platformTool);
      }
    }

    mainTables.sort((a, b) => a.tableName.localeCompare(b.tableName, 'zh-CN'));
    baseTables.sort((a, b) => a.tableName.localeCompare(b.tableName, 'zh-CN'));
    otherTables.sort((a, b) => a.tableName.localeCompare(b.tableName, 'zh-CN'));

    return {
      platformKey: p.platformKey,
      platformLabel: p.platformLabel,
      mainTables,
      baseTables,
      otherTables,
    };
  });
}

function findPkPill(tb: ErTableBlockModel): ErFieldPillModel | undefined {
  return (
    tb.pills.find((p) => p.isPk) ??
    tb.pills.find((p) => String(p.dataType ?? '').trim() === '主键') ??
    tb.pills.find((p) => /唯一标识|编码$/u.test(p.fieldName))
  );
}

function findTableByName(
  all: ErTableBlockModel[],
  tableName: string,
): ErTableBlockModel | undefined {
  const norm = stripTablePrefix(tableName);
  const direct = all.find((t) => stripTablePrefix(t.tableName) === norm);
  if (direct) return direct;
  return all.find((t) => {
    const tn = stripTablePrefix(t.tableName);
    return tn.includes(norm) || norm.includes(tn);
  });
}

function stripFkFieldPrefix(fieldName: string): string {
  return String(fieldName ?? '')
    .trim()
    .replace(/^(所属|发起|关联|对应|引用|主表|外键|关联主表|对应主表)/u, '');
}

/** constraints / 列名语义兜底：所属办事处编码 → 办事处编码 PK 等 */
function inferFkTargetByFieldSemantics(
  src: ErFieldPillModel,
  srcTable: ErTableBlockModel,
  allTables: ErTableBlockModel[],
): ErFieldPillModel | undefined {
  const fn = stripTablePrefix(src.fieldName);
  if (!fn) return undefined;

  const candidates: ErFieldPillModel[] = [];
  for (const tb of allTables) {
    for (const p of tb.pills) {
      if (!p.isPk || p.stableId === src.stableId) continue;
      candidates.push(p);
    }
  }

  const exact = candidates.find((p) => p.fieldName === fn);
  if (exact) return exact;

  const stripped = stripFkFieldPrefix(fn);
  if (stripped && stripped !== fn) {
    const byStrip = candidates.find((p) => p.fieldName === stripped);
    if (byStrip) return byStrip;
  }

  let best: ErFieldPillModel | undefined;
  let bestLen = 0;
  for (const pk of candidates) {
    const pkName = pk.fieldName;
    if (fn.endsWith(pkName) && pkName.length > bestLen) {
      best = pk;
      bestLen = pkName.length;
    }
  }
  if (best) return best;

  /** 同名字段即 PK（跨表引用同名业务键，如「插单与领料登记单编码」） */
  for (const tb of allTables) {
    if (tb.featureId === srcTable.featureId) continue;
    const pkMatch = tb.pills.find(
      (p) => p.isPk && stripTablePrefix(p.fieldName) === stripTablePrefix(fn),
    );
    if (pkMatch && pkMatch.stableId !== src.stableId) return pkMatch;
  }

  return undefined;
}

function resolveFkTargetPill(
  src: ErFieldPillModel,
  srcTable: ErTableBlockModel,
  allTables: ErTableBlockModel[],
  findTargets: (table: string, field: string) => ErFieldPillModel[],
): ErFieldPillModel | undefined {
  // 1. Explicit FK ref from constraints (highest priority)
  const rt = src.fkRefTargetTable;
  const rf = src.fkRefTargetField;
  if (rt && rf) {
    const targets = findTargets(rt, rf).filter((t) => t.stableId !== src.stableId);
    if (targets[0]) return targets[0];
    const refTb = findTableByName(allTables, rt);
    if (refTb) {
      const pk = findPkPill(refTb);
      if (pk && pk.stableId !== src.stableId) return pk;
    }
  }
  // 2. Semantic inference by field name (before parentTableRef fallback)
  const semantic = inferFkTargetByFieldSemantics(src, srcTable, allTables);
  if (semantic) return semantic;
  // 3. parentTableRef fallback (only when semantic inference finds nothing)
  const parentName = stripTablePrefix(srcTable.parentTableRef || '');
  if (parentName) {
    const parentTb = findTableByName(allTables, parentName);
    if (parentTb) {
      const pk = findPkPill(parentTb);
      if (pk && pk.stableId !== src.stableId) return pk;
    }
  }
  return undefined;
}

function resolveFkEdges(platforms: ErPlatformModel[]): ErFkEdge[] {
  const pillsByTableField = new Map<string, ErFieldPillModel[]>();

  const keyTf = (t: string, f: string) =>
    `${stripTablePrefix(t)}\u0000${stripTablePrefix(f)}`;

  for (const p of platforms) {
    const all = [...p.mainTables, ...p.baseTables, ...p.otherTables];
    for (const tb of all) {
      const tn = stripTablePrefix(tb.tableName);
      for (const pill of tb.pills) {
        const loc = `${tn}\u0000${stripTablePrefix(pill.fieldName)}`;
        const arr = pillsByTableField.get(loc) ?? [];
        arr.push(pill);
        pillsByTableField.set(loc, arr);
      }
    }
  }

  const edges: ErFkEdge[] = [];
  const seen = new Set<string>();

  function findTargets(table: string, field: string): ErFieldPillModel[] {
    return pillsByTableField.get(keyTf(table, field)) ?? [];
  }

  const globalAll = platforms.flatMap((p) => [
    ...p.mainTables,
    ...p.baseTables,
    ...p.otherTables,
  ]);

  for (const p of platforms) {
    const all = [...p.mainTables, ...p.baseTables, ...p.otherTables];
    for (const tb of all) {
      for (const src of tb.pills) {
        if (!src.isFk) continue;
        let tgt = resolveFkTargetPill(src, tb, globalAll, findTargets);
        if (!tgt) tgt = resolveFkTargetPill(src, tb, all, findTargets);
        if (!tgt) continue;
        const ek = `${src.stableId}→${tgt.stableId}`;
        if (seen.has(ek)) continue;
        seen.add(ek);
        edges.push({ fromStableId: src.stableId, toStableId: tgt.stableId });
      }
    }
  }

  return edges;
}

/** task-graph → 同源数据架构模型 → ER 结构化视图 */
export function buildErDiagramFromDataArchitecture(dm: DataArchitectureModel): ErDiagramModel {
  if (dm.emptyMessage) {
    return { platforms: [], edges: [], emptyMessage: dm.emptyMessage };
  }
  const platformsRaw = flattenL2FromPlatform(dm);
  const platforms = platformsRaw.filter((p) => p.mainTables.length + p.baseTables.length + p.otherTables.length > 0);
  if (!platforms.length) {
    return {
      platforms: [],
      edges: [],
      emptyMessage:
        dm.platforms?.length > 0
          ? '已解析宿主平台但未发现可绘制的物理表节点（检查「表格类别」与字段集合）。'
          : undefined,
    };
  }
  return {
    platforms,
    edges: resolveFkEdges(platforms),
    emptyMessage: platforms.length ? undefined : '暂无 ER 可绘内容。',
  };
}
