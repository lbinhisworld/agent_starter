/**
 * [INPUT]: `designDetailLineState.ts`（持久化「当前任务」）、`design_mode_tasks.md`（产品真源）
 * [OUTPUT]: 设计详情页任务线的展示名、顺序常量、**任务 id 类型**（与详情 canonical **解耦**）
 * [POS]: 文档与实现对齐层；16 步设计任务线 + `all_done`（任务 5/5.5、8/8.5 分拆）
 *
 * [PROTOCOL]: 变更任务名或顺序时须同步 `design_mode_tasks.md`、`designDetailLineState.ts`、`designDetailLineInference.ts`、`useDesignDetailChat.ts`、`design-detail-task-graph-catalog.ts`（任务图卡标题）；任务 14 内部 id **`field_design`** 展示 **ER 图生成**
 */

/** 与 `design_mode_tasks.md` 中「当前任务」枚举一致；`all_done` 为收官态 */
export type DesignDetailLineTaskId =
  | 'optional_toolbox_primitive'
  | 'customer_basic'
  | 'scale_org_mode_extract'
  | 'industry_business_profile_extract'
  | 'core_value_driver_inference'
  | 'macro_process_flow_inference'
  | 'value_proposition_capability_units'
  | 'capability_field_set_mapping'
  | 'key_scenario_temporal_flow_inference'
  | 'vsm_stage_decomposition'
  | 'pain_point_extraction'
  | 'three_dimension_itgap_analysis'
  | 'key_requirement_scenarios'
  | 'role_object_stm_inference'
  | 'physical_hook_integration_inference'
  | 'business_capability_positioning'
  | 'process_type_derivation'
  | 'process_node_design'
  | 'role_and_business_object_derivation'
  | 'module_abstract_design'
  | 'field_design'
  | 'all_done';

/** 设计页任务线顺序（不含已收官 `all_done`），与产品文案一一对应 */
export const DESIGN_MODE_LINE_TASK_ORDER: Exclude<DesignDetailLineTaskId, 'all_done'>[] = [
  'optional_toolbox_primitive',
  'customer_basic',
  'scale_org_mode_extract',
  'industry_business_profile_extract',
  'core_value_driver_inference',
  'macro_process_flow_inference',
  'value_proposition_capability_units',
  'capability_field_set_mapping',
  'key_scenario_temporal_flow_inference',
  'vsm_stage_decomposition',
  'pain_point_extraction',
  'three_dimension_itgap_analysis',
  'key_requirement_scenarios',
  'role_object_stm_inference',
  'physical_hook_integration_inference',
  'business_capability_positioning',
  'process_type_derivation',
  'process_node_design',
  'role_and_business_object_derivation',
  'module_abstract_design',
  'field_design',
];

export const DESIGN_LINE_TASK_DISPLAY: Record<Exclude<DesignDetailLineTaskId, 'all_done'>, string> = {
  optional_toolbox_primitive: '可选工具箱非结构化原语解构',
  customer_basic: '客户基本情况了解',
  scale_org_mode_extract: '规模与组织模式推理',
  industry_business_profile_extract: '行业与业务属性推理',
  core_value_driver_inference: '价值链分析推理',
  macro_process_flow_inference: 'L3：宏观流程特征推理',
  value_proposition_capability_units: 'L3.1：企业战略价值主张与部门级业务能力编排',
  capability_field_set_mapping: '表格字段功能理解',
  key_scenario_temporal_flow_inference: '流程环节功能理解',
  vsm_stage_decomposition: 'L3.5：价值流图 VSM 阶段拆解',
  pain_point_extraction: '关键场景推理',
  three_dimension_itgap_analysis: '三维 IT-Gap 分析',
  key_requirement_scenarios: '任务节点IT选型推理',
  role_object_stm_inference: '业务对象与有限状态机矩阵推导',
  physical_hook_integration_inference: '物理外挂集成推理',
  business_capability_positioning: '领域驱动逻辑容器与工具宿主定义推理',
  process_type_derivation: '物理建表 Schema 与 RBAC 初始化推理',
  process_node_design: '分析报告生成',
  role_and_business_object_derivation: '流程图生成',
  module_abstract_design: '功能清单生成',
  field_design: 'ER 图生成',
};

