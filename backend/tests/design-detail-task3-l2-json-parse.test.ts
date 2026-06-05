import { describe, expect, it } from 'vitest';
import {
  normalizeL2BusinessInferenceRawForServerSync,
  parseTask3L2TargetKvSyncRows,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

/** 模型照抄提示词 schema 时常见的非法 JSON（0.0-1.0 非合法数字） */
const SAMPLE_WITH_RANGE_PLACEHOLDER = `{
  "L2_Business_Inference_Matrix": {
    "Target_KV": [
      {
        "Feature_Key": "核心资产属性",
        "Operator": "等于",
        "Feature_Value": "实物资产",
        "Inference_Weight": 0.0-1.0
      },
      {
        "Feature_Key": "交付模式",
        "Operator": "等于",
        "Feature_Value": "订单制/流量驱动",
        "Inference_Weight": 0.85
      },
      {
        "Feature_Key": "行业类别",
        "Operator": "等于",
        "Feature_Value": "精细化工",
        "Inference_Weight": 1.0
      }
    ],
    "Token_Validation_Mapping": [],
    "Causality_Analysis": {
      "L1_Constraint_Effect": "test",
      "Insight_Resolution_Summary": "test"
    }
  }
}`;

describe('normalizeL2BusinessInferenceRawForServerSync', () => {
  it('strips markdown fence before sync parse', () => {
    const fenced = '```json\n' + SAMPLE_WITH_RANGE_PLACEHOLDER + '\n```';
    const norm = normalizeL2BusinessInferenceRawForServerSync(fenced);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    expect(norm.normalized.startsWith('```')).toBe(false);
    const got = parseTask3L2TargetKvSyncRows(norm.normalized);
    expect(got.ok).toBe(true);
  });
});

describe('parseTask3L2TargetKvSyncRows', () => {
  it('parses when model copies schema placeholder Inference_Weight 0.0-1.0', () => {
    const got = parseTask3L2TargetKvSyncRows(SAMPLE_WITH_RANGE_PLACEHOLDER);
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.rows.map((r) => r.featureKey).sort()).toEqual(
        ['交付模式', '核心资产属性', '行业类别'].sort(),
      );
    }
  });
});
