import { describe, expect, it } from 'vitest';
import { buildRollbackCasePatch } from '../src/modules/problem-cases/problem-case-rollback';
import type { ProblemCase } from '../src/modules/problem-cases/types';

function baseItem(overrides: Partial<ProblemCase> = {}): ProblemCase {
  return {
    id: 'problem_x',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archiveNo: 1,
    customerName: 'C',
    customerNeedsOrChallenges: 'n',
    customerItStatus: 's',
    projectTimeRequirement: 't',
    currentMajorStage: 3,
    currentItStrategySubstep: 0,
    completedStages: [0, 1, 2, 3],
    workflowAlignCompletedStages: [0, 1],
    itGapCompletedStages: [0],
    completedTaskIds: ['task1', 'task2'],
    basicInfo: { company_name: 'X', huge: 'y'.repeat(100) },
    bmc: { k: 1 },
    ...overrides,
  } as ProblemCase;
}

describe('buildRollbackCasePatch', () => {
  it('回退到 task2 时不带 basicInfo 键（避免巨型 JSON 重写）', () => {
    const item = baseItem();
    const patch = buildRollbackCasePatch(item, 'task2');
    expect(patch).not.toHaveProperty('basicInfo');
    expect(patch.bmc).toBeNull();
  });

  it('回退到 task1 时带 basicInfo 清空语义（null）', () => {
    const item = baseItem();
    const patch = buildRollbackCasePatch(item, 'task1');
    expect(patch).toHaveProperty('basicInfo');
    expect(patch.basicInfo).toBeNull();
  });

  it('回退到 task8 时清空 itDesignSupplementSessions（null）', () => {
    const item = baseItem({
      itDesignSupplementSessions: [{ id: 's1' }],
      globalItGapAnalysisJson: { k: 1 },
    });
    const patch = buildRollbackCasePatch(item, 'task8');
    expect(patch.itDesignSupplementSessions).toBeNull();
    expect(patch.globalItGapAnalysisJson).toBeNull();
    expect(patch).not.toHaveProperty('basicInfo');
  });
});