export function designLineTaskDisplayName(id: DesignDetailLineTaskId): string {
  if (id === 'all_done') return '已全部完成';
  return DESIGN_LINE_TASK_DISPLAY[id];
}

/** 0..15；`optional_toolbox_primitive` 为 0；`vsm_stage_decomposition` 为 5.5；`physical_hook_integration_inference` 为 8.5；`all_done` 返回 null */
export function designLineTaskStepNumber(id: DesignDetailLineTaskId): number | null {
  if (id === 'all_done') return null;
  if (id === 'optional_toolbox_primitive') return 0;
  if (id === 'value_proposition_capability_units') return 5.1;
  if (id === 'capability_field_set_mapping') return 5.2;
  if (id === 'key_scenario_temporal_flow_inference') return 5.3;
  if (id === 'vsm_stage_decomposition') return 5.5;
  if (id === 'pain_point_extraction') return 6;
  if (id === 'three_dimension_itgap_analysis') return 6.5;
  if (id === 'key_requirement_scenarios') return 7;
  if (id === 'role_object_stm_inference') return 8;
  if (id === 'physical_hook_integration_inference') return 8.5;
  if (id === 'business_capability_positioning') return 9;
  if (id === 'process_type_derivation') return 10;
  if (id === 'process_node_design') return 11;
  if (id === 'role_and_business_object_derivation') return 12;
  if (id === 'module_abstract_design') return 13;
  if (id === 'field_design') return 14;
  const i = DESIGN_MODE_LINE_TASK_ORDER.indexOf(id);
  /** 线步索引与用户可见「任务 N」对齐（任务 0 为索引 0；任务 6～10 等仍走上方显式分支） */
  return i >= 0 ? i : null;
}

/**
 * 取设计线上「较晚」的一步（索引更大）；任一为 `all_done` 则返回 `all_done`。
 * 用于工作区快照恢复与 localStorage 线步对齐，避免陈旧快照把 UI 拽回任务 1。
 */
export function pickLaterDesignLineTaskId(a: DesignDetailLineTaskId, b: DesignDetailLineTaskId): DesignDetailLineTaskId {
  if (a === 'all_done' || b === 'all_done') return 'all_done';
  const ia = DESIGN_MODE_LINE_TASK_ORDER.indexOf(a);
  const ib = DESIGN_MODE_LINE_TASK_ORDER.indexOf(b);
  if (ia < 0 && ib < 0) return a;
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia >= ib ? a : b;
}

/** 标题栏「当前任务」：优先取动态卡中索引最大的 `running` 线步，与左栏实际进展对齐 */
export function resolveDesignDetailCurrentLineTaskIdForDisplay(
  cards: ReadonlyArray<{ lineTaskId: string; status: string }>,
  persistedId: DesignDetailLineTaskId,
): DesignDetailLineTaskId {
  let bestId: DesignDetailLineTaskId | null = null;
  let bestIdx = -1;
  for (const c of cards) {
    if (c.status !== 'running') continue;
    const id = c.lineTaskId as Exclude<DesignDetailLineTaskId, 'all_done'>;
    const idx = DESIGN_MODE_LINE_TASK_ORDER.indexOf(id);
    if (idx > bestIdx) {
      bestIdx = idx;
      bestId = id;
    }
  }
  if (bestId != null) return bestId;
  return persistedId;
}

