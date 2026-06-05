/**
 * [INPUT]: caseId、第一章正文
 * [OUTPUT]: 写入/读取设计报告 localStorage 叙事缓存
 * [POS]: 任务 11 与 `runDesignReportHybridEngine` 共用缓存键
 */

import {
  loadCachedDesignReportNarrative,
  saveCachedDesignReportNarrative,
} from './runDesignReportHybridEngine';

export function mergeChapter1IntoDesignReportCache(caseId: string, chapter1: string): void {
  const prev = loadCachedDesignReportNarrative(caseId) ?? {
    chapter1: '',
    chapter2: '',
    chapter3: '',
  };
  saveCachedDesignReportNarrative(caseId, {
    ...prev,
    chapter1,
  });
}

export function mergeChapter2IntoDesignReportCache(caseId: string, chapter2: string): void {
  const prev = loadCachedDesignReportNarrative(caseId) ?? {
    chapter1: '',
    chapter2: '',
    chapter3: '',
  };
  saveCachedDesignReportNarrative(caseId, {
    ...prev,
    chapter2,
  });
}

export function mergeChapter3IntoDesignReportCache(caseId: string, chapter3: string): void {
  const prev = loadCachedDesignReportNarrative(caseId) ?? {
    chapter1: '',
    chapter2: '',
    chapter3: '',
  };
  saveCachedDesignReportNarrative(caseId, {
    ...prev,
    chapter3,
  });
}
