import { describe, expect, it } from 'vitest';
import {
  isTask5L3TargetKvSyncableFeatureKey,
  parseTask5L3TargetKvSyncRows,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task5-l3-matrix-keys', () => {
  it('recognizes macro and VSM stage keys', () => {
    expect(isTask5L3TargetKvSyncableFeatureKey('宏观业务流程模式')).toBe(true);
    expect(isTask5L3TargetKvSyncableFeatureKey('价值流阶段_25')).toBe(true);
    expect(isTask5L3TargetKvSyncableFeatureKey('未知键')).toBe(false);
  });

  it('parses L3_Process_Inference_Matrix with Validation_Status', () => {
    const raw = JSON.stringify({
      L3_Process_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '宏观业务流程模式',
            Operator: '等于',
            Feature_Value: '高密度合规流程',
            Validation_Status: 'Resolved_By_Customer',
          },
          {
            Feature_Key: '价值流阶段_10',
            Operator: '等于',
            Feature_Value: '10_合同提报与资质准入阶段',
            Validation_Status: 'Resolved_By_Customer',
          },
        ],
      },
    });
    const parsed = parseTask5L3TargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.validationStatus).toBe('Resolved_By_Customer');
  });
});
