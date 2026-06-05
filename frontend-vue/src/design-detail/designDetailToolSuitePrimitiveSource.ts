/**
 * [INPUT]: 工具详情页工具知识集（`tool-detail-knowledge-persist`「特征」视图同源数据）
 * [OUTPUT]: 逻辑树任务 0 层可用的原语列表；sync 后 `featureId`/`tokenId` 由后端分配（`ft_`+12 位 / `tk_task0_{caseCompact}_{nnnnnn}`）
 * [POS]: `DesignDetailLogicTreeModal`、设计任务线任务 0、任务 8.5 Input 2
 *
 * [PROTOCOL]: token 形态与工具详情「特征」视图一致；变更合并规则时同步 `toolDetailL05Format.ts`；**任务 0 落库**在 `useDesignDetailChat.finalizeTask0CompletionWithSync`（线步收官时）执行，非 bootstrap 阶段；`runTask85` / 完全重启后仍可在后续线步补 sync
 */
import { loadToolSuiteRegistry } from '../tool-detail/tool-suite-registry';
import { buildWorkspaceFeatureNodes } from '../tool-detail/toolDetailL05Format';
import {
  buildWorkspaceToolNodes,
  hydrateToolDetailKnowledgeFromServer,
} from '../tool-detail/tool-detail-knowledge-persist';

/** 工具集原语：本地构建时不含 `featureId`（落库后由 sync 响应或 task-graph 提供；知识集有则附带供旧后端兼容） */
export type ToolSuitePrimitiveGraphFeature = {
  toolId: string;
  toolName: string;
  featureKey: string;
  featureId?: string;
  /** 展示用 token：特征键/工具名 */
  tokenDisplay: string;
  operator: string;
  value: string;
};

/** sync 落库后服务端分配的 feature 行（含 `ft_*`） */
export type ToolSuitePrimitiveSyncedFeature = ToolSuitePrimitiveGraphFeature & {
  featureId: string;
};

function mergeValues(values: string[]): string {
  const uniq: string[] = [];
  for (const v of values) {
    const t = String(v ?? '').trim();
    if (!t || uniq.includes(t)) continue;
    uniq.push(t);
  }
  return uniq.join('；');
}

/**
 * 直接读取工具集「特征」视图：一级特征键 × 二级工具 → 平铺 feature 列表。
 * 须先 `hydrateToolDetailKnowledgeFromServer`（online 拉库 + localStorage 回写）。
 */
export function buildToolSuitePrimitiveGraphFeatures(): ToolSuitePrimitiveGraphFeature[] {
  const registry = loadToolSuiteRegistry();
  const toolNodes = buildWorkspaceToolNodes(registry);
  const featureNodes = buildWorkspaceFeatureNodes(toolNodes);
  const out: ToolSuitePrimitiveGraphFeature[] = [];
  for (const feat of featureNodes) {
    for (const tool of feat.tools) {
      const tokenDisplay = `${feat.featureKey}/${tool.toolName}`;
      const mergedValue = mergeValues(tool.values.map((v) => v.value));
      const value = mergedValue || feat.featureKey || tool.toolName;
      const featureId = tool.values
        .map((v) => String(v.featureId ?? '').trim())
        .find((id) => id.length > 0);
      out.push({
        toolId: tool.toolId,
        toolName: tool.toolName,
        featureKey: feat.featureKey,
        ...(featureId ? { featureId } : {}),
        tokenDisplay,
        operator: '工具原语',
        value,
      });
    }
  }
  return out;
}

/** 进入设计页 / 打开逻辑树前拉取工具知识集 */
export async function hydrateToolSuiteKnowledgeForDesign(): Promise<void> {
  await hydrateToolDetailKnowledgeFromServer();
}

export function hasToolSuitePrimitiveGraphFeatures(): boolean {
  return buildToolSuitePrimitiveGraphFeatures().length > 0;
}

