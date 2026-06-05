/**
 * [INPUT]: task-graph tasks[]（任务 10 落库特征）
 * [OUTPUT]: 设计报告静态轴：第四章字段同步对账 + 第五章 Schema 对账总账（零 LLM）
 * [POS]: `runDesignReportHybridEngine` JS 直刷路由
 *
 * [PROTOCOL]: 仅读取 `跨平台接口同步Schema` / `物理表结构Schema` 的 featureValue 嵌套 JSON
 */

import type { Task2L1TaskGraphFeatureRow } from './buildTask2L1InferenceInputFromTaskGraph';
import {
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
  DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
} from './designDetailLogicGraphMerge';

export type DesignReportFieldMappingRow = {
  sourceColumn: string;
  flowLabel: string;
  targetColumn: string;
  formatCorrection: string;
};

export type DesignReportFieldSyncSection = {
  featureId: string;
  interfaceName: string;
  communicationCategory: string;
  dataPipeline: string;
  techHostPlatform: string;
  triggerSummary: string;
  receiverSummary: string;
  mappings: DesignReportFieldMappingRow[];
};

export type DesignReportSchemaFieldRow = {
  fieldName: string;
  dataType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  refTable: string;
  refField: string;
  remark: string;
};

export type DesignReportSchemaTableSection = {
  featureId: string;
  tableName: string;
  tableCategory: string;
  techHostPlatform: string;
  fields: DesignReportSchemaFieldRow[];
};

export type DesignReportStaticPayload = {
  fieldSyncSections: DesignReportFieldSyncSection[];
  schemaTables: DesignReportSchemaTableSection[];
  emptyStaticMessage?: string;
};

const SCHEMA_KEY = '物理表结构Schema';
const SYNC_KEY = '跨平台接口同步Schema';

function tokenKeyOne(tokenDisplay: string): string {
  const td = String(tokenDisplay ?? '').trim();
  return td.includes('·') ? (td.split(/\s*·\s*/)[0]?.trim() ?? td) : td;
}

function parseFeatureValueObject(name: unknown): Record<string, unknown> | null {
  if (name === null || name === undefined) return null;
  if (typeof name === 'object' && !Array.isArray(name)) return name as Record<string, unknown>;
  if (typeof name === 'string') {
    const s = name.trim();
    if (!s || s === '[object Object]') return null;
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

function unwrapFeatureValueRoot(parsed: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!parsed) return null;
  const inner = parsed.Feature_Value ?? parsed.feature_value;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return parsed;
}

function readFeatureValuePayload(feature: Task2L1TaskGraphFeatureRow): Record<string, unknown> | null {
  const ext = feature as Task2L1TaskGraphFeatureRow & {
    featureValue?: unknown;
    feature_value?: unknown;
  };
  const sources: unknown[] = [
    ext.featureValue,
    ext.feature_value,
    feature.name,
    feature.operator,
  ];
  for (const src of sources) {
    const parsed = unwrapFeatureValueRoot(parseFeatureValueObject(src));
    if (!parsed) continue;
    if (String(parsed['接口名称'] ?? '').trim()) return parsed;
    if (Array.isArray(parsed['两端全中文点对点字段映射字典'])) return parsed;
    if (Array.isArray(parsed['字段集合']) || Array.isArray(parsed['字段信息'])) return parsed;
    const table = String(
      parsed['表格名称'] ?? parsed['表格名'] ?? parsed['表名'] ?? '',
    ).trim();
    if (table) return parsed;
  }
  return null;
}

function readTechHost(feature: Task2L1TaskGraphFeatureRow, parsed: Record<string, unknown> | null): string {
  const meta = String(
    (feature as { techHostPlatform?: string }).techHostPlatform ??
      (feature as { tech_host_platform?: string }).tech_host_platform ??
      '',
  ).trim();
  if (meta) return meta;
  if (parsed) {
    return String(
      parsed.Tech_Host_Platform ?? parsed.tech_host_platform ?? parsed['工具宿主平台'] ?? '',
    ).trim();
  }
  return '';
}

function pickTask10Features(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): Task2L1TaskGraphFeatureRow[] {
  const t10 = tasks.find((t) => {
    const id = String(t?.taskId || '').trim();
    return (
      id === DESIGN_DETAIL_TASK10_LINE_TASK_ID ||
      id === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID ||
      id.includes('任务 10')
    );
  });
  return Array.isArray(t10?.features) ? t10.features : [];
}

function summarizeEndpointConfig(cfg: unknown): string {
  if (!cfg || typeof cfg !== 'object') return '—';
  const o = cfg as Record<string, unknown>;
  const platform = String(o['工具平台'] ?? '').trim();
  const table = String(o['源数据表名'] ?? o['目标数据表名'] ?? '').trim();
  const event = String(o['触发事件流'] ?? o['写入行为范式'] ?? '').trim();
  const parts = [platform, table, event].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function buildFieldSyncSections(syncFeatures: Task2L1TaskGraphFeatureRow[]): DesignReportFieldSyncSection[] {
  const sections: DesignReportFieldSyncSection[] = [];
  for (const f of syncFeatures) {
    const parsed = readFeatureValuePayload(f);
    if (!parsed) continue;
    const rawMap = parsed['两端全中文点对点字段映射字典'];
    const mappings: DesignReportFieldMappingRow[] = [];
    if (Array.isArray(rawMap)) {
      for (const item of rawMap) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        mappings.push({
          sourceColumn: String(o['源企微表格列名'] ?? '').trim() || '—',
          flowLabel: String(o['流向'] ?? '──►').trim() || '──►',
          targetColumn: String(o['目标低代码主表字段'] ?? '').trim() || '—',
          formatCorrection: String(o['数据格式校正'] ?? '').trim() || '—',
        });
      }
    }
    sections.push({
      featureId: String(f.featureId ?? '').trim(),
      interfaceName: String(parsed['接口名称'] ?? '').trim() || '（未命名接口）',
      communicationCategory: String(parsed['通信类别'] ?? '').trim(),
      dataPipeline: String(parsed['数据管道载体'] ?? '').trim(),
      techHostPlatform: readTechHost(f, parsed),
      triggerSummary: summarizeEndpointConfig(parsed['触发源配置']),
      receiverSummary: summarizeEndpointConfig(parsed['接收端配置']),
      mappings,
    });
  }
  return sections.sort((a, b) => a.interfaceName.localeCompare(b.interfaceName, 'zh-CN'));
}

function parseSchemaFieldRows(parsed: Record<string, unknown>): DesignReportSchemaFieldRow[] {
  const raw =
    parsed['字段集合'] ?? parsed['字段信息'] ?? parsed['字段列表'] ?? parsed.fields;
  if (!Array.isArray(raw)) return [];
  const rows: DesignReportSchemaFieldRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const fieldName = String(o['字段名称'] ?? o['字段名'] ?? o.name ?? '').trim();
    if (!fieldName) continue;
    const pk = String(o['主键约束'] ?? '').trim();
    const fkFlag = String(o['是否外键'] ?? '').trim();
    rows.push({
      fieldName,
      dataType: String(o['数据类型'] ?? '').trim() || '—',
      isPrimaryKey: pk === '是',
      isForeignKey: fkFlag === '是',
      refTable: String(o['被引用的表名'] ?? '').trim(),
      refField: String(o['被引用的字段名'] ?? '').trim(),
      remark: String(o['备注'] ?? o['说明'] ?? '').trim(),
    });
  }
  return rows;
}

