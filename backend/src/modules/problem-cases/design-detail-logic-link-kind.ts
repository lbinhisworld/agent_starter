/**
 * [INPUT]: 无外部 IO
 * [OUTPUT]: 根据源/目标特征所绑定 token 的 **`DesignDetailTaskToken.taskId`** 推断 **`DesignLogicLink.linkKind`**（Prisma 成员）；**`designLogicLinkKindToApiValue`** 将 GET `task-graph` 下发为 **中文 ENUM 取值**
 * [POS]: problem-cases；供 `prisma-problem-case.repository` 写边与迁移回填规则对齐
 *
 * [PROTOCOL]: 变更「任务 1」落库/历史 `taskId` 兼容集合时须同步 `design-detail-task-graph-catalog.ts` 与本文件；与产品口径一致：**非任务 1 → 任务 1** 为 **反向验证**（DB 存「反向验证」），其余为 **正向归纳**（DB 存「正向归纳」）
 */

/** 与 Prisma `DesignLogicLinkKind` 枚举成员名一致（本文件不依赖 `@prisma/client`，避免 generate 前类型断裂） */
export type DesignLogicLinkKindValue = 'FORWARD_INDUCTION' | 'REVERSE_VALIDATION';

/** 与 MySQL `DesignLogicLink.linkKind` ENUM 字面量及 `GET …/task-graph` 下发一致 */
export type DesignLogicLinkKindApiValue = '正向归纳' | '反向验证';

/** 将 Prisma 枚举成员名或历史英文 ENUM 字面值转为 API / 前端统一中文取值 */
export function designLogicLinkKindToApiValue(raw: string | null | undefined): DesignLogicLinkKindApiValue {
  const s = String(raw ?? '').trim();
  if (s === 'REVERSE_VALIDATION' || s === '反向验证') return '反向验证';
  return '正向归纳';
}

/** 与 `DesignDetailTaskToken.taskId` 实际落库及历史读路径对齐（特征经 `tokenId` 关联 token 行） */
const DESIGN_DETAIL_TASK1_TOKEN_TASK_IDS = new Set<string>([
  'customer_basic',
  'customer_requirement',
  '任务 1：客户基本情况了解',
]);

export function isDesignDetailTask1GraphTokenTaskId(taskId: string): boolean {
  return DESIGN_DETAIL_TASK1_TOKEN_TASK_IDS.has(String(taskId || '').trim());
}

/**
 * 产品规则：**从非任务 1 节点指向任务 1 节点**的链接为 **反向验证**（落库 ENUM「反向验证」）；其余为 **正向归纳**（「正向归纳」）。
 * 判定依据为端点特征绑定 token 行的 `taskId`（非 `GET` 聚合用线步 id）。
 */
export function inferDesignLogicLinkKind(
  sourceTokenTaskId: string,
  targetTokenTaskId: string,
): DesignLogicLinkKindValue {
  const src = String(sourceTokenTaskId || '').trim();
  const tgt = String(targetTokenTaskId || '').trim();
  if (!isDesignDetailTask1GraphTokenTaskId(src) && isDesignDetailTask1GraphTokenTaskId(tgt)) {
    return 'REVERSE_VALIDATION';
  }
  return 'FORWARD_INDUCTION';
}
