import { isDeprecatedBusinessContextTokenSurface } from './designDetailRequirementMergeTokenPaths';

/**
 * [INPUT]: `GET …/design-detail/task-graph` 返回的 `tasks[]` 原始项
 * [OUTPUT]: 与 `DesignDetailLogicModal` 一致的 **`normLogicTaskId`**、**`isDesignDetailReverseValidationLogicLink`**（`linkKind`＋任务 2/3/4/5→任务 1 拓扑兜底）、**`buildFeatureIdToNormTaskIdFromGraphTasks`**；**`mergeCustomerRequirementIntoBasicForLogicGraph`**（`customer_requirement` 并入 `customer_basic`；**保留**任务 1 **`links[]`** 含 **`linkKind`＝「反向验证」** 供 **Tree**，**`linkCount`** 对任务 1 可置 **0** 以配合弹层头栏）；**`logicTreeInferenceLayerTierLabelByNormTaskId`**（**Tree** 行首绿色推理层级前缀 **L1-…层** / **L2-…层**）；供逻辑弹层与 **Tree** 视图复用
 * [POS]: design-detail；避免两处分叉
 *
 * [PROTOCOL]: 变更合并规则时须同步 `DesignDetailLogicModal.vue`、`DesignDetailLogicTreeModal.vue` 与本文件；任务 2 L1 落库中文 **`DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID`** / **`_LEGACY`**、任务 3 L2 **`DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID`**、任务 4 L2 **`DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID`** 须与后端 `design-detail-task-graph-catalog.ts` 一致；**`dedupeLogicGraphTasksByNormTaskId`** 与 **`canonicalLogicGraphTaskTitleByNormTaskId`**、**`logicTreeInferenceLayerTierLabelByNormTaskId`**（Tree 层标题前缀 **L1-…层** / **L2-…层**）须与后端 **`getDesignDetailTaskGraphCardTitle`** 及产品设计口径一致
 */

/** 与后端 `design-detail-task-graph-catalog.ts` 中 `DESIGN_DETAIL_TASK2_LINE_TASK_ID` 一致（GET 任务卡片 `taskId`） */
export const DESIGN_DETAIL_TASK2_LINE_TASK_ID = 'scale_org_mode_extract' as const;

/** 任务 2 L1 token 落库中文名；须与后端 `DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID` 一致 */
export const DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID = '任务 2：规模与组织模式推理' as const;

/** 历史落库中文 taskId（更名前）；`normLogicTaskId` 与「重启当前」清 LLM 审计 id 集合须兼容 */
export const DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY = '任务 2：行业与业务属性推理' as const;

/** 与后端 `design-detail-task-graph-catalog.ts` 中 `DESIGN_DETAIL_TASK3_LINE_TASK_ID` 一致 */
export const DESIGN_DETAIL_TASK3_LINE_TASK_ID = 'industry_business_profile_extract' as const;

/** 任务 3 L2 token 落库中文名；须与后端 `DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID` 一致 */
export const DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID = '任务 3：行业与业务属性推理' as const;

/** 与后端 `design-detail-task-graph-catalog.ts` 中 `DESIGN_DETAIL_TASK4_LINE_TASK_ID` 一致 */
export const DESIGN_DETAIL_TASK4_LINE_TASK_ID = 'core_value_driver_inference' as const;

/** 与后端 `design-detail-task-graph-catalog.ts` 中 `DESIGN_DETAIL_TASK5_LINE_TASK_ID` 一致 */
export const DESIGN_DETAIL_TASK5_LINE_TASK_ID = 'macro_process_flow_inference' as const;

/** 任务 5 L3 宏观流程特征落库中文名 */
export const DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID = '任务 5：L3：宏观流程特征推理' as const;

export const DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY = '任务 5：宏观业务流程推断' as const;

/** 任务 5.5 L3.5 VSM 阶段落库中文名 */
export const DESIGN_DETAIL_TASK55_LINE_TASK_ID = 'vsm_stage_decomposition' as const;

export const DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID = '任务 5.5：L3.5：价值流图 VSM 阶段拆解' as const;

