import { describe, expect, it } from 'vitest';
import {
  canonicalizeTask85L475PhysicalHookFeatureKey,
  coerceHttpBodyToL3ProcessInferenceRawString,
  normalizeL475PhysicalHookInferenceRawForServerSync,
  parseTask85L475PhysicalHookTargetKvSyncRows,
} from '../src/modules/problem-cases/design-detail-task2-l1-target-kv-tokens';

describe('task 8.5 L4.7 Target_KV', () => {
  it('canonicalizes Feature_Key with interior spaces', () => {
    expect(canonicalizeTask85L475PhysicalHookFeatureKey('衔 接 互 动 层')).toBe('衔接互动层');
    expect(canonicalizeTask85L475PhysicalHookFeatureKey('自动化流 Hook')).toBe('自动化流Hook');
  });

  const dualEvidence = [
    {
      FeatureID: 'ft_100000000001',
      tokenstr: '状态转移矩阵',
      logic: '业务',
      value: '',
    },
    {
      FeatureID: 'ft_200000000002',
      tokenstr: '工具提供连接器',
      logic: '技术',
      value: '',
    },
  ];

  it('parses malformed matrix with layer keys instead of Target_KV array', () => {
    const raw = JSON.stringify({
      L4_7_Tech_Integration_Matrix: {
        Token_Validation_Mapping: [],
        衔接互动层: {
          Operator: '等于',
          Feature_Value: '企微气泡通知',
          value_ref_domain: 'N/A',
          Evidence_Support_Chain: dualEvidence,
          Inference_Weight: 0.9,
          inference_summary: '小结',
        },
      },
    });
    const p = parseTask85L475PhysicalHookTargetKvSyncRows(raw);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]?.featureKey).toBe('衔接互动层');
    expect(p.rows[0]?.featureValue).toBe('企微气泡通知');
    const norm = normalizeL475PhysicalHookInferenceRawForServerSync(raw);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    const p2 = parseTask85L475PhysicalHookTargetKvSyncRows(norm.normalized);
    expect(p2.ok).toBe(true);
  });

  it('parses Target_KV rows that are JSON string blobs', () => {
    const rowObj = {
      Feature_Key: '数据承载层',
      Operator: '等于',
      Feature_Value: '主表租户隔离',
      value_ref_domain: 'N/A',
      Evidence_Support_Chain: dualEvidence,
      Inference_Weight: 1,
      inference_summary: 'x',
    };
    const raw = JSON.stringify({
      L4_7_Tech_Integration_Matrix: {
        Target_KV: [JSON.stringify(rowObj)],
      },
    });
    const p = parseTask85L475PhysicalHookTargetKvSyncRows(raw);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]?.featureKey).toBe('数据承载层');
  });

  it('coerceHttpBodyToL3ProcessInferenceRawString accepts top-level L4_7 matrix only', () => {
    const inner = {
      Target_KV: [
        {
          Feature_Key: '界面交互层',
          Operator: '等于',
          Feature_Value: '看板',
          value_ref_domain: 'N/A',
          Evidence_Support_Chain: dualEvidence,
          Inference_Weight: 1,
          inference_summary: 'x',
        },
      ],
    };
    const s = coerceHttpBodyToL3ProcessInferenceRawString({
      L4_7_Tech_Integration_Matrix: inner,
    });
    expect(s).toBeTruthy();
    const p = parseTask85L475PhysicalHookTargetKvSyncRows(String(s));
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.rows[0]?.featureKey).toBe('界面交互层');
  });
});