export type SyncToolSuitePrimitivesResult = {
  primitiveCount: number;
  synced: boolean;
  /** 落库未通过校验时的原因（控制台 `[design-detail:task0-sync]`） */
  syncRejectReason?: string;
  featureCount?: number;
  /** 落库后服务端分配的 `ft_*` 行（供 LLM Input 2 与逻辑树） */
  features?: ToolSuitePrimitiveSyncedFeature[];
};

const TASK0_SYNC_LOG = '[design-detail:task0-sync]';
/** 任务 0 流式 reveal → 收官 → 调试门闩；与 `[design-detail:full-restart]` 联查 */
export const TASK0_PIPELINE_LOG = '[design-detail:task0-pipeline]';
const TASK0_FT_ID_RE = /^ft_\d{12}$/;

/** 控制台 filter：`[design-detail:task0-sync]` */
export function logDesignDetailTask0Sync(phase: string, payload: Record<string, unknown>): void {
  try {
    console.info(TASK0_SYNC_LOG, { phase, ...payload });
  } catch {
    /* ignore */
  }
}

/** 控制台 filter：`[design-detail:task0-pipeline]` */
export function logDesignDetailTask0Pipeline(phase: string, payload: Record<string, unknown>): void {
  try {
    console.info(TASK0_PIPELINE_LOG, { phase, ...payload });
  } catch {
    /* ignore */
  }
}

/** sync 后 GET task-graph 对账：确认落库可读回（filter 同上 `post_get_verify`） */
export async function verifyTask0GraphAfterSync(caseId: string): Promise<{
  getOk: boolean;
  task0TokenCount: number;
  task0FeatureCount: number;
  sampleFeatureIds: string[];
}> {
  const cid = String(caseId || '').trim();
  const empty = { getOk: false, task0TokenCount: 0, task0FeatureCount: 0, sampleFeatureIds: [] as string[] };
  if (!cid) return empty;
  const fn = (
    window as unknown as {
      SmartCto?: {
        problemCaseApi?: {
          getDesignDetailTaskGraph?: (
            id: string,
          ) => Promise<{ ok?: boolean; data?: { tasks?: Array<{ taskId?: string; tokens?: unknown[]; features?: Array<{ featureId?: string }> }> } }>;
        };
      };
    }
  ).SmartCto?.problemCaseApi?.getDesignDetailTaskGraph;
  if (typeof fn !== 'function') return empty;
  try {
    const res = await fn(cid);
    const tasks = Array.isArray(res?.data?.tasks) ? res!.data!.tasks! : [];
    const t0 =
      tasks.find((t) => {
        const id = String(t?.taskId ?? '').trim();
        return id === 'optional_toolbox_primitive' || id === '任务 0：可选工具箱非结构化原语解构';
      }) ?? null;
    const task0TokenCount = Array.isArray(t0?.tokens) ? t0!.tokens!.length : 0;
    const feats = Array.isArray(t0?.features) ? t0!.features! : [];
    const task0FeatureCount = feats.length;
    const sampleFeatureIds = feats.slice(0, 3).map((f) => String(f?.featureId ?? '').trim()).filter(Boolean);
    return { getOk: res?.ok === true, task0TokenCount, task0FeatureCount, sampleFeatureIds };
  } catch {
    return empty;
  }
}

function verifyTask0SyncApiResponse(
  res: {
    ok?: boolean;
    status?: number;
    message?: string;
    data?: { featureCount?: number; features?: ToolSuitePrimitiveSyncedFeature[]; tokenCount?: number };
  } | null
  | undefined,
): { synced: boolean; reason?: string; featureCount?: number; ftCount?: number } {
  if (!res || res.ok !== true) {
    return {
      synced: false,
      reason: res?.status ? `http_${res.status}` : 'http_not_ok',
    };
  }
  const data = res.data;
  const fc = typeof data?.featureCount === 'number' ? data.featureCount : 0;
  const features = Array.isArray(data?.features) ? data.features : [];
  const ftIds = features
    .map((f) => String(f.featureId ?? '').trim())
    .filter((id) => TASK0_FT_ID_RE.test(id));
  if (fc <= 0 && features.length === 0) {
    return { synced: false, reason: 'zero_feature_count', featureCount: fc, ftCount: 0 };
  }
  if (features.length > 0 && ftIds.length !== features.length) {
    return {
      synced: false,
      reason: 'features_missing_ft_id',
      featureCount: fc || features.length,
      ftCount: ftIds.length,
    };
  }
  return {
    synced: true,
    featureCount: fc > 0 ? fc : features.length,
    ftCount: ftIds.length > 0 ? ftIds.length : fc,
  };
}

