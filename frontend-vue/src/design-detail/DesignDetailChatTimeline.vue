<!--
  [INPUT]: `DesignDetailChatTimelineItem[]`
  [OUTPUT]: 左栏「聊天」Tab：用户消息右对齐、系统通知左对齐；时间戳 + 一键复制
  [POS]: `DesignDetailPage.vue`
-->
<script setup lang="ts">
import { ref } from 'vue';
import type { DesignDetailChatTimelineItem } from './designDetailChatTimeline';

defineProps<{
  items: DesignDetailChatTimelineItem[];
}>();

const copyHintById = ref<Record<string, string>>({});

async function copyBody(item: DesignDetailChatTimelineItem) {
  const text = String(item.body || '').trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyHintById.value = { ...copyHintById.value, [item.id]: '已复制' };
    window.setTimeout(() => {
      const next = { ...copyHintById.value };
      delete next[item.id];
      copyHintById.value = next;
    }, 1600);
  } catch {
    copyHintById.value = { ...copyHintById.value, [item.id]: '复制失败' };
  }
}
</script>

<template>
  <div class="dd-chat-timeline" aria-label="聊天记录">
    <p v-if="!items.length" class="dd-chat-timeline-empty">暂无聊天记录。发送消息后或任务推进后，相关通知将显示于此。</p>
    <article
      v-for="item in items"
      :key="item.id"
      class="dd-chat-timeline-row"
      :class="item.role === 'user' ? 'dd-chat-timeline-row--user' : 'dd-chat-timeline-row--system'"
    >
      <div class="dd-chat-timeline-bubble">
        <div class="dd-chat-timeline-meta">
          <time class="dd-chat-timeline-time" :datetime="String(item.sortMs)">{{ item.timestampLabel }}</time>
          <button
            type="button"
            class="dd-chat-timeline-copy"
            :title="`复制${item.role === 'user' ? '用户' : '系统'}消息`"
            @click="copyBody(item)"
          >
            {{ copyHintById[item.id] || '复制' }}
          </button>
        </div>
        <pre class="dd-chat-timeline-body">{{ item.body }}</pre>
      </div>
    </article>
  </div>
</template>

<style scoped>
.dd-chat-timeline {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.5rem 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.dd-chat-timeline-empty {
  margin: 0.5rem 0;
  font-size: 0.84rem;
  color: var(--dd-muted, #64748b);
  line-height: 1.5;
}

.dd-chat-timeline-row {
  display: flex;
  width: 100%;
}

.dd-chat-timeline-row--system {
  justify-content: flex-start;
}

.dd-chat-timeline-row--user {
  justify-content: flex-end;
}

.dd-chat-timeline-bubble {
  max-width: min(92%, 28rem);
  border-radius: 10px;
  padding: 0.45rem 0.55rem 0.5rem;
  border: 1px solid var(--dd-border, #e2e8f0);
  background: #f8fafc;
}

.dd-chat-timeline-row--user .dd-chat-timeline-bubble {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.dd-chat-timeline-row--system .dd-chat-timeline-bubble {
  border-left: 3px solid var(--dd-accent, #7c3aed);
}

.dd-chat-timeline-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.dd-chat-timeline-row--user .dd-chat-timeline-meta {
  flex-direction: row-reverse;
}

.dd-chat-timeline-time {
  font-size: 0.72rem;
  color: var(--dd-muted, #64748b);
  white-space: nowrap;
}

.dd-chat-timeline-copy {
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--dd-accent, #7c3aed);
  background: transparent;
  border: none;
  padding: 0.1rem 0.25rem;
  cursor: pointer;
  border-radius: 4px;
}

.dd-chat-timeline-copy:hover {
  background: rgba(124, 58, 237, 0.08);
}

.dd-chat-timeline-body {
  margin: 0;
  font-family: inherit;
  font-size: 0.84rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dd-text, #0f172a);
}
</style>