/** 任务 5.1 L3.1 战略价值主张落库中文名 */
export const DESIGN_DETAIL_TASK51_LINE_TASK_ID = 'value_proposition_capability_units' as const;

export const DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID =
  '任务 5.1：企业战略价值主张与部门级业务能力编排' as const;

/** 任务 5.2 表格字段功能理解：设计线任务 id */
export const DESIGN_DETAIL_TASK52_LINE_TASK_ID = 'capability_field_set_mapping' as const;

/** 任务 5.2 落库中文 taskId */
export const DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID = '任务 5.2：表格字段功能理解' as const;

/** 更名前落库中文 taskId（读删兼容） */
export const DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID_LEGACY =
  '任务 5.2：存量 Excel 资产与业务能力字段集层次映射' as const;

/** 任务 5.3 流程环节功能理解：设计线任务 id */
export const DESIGN_DETAIL_TASK53_LINE_TASK_ID = 'key_scenario_temporal_flow_inference' as const;

/** 任务 5.3 落库中文 taskId */
export const DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID = '任务 5.3：流程环节功能理解' as const;

/** 更名前落库中文 taskId（读删兼容） */
export const DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID_LEGACY =
  '任务 5.3：跨业务能力单元关键场景时序流转串联' as const;

/** 任务 6 L3 关键场景推理落库中文名 */
export const DESIGN_DETAIL_TASK6_LINE_TASK_ID = 'pain_point_extraction' as const;

export const DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID = '任务 6：关键场景推理' as const;

/** 更名前落库中文 taskId（读删兼容） */
export const DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID_LEGACY =
  '任务 6：需求痛点与关键场景探测推理' as const;

/** 任务 6.5 L3 三维 IT-Gap 分析线步与落库中文名 */
export const DESIGN_DETAIL_TASK65_LINE_TASK_ID = 'three_dimension_itgap_analysis' as const;

export const DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID = '任务 6.5：三维 IT-Gap 分析' as const;

/** 任务 7 L4 任务节点 IT 选型落库中文名 */
export const DESIGN_DETAIL_TASK7_LINE_TASK_ID = 'key_requirement_scenarios' as const;

export const DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID = '任务 7：任务节点IT选型推理' as const;

export const DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID_LEGACY =
  '任务 7：流程具体二级协作节点拆解推理' as const;

/** 任务 8 L4.5 业务对象/FSM 落库中文名 */
export const DESIGN_DETAIL_TASK8_LINE_TASK_ID = 'role_object_stm_inference' as const;

export const DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID = '任务 8：业务对象与有限状态机矩阵推导' as const;

/** 更名前落库中文 taskId（读删兼容） */
export const DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID_LEGACY = '任务 8：角色、对象与状态转移矩阵推理' as const;

/** 任务 8.5 L4.75 物理外挂集成落库中文名 */
export const DESIGN_DETAIL_TASK85_LINE_TASK_ID = 'physical_hook_integration_inference' as const;

export const DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID = '任务 8.5：物理外挂集成推理' as const;

/** 任务 9 L5 领域容器与工具宿主落库中文名 */
export const DESIGN_DETAIL_TASK9_LINE_TASK_ID = 'business_capability_positioning' as const;

export const DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID = '任务 9：领域驱动逻辑容器与工具宿主定义推理' as const;

/** 更名前落库中文 taskId（读删兼容） */
export const DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID_LEGACY = '任务 9：系统菜单与功能模块定义推理' as const;

/** 任务 10 L5 物理建表 Schema 与 RBAC 落库中文名 */
export const DESIGN_DETAIL_TASK10_LINE_TASK_ID = 'process_type_derivation' as const;

export const DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID =
  '任务 10：物理建表 Schema 与 RBAC 初始化推理' as const;

/** 任务 4 L2 token 落库中文名；须与后端 `DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID` 一致 */
export const DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID = '任务 4：价值链分析推理' as const;

/** 更名前落库中文 taskId；`normLogicTaskId` 与 GET 聚合读库须兼容 */
export const DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY = '任务 4：核心价值驱动推理' as const;

