/**
 * [INPUT]: `SmartCto.task8GlobalItGap`（由 `js/core/task8-global-itgap.js` 先于本文件加载并挂 `window.reportGlobalItGap*`）
 * [OUTPUT]: 若模块已就绪则透传；否则占位空实现（报告页脚本链须保证 module 先执行）
 * [POS]: Phase 4A 与主站 task8 模块对齐，避免阶段定义漂移
 *
 * [PROTOCOL]: 展示逻辑变更在 `task8-global-itgap.js` 内修改并同步验收
 */
(function (global) {
  'use strict';

  function api() {
    return global.SmartCto && global.SmartCto.task8GlobalItGap;
  }

  if (typeof global.reportGlobalItGapBuildWorkspaceHtml !== 'function') {
    global.reportGlobalItGapBuildWorkspaceHtml = function (raw) {
      var t = api();
      return t && typeof t.reportGlobalItGapBuildWorkspaceHtml === 'function' ? t.reportGlobalItGapBuildWorkspaceHtml(raw) : '';
    };
  }
  if (typeof global.reportGlobalItGapIsEmpty !== 'function') {
    global.reportGlobalItGapIsEmpty = function (raw) {
      var t = api();
      return t && typeof t.isGlobalItGapPayloadEmpty === 'function' ? t.isGlobalItGapPayloadEmpty(raw) : true;
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
