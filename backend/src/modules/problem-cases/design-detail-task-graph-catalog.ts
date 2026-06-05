/**
 * [INPUT]: 无
 * [OUTPUT]: 设计详情 `DesignDetailTaskToken.taskId` 在「逻辑详情」弹层中的**展示顺序**与**标题**（与 `frontend-vue` 设计任务线文案对齐；任务 1 工商 + 需求提炼 token **落库**统一为 `DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID`，GET 聚合仍输出线步 id `customer_basic`）；任务 2 L1 token **落库**为 `DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID`（中文任务名），GET 聚合与 DELETE `task-graph/:taskId` 仍用线步 id `DESIGN_DETAIL_TASK2_LINE_TASK_ID`，导出线步 id、落库 taskId 与 `isDesignDetailTask2L1TokenTaskId` 供写库/删库/读库兼容
 * [POS]: problem-cases；供 `getDesignDetailTaskGraphDetail` 聚合与 GET task-graph 响应
 *
 * [PROTOCOL]: 变更设计页 13 步任务线 id 或展示名时须同步 `designModeTaskPipeline.ts` / `design_mode_tasks.md` / `design_mode_promts.md`（任务 4 L2 提示词）/ `frontend-vue/src/design-detail/designDetailLogicGraphMerge.ts` 与本文件
 */

/** 任务 0：**设计线**任务 id（可选工具箱原语；与 `designModeTaskPipeline` 线步 `optional_toolbox_primitive` 一致） */
export const DESIGN_DETAIL_TASK0_LINE_TASK_ID = 'optional_toolbox_primitive' as const;

/** 任务 0 工具原语：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK0_GRAPH_TASK_ID = '任务 0：可选工具箱非结构化原语解构' as const;

export const DESIGN_DETAIL_TASK0_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK0_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK0_LINE_TASK_ID,
];

export function isDesignDetailTask0TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return t === DESIGN_DETAIL_TASK0_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK0_LINE_TASK_ID;
}

/** 任务 1：`DesignDetailTaskToken.taskId` 统一落库值（工商 + 客户需求提炼）；读/删仍兼容历史 `customer_basic`、`customer_requirement` */
export const DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID = '任务 1：客户基本情况了解' as const;

/** 任务 2：**设计线 / API** 任务 id（`GET …/task-graph` 卡片 `taskId`、DELETE `…/task-graph/:taskId` 路径）；与 `designModeTaskPipeline` 线步一致 */
export const DESIGN_DETAIL_TASK2_LINE_TASK_ID = 'scale_org_mode_extract' as const;

/**
 * 任务 2 L1：`DesignDetailTaskToken.taskId` **落库**值（与任务 1「任务 1：客户基本情况了解」体系统一）。
 * 历史数据可能仍为 `DESIGN_DETAIL_TASK2_LINE_TASK_ID`，或旧版中文 **`DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY`**；读/删须兼容（见 `isDesignDetailTask2L1TokenTaskId`、`DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS`）。
 */
export const DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID = '任务 2：规模与组织模式推理' as const;

/** 历史落库中文 taskId（更名前）；读/删/替换 token 时须覆盖，新写入勿用 */
export const DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY = '任务 2：行业与业务属性推理' as const;

/** `deleteMany` / 全量替换任务 2 L1 token 时 `where.taskId.in` 须列出的值（含线步 id 与历史中文名） */
export const DESIGN_DETAIL_TASK2_L1_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
];

/** 任务 3：**设计线**任务 id（与 `designModeTaskPipeline` 线步一致） */
export const DESIGN_DETAIL_TASK3_LINE_TASK_ID = 'industry_business_profile_extract' as const;

/**
 * 任务 3 L2：`DesignDetailTaskToken.taskId` **落库**值（与 L2 审计/提示词「行业与业务属性**推理**」一致）。
 * `DELETE …/task-graph/:taskId` 与全量替换时须与线步 id 一并覆盖。
 */
export const DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID = '任务 3：行业与业务属性推理' as const;

export const DESIGN_DETAIL_TASK3_L2_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
];

/** 是否为任务 3 L2 推理图在 `DesignDetailTaskToken.taskId` 上的落库值 */
export function isDesignDetailTask3L2TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return t === DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK3_LINE_TASK_ID;
}