export type DesignDetailLogicGraphFeatureDto = {
  featureId: string;
  name: string;
  themeKey?: string;
  theme_key?: string;
  pillBatchKey?: string;
  pill_batch_key?: string;
  tokenDisplay?: string;
  token_display?: string;
  operator?: string;
  valueRefDomain?: string;
  value_ref_domain?: string;
  inferenceSummary?: string;
  inference_summary?: string;
  /** 任务 1 L1：`DesignFeatureNode.value` 内 **Validation_Status**（如 `Pending` / `Resolved_By_Customer`） */
  validationStatus?: string;
  validation_status?: string;
  /** 任务 9/10：`value` JSON 内 Tech_Host_Platform；逻辑树任务 10 按宿主平台分块 */
  techHostPlatform?: string;
  tech_host_platform?: string;
  /** 任务 10：`value` JSON 内 Induction_Type（主表基准 / 主子级联纵向裂变 / 主表正向归纳派生） */
  inductionType?: string;
  induction_type?: string;
  parentTableRef?: string;
  parent_table_ref?: string;
  introductionReason?: string;
  introduction_reason?: string;
  referenceFieldMapping?: string;
  reference_field_mapping?: string;
  painPointConfirmed?: boolean;
  pain_point_confirmed?: boolean;
  painPointConfirmedByLineStepId?: string;
  pain_point_confirmed_by_line_step_id?: string;
  /** 原始 `DesignFeatureNode.value`；数据架构 Tab 解析 `字段集合` 用 */
  featureValue?: unknown;
  feature_value?: unknown;
};

export type DesignDetailLogicGraphLinkDto = {
  linkId: string;
  name: string;
  /** `DesignLogicLink.linkKind`：仅 **`正向归纳`** / **`反向验证`**（兼容旧接口英文枚举名） */
  linkKind?: '正向归纳' | '反向验证';
  /** `DesignLogicLink.validationConsistency`（Tree 反向校验边着色） */
  validationConsistency?: string;
  themeKey?: string;
  theme_key?: string;
  pillBatchKey?: string;
  pill_batch_key?: string;
  sourceFeatureId?: string;
  targetFeatureId?: string;
  logic?: string;
  weight?: number;
  source?: DesignDetailLogicGraphFeatureDto | null;
  target?: DesignDetailLogicGraphFeatureDto | null;
};

export type DesignDetailLogicGraphTaskDto = {
  taskId: string;
  title: string;
  tokenCount: number;
  featureCount: number;
  linkCount: number;
  tokens: { tokenId: string; name: string; themeKey?: string; theme_key?: string; pillBatchKey?: string; pill_batch_key?: string }[];
  features: DesignDetailLogicGraphFeatureDto[];
  links: DesignDetailLogicGraphLinkDto[];
};

export const DESIGN_DETAIL_TASK0_LINE_TASK_ID = 'optional_toolbox_primitive' as const;

export const LOGIC_GRAPH_TASK0_TITLE = '任务 0：可选工具箱非结构化原语解构';

export const LOGIC_GRAPH_TASK1_TITLE = '任务 1：客户基本情况了解';

/** 由 `GET …/task-graph` 的 `tasks[].features` 与 `links[]` 端点建立 `featureId` → 归一化线步 `taskId` */
export function buildFeatureIdToNormTaskIdFromGraphTasks(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of tasks) {
    const tid = normLogicTaskId(t.taskId);
    for (const f of t.features ?? []) {
      const fid = String(f.featureId || '').trim();
      if (fid) m.set(fid, tid);
    }
  }
  for (const t of tasks) {
    const cardTaskId = normLogicTaskId(t.taskId);
    for (const l of t.links ?? []) {
      registerLogicGraphLinkEndpointFeatureTask(m, tasks, l, 'source', cardTaskId);
      registerLogicGraphLinkEndpointFeatureTask(m, tasks, l, 'target', cardTaskId);
    }
  }
  return m;
}

