/**
 * 沟通历史：从问题详情聊天记录中提取、按任务分段及沟通历史页面渲染逻辑
 * 依赖：js/config.js（FOLLOW_TASKS、ITGAP_HISTORY_TASKS、IT_STRATEGY_TASKS、TASK_EXTRA_FIELDS）、
 *       global.parseRolePermissionModel、global.getTaskTrackingData、global.escapeHtml、global.formatChatTime（由 main/storage/utils 挂载）
 *
 * 注：面板顶部汇总区 SVG 尺寸须与 styles.css 中 `.problem-detail-history-summary-icon svg` 一致（当前 14×14）；标签类字号由 `.problem-detail-history-panel` 的 CSS 变量统一控制，见数字化问题跟进阶段设计 §0.6、对话模型管理 §4.5。任务标题「进行中/待执行/已完成」由 deps.getTaskStatusText（main.js）：canonical 当前任务默认待执行，须已确认 `taskStartNotification` 才为进行中；已完成仅看状态机；「修改中」含 `problemDetailWaitingForFeedback`（FE-20260328-25）。
 * 时间线标题栏「标签右侧备注」（.problem-detail-history-timeline-step-name）：颜色与圆点同色；超过 15 字截断为「前 15 字...」，全文放 title 悬停展示。
 * FE-20260324-09：`coreBusinessObjectModificationRegenerateNotifyBlock` 归入 task11 推断但不纳入过程日志时间线（仅聊天区二次确认）。
 * FE-20260324-18/19：任务 Skill 不回填 `modificationPromptRevisionLlmQueryBlock` 的通用 LlmQuery system（避免「提示词工程助手」元提示）；改为单独解析该块的 `llmOutputRaw`（+`skillTimelinePrompt`）得到 **Diff + 新提示词**；时间线节点展开为双子卡（Skill Diff / 更新版 Skill）。普通任务 LLM 查询回填仅有新提示词、Diff 区占位说明。
 * FE-20260324-24：任务 Skill 时间线顶部固定展示「当前最新版本 Skill」黄主题卡片，正文与按时间排序后**最后一档**节点「更新版 Skill」全文一致，随新节点追加自动更新。
 * FE-20260324-27：过程日志时间线节点与任务 Skill 节点（含顶部「当前最新版本 Skill」卡）右上角「复制」按钮，复制卡片内正文（`.problem-detail-history-node-card-inner` 的 textContent，含折叠区 hidden 内文本）。
 * FE-20260324-28：LLM-查询输入/输出子卡、任务 Skill Diff/更新版子卡同样套 `problem-detail-history-node-card-shell` + 复制（`buildHistoryLlmQuerySubcardsHtml`）。
 * FE-20260324-29：task11 全环节骨架生成后的 `task11GlobalSkeletonAuditLlmQueryBlock` 过程日志标签为 **LLM-审计**（双子卡同 LLM-查询），标题栏右侧备注 `noteName`（默认「全局对象骨架审计」）；`coreBusinessObjectGlobalAuditIntentBlock` 确认后纳入时间线。
 * FE-20260324-30：审计完成后推送 `coreBusinessObjectGlobalAuditModificationGuideBlock` + `modificationIntentConfirmBlock`（`fromGlobalSkeletonAudit`）；任务 Skill 回填跳过 `task11GlobalSkeletonAuditLlmQueryBlock`。
 * FE-20260326：沟通历史任务子 Tab 在「任务Skill」右侧增加「审计Skill」，布局与交互同任务 Skill；时间线数据来自 `auditSkillTimeline` 等跟踪字段，及过程日志中 `task11GlobalSkeletonAuditLlmQueryBlock`（及 `noteName` 含「审计」的 `modificationPromptRevisionLlmQueryBlock`）解析出的审计 system 提示词。
 * FE-20260326-09：审计 Skill 时间线补充读取 `rolePermissionAuditLlmQueryBlock` 的 system 片段，确保 task10 也可展示「当前最新版本审计 Skill」卡（显示当前审计提示词）。
 * FE-20260326-02：task10 意图确认后推送 `rolePermissionAuditLlmQueryBlock`，过程日志标签 **LLM-审计**（双子卡同 task11 全局骨架审计）；任务 Skill 回填跳过该类型。
 * FE-20260326-04：先推送 `rolePermissionAuditIntentBlock`（用户确认后再调 LLM）；刷新进入状态 B 且无审计块时补发意图块。
 * FE-20260326-05：审计成功后聊天区 `rolePermissionAuditResultBlock`（审计意见全文 +「提炼修改意见」→ `extractModificationIntentWithLLM` / `modificationIntentConfirmBlock`）。
 * FE-20260326-06：task10 按新提示词重生成成功后 `rolePermissionModificationActionBlock` 仅聊天区展示（不纳入过程日志时间线）。
 * FE-20260326-07：`rolePermissionAuditIntentBlock` 增加「无需继续审计」→ 直接 `showTaskCompletionConfirm(task10)`；`auditSkippedByUser`；`pushRolePermissionAuditIntentBlockIfNeeded` 若已有意图块则不再追加。
 * FE-20260326-08：task10 按新提示词重生成逐环节写 `rolePermissionModificationLlmQueryBlock`，过程日志标签 **LLM-修改**（输入/输出 + 修改内容子卡片）。
 * FE-20260328-20：`getTaskStatusText` 为「修改中」时任务根节点 class `problem-detail-history-task-modifying`。**FE-20260405-02**：task4 价值流修改链在清空 `problemDetailWaitingForFeedback` 后仍由 `main.js` `isTask4InValueStreamModificationPipeline`（聊天未完成块 + `getTask4ValueStreamModificationBundle`）标「修改中」；沟通历史任务名与「进行中」同为蓝色（`styles.css`）。
 * FE-20260328-34：task10「审计中」时根节点 class `problem-detail-history-task-auditing`。
 * FE-20260329-08：task10 `rolePermissionStepProgressBlock` 归入 `inferTaskIdFromMessage`；`shouldIncludeInCommunicationHistory` 为 false（仅主聊天区进行中态）。
 * FE-20260329-09：task10 按环节推演写 `task10LlmQueryBlock`（同 task9/task11：仅沟通历史 LLM-查询双子卡，主聊天区不渲染）。
 * FE-20260330-10：task1 `modificationRegenerateLlmQueryBlock`（taskId===task1）过程日志标签 **LLM-修改**；`preliminaryRequirementFollowupBlock` / `preliminaryRequirementModificationSummaryBlock` 推断 task1 且不纳入时间线。
 * FE-20260409：顶栏「+需求」`plusRequirementResetConfirmBlock` 推断 task1，`shouldIncludeInCommunicationHistory` 为 false（仅主聊天区确认取消/确定）。
 * FE-20260404：task4 价值流修改 Session 路径下 `modificationRegenerateLlmQueryBlock`（taskId===task4）过程日志 **LLM-修改**（输入/输出/修改动作）；`valueStreamModificationRegenerateNotifyBlock` 不纳入时间线。
 * FE-20260401：task7 面向用户文案统一为「端到端事务流构建 / 端到端事务流」；`inferTaskIdFromMessage` 仍兼容旧聊天中的「端到端流程」压缩进展句式。
 * FE-20260401-42：task7 `e2eTransactionFlowLlmPromptBlock` 归入 task7；`shouldIncludeInCommunicationHistory` 为 false（仅主聊天区展示完整提示词，与 task4 调用前提示词块一致）。
 * FE-20260401-50：task7 `e2eTransactionFlowSessionsBlock` 纳入过程日志；`task7LlmQueryBlock` 为 LLM-查询双子卡（与 task9 同形）。**FE-20260409**：task7 `e2ePrelimFvsCompletenessSessionsBlock`（初步需求业务流程完整性补齐 Session 计划）同上纳入 task7 过程日志。
 * FE-20260402：`e2eFlowJsonBlock` 不纳入过程日志（仅主聊天区 JSON 确认卡），避免与 LLM-查询重复展示大块 BPM JSON。
 * FE-20260403：`task1LlmQueryBlock` 过程日志渲染时的 `[FE:task1-prelim-llm] history-render-input` 仅当 `globalThis.__FE_TASK1_PRELIM_DEBUG === true` 输出（默认关闭，避免时间线重复渲染刷屏）。
 * FE-20260410：`shouldIncludeInCommunicationHistory` 对备注含「初步需求提取」的 `task1LlmQueryBlock` 返回 false（首页解析时间线卡停用）；保留「客户初步需求提炼（深度）」等其它 task1 LLM-查询块。
 * FE-20260410：task1 `task1PrelimMergePromptJsonBlock`（核心对象/状态逻辑合并前完整提示词 system+user）`inferTaskIdFromMessage` 归 task1；`shouldIncludeInCommunicationHistory` 为 false（仅主聊天区）。
 * FE-20260409-llm-dedup：与过程日志标签一致（LLM-查询 / LLM-修改 / LLM-审计）且 `noteName`、输入 prompt、输出全文相同的 LLM 块在 `problem-detail-chat.js` `pushAndSave` 及 `main.js` task1 初步回填路径不再重复写入；历史里已存在的重复条需人工删或另做迁移。
 * FE-20260403-22：独立 task11（核心业务对象推演）下线后，`inferTaskIdFromMessage` / `getCommunicationsByTask` 将 RP/CBO 相关 type 与 `normalizeTaskIdForHistory`（含 task10、task11、strategy-0/1）统一归档到 **task12** 桶。
 * **FE-20260408**：task8 `task8LlmQueryBlock`：`noteName === 'BPM流程绘制'` 时备注 **`绘制：` + `stepName`**；`noteName === 'IT设计补齐'` 且存在 `stepName` 时备注 **`设计：` + `stepName`**（主路径为事务名；历史四阶段全局分析为阶段名）。与 `itDesignSupplement.js` / `task8-global-itgap.js` 推送字段一致。**FE-20260409-b**：task7 `task7LlmQueryBlock` 且 `noteName === '业务流程完整性补齐'` 时过程日志标题侧备注 **`补齐：` + `stepName`**（类目/流程类型）；补齐全部结束后经 `e2ePrelimFvsCompletenessAllDoneConfirmBlock` 确认再弹 task7 完工确认。
 */
