/**
 * [INPUT]: Prisma 事务 `tx`、`caseId`、落库用 `taskId` 字符串
 * [OUTPUT]: **`DesignDetailTaskToken.tokenId`**（`tk_{asciiTask}_{caseCompact}_{6位数字}`，同案例同 `taskId` 下从 `000001` 递增）、**`DesignFeatureNode.featureId`**（`ft_`+12 位十进制，全局递增）、**`DesignLogicLink.linkId`**（`lk_`+12 位十进制，全局递增）；**`asciiSlugForDesignDetailTaskTokenTaskId`**（`taskId` 去掉中文等非英文数字下划线后的短名，供 tokenId 段使用）
 * [POS]: problem-cases；由 `prisma-problem-case.repository` 在写推理图事务内调用
 *
 * [PROTOCOL]: 变更主键格式或位数时须同步 `schema.prisma` 注释、`docs/agents/backend/01-context.md` 与前端对 `featureId`/`themeKey` 的兜底解析；历史行仍为 `cuid` / `dd:…` 时 MAX 查询仅统计新形态，不与旧串混排
 */

import type { Prisma } from '@prisma/client';
import { DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID } from './design-detail-customer-req-section-graph';
import { DESIGN_DETAIL_TASK1_LINE_TASK_ID } from './design-detail-task1-basic-graph';
import {
  DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID,
  isDesignDetailTask0TokenTaskId,
  isDesignDetailTask2L1TokenTaskId,
  isDesignDetailTask3L2TokenTaskId,
  isDesignDetailTask4L2TokenTaskId,
  isDesignDetailTask5L3TokenTaskId,
  isDesignDetailTask51L3TokenTaskId,
  isDesignDetailTask52L3TokenTaskId,
  isDesignDetailTask53L3TokenTaskId,
  isDesignDetailTask55L3TokenTaskId,
  isDesignDetailTask6L3TokenTaskId,
  isDesignDetailTask65L3TokenTaskId,
  isDesignDetailTask7L4TokenTaskId,
  isDesignDetailTask8L45TokenTaskId,
  isDesignDetailTask85L475TokenTaskId,
  isDesignDetailTask9L5TokenTaskId,
  isDesignDetailTask10L5TokenTaskId,
} from './design-detail-task-graph-catalog';

/** `taskId` 只保留 `[a-zA-Z0-9_]` 并转小写；已知中文落库任务名映射为 `task1`…`task10`（含 `task55` / `task85`） */
export function asciiSlugForDesignDetailTaskTokenTaskId(dbTaskId: string): string {
  const t = String(dbTaskId || '').trim();
  if (
    t === DESIGN_DETAIL_TASK1_TOKEN_GRAPH_TASK_ID ||
    t === DESIGN_DETAIL_TASK1_LINE_TASK_ID ||
    t === DESIGN_DETAIL_CUSTOMER_REQUIREMENT_TASK_ID
  ) {
    return 'task1';
  }
  if (isDesignDetailTask2L1TokenTaskId(t)) {
    return 'task2';
  }
  if (isDesignDetailTask3L2TokenTaskId(t)) {
    return 'task3';
  }
  if (isDesignDetailTask4L2TokenTaskId(t)) {
    return 'task4';
  }
  if (isDesignDetailTask5L3TokenTaskId(t)) {
    return 'task5';
  }
  if (isDesignDetailTask51L3TokenTaskId(t)) {
    return 'task51';
  }
  if (isDesignDetailTask52L3TokenTaskId(t)) {
    return 'task52';
  }
  if (isDesignDetailTask53L3TokenTaskId(t)) {
    return 'task53';
  }
  if (isDesignDetailTask55L3TokenTaskId(t)) {
    return 'task55';
  }
  if (isDesignDetailTask6L3TokenTaskId(t)) {
    return 'task6';
  }
  if (isDesignDetailTask65L3TokenTaskId(t)) {
    return 'task65';
  }
  if (isDesignDetailTask7L4TokenTaskId(t)) {
    return 'task7';
  }
  if (isDesignDetailTask8L45TokenTaskId(t)) {
    return 'task8';
  }
  if (isDesignDetailTask85L475TokenTaskId(t)) {
    return 'task85';
  }
  if (isDesignDetailTask9L5TokenTaskId(t)) {
    return 'task9';
  }
  if (isDesignDetailTask10L5TokenTaskId(t)) {
    return 'task10';
  }
  if (isDesignDetailTask0TokenTaskId(t)) {
    return 'task0';
  }
  const ascii = t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  return ascii.length > 0 ? ascii.slice(0, 48) : 'task';
}

