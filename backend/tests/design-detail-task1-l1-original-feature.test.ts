import { describe, expect, it } from 'vitest';
import {
  buildTask1L1OriginalFeatureGraphPlan,
  buildTask1L1OriginalFeatureNodeValue,
  parseTask1L1OriginalFeatureTargetKvSyncRows,
} from '../src/modules/problem-cases/design-detail-task1-l1-original-feature';

describe('design-detail-task1-l1-original-feature', () => {
  it('parses L1_Original_Feature_Matrix and forces Pending validation status when missing', () => {
    const raw = JSON.stringify({
      L1_Original_Feature_Matrix: {
        Target_KV: [
          {
            Feature_ID: 'ft_000000000001',
            Feature_Key: '工商基础特征',
            Operator: '等于',
            Feature_Value: '经营范围示例',
          },
          {
            Feature_ID: 'ft_000000000055',
            Feature_Key: '原始数据化石特征',
            tokenstr: '现有表格/订单台账',
            Feature_Value: '列A ── 列B',
            Validation_Status: 'Pending',
          },
        ],
      },
    });
    const parsed = parseTask1L1OriginalFeatureTargetKvSyncRows(raw);
    if (!parsed.ok) {
      expect(parsed.ok).toBe(true);
      return;
    }
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.validationStatus).toBe('Pending');
    expect(parsed.rows[1]?.tokenstr).toBe('现有表格/订单台账');
  });

  it('builds graph plan value with Validation_Status in feature payload', () => {
    const parsed = parseTask1L1OriginalFeatureTargetKvSyncRows(
      JSON.stringify({
        L1_Original_Feature_Matrix: {
          Target_KV: [
            {
              Feature_ID: 'ft_000000000026',
              Feature_Key: '原始需求特征',
              Feature_Value: '口头插单',
              Validation_Status: 'Pending',
            },
          ],
        },
      }),
    );
    if (!parsed.ok) return;
    const plan = buildTask1L1OriginalFeatureGraphPlan(parsed.rows);
    const row = plan.rows[0];
    expect(row?.tokenSurfaces).toEqual(['原始需求特征']);
    const v = row?.featureValue as Record<string, unknown>;
    expect(v?.Validation_Status).toBe('Pending');
    expect(v?.Feature_Value).toBe('口头插单');
  });

  it('rejects fossil row without 现有表格/ tokenstr', () => {
    const parsed = parseTask1L1OriginalFeatureTargetKvSyncRows(
      JSON.stringify({
        L1_Original_Feature_Matrix: {
          Target_KV: [
            {
              Feature_ID: 'ft_000000000099',
              Feature_Key: '原始数据化石特征',
              Feature_Value: '列A',
            },
          ],
        },
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('buildTask1L1OriginalFeatureNodeValue always includes Validation_Status', () => {
    const v = buildTask1L1OriginalFeatureNodeValue('x', '文本特征值域自适应', '摘要');
    expect(v.Validation_Status).toBe('Pending');
  });
});