function registerLogicGraphLinkEndpointFeatureTask(
  m: Map<string, string>,
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  l: DesignDetailLogicGraphLinkDto,
  role: 'source' | 'target',
  cardTaskId: string,
): void {
  const fid = String(
    role === 'source'
      ? (l.sourceFeatureId ?? l.source?.featureId ?? '')
      : (l.targetFeatureId ?? l.target?.featureId ?? ''),
  ).trim();
  if (!fid || m.has(fid)) return;
  const feat = role === 'source' ? l.source : l.target;
  const themeKey = String(feat?.themeKey ?? '').trim();
  if (themeKey === 'toolbox_primitive') {
    m.set(fid, DESIGN_DETAIL_TASK0_LINE_TASK_ID);
    return;
  }
  if (themeKey === DESIGN_DETAIL_TASK8_LINE_TASK_ID) {
    m.set(fid, DESIGN_DETAIL_TASK8_LINE_TASK_ID);
    return;
  }
  if (themeKey === DESIGN_DETAIL_TASK85_LINE_TASK_ID) {
    m.set(fid, DESIGN_DETAIL_TASK85_LINE_TASK_ID);
    return;
  }
  for (const t of tasks) {
    const tid = normLogicTaskId(t.taskId);
    for (const f of t.features ?? []) {
      if (String(f.featureId || '').trim() === fid) {
        m.set(fid, tid);
        return;
      }
    }
  }
  if (role === 'target' && cardTaskId === DESIGN_DETAIL_TASK85_LINE_TASK_ID) {
    m.set(fid, DESIGN_DETAIL_TASK85_LINE_TASK_ID);
  }
}

/**
 * 是否为 **反向验证** 边：优先 `linkKind`；若历史行误标为「正向归纳」，则按端点拓扑兜底
 *（源特征在任务 2/3/4/5、目标特征在任务 1 `customer_basic`）。
 */
export function isDesignDetailReverseValidationLogicLink(
  l: DesignDetailLogicGraphLinkDto,
  featureIdToNormTaskId: Map<string, string>,
): boolean {
  const k = String(l.linkKind ?? '').trim();
  if (k === '反向验证' || k === 'REVERSE_VALIDATION') return true;
  const sid = String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
  const tid = String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
  if (!sid || !tid) return false;
  const st = featureIdToNormTaskId.get(sid);
  const tt = featureIdToNormTaskId.get(tid);
  if (!st || !tt || st === tt) return false;
  if (tt !== 'customer_basic') return false;
  return (
    st === DESIGN_DETAIL_TASK0_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK2_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK3_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK4_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK5_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK51_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK52_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK55_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK6_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK65_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK7_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK8_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK85_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK9_LINE_TASK_ID ||
    st === DESIGN_DETAIL_TASK10_LINE_TASK_ID
  );
}

export function normLogicTaskId(id: unknown): string {
  const t = String(id ?? '').trim();
  if (t === '任务 1：客户基本情况了解') return 'customer_basic';
  if (
    t === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK2_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK2_LINE_TASK_ID;
  }
  if (t === DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK3_LINE_TASK_ID) {
    return DESIGN_DETAIL_TASK3_LINE_TASK_ID;
  }
  if (
    t === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK4_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK4_LINE_TASK_ID;
  }
  if (
    t === DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK5_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK5_LINE_TASK_ID;
  }
  if (t === DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK51_LINE_TASK_ID) {
    return DESIGN_DETAIL_TASK51_LINE_TASK_ID;
  }
  if (
    t === DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK52_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK52_LINE_TASK_ID;
  }
  if (
    t === DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK53_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK53_LINE_TASK_ID;
  }
  if (t === DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK55_LINE_TASK_ID) {
    return DESIGN_DETAIL_TASK55_LINE_TASK_ID;
  }
  if (
    t === DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK6_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK6_LINE_TASK_ID;
  }
  if (
    t === DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK65_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK65_LINE_TASK_ID;
  }
  if (
    t === DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK7_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK7_LINE_TASK_ID;
  }
  if (
    t === DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK8_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK8_LINE_TASK_ID;
  }
  if (t === DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK85_LINE_TASK_ID) {
    return DESIGN_DETAIL_TASK85_LINE_TASK_ID;
  }
  if (t === LOGIC_GRAPH_TASK0_TITLE || t === DESIGN_DETAIL_TASK0_LINE_TASK_ID) {
    return DESIGN_DETAIL_TASK0_LINE_TASK_ID;
  }
  if (
    t === DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK9_LINE_TASK_ID
  ) {
    return DESIGN_DETAIL_TASK9_LINE_TASK_ID;
  }
  if (t === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK10_LINE_TASK_ID) {
    return DESIGN_DETAIL_TASK10_LINE_TASK_ID;
  }
  return t;
}

