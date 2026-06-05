import { describe, expect, it } from 'vitest';
import {
  asciiSlugForDesignDetailTaskTokenTaskId,
  caseIdCompactForGraphTokenId,
} from '../src/modules/problem-cases/design-detail-graph-ids';
import {
  DESIGN_DETAIL_TASK0_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK0_LINE_TASK_ID,
  DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID,
  DESIGN_DETAIL_TASK10_LINE_TASK_ID,
} from '../src/modules/problem-cases/design-detail-task-graph-catalog';

describe('design-detail-graph-ids', () => {
  it('maps task0 graph/line taskId to task0 slug', () => {
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK0_GRAPH_TASK_ID)).toBe('task0');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK0_LINE_TASK_ID)).toBe('task0');
  });

  it('maps task1 graph taskId to task1 slug', () => {
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID)).toBe('task1');
  });

  it('maps task 5.5–10 graph taskIds to task55/…/task10 slugs (not ascii-stripped Chinese)', () => {
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID)).toBe('task55');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK6_L3_GRAPH_TASK_ID)).toBe('task6');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK7_L4_GRAPH_TASK_ID)).toBe('task7');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK8_L45_GRAPH_TASK_ID)).toBe('task8');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK85_L475_GRAPH_TASK_ID)).toBe('task85');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK9_L5_GRAPH_TASK_ID)).toBe('task9');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID)).toBe('task10');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK10_LINE_TASK_ID)).toBe('task10');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK55_L3_GRAPH_TASK_ID)).not.toBe('55l35vsm');
    expect(asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID)).not.toBe(
      '10schemarbac',
    );
  });

  it('builds task10 tokenId prefix with caseId underscore', () => {
    const slug = asciiSlugForDesignDetailTaskTokenTaskId(DESIGN_DETAIL_TASK10_L5_GRAPH_TASK_ID);
    const cc = caseIdCompactForGraphTokenId('problem_ea6245db');
    expect(`${`tk_${slug}_${cc}_`}000001`).toBe('tk_task10_problem_ea6245db_000001');
  });

  it('preserves underscore in caseId compact segment', () => {
    expect(caseIdCompactForGraphTokenId('problem_ea6245db')).toBe('problem_ea6245db');
  });
});
