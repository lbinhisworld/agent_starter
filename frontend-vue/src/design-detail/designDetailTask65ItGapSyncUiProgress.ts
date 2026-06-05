/**
 * [INPUT]: 任务 6.5 多环节模型原文
 * [OUTPUT]: `normalizeL65ItGapInferenceRawForServerSync` / `mergeL65ItGapInferenceRawOutputsForServerSync`
 * [POS]: `runTask65ItGapPipeline` 落库前合并与规范化（实现见 `designDetailTask2L1SyncUiProgress.ts`）
 */

export {
  mergeL65ItGapInferenceRawOutputsForServerSync,
  normalizeL65ItGapInferenceRawForServerSync,
  parseTask65L3TokenValidationMappingForAlignment,
} from './designDetailTask2L1SyncUiProgress';