/** 任务 4：**设计线**任务 id（与 `designModeTaskPipeline` 线步一致） */
export const DESIGN_DETAIL_TASK4_LINE_TASK_ID = 'core_value_driver_inference' as const;

/**
 * 任务 4 L2：`DesignDetailTaskToken.taskId` **落库**值（与 L2 审计「价值链分析**推理**」一致）。
 */
export const DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID = '任务 4：价值链分析推理' as const;

/** 更名前落库中文 taskId；读/删/替换 token 时须与新版中文名一并覆盖 */
export const DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY = '任务 4：核心价值驱动推理' as const;

export const DESIGN_DETAIL_TASK4_L2_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
];

/** 是否为任务 4 L2 推理图在 `DesignDetailTaskToken.taskId` 上的落库值 */
export function isDesignDetailTask4L2TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK4_LINE_TASK_ID
  );
}

/** 任务 5：**设计线**任务 id（与 `designModeTaskPipeline` 线步一致） */
export const DESIGN_DETAIL_TASK5_LINE_TASK_ID = 'macro_process_flow_inference' as const;

/** 任务 5.1：**设计线**任务 id（战略价值主张与业务能力单元） */
export const DESIGN_DETAIL_TASK51_LINE_TASK_ID = 'value_proposition_capability_units' as const;

/** 任务 5.5：**设计线**任务 id（VSM 阶段拆解） */
export const DESIGN_DETAIL_TASK55_LINE_TASK_ID = 'vsm_stage_decomposition' as const;

/** 任务 5 L3 宏观流程特征：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID = '任务 5：L3：宏观流程特征推理' as const;

/** 更名前落库中文名（读删兼容） */
export const DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY = '任务 5：宏观业务流程推断' as const;

export const DESIGN_DETAIL_TASK5_L3_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK5_LINE_TASK_ID,
];

/** 任务 5.1 L3.1 战略价值主张：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID =
  '任务 5.1：企业战略价值主张与部门级业务能力编排' as const;

export const DESIGN_DETAIL_TASK51_L3_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK51_LINE_TASK_ID,
];

/** 任务 5.2：**设计线**任务 id（表格字段功能理解） */
export const DESIGN_DETAIL_TASK52_LINE_TASK_ID = 'capability_field_set_mapping' as const;

/** 任务 5.2 表格字段功能理解：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID = '任务 5.2：表格字段功能理解' as const;

/** 更名前落库中文 taskId（读删兼容） */
export const DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID_LEGACY =
  '任务 5.2：存量 Excel 资产与业务能力字段集层次映射' as const;

export const DESIGN_DETAIL_TASK52_L3_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK52_LINE_TASK_ID,
];

/** 任务 5.3：**设计线**任务 id（跨能力单元关键场景时序流转） */
export const DESIGN_DETAIL_TASK53_LINE_TASK_ID = 'key_scenario_temporal_flow_inference' as const;

/** 任务 5.3 流程环节功能理解：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID = '任务 5.3：流程环节功能理解' as const;

/** 更名前落库中文 taskId（读删兼容） */
export const DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID_LEGACY =
  '任务 5.3：跨业务能力单元关键场景时序流转串联' as const;

export const DESIGN_DETAIL_TASK53_L3_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK53_LINE_TASK_ID,
];

/** 任务 5.5 L3.5 VSM 阶段：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID = '任务 5.5：L3.5：价值流图 VSM 阶段拆解' as const;

export const DESIGN_DETAIL_TASK55_L3_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK55_LINE_TASK_ID,
];

/** 任务 6：**设计线**任务 id（关键场景推理；与 `designModeTaskPipeline` 线步 `pain_point_extraction` 一致） */
export const DESIGN_DETAIL_TASK6_LINE_TASK_ID = 'pain_point_extraction' as const;

/** 任务 6 L3 关键场景：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID = '任务 6：关键场景推理' as const;

/** 更名前落库中文 taskId（读删兼容） */
export const DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID_LEGACY =
  '任务 6：需求痛点与关键场景探测推理' as const;

export const DESIGN_DETAIL_TASK6_L3_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK6_LINE_TASK_ID,
];

