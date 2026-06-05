import { describe, expect, it } from 'vitest';
import {
  mergeValidationStatusIntoTask1FeatureValue,
  TASK1_VALIDATION_STATUS_RESOLVED_BY_CUSTOMER,
} from '../src/modules/problem-cases/design-detail-task1-validation-status';

describe('design-detail-task1-validation-status', () => {
  it('merges Resolved_By_Customer into object value', () => {
    const out = mergeValidationStatusIntoTask1FeatureValue({
      Feature_Value: '现有表格/手工登记表',
      Validation_Status: 'Pending',
    });
    expect(out.Validation_Status).toBe(TASK1_VALIDATION_STATUS_RESOLVED_BY_CUSTOMER);
    expect(out.Feature_Value).toBe('现有表格/手工登记表');
  });

  it('wraps scalar string value', () => {
    const out = mergeValidationStatusIntoTask1FeatureValue('plain');
    expect(out.Validation_Status).toBe(TASK1_VALIDATION_STATUS_RESOLVED_BY_CUSTOMER);
    expect(out.Feature_Value).toBe('plain');
  });
});