(function (global) {
  const FOLLOW_TASKS = global.FOLLOW_TASKS || [];
  const ITGAP_HISTORY_TASKS = global.ITGAP_HISTORY_TASKS || [];
  const IT_STRATEGY_TASKS = global.IT_STRATEGY_TASKS || [];
  const TASK_EXTRA_FIELDS = global.TASK_EXTRA_FIELDS || {};
  const escapeHtml = typeof global.escapeHtml === 'function' ? global.escapeHtml : (s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const formatChatTime = typeof global.formatChatTime === 'function' ? global.formatChatTime : (t) => (t ? String(t) : '—');
  const renderMarkdown = typeof global.renderMarkdown === 'function' ? global.renderMarkdown : (s) => escapeHtml(s == null ? '' : String(s));

  /** 过程日志 / 任务 Skill 节点卡片右上角复制（与 shell 内 inner 配对） */
  const HISTORY_NODE_COPY_BUTTON_HTML =
    '<button type="button" class="problem-detail-history-node-copy-btn" aria-label="复制本条卡片内容" title="复制">\u590d\u5236</button>';

  function copyHistoryNodeCardPlainText(innerEl) {
    if (!innerEl) return Promise.resolve(false);
    const text = (innerEl.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text).then(
        () => true,
        () => copyHistoryNodeCardPlainTextFallback(text),
      );
    }
    return Promise.resolve(copyHistoryNodeCardPlainTextFallback(text));
  }

  function copyHistoryNodeCardPlainTextFallback(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  /** 过程日志展开区：LLM-查询 / LLM-压缩 双子卡（每张子卡独立复制） */
  function buildHistoryLlmQuerySubcardsHtml(inputStr, outputStr, mainPromptTokens, mainCompletionTokens) {
    const inTok = escapeHtml(Number(mainPromptTokens || 0).toLocaleString());
    const outTok = escapeHtml(Number(mainCompletionTokens || 0).toLocaleString());
    return `
                <div class="problem-detail-history-llm-query-subcards">
                  <div class="problem-detail-history-llm-query-subcard problem-detail-history-llm-query-subcard-input problem-detail-history-node-card-shell">
                    ${HISTORY_NODE_COPY_BUTTON_HTML}
                    <div class="problem-detail-history-node-card-inner">
                      <div class="problem-detail-history-llm-query-subcard-title">\u8f93\u5165\uff08\u8f93\u5165 token\uff1a${inTok}\uff09</div>
                      <pre class="problem-detail-history-llm-query-subcard-pre">${escapeHtml(String(inputStr ?? ''))}</pre>
                    </div>
                  </div>
                  <div class="problem-detail-history-llm-query-subcard problem-detail-history-llm-query-subcard-output problem-detail-history-node-card-shell">
                    ${HISTORY_NODE_COPY_BUTTON_HTML}
                    <div class="problem-detail-history-node-card-inner">
                      <div class="problem-detail-history-llm-query-subcard-title">\u8f93\u51fa\uff08\u8f93\u51fa token\uff1a${outTok}\uff09</div>
                      <pre class="problem-detail-history-llm-query-subcard-pre">${escapeHtml(String(outputStr ?? ''))}</pre>
                    </div>
                  </div>
                </div>`;
  }

  function stringifyForTokenEstimate(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }

  /** token 估算：优先使用后端 usage；缺失时按中英文字符粗估，避免显示 0 */
  function estimateTokenCountFromText(value) {
    const s = stringifyForTokenEstimate(value).trim();
    if (!s) return 0;
    const cjkCount = (s.match(/[\u3400-\u9fff]/g) || []).length;
    const otherCount = Math.max(s.length - cjkCount, 0);
    return Math.max(1, Math.ceil(cjkCount + otherCount / 4));
  }

  function resolveTokenPair(usage, inputValue, outputValue) {
    const usagePrompt = Number(usage?.prompt_tokens) || 0;
    const usageCompletion = Number(usage?.completion_tokens) || 0;
    return {
      promptTokens: usagePrompt > 0 ? usagePrompt : estimateTokenCountFromText(inputValue),
      completionTokens: usageCompletion > 0 ? usageCompletion : estimateTokenCountFromText(outputValue),
    };
  }

  function shouldLogTask1InputRender() {
    try {
      return global.__FE_TASK1_PRELIM_DEBUG === true;
    } catch (_) {
      return false;
    }
  }

  /** 过程日志标题栏备注：超过 maxLen 个字符则截断并加 …，与 buildTimelineStepNameSpan 配合 */
  const TIMELINE_HEAD_NOTE_MAX_LEN = 15;
  function truncateTimelineHeadNote(text, maxLen = TIMELINE_HEAD_NOTE_MAX_LEN) {
    if (text == null || text === '') return '';
    const s = String(text);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + '...';
  }

  /** 生成标签右侧备注 span；超长时 title 展示全文 */
  function buildTimelineStepNameSpan(fullText) {
    const full = fullText == null ? '' : String(fullText);
    if (!full) return '';
    const short = truncateTimelineHeadNote(full);
    const titleAttr = full.length > TIMELINE_HEAD_NOTE_MAX_LEN ? ` title="${escapeHtml(full)}"` : '';
    return `<span class="problem-detail-history-timeline-step-name"${titleAttr}>${escapeHtml(short)}</span>`;
  }

  function buildTaskSummaryMap(problemTaskSummaries, createdAt) {
    if (!problemTaskSummaries || !createdAt) return {};
    const list = problemTaskSummaries[createdAt];
    if (!Array.isArray(list) || list.length === 0) return {};
    return list.reduce((acc, item) => {
      const key = normalizeTaskIdForHistory(item?.taskId);
      if (!key) return acc;
      acc[key] = item;
      return acc;
    }, {});
  }

  function parseSystemPromptFromCombinedPrompt(fullPrompt) {
    if (typeof fullPrompt !== 'string') return '';
    const s = fullPrompt.trim();
    if (!s) return '';
    const systemMark = '【系统】';
    const userMark = '【用户】';
    const systemPos = s.indexOf(systemMark);
    const userPos = s.indexOf(userMark);
    if (systemPos < 0) {
      // 兼容 task6 等 fullPrompt 形态：`${systemPrompt}\n\n---\n\n${userContent}`
      const splitMark = '\n\n---\n\n';
      const splitPos = s.indexOf(splitMark);
      if (splitPos > 0) return s.slice(0, splitPos).trim();
      return s;
    }
    const start = systemPos + systemMark.length;
    const end = userPos > start ? userPos : s.length;
    return s.slice(start, end).trim();
  }

  /** 与 main.js `parsePromptRevisionOutput` 对齐：从修改链首轮模型输出中取「新提示词」「新版本对老版本的修改」 */
  function parseSkillRevisionFromModelOutput(rawContent) {
    const raw = String(rawContent || '').trim();
    if (!raw) return { newSystemPrompt: '', versionChangelog: '' };
    let obj = null;
    const jsonFence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const tryParse = (t) => {
      try {
        return JSON.parse(t);
      } catch (_) {
        return null;
      }
    };
    obj = tryParse(jsonFence ? jsonFence[1].trim() : raw);
    if (!obj || typeof obj !== 'object') {
      const brace = raw.match(/\{[\s\S]*\}/);
      if (brace) obj = tryParse(brace[0]);
    }
    if (obj && typeof obj === 'object') {
      const newPrompt =
        obj['新提示词'] ??
        obj.newSystemPrompt ??
        obj.new_prompt ??
        '';
      const changelog =
        obj['新版本对老版本的修改'] ??
        obj.changesFromPreviousVersion ??
        obj.version_changes ??
        '';
      const np = String(newPrompt || '').trim();
      if (np) {
        return {
          newSystemPrompt: np,
          versionChangelog: String(changelog || '').trim() || '—',
        };
      }
    }
    return {
      newSystemPrompt: raw,
      versionChangelog: '（模型未按约定 JSON 返回；全文暂作新提示词草案，无结构化「对老版本的修改」字段）',
    };
  }

  function normalizeSkillNode(raw, fallbackTimestamp) {
    if (!raw || typeof raw !== 'object') return null;
    const timestamp = raw.timestamp || raw.time || raw.createdAt || raw.updatedAt || fallbackTimestamp || '';
    const prompt = (
      raw.systemPrompt ??
      raw.prompt ??
      raw.content ??
      raw.value ??
      raw.system_prompt ??
      raw.systemPromptText ??
      raw.promptText ??
      ''
    );
    const promptText = typeof prompt === 'string' ? prompt.trim() : '';
    const skillDiffRaw = raw.skillDiff ?? raw.versionChangelog ?? raw.changelog ?? raw.skillDiffText ?? '';
    const skillDiff = typeof skillDiffRaw === 'string' ? skillDiffRaw.trim() : '';
    if (!timestamp && !promptText) return null;
    return {
      timestamp: timestamp ? String(timestamp) : '',
      content: promptText,
      skillDiff,
    };
  }

  /**
   * 任务 Skill Diff 兜底：当模型未返回结构化「新版本对老版本的修改」时，
   * 基于相邻两个版本的提示词做轻量文本比对，避免误判为“无更新”。
   */
  function buildAutoSkillDiffFromPromptPair(prevPrompt, currPrompt) {
    const prev = String(prevPrompt || '').trim();
    const curr = String(currPrompt || '').trim();
    if (!curr) return '';
    if (!prev) return '首个版本（无上一版本可比对）。';
    if (prev === curr) return '与上一版本提示词一致（无文本差异）。';

    const prevLines = prev.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const currLines = curr.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const prevSet = new Set(prevLines);
    const currSet = new Set(currLines);
    const added = currLines.filter((line) => !prevSet.has(line));
    const removed = prevLines.filter((line) => !currSet.has(line));

    const summary = [];
    summary.push(`自动比对：新增 ${added.length} 行，移除 ${removed.length} 行。`);
    if (added.length > 0) {
      const topAdded = added.slice(0, 3).map((line) => `- ${line}`);
      summary.push('新增片段示例：');
      summary.push(...topAdded);
      if (added.length > 3) summary.push(`- ...（其余 ${added.length - 3} 行）`);
    }
    if (removed.length > 0) {
      const topRemoved = removed.slice(0, 2).map((line) => `- ${line}`);
      summary.push('移除片段示例：');
      summary.push(...topRemoved);
      if (removed.length > 2) summary.push(`- ...（其余 ${removed.length - 2} 行）`);
    }
    return summary.join('\n');
  }

  /** 对任务 Skill / 审计 Skill 时间线节点去重、排序并补自动 Diff */
  function finalizeSkillTimelineNodes(nodes, createdAt) {
    if (!Array.isArray(nodes)) return [];
    const deduped = [];
    for (const n of nodes) {
      const normalized = normalizeSkillNode(n, createdAt);
      if (!normalized) continue;
      const content = normalized.content || '';
      if (!content) continue;
      const idx = deduped.findIndex((x) => x.content === content);
      if (idx >= 0) {
        const prev = deduped[idx];
        const prevDiff = prev?.skillDiff != null ? String(prev.skillDiff).trim() : '';
        const nextDiff = normalized?.skillDiff != null ? String(normalized.skillDiff).trim() : '';
        if (!prevDiff && nextDiff) {
          deduped[idx] = {
            ...prev,
            ...normalized,
            content: prev.content,
            skillDiff: nextDiff,
          };
        }
        continue;
      }
      deduped.push({
        ...normalized,
        skillDiff: normalized.skillDiff != null ? normalized.skillDiff : '',
      });
    }
    deduped.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });
    for (let i = 0; i < deduped.length; i++) {
      const node = deduped[i];
      const diffText = node && node.skillDiff != null ? String(node.skillDiff).trim() : '';
      if (diffText) continue;
      const prevPrompt = i > 0 ? deduped[i - 1]?.content : '';
      const autoDiff = buildAutoSkillDiffFromPromptPair(prevPrompt, node?.content);
      if (autoDiff) deduped[i].skillDiff = autoDiff;
    }
    return deduped;
  }

  /** 任务 Skill / 审计 Skill 节点展开区：双子卡（Diff + 新提示词） */
  function buildSkillTimelineNodeDetailHtml(node, kind = 'skill') {
    const isAudit = kind === 'audit';
    const hasDiff = node.skillDiff != null && String(node.skillDiff).trim() !== '';
    const diffSource = hasDiff
      ? String(node.skillDiff).trim()
      : isAudit
        ? '（本节点无结构化「对上一版审计提示词的修改」：通常来自 LLM-审计 调用的 **system** 片段，或修改链未返回修订说明。）'
        : '（本节点无「新版本对老版本的修改」字段：通常来自过程日志中任务 LLM 查询的 **system** 片段，用于记录该次调用的技能上下文，而非修改链产生的修订说明。）';
    const promptText = (node.content && String(node.content).trim()) || '(无)';
    const diffTitle = isAudit ? '审计 Diff · 相较上个版本的更新' : 'Skill Diff · 相较上个版本的更新';
    const promptTitle = isAudit ? '更新版审计 Skill' : '更新版 Skill';
    const diffInner = `<div class="problem-detail-history-skill-subcard-body markdown-body">${renderMarkdown(diffSource)}</div>`;
    const promptInner = `<pre class="problem-detail-history-skill-subcard-body problem-detail-history-skill-prompt-pre">${escapeHtml(promptText)}</pre>`;
    return `
            <div class="problem-detail-history-skill-subcards">
              <div class="problem-detail-history-skill-subcard problem-detail-history-node-card-shell" data-subcard="diff">
                ${HISTORY_NODE_COPY_BUTTON_HTML}
                <div class="problem-detail-history-node-card-inner">
                  <div class="problem-detail-history-skill-subcard-title">${escapeHtml(diffTitle)}</div>
                  ${diffInner}
                </div>
              </div>
              <div class="problem-detail-history-skill-subcard problem-detail-history-node-card-shell" data-subcard="prompt">
                ${HISTORY_NODE_COPY_BUTTON_HTML}
                <div class="problem-detail-history-node-card-inner">
                  <div class="problem-detail-history-skill-subcard-title">${escapeHtml(promptTitle)}</div>
                  ${promptInner}
                </div>
              </div>
            </div>`;
  }

  /** 时间线顶部：当前最新版 Skill / 审计 Skill 快照 */
  function buildSkillLatestSnapshotHtml(node, kind = 'skill') {
    const isAudit = kind === 'audit';
    const promptText = (node.content && String(node.content).trim()) || '(无)';
    const aria = isAudit ? '当前最新版本审计 Skill' : '当前最新版本 Skill';
    const title = isAudit ? '当前最新版本审计 Skill' : '当前最新版本 Skill';
    return `
          <div class="problem-detail-history-skill-latest-card problem-detail-history-node-card-shell" role="region" aria-label="${escapeHtml(aria)}">
            ${HISTORY_NODE_COPY_BUTTON_HTML}
            <div class="problem-detail-history-node-card-inner">
              <div class="problem-detail-history-skill-latest-card-title">${escapeHtml(title)}</div>
              <pre class="problem-detail-history-skill-latest-card-body problem-detail-history-skill-prompt-pre">${escapeHtml(promptText)}</pre>
            </div>
          </div>`;
  }

  function buildSkillTimelineByTask(taskId, taskData, comms, createdAt, allChats) {
    const rawNodes = (
      taskData?.skillTimeline ??
      taskData?.skillNodes ??
      taskData?.promptTimeline ??
      taskData?.systemPromptTimeline ??
      taskData?.promptHistory ??
      taskData?.systemPromptHistory ??
      []
    );
    const explicitNodes = Array.isArray(rawNodes)
      ? rawNodes.map((node) => normalizeSkillNode(node)).filter(Boolean)
      : [];

    const fallbackFromLogs = [];
    if (explicitNodes.length === 0 && Array.isArray(comms)) {
      for (const c of comms) {
        try {
          const parsed = typeof c.content === 'string' ? JSON.parse(c.content) : c.content;
          const type = parsed?.type || '';
          if (!String(type).includes('LlmQueryBlock')) continue;
          if (type === 'modificationPromptRevisionLlmQueryBlock') continue;
          if (type === 'task11GlobalSkeletonAuditLlmQueryBlock') continue;
          if (type === 'rolePermissionAuditLlmQueryBlock') continue;
          const combined = parsed?.llmInputPrompt ?? parsed?.llmMeta?.inputPromptSnapshot ?? '';
          const systemPrompt = parseSystemPromptFromCombinedPrompt(combined);
          if (!systemPrompt) continue;
          fallbackFromLogs.push({
            timestamp: c.time || '',
            content: systemPrompt,
            skillDiff: '',
          });
        } catch (_) {}
      }
    }

    let baseNodes = explicitNodes.length > 0 ? explicitNodes : fallbackFromLogs;
    if (!Array.isArray(baseNodes)) baseNodes = [];

    /** 修改链「新提示词生成」过程日志：解析 llmOutputRaw 得到 Diff + 新提示词（单独处理，勿走通用 LlmQueryBlock 回填） */
    const fromModificationLlmQuery = [];
    if (Array.isArray(comms)) {
      for (const c of comms) {
        try {
          const p = typeof c.content === 'string' ? JSON.parse(c.content) : c.content;
          if (p?.type !== 'modificationPromptRevisionLlmQueryBlock') continue;
          const pTaskNorm = normalizeTaskIdForHistory(p.taskId);
          const wantTaskNorm = normalizeTaskIdForHistory(taskId);
          if (pTaskNorm == null || wantTaskNorm == null || pTaskNorm !== wantTaskNorm) continue;
          const parsedOut = parseSkillRevisionFromModelOutput(p.llmOutputRaw);
          let newPrompt = String(p.skillTimelinePrompt || '').trim();
          if (!newPrompt) newPrompt = parsedOut.newSystemPrompt;
          newPrompt = parseSystemPromptFromCombinedPrompt(newPrompt) || newPrompt;
          if (!newPrompt) continue;
          fromModificationLlmQuery.push({
            timestamp: c.time || p.timestamp || '',
            content: newPrompt,
            skillDiff: parsedOut.versionChangelog || '—',
          });
        } catch (_) {}
      }
    }

    /** 聊天区修订结果卡：含「新版本对老版本的修改」+「新提示词」 */
    const fromModificationChat = [];
    if (Array.isArray(allChats)) {
      for (const msg of allChats) {
        if (!msg || (msg.type !== 'modificationPromptRevisionBlock' && msg.type !== 'modificationNewPromptConfirmBlock')) continue;
        if (msg.type === 'modificationNewPromptConfirmBlock' && msg.confirmed !== true) continue;
        const inferred = inferTaskIdFromMessage(msg);
        if (normalizeTaskIdForHistory(inferred) !== normalizeTaskIdForHistory(taskId)) continue;
        const sp = String(msg.newSystemPrompt || '').trim();
        if (!sp) continue;
        const display = parseSystemPromptFromCombinedPrompt(sp) || sp;
        const diff = String(msg.versionChangelog || '').trim();
        fromModificationChat.push({
          timestamp: msg.timestamp || '',
          content: display,
          skillDiff: diff || '—',
        });
      }
    }

    let nodes = baseNodes.concat(fromModificationLlmQuery).concat(fromModificationChat);

    // 规则兜底：无首节点时，按任务创建时间补一条当前系统提示词首节点
    if (nodes.length === 0) {
      const currentPrompt = (
        taskData?.currentSystemPrompt ??
        taskData?.systemPrompt ??
        taskData?.prompt ??
        taskData?.system_prompt ??
        ''
      );
      const currentPromptText = typeof currentPrompt === 'string' ? currentPrompt.trim() : '';
      if (currentPromptText) {
        nodes.push({
          timestamp: createdAt || '',
          content: currentPromptText,
          skillDiff: '',
        });
      }
    }

    return finalizeSkillTimelineNodes(nodes, createdAt);
  }

  /**
   * 审计 Skill 时间线：跟踪全局骨架审计等 LLM 的 system 提示词演进（与任务 Skill 数据源隔离）。
   * 数据来源：任务跟踪 `auditSkillTimeline` 等字段；过程日志中 `task11GlobalSkeletonAuditLlmQueryBlock` / `rolePermissionAuditLlmQueryBlock`；
   * 以及 `modificationPromptRevisionLlmQueryBlock` 且 `noteName` 含「审计」或 `forAuditSkillTimeline` 为真。
   */
  function buildAuditSkillTimelineByTask(taskId, taskData, comms, createdAt, allChats) {
    const rawNodes =
      taskData?.auditSkillTimeline ??
      taskData?.auditSkillNodes ??
      taskData?.auditPromptTimeline ??
      taskData?.auditSystemPromptTimeline ??
      [];
    const explicitNodes = Array.isArray(rawNodes)
      ? rawNodes.map((node) => normalizeSkillNode(node)).filter(Boolean)
      : [];

    const fromAuditLogs = [];
    if (Array.isArray(comms)) {
      for (const c of comms) {
        try {
          const parsed = typeof c.content === 'string' ? JSON.parse(c.content) : c.content;
          const type = parsed?.type || '';
          if (type === 'task11GlobalSkeletonAuditLlmQueryBlock' || type === 'rolePermissionAuditLlmQueryBlock') {
            const pTaskNorm = normalizeTaskIdForHistory(parsed.taskId);
            const wantTaskNorm = normalizeTaskIdForHistory(taskId);
            if (pTaskNorm != null && wantTaskNorm != null && pTaskNorm !== wantTaskNorm) continue;
            const combined = parsed?.llmInputPrompt ?? parsed?.llmMeta?.inputPromptSnapshot ?? '';
            const systemPrompt = parseSystemPromptFromCombinedPrompt(combined);
            if (!systemPrompt) continue;
            fromAuditLogs.push({
              timestamp: c.time || parsed?.timestamp || '',
              content: systemPrompt,
              skillDiff: '',
            });
            continue;
          }
          if (type === 'modificationPromptRevisionLlmQueryBlock') {
            const pTaskNorm = normalizeTaskIdForHistory(parsed.taskId);
            const wantTaskNorm = normalizeTaskIdForHistory(taskId);
            if (pTaskNorm == null || wantTaskNorm == null || pTaskNorm !== wantTaskNorm) continue;
            const note = String(parsed.noteName || '');
            const auditHint =
              note.includes('审计') ||
              note.includes('骨架审计') ||
              parsed?.forAuditSkillTimeline === true ||
              parsed?.auditSkillRevision === true;
            if (!auditHint) continue;
            const parsedOut = parseSkillRevisionFromModelOutput(parsed.llmOutputRaw);
            let newPrompt = String(parsed.skillTimelinePrompt || '').trim();
            if (!newPrompt) newPrompt = parsedOut.newSystemPrompt;
            newPrompt = parseSystemPromptFromCombinedPrompt(newPrompt) || newPrompt;
            if (!newPrompt) continue;
            fromAuditLogs.push({
              timestamp: c.time || parsed?.timestamp || '',
              content: newPrompt,
              skillDiff: parsedOut.versionChangelog || '—',
            });
          }
        } catch (_) {}
      }
    }

    let baseNodes = explicitNodes.length > 0 ? explicitNodes : fromAuditLogs;

    const fromModificationChatAudit = [];
    if (Array.isArray(allChats)) {
      for (const msg of allChats) {
        if (!msg || (msg.type !== 'modificationPromptRevisionBlock' && msg.type !== 'modificationNewPromptConfirmBlock')) continue;
        if (normalizeTaskIdForHistory(inferTaskIdFromMessage(msg)) !== normalizeTaskIdForHistory(taskId)) continue;
        if (msg.forAuditSkillTimeline !== true) continue;
        const sp = String(msg.newSystemPrompt || '').trim();
        if (!sp) continue;
        const display = parseSystemPromptFromCombinedPrompt(sp) || sp;
        const diff = String(msg.versionChangelog || '').trim();
        fromModificationChatAudit.push({
          timestamp: msg.timestamp || '',
          content: display,
          skillDiff: diff || '—',
        });
      }
    }

    let nodes = baseNodes.concat(fromModificationChatAudit);

    if (nodes.length === 0) {
      const currentAudit = (
        taskData?.currentAuditSystemPrompt ??
        taskData?.auditSystemPrompt ??
        taskData?.globalSkeletonAuditSystemPrompt ??
        ''
      );
      const currentAuditText = typeof currentAudit === 'string' ? currentAudit.trim() : '';
      if (currentAuditText) {
        nodes.push({
          timestamp: createdAt || '',
          content: currentAuditText,
          skillDiff: '',
        });
      }
    }

    return finalizeSkillTimelineNodes(nodes, createdAt);
  }

  /** 根据聊天消息类型推断所属任务 */
  function normalizeTaskIdForHistory(taskId) {
    const rawTaskId = taskId == null ? '' : String(taskId).trim();
    if (!rawTaskId) return null;
    if (rawTaskId === 'e2e-flow') return 'task7';
    if (rawTaskId === 'global-itgap') return 'task8';
    if (rawTaskId === 'local-itgap') return 'task9';
    if (rawTaskId === 'task10' || rawTaskId === 'task11') return 'task12';
    const strategyMatch = rawTaskId.match(/^strategy-(\d+)$/);
    if (strategyMatch) {
      const strategyIndex = Number(strategyMatch[1]);
      if (Number.isInteger(strategyIndex) && strategyIndex >= 0 && strategyIndex <= 5) {
        if (strategyIndex === 0 || strategyIndex === 1) return 'task12';
        return 'task' + String(strategyIndex + 10);
      }
    }
    return rawTaskId;
  }

  function inferTaskIdFromMessage(msg) {
    if (!msg) return null;
    if (msg._taskId) return normalizeTaskIdForHistory(msg._taskId);
    const type = msg.type;
    const role = msg.role;
    const content = msg.content || '';
    if (type === 'task1LlmQueryBlock') return 'task1';
    if (type === 'task1PrelimMergePromptJsonBlock') return 'task1';
    if (type === 'task2LlmQueryBlock') return 'task2';
    if (type === 'task3LlmQueryBlock') return 'task3';
    if (type === 'task4LlmQueryBlock') return 'task4';
    if (type === 'task4ValueStreamPromptJsonBlock') return 'task4';
    if (type === 'task5LlmQueryBlock') return 'task5';
    if (type === 'task6LlmQueryBlock') return 'task6';
    if (type === 'task8LlmQueryBlock') return 'task8';
    if (type === 'task7LlmQueryBlock') return 'task7';
    if (type === 'task9LlmQueryBlock') return 'task9';
    if (type === 'task10LlmQueryBlock') return 'task12';
    if (type === 'task11LlmQueryBlock') return 'task12';
    if (type === 'task11GlobalSkeletonAuditLlmQueryBlock') return 'task12';
    if (type === 'task11CoreBusinessObjectAuditLlmQueryBlock') return 'task12';
    if (type === 'rolePermissionAuditLlmQueryBlock') return normalizeTaskIdForHistory(msg.taskId) || 'task12';
    if (type === 'rolePermissionAuditIntentBlock') return normalizeTaskIdForHistory(msg.taskId) || 'task12';
    if (type === 'rolePermissionAuditResultBlock') return normalizeTaskIdForHistory(msg.taskId) || 'task12';
    if (type === 'coreBusinessObjectGlobalAuditIntentBlock') return 'task12';
    if (type === 'coreBusinessObjectGlobalAuditResultBlock') return 'task12';
    if (type === 'basicInfoCard' || type === 'basicInfoJsonBlock' || (role === 'system' && (content === '解析完成' || content === '基本信息 json 提取完毕'))) return 'task1';
    if (type === 'bmcCard' || type === 'bmcStartBlock' || type === 'bmcDiscussionStartBlock' || type === 'bmcDiscussionReplyBlock' || type === 'bmcDiscussionLlmQueryBlock' || type === 'bmcDiscussionEndBlock' || (role === 'system' && content.includes('BMC'))) return 'task2';
    if (type === 'requirementLogicBlock' || type === 'requirementLogicStartBlock') return 'task3';
    if (
      type === 'valueStreamPhaseIntroBlock' ||
      type === 'valueStreamDrawSessionsBlock' ||
      type === 'valueStreamModificationRegenerateNotifyBlock' ||
      type === 'valueStreamCard' ||
      type === 'valueStreamConfirmLog' ||
      type === 'drawValueStreamStartBlock' ||
      type === 'valueStreamStartBlock' ||
      (role === 'system' && (content.includes('价值流') || content.includes('绘制')))
    ) {
      return 'task4';
    }
    if (
      type === 'itStatusStartBlock' ||
      type === 'itStatusOutputLog' ||
      type === 'itStatusCard' ||
      type === 'itStatusSessionsBlock' ||
      type === 'itStatusStepCard' ||
      type === 'itStatusModificationRegenerateNotifyBlock' ||
      type === 'itStatusAllDoneConfirmBlock' ||
      (role === 'system' &&
        (content === 'IT 现状标注完成' ||
          content === 'IT 现状标注失败' ||
          (typeof content === 'string' && content.includes('正在标注环节') && content.includes('IT 现状'))))
    ) {
      return 'task5';
    }
    if (type === 'painPointStartBlock' || type === 'painPointStepCard' || type === 'painPointSessionsBlock' || type === 'painPointAllDoneConfirmBlock' || (role === 'system' && (content === '痛点标注完成' || content === '痛点标注完毕' || content === '痛点标注失败' || (typeof content === 'string' && content.includes('正在标注环节') && content.includes('痛点'))))) return 'task6';
    if (type === 'intentExtractionCard' && msg.data?.taskId) return normalizeTaskIdForHistory(msg.data.taskId);
    if (type === 'e2eFlowGeneratedLog') return 'task7';
    if (
      type === 'e2eFlowExtractStartBlock' ||
      type === 'e2eBusinessFlowIntentBlock' ||
      type === 'e2eTransactionFlowSessionsBlock' ||
      type === 'e2ePrelimFvsCompletenessSessionsBlock' ||
      type === 'e2ePrelimFvsCompletenessAllDoneConfirmBlock' ||
      type === 'e2eTransactionFlowLlmPromptBlock' ||
      type === 'e2eBusinessFlowLlmStartBlock' ||
      type === 'e2eFlowJsonBlock' ||
      type === 'e2eFlowCompressionBlock' ||
      type === 'e2eFlowCompressionStartBlock'
    ) {
      return 'task7';
    }
    if (
      type === 'globalItGapStartBlock' ||
      type === 'globalItGapPhasePlanBlock' ||
      type === 'globalItGapAnalysisCard' ||
      type === 'globalItGapAnalysisLog' ||
      type === 'globalItGapContextLog' ||
      type === 'globalItGapCompressionBlock' ||
      type === 'itDesignSupplementSessionsBlock' ||
      type === 'itDesignBpmDrawSessionsBlock' ||
      type === 'itDesignSupplementAllDoneConfirmBlock'
    ) {
      return 'task8';
    }
    if (type === 'localItGapStartBlock' || type === 'localItGapSessionsBlock' || type === 'localItGapInputBlock' || type === 'localItGapOutputBlock' || type === 'localItGapAnalysisCard' || type === 'localItGapAnalysisLog' || type === 'localItGapContextLog' || type === 'localItGapContextBlock' || type === 'localItGapAllDoneConfirmBlock' || type === 'localItGapTaskCompleteConfirmBlock' || type === 'localItGapCompressionIntentBlock' || type === 'localItGapCompressionBlock' || type === 'roleTaskCenterDesignIntentBlock') return 'task9';
    if (type === 'rolePermissionStartBlock' || type === 'rolePermissionCard' || type === 'rolePermissionSessionsBlock' || type === 'rolePermissionStepProgressBlock' || type === 'rolePermissionAnalysisCard' || type === 'rolePermissionConfirmedLog' || type === 'rolePermissionAllDoneBlock' || type === 'rolePermissionModificationActionBlock' || type === 'rolePermissionModificationLlmQueryBlock') return 'task12';
    if (
      type === 'coreBusinessObjectContextBlock' ||
      type === 'coreBusinessObjectSessionsBlock' ||
      type === 'coreBusinessObjectAnalysisCard' ||
      type === 'coreBusinessObjectAllDoneBlock' ||
      type === 'coreBusinessObjectModificationRegenerateNotifyBlock'
    ) {
      return 'task12';
    }
    if (type === 'globalArchitectureContextBlock') return 'task12';
    if (type === 'taskContextBlock') return normalizeTaskIdForHistory(msg.taskId) || null;
    if (type === 'taskCompleteBlock' || type === 'taskCompletionConfirmBlock') return normalizeTaskIdForHistory(msg.taskId) || null;
    if (type === 'modificationIntentConfirmBlock') return normalizeTaskIdForHistory(msg.taskId) || null;
    if (
      type === 'preliminaryRequirementFollowupBlock' ||
      type === 'preliminaryRequirementModificationSummaryBlock' ||
      type === 'plusRequirementResetConfirmBlock'
    ) {
      return 'task1';
    }
    if (type === 'coreBusinessObjectGlobalAuditModificationGuideBlock') return 'task12';
    if (type === 'unsatisfiedBlock' || type === 'modificationResponseBlock' || type === 'rolePermissionModificationActionBlock' || type === 'task5ModificationActionBlock' || type === 'rolePermissionModificationLlmQueryBlock' || type === 'modificationPromptRevisionBlock' || type === 'modificationNewPromptConfirmBlock' || type === 'modificationPromptRevisionLlmQueryBlock' || type === 'modificationRegenerateLlmQueryBlock') return normalizeTaskIdForHistory(msg.taskId) || null;
    if (role === 'system' && typeof content === 'string') {
      const c = content;
      // task8：无结构化 type 的失败/提示（重启当前时需一并剔除）
      if (
        c.includes('全局 ITGap 分析失败') ||
        c.includes('IT设计补齐失败') ||
        c.includes('BPM 流程绘制失败') ||
        c.includes('全局 ITGap 架构约束底座压缩失败') ||
        c.includes('IT设计补齐·架构约束底座压缩失败')
      ) {
        return 'task8';
      }
      if ((c.includes('请先配置 AI') || c.includes('未配置 AI')) && (c.includes('全局 ITGap') || c.includes('IT设计补齐'))) return 'task8';
      if (c.includes('未配置 AI') && c.includes('架构约束底座')) return 'task8';
      if (typeof c === 'string' && c.includes('正在对事务【') && c.includes('IT设计补齐')) return 'task8';
      if (typeof c === 'string' && c.includes('正在绘制事务【') && c.includes('BPM')) return 'task8';
      // task7
      if (c.includes('端到端全景观提炼失败') || (c.includes('端到端') && c.includes('压缩') && c.includes('失败'))) return 'task7';
      if (
        c.includes('端到端流程 json 数据压缩') ||
        c.includes('正在进行端到端流程') ||
        c.includes('端到端事务流 json 数据压缩') ||
        c.includes('正在进行端到端事务流')
      ) {
        return 'task7';
      }
      if (c.includes('端到端全景观提炼需要先配置 AI')) return 'task7';
      if (c.includes('业务事务流生成失败') || (c.includes('业务事务流') && c.includes('生成失败'))) return 'task7';
      if (c.includes('生成业务事务流需要先配置 AI')) return 'task7';
      if (c.includes('业务流程完整性补齐失败')) return 'task7';
      if (c.includes('业务流程完整性补齐需要先配置 AI')) return 'task7';
      // task9
      if (
        c.includes('角色汇总设计失败') ||
        c.includes('角色汇总设计压缩失败') ||
        c.includes('对象状态机构建失败') ||
        c.includes('对象状态机构建压缩失败') ||
        c.includes('局部 ITGap 分析失败') ||
        c.includes('局部 ITGap 压缩失败')
      )
        return 'task9';
      if (
        (c.includes('角色汇总设计功能') ||
          c.includes('对象状态机构建功能') ||
          c.includes('局部 ITGap 分析功能')) &&
        (c.includes('配置') || c.includes('DEEPSEEK'))
      )
        return 'task9';
      if (c.includes('正在分析环节')) return 'task9';
      if (c.includes('正在进行') && c.includes('角色与权限')) return 'task12';
      if (c.includes('角色与权限模型推演失败')) return 'task12';
      if (c.includes('正在进行') && c.includes('核心业务对象推演')) return 'task12';
      if (c.includes('核心业务对象推演失败')) return 'task12';
      if (c.includes('根据讨论重新生成 BMC 失败')) return 'task2';
      if (c.includes('需求逻辑构建失败')) return 'task3';
    }
    return null;
  }

  /** 判断消息是否应纳入任务沟通历史：仅大模型返回内容或用户主动输入；未确认的意图卡片不纳入；查询意图的客户输入与系统返回均不纳入；请教讨论纳入；用户纯「确认」不纳入 */
  function shouldIncludeInCommunicationHistory(msg) {
    if (!msg) return false;
    if (msg.role === 'user') {
      if ((msg.content || '').trim() === '确认') return false;
      return true;
    }
    if (msg._taskId) return true; // 请教讨论的系统回复
    const type = msg.type;
    if (type === 'intentExtractionCard') {
      if (msg.data?.intent === 'query') return false; // 查询意图：系统返回内容不纳入
      if (msg.data?.intent === 'discussion') return false; // 请教讨论：意图卡片本身不纳入，用户消息与系统回复已单独处理
      return !!msg.confirmed;
    }
    if (type === 'task1LlmQueryBlock') {
      if (String(msg.noteName || '').includes('初步需求提取')) return false;
      return true;
    }
    if (type === 'task2LlmQueryBlock') return true;
    if (type === 'task3LlmQueryBlock') return true;
    if (type === 'task4LlmQueryBlock') return true;
    if (type === 'task5LlmQueryBlock') return true;
    if (type === 'task6LlmQueryBlock') return true;
    if (type === 'task8LlmQueryBlock') return true;
    if (type === 'task7LlmQueryBlock') return true;
    if (type === 'task9LlmQueryBlock') return true;
    if (type === 'task10LlmQueryBlock') return true;
    if (type === 'task11LlmQueryBlock') return true;
    if (type === 'task11GlobalSkeletonAuditLlmQueryBlock') return true;
    if (type === 'task11CoreBusinessObjectAuditLlmQueryBlock') return true;
    if (type === 'rolePermissionAuditLlmQueryBlock') return true;
    if (type === 'rolePermissionAuditIntentBlock') return true;
    if (type === 'rolePermissionAuditResultBlock') return true;
    if (type === 'modificationPromptRevisionLlmQueryBlock') return true; // 修改·新提示词生成：过程日志 LLM-查询（输入/输出子卡片）
    if (type === 'modificationRegenerateLlmQueryBlock') return true; // task1/task4/task5 修改重生成：过程日志 LLM-修改 或 LLM-查询（见 payload.content）
    if (type === 'modificationNewPromptConfirmBlock') return false; // 仅聊天区：新提示词确认后再调大模型
    if (type === 'modificationIntentConfirmBlock') return false; // 仅聊天区：修改意图确认后进入提示词修订
    if (type === 'coreBusinessObjectGlobalAuditModificationGuideBlock') return false; // 审计后修改引导，仅聊天区
    if (type === 'coreBusinessObjectModificationRegenerateNotifyBlock') return false; // task11 修改链路：二次确认仅聊天区
    if (type === 'itStatusModificationRegenerateNotifyBlock') return false; // task5 修改链路：二次确认仅聊天区
    if (type === 'valueStreamModificationRegenerateNotifyBlock') return false; // task4 修改链路：二次确认仅聊天区
    if (type === 'basicInfoCard') return false; // task1 基本信息卡片不进入时间线，仅保留 LLM-查询卡片
    if (type === 'bmcCard') return false; // task2 BMC 卡片不进入时间线，仅保留 LLM-查询卡片
    if (type === 'bmcDiscussionStartBlock') return false; // 讨论开始标记不单独进入时间线
    if (type === 'bmcDiscussionReplyBlock') return false; // 讨论回复仅在聊天区展示，时间线用 bmcDiscussionLlmQueryBlock
    if (type === 'bmcDiscussionLlmQueryBlock') return true; // 讨论 LLM 查询卡片纳入时间线（输入/输出子卡片）
    if (type === 'requirementLogicBlock') return false; // task3 需求逻辑卡片不进入时间线，仅保留 LLM-查询卡片
    if (type === 'valueStreamPhaseIntroBlock') return false; // task4 两阶段引导仅主聊天区
    if (type === 'task4ValueStreamPromptJsonBlock') return false; // task4 调用前提示词 JSON 仅主聊天区（过程日志以 task4LlmQueryBlock 为准）
    if (type === 'task1PrelimMergePromptJsonBlock') return false; // task1「核心对象/状态逻辑」合并前完整提示词仅主聊天区（过程日志以 modificationRegenerateLlmQueryBlock 为准）
    if (type === 'e2eTransactionFlowLlmPromptBlock') return false; // task7 调用前完整提示词仅主聊天区（过程日志以后续 LLM 块为准）
    if (type === 'valueStreamCard') return false; // task4 价值流图 JSON 卡片不进入时间线，仅保留 LLM-查询块
    if (type === 'valueStreamConfirmLog' || type === 'itStatusOutputLog') return true;
    if (type === 'itStatusCard') return false; // task5 IT 现状卡片不进入时间线，仅保留 LLM-查询块
    if (type === 'painPointStepCard') return false; // task6 痛点单步卡片不进入时间线，仅保留 LLM-查询块
    if (type === 'e2eFlowGeneratedLog') return true;
    if (type === 'e2eFlowExtractStartBlock') return !!msg.confirmed;
    if (type === 'e2eBusinessFlowIntentBlock') return !!msg.confirmed;
    if (type === 'e2eTransactionFlowSessionsBlock') return true;
    if (type === 'e2ePrelimFvsCompletenessSessionsBlock') return true;
    if (type === 'e2ePrelimFvsCompletenessAllDoneConfirmBlock') return true;
    if (type === 'e2eBusinessFlowLlmStartBlock') return true;
    // task7：业务事务流 / 端到端 JSON 卡片仅主聊天区展示；过程日志以 task7LlmQueryBlock（及压缩等）为准，避免重复大块 JSON 卡片
    if (type === 'e2eFlowJsonBlock') return false;
    if (type === 'e2eFlowCompressionStartBlock') return true; // task7 压缩进度块（与 infer、重启过滤一致）
    if (type === 'e2eFlowCompressionBlock') return true; // task7 端到端全景观提炼压缩：过程日志 LLM-压缩
    if (type === 'globalItGapStartBlock') return !!msg.confirmed;
    if (type === 'globalItGapPhasePlanBlock') return true;
    if (type === 'itDesignSupplementSessionsBlock') return true;
    if (type === 'itDesignBpmDrawSessionsBlock') return true;
    if (type === 'itDesignSupplementAllDoneConfirmBlock') return true;
    if (type === 'globalItGapAnalysisCard') return false; // task8 结果卡片不进入时间线，仅保留 LLM-查询块
    if (type === 'globalItGapCompressionBlock') return true; // task8 架构约束底座压缩：过程日志 LLM-压缩（输入/输出子卡片）
    if (type === 'globalItGapAnalysisLog') return true;
    if (type === 'globalItGapContextLog') return false; // task8 上下文块不再进入时间线（兼容历史数据）
    if (type === 'localItGapStartBlock') return !!msg.confirmed;
    if (type === 'localItGapSessionsBlock') return true;
    if (type === 'valueStreamDrawSessionsBlock') return true;
    if (type === 'localItGapInputBlock' || type === 'localItGapOutputBlock') return true;
    if (type === 'localItGapAnalysisCard') return false; // task9 结果卡片不进入时间线，仅保留 LLM-查询块
    if (type === 'localItGapAnalysisLog') return false; // task9 兼容历史分析日志不进入时间线
    if (type === 'localItGapContextLog') return true;
    if (type === 'localItGapContextBlock') return true;
    if (type === 'localItGapAllDoneConfirmBlock') return true;
    if (type === 'localItGapTaskCompleteConfirmBlock') return true;
    if (type === 'localItGapCompressionIntentBlock') return true;
    if (type === 'localItGapCompressionBlock') return true;
    if (type === 'roleTaskCenterDesignIntentBlock') return true;
    if (type === 'rolePermissionCard') return true; // 推送即纳入过程日志，未确认时标签为「输出」，确认后为「确认」
    if (type === 'rolePermissionSessionsBlock') return true;
    if (type === 'rolePermissionAnalysisCard') return msg?.fromModificationRegenerate !== true; // 修改重生成时仅保留 LLM-修改 卡片，避免重复 LLM-查询
    if (type === 'rolePermissionConfirmedLog') return true;
    if (type === 'coreBusinessObjectContextBlock' || type === 'coreBusinessObjectSessionsBlock' || type === 'coreBusinessObjectAllDoneBlock') return true;
    if (type === 'coreBusinessObjectGlobalAuditIntentBlock') return !!msg.confirmed;
    if (type === 'coreBusinessObjectGlobalAuditResultBlock') return false; // 仅聊天区展示审计正文；过程日志以 LLM-审计 双子卡为准
    if (type === 'coreBusinessObjectAnalysisCard') return false; // 过程日志仅保留 task11LlmQueryBlock（与 task9 一致）
    if (type === 'globalArchitectureContextBlock') return true;
    if (type === 'taskContextBlock') return msg.taskId !== 'task8'; // task8 任务上下文不再进入时间线（兼容历史数据）
    if (type === 'taskCompleteBlock') return true;
    if (type === 'unsatisfiedBlock') return false; // 用户点击「修正」时不向过程日志推送该块
    if (type === 'modificationResponseBlock') return true;
    if (type === 'rolePermissionModificationActionBlock') return false; // 仅聊天区展示，不纳入过程日志
    if (type === 'rolePermissionStepProgressBlock') return false; // 仅聊天区进行中态，不纳入过程日志（FE-20260329-08）
    if (type === 'rolePermissionModificationLlmQueryBlock') return true;
    if (type === 'modificationPromptRevisionBlock') return false; // 仅聊天区展示修订摘要；任务 Skill 从全量聊天记录合并，过程日志用 modificationPromptRevisionLlmQueryBlock
    if (type === 'preliminaryRequirementFollowupBlock') return false; // 仅聊天区操作入口，不纳入时间线
    if (type === 'plusRequirementResetConfirmBlock') return false; // 顶栏「+需求」确认块，仅主聊天区
    if (type === 'preliminaryRequirementModificationSummaryBlock') return false; // 修改要点在聊天区展示；过程日志以 task1 modificationRegenerateLlmQueryBlock（LLM-修改）为准
    return false;
  }

  /** 将聊天消息按任务分段，返回 taskId -> communications。chats 为当前问题的消息数组（由调用方传入，可来自内存或 getProblemDetailChats()[createdAt]） */
  function getCommunicationsByTask(createdAt, chats) {
    if (!Array.isArray(chats) || chats.length === 0) return {};
    let currentTask = 'task1';
    const byTask = {};
    FOLLOW_TASKS.forEach((t) => { byTask[t.id] = []; });
    ITGAP_HISTORY_TASKS.forEach((t) => { byTask[t.id] = []; });
    IT_STRATEGY_TASKS.forEach((t) => { byTask[t.id] = []; });
    const ensureTaskBucket = (taskId, fallbackTaskId) => {
      const normalizedTaskId = normalizeTaskIdForHistory(taskId);
      if (normalizedTaskId && !Array.isArray(byTask[normalizedTaskId])) byTask[normalizedTaskId] = [];
      if (normalizedTaskId && Array.isArray(byTask[normalizedTaskId])) return normalizedTaskId;
      const normalizedFallback = normalizeTaskIdForHistory(fallbackTaskId);
      if (normalizedFallback && !Array.isArray(byTask[normalizedFallback])) byTask[normalizedFallback] = [];
      if (normalizedFallback && Array.isArray(byTask[normalizedFallback])) return normalizedFallback;
      if (!Array.isArray(byTask.task1)) byTask.task1 = [];
      return 'task1';
    };
    let lastUserComm = null;
    const parseRolePermissionModel = typeof global.parseRolePermissionModel === 'function' ? global.parseRolePermissionModel : () => null;
    for (const msg of chats) {
      if (msg.askMode === true) continue;
      const inferred = inferTaskIdFromMessage(msg);
      if (inferred) currentTask = inferred;
      // task1（企业背景洞察）阶段：用户粘贴的基本工商信息不再推送到时间线
      if (msg.role === 'user' && currentTask === 'task1' && !msg._taskId) {
        const text = (msg.content || '').trim();
        if (text && text !== '确认') {
          lastUserComm = null;
          continue;
        }
      }
      const isQueryIntentCard = msg.type === 'intentExtractionCard' && msg.data?.intent === 'query';
      const isDiscussionIntentCard = msg.type === 'intentExtractionCard' && msg.data?.intent === 'discussion';
      const isUnconfirmedIntentCard = msg.type === 'intentExtractionCard' && !msg.confirmed;
      if (isQueryIntentCard || (isUnconfirmedIntentCard && !isDiscussionIntentCard)) {
        if (lastUserComm) {
          const comms = byTask[ensureTaskBucket(lastUserComm.task, currentTask)];
          if (comms.length > 0 && comms[comms.length - 1] === lastUserComm.entry) comms.pop();
          lastUserComm = null;
        }
        continue;
      }
      if (isDiscussionIntentCard) {
        if (msg.confirmed && lastUserComm) {
          const targetTaskId = ensureTaskBucket(msg.data?.taskId || currentTask, currentTask);
          const commsFrom = byTask[ensureTaskBucket(lastUserComm.task, currentTask)];
          const idx = commsFrom.indexOf(lastUserComm.entry);
          if (idx >= 0) {
            commsFrom.splice(idx, 1);
            byTask[targetTaskId].push(lastUserComm.entry);
          }
          currentTask = targetTaskId;
          const extractionPayload = { role: 'system', type: 'intentExtractionCard', content: '讨论请教', data: msg.data, userText: msg.userText, timestamp: msg.timestamp };
          const extractionEntry = { speaker: '系统提炼', time: msg.timestamp || '', content: JSON.stringify(extractionPayload, null, 2) };
          byTask[targetTaskId].push(extractionEntry);
        } else if (lastUserComm) {
          const comms = byTask[ensureTaskBucket(lastUserComm.task, currentTask)];
          if (comms.length > 0 && comms[comms.length - 1] === lastUserComm.entry) comms.pop();
        }
        lastUserComm = null;
        continue;
      }
      if (!shouldIncludeInCommunicationHistory(msg)) continue;
      const speaker = (msg.role === 'user' || msg.type === 'taskCompleteBlock' || msg.type === 'unsatisfiedBlock') ? '用户' : '系统大模型';
      const payload = { role: msg.type === 'taskCompleteBlock' || msg.type === 'unsatisfiedBlock' ? 'user' : (msg.role || 'system'), content: msg.content, type: msg.type, timestamp: msg.timestamp };
      if (msg._logType) payload._logType = msg._logType;
      if (msg.llmMeta) payload.llmMeta = msg.llmMeta;
      if ((msg.type === 'taskCompleteBlock' || msg.type === 'unsatisfiedBlock' || msg.type === 'modificationResponseBlock' || msg.type === 'rolePermissionModificationActionBlock' || msg.type === 'rolePermissionModificationLlmQueryBlock' || msg.type === 'modificationPromptRevisionLlmQueryBlock' || msg.type === 'modificationRegenerateLlmQueryBlock' || msg.type === 'task10LlmQueryBlock' || msg.type === 'rolePermissionAuditLlmQueryBlock' || msg.type === 'rolePermissionAuditIntentBlock' || msg.type === 'rolePermissionAuditResultBlock') && msg.taskId) payload.taskId = msg.taskId;
      if (msg.type === 'taskContextBlock') {
        payload.content = '任务上下文';
        payload.contextJson = msg.contextJson;
        payload.taskId = msg.taskId;
        if (msg.contextLabel) payload.contextLabel = msg.contextLabel;
      }
      if (msg.type === 'globalItGapContextLog') {
        payload.content = '上下文';
        payload.contextJson = msg.contextJson;
        payload.taskId = msg.taskId || 'task8';
      }
      if (msg.type === 'localItGapContextLog') {
        payload.content = '上下文';
        payload.taskId = msg.taskId || 'task9';
      }
      if (msg.type === 'localItGapContextBlock') {
        payload.content = '上下文';
        payload.contextLabel = msg.contextLabel;
        payload.contextJson = msg.contextJson;
        payload.taskId = msg.taskId || 'task9';
      }
      if (msg.data) payload.data = msg.data;
      if (msg.type === 'task1LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputJson != null) payload.llmOutputJson = msg.llmOutputJson;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        payload.taskId = msg.taskId || 'task1';
      }
      if (msg.type === 'task2LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputJson != null) payload.llmOutputJson = msg.llmOutputJson;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        payload.taskId = msg.taskId || 'task2';
      }
      if (msg.type === 'bmcDiscussionLlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = msg.taskId || 'task2';
      }
      if (msg.type === 'task3LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputJson != null) payload.llmOutputJson = msg.llmOutputJson;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = msg.taskId || 'task3';
      }
      if (msg.type === 'task4LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = msg.taskId || 'task4';
      }
      if (msg.type === 'task5LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.stepName != null) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = msg.taskId || 'task5';
      }
      if (msg.type === 'task6LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.stepName != null) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = msg.taskId || 'task6';
      }
      if (msg.type === 'task8LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.stepName != null) payload.stepName = msg.stepName;
        if (msg.phaseIndex != null) payload.phaseIndex = msg.phaseIndex;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputJson != null) payload.llmOutputJson = msg.llmOutputJson;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = msg.taskId || 'task8';
      }
      if (msg.type === 'itDesignSupplementSessionsBlock') {
        payload.content = 'IT设计补齐·事务流 Session 计划';
        if (Array.isArray(msg.sessions)) payload.sessions = msg.sessions;
        if (msg.interleavedBpmDrawPlan === true) payload.interleavedBpmDrawPlan = true;
        payload.confirmed = !!msg.confirmed;
        payload.taskId = msg.taskId || 'task8';
      }
      if (msg.type === 'itDesignBpmDrawSessionsBlock') {
        payload.content = 'IT设计补齐·BPM 流程绘制 Session 计划';
        if (Array.isArray(msg.sessions)) payload.sessions = msg.sessions;
        payload.taskId = msg.taskId || 'task8';
      }
      if (msg.type === 'itDesignSupplementAllDoneConfirmBlock') {
        payload.content = msg.content || 'IT设计补齐·全部确认';
        payload.confirmed = !!msg.confirmed;
        payload.taskId = msg.taskId || 'task8';
      }
      if (msg.type === 'globalItGapPhasePlanBlock') {
        payload.content = '全局 ITGap 四阶段分析计划';
        if (Array.isArray(msg.phases)) payload.phases = msg.phases;
        payload.confirmed = !!msg.confirmed;
        payload.taskId = msg.taskId || 'task8';
      }
      if (msg.type === 'task7LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.stepName != null) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = msg.taskId || 'task7';
      }
      if (msg.type === 'task9LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.stepName != null) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = msg.taskId || 'task9';
      }
      if (msg.type === 'task10LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.stepName != null) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
      }
      if (msg.type === 'task11LlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.stepName != null) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
      }
      if (msg.type === 'task11GlobalSkeletonAuditLlmQueryBlock') {
        payload.content = 'LLM-审计';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
      }
      if (msg.type === 'task11CoreBusinessObjectAuditLlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
      }
      if (msg.type === 'rolePermissionAuditLlmQueryBlock') {
        payload.content = 'LLM-审计';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
      }
      if (msg.type === 'rolePermissionAuditIntentBlock') {
        payload.content = msg.content;
        payload.confirmed = !!msg.confirmed;
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
      }
      if (msg.type === 'rolePermissionAuditResultBlock') {
        if (msg.auditOpinionRaw != null) payload.auditOpinionRaw = msg.auditOpinionRaw;
        payload.modificationExtractUsed = !!msg.modificationExtractUsed;
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
      }
      if (msg.type === 'coreBusinessObjectGlobalAuditIntentBlock') {
        payload.content = msg.content;
        payload.confirmed = !!msg.confirmed;
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
      }
      if (msg.type === 'modificationPromptRevisionLlmQueryBlock') {
        payload.content = 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.skillTimelinePrompt != null) payload.skillTimelinePrompt = msg.skillTimelinePrompt;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        if (msg.taskId != null) payload.taskId = msg.taskId;
      }
      if (msg.type === 'modificationRegenerateLlmQueryBlock') {
        payload.content =
          msg.taskId === 'task5' || msg.taskId === 'task1' || msg.taskId === 'task4' ? 'LLM-修改' : 'LLM-查询';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.modificationActionMarkdown != null) payload.modificationActionMarkdown = msg.modificationActionMarkdown;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        if (msg.taskId != null) payload.taskId = msg.taskId;
      }
      if (msg.type === 'rolePermissionModificationActionBlock') {
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
        if (msg.versionChangelogFromPrompt != null) payload.versionChangelogFromPrompt = msg.versionChangelogFromPrompt;
        if (msg.diffSummaryMarkdown != null) payload.diffSummaryMarkdown = msg.diffSummaryMarkdown;
        if (msg.currentSessionsSnapshot != null) payload.currentSessionsSnapshot = msg.currentSessionsSnapshot;
        payload.confirmed = !!msg.confirmed;
      }
      if (msg.type === 'rolePermissionModificationLlmQueryBlock') {
        payload.content = 'LLM-修改';
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.stepName != null) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.modificationDiffMarkdown != null) payload.modificationDiffMarkdown = msg.modificationDiffMarkdown;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
      }
      if (msg.type === 'valueStreamConfirmLog' && msg.taskId) payload.taskId = msg.taskId;
      if (msg.type === 'itStatusOutputLog' && msg.taskId) payload.taskId = msg.taskId;
      if (msg.type === 'itStatusOutputLog') payload.confirmed = !!msg.confirmed;
      if (['basicInfoCard', 'bmcCard', 'requirementLogicBlock', 'valueStreamCard', 'itStatusCard'].includes(msg.type)) payload.confirmed = !!msg.confirmed;
      if (msg.type === 'e2eFlowJsonBlock') payload.confirmed = !!msg.confirmed;
      if (msg.parsed) payload.parsed = msg.parsed;
      if (msg.type === 'intentExtractionCard' && msg.userText) payload.userText = msg.userText;
      if (msg.type === 'e2eFlowGeneratedLog' && msg.valueStreamJson) payload.valueStreamJson = msg.valueStreamJson;
      if (msg.type === 'e2eFlowJsonBlock' && msg.valueStreamJson) payload.valueStreamJson = msg.valueStreamJson;
      if (msg.type === 'e2eFlowJsonBlock' && msg.transactionFlowJson) payload.transactionFlowJson = msg.transactionFlowJson;
      if ((msg.type === 'globalItGapAnalysisCard' && msg.data) || (msg.type === 'globalItGapAnalysisLog' && msg.analysisJson)) payload.analysisJson = msg.data || msg.analysisJson;
      if ((msg.type === 'localItGapAnalysisCard' && msg.data) || (msg.type === 'localItGapAnalysisLog' && msg.analysisJson)) payload.analysisJson = msg.data || msg.analysisJson;
      if ((msg.type === 'localItGapAnalysisCard' || msg.type === 'localItGapAnalysisLog') && msg.stepName) payload.stepName = msg.stepName;
      if (msg.type === 'localItGapSessionsBlock' && msg.sessions) payload.sessions = msg.sessions;
      if (msg.type === 'e2eTransactionFlowSessionsBlock' && msg.sessions) payload.sessions = msg.sessions;
      if (msg.type === 'e2ePrelimFvsCompletenessSessionsBlock' && msg.sessions) payload.sessions = msg.sessions;
      if (msg.type === 'e2ePrelimFvsCompletenessAllDoneConfirmBlock') {
        payload.content = msg.content || '所有端到端事务流补齐已完成。';
        payload.confirmed = !!msg.confirmed;
        payload.taskId = msg.taskId || 'task7';
      }
      if (msg.type === 'localItGapInputBlock') {
        if (msg.stepName) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.fullInput != null) payload.fullInput = msg.fullInput;
        if (msg.prompt != null) payload.prompt = msg.prompt;
        payload.taskId = msg.taskId || 'task9';
      }
      if (msg.type === 'localItGapOutputBlock') {
        if (msg.stepName) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        payload.taskId = msg.taskId || 'task9';
      }
      if (msg.type === 'localItGapAnalysisCard') payload.confirmed = !!msg.confirmed;
      if (msg.type === 'localItGapAllDoneConfirmBlock') {
        payload.content = msg.content;
        payload.confirmed = !!msg.confirmed;
        if (msg.taskId) payload.taskId = msg.taskId;
      }
      if (msg.type === 'localItGapTaskCompleteConfirmBlock') {
        payload.content = msg.content;
        payload.confirmed = !!msg.confirmed;
        if (msg.taskId) payload.taskId = msg.taskId;
      }
      if (msg.type === 'localItGapCompressionIntentBlock') {
        payload.content = msg.content;
        payload.confirmed = !!msg.confirmed;
        if (msg.taskId) payload.taskId = msg.taskId;
      }
      if (msg.type === 'roleTaskCenterDesignIntentBlock') {
        payload.confirmed = !!msg.confirmed;
        if (msg.taskId) payload.taskId = msg.taskId;
      }
      if (msg.type === 'localItGapCompressionBlock') {
        if (msg.stepName) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.compressedJson != null) payload.compressedJson = msg.compressedJson;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.llmMeta) payload.llmMeta = msg.llmMeta;
        if (msg.confirmed === true) payload.confirmed = true;
        if (msg.taskId) payload.taskId = msg.taskId;
      }
      if (msg.type === 'globalItGapCompressionBlock') {
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.constraintBaseMarkdown != null) payload.constraintBaseMarkdown = msg.constraintBaseMarkdown;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.llmMeta) payload.llmMeta = msg.llmMeta;
        if (msg.confirmed === true) payload.confirmed = true;
        payload.taskId = msg.taskId || 'task8';
      }
      if (msg.type === 'e2eFlowCompressionBlock') {
        if (msg.noteName != null) payload.noteName = msg.noteName;
        if (msg.compressedJson != null) payload.compressedJson = msg.compressedJson;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.llmMeta) payload.llmMeta = msg.llmMeta;
        if (msg.confirmed === true) payload.confirmed = true;
        payload.taskId = msg.taskId || 'task7';
      }
      if (msg.type === 'rolePermissionCard') {
        payload.confirmed = !!msg.confirmed;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        if (msg.confirmed && typeof msg.content === 'string') payload.rolePermissionModelJson = parseRolePermissionModel(msg.content);
        payload.noteName = '角色与权限模型推演（整模型）';
        if (payload.llmInputPrompt == null && msg.llmMeta?.inputPromptSnapshot != null) payload.llmInputPrompt = msg.llmMeta.inputPromptSnapshot;
      }
      if (msg.type === 'rolePermissionSessionsBlock' && msg.sessions) payload.sessions = msg.sessions;
      if (msg.type === 'rolePermissionSessionsBlock') payload.confirmed = !!msg.confirmed;
      if (msg.type === 'rolePermissionAnalysisCard') {
        payload.confirmed = !!msg.confirmed;
        if (msg.stepName) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
        if (msg.llmInputPrompt != null) payload.llmInputPrompt = msg.llmInputPrompt;
        if (msg.llmOutputRaw != null) payload.llmOutputRaw = msg.llmOutputRaw;
        if (msg.llmMeta != null) payload.llmMeta = msg.llmMeta;
        if (payload.llmInputPrompt == null && msg.llmMeta?.inputPromptSnapshot != null) payload.llmInputPrompt = msg.llmMeta.inputPromptSnapshot;
      }
      if (msg.type === 'rolePermissionConfirmedLog' && msg.rolePermissionModelJson) {
        payload.rolePermissionModelJson = msg.rolePermissionModelJson;
      }
      if (msg.type === 'coreBusinessObjectContextBlock') {
        payload.content = '上下文';
        payload.contextJson = msg.contextJson;
        payload.contextLabel = msg.contextLabel;
        payload.taskId = normalizeTaskIdForHistory(msg.taskId) || 'task12';
      }
      if (msg.type === 'globalArchitectureContextBlock') {
        payload.content = '上下文';
        payload.contextJson = msg.contextJson;
        payload.contextLabel = msg.contextLabel;
        payload.taskId = msg.taskId || 'task12';
      }
      if (msg.type === 'coreBusinessObjectSessionsBlock' && msg.sessions) payload.sessions = msg.sessions;
      if (msg.type === 'coreBusinessObjectSessionsBlock') payload.confirmed = !!msg.confirmed;
      if (msg.type === 'coreBusinessObjectAnalysisCard') {
        payload.confirmed = !!msg.confirmed;
        if (msg.stepName) payload.stepName = msg.stepName;
        if (msg.stepIndex != null) payload.stepIndex = msg.stepIndex;
      }
      if (msg.type === 'coreBusinessObjectAllDoneBlock') payload.allConfirmed = !!msg.allConfirmed;
      const contentJson = JSON.stringify(payload, null, 2);
      const entry = { speaker, time: msg.timestamp || '', content: contentJson };
      /** 任务完成块、价值流确认日志、IT 现状输出日志必须归入其 msg.taskId 对应任务；历史 RP/CBO 类消息归档归 task12（独立 task10、独立 task11 已下线） */
      const rawTargetTask = ((msg.type === 'rolePermissionCard' || msg.type === 'rolePermissionSessionsBlock' || msg.type === 'rolePermissionStepProgressBlock' || msg.type === 'rolePermissionAnalysisCard' || msg.type === 'rolePermissionAllDoneBlock' || msg.type === 'task10LlmQueryBlock' || msg.type === 'rolePermissionAuditLlmQueryBlock' || msg.type === 'rolePermissionAuditIntentBlock' || msg.type === 'rolePermissionAuditResultBlock' || msg.type === 'rolePermissionModificationActionBlock' || msg.type === 'rolePermissionModificationLlmQueryBlock') && Array.isArray(byTask.task12)) ? 'task12' : ((msg.type === 'coreBusinessObjectContextBlock' || msg.type === 'coreBusinessObjectSessionsBlock' || msg.type === 'coreBusinessObjectAnalysisCard' || msg.type === 'coreBusinessObjectAllDoneBlock' || msg.type === 'task11LlmQueryBlock' || msg.type === 'task11GlobalSkeletonAuditLlmQueryBlock' || msg.type === 'coreBusinessObjectGlobalAuditIntentBlock' || msg.type === 'coreBusinessObjectGlobalAuditResultBlock' || msg.type === 'coreBusinessObjectGlobalAuditModificationGuideBlock') && Array.isArray(byTask.task12)) ? 'task12' : ((msg.type === 'globalArchitectureContextBlock') && Array.isArray(byTask.task12)) ? 'task12' : (((msg.type === 'taskCompleteBlock' || msg.type === 'valueStreamConfirmLog' || msg.type === 'itStatusOutputLog' || msg.type === 'globalItGapContextLog' || msg.type === 'localItGapContextLog' || msg.type === 'localItGapContextBlock' || msg.type === 'globalItGapCompressionBlock' || msg.type === 'e2eFlowCompressionBlock' || msg.type === 'modificationPromptRevisionLlmQueryBlock' || msg.type === 'modificationRegenerateLlmQueryBlock' || msg.type === 'modificationResponseBlock') && msg.taskId && Array.isArray(byTask[normalizeTaskIdForHistory(msg.taskId)])) ? normalizeTaskIdForHistory(msg.taskId) : currentTask);
      const targetTask = ensureTaskBucket(rawTargetTask, currentTask);
      byTask[targetTask].push(entry);
      lastUserComm = msg.role === 'user' ? { task: targetTask, entry } : null;
    }
    return byTask;
  }

  /** 将沟通记录扁平化为按时间排序的时间线数组，供时间线视图使用 */
  function getCommunicationsAsTimeline(createdAt, chats) {
    const byTask = getCommunicationsByTask(createdAt, chats);
    const flat = [];
    FOLLOW_TASKS.forEach((task) => {
      const comms = byTask[task.id] || [];
      comms.forEach((c) => {
        flat.push({ ...c, taskId: task.id, taskName: task.name });
      });
    });
    flat.sort((a, b) => {
      const ta = (a.time && new Date(a.time).getTime()) || 0;
      const tb = (b.time && new Date(b.time).getTime()) || 0;
      return ta - tb;
    });
    return flat;
  }

  /** 从沟通记录条目解析日志类型：输入、输出、确认、修正、讨论、上下文、任务完成、不满意 */
  function getCommunicationLogType(c) {
    try {
      const parsed = typeof c.content === 'string' ? JSON.parse(c.content) : c.content;
      if (parsed?._logType === 'modify') return '修正';
      if (parsed?._logType === 'bmcDiscussionUser') return '用户讨论';
      if (parsed?.type === 'taskCompleteBlock') return '任务完成';
      if (parsed?.type === 'task1LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task2LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'bmcDiscussionLlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task3LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task4LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task5LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task6LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task8LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task7LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task9LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task11LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task10LlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'task11GlobalSkeletonAuditLlmQueryBlock') return 'LLM-审计';
      if (parsed?.type === 'task11CoreBusinessObjectAuditLlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'rolePermissionAuditLlmQueryBlock') return 'LLM-审计';
      if (parsed?.type === 'modificationPromptRevisionLlmQueryBlock') return 'LLM-查询';
      if (parsed?.type === 'modificationRegenerateLlmQueryBlock') {
        return parsed?.taskId === 'task5' || parsed?.taskId === 'task1' || parsed?.taskId === 'task4'
          ? 'LLM-修改'
          : 'LLM-查询';
      }
      if (parsed?.type === 'rolePermissionModificationLlmQueryBlock') return 'LLM-修改';
      if (parsed?.type === 'rolePermissionModificationActionBlock') return '修改动作';
      if (parsed?.type === 'rolePermissionCard') return 'LLM-查询';
      if (parsed?.type === 'rolePermissionAnalysisCard') return 'LLM-查询';
    } catch (_) {}
    if (c.speaker === '用户') return '输入';
    try {
      const parsed = typeof c.content === 'string' ? JSON.parse(c.content) : c.content;
      if (parsed?.type === 'taskCompleteBlock') return '任务完成';
      if (parsed?.type === 'unsatisfiedBlock') return '不满意';
      if (parsed?.type === 'taskContextBlock' || parsed?.type === 'globalItGapContextLog' || parsed?.type === 'localItGapContextLog' || parsed?.type === 'localItGapContextBlock' || parsed?.type === 'coreBusinessObjectContextBlock' || parsed?.type === 'globalArchitectureContextBlock') return '上下文';
      if (parsed?.type === 'intentExtractionCard' && parsed?.data?.intent === 'discussion') return '讨论';
      if (parsed?.type === 'intentExtractionCard' && parsed?.data?.intent === 'modification') {
        const target = String(parsed?.data?.modificationTarget || '');
        const taskId = parsed?.data?.taskId || '';
        if (taskId === 'task1' && (target.includes('企业基本信息') || target.includes('基本信息') || !target)) return '确认';
        return '修正';
      }
      if (parsed?.type === 'intentExtractionCard' && (parsed?.data?.intent === 'query' || parsed?.data?.intent === 'execute')) return '上下文';
      if (c.speaker === '系统提炼') return '讨论';
      if (parsed?.type === 'valueStreamConfirmLog') return '确认';
      if (parsed?.type === 'itStatusOutputLog') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'e2eFlowJsonBlock') {
        const hasPayload =
          (parsed?.transactionFlowJson != null && typeof parsed.transactionFlowJson === 'object') ||
          parsed?.valueStreamJson != null;
        return hasPayload && parsed?.confirmed ? '确认' : '输出';
      }
      if (parsed?.type === 'localItGapInputBlock') return '输入';
      if (parsed?.type === 'localItGapOutputBlock') return '输出';
      if (parsed?.type === 'localItGapAnalysisCard') return (parsed?.analysisJson != null && parsed?.confirmed) ? '确认' : '输出';
      if (parsed?.type === 'localItGapAllDoneConfirmBlock') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'localItGapTaskCompleteConfirmBlock') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'localItGapCompressionIntentBlock') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'roleTaskCenterDesignIntentBlock') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'rolePermissionAuditIntentBlock') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'rolePermissionAuditResultBlock') return parsed?.modificationExtractUsed ? '确认' : '输出';
      if (parsed?.type === 'localItGapCompressionBlock') return 'LLM-压缩';
      if (parsed?.type === 'globalItGapCompressionBlock') return 'LLM-压缩';
      if (parsed?.type === 'e2eFlowCompressionBlock') return 'LLM-压缩';
      if (parsed?.type === 'localItGapSessionsBlock') return '确认';
      if (parsed?.type === 'e2eTransactionFlowSessionsBlock') return '确认';
      if (parsed?.type === 'e2ePrelimFvsCompletenessSessionsBlock') return '确认';
      if (parsed?.type === 'e2ePrelimFvsCompletenessAllDoneConfirmBlock') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'rolePermissionSessionsBlock') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'coreBusinessObjectSessionsBlock') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'coreBusinessObjectAnalysisCard') return parsed?.confirmed ? '确认' : '输出';
      if (parsed?.type === 'coreBusinessObjectAllDoneBlock') return parsed?.allConfirmed ? '确认' : '输出';
      if (parsed?.type === 'coreBusinessObjectGlobalAuditIntentBlock') return parsed?.confirmed ? '确认' : '输出';
      if (['basicInfoCard', 'bmcCard', 'requirementLogicBlock', 'valueStreamCard', 'itStatusCard'].includes(parsed?.type)) {
        return parsed?.data && parsed?.confirmed !== false ? '确认' : '输出';
      }
    } catch (_) {}
    return '确认';
  }

  const LOG_TYPE_CLASS = {
    输入: 'input',
    输出: 'output',
    确认: 'confirm',
    修正: 'modify',
    讨论: 'discuss',
    用户讨论: 'discuss',
    上下文: 'context',
    任务完成: 'complete',
    不满意: 'unsatisfied',
    压缩: 'compress',
    'LLM-压缩': 'llm-compress',
    'LLM-查询': 'llm-query',
    'LLM-审计': 'llm-query',
    'LLM-修改': 'llm-query',
    修改动作: 'modify',
    任务Skill: 'context',
    审计Skill: 'context',
  };
  const INTENT_LABELS = { query: '简单查询', modification: '反馈修改意见', execute: '执行操作', discussion: '讨论请教' };

  /** 在重新渲染前采集当前展开状态，刷新后恢复，避免沟通历史面板更新时折叠已展开的任务/时间线 */
  function captureHistoryExpandedState(container) {
    const state = {};
    if (!container) return state;
    container.querySelectorAll('.problem-detail-history-task-root').forEach((root) => {
      const taskId = root.getAttribute('data-task-id');
      if (!taskId) return;
      const children = root.querySelector('.problem-detail-history-task-children');
      const taskNode = root.querySelector('.problem-detail-history-task-node');
      const expanded = children && !children.hidden;
      let activeTab = 'detail';
      const activeTabEl = root.querySelector('.problem-detail-history-tab.problem-detail-history-tab-active');
      if (activeTabEl) activeTab = activeTabEl.getAttribute('data-tab') || 'detail';
      const expandedTimelineIndices = [];
      const expandedSkillIndices = [];
      const expandedAuditSkillIndices = [];
      if (expanded && activeTab === 'log') {
        root.querySelectorAll('.problem-detail-history-timeline-node').forEach((node) => {
          const idx = node.getAttribute('data-index');
          const detail = node.querySelector('.problem-detail-history-timeline-detail');
          if (detail && !detail.hidden && idx != null) expandedTimelineIndices.push(parseInt(idx, 10));
        });
      }
      if (expanded && activeTab === 'skill') {
        root.querySelectorAll('.problem-detail-history-skill-node').forEach((node) => {
          const idx = node.getAttribute('data-index');
          const detail = node.querySelector('.problem-detail-history-skill-detail');
          if (detail && !detail.hidden && idx != null) expandedSkillIndices.push(parseInt(idx, 10));
        });
      }
      if (expanded && activeTab === 'audit-skill') {
        const auditPanel = root.querySelector('.problem-detail-history-tab-panel[data-tab="audit-skill"]');
        auditPanel?.querySelectorAll('.problem-detail-history-skill-node').forEach((node) => {
          const idx = node.getAttribute('data-index');
          const detail = node.querySelector('.problem-detail-history-skill-detail');
          if (detail && !detail.hidden && idx != null) expandedAuditSkillIndices.push(parseInt(idx, 10));
        });
      }
      state[taskId] = { expanded, activeTab, expandedTimelineIndices, expandedSkillIndices, expandedAuditSkillIndices };
    });
    return state;
  }

  /** 根据采集的展开状态恢复 UI */
  function restoreHistoryExpandedState(container, state) {
    if (!container || !state || typeof state !== 'object') return;
    Object.keys(state).forEach((taskId) => {
      const s = state[taskId];
      if (!s) return;
      const root = container.querySelector(`.problem-detail-history-task-root[data-task-id="${taskId}"]`);
      if (!root) return;
      const children = root.querySelector('.problem-detail-history-task-children');
      const taskNode = root.querySelector('.problem-detail-history-task-node');
      if (s.expanded && children && taskNode) {
        children.hidden = false;
        taskNode.classList.add('expanded');
      }
      if ((s.activeTab === 'log' || s.activeTab === 'skill' || s.activeTab === 'audit-skill') && children) {
        const tabs = children.querySelector('.problem-detail-history-task-tabs');
        if (tabs) {
          tabs.querySelectorAll('.problem-detail-history-tab').forEach((t) => {
            const tabKey = t.getAttribute('data-tab');
            const isActive = tabKey === s.activeTab;
            t.classList.toggle('problem-detail-history-tab-active', isActive);
            t.setAttribute('aria-selected', String(isActive));
          });
          children.querySelectorAll('.problem-detail-history-tab-panel').forEach((p) => {
            p.hidden = p.getAttribute('data-tab') !== s.activeTab;
          });
        }
      }
      if (s.expandedTimelineIndices && s.expandedTimelineIndices.length > 0) {
        root.querySelectorAll('.problem-detail-history-timeline-node').forEach((node) => {
          const idx = parseInt(node.getAttribute('data-index'), 10);
          if (!s.expandedTimelineIndices.includes(idx)) return;
          const detail = node.querySelector('.problem-detail-history-timeline-detail');
          const head = node.querySelector('.problem-detail-history-timeline-head');
          const expandSpan = node.querySelector('.problem-detail-history-timeline-expand');
          if (detail) detail.hidden = false;
          if (head) {
            head.classList.add('expanded');
            head.setAttribute('aria-expanded', 'true');
          }
          if (expandSpan) expandSpan.classList.add('expanded');
        });
      }
      if (s.expandedSkillIndices && s.expandedSkillIndices.length > 0) {
        const skillPanel = root.querySelector('.problem-detail-history-tab-panel[data-tab="skill"]');
        skillPanel?.querySelectorAll('.problem-detail-history-skill-node').forEach((node) => {
          const idx = parseInt(node.getAttribute('data-index'), 10);
          if (!s.expandedSkillIndices.includes(idx)) return;
          const detail = node.querySelector('.problem-detail-history-skill-detail');
          const head = node.querySelector('.problem-detail-history-skill-head');
          const expandSpan = node.querySelector('.problem-detail-history-timeline-expand');
          if (detail) detail.hidden = false;
          if (head) {
            head.classList.add('expanded');
            head.setAttribute('aria-expanded', 'true');
          }
          if (expandSpan) expandSpan.classList.add('expanded');
        });
      }
      if (s.expandedAuditSkillIndices && s.expandedAuditSkillIndices.length > 0) {
        const auditPanel = root.querySelector('.problem-detail-history-tab-panel[data-tab="audit-skill"]');
        auditPanel?.querySelectorAll('.problem-detail-history-skill-node').forEach((node) => {
          const idx = parseInt(node.getAttribute('data-index'), 10);
          if (!s.expandedAuditSkillIndices.includes(idx)) return;
          const detail = node.querySelector('.problem-detail-history-skill-detail');
          const head = node.querySelector('.problem-detail-history-skill-head');
          const expandSpan = node.querySelector('.problem-detail-history-timeline-expand');
          if (detail) detail.hidden = false;
          if (head) {
            head.classList.add('expanded');
            head.setAttribute('aria-expanded', 'true');
          }
          if (expandSpan) expandSpan.classList.add('expanded');
        });
      }
    });
  }

  /** 渲染沟通历史面板：任务详情/过程日志双 Tab、时间线及日志类型标签。deps: { item, getChatsForProblem, getTaskStatusText } */
  function renderProblemDetailHistory(container, deps) {
    if (!container) return;
    const expandedState = captureHistoryExpandedState(container);
    const item = deps?.item;
    const getChatsForProblem = deps?.getChatsForProblem;
    const getTaskStatusText = deps?.getTaskStatusText;
    const createdAt = item?.createdAt;
    const getTaskTrackingData = typeof global.getTaskTrackingData === 'function' ? global.getTaskTrackingData : () => ({});
    const getProblemDetailTaskSummaries = typeof global.getProblemDetailTaskSummaries === 'function' ? global.getProblemDetailTaskSummaries : () => ({});
    const trackingData = createdAt ? (getTaskTrackingData()[createdAt] || {}) : {};
    const taskSummaryMap = buildTaskSummaryMap(getProblemDetailTaskSummaries(), createdAt);
    const allChatsRaw = createdAt && getChatsForProblem ? getChatsForProblem(createdAt) : [];
    const communications = createdAt && getChatsForProblem ? getCommunicationsByTask(createdAt, allChatsRaw) : {};
    const allHistoryTasks = [...FOLLOW_TASKS, ...ITGAP_HISTORY_TASKS, ...IT_STRATEGY_TASKS];
    const totals = { tokens: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 };
    const taskListHtml = allHistoryTasks.map((task) => {
      const taskData = { ...(trackingData[task.id] || {}), ...(taskSummaryMap[task.id] || {}) };
      const objective = (taskData.objective ?? task.objective) || '—';
      const evaluationCriteria = (taskData.evaluationCriteria ?? task.evaluationCriteria) || '—';
      const extra = TASK_EXTRA_FIELDS[task.id] || {};
      const inputDesc = extra.input || '—';
      const actionDesc = extra.action || '—';
      const outputDesc = extra.outputFeedback || '—';
      const taskStatusText = typeof getTaskStatusText === 'function' ? getTaskStatusText(item, task.id, allHistoryTasks, getChatsForProblem && createdAt ? getChatsForProblem(createdAt) : null) : '—';
      const comms = (communications[task.id] || []).slice().sort((a, b) => {
        const ta = (a.time && new Date(a.time).getTime()) || 0;
        const tb = (b.time && new Date(b.time).getTime()) || 0;
        return ta - tb;
      });
      const commCount = comms.length;
      const taskTotals = { tokens: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 };
      const timelineHtml = comms.length === 0
        ? '<p class="problem-detail-history-comm-empty">暂无沟通记录</p>'
        : comms.map((c, i) => {
            const timeStr = c.time ? formatChatTime(c.time) : '—';
            const logType = getCommunicationLogType(c);
            let contentStr = typeof c.content === 'object' ? JSON.stringify(c.content, null, 2) : c.content;
            let contentHtml = '';
            let titleLabel = c.speaker;
            let stepNameForHead = '';
            let contextNoteForHead = '';
            let sessionPlanNoteForHead = '';
            let confirmTagForHead = '';
            try {
              const parsed = typeof c.content === 'string' ? JSON.parse(c.content) : c.content;
              if (parsed?.role === 'user') {
                titleLabel = parsed?._logType === 'bmcDiscussionUser' ? '用户讨论' : (parsed?._logType === 'modify' ? '用户修正意见' : '用户输入');
                contentStr = (parsed?.content != null ? String(parsed.content).trim() : '') || '(空)';
              } else if (parsed?.type === 'task1LlmQueryBlock' || parsed?.type === 'task2LlmQueryBlock' || parsed?.type === 'bmcDiscussionLlmQueryBlock' || parsed?.type === 'task3LlmQueryBlock' || parsed?.type === 'task4LlmQueryBlock' || parsed?.type === 'task5LlmQueryBlock' || parsed?.type === 'task6LlmQueryBlock' || parsed?.type === 'task7LlmQueryBlock' || parsed?.type === 'task8LlmQueryBlock' || parsed?.type === 'task9LlmQueryBlock' || parsed?.type === 'task10LlmQueryBlock' || parsed?.type === 'task11LlmQueryBlock' || parsed?.type === 'task11GlobalSkeletonAuditLlmQueryBlock' || parsed?.type === 'task11CoreBusinessObjectAuditLlmQueryBlock' || parsed?.type === 'rolePermissionAuditLlmQueryBlock' || parsed?.type === 'rolePermissionModificationLlmQueryBlock' || parsed?.type === 'modificationPromptRevisionLlmQueryBlock' || parsed?.type === 'modificationRegenerateLlmQueryBlock' || parsed?.type === 'rolePermissionCard' || parsed?.type === 'rolePermissionAnalysisCard') {
                const isTask11GlobalSkeletonAudit = parsed?.type === 'task11GlobalSkeletonAuditLlmQueryBlock';
                const isRolePermissionComplianceAudit = parsed?.type === 'rolePermissionAuditLlmQueryBlock';
                const isRolePermissionModify = parsed?.type === 'rolePermissionModificationLlmQueryBlock';
                const isTask5Modify =
                  parsed?.type === 'modificationRegenerateLlmQueryBlock' && parsed?.taskId === 'task5';
                const isTask1PrelimRefine =
                  parsed?.type === 'modificationRegenerateLlmQueryBlock' && parsed?.taskId === 'task1';
                const isTask4VsModify =
                  parsed?.type === 'modificationRegenerateLlmQueryBlock' && parsed?.taskId === 'task4';
                titleLabel = (isRolePermissionModify || isTask5Modify || isTask1PrelimRefine || isTask4VsModify)
                  ? 'LLM-修改'
                  : (isTask11GlobalSkeletonAudit || isRolePermissionComplianceAudit ? 'LLM-审计' : 'LLM-查询');
                if (isTask11GlobalSkeletonAudit) {
                  stepNameForHead = parsed?.noteName ? String(parsed.noteName) : '全局对象骨架审计';
                } else if (isRolePermissionComplianceAudit) {
                  stepNameForHead = parsed?.noteName ? String(parsed.noteName) : '角色与权限合规审计';
                } else if (isRolePermissionModify) {
                  stepNameForHead = parsed?.noteName ? String(parsed.noteName) : (parsed?.stepName ? `重新生成：${parsed.stepName}` : '重新生成');
                } else if (parsed?.type === 'modificationPromptRevisionLlmQueryBlock') {
                  stepNameForHead = parsed?.noteName ? String(parsed.noteName) : '修改·新提示词生成';
                } else if (parsed?.type === 'modificationRegenerateLlmQueryBlock') {
                  stepNameForHead = parsed?.noteName
                    ? String(parsed.noteName)
                    : (parsed?.taskId === 'task5' ? 'IT现状按新提示词重新生成' : '修改·按新提示词重新生成');
                } else if (parsed?.type === 'rolePermissionAnalysisCard') {
                  stepNameForHead = parsed?.stepName ? String(parsed.stepName) : `环节${(parsed?.stepIndex ?? 0) + 1}`;
                } else if (parsed?.type === 'rolePermissionCard') {
                  stepNameForHead = parsed?.noteName ? String(parsed.noteName) : '角色与权限模型推演（整模型）';
                } else {
                  stepNameForHead = (parsed?.type === 'task5LlmQueryBlock' || parsed?.type === 'task6LlmQueryBlock' || parsed?.type === 'task7LlmQueryBlock' || parsed?.type === 'task9LlmQueryBlock' || parsed?.type === 'task10LlmQueryBlock' || parsed?.type === 'task11LlmQueryBlock')
                    ? (parsed?.type === 'task5LlmQueryBlock'
                      ? (parsed?.stepName ? String(parsed.stepName) : parsed?.noteName ? String(parsed.noteName) : 'IT 现状标注')
                      : parsed?.type === 'task7LlmQueryBlock'
                        ? (() => {
                            const nn7 = String(parsed?.noteName || '');
                            const sn7 =
                              parsed?.stepName != null && String(parsed.stepName).trim() !== ''
                                ? String(parsed.stepName).trim()
                                : '';
                            if (nn7 === '业务流程完整性补齐' && sn7) return `补齐：${sn7}`;
                            if (sn7) return sn7;
                            if (parsed?.noteName) return String(parsed.noteName);
                            return '事务流分阶段生成';
                          })()
                        : parsed?.stepName
                          ? String(parsed.stepName)
                          : parsed?.noteName
                            ? String(parsed.noteName)
                            : (parsed?.type === 'task9LlmQueryBlock'
                              ? '对象状态机构建'
                              : parsed?.type === 'task10LlmQueryBlock'
                                ? '角色与权限模型推演'
                                : parsed?.type === 'task11LlmQueryBlock'
                                  ? '核心业务对象推演'
                                  : '痛点标注'))
                    : (parsed?.type === 'task8LlmQueryBlock'
                      ? (() => {
                          const nn = String(parsed?.noteName || '');
                          const sn =
                            parsed?.stepName != null && String(parsed.stepName).trim() !== ''
                              ? String(parsed.stepName).trim()
                              : '';
                          if (nn === 'BPM流程绘制' && sn) return `绘制：${sn}`;
                          if (nn === 'IT设计补齐' && sn) return `设计：${sn}`;
                          if (sn) return sn;
                          if (parsed?.noteName) return String(parsed.noteName);
                          return 'IT设计补齐';
                        })()
                      : (parsed?.noteName ? String(parsed.noteName) : (parsed?.type === 'task4LlmQueryBlock' ? '价值流图生成' : parsed?.type === 'task3LlmQueryBlock' ? '需求逻辑提炼' : parsed?.type === 'task2LlmQueryBlock' ? '商业画布提炼' : '工商信息提炼')));
                }
                if (parsed?.confirmed === true) confirmTagForHead = '<span class="problem-detail-history-log-type-tag problem-detail-history-log-type-confirm">确认</span>';
                const rawLlmInput = parsed?.llmInputPrompt ?? parsed?.llmMeta?.inputPromptSnapshot;
                const hasPromptTokens = (parsed?.llmMeta?.usage?.prompt_tokens ?? 0) > 0;
                const fallbackRequirementDetail = (() => {
                  if (parsed?.type !== 'task1LlmQueryBlock') return '';
                  const out = parsed?.llmOutputJson;
                  const detail = out && typeof out === 'object'
                    ? (out.requirementDetail ?? out.requirement_detail ?? '')
                    : '';
                  const s = detail != null ? String(detail).trim() : '';
                  if (!s) return '';
                  return `【system】\n数字化需求分析助手（历史回填）\n\n【user】\n${s}`;
                })();
                const inputStr =
                  rawLlmInput != null && String(rawLlmInput).trim() !== ''
                    ? String(rawLlmInput)
                    : fallbackRequirementDetail
                      ? fallbackRequirementDetail
                    : hasPromptTokens
                      ? '（历史数据，输入内容未保存）'
                      : '(无)';
                if (parsed?.type === 'task1LlmQueryBlock' && shouldLogTask1InputRender()) {
                  try {
                    console.debug('[FE:task1-prelim-llm]', 'history-render-input', {
                      hasRawLlmInput: !!(rawLlmInput != null && String(rawLlmInput).trim() !== ''),
                      rawLlmInputLen: rawLlmInput != null ? String(rawLlmInput).length : 0,
                      hasFallbackRequirementDetail: !!fallbackRequirementDetail,
                      finalInputLen: inputStr ? String(inputStr).length : 0,
                      finalInputPreview: inputStr ? String(inputStr).slice(0, 160) : '',
                    });
                  } catch (_) {}
                }
                const outputObj = parsed?.llmOutputJson;
                let outputStr = outputObj != null
                  ? (typeof outputObj === 'string' ? outputObj : JSON.stringify(outputObj, null, 2))
                  : ((parsed?.llmOutputRaw != null && String(parsed.llmOutputRaw).trim()) ? String(parsed.llmOutputRaw) : '(无)');
                if ((parsed?.type === 'rolePermissionCard' || parsed?.type === 'rolePermissionAnalysisCard') && outputStr === '(无)' && parsed?.content != null) {
                  outputStr = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content, null, 2);
                }
                const tokenPair = resolveTokenPair(parsed?.llmMeta?.usage, inputStr, outputStr);
                const mainPromptTokens = tokenPair.promptTokens;
                const mainCompletionTokens = tokenPair.completionTokens;
                contentHtml = buildHistoryLlmQuerySubcardsHtml(inputStr, outputStr, mainPromptTokens, mainCompletionTokens);
                if (isRolePermissionModify || isTask5Modify || isTask1PrelimRefine || isTask4VsModify) {
                  const diffMd = isRolePermissionModify
                    ? (String(parsed?.modificationDiffMarkdown || '').trim() || '（未生成修改说明）')
                    : (String(parsed?.modificationActionMarkdown || '').trim() || '（未生成修改动作说明）');
                  const diffTitle = isRolePermissionModify ? '修改内容' : '修改动作';
                  contentHtml += `
                    <div class="problem-detail-history-skill-subcard problem-detail-history-node-card-shell">
                      ${HISTORY_NODE_COPY_BUTTON_HTML}
                      <div class="problem-detail-history-node-card-inner">
                        <div class="problem-detail-history-skill-subcard-title">${diffTitle}</div>
                        <div class="problem-detail-history-skill-subcard-body markdown-body">${renderMarkdown(diffMd)}</div>
                      </div>
                    </div>
                  `;
                }
              } else if (parsed?.type === 'basicInfoCard') {
                titleLabel = parsed?.confirmed ? '客户基本信息（已确认）' : '客户基本信息（大模型输出）';
                contentStr = parsed?.data != null ? JSON.stringify(parsed.data, null, 2) : (contentStr || '(空)');
              } else if (parsed?.type === 'bmcCard') {
                titleLabel = parsed?.confirmed ? 'BMC（已确认）' : 'BMC（大模型输出）';
                contentStr = parsed?.data != null ? JSON.stringify(parsed.data, null, 2) : (contentStr || '(空)');
              } else if (parsed?.type === 'requirementLogicBlock') {
                titleLabel = parsed?.confirmed ? '需求逻辑（已确认）' : '需求逻辑（大模型输出）';
                contentStr = parsed?.data != null ? JSON.stringify(parsed.data, null, 2) : (parsed?.content != null ? String(parsed.content) : '(空)');
              } else if (parsed?.type === 'valueStreamCard') {
                titleLabel = parsed?.confirmed ? '价值流图（已确认）' : '价值流图（大模型输出）';
                contentStr = parsed?.data != null ? JSON.stringify(parsed.data, null, 2) : (contentStr || '(空)');
              } else if (parsed?.type === 'valueStreamConfirmLog') {
                titleLabel = '确认';
                contentStr = parsed?.data != null ? JSON.stringify(parsed.data, null, 2) : '(空)';
              } else if (parsed?.type === 'itStatusOutputLog') {
                titleLabel = 'IT 现状标注（阶段名-环节名-IT 现状）';
                contentStr = (typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content || [], null, 2)) || '(空)';
              } else if (parsed?.type === 'intentExtractionCard' && parsed?.data?.intent != null) {
                const intentLabel = INTENT_LABELS[parsed.data.intent] || parsed.data.intent || '—';
                titleLabel = `用户意图提炼：${intentLabel}`;
              } else if (parsed?.type === 'e2eFlowExtractStartBlock') {
                titleLabel = parsed.content || '我先需要提取端到端事务流的 json 数据';
              } else if (parsed?.type === 'e2eBusinessFlowIntentBlock') {
                titleLabel = parsed.content || '将基于价值流生成事务流';
              } else if (parsed?.type === 'e2eTransactionFlowLlmPromptBlock') {
                titleLabel = parsed.content || '事务流生成 · 调用前完整提示词';
                contentStr =
                  parsed.promptFullText != null ? String(parsed.promptFullText) : contentStr || '(空)';
              } else if (parsed?.type === 'e2eBusinessFlowLlmStartBlock') {
                titleLabel = parsed.content || '正在基于价值流生成业务事务流 JSON';
              } else if (parsed?.type === 'e2eFlowJsonBlock') {
                const isBpm = parsed?.transactionFlowJson != null && typeof parsed.transactionFlowJson === 'object';
                titleLabel = isBpm
                  ? parsed?.confirmed
                    ? '业务事务流 JSON（BPM）（已确认）'
                    : '业务事务流 JSON（BPM）'
                  : parsed?.confirmed
                    ? '端到端事务流 JSON 数据（已确认）'
                    : '端到端事务流 JSON 数据';
                if (isBpm && parsed.transactionFlowJson) {
                  contentStr = '【业务事务流 JSON】\n' + JSON.stringify(parsed.transactionFlowJson, null, 2);
                } else if (parsed.valueStreamJson) {
                  contentStr = '【端到端事务流 JSON 数据】\n' + JSON.stringify(parsed.valueStreamJson, null, 2);
                }
              } else if (parsed?.type === 'e2eFlowGeneratedLog') {
                titleLabel = parsed.content || '已生成端到端事务流 JSON 数据';
                if (parsed.valueStreamJson) {
                  contentStr = parsed.content + '\n\n【端到端事务流 JSON 数据】\n' + JSON.stringify(parsed.valueStreamJson, null, 2);
                }
              } else if (parsed?.type === 'globalItGapPhasePlanBlock') {
                sessionPlanNoteForHead = '四阶段计划';
                titleLabel = 'IT设计补齐·四阶段计划';
                if (parsed?.confirmed === true) confirmTagForHead = '<span class="problem-detail-history-log-type-tag problem-detail-history-log-type-confirm">确认</span>';
                contentStr = Array.isArray(parsed.phases)
                  ? parsed.phases.map((p) => (p && p.stepName) || '').filter(Boolean).join('\n')
                  : '(无)';
              } else if (parsed?.type === 'itDesignSupplementSessionsBlock') {
                sessionPlanNoteForHead = '事务流计划';
                titleLabel = 'IT设计补齐·事务流 Session 计划';
                if (parsed?.confirmed === true) confirmTagForHead = '<span class="problem-detail-history-log-type-tag problem-detail-history-log-type-confirm">确认</span>';
                const arr = Array.isArray(parsed.sessions) ? parsed.sessions : [];
                contentStr =
                  arr.length > 0
                    ? arr
                        .map((s) => {
                          const nm = s.transactionName || s.transactionId || '—';
                          const d = s.designOutputJson != null ? '设计✓' : '设计待执行';
                          const b =
                            s.bpmFlowDrawMarkdown != null && String(s.bpmFlowDrawMarkdown).trim()
                              ? 'BPM✓'
                              : 'BPM待执行';
                          return `${nm}：${d}；${b}`;
                        })
                        .join('\n')
                    : '(无)';
              } else if (parsed?.type === 'itDesignBpmDrawSessionsBlock') {
                sessionPlanNoteForHead = 'BPM绘制计划';
                titleLabel = 'IT设计补齐·BPM 流程绘制 Session 计划';
                const arr = Array.isArray(parsed.sessions) ? parsed.sessions : [];
                contentStr =
                  arr.length > 0
                    ? arr
                        .map((s) => {
                          const nm = s.transactionName || s.transactionId || '—';
                          if (s.designOutputJson == null) return `${nm} (无设计产出)`;
                          return `${nm} (${s.bpmFlowDrawMarkdown != null && String(s.bpmFlowDrawMarkdown).trim() ? '已绘制' : '待绘制'})`;
                        })
                        .join('\n')
                    : '(无)';
              } else if (parsed?.type === 'itDesignSupplementAllDoneConfirmBlock') {
                titleLabel = parsed.content || 'IT设计补齐·全部确认';
                if (parsed?.confirmed === true) confirmTagForHead = '<span class="problem-detail-history-log-type-tag problem-detail-history-log-type-confirm">确认</span>';
              } else if (parsed?.type === 'globalItGapStartBlock') {
                titleLabel = parsed.content || '即将针对端到端事务流开展 IT设计补齐';
              } else if (parsed?.type === 'globalItGapAnalysisCard') {
                titleLabel = 'IT设计补齐';
                if (parsed.analysisJson) {
                  contentStr = '【IT设计补齐 JSON】\n' + JSON.stringify(parsed.analysisJson, null, 2);
                }
              } else if (parsed?.type === 'globalItGapAnalysisLog') {
                titleLabel = parsed.content || '已生成 IT设计补齐 成果';
                if (parsed.analysisJson) {
                  contentStr = (parsed.content || '') + '\n\n【IT设计补齐 JSON】\n' + JSON.stringify(parsed.analysisJson, null, 2);
                }
              } else if (parsed?.type === 'rolePermissionSessionsBlock') {
                titleLabel = parsed?.confirmed ? '角色与权限模型推演 Session（已确认）' : '角色与权限模型推演 Session';
                contentStr = parsed.sessions != null ? JSON.stringify(parsed.sessions, null, 2) : '(无)';
              } else if (parsed?.type === 'rolePermissionConfirmedLog') {
                titleLabel = parsed.content || '已确认角色与权限模型推演';
                if (parsed.rolePermissionModelJson) {
                  contentStr = (parsed.content || '') + '\n\n【角色与权限模型推演 JSON】\n' + JSON.stringify(parsed.rolePermissionModelJson, null, 2);
                }
              } else if (parsed?.type === 'taskContextBlock') {
                titleLabel = '任务上下文';
                contextNoteForHead = parsed?.contextLabel || (parsed?.taskId === 'task2' ? '客户基本信息 json' : '');
                contentStr = parsed.contextJson != null ? JSON.stringify(parsed.contextJson, null, 2) : '(无)';
              } else if (parsed?.type === 'globalItGapContextLog') {
                titleLabel = '上下文';
                contentStr = parsed.contextJson != null ? JSON.stringify(parsed.contextJson, null, 2) : '(无)';
              } else if (parsed?.type === 'localItGapContextLog') {
                contextNoteForHead = '价值流+IT设计补齐';
                titleLabel = '上下文（价值流+IT设计补齐）';
                contentStr = '(无)';
              } else if (parsed?.type === 'localItGapContextBlock') {
                contextNoteForHead = parsed?.contextLabel || '';
                titleLabel = parsed?.contextLabel ? `上下文（${parsed.contextLabel}）` : '上下文';
                contentStr = parsed?.contextJson != null ? JSON.stringify(parsed.contextJson, null, 2) : '(无)';
              } else if (parsed?.type === 'coreBusinessObjectContextBlock') {
                contextNoteForHead = parsed?.contextLabel || '';
                titleLabel = parsed?.contextLabel ? `上下文（${parsed.contextLabel}）` : '上下文';
                contentStr = parsed.contextJson != null ? JSON.stringify(parsed.contextJson, null, 2) : '(无)';
              } else if (parsed?.type === 'globalArchitectureContextBlock') {
                contextNoteForHead = parsed?.contextLabel || '';
                titleLabel = parsed?.contextLabel ? `上下文（${parsed.contextLabel}）` : '上下文';
                contentStr = parsed.contextJson != null ? JSON.stringify(parsed.contextJson, null, 2) : '(无)';
              } else if (parsed?.type === 'coreBusinessObjectGlobalAuditIntentBlock') {
                titleLabel = parsed?.confirmed ? '全局对象骨架审计（已确认）' : '全局对象骨架审计（待确认）';
                contentStr = (parsed?.content && String(parsed.content).trim()) || '我即将开始对生成的对象骨架进行全局审计';
              } else if (parsed?.type === 'coreBusinessObjectSessionsBlock') {
                sessionPlanNoteForHead = '核心业务对象推演 session 计划';
                titleLabel = '核心业务对象推演 session 计划';
                contentStr = parsed.sessions != null ? JSON.stringify(parsed.sessions, null, 2) : '(无)';
              } else if (parsed?.type === 'coreBusinessObjectAnalysisCard') {
                const stepNameCbo = parsed?.stepName || `环节${(parsed?.stepIndex ?? 0) + 1}`;
                stepNameForHead = stepNameCbo;
                titleLabel = parsed?.confirmed ? `核心业务对象推演（${stepNameCbo}）（已确认）` : `核心业务对象推演（${stepNameCbo}）`;
                contentStr = parsed.content != null ? (typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content, null, 2)) : '(无)';
              } else if (parsed?.type === 'coreBusinessObjectAllDoneBlock') {
                titleLabel = parsed?.allConfirmed ? '核心业务对象推演全部确认' : '核心业务对象推演全部结束';
                contentStr = (parsed?.content && String(parsed.content).trim()) || '所有环节的核心业务对象推演已经结束，是否全部确认？';
              } else if (parsed?.type === 'e2eTransactionFlowSessionsBlock') {
                sessionPlanNoteForHead = '事务流分阶段';
                titleLabel = '生成事务流 Session 计划';
                const arr = Array.isArray(parsed.sessions) ? parsed.sessions : [];
                contentStr =
                  `已为 ${arr.length} 个价值流阶段生成 session。\n` +
                  arr
                    .map(
                      (s, i) =>
                        `${i + 1}. ${s?.stageName || `阶段${i + 1}`} — ${s?.transactionNodesJson ? '已生成' : '待生成'}`,
                    )
                    .join('\n');
              } else if (parsed?.type === 'e2ePrelimFvsCompletenessSessionsBlock') {
                sessionPlanNoteForHead = '业务流程完整性';
                titleLabel = '校验流程完整性 Session 计划';
                const arrC = Array.isArray(parsed.sessions) ? parsed.sessions : [];
                contentStr =
                  `已按 ${arrC.length} 个初步需求类目生成 session。\n` +
                  arrC
                    .map(
                      (s, i) =>
                        `${i + 1}. ${s?.stageName || s?.domainLabel || `类目${i + 1}`} — ${s?.transactionNodesJson ? '已校验' : '待校验'}`,
                    )
                    .join('\n');
              } else if (parsed?.type === 'e2ePrelimFvsCompletenessAllDoneConfirmBlock') {
                titleLabel = parsed.content || '所有端到端事务流补齐已完成。';
                if (parsed?.confirmed === true) confirmTagForHead = '<span class="problem-detail-history-log-type-tag problem-detail-history-log-type-confirm">确认</span>';
              } else if (parsed?.type === 'localItGapSessionsBlock') {
                sessionPlanNoteForHead = 'ITGap 分析 session 计划';
                titleLabel = 'ITGap 分析 session 计划';
                contentStr = parsed.sessions != null ? JSON.stringify(parsed.sessions, null, 2) : '(无)';
              } else if (parsed?.type === 'localItGapInputBlock') {
                stepNameForHead = parsed?.stepName || `环节${(parsed?.stepIndex ?? 0) + 1}`;
                titleLabel = `输入（${stepNameForHead}）`;
                contentStr = parsed?.fullInput && typeof parsed.fullInput === 'object'
                  ? JSON.stringify(parsed.fullInput, null, 2)
                  : ((parsed?.prompt && String(parsed.prompt).trim()) || '(无)');
              } else if (parsed?.type === 'localItGapOutputBlock') {
                stepNameForHead = parsed?.stepName || `环节${(parsed?.stepIndex ?? 0) + 1}`;
                titleLabel = `输出（${stepNameForHead}）`;
                contentStr = '(环节分析结果见下方分析卡片)';
              } else if (parsed?.type === 'localItGapAnalysisCard') {
                stepNameForHead = parsed?.stepName || '环节';
                titleLabel = parsed?.confirmed ? `对象状态机构建（${stepNameForHead}）（已确认）` : `对象状态机构建（${stepNameForHead}）`;
                contentStr = parsed.analysisJson != null ? JSON.stringify(parsed.analysisJson, null, 2) : '(无)';
              } else if (parsed?.type === 'localItGapAnalysisLog') {
                stepNameForHead = parsed?.stepName || '环节';
                titleLabel = parsed.content || `对象状态机构建（${stepNameForHead}）`;
                contentStr = parsed.analysisJson != null ? JSON.stringify(parsed.analysisJson, null, 2) : (parsed.content || '(无)');
              } else if (parsed?.type === 'localItGapAllDoneConfirmBlock') {
                titleLabel = parsed?.confirmed ? '已确认所有环节输出' : '是否自动确认所有输出';
                contentStr = (parsed?.content && String(parsed.content).trim()) || '已经完成所有环节输出，是否自动确认所有输出？';
              } else if (parsed?.type === 'localItGapTaskCompleteConfirmBlock') {
                titleLabel = parsed?.confirmed ? '已确认任务完成' : '是否确认任务已经完成';
                contentStr = (parsed?.content && String(parsed.content).trim()) || '是否确认对象状态机构建任务已经完成？';
              } else if (parsed?.type === 'localItGapCompressionIntentBlock') {
                titleLabel = parsed?.confirmed ? '对象状态机构建压缩（已确认）' : '对象状态机构建压缩';
                contentStr = (parsed?.content && String(parsed.content).trim()) || '我即将开始对对象状态机构建做上下文压缩，便于后续环节的处理。';
              } else if (parsed?.type === 'roleTaskCenterDesignIntentBlock') {
                titleLabel = parsed?.confirmed ? '对象状态机构建（已确认）' : '对象状态机构建';
                contentStr =
                  (parsed?.content && String(parsed.content).trim()) ||
                  '我将开始对象状态机构建：请确认任务启动；工作区与编排将随版本迭代接入。';
              } else if (parsed?.type === 'rolePermissionAuditIntentBlock') {
                titleLabel = parsed?.auditSkippedByUser
                  ? '角色与权限合规审计（已跳过）'
                  : parsed?.confirmed
                    ? '角色与权限合规审计（已确认）'
                    : '角色与权限合规审计';
                contentStr = (parsed?.content && String(parsed.content).trim()) || '我即将对角色与权限推演结果进行审计';
              } else if (parsed?.type === 'rolePermissionAuditResultBlock') {
                titleLabel = parsed?.modificationExtractUsed ? '角色与权限合规审计意见（已提炼修改意见）' : '角色与权限合规审计意见';
                contentStr = (parsed?.auditOpinionRaw != null && String(parsed.auditOpinionRaw).trim())
                  ? String(parsed.auditOpinionRaw)
                  : ((parsed?.content && String(parsed.content).trim()) || '(无)');
              } else if (parsed?.type === 'localItGapCompressionBlock' || parsed?.type === 'globalItGapCompressionBlock' || parsed?.type === 'e2eFlowCompressionBlock') {
                titleLabel = 'LLM-压缩';
                stepNameForHead = parsed?.type === 'globalItGapCompressionBlock'
                  ? (parsed?.noteName ? String(parsed.noteName) : 'IT设计补齐')
                  : (parsed?.type === 'e2eFlowCompressionBlock'
                    ? (parsed?.noteName ? String(parsed.noteName) : '端到端事务流全景观提炼')
                    : (parsed?.stepName || ''));
                if (parsed?.confirmed === true) confirmTagForHead = '<span class="problem-detail-history-log-type-tag problem-detail-history-log-type-confirm">确认</span>';
                const hasTokenMeta = (parsed?.llmMeta?.usage?.prompt_tokens ?? 0) > 0;
                const inputStr = parsed?.llmInputPrompt != null ? String(parsed.llmInputPrompt) : (hasTokenMeta ? '（历史数据，输入内容未保存）' : '(无)');
                const outputStr = (parsed?.llmOutputRaw != null && String(parsed.llmOutputRaw).trim())
                  ? String(parsed.llmOutputRaw)
                  : (typeof parsed?.compressedJson === 'string' ? parsed.compressedJson : (parsed?.compressedJson != null ? JSON.stringify(parsed.compressedJson, null, 2) : (parsed?.constraintBaseMarkdown != null ? String(parsed.constraintBaseMarkdown) : '(无)')));
                const tokenPair = resolveTokenPair(parsed?.llmMeta?.usage, inputStr, outputStr);
                const mainPromptTokens = tokenPair.promptTokens;
                const mainCompletionTokens = tokenPair.completionTokens;
                contentStr = outputStr;
                contentHtml = buildHistoryLlmQuerySubcardsHtml(inputStr, outputStr, mainPromptTokens, mainCompletionTokens);
              } else if (parsed?.type === 'rolePermissionModificationActionBlock') {
                titleLabel = '角色与权限按新提示词重生成';
                const vclog = String(parsed?.versionChangelogFromPrompt || '').trim();
                const diffMd = String(parsed?.diffSummaryMarkdown || '').trim();
                const curSnap = parsed?.currentSessionsSnapshot;
                const curJson = curSnap != null ? JSON.stringify(curSnap, null, 2) : '';
                const chunks = [];
                if (vclog) {
                  chunks.push(
                    `<div class="problem-detail-history-rp-mod-block"><div class="problem-detail-chat-modification-revision-label">提示词相对上一版的调整</div><div class="markdown-body">${renderMarkdown(vclog)}</div></div>`,
                  );
                }
                if (diffMd) {
                  chunks.push(
                    `<div class="problem-detail-history-rp-mod-block"><div class="problem-detail-chat-modification-revision-label">推演结果相对上一版的变化</div><div class="markdown-body">${renderMarkdown(diffMd)}</div></div>`,
                  );
                }
                if (curJson) {
                  chunks.push(
                    `<div class="problem-detail-history-rp-mod-block"><div class="problem-detail-chat-modification-revision-label">当前全量各环节推演 JSON</div><pre class="problem-detail-history-timeline-pre">${escapeHtml(curJson)}</pre></div>`,
                  );
                }
                contentStr = [vclog, diffMd, curJson].filter(Boolean).join('\n\n') || '(无)';
                contentHtml = chunks.length ? chunks.join('') : null;
              } else if (parsed?.type === 'taskCompleteBlock') {
                titleLabel = '任务完成';
                contentStr = (parsed?.content && String(parsed.content).trim()) || '用户确认任务完成';
              } else if (parsed?.type === 'unsatisfiedBlock') {
                titleLabel = '用户表示不满意';
                contentStr = (typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content || {}, null, 2)).slice(0, 2000) + (String(parsed.content || '').length > 2000 ? '\n…' : '');
              }
            } catch (_) {}
            // 所有时间线卡片备注统一为：耗时，输入 token，输出 token
            let durationMsForEntry = 0;
            let inputTokenCount = 0;
            let outputTokenCount = 0;
            try {
              const parsedForToken = typeof c.content === 'string' ? JSON.parse(c.content) : c.content;
              const usage = parsedForToken?.llmMeta?.usage;
              const currentDuration = (parsedForToken?.llmMeta && typeof parsedForToken.llmMeta.durationMs === 'number') ? parsedForToken.llmMeta.durationMs : 0;
              if (logType === '输入') {
                // 输入卡片：耗时为 0，输出 token 为 0，输入 token 为后续大模型调用返回的 prompt_tokens
                durationMsForEntry = 0;
                outputTokenCount = 0;
                const nextContent = comms[i + 1]?.content;
                try {
                  const nextParsed = typeof nextContent === 'string' ? JSON.parse(nextContent) : nextContent;
                  inputTokenCount = nextParsed?.llmMeta?.usage?.prompt_tokens ?? 0;
                } catch (_) {
                  inputTokenCount = 0;
                }
              } else if (logType === 'LLM-查询' || logType === 'LLM-审计' || logType === 'LLM-修改') {
                // LLM-查询 / LLM-审计 / LLM-修改：输入 token=prompt_tokens，输出 token=completion_tokens，耗时=本次调用耗时
                const llmInput = parsedForToken?.llmInputPrompt ?? parsedForToken?.llmMeta?.inputPromptSnapshot ?? '';
                const llmOutput = parsedForToken?.llmOutputJson != null
                  ? parsedForToken.llmOutputJson
                  : ((parsedForToken?.llmOutputRaw != null && String(parsedForToken.llmOutputRaw).trim())
                    ? parsedForToken.llmOutputRaw
                    : parsedForToken?.content);
                const pair = resolveTokenPair(usage, llmInput, llmOutput);
                durationMsForEntry = currentDuration;
                inputTokenCount = pair.promptTokens;
                outputTokenCount = pair.completionTokens;
              } else if (logType === '输出' || logType === '确认') {
                // 输出/确认卡片：耗时为大模型返回耗时，输入 token 为 0，输出 token 为 completion_tokens
                durationMsForEntry = currentDuration;
                inputTokenCount = 0;
                outputTokenCount = (Number(usage?.completion_tokens) || 0) > 0 ? Number(usage?.completion_tokens) : estimateTokenCountFromText(parsedForToken?.content);
              } else if (logType === '压缩' || logType === 'LLM-压缩') {
                // 压缩 / LLM 压缩 卡片：耗时为该次大模型返回耗时，输入/输出 token 为该次调用的 prompt_tokens / completion_tokens
                const pair = resolveTokenPair(
                  usage,
                  parsedForToken?.llmInputPrompt ?? parsedForToken?.llmMeta?.inputPromptSnapshot ?? '',
                  parsedForToken?.llmOutputRaw ?? parsedForToken?.compressedJson ?? parsedForToken?.constraintBaseMarkdown ?? parsedForToken?.content
                );
                durationMsForEntry = currentDuration;
                inputTokenCount = pair.promptTokens;
                outputTokenCount = pair.completionTokens;
              } else {
                durationMsForEntry = 0;
                inputTokenCount = 0;
                outputTokenCount = 0;
              }
            } catch (_) {}
            // 累计总耗时、输入 token、输出 token
            totals.durationMs += durationMsForEntry;
            taskTotals.durationMs += durationMsForEntry;
            totals.inputTokens += inputTokenCount;
            taskTotals.inputTokens += inputTokenCount;
            totals.outputTokens += outputTokenCount;
            taskTotals.outputTokens += outputTokenCount;
            // 每条卡片统一展示：耗时，输入 token，输出 token（顺序一致）
            const durationSec = durationMsForEntry >= 0 ? (durationMsForEntry / 1000).toFixed(1) : '0';
            const durationLabel = `<span class="problem-detail-history-timeline-duration" title="大模型耗时">${durationSec}秒</span>`;
            const inputTokenStr = inputTokenCount.toLocaleString();
            const outputTokenStr = outputTokenCount.toLocaleString();
            const inputLabel = `<span class="problem-detail-history-timeline-token-in" title="输入 token">输入 ${inputTokenStr}</span>`;
            const outputLabel = `<span class="problem-detail-history-timeline-token-out" title="输出 token">输出 ${outputTokenStr}</span>`;
            const metaCountsHtml = `<span class="problem-detail-history-timeline-meta-counts">${durationLabel}${inputLabel}${outputLabel}</span>`;
            return `
          <div class="problem-detail-history-timeline-node" data-index="${i}" data-log-type="${escapeHtml(logType)}">
            <div class="problem-detail-history-timeline-dot-wrap">
              <div class="problem-detail-history-timeline-dot"></div>
            </div>
            <div class="problem-detail-history-timeline-body problem-detail-history-node-card-shell">
              ${HISTORY_NODE_COPY_BUTTON_HTML}
              <div class="problem-detail-history-node-card-inner">
              <button type="button" class="problem-detail-history-timeline-head" role="button" aria-expanded="false">
                <span class="problem-detail-history-timeline-expand">▸</span>
                <span class="problem-detail-history-timeline-time">${escapeHtml(timeStr)}</span>
                <span class="problem-detail-history-log-type-tag problem-detail-history-log-type-${LOG_TYPE_CLASS[logType] || 'confirm'}">${escapeHtml(logType)}</span>${confirmTagForHead}${stepNameForHead ? buildTimelineStepNameSpan(stepNameForHead) : ''}${contextNoteForHead ? buildTimelineStepNameSpan(contextNoteForHead) : ''}${sessionPlanNoteForHead ? buildTimelineStepNameSpan(sessionPlanNoteForHead) : ''}${metaCountsHtml}
              </button>
              <div class="problem-detail-history-timeline-detail" hidden>
                <div class="problem-detail-history-timeline-detail-meta">
                  <span>${escapeHtml(titleLabel)}</span>
                  <span>${escapeHtml(timeStr)}</span>
                </div>
                ${contentHtml
                  ? `<div class="problem-detail-history-timeline-detail-content problem-detail-history-timeline-detail-content-rich">${contentHtml}</div>`
                  : `<pre class="problem-detail-history-timeline-detail-content">${escapeHtml(contentStr)}</pre>`}
              </div>
              </div>
            </div>
          </div>`;
          }).join('');
      const skillNodes = buildSkillTimelineByTask(task.id, taskData, comms, createdAt, allChatsRaw);
      const skillTimelineHtml =
        skillNodes.length === 0
          ? '<p class="problem-detail-history-comm-empty">暂无任务Skill演进记录</p>'
          : `${buildSkillLatestSnapshotHtml(skillNodes[skillNodes.length - 1])}${skillNodes
              .map((node, idx) => {
                const timeStr = node.timestamp ? formatChatTime(node.timestamp) : '—';
                return `
          <div class="problem-detail-history-skill-node" data-index="${idx}">
            <div class="problem-detail-history-skill-dot-wrap">
              <div class="problem-detail-history-skill-dot"></div>
            </div>
            <div class="problem-detail-history-skill-body problem-detail-history-node-card-shell">
              ${HISTORY_NODE_COPY_BUTTON_HTML}
              <div class="problem-detail-history-node-card-inner">
              <button type="button" class="problem-detail-history-skill-head" role="button" aria-expanded="false">
                <span class="problem-detail-history-timeline-expand">▸</span>
                <span class="problem-detail-history-timeline-time">${escapeHtml(timeStr)}</span>
                <span class="problem-detail-history-log-type-tag problem-detail-history-log-type-context">任务Skill</span>
              </button>
              <div class="problem-detail-history-skill-detail" hidden>
                ${buildSkillTimelineNodeDetailHtml(node)}
              </div>
              </div>
            </div>
          </div>`;
              })
              .join('')}`;
      const auditSkillNodes = buildAuditSkillTimelineByTask(task.id, taskData, comms, createdAt, allChatsRaw);
      const auditSkillTimelineHtml =
        auditSkillNodes.length === 0
          ? '<p class="problem-detail-history-comm-empty">暂无审计 Skill 演进记录（如全局对象骨架审计的 LLM system 提示词）</p>'
          : `${buildSkillLatestSnapshotHtml(auditSkillNodes[auditSkillNodes.length - 1], 'audit')}${auditSkillNodes
              .map((node, idx) => {
                const timeStr = node.timestamp ? formatChatTime(node.timestamp) : '—';
                return `
          <div class="problem-detail-history-skill-node" data-index="${idx}">
            <div class="problem-detail-history-skill-dot-wrap">
              <div class="problem-detail-history-skill-dot"></div>
            </div>
            <div class="problem-detail-history-skill-body problem-detail-history-node-card-shell">
              ${HISTORY_NODE_COPY_BUTTON_HTML}
              <div class="problem-detail-history-node-card-inner">
              <button type="button" class="problem-detail-history-skill-head" role="button" aria-expanded="false">
                <span class="problem-detail-history-timeline-expand">▸</span>
                <span class="problem-detail-history-timeline-time">${escapeHtml(timeStr)}</span>
                <span class="problem-detail-history-log-type-tag problem-detail-history-log-type-context">审计Skill</span>
              </button>
              <div class="problem-detail-history-skill-detail" hidden>
                ${buildSkillTimelineNodeDetailHtml(node, 'audit')}
              </div>
              </div>
            </div>
          </div>`;
              })
              .join('')}`;
      const taskInputTokensStr = taskTotals.inputTokens.toLocaleString();
      const taskOutputTokensStr = taskTotals.outputTokens.toLocaleString();
      const taskDurationSec = (taskTotals.durationMs / 1000).toFixed(1);
      const taskMetaHtml = `<span class="problem-detail-history-task-node-meta problem-detail-history-timeline-meta-counts">
        <span class="problem-detail-history-timeline-duration" title="本任务耗时">${escapeHtml(taskDurationSec)}秒</span>
        <span class="problem-detail-history-timeline-token-in" title="本任务输入 token 总和">输入 ${escapeHtml(taskInputTokensStr)}</span>
        <span class="problem-detail-history-timeline-token-out" title="本任务输出 token 总和">输出 ${escapeHtml(taskOutputTokensStr)}</span>
      </span>`;
      const statusClass =
        taskStatusText === '已完成'
          ? 'problem-detail-history-task-done'
          : taskStatusText === '进行中'
            ? 'problem-detail-history-task-current'
            : taskStatusText === '修改中'
              ? 'problem-detail-history-task-modifying'
              : taskStatusText === '审计中'
                ? 'problem-detail-history-task-auditing'
                : '';
      const taskInfoHtml = `
      <div class="problem-detail-history-task-info">
        <h5>归属阶段</h5>
        <p>${escapeHtml(task.stage)}</p>
        <h5>任务目标</h5>
        <p>${escapeHtml(objective)}</p>
        <h5>评估标准</h5>
        <p>${escapeHtml(evaluationCriteria)}</p>
        <h5>输入</h5>
        <p>${escapeHtml(inputDesc)}</p>
        <h5>动作</h5>
        <p>${escapeHtml(actionDesc)}</p>
        <h5>输出反馈</h5>
        <p>${escapeHtml(outputDesc)}</p>
        <h5>任务状态</h5>
        <p>${escapeHtml(taskStatusText)}</p>
      </div>`;
      return `
      <div class="problem-detail-history-task-root ${statusClass}" data-task-id="${task.id}" data-status="${escapeHtml(taskStatusText)}">
        <button type="button" class="problem-detail-history-task-node" data-task-id="${task.id}" role="button">
          <span class="task-node-expand">▸</span>
          <span class="task-node-name">${escapeHtml(task.id.charAt(0).toUpperCase() + task.id.slice(1) + '｜' + task.name)}</span>
          ${taskMetaHtml}
        </button>
        <div class="problem-detail-history-task-children" hidden>
          <div class="problem-detail-history-task-tabs" role="tablist">
            <button type="button" class="problem-detail-history-tab problem-detail-history-tab-active" role="tab" aria-selected="true" data-tab="detail">任务详情</button>
            <button type="button" class="problem-detail-history-tab" role="tab" aria-selected="false" data-tab="log">过程日志</button>
            <button type="button" class="problem-detail-history-tab" role="tab" aria-selected="false" data-tab="skill">任务Skill</button>
            <button type="button" class="problem-detail-history-tab" role="tab" aria-selected="false" data-tab="audit-skill">审计Skill</button>
          </div>
          <div class="problem-detail-history-tab-panel" role="tabpanel" data-tab="detail">${taskInfoHtml}</div>
          <div class="problem-detail-history-tab-panel" role="tabpanel" data-tab="log" hidden><div class="problem-detail-history-timeline">${timelineHtml}</div></div>
          <div class="problem-detail-history-tab-panel" role="tabpanel" data-tab="skill" hidden><div class="problem-detail-history-skill-timeline">${skillTimelineHtml}</div></div>
          <div class="problem-detail-history-tab-panel" role="tabpanel" data-tab="audit-skill" hidden><div class="problem-detail-history-skill-timeline problem-detail-history-audit-skill-timeline">${auditSkillTimelineHtml}</div></div>
        </div>
      </div>`;
    }).join('');
    const totalInputTokensStr = totals.inputTokens.toLocaleString();
    const totalOutputTokensStr = totals.outputTokens.toLocaleString();
    const totalSecNum = totals.durationMs / 1000;
    const totalMinutes = Math.floor(totalSecNum / 60);
    const totalSecRem = (totalSecNum % 60).toFixed(1);
    const totalDurationStr = totalMinutes >= 1 ? `${totalMinutes}分${totalSecRem}秒` : `${totalSecRem}秒`;
    const iconDuration = '<span class="problem-detail-history-summary-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>';
    const iconInput = '<span class="problem-detail-history-summary-icon problem-detail-history-summary-icon-in" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></span>';
    const iconOutput = '<span class="problem-detail-history-summary-icon problem-detail-history-summary-icon-out" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></span>';
    const summaryHtml = `
    <div class="problem-detail-history-summary">
      <div class="problem-detail-history-summary-item" title="所有过程日志条目的大模型耗时之和">
        <span class="problem-detail-history-summary-label">${iconDuration}总耗时</span>
        <span class="problem-detail-history-summary-value problem-detail-history-summary-duration">${escapeHtml(totalDurationStr)}</span>
      </div>
      <div class="problem-detail-history-summary-item" title="所有过程日志条目的输入 token 总和">
        <span class="problem-detail-history-summary-label">${iconInput}输入 token</span>
        <span class="problem-detail-history-summary-value problem-detail-history-summary-tokens-in">${escapeHtml(totalInputTokensStr)}</span>
      </div>
      <div class="problem-detail-history-summary-item" title="所有过程日志条目的输出 token 总和">
        <span class="problem-detail-history-summary-label">${iconOutput}输出 token</span>
        <span class="problem-detail-history-summary-value problem-detail-history-summary-tokens-out">${escapeHtml(totalOutputTokensStr)}</span>
      </div>
    </div>`;
    container.innerHTML = summaryHtml + taskListHtml;
    /* 任务节点展开由 main.js 在 problemDetailHistoryPanel 上的事件委托处理 */
    container.querySelectorAll('.problem-detail-history-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const root = tab.closest('.problem-detail-history-task-children');
        if (!root) return;
        const tabKey = tab.getAttribute('data-tab');
        root.querySelectorAll('.problem-detail-history-tab').forEach((t) => {
          t.classList.remove('problem-detail-history-tab-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('problem-detail-history-tab-active');
        tab.setAttribute('aria-selected', 'true');
        root.querySelectorAll('.problem-detail-history-tab-panel').forEach((panel) => {
          panel.hidden = panel.getAttribute('data-tab') !== tabKey;
        });
      });
    });
    if (!container.__feHistoryNodeCopyBound) {
      container.__feHistoryNodeCopyBound = true;
      container.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.problem-detail-history-node-copy-btn');
        if (!copyBtn || !container.contains(copyBtn)) return;
        e.preventDefault();
        e.stopPropagation();
        const shell = copyBtn.closest('.problem-detail-history-node-card-shell');
        const inner = shell?.querySelector('.problem-detail-history-node-card-inner');
        if (!inner) return;
        void copyHistoryNodeCardPlainText(inner).then((ok) => {
          const prev = copyBtn.textContent;
          copyBtn.textContent = ok ? '\u5df2\u590d\u5236' : '\u5931\u8d25';
          copyBtn.disabled = true;
          window.setTimeout(() => {
            copyBtn.textContent = prev;
            copyBtn.disabled = false;
          }, 1400);
        });
      });
    }
    container.querySelectorAll('.problem-detail-history-timeline-head').forEach((btn) => {
      btn.addEventListener('click', () => {
        const body = btn.closest('.problem-detail-history-timeline-body');
        const detail = body?.querySelector('.problem-detail-history-timeline-detail');
        if (!detail) return;
        const isExpanded = !detail.hidden;
        detail.hidden = isExpanded;
        btn.classList.toggle('expanded', !isExpanded);
        btn.setAttribute('aria-expanded', !isExpanded);
        btn.querySelector('.problem-detail-history-timeline-expand')?.classList.toggle('expanded', !isExpanded);
      });
    });
    container.querySelectorAll('.problem-detail-history-skill-head').forEach((btn) => {
      btn.addEventListener('click', () => {
        const body = btn.closest('.problem-detail-history-skill-body');
        const detail = body?.querySelector('.problem-detail-history-skill-detail');
        if (!detail) return;
        const isExpanded = !detail.hidden;
        detail.hidden = isExpanded;
        btn.classList.toggle('expanded', !isExpanded);
        btn.setAttribute('aria-expanded', !isExpanded);
        btn.querySelector('.problem-detail-history-timeline-expand')?.classList.toggle('expanded', !isExpanded);
      });
    });
    restoreHistoryExpandedState(container, expandedState);
    const taskNodeCount = container.querySelectorAll('.problem-detail-history-task-node').length;
    console.log('[沟通历史] 渲染完成', { taskNodeCount, hasPanel: !!container.closest('.problem-detail-history-panel') });
  }

  global.inferTaskIdFromMessage = inferTaskIdFromMessage;
  global.shouldIncludeInCommunicationHistory = shouldIncludeInCommunicationHistory;
  global.getCommunicationsByTask = getCommunicationsByTask;
  global.getCommunicationsAsTimeline = getCommunicationsAsTimeline;
  /** 渲染沟通历史面板（2 参数：container, deps），供 main 的 renderProblemDetailHistory() 调用 */
  global.renderCommunicationHistoryPanel = renderProblemDetailHistory;
})(typeof window !== 'undefined' ? window : this);