/** 任务 6.5：**设计线**任务 id（三维 IT-Gap 分析；与 `three_dimension_itgap_analysis` 一致） */
export const DESIGN_DETAIL_TASK65_LINE_TASK_ID = 'three_dimension_itgap_analysis' as const;

/** 任务 6.5 L3 IT-Gap：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID = '任务 6.5：三维 IT-Gap 分析' as const;

export const DESIGN_DETAIL_TASK65_L3_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK65_LINE_TASK_ID,
];

/** 任务 7：**设计线**任务 id（L4 二级协作节点；与 `designModeTaskPipeline` 线步 `key_requirement_scenarios` 一致） */
export const DESIGN_DETAIL_TASK7_LINE_TASK_ID = 'key_requirement_scenarios' as const;

/** 任务 7 L4 任务节点 IT 选型：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID = '任务 7：任务节点IT选型推理' as const;

/** 历史落库中文名（读删兼容） */
export const DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID_LEGACY =
  '任务 7：流程具体二级协作节点拆解推理' as const;

export const DESIGN_DETAIL_TASK7_L4_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID_LEGACY,
  DESIGN_DETAIL_TASK7_LINE_TASK_ID,
];

/** 任务 8：**设计线**任务 id（L4.5 角色/对象/STM；与 `designModeTaskPipeline` 线步 `role_object_stm_inference` 一致） */
export const DESIGN_DETAIL_TASK8_LINE_TASK_ID = 'role_object_stm_inference' as const;

/** 任务 8 L4.5 原型矩阵：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID = '任务 8：业务对象与有限状态机矩阵推导' as const;

export const DESIGN_DETAIL_TASK8_L45_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
  '任务 8：角色、对象与状态转移矩阵推理',
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
];

/** 任务 8.5：**设计线**任务 id（L4.75 物理外挂集成；与 `physical_hook_integration_inference` 一致） */
export const DESIGN_DETAIL_TASK85_LINE_TASK_ID = 'physical_hook_integration_inference' as const;

/** 任务 8.5 L4.75 物理外挂：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID = '任务 8.5：物理外挂集成推理' as const;

export const DESIGN_DETAIL_TASK85_L475_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK85_LINE_TASK_ID,
];

/** 任务 9：**设计线**任务 id（L5 领域容器与工具宿主；与 `business_capability_positioning` 一致） */
export const DESIGN_DETAIL_TASK9_LINE_TASK_ID = 'business_capability_positioning' as const;

/** 任务 9 L5 功能蓝图：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID = '任务 9：领域驱动逻辑容器与工具宿主定义推理' as const;

export const DESIGN_DETAIL_TASK9_L5_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID,
  '任务 9：系统菜单与功能模块定义推理',
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
];

/** 任务 10：**设计线**任务 id（L5 物理 DDL；与 `process_type_derivation` 一致） */
export const DESIGN_DETAIL_TASK10_LINE_TASK_ID = 'process_type_derivation' as const;

/** 任务 10 L5 物理建表 Schema 与 RBAC：`DesignDetailTaskToken.taskId` **落库**值 */
export const DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID =
  '任务 10：物理建表 Schema 与 RBAC 初始化推理' as const;

export const DESIGN_DETAIL_TASK10_L5_TOKEN_DB_TASK_IDS: readonly string[] = [
  DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
];

/** 是否为任务 5 L3 宏观特征推理图落库 taskId */
export function isDesignDetailTask5L3TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK5_LINE_TASK_ID
  );
}

/** 是否为任务 5.1 L3.1 战略价值主张落库 taskId */
export function isDesignDetailTask51L3TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return t === DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK51_LINE_TASK_ID;
}

/** 是否为任务 5.2 L3.2 字段集映射落库 taskId */
export function isDesignDetailTask52L3TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK52_LINE_TASK_ID
  );
}

/** 是否为任务 5.3 流程环节功能理解落库 taskId */
export function isDesignDetailTask53L3TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK53_LINE_TASK_ID
  );
}

/** 是否为任务 5.5 L3.5 VSM 阶段拆解落库 taskId */
export function isDesignDetailTask55L3TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return t === DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK55_LINE_TASK_ID;
}