/** 从接口原始项解析 `linkId`（兼容少数代理/旧层返回 `link_id`） */
export function logicGraphLinkIdOf(l: DesignDetailLogicGraphLinkDto | Record<string, unknown>): string {
  const r = l as Record<string, unknown>;
  return String((l as DesignDetailLogicGraphLinkDto).linkId ?? r.link_id ?? '').trim();
}

/** 反向验证边端点对键（任务 N 源 → 任务 1 宿） */
export function reverseValidationLinkEndpointPairKey(l: DesignDetailLogicGraphLinkDto): string {
  const sid = String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
  const tid = String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
  if (!sid || !tid) return '';
  return `${sid}\t${tid}`;
}

/**
 * 同端点对存在多条反向验证边时，Tree 展示优先级（与 `isTokenValidationMappingPotentialConflict` 红/绿口径对齐）。
 * 数值越大越优先（已消解 > 潜在冲突）。
 */
export function validationConsistencyDisplayRank(consistencyRaw: string): number {
  const c0 = String(consistencyRaw ?? '').trim();
  if (!c0) return 1;
  if (c0.includes('已通过纠偏修正')) return 5;
  if (c0.includes('已通过洞察修正')) return 4;
  if (c0.includes('逻辑一致')) return 3;
  const c = c0.replace(/\s+/g, '');
  if (!c.includes('潜在冲突')) return 2;
  if (
    /无潜在冲突|非潜在冲突|没有潜在冲突|不存在潜在冲突|不含潜在冲突|暂无潜在冲突|未现潜在冲突/.test(c)
  ) {
    return 2;
  }
  return 0;
}

export function pickPreferredReverseValidationLink(
  a: DesignDetailLogicGraphLinkDto,
  b: DesignDetailLogicGraphLinkDto,
): DesignDetailLogicGraphLinkDto {
  const ra = validationConsistencyDisplayRank(String(a.validationConsistency ?? ''));
  const rb = validationConsistencyDisplayRank(String(b.validationConsistency ?? ''));
  return ra >= rb ? a : b;
}

/**
 * 归一化单条逻辑边：保证 `linkId` 与嵌套 `source`/`target` 可被 Tree / 弹层稳定读取。
 */
export function normalizeLogicGraphLinkDto(raw: unknown): DesignDetailLogicGraphLinkDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const linkId = logicGraphLinkIdOf(r as DesignDetailLogicGraphLinkDto);
  if (!linkId) return null;
  const src = r.source ?? r.Source;
  const tgt = r.target ?? r.Target;
  const base = raw as DesignDetailLogicGraphLinkDto;
  const lkRaw = String(r.linkKind ?? r.link_kind ?? '').trim();
  let linkKind: '正向归纳' | '反向验证' | undefined;
  if (lkRaw === '反向验证' || lkRaw === 'REVERSE_VALIDATION') linkKind = '反向验证';
  else if (lkRaw === '正向归纳' || lkRaw === 'FORWARD_INDUCTION') linkKind = '正向归纳';
  const vcRaw = String(r.validationConsistency ?? r.validation_consistency ?? '').trim();
  const validationConsistency = vcRaw.length ? vcRaw : undefined;
  return {
    ...base,
    linkId,
    ...(linkKind ? { linkKind } : {}),
    ...(validationConsistency ? { validationConsistency } : {}),
    sourceFeatureId: String(base.sourceFeatureId ?? r.source_feature_id ?? '').trim() || undefined,
    targetFeatureId: String(base.targetFeatureId ?? r.target_feature_id ?? '').trim() || undefined,
    source: src && typeof src === 'object' ? (src as DesignDetailLogicGraphFeatureDto) : (base.source ?? null),
    target: tgt && typeof tgt === 'object' ? (tgt as DesignDetailLogicGraphFeatureDto) : (base.target ?? null),
  };
}

