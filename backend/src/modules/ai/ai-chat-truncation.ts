/**
 * [INPUT]: OpenAI 兼容 chat/completions 的 choices[0].finish_reason、usage.completion_tokens、本次请求使用的 max_tokens
 * [OUTPUT]: 归一化的 finishReason 与 truncated 判定（含 provider 未返回 finish_reason 时的保守启发）
 * [POS]: 供 /api/ai/chat 聚合响应字段，便于前端识别输出是否触顶
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新此 Header 和所属目录的 AGENTS.md（若存在）
 */

/** DeepSeek/OpenAI 兼容接口常见输出上限（与路由层硬封顶一致） */
export const CHAT_MAX_OUTPUT_HARD_CAP = 8192;

/** 未配置环境变量时的默认输出 token 上限（止血：显著高于历史写死 2000） */
export const CHAT_MAX_OUTPUT_DEFAULT = 8192;

/**
 * 从环境变量读取默认输出上限；非法或过低时回落到 CHAT_MAX_OUTPUT_DEFAULT。
 */
export function readDefaultMaxOutputTokensFromEnv(): number {
  const raw = process.env.AI_CHAT_MAX_OUTPUT_TOKENS;
  if (raw === undefined || raw === '') {
    return CHAT_MAX_OUTPUT_DEFAULT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 256) {
    return CHAT_MAX_OUTPUT_DEFAULT;
  }
  return Math.min(CHAT_MAX_OUTPUT_HARD_CAP, n);
}

/**
 * 计算本次请求实际使用的 max_tokens：环境默认、task11/task12（大 JSON 推演）保底、请求体显式覆盖（升序取可控放宽）。
 */
export function resolveEffectiveMaxOutputTokens(input: {
  envDefault: number;
  taskTag?: string;
  maxOutputTokens?: number;
}): number {
  let base = input.envDefault;
  if (input.taskTag === 'task11' || input.taskTag === 'task12') {
    base = Math.max(base, CHAT_MAX_OUTPUT_DEFAULT);
  }
  if (input.maxOutputTokens !== undefined) {
    return Math.min(CHAT_MAX_OUTPUT_HARD_CAP, Math.max(256, Math.floor(input.maxOutputTokens)));
  }
  return Math.min(CHAT_MAX_OUTPUT_HARD_CAP, Math.max(256, Math.floor(base)));
}

/**
 * 判定是否因长度触顶或疑似触顶：finish_reason=length，或 completion 达到/接近本次 max_tokens。
 */
export function inferTruncationFromProvider(
  finishReason: string | undefined | null,
  completionTokens: number | undefined,
  effectiveMaxTokens: number,
): { finishReason: string | null; truncated: boolean } {
  const fr = finishReason ?? null;
  const ct =
    typeof completionTokens === 'number' && Number.isFinite(completionTokens)
      ? completionTokens
      : null;

  if (fr === 'length') {
    return { finishReason: fr, truncated: true };
  }

  if (ct === null || effectiveMaxTokens <= 0) {
    return { finishReason: fr, truncated: false };
  }

  // 接近或等于上限：取 max(1, 1% 的 floor) 作为容差带，避免浮点/分词边界误判
  const slack = Math.max(1, Math.floor(effectiveMaxTokens * 0.01));
  const atOrNearCap = ct >= effectiveMaxTokens - slack;
  const truncated = atOrNearCap;

  return { finishReason: fr, truncated };
}