/** 是否为任务 6 L3 关键场景推理图落库 taskId */
export function isDesignDetailTask6L3TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK6_LINE_TASK_ID
  );
}

/** 是否为任务 6.5 L3 三维 IT-Gap 分析落库 taskId */
export function isDesignDetailTask65L3TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return t === DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK65_LINE_TASK_ID;
}

/** 是否为任务 7 L4 任务节点 IT 选型推理图落库 taskId */
export function isDesignDetailTask7L4TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK7_LINE_TASK_ID
  );
}

/** 是否为任务 8 L4.5 业务对象/FSM 推理图落库 taskId */
export function isDesignDetailTask8L45TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID ||
    t === '任务 8：角色、对象与状态转移矩阵推理' ||
    t === DESIGN_DETAIL_TASK8_LINE_TASK_ID
  );
}

/** 是否为任务 8.5 L4.75 物理外挂集成推理图落库 taskId */
export function isDesignDetailTask85L475TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return t === DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK85_LINE_TASK_ID;
}

/** 是否为任务 9 L5 领域容器与工具宿主推理图落库 taskId */
export function isDesignDetailTask9L5TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID ||
    t === '任务 9：系统菜单与功能模块定义推理' ||
    t === DESIGN_DETAIL_TASK9_LINE_TASK_ID
  );
}

/** 是否为任务 10 L5 物理 DDL 推理图落库 taskId */
export function isDesignDetailTask10L5TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return t === DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID || t === DESIGN_DETAIL_TASK10_LINE_TASK_ID;
}

/** 会产生 `DesignDetailInferenceRevisionRecord` 的设计线步（任务 2–10） */
export const DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER: readonly string[] = [
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
  DESIGN_DETAIL_TASK3_LINE_TASK_ID,
  DESIGN_DETAIL_TASK4_LINE_TASK_ID,
  DESIGN_DETAIL_TASK5_LINE_TASK_ID,
  DESIGN_DETAIL_TASK51_LINE_TASK_ID,
  DESIGN_DETAIL_TASK52_LINE_TASK_ID,
  DESIGN_DETAIL_TASK53_LINE_TASK_ID,
  DESIGN_DETAIL_TASK55_LINE_TASK_ID,
  DESIGN_DETAIL_TASK6_LINE_TASK_ID,
  DESIGN_DETAIL_TASK65_LINE_TASK_ID,
  DESIGN_DETAIL_TASK7_LINE_TASK_ID,
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
  DESIGN_DETAIL_TASK85_LINE_TASK_ID,
  DESIGN_DETAIL_TASK9_LINE_TASK_ID,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
];

/** 线步 id → 修订审计表 `taskId`（落库中文名；删库时须含历史别名） */
export function designDetailInferenceRevisionDbTaskIdsForLineStep(lineStepId: string): string[] {
  const t = String(lineStepId || '').trim();
  if (t === DESIGN_DETAIL_TASK2_LINE_TASK_ID || isDesignDetailTask2L1TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID, DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY];
  }
  if (t === DESIGN_DETAIL_TASK3_LINE_TASK_ID || isDesignDetailTask3L2TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID];
  }
  if (t === DESIGN_DETAIL_TASK4_LINE_TASK_ID || isDesignDetailTask4L2TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID, DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY];
  }
  if (t === DESIGN_DETAIL_TASK5_LINE_TASK_ID || isDesignDetailTask5L3TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID, DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY];
  }
  if (t === DESIGN_DETAIL_TASK51_LINE_TASK_ID || isDesignDetailTask51L3TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID];
  }
  if (t === DESIGN_DETAIL_TASK52_LINE_TASK_ID || isDesignDetailTask52L3TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID];
  }
  if (t === DESIGN_DETAIL_TASK53_LINE_TASK_ID || isDesignDetailTask53L3TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID];
  }
  if (t === DESIGN_DETAIL_TASK55_LINE_TASK_ID || isDesignDetailTask55L3TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID];
  }
  if (t === DESIGN_DETAIL_TASK6_LINE_TASK_ID || isDesignDetailTask6L3TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID];
  }
  if (t === DESIGN_DETAIL_TASK65_LINE_TASK_ID || isDesignDetailTask65L3TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID];
  }
  if (t === DESIGN_DETAIL_TASK7_LINE_TASK_ID || isDesignDetailTask7L4TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID];
  }
  if (t === DESIGN_DETAIL_TASK8_LINE_TASK_ID || isDesignDetailTask8L45TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID, '任务 8：角色、对象与状态转移矩阵推理'];
  }
  if (t === DESIGN_DETAIL_TASK85_LINE_TASK_ID || isDesignDetailTask85L475TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID];
  }
  if (t === DESIGN_DETAIL_TASK9_LINE_TASK_ID || isDesignDetailTask9L5TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID, '任务 9：系统菜单与功能模块定义推理'];
  }
  if (t === DESIGN_DETAIL_TASK10_LINE_TASK_ID || isDesignDetailTask10L5TokenTaskId(t)) {
    return [DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID];
  }
  return [];
}

