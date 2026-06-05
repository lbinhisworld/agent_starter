import { describe, expect, it } from 'vitest';
import {
  buildTask52CapabilityUnitToFieldSetForwardLinks,
  isTask52L3TargetKvSyncableFeatureKey,
  normalizeTask52L3MappedFeatureKey,
  normalizeL52AssetMappingRawForServerSync,
  parseTask52L3TargetKvSyncRows,
  parseTokenValidationMappingFromL52AssetMappingRaw,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task52-l3-matrix-keys', () => {
  it('accepts only 业务能力字段集 as syncable Feature_Key', () => {
    expect(isTask52L3TargetKvSyncableFeatureKey('业务能力字段集')).toBe(true);
    expect(isTask52L3TargetKvSyncableFeatureKey('业务功能字段')).toBe(false);
  });

  it('normalizes Mapped_L3_Feature to 业务能力单元', () => {
    expect(normalizeTask52L3MappedFeatureKey('业务能力单元')).toBe('业务能力单元');
    expect(normalizeTask52L3MappedFeatureKey('核心价值主张')).toBe(null);
  });

  it('parses 业务能力字段集 Target_KV with nested fields_schema_tree', () => {
    const raw = JSON.stringify({
      L3_Asset_Mapping_Matrix: {
        Target_KV: [
          {
            Feature_Key: '业务能力字段集',
            Operator: '等于',
            Feature_Value: '销售订单台账',
            associated_capability_unit: '前线拉单与大客户意向管理单元（销售部）',
            fields_schema_tree: [
              {
                field_name: '订单编号',
                data_type: '主键',
                constraints: '唯一非空',
                source_feature_id: 'ft_000000000001',
              },
            ],
            Validation_Status: 'Pending',
          },
        ],
      },
    });
    const parsed = parseTask52L3TargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.featureKey).toBe('业务能力字段集');
    expect(parsed.rows[0]?.featureValue).toBe('销售订单台账');
    expect(parsed.rows[0]?.associatedCapabilityUnit).toBe(
      '前线拉单与大客户意向管理单元（销售部）',
    );
    expect(Array.isArray(parsed.rows[0]?.fieldsSchemaTree)).toBe(true);
  });

  it('normalizes raw to L3_Asset_Mapping_Matrix root', () => {
    const raw = JSON.stringify({
      L3_Asset_Mapping_Matrix: {
        Target_KV: [{ Feature_Key: '业务能力字段集', Operator: '等于', Feature_Value: '表A' }],
      },
    });
    const norm = normalizeL52AssetMappingRawForServerSync(raw);
    expect(norm.ok).toBe(true);
    if (norm.ok) {
      const obj = JSON.parse(norm.normalized) as Record<string, unknown>;
      expect(obj.L3_Asset_Mapping_Matrix).toBeTruthy();
    }
  });

  it('buildTask52CapabilityUnitToFieldSetForwardLinks matches associated_capability_unit', () => {
    const links = buildTask52CapabilityUnitToFieldSetForwardLinks(
      [
        {
          associatedCapabilityUnit: '销售单元',
          causalitySummary: '因果大白话',
          inferenceWeight: 1,
        },
      ],
      ['ft_000000000200'],
      [{ featureId: 'ft_000000000100', label: '销售单元' }],
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.sourceFeatureId).toBe('ft_000000000100');
    expect(links[0]?.targetFeatureId).toBe('ft_000000000200');
    expect(links[0]?.logic).toBe('因果大白话');
    expect(links[0]?.weight).toBe(1);
  });

  it('parses Token_Validation_Mapping when present', () => {
    const raw = JSON.stringify({
      L3_Asset_Mapping_Matrix: {
        Target_KV: [
          {
            Feature_Key: '业务能力字段集',
            Operator: '等于',
            Feature_Value: '表A',
          },
        ],
        Token_Validation_Mapping: [
          {
            Target_FeatureID: 'ft_000000000052',
            Mapped_L3_Feature: '业务能力单元',
            Consistency: '逻辑一致',
            interview_question: 'N/A',
          },
        ],
      },
    });
    const plans = parseTokenValidationMappingFromL52AssetMappingRaw(raw);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.mappedL1FeatureKey).toBe('业务能力单元');
  });
});
