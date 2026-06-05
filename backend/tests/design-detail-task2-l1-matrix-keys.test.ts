import { describe, expect, it } from 'vitest';
import {
  normalizeTask2L1MappedFeatureKey,
  parseTask2L1TargetKvSyncRows,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('design-detail-task2-l1-matrix-keys', () => {
  it('normalizes legacy Mapped_L1_Feature aliases to 组织管控拓扑', () => {
    expect(normalizeTask2L1MappedFeatureKey('组织管控拓扑')).toBe('组织管控拓扑');
    expect(normalizeTask2L1MappedFeatureKey('组织模式')).toBe('组织管控拓扑');
    expect(normalizeTask2L1MappedFeatureKey('组织拓扑')).toBe('组织管控拓扑');
    expect(normalizeTask2L1MappedFeatureKey('合规约束等级')).toBe('合规约束等级');
  });

  it('parses Target_KV Validation_Status for task 2 sync', () => {
    const raw = JSON.stringify({
      L1_Entity_Inference_Matrix: {
        Target_KV: [
          {
            Feature_Key: '组织管控拓扑',
            Operator: '等于',
            Feature_Value: '跨境多组织结算型',
            Validation_Status: 'Resolved_By_Customer',
          },
          {
            Feature_Key: '合规约束等级',
            Operator: '等于',
            Feature_Value: '5级强控',
            Validation_Status: 'Pending',
          },
          {
            Feature_Key: '管控复杂度',
            Operator: '等于',
            Feature_Value: '高',
          },
        ],
      },
    });
    const parsed = parseTask2L1TargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]?.validationStatus).toBe('Resolved_By_Customer');
    expect(parsed.rows[1]?.validationStatus).toBe('Pending');
  });
});
