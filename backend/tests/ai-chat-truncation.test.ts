import { describe, expect, it } from 'vitest';
import {
  CHAT_MAX_OUTPUT_DEFAULT,
  CHAT_MAX_OUTPUT_HARD_CAP,
  inferTruncationFromProvider,
  readDefaultMaxOutputTokensFromEnv,
  resolveEffectiveMaxOutputTokens,
} from '../src/modules/ai/ai-chat-truncation';

describe('ai-chat-truncation', () => {
  it('readDefaultMaxOutputTokensFromEnv falls back when unset', () => {
    const prev = process.env.AI_CHAT_MAX_OUTPUT_TOKENS;
    delete process.env.AI_CHAT_MAX_OUTPUT_TOKENS;
    expect(readDefaultMaxOutputTokensFromEnv()).toBe(CHAT_MAX_OUTPUT_DEFAULT);
    process.env.AI_CHAT_MAX_OUTPUT_TOKENS = prev;
  });

  it('resolveEffectiveMaxOutputTokens clamps task12（及历史 task11）与显式 cap', () => {
    expect(
      resolveEffectiveMaxOutputTokens({
        envDefault: 4096,
        taskTag: 'task12',
      }),
    ).toBe(CHAT_MAX_OUTPUT_DEFAULT);
    expect(
      resolveEffectiveMaxOutputTokens({
        envDefault: 4096,
        taskTag: 'task11',
      }),
    ).toBe(CHAT_MAX_OUTPUT_DEFAULT);

    expect(
      resolveEffectiveMaxOutputTokens({
        envDefault: 8192,
        maxOutputTokens: 4000,
      }),
    ).toBe(4000);

    expect(
      resolveEffectiveMaxOutputTokens({
        envDefault: 8192,
        maxOutputTokens: 99999,
      }),
    ).toBe(CHAT_MAX_OUTPUT_HARD_CAP);
  });

  it('inferTruncationFromProvider: length finish_reason always truncated', () => {
    expect(inferTruncationFromProvider('length', 100, 8192)).toEqual({
      finishReason: 'length',
      truncated: true,
    });
  });

  it('inferTruncationFromProvider: near cap without finish_reason', () => {
    expect(inferTruncationFromProvider(undefined, 8192, 8192).truncated).toBe(true);
    expect(inferTruncationFromProvider('stop', 8192, 8192).truncated).toBe(true);
    expect(inferTruncationFromProvider('stop', 8100, 8192).truncated).toBe(false);
  });
});