/** 对 `tasks[].links` 逐条归一化，避免 Tree 因 `linkId` 键名不一致过滤掉全部边 */
export function normalizeLogicGraphTasksAfterFetch(tasks: DesignDetailLogicGraphTaskDto[]): DesignDetailLogicGraphTaskDto[] {
  return tasks.map((t) => ({
    ...t,
    links: Array.isArray(t.links)
      ? (t.links.map((l) => normalizeLogicGraphLinkDto(l)).filter(Boolean) as DesignDetailLogicGraphLinkDto[])
      : [],
  }));
}

/** Tree / 逻辑弹层：与线步 id 对应的任务卡**展示标题**（覆盖 API 或历史行上的旧 `title`） */
export function canonicalLogicGraphTaskTitleByNormTaskId(normId: string): string | null {
  const id = String(normId || '').trim();
  if (id === DESIGN_DETAIL_TASK0_LINE_TASK_ID) return LOGIC_GRAPH_TASK0_TITLE;
  if (id === 'customer_basic') return LOGIC_GRAPH_TASK1_TITLE;
  if (id === DESIGN_DETAIL_TASK2_LINE_TASK_ID) return DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK3_LINE_TASK_ID) return DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK4_LINE_TASK_ID) return DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK5_LINE_TASK_ID) return DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK51_LINE_TASK_ID) return DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK52_LINE_TASK_ID) return DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK53_LINE_TASK_ID) return DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK55_LINE_TASK_ID) return DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK6_LINE_TASK_ID) return DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK65_LINE_TASK_ID) return DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK8_LINE_TASK_ID) return DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK85_LINE_TASK_ID) return DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK9_LINE_TASK_ID) return DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID;
  if (id === DESIGN_DETAIL_TASK10_LINE_TASK_ID) return DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID;
  return null;
}

/** Tree 层标题前缀：**推理层级-…层**（与逻辑树行首绿色加粗段一致；任务 1/2 同属 L1，任务 3/4 为 L2 子阶段） */
export function logicTreeInferenceLayerTierLabelByNormTaskId(normId: string): string {
  const id = String(normId || '').trim();
  if (id === DESIGN_DETAIL_TASK0_LINE_TASK_ID) return 'L0-工具原语层';
  if (id === 'customer_basic' || id === DESIGN_DETAIL_TASK2_LINE_TASK_ID) return 'L1-实体画像层';
  if (id === DESIGN_DETAIL_TASK3_LINE_TASK_ID) return 'L2-行业与业务层';
  if (id === DESIGN_DETAIL_TASK4_LINE_TASK_ID) return 'L2-价值链分析层';
  if (id === DESIGN_DETAIL_TASK5_LINE_TASK_ID) return 'L3-宏观流程特征层';
  if (id === DESIGN_DETAIL_TASK51_LINE_TASK_ID) return 'L3.1-战略能力层';
  if (id === DESIGN_DETAIL_TASK52_LINE_TASK_ID) return 'L3.2-表格字段功能理解层';
  if (id === DESIGN_DETAIL_TASK53_LINE_TASK_ID) return 'L3.3-流程环节功能理解层';
  if (id === DESIGN_DETAIL_TASK55_LINE_TASK_ID) return 'L3.5-VSM阶段层';
  if (id === DESIGN_DETAIL_TASK6_LINE_TASK_ID) return 'L3-关键场景层';
  if (id === DESIGN_DETAIL_TASK65_LINE_TASK_ID) return 'L3-三维IT-Gap层';
  if (id === DESIGN_DETAIL_TASK7_LINE_TASK_ID) return 'L4-IT选型层';
  if (id === DESIGN_DETAIL_TASK8_LINE_TASK_ID) return 'L4-业务原型层';
  if (id === DESIGN_DETAIL_TASK85_LINE_TASK_ID) return 'L4.7-技术集成层';
  if (id === DESIGN_DETAIL_TASK9_LINE_TASK_ID) return 'L5-领域容器层';
  if (id === DESIGN_DETAIL_TASK10_LINE_TASK_ID) return 'L5-物理Schema层';
  return '推理层';
}