/** 从锚点线步起（含锚点）至任务 5 的修订审计 `taskId` 列表 */
/** 设计线步 id 列表：仅锚点线步（「重启当前」清 PAIN 标签） */
export function designDetailLineStepIdsForLineStep(lineStepId: string): string[] {
  const t = String(lineStepId || '').trim();
  if (!t) return [];
  return (DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER as readonly string[]).includes(t)
    ? [t]
    : [];
}

/** 设计线步 id 列表：锚点及之后（「选择重启」清 PAIN 标签） */
export function designDetailLineStepIdsFromAnchorInclusive(anchorLineStepId: string): string[] {
  const anchor = String(anchorLineStepId || '').trim();
  const idx = DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER.indexOf(anchor);
  if (idx < 0) return [];
  return [...DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER.slice(idx)];
}

export function designDetailInferenceRevisionDbTaskIdsFromLineStepInclusive(
  anchorLineStepId: string,
): string[] {
  const anchor = String(anchorLineStepId || '').trim();
  const idx = DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER.indexOf(anchor);
  if (idx < 0) return [];
  const ids: string[] = [];
  for (let i = idx; i < DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER.length; i++) {
    ids.push(...designDetailInferenceRevisionDbTaskIdsForLineStep(DESIGN_DETAIL_INFERENCE_REVISION_LINE_STEP_ORDER[i]!));
  }
  return [...new Set(ids)];
}

/** 是否为任务 2 L1 推理图在 `DesignDetailTaskToken.taskId` 上的落库值（含旧版线步 id 与更名前中文名） */
export function isDesignDetailTask2L1TokenTaskId(dbTaskId: string): boolean {
  const t = String(dbTaskId || '').trim();
  return (
    t === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY ||
    t === DESIGN_DETAIL_TASK2_LINE_TASK_ID
  );
}

/** 逻辑详情中任务卡片顺序（任务 1 仅一张卡，聚合 key 仍为 `customer_basic`） */
export const DESIGN_DETAIL_TASK_GRAPH_ORDER: readonly string[] = [
  DESIGN_DETAIL_TASK0_LINE_TASK_ID,
  'customer_basic',
  DESIGN_DETAIL_TASK2_LINE_TASK_ID,
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
  DESIGN_DETAIL_TASK8_LINE_TASK_ID,
  DESIGN_DETAIL_TASK85_LINE_TASK_ID,
  'business_capability_positioning',
  'process_type_derivation',
  'process_node_design',
  'role_and_business_object_derivation',
  'module_abstract_design',
  'field_design',
];

