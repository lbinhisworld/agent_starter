/**
 * [INPUT]: Vite 静态资源 `assets/excel-field-icon.png`
 * [OUTPUT]: 逻辑树 5.2 字段标签与需求提炼「现有表格」表名共用的 Excel 图标 URL
 * [POS]: `DesignDetailLogicTreeModal.vue`、`designDetailRequirementPrelimCanvasHtml.ts`
 *
 * [PROTOCOL]: 更换图标文件时同步上述引用处与本目录 `AGENTS.md`
 */

import excelFieldIconUrl from './assets/excel-field-icon.png';

/** 与逻辑树 `.dd-tree-field-tag-excel` 同源图标 */
export const DESIGN_DETAIL_EXCEL_FIELD_ICON_URL = excelFieldIconUrl;