/** 标题栏紫底标签与任务动态卡标题：「任务 N：中文名」（任务 5 / 5.5 为 L3 / L3.5 专名） */
export function designLinePillLabel(id: DesignDetailLineTaskId): string {
  if (id === 'all_done') return '已全部完成';
  if (id === 'optional_toolbox_primitive') return '任务 0：可选工具箱非结构化原语解构';
  if (id === 'macro_process_flow_inference') return '任务 5：L3：宏观流程特征推理';
  if (id === 'value_proposition_capability_units')
    return '任务 5.1：企业战略价值主张与部门级业务能力编排';
  if (id === 'capability_field_set_mapping') return '任务 5.2：表格字段功能理解';
  if (id === 'key_scenario_temporal_flow_inference') return '任务 5.3：流程环节功能理解';
  if (id === 'vsm_stage_decomposition') return '任务 5.5：L3.5：价值流图 VSM 阶段拆解';
  if (id === 'pain_point_extraction') return '任务 6：关键场景推理';
  if (id === 'three_dimension_itgap_analysis') return '任务 6.5：三维 IT-Gap 分析';
  if (id === 'key_requirement_scenarios') return '任务 7：任务节点IT选型推理';
  if (id === 'role_object_stm_inference') return '任务 8：业务对象与有限状态机矩阵推导';
  if (id === 'physical_hook_integration_inference') return '任务 8.5：物理外挂集成推理';
  if (id === 'business_capability_positioning') return '任务 9：领域驱动逻辑容器与工具宿主定义推理';
  if (id === 'process_type_derivation') return '任务 10：物理建表 Schema 与 RBAC 初始化推理';
  if (id === 'process_node_design') return '任务 11：分析报告生成';
  if (id === 'role_and_business_object_derivation') return '任务 12：流程图生成';
  if (id === 'module_abstract_design') return '任务 13：功能清单生成';
  if (id === 'field_design') return '任务 14：ER 图生成';
  const n = designLineTaskStepNumber(id);
  const name = designLineTaskDisplayName(id);
  return n != null ? `任务 ${n}：${name}` : name;
}

/**
 * 「重启当前」清数据切片：从锚点线步起至任务线末尾（**含锚点**），不含 `all_done`。
 * 用于清空当前及之后线步的推理图 / LLM 审计等。
 */
export function designLineTasksFromStepInclusive(
  from: DesignDetailLineTaskId,
): Exclude<DesignDetailLineTaskId, 'all_done'>[] {
  if (from === 'all_done') return [];
  const i = DESIGN_MODE_LINE_TASK_ORDER.indexOf(from as Exclude<DesignDetailLineTaskId, 'all_done'>);
  if (i < 0) return [];
  return DESIGN_MODE_LINE_TASK_ORDER.slice(i) as Exclude<DesignDetailLineTaskId, 'all_done'>[];
}

/** 闭区间 [from, to]（按 `DESIGN_MODE_LINE_TASK_ORDER`）；用于选择重启时裁剪工作区 B～A */
export function designLineTasksFromStepRangeInclusive(
  from: DesignDetailLineTaskId,
  to: DesignDetailLineTaskId,
): Exclude<DesignDetailLineTaskId, 'all_done'>[] {
  if (from === 'all_done' || to === 'all_done') return [];
  const i = DESIGN_MODE_LINE_TASK_ORDER.indexOf(from as Exclude<DesignDetailLineTaskId, 'all_done'>);
  const j = DESIGN_MODE_LINE_TASK_ORDER.indexOf(to as Exclude<DesignDetailLineTaskId, 'all_done'>);
  if (i < 0 || j < 0) return [];
  const start = Math.min(i, j);
  const end = Math.max(i, j);
  return DESIGN_MODE_LINE_TASK_ORDER.slice(start, end + 1) as Exclude<
    DesignDetailLineTaskId,
    'all_done'
  >[];
}

/** 线步在 `DESIGN_MODE_LINE_TASK_ORDER` 中的索引；`all_done` 或未知 id 返回 -1 */
export function designLineTaskIndexInOrder(lineTaskId: DesignDetailLineTaskId): number {
  if (lineTaskId === 'all_done') return -1;
  return DESIGN_MODE_LINE_TASK_ORDER.indexOf(lineTaskId as Exclude<DesignDetailLineTaskId, 'all_done'>);
}