function mergeLogicGraphTaskTitles(normId: string, a: string, b: string): string {
  const c = canonicalLogicGraphTaskTitleByNormTaskId(normId);
  if (c) return c;
  const s = String(a || '').trim() || String(b || '').trim();
  return s || normId;
}

function dedupeLogicGraphFeatures(features: DesignDetailLogicGraphFeatureDto[]): DesignDetailLogicGraphFeatureDto[] {
  const m = new Map<string, DesignDetailLogicGraphFeatureDto>();
  for (const f of features) {
    const td = String(f.tokenDisplay ?? f.token_display ?? '').trim();
    if (td && isDeprecatedBusinessContextTokenSurface(td)) continue;
    const id = String(f?.featureId ?? '').trim();
    if (!id) continue;
    if (!m.has(id)) m.set(id, f);
  }
  return [...m.values()];
}

function dedupeLogicGraphTokens(
  tokens: DesignDetailLogicGraphTaskDto['tokens'],
): DesignDetailLogicGraphTaskDto['tokens'] {
  const m = new Map<string, (typeof tokens)[number]>();
  for (const x of tokens) {
    const id = String((x as { tokenId?: string }).tokenId ?? '').trim();
    if (!id) continue;
    if (!m.has(id)) m.set(id, x);
  }
  return [...m.values()];
}

/** 用 `tasks[].features` 补全链边缺失的 `source` / `target`（供 Tree 分层与 SVG 锚点） */
export function enrichLogicGraphLinksWithFeatureEndpoints(
  tasks: ReadonlyArray<DesignDetailLogicGraphTaskDto>,
  links: ReadonlyArray<DesignDetailLogicGraphLinkDto>,
): DesignDetailLogicGraphLinkDto[] {
  const featById = new Map<string, DesignDetailLogicGraphFeatureDto>();
  for (const t of tasks) {
    for (const f of t.features ?? []) {
      const id = String(f.featureId ?? '').trim();
      if (id) featById.set(id, f);
    }
  }
  return links.map((l) => {
    const sid = String(l.sourceFeatureId ?? l.source?.featureId ?? '').trim();
    const tid = String(l.targetFeatureId ?? l.target?.featureId ?? '').trim();
    return {
      ...l,
      ...(sid && !l.source && featById.has(sid) ? { source: featById.get(sid) } : {}),
      ...(tid && !l.target && featById.has(tid) ? { target: featById.get(tid) } : {}),
    };
  });
}

function dedupeLogicGraphLinks(links: DesignDetailLogicGraphLinkDto[]): DesignDetailLogicGraphLinkDto[] {
  const m = new Map<string, DesignDetailLogicGraphLinkDto>();
  for (const l of links) {
    const id = logicGraphLinkIdOf(l);
    if (!id) continue;
    if (!m.has(id)) m.set(id, l);
  }
  return [...m.values()];
}

/**
 * 将 `normLogicTaskId` 相同的任务卡合并为一条（避免线步 id 与历史落库中文 `taskId` 各一行时 Tree 取到旧 `title`）。
 * 与后端 `getDesignDetailTaskGraphCardTitle` 对齐：任务 2/3/4 线步使用上表 **canonical** 标题。
 */
