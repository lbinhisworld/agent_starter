import { describe, expect, it } from 'vitest';
import {
  buildCustomerReqSectionGraphPlan,
  buildExistingSpreadsheetsSectionPlan,
  buildPainPointRadarSectionPlan,
  isAllowedCustomerReqSectionKey,
  parseExistingSpreadsheetsFromRequirementText,
} from '../src/modules/problem-cases/design-detail-customer-req-section-graph';

describe('design-detail-customer-req-section-graph', () => {
  it('isAllowedCustomerReqSectionKey 含 existingSpreadsheets', () => {
    expect(isAllowedCustomerReqSectionKey('existingSpreadsheets')).toBe(true);
  });

  it('businessContext 不為 businessStatus 生成 token 行', () => {
    const plan = buildCustomerReqSectionGraphPlan('case-1', 'businessContext', '业务背景', {
      clientName: '示例企业',
      industryDomain: '培训',
      businessStatus: '旧版现状与矛盾段落',
      orgTopology: { type: '单体', scale: '10 城' },
    });
    const surfaces = plan.rows.map((r) => r.tokenSurfaces[0]);
    expect(surfaces).not.toContain('业务背景/（businessStatus）');
    expect(surfaces).not.toEqual(expect.arrayContaining([expect.stringMatching(/businessStatus/i)]));
    expect(surfaces).toContain('业务背景/企业/项目名称');
    expect(surfaces).toContain('业务背景/组织拓扑');
  });

  it('painPointRadar 仅用顶层 corePainPointSummary 生成「痛点雷达/核心痛点总结」', () => {
    const plan = buildPainPointRadarSectionPlan(
      'case-1',
      'painPointRadar',
      '痛点雷达',
      [{ dimension: '系统', description: '协同弱', itGap: '缺自动化' }],
      {
        corePainPointSummary: '核心矛盾总结',
        businessContext: { businessStatus: '不应再生成业务背景 token' },
      },
    );
    const summaryRows = plan.rows.filter((r) => r.fieldKey === 'corePainPointSummary');
    expect(summaryRows).toHaveLength(1);
    expect(summaryRows[0]?.tokenSurfaces).toEqual(['痛点雷达/核心痛点总结']);
  });

  it('parseExistingSpreadsheetsFromRequirementText 纯编号块不提炼', () => {
    const rows = parseExistingSpreadsheetsFromRequirementText(
      '需求含 数据表 1：（配方编号, 客户自定义色号）；数据表2：（批次号、数量）',
    );
    expect(rows).toHaveLength(0);
  });

  it('parseExistingSpreadsheetsFromRequirementText 识别 数据表N-具名', () => {
    const rows = parseExistingSpreadsheetsFromRequirementText(
      '数据表 2-密炼排产台账：（配方编号, 机台状态位）',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tableName).toBe('密炼排产台账');
  });

  it('parseExistingSpreadsheetsFromRequirementText 识别《》具名表', () => {
    const rows = parseExistingSpreadsheetsFromRequirementText(
      '《前线接单台账》：（客户唯一信用代码, 办事处编码）',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tableName).toBe('前线接单台账');
    expect(rows[0]?.columnHeaders).toContain('客户唯一信用代码');
  });

  it('buildExistingSpreadsheetsSectionPlan 丢弃占位表名且不按字段归纳', () => {
    const plan = buildExistingSpreadsheetsSectionPlan('case-1', 'existingSpreadsheets', '现有表格', [
      { tableName: '数据表 1', columnHeaders: ['密炼车间编号', '机台状态位'] },
      { tableName: '前线接单台账', columnHeaders: ['订单号'] },
    ]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]?.tokenSurfaces).toEqual(['现有表格/前线接单台账']);
  });

  it('existingSpreadsheets 生成 现有表格/具体表名 token 且 operator 为包含', () => {
    const plan = buildExistingSpreadsheetsSectionPlan('case-1', 'existingSpreadsheets', '现有表格', [
      { tableName: '前线接单与订单业务表', columnHeaders: ['A', 'B'] },
    ]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]?.tokenSurfaces).toEqual(['现有表格/前线接单与订单业务表']);
    expect(plan.rows[0]?.operator).toBe('包含');
    expect(plan.rows[0]?.featureValue).toBe('A, B');
  });
});
