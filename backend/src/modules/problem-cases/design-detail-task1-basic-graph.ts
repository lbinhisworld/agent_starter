/**
 * [INPUT]: 无外部 IO；与 `DesignDetailTaskToken` / `DesignFeatureNode` / `DesignLogicLink` 字段语义对齐
 * [OUTPUT]: 将设计详情 Task1「客户基本信息」提炼 JSON 展平为 token + 特征节点；**不写** `DesignLogicLink`（`linkPairs` 恒空，任务 1 逻辑链由产品另行定义后再接）
 * [POS]: problem-cases 子模块；由 `ProblemCaseService.syncDesignDetailTask1BasicInfoGraph` 调用
 *
 * [PROTOCOL]: 变更 Task1 字段顺序、featureId 规则或是否写逻辑边时，须同步本文件与 `frontend-vue` 画布列 `CUSTOMER_BASIC_CANVAS_FIELD_ROWS`；`DesignDetailTaskToken.tokens` **仅单元素**：已知字段为 **中文标题**（`FIELD_LABEL_ZH`），未知字段为键名（可能仍为英文）；**不**再并列写入英文 snake_case；取值仅在 `DesignFeatureNode.value`；`DesignFeatureNode.surfaceTokens`（列 `TokenStr`）与 token 行 `tokens` 一致（冗余）；排查库中仍见 `["中文","english_key"]` 时控制台过滤 **`[problem-case:task1-basic-graph]`**
 */

/** 与 `useDesignDetailChat.ts` 中 `CUSTOMER_BASIC_CANVAS_FIELD_ROWS` 顺序一致，用于稳定排序 */
export const DESIGN_TASK1_BASIC_FIELD_ORDER: readonly string[] = [
  'company_name',
  'credit_code',
  'legal_representative',
  'established_date',
  'registered_capital',
  'is_listed',
  'listing_location',
  'business_scope',
  'core_qualifications',
  'official_website',
];

const FIELD_LABEL_ZH: Readonly<Record<string, string>> = {
  company_name: '企业名称',
  credit_code: '统一社会信用代码',
  legal_representative: '法定代表人',
  established_date: '成立日期',
  registered_capital: '注册资本',
  is_listed: '是否上市',
  listing_location: '上市地点',
  business_scope: '经营范围',
  core_qualifications: '核心资质',
  official_website: '官网',
};

/** Task1 设计线内部任务 id，与 `designModeTaskPipeline.customer_basic` 一致（GET task-graph 聚合键；**非** `DesignDetailTaskToken.taskId` 落库值） */
export const DESIGN_DETAIL_TASK1_LINE_TASK_ID = 'customer_basic';

export function buildTask1FeatureId(caseId: string, fieldKey: string): string {
  return `dd:${caseId}:cb:${fieldKey}`;
}

/** 为空的特征值不写 `DesignFeatureNode`：`null` / `undefined`、空白串、空数组、空对象 */
export function isTask1FeatureValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/** 从提炼结果对象得到有序字段列表（跳过 `__` 元键）；未知键按字典序排在预定义顺序之后 */
export function orderedBasicInfoFieldEntries(basicInfo: unknown): Array<{ key: string; value: unknown }> {
  if (!basicInfo || typeof basicInfo !== 'object' || Array.isArray(basicInfo)) return [];
  const raw = basicInfo as Record<string, unknown>;
  const keys = Object.keys(raw).filter((k) => typeof k === 'string' && k.length > 0 && !k.startsWith('__'));
  const preset = new Set(DESIGN_TASK1_BASIC_FIELD_ORDER);
  const inOrder = DESIGN_TASK1_BASIC_FIELD_ORDER.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !preset.has(k)).sort((a, b) => a.localeCompare(b));
  const orderedKeys = [...inOrder, ...rest];
  return orderedKeys.map((key) => ({ key, value: raw[key] }));
}

export type Task1BasicGraphRowForDb = {
  fieldKey: string;
  featureId: string;
  /** `DesignDetailTaskToken.tokens`：多形态字符串，供检索/对齐 */
  tokenSurfaces: string[];
  /** `DesignFeatureNode.value`（仅当 `hasFeature` 为真时落库） */
  featureValue: unknown;
  /** 非空值才写特征行 */
  hasFeature: boolean;
};

export type Task1BasicGraphPlan = {
  rows: Task1BasicGraphRowForDb[];
  /** 任务 1 当前不生成 `DesignLogicLink`，恒为空数组 */
  linkPairs: ReadonlyArray<{ sourceFeatureId: string; targetFeatureId: string; logic: string; weight: number }>;
};

/** 控制台诊断：与 `syncDesignDetailTask1BasicInfoGraph` 联查「为何 tokens 仍含英文」 */
function logTask1BasicGraphPlanBuilt(caseId: string, rows: Task1BasicGraphRowForDb[]): void {
  try {
    const cid = String(caseId || '').trim() || '—';
    console.log('[problem-case:task1-basic-graph] buildTask1BasicGraphPlan', {
      caseId: cid,
      rowCount: rows.length,
      rows: rows.map((r) => ({
        fieldKey: r.fieldKey,
        tokenSurfaces: r.tokenSurfaces,
        tokenElementCount: r.tokenSurfaces.length,
        hasFeature: r.hasFeature,
        labelResolved: FIELD_LABEL_ZH[r.fieldKey] !== undefined,
      })),
    });
    for (const r of rows) {
      if (r.tokenSurfaces.length > 1) {
        console.warn('[problem-case:task1-basic-graph] tokenSurfaces 元素多于 1（预期仅中文单元素；若库中仍双元素多为旧数据未重同步或请求未命中本后端版本）', {
          caseId: cid,
          fieldKey: r.fieldKey,
          tokenSurfaces: r.tokenSurfaces,
        });
      }
    }
  } catch {
    /* 诊断日志失败不影响主路径 */
  }
}

export function buildTask1BasicGraphPlan(caseId: string, basicInfo: unknown): Task1BasicGraphPlan {
  const entries = orderedBasicInfoFieldEntries(basicInfo);
  const rows: Task1BasicGraphRowForDb[] = [];

  for (const { key, value } of entries) {
    /** 与逻辑弹层 Token 列一致：库内只存中文展示名（已知字段），不存 `["中文","english_key"]` 双段 */
    const labelZh = FIELD_LABEL_ZH[key];
    const tokenPrimary = String((labelZh !== undefined ? labelZh : key) || '').trim();
    const tokenSurfaces: string[] = tokenPrimary ? [tokenPrimary] : [];
    if (tokenSurfaces.length === 0) {
      const fk = String(key || '').trim();
      if (fk) tokenSurfaces.push(fk);
    }

    const normalized = value === undefined ? null : value;
    const hasFeature = !isTask1FeatureValueEmpty(normalized);

    rows.push({
      fieldKey: key,
      featureId: buildTask1FeatureId(caseId, key),
      tokenSurfaces,
      featureValue: normalized,
      hasFeature,
    });
  }

  logTask1BasicGraphPlanBuilt(caseId, rows);
  return { rows, linkPairs: [] };
}