const DESIGN_DETAIL_TASK_GRAPH_TITLE: Readonly<Record<string, string>> = {
  [DESIGN_DETAIL_TASK0_LINE_TASK_ID]: '任务 0：可选工具箱非结构化原语解构',
  [DESIGN_DETAIL_TASK0_GRAPH_TASK_ID]: '任务 0：可选工具箱非结构化原语解构',
  customer_basic: '任务 1：客户基本情况了解',
  customer_requirement: '客户需求提炼推理图',
  [DESIGN_DETAIL_TASK2_LINE_TASK_ID]: '任务 2：规模与组织模式推理',
  /** 与线步卡一致：落库 `DesignDetailTaskToken.taskId` 可能为中文 L1 id */
  [DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID]: '任务 2：规模与组织模式推理',
  [DESIGN_DETAIL_TASK2_L1_GRAPH_TASK_ID_LEGACY]: '任务 2：规模与组织模式推理',
  industry_business_profile_extract: '任务 3：行业与业务属性提取',
  [DESIGN_DETAIL_TASK3_L2_GRAPH_TASK_ID]: '任务 3：行业与业务属性推理',
  core_value_driver_inference: '任务 4：价值链分析推理',
  /** 与线步卡一致：落库 token 行 `taskId` 常为中文 L2 id（含更名前 legacy） */
  [DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID]: '任务 4：价值链分析推理',
  [DESIGN_DETAIL_TASK4_L2_GRAPH_TASK_ID_LEGACY]: '任务 4：价值链分析推理',
  macro_process_flow_inference: '任务 5：L3：宏观流程特征推理',
  [DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID]: '任务 5：L3：宏观流程特征推理',
  [DESIGN_DETAIL_TASK5_L3_GRAPH_TASK_ID_LEGACY]: '任务 5：L3：宏观流程特征推理',
  value_proposition_capability_units: '任务 5.1：企业战略价值主张与部门级业务能力编排',
  [DESIGN_DETAIL_TASK51_L3_GRAPH_TASK_ID]: '任务 5.1：企业战略价值主张与部门级业务能力编排',
  capability_field_set_mapping: '任务 5.2：表格字段功能理解',
  [DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID]: '任务 5.2：表格字段功能理解',
  [DESIGN_DETAIL_TASK52_L3_GRAPH_TASK_ID_LEGACY]: '任务 5.2：表格字段功能理解',
  key_scenario_temporal_flow_inference: '任务 5.3：流程环节功能理解',
  [DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID]: '任务 5.3：流程环节功能理解',
  [DESIGN_DETAIL_TASK53_L3_GRAPH_TASK_ID_LEGACY]: '任务 5.3：流程环节功能理解',
  vsm_stage_decomposition: '任务 5.5：L3.5：价值流图 VSM 阶段拆解',
  [DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID]: '任务 5.5：L3.5：价值流图 VSM 阶段拆解',
  pain_point_extraction: '任务 6：关键场景推理',
  [DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID]: '任务 6：关键场景推理',
  [DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID_LEGACY]: '任务 6：关键场景推理',
  three_dimension_itgap_analysis: '任务 6.5：三维 IT-Gap 分析',
  [DESIGN_DETAIL_TASK65_L3_GRAPH_TASK_ID]: '任务 6.5：三维 IT-Gap 分析',
  key_requirement_scenarios: '任务 7：任务节点IT选型推理',
  [DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID]: '任务 7：任务节点IT选型推理',
  [DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID_LEGACY]: '任务 7：流程具体二级协作节点拆解推理',
  role_object_stm_inference: '任务 8：业务对象与有限状态机矩阵推导',
  [DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID]: '任务 8：业务对象与有限状态机矩阵推导',
  '任务 8：角色、对象与状态转移矩阵推理': '任务 8：业务对象与有限状态机矩阵推导',
  physical_hook_integration_inference: '任务 8.5：物理外挂集成推理',
  [DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID]: '任务 8.5：物理外挂集成推理',
  business_capability_positioning: '任务 9：领域驱动逻辑容器与工具宿主定义推理',
  [DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID]: '任务 9：领域驱动逻辑容器与工具宿主定义推理',
  '任务 9：系统菜单与功能模块定义推理': '任务 9：领域驱动逻辑容器与工具宿主定义推理',
  process_type_derivation: '任务 10：物理建表 Schema 与 RBAC 初始化推理',
  [DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID]: '任务 10：物理建表 Schema 与 RBAC 初始化推理',
  process_node_design: '任务 11：架构清单生成',
  role_and_business_object_derivation: '任务 12：角色与业务对象推导',
  module_abstract_design: '任务 13：模块抽象设计',
  field_design: '任务 14：ER 图生成',
};

export function getDesignDetailTaskGraphCardTitle(taskId: string): string {
  const tid = String(taskId || '').trim();
  return DESIGN_DETAIL_TASK_GRAPH_TITLE[tid] ?? `设计任务：${tid || '—'}`;
}