function buildSchemaTables(schemaFeatures: Task2L1TaskGraphFeatureRow[]): DesignReportSchemaTableSection[] {
  const tables: DesignReportSchemaTableSection[] = [];
  for (const f of schemaFeatures) {
    const parsed = readFeatureValuePayload(f);
    if (!parsed) continue;
    const tableName = String(
      parsed['表格名称'] ?? parsed['表格名'] ?? parsed['表名'] ?? '',
    ).trim();
    const fields = parseSchemaFieldRows(parsed);
    if (!tableName && !fields.length) continue;
    tables.push({
      featureId: String(f.featureId ?? '').trim(),
      tableName: tableName || '（未命名表）',
      tableCategory: String(parsed['表格类别'] ?? parsed['表类别'] ?? '').trim(),
      techHostPlatform: readTechHost(f, parsed),
      fields,
    });
  }
  const catOrder = (c: string) => (c.includes('主表') ? 0 : c.includes('基础') ? 1 : 2);
  return tables.sort((a, b) => {
    const ca = catOrder(a.tableCategory);
    const cb = catOrder(b.tableCategory);
    if (ca !== cb) return ca - cb;
    return a.tableName.localeCompare(b.tableName, 'zh-CN');
  });
}

/** 静态直刷轴：从任务 10 DAG 资产组装第四、五章（禁止 LLM） */
export function buildDesignReportStaticFromTaskGraph(
  tasks: ReadonlyArray<{ taskId?: string; features?: Task2L1TaskGraphFeatureRow[] }>,
): DesignReportStaticPayload {
  const all = pickTask10Features(tasks);
  const syncFeatures = all.filter((f) => tokenKeyOne(String(f.tokenDisplay ?? '')) === SYNC_KEY);
  const schemaFeatures = all.filter((f) => tokenKeyOne(String(f.tokenDisplay ?? '')) === SCHEMA_KEY);

  const fieldSyncSections = buildFieldSyncSections(syncFeatures);
  const schemaTables = buildSchemaTables(schemaFeatures);

  if (!fieldSyncSections.length && !schemaTables.length) {
    return {
      fieldSyncSections: [],
      schemaTables: [],
      emptyStaticMessage:
        '未解析到任务 10 物理对账资产。请确认已完成任务 10 落库，且 task-graph 含 featureValue 与「跨平台接口同步Schema」「物理表结构Schema」。',
    };
  }

  return { fieldSyncSections, schemaTables };
}