/** 将工具原语写入本案例推理图（供逻辑树任务 0 层与任务 8/8.5 Evidence 引用） */
export async function syncToolSuitePrimitivesToDesignGraph(
  caseId: string,
  isOnline: boolean,
): Promise<SyncToolSuitePrimitivesResult> {
  const cid = String(caseId || '').trim();
  if (!cid) {
    logDesignDetailTask0Sync('sync_skip', { reason: 'empty_case_id' });
    return { primitiveCount: 0, synced: false, syncRejectReason: 'empty_case_id' };
  }
  await hydrateToolSuiteKnowledgeForDesign();
  const primitives = buildToolSuitePrimitiveGraphFeatures();
  const primitiveCount = primitives.length;
  logDesignDetailTask0Sync('sync_prepare', {
    caseId: cid,
    isOnline,
    primitiveCount,
    sampleKeys: primitives.slice(0, 3).map((p) => p.featureKey),
    sampleValuesLen: primitives.slice(0, 3).map((p) => String(p.value ?? '').length),
  });
  if (!primitiveCount) {
    return { primitiveCount: 0, synced: false, syncRejectReason: 'no_primitives' };
  }
  if (!isOnline) {
    logDesignDetailTask0Sync('sync_skip', { caseId: cid, reason: 'offline_mode' });
    return { primitiveCount, synced: false, syncRejectReason: 'offline_mode' };
  }
  const fn = (
    window as unknown as {
      SmartCto?: {
        problemCaseApi?: {
          postDesignDetailSyncTask0ToolboxPrimitives?: (
            id: string,
            body: { primitives: ToolSuitePrimitiveGraphFeature[] },
          ) => Promise<{
            ok?: boolean;
            status?: number;
            message?: string;
            data?: { featureCount?: number; features?: ToolSuitePrimitiveSyncedFeature[]; tokenCount?: number };
          }>;
        };
      };
    }
  ).SmartCto?.problemCaseApi?.postDesignDetailSyncTask0ToolboxPrimitives;
  if (typeof fn !== 'function') {
    logDesignDetailTask0Sync('sync_skip', { caseId: cid, reason: 'api_fn_missing' });
    return { primitiveCount, synced: false, syncRejectReason: 'api_fn_missing' };
  }
  try {
    const res = await fn(cid, { primitives });
    const verified = verifyTask0SyncApiResponse(res);
    const features = Array.isArray(res?.data?.features)
      ? (res!.data!.features as ToolSuitePrimitiveSyncedFeature[])
      : undefined;
    logDesignDetailTask0Sync('sync_response', {
      caseId: cid,
      httpOk: res?.ok === true,
      status: res?.status,
      message: res?.message,
      apiFeatureCount: res?.data?.featureCount,
      apiTokenCount: res?.data?.tokenCount,
      featuresLen: features?.length ?? 0,
      sampleFeatureIds: features?.slice(0, 3).map((f) => f.featureId),
      synced: verified.synced,
      syncRejectReason: verified.reason,
      ftCount: verified.ftCount,
    });
    return {
      primitiveCount,
      synced: verified.synced,
      ...(verified.reason ? { syncRejectReason: verified.reason } : {}),
      ...(typeof verified.featureCount === 'number' ? { featureCount: verified.featureCount } : {}),
      ...(features?.length ? { features } : {}),
    };
  } catch (e) {
    logDesignDetailTask0Sync('sync_error', {
      caseId: cid,
      message: e instanceof Error ? e.message : String(e),
    });
    return { primitiveCount, synced: false, syncRejectReason: 'fetch_threw' };
  }
}
