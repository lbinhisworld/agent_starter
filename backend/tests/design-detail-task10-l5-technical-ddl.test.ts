import { describe, expect, it } from 'vitest';
import {
  buildTask10MainTableToBaseForwardLinks,
  buildTask10SchemaFieldFissionPlans,
  normalizeL5TechnicalDdlInferenceRawForServerSync,
  parseTask10L5TechnicalDdlTargetKvSyncRows,
  task10StrongTypeSchemaChineseNamingViolation,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

/** 任务 10 强类型 Schema Feature_Value（含 columns 门禁所需最小结构；中文表名/列名） */
function task10StrongTypeFv(
  tableName: string,
  opts?: { inductionType?: string; parentRef?: string; fieldName?: string },
): string {
  return JSON.stringify({
    table_metadata: {
      table_name: tableName,
      induction_type: opts?.inductionType ?? '主表基准',
      parent_table_ref: opts?.parentRef ?? 'N/A',
    },
    columns: [
      {
        field_name: opts?.fieldName ?? '主键编号',
        data_type: 'BIGINT',
        constraints: 'PRIMARY KEY',
        source_feature_id: 'ft_000000000001',
      },
    ],
    row_level_security: [{ role: '默认角色', policy: '只读' }],
    data_initialization: {
      target_table: tableName,
      source_fossil: '现有表格/demo',
      mapping_logic: 'N/A',
    },
  });
}

const SAMPLE_DDL_MATRIX = JSON.stringify({
  L5_Technical_DDL_Matrix: {
    Target_KV: [
      {
        Feature_Key: '物理表结构Schema',
        Operator: '等于',
        Feature_Value: task10StrongTypeFv('订单核心事实主表'),
        Tech_Host_Platform: '七巧低代码平台容器',
        Evidence_Support_Chain: [
          {
            SourceType: 'Derived_Feature',
            FeatureID: 'ft_000000000912',
            tokenstr: '系统一级模块',
            value: '排产变更控制模块',
            logic: '单据重力收拢',
          },
        ],
        Inference_Weight: 1.0,
        inference_summary: '低代码主表',
      },
      {
        Feature_Key: '基础表初始化',
        Operator: '等于',
        Feature_Value: {
          插入行: [{ 字段赋值: { 应用系统角色主键: 'role_a' } }],
        },
        Tech_Host_Platform: '七巧低代码平台容器',
        Evidence_Support_Chain: [
          {
            FeatureID: 'ft_000000000913',
            logic: 'RBAC 初始化',
          },
        ],
        Inference_Weight: 0.9,
      },
    ],
    Token_Validation_Mapping: [],
  },
});

describe('parseTask10L5TechnicalDdlTargetKvSyncRows', () => {
  it('accepts L5_Technical_DDL_Matrix with Tech_Host_Platform', () => {
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(SAMPLE_DDL_MATRIX);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows.length).toBeGreaterThanOrEqual(1);
    expect(parsed.rows[0]?.featureKey).toBe('物理表结构Schema');
    expect(parsed.rows[0]?.techHostPlatform).toBe('七巧低代码平台容器');
  });

  it('rejects 跨平台接口同步Schema row without Tech_Host_Platform', () => {
    const raw = JSON.stringify({
      L5_Technical_DDL_Matrix: {
        Target_KV: [
          {
            Feature_Key: '跨平台接口同步Schema',
            Operator: '等于',
            Feature_Value: '{}',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
            Inference_Weight: 1,
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain('Tech_Host_Platform');
  });

  it('rejects 物理技术Schema row when Feature_Value is plain table name without columns', () => {
    const raw = JSON.stringify({
      L5_Data_Architecture_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理技术Schema',
            Operator: '等于',
            Feature_Value: '插单任务核心事实主表',
            Induction_Type: '主表基准',
            Inference_Weight: 1,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000244', logic: 'x' }],
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain('columns');
  });

  it('auto-normalizes English snake_case table/field names from Evidence_Support_Chain before sync', () => {
    const raw = JSON.stringify({
      L5_Data_Architecture_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理技术Schema',
            Operator: '等于',
            Feature_Value: task10StrongTypeFv('insert_order_main', { fieldName: 'office_code' }),
            Induction_Type: '主表基准',
            Inference_Weight: 1,
            Evidence_Support_Chain: [
              {
                FeatureID: 'ft_000000000245',
                tokenstr: '运营模式/业务流程/插单与配方调整登记',
                value: '插单与配方调整单（含办事处编码、业务员工号、订单号）',
                logic: 'x',
              },
            ],
          },
        ],
      },
    });
    expect(task10StrongTypeSchemaChineseNamingViolation(task10StrongTypeFv('insert_order_main'))).toContain(
      'table_metadata.table_name',
    );
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const fv = String(parsed.rows[0]?.featureValue ?? '');
    expect(fv).toContain('插单与配方调整登记主表');
    expect(fv).toContain('办事处编码');
    expect(fv).not.toContain('insert_order_main');
  });

  it('auto-normalizes salesman_id to Chinese field name before sync', () => {
    const fvObj = {
      table_metadata: {
        table_name: '插单核心事实主表',
        induction_type: '主表基准',
        parent_table_ref: 'N/A',
      },
      columns: [
        { field_name: '系统唯一流水键', data_type: '自动递增唯一键', constraints: '主键', source_feature_id: 'ft_000000000245' },
        { field_name: 'salesman_id', data_type: '单行文本', constraints: '非空', source_feature_id: 'ft_000000000245' },
      ],
      row_level_security: [{ role: '默认角色', policy: '只读' }],
      data_initialization: { target_table: '插单核心事实主表', source_fossil: 'x', mapping_logic: 'N/A' },
    };
    const raw = JSON.stringify({
      L5_Data_Architecture_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理技术Schema',
            Feature_Value: JSON.stringify(fvObj),
            Inference_Weight: 1,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000245', logic: 'x' }],
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(String(parsed.rows[0]?.featureValue ?? '')).toContain('业务员唯一编码');
    expect(String(parsed.rows[0]?.featureValue ?? '')).not.toContain('salesman_id');
  });

  it('rejects invalid Feature_Key', () => {
    const raw = JSON.stringify({
      L5_Technical_DDL_Matrix: {
        Target_KV: [
          {
            Feature_Key: '流程类型',
            Operator: '等于',
            Feature_Value: 'x',
            Tech_Host_Platform: '平台A',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
            Inference_Weight: 1,
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(false);
  });

  it('accepts 跨平台接口同步Schema row with dual Tech_Host_Platform', () => {
    const raw = JSON.stringify({
      L5_Technical_DDL_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理表结构Schema',
            Operator: '等于',
            Feature_Value: task10StrongTypeFv('主表A'),
            Tech_Host_Platform: '七巧低代码平台容器',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
            Inference_Weight: 1,
          },
          {
            Feature_Key: '跨平台接口同步Schema',
            Operator: '等于',
            Feature_Value: {
              接口名称: '同步流',
              两端全中文点对点字段映射字典: [],
            },
            Tech_Host_Platform: '七巧低代码平台容器/企业微信开放网关',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000853', logic: '跨宿主' }],
            Inference_Weight: 1,
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows.some((r) => r.featureKey === '跨平台接口同步Schema')).toBe(true);
  });

  it('accepts native JSON object Feature_Value and normalizes legacy rbac key', () => {
    const raw = JSON.stringify({
      L5_Technical_DDL_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理表结构Schema',
            Operator: '等于',
            Feature_Value: task10StrongTypeFv('主表A'),
            Tech_Host_Platform: '七巧低代码平台容器',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
            Inference_Weight: 1,
          },
          {
            Feature_Key: '权限字典初始化SQL',
            Operator: '等于',
            Feature_Value: { 插入行: [] },
            Tech_Host_Platform: '七巧低代码平台容器',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000002', logic: 'y' }],
            Inference_Weight: 1,
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[1]?.featureKey).toBe('基础表初始化');
    expect(typeof parsed.rows[0]?.featureValue).toBe('string');
  });
});

describe('normalizeL5TechnicalDdlInferenceRawForServerSync (task 10)', () => {
  it('normalizes technical ddl matrix payload', () => {
    const norm = normalizeL5TechnicalDdlInferenceRawForServerSync(SAMPLE_DDL_MATRIX);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    const obj = JSON.parse(norm.normalized) as Record<string, unknown>;
    expect(obj.L5_Technical_DDL_Matrix || obj.L5_Data_Architecture_Matrix).toBeTruthy();
  });

  it('normalizes L5_Data_Architecture_Matrix payload', () => {
    const raw = JSON.stringify({
      L5_Data_Architecture_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理技术Schema',
            Operator: '等于',
            Feature_Value: task10StrongTypeFv('主表A'),
            Inference_Weight: 1,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
          },
        ],
      },
    });
    const norm = normalizeL5TechnicalDdlInferenceRawForServerSync(raw);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    const obj = JSON.parse(norm.normalized) as Record<string, unknown>;
    expect(obj.L5_Data_Architecture_Matrix).toBeTruthy();
  });

  it('repairs literal newlines inside inference_summary strings', () => {
    const fv = task10StrongTypeFv('主表A');
    const broken = `{
  "L5_Technical_DDL_Matrix": {
    "Target_KV": [
      {
        "Feature_Key": "物理表结构Schema",
        "Operator": "等于",
        "Feature_Value": ${JSON.stringify(fv)},
        "Tech_Host_Platform": "七巧低代码平台容器",
        "Evidence_Support_Chain": [{ "FeatureID": "ft_000000000001", "logic": "x" }],
        "Inference_Weight": 1.0,
        "inference_summary": "【数据化石现行表格与新系统数据表/字段对应关系】：
[客户表.列A] ──(吸纳映射)──> [新表.列A]"
      }
    ]
  }
}`;
    const norm = normalizeL5TechnicalDdlInferenceRawForServerSync(broken);
    expect(norm.ok).toBe(true);
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(broken);
    expect(parsed.ok).toBe(true);
  });

  it('parses Induction_Type / Parent_Table_Ref / Introduction_Reason on schema rows', () => {
    const raw = JSON.stringify({
      L5_Data_Architecture_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理技术Schema',
            Operator: '等于',
            Feature_Value: task10StrongTypeFv('变单履约核心事实主表'),
            Induction_Type: '主表基准',
            Parent_Table_Ref: 'N/A',
            Introduction_Reason: '主表硬化',
            Inference_Weight: 1.0,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
          },
          {
            Feature_Key: '物理技术Schema',
            Operator: '等于',
            Feature_Value: task10StrongTypeFv('标准基础对象主数据维度表', {
              inductionType: '主表正向归纳派生',
              parentRef: '变单履约核心事实主表',
            }),
            Induction_Type: '主表正向归纳派生',
            Parent_Table_Ref: '变单履约核心事实主表',
            Introduction_Reason: '范式排异衍生基础表',
            Inference_Weight: 0.92,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'y' }],
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.inductionType).toBe('主表基准');
    expect(parsed.rows[1]?.parentTableRef).toBe('变单履约核心事实主表');
    expect(parsed.rows[1]?.introductionReason).toBe('范式排异衍生基础表');
    const links = buildTask10MainTableToBaseForwardLinks(parsed.rows, [
      'ft_000000000101',
      'ft_000000000102',
    ]);
    expect(links).toHaveLength(1);
    expect(links[0]?.sourceFeatureId).toBe('ft_000000000101');
    expect(links[0]?.targetFeatureId).toBe('ft_000000000102');
    expect(links[0]?.logic).toBe('范式排异衍生基础表');
    expect(links[0]?.weight).toBe(0.92);
  });

  it('builds main→child and main→base cascade links for triple Target_KV', () => {
    const raw = JSON.stringify({
      L5_Data_Architecture_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理技术Schema',
            Feature_Value: task10StrongTypeFv('合同核心事实主表'),
            Induction_Type: '主表基准',
            Parent_Table_Ref: 'N/A',
            Inference_Weight: 1,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
          },
          {
            Feature_Key: '物理技术Schema',
            Feature_Value: task10StrongTypeFv('合同付款阶段明细子表', {
              inductionType: '主子级联纵向裂变',
              parentRef: '合同核心事实主表',
            }),
            Induction_Type: '主子级联纵向裂变',
            Parent_Table_Ref: '合同核心事实主表',
            Reference_Field_Mapping: '子表.合同ID -> 主表.合同ID',
            Introduction_Reason: '纵向裂变子表',
            Inference_Weight: 0.95,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'y' }],
          },
          {
            Feature_Key: '物理技术Schema',
            Feature_Value: task10StrongTypeFv('客户客商基础主数据表', {
              inductionType: '主表正向归纳派生',
              parentRef: '合同核心事实主表',
            }),
            Induction_Type: '主表正向归纳派生',
            Parent_Table_Ref: '合同核心事实主表',
            Introduction_Reason: '剥离客商主数据',
            Inference_Weight: 0.88,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'z' }],
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(3);
    const links = buildTask10MainTableToBaseForwardLinks(parsed.rows, [
      'ft_000000000101',
      'ft_000000000102',
      'ft_000000000103',
    ]);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.targetFeatureId).sort()).toEqual([
      'ft_000000000102',
      'ft_000000000103',
    ]);
    expect(links.every((l) => l.sourceFeatureId === 'ft_000000000101')).toBe(true);
  });

  it('intra links work when rows pass through repository cleaned shape', () => {
    const raw = JSON.stringify({
      L5_Data_Architecture_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理技术Schema',
            Feature_Value: task10StrongTypeFv('订单主表'),
            Induction_Type: '主表基准',
            Parent_Table_Ref: 'N/A',
            Inference_Weight: 1,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
          },
          {
            Feature_Key: '物理技术Schema',
            Feature_Value: task10StrongTypeFv('订单行子表', {
              inductionType: '主子级联纵向裂变',
              parentRef: '订单主表',
            }),
            Induction_Type: '主子级联纵向裂变',
            Parent_Table_Ref: '订单主表',
            Introduction_Reason: '行项目裂变',
            Inference_Weight: 0.9,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'y' }],
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const cleaned = parsed.rows.map((r) => ({
      featureKey: r.featureKey,
      featureValue: r.featureValue,
      inductionType: r.inductionType,
      parentTableRef: r.parentTableRef,
      introductionReason: r.introductionReason,
      referenceFieldMapping: r.referenceFieldMapping,
      inferenceWeight: r.inferenceWeight,
    }));
    const links = buildTask10MainTableToBaseForwardLinks(cleaned, [
      'ft_000000000201',
      'ft_000000000202',
    ]);
    expect(links).toHaveLength(1);
    expect(links[0]?.logic).toBe('行项目裂变');
  });

  it('accepts L5_Data_Architecture_Matrix with 物理技术Schema', () => {
    const raw = JSON.stringify({
      L5_Data_Architecture_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理技术Schema',
            Operator: '等于',
            Feature_Value: task10StrongTypeFv('主从解耦垂直关联数据结构'),
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000010', logic: '范式排异' }],
            Inference_Weight: 1,
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]?.featureKey).toBe('物理表结构Schema');
    expect(parsed.rows[0]?.techHostPlatform).toBe('待 Input 1 宿主对齐');
  });

  it('accepts L5_Technical_DDL_Inference_Matrix root key alias', () => {
    const raw = JSON.stringify({
      L5_Technical_DDL_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理表结构Schema',
            Operator: '等于',
            Feature_Value: task10StrongTypeFv('主表B'),
            Tech_Host_Platform: '七巧低代码平台容器',
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000010', logic: 'x' }],
            Inference_Weight: 1,
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
  });

  it('builds schema field fission plans from columns JSON', () => {
    const fv = task10StrongTypeFv('插单核心事实主表');
    const raw = JSON.stringify({
      L5_Data_Architecture_Matrix: {
        Target_KV: [
          {
            Feature_Key: '物理技术Schema',
            Feature_Value: fv,
            Inference_Weight: 1,
            Evidence_Support_Chain: [{ FeatureID: 'ft_000000000001', logic: 'x' }],
          },
        ],
      },
    });
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const plans = buildTask10SchemaFieldFissionPlans(parsed.rows, ['ft_000000000301']);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    expect(plans[0]?.fieldName).toBe('主键编号');
    expect(plans[0]?.tableFeatureId).toBe('ft_000000000301');
  });

  it('repairs unescaped inner quotes in inference_summary (real LLM failure mode)', () => {
    const fv = task10StrongTypeFv('主表A');
    const broken = `{
  "L5_Technical_DDL_Matrix": {
    "Target_KV": [
      {
        "Feature_Key": "物理表结构Schema",
        "Operator": "等于",
        "Feature_Value": ${JSON.stringify(fv)},
        "Tech_Host_Platform": "七巧低代码平台容器",
        "Evidence_Support_Chain": [{ "FeatureID": "ft_000000000001", "logic": "x" }],
        "Inference_Weight": 1.0,
        "inference_summary": "通过"插入行-字段赋值"二级结构编译 RBAC"
      }
    ]
  }
}`;
    const norm = normalizeL5TechnicalDdlInferenceRawForServerSync(broken);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    const parsed = parseTask10L5TechnicalDdlTargetKvSyncRows(norm.normalized);
    expect(parsed.ok).toBe(true);
  });
});
