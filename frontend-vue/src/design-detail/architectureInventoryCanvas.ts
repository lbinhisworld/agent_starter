/**
 * [INPUT]: 无
 * [OUTPUT]: 架构清单画布 Tab / 子 Tab 常量
 * [POS]: `DesignDetailArchitectureInventoryTab`、`runTask10DataArchitecturePipeline`、`useDesignDetailChat`
 *
 * [PROTOCOL]: 与 `designDetailProgressWorkspace` 快照迁移（旧 `data_architecture`）保持一致
 */

/** 工作画布主 Tab：架构清单（原「数据架构」） */
export const ARCHITECTURE_INVENTORY_TAB_ID = 'architecture_inventory';

/** @deprecated 快照兼容；解析时映射为 `ARCHITECTURE_INVENTORY_TAB_ID` */
export const LEGACY_DATA_ARCHITECTURE_TAB_ID = 'data_architecture';

export type ArchitectureInventorySubTabKey = 'design_report' | 'business_process' | 'function_inventory' | 'er_diagram';

export type ArchitectureInventorySubTabDef = {
  key: ArchitectureInventorySubTabKey;
  label: string;
};

export const ARCHITECTURE_INVENTORY_SUB_TABS: ArchitectureInventorySubTabDef[] = [
  { key: 'design_report', label: '设计报告' },
  { key: 'business_process', label: '业务流程' },
  { key: 'function_inventory', label: '功能清单' },
  { key: 'er_diagram', label: 'ER 图' },
];

export const DEFAULT_ARCHITECTURE_INVENTORY_SUB_TAB: ArchitectureInventorySubTabKey = 'function_inventory';