/** 案例 id 压缩进 `tokenId`：保留英数与下划线、小写、截断，避免主键过长（如 `problem_ea6245db`） */
export function caseIdCompactForGraphTokenId(caseId: string): string {
  return String(caseId || '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
    .slice(0, 48);
}

/**
 * 分配下一条 **`tk_{slug}_{caseCompact}_{nnnnnn}`**（**每案例 + slug** 下 6 位递增；全局唯一由 caseCompact+slug+seq 保证）。
 */
export async function allocateNextDesignDetailTaskTokenId(
  tx: Prisma.TransactionClient,
  caseId: string,
  dbTaskId: string,
): Promise<string> {
  const slug = asciiSlugForDesignDetailTaskTokenTaskId(dbTaskId);
  const cc = caseIdCompactForGraphTokenId(caseId);
  const prefix = `tk_${slug}_${cc}_`;
  const existing = await tx.designDetailTaskToken.findMany({
    where: { caseId, tokenId: { startsWith: prefix } },
    select: { tokenId: true },
  });
  let maxN = 0;
  for (const r of existing) {
    if (!r.tokenId.startsWith(prefix)) continue;
    const tail = r.tokenId.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) maxN = Math.max(maxN, n);
  }
  const next = maxN + 1;
  if (next > 999999) {
    throw new Error('DesignDetailTaskToken 同案例同任务序号超出 6 位');
  }
  return `${prefix}${String(next).padStart(6, '0')}`;
}

function parseMax12DigitRows(rows: Array<{ m: unknown }>): bigint {
  const raw = rows[0]?.m;
  if (raw == null) return 0n;
  if (typeof raw === 'bigint') return raw;
  const s = String(raw).trim();
  if (!s || s === 'null') return 0n;
  if (!/^\d+$/.test(s)) return 0n;
  return BigInt(s);
}

/** 全局下一条 `ft_000000000001` 形态（与历史 `dd:…` / `cuid` 行并存，仅对新串取 MAX） */
export async function allocateNextDesignFeatureNumericId12(tx: Prisma.TransactionClient): Promise<string> {
  const rows = (await tx.$queryRawUnsafe(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(`featureId`, 4) AS UNSIGNED)), 0) AS m FROM `DesignFeatureNode` WHERE `featureId` REGEXP '^ft_[0-9]{12}$'",
  )) as Array<{ m: unknown }>;
  const cur = parseMax12DigitRows(rows);
  const next = cur + 1n;
  if (next > 999999999999n) {
    throw new Error('DesignFeatureNode 12 位数字已满');
  }
  return `ft_${String(next).padStart(12, '0')}`;
}

/** 全局下一条 `lk_000000000001` 形态 */
export async function allocateNextDesignLogicLinkNumericId12(tx: Prisma.TransactionClient): Promise<string> {
  const rows = (await tx.$queryRawUnsafe(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(`linkId`, 4) AS UNSIGNED)), 0) AS m FROM `DesignLogicLink` WHERE `linkId` REGEXP '^lk_[0-9]{12}$'",
  )) as Array<{ m: unknown }>;
  const cur = parseMax12DigitRows(rows);
  const next = cur + 1n;
  if (next > 999999999999n) {
    throw new Error('DesignLogicLink 12 位数字已满');
  }
  return `lk_${String(next).padStart(12, '0')}`;
}