export function dedupeLogicGraphTasksByNormTaskId(
  tasks: DesignDetailLogicGraphTaskDto[],
): DesignDetailLogicGraphTaskDto[] {
  const order: string[] = [];
  const by = new Map<string, DesignDetailLogicGraphTaskDto>();

  for (const t of tasks) {
    const id = normLogicTaskId(t.taskId);
    const tokensIn = Array.isArray(t.tokens) ? t.tokens : [];
    const featuresIn = Array.isArray(t.features) ? t.features : [];
    const linksIn = Array.isArray(t.links) ? t.links : [];

    if (!by.has(id)) {
      order.push(id);
      const lc0 = Number(t.linkCount);
      const linkCount0 = Number.isFinite(lc0) ? lc0 : linksIn.length;
      by.set(id, {
        ...t,
        taskId: id,
        title: mergeLogicGraphTaskTitles(id, '', String(t.title || '')),
        tokens: dedupeLogicGraphTokens(tokensIn),
        features: dedupeLogicGraphFeatures(featuresIn),
        links: dedupeLogicGraphLinks(linksIn),
        tokenCount: Number(t.tokenCount) || tokensIn.length,
        featureCount: Number(t.featureCount) || featuresIn.length,
        linkCount: linkCount0,
      });
      continue;
    }

    const cur = by.get(id)!;
    const mergedTokens = dedupeLogicGraphTokens([...cur.tokens, ...tokensIn]);
    const mergedFeatures = dedupeLogicGraphFeatures([...cur.features, ...featuresIn]);
    const mergedLinks = dedupeLogicGraphLinks([...cur.links, ...linksIn]);
    by.set(id, {
      ...cur,
      taskId: id,
      title: mergeLogicGraphTaskTitles(id, cur.title, String(t.title || '')),
      tokens: mergedTokens,
      features: mergedFeatures,
      links: mergedLinks,
      tokenCount: mergedTokens.length,
      featureCount: mergedFeatures.length,
      linkCount: mergedLinks.length,
    });
  }

  return order.map((k) => by.get(k)!);
}

/**
 * 合并工商 + 需求两张任务 1 卡时，**须保留** `customer_basic.links`：`GET …/task-graph` 将 **目标端在任务 1** 的边（含任务 2 L1 **`Token_Validation_Mapping`→「反向验证」**）归入 **`customer_basic`** 桶；旧实现写死 `links: []` 会导致 **Tree** 无法收集反向验证边。
 * **`linkCount`** 仍对任务 1 置 **0**：逻辑弹层头栏「逻辑链」与任务 1 **逻辑** Tab 仍按产品口径不展示推导链（见 `DesignDetailLogicModal.vue`）；**Tree** 只读 **`links[]`**。
 */
export function mergeCustomerRequirementIntoBasicForLogicGraph(
  raw: DesignDetailLogicGraphTaskDto[],
): DesignDetailLogicGraphTaskDto[] {
  const rows = raw.map((t) => ({ ...t, taskId: normLogicTaskId(t.taskId) }));
  const req = rows.find((t) => t.taskId === 'customer_requirement');
  const basicRow = rows.find((t) => t.taskId === 'customer_basic');
  const out: DesignDetailLogicGraphTaskDto[] = [];

  for (const t of rows) {
    if (t.taskId === 'customer_requirement') continue;

    if (t.taskId === 'customer_basic') {
      const basicLinks = dedupeLogicGraphLinks(Array.isArray(t.links) ? t.links : []);
      if (req) {
        const reqLinks = dedupeLogicGraphLinks(Array.isArray(req.links) ? req.links : []);
        const mergedLinks = dedupeLogicGraphLinks([...basicLinks, ...reqLinks]);
        out.push({
          taskId: 'customer_basic',
          title: String(t.title || '').trim() || LOGIC_GRAPH_TASK1_TITLE,
          tokenCount: t.tokenCount + req.tokenCount,
          featureCount: t.featureCount + req.featureCount,
          linkCount: 0,
          tokens: [...t.tokens, ...req.tokens],
          features: [...t.features, ...req.features],
          links: mergedLinks,
        });
      } else {
        out.push({
          ...t,
          linkCount: 0,
          links: basicLinks,
        });
      }
      continue;
    }

    out.push(t);
  }

  if (req && !basicRow) {
    const withoutOrphanReq = out.filter((x) => x.taskId !== 'customer_basic');
    const orphanLinks = dedupeLogicGraphLinks(Array.isArray(req.links) ? req.links : []);
    return [
      {
        taskId: 'customer_basic',
        title: LOGIC_GRAPH_TASK1_TITLE,
        tokenCount: req.tokenCount,
        featureCount: req.featureCount,
        linkCount: 0,
        tokens: [...req.tokens],
        features: [...req.features],
        links: orphanLinks,
      },
      ...withoutOrphanReq,
    ];
  }

  return out;
}
