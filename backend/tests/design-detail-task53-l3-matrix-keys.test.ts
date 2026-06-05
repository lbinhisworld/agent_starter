import { describe, expect, it } from 'vitest';
import {
  TASK53_L3_WORKFLOW_FLOW_KEY,
  extractTask53WorkflowPayloadFromDesignFeatureValue,
  isTask53L3TargetKvSyncableFeatureKey,
  normalizeTask53L3MappedFeatureKey,
  parseTask53L3TargetKvSyncRows,
  parseTokenValidationMappingFromL53WorkflowFlowRaw,
  task53WorkflowNameFromDesignFeatureValue,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task53-l3-matrix-keys', () => {
  it('accepts 关键工作流 and legacy 关键场景时序流转', () => {
    expect(isTask53L3TargetKvSyncableFeatureKey('关键工作流')).toBe(true);
    expect(isTask53L3TargetKvSyncableFeatureKey('关键场景时序流转')).toBe(true);
    expect(isTask53L3TargetKvSyncableFeatureKey('关键场景')).toBe(false);
  });

  it('normalizes Mapped_L3_Feature to 关键工作流', () => {
    expect(normalizeTask53L3MappedFeatureKey('关键工作流')).toBe(TASK53_L3_WORKFLOW_FLOW_KEY);
    expect(normalizeTask53L3MappedFeatureKey('关键场景时序流转')).toBe(TASK53_L3_WORKFLOW_FLOW_KEY);
  });

  it('parses 关键工作流 with workflow_steps_topology object Feature_Value', () => {
    const raw = JSON.stringify({
      L3_Workflow_Flow_Matrix: {
        Target_KV: [
          {
            Feature_Key: '关键工作流',
            Operator: '等于',
            Feature_Value: {
              workflow_name: '测试主流程',
              workflow_steps_topology: [
                {
                  step_name: '步骤甲',
                  associated_capability_unit: '销售部单元',
                  associated_asset_dataset: '表A | 字段集A',
                  predecessor_step_name: 'START_NODE',
                  successor_step_name: 'END_NODE',
                  link_interlock_edge: {
                    source_key_field: '主键A',
                    destination_foreign_field: 'N/A',
                  },
                },
              ],
              delivery_action_facts: '测试大白话',
            },
            Validation_Status: 'Pending',
          },
        ],
        Token_Validation_Mapping: [
          {
            Target_FeatureID: 'ft_test_001',
            Token_Str: '业务能力字段集/表A | 字段集A',
            Mapped_L3_Feature: '关键工作流',
            Validation_Logic: '放行',
            interview_question: 'N/A',
            Validation_Weight: 1,
            Consistency: '逻辑一致',
          },
        ],
      },
    });
    const parsed = parseTask53L3TargetKvSyncRows(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.featureKey).toBe(TASK53_L3_WORKFLOW_FLOW_KEY);

    const plans = parseTokenValidationMappingFromL53WorkflowFlowRaw(raw);
    expect(plans[0]?.mappedL1FeatureKey).toBe(TASK53_L3_WORKFLOW_FLOW_KEY);
  });

  it('extracts workflow from DB value with stringified Feature_Value', () => {
    const inner = {
      workflow_name: '外委订单创建与开工',
      workflow_steps_topology: [
        {
          step_name: '接单',
          predecessor_step_name: 'START_NODE',
          successor_step_name: 'END_NODE',
        },
      ],
    };
    const dbValue = {
      Feature_Value: JSON.stringify(inner),
      inference_summary: '长段推理摘要不应作为标题',
    };
    expect(task53WorkflowNameFromDesignFeatureValue(dbValue)).toBe('外委订单创建与开工');
    const payload = extractTask53WorkflowPayloadFromDesignFeatureValue(dbValue);
    expect(payload?.workflow_name).toBe('外委订单创建与开工');
    expect(Array.isArray(payload?.workflow_steps_topology)).toBe(true);
  });

  it('extracts workflow when whole L3 matrix was stored in value', () => {
    const dbValue = {
      L3_Workflow_Flow_Matrix: {
        Target_KV: [
          {
            Feature_Key: '关键工作流',
            Feature_Value: {
              workflow_name: '矩阵内流程',
              workflow_steps_topology: [{ step_name: '步骤一' }],
            },
          },
        ],
      },
    };
    expect(task53WorkflowNameFromDesignFeatureValue(dbValue)).toBe('矩阵内流程');
  });
});
