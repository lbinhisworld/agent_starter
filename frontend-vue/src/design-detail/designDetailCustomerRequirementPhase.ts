/**
 * [INPUT]: `caseId`（与 `designDetailLineState` 同源按案例隔离）
 * [OUTPUT]: 设计详情 task1「画布已展示客户基本信息 → 等待用户输入需求 → 需求提炼完成」的 **本页会话阶段**（`localStorage`，不写入 `problem_detail_chats`）
 * [POS]: `useDesignDetailChat.ts` 与 `designDetailTaskMirror.ts` 门控
 *
 * [PROTOCOL]: 变更阶段语义或键名时须同步 `design_mode_ux.md`、`useDesignDetailChat.ts`、`designDetailTaskMirror.ts`、`designDetailProgressWorkspace.ts`
 */

const STORAGE_KEY_PREFIX = 'smart_cto_design_detail_customer_req_v1:';

/** `idle`：未进入或未展示需求引导；`awaiting`：已展示「请输入用户需求」等待发送；`completed`：已跑过需求提炼 LLM（选「否」继续任务线时亦写入 `completed`）；`paused`：历史/兼容：旧版在「是否继续补充需求」选「否」时写入，现行不再写入 */
export type DesignDetailCustomerRequirementPhase = 'idle' | 'awaiting' | 'completed' | 'paused';

export function designDetailCustomerRequirementStorageKey(caseId: string): string {
  return `${STORAGE_KEY_PREFIX}${String(caseId || '').trim()}`;
}

export function loadDesignDetailCustomerRequirementPhase(caseId: string): DesignDetailCustomerRequirementPhase {
  if (typeof window === 'undefined' || !String(caseId || '').trim()) return 'idle';
  try {
    const raw = window.localStorage.getItem(designDetailCustomerRequirementStorageKey(caseId));
    const v = String(raw || '').trim();
    if (v === 'awaiting' || v === 'completed' || v === 'paused') return v;
    return 'idle';
  } catch {
    return 'idle';
  }
}

export function saveDesignDetailCustomerRequirementPhase(
  caseId: string,
  phase: DesignDetailCustomerRequirementPhase,
): void {
  if (typeof window === 'undefined' || !String(caseId || '').trim()) return;
  try {
    if (phase === 'idle') {
      window.localStorage.removeItem(designDetailCustomerRequirementStorageKey(caseId));
    } else {
      window.localStorage.setItem(designDetailCustomerRequirementStorageKey(caseId), phase);
    }
  } catch {
    /* ignore quota */
  }
}
