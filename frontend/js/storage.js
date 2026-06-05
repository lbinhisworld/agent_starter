/**
 * [INPUT]: `js/config.js` 存储键；可选 `STORAGE_HTTP_ADAPTER` / `STORAGE_INDEXEDDB_ADAPTER`
 * [OUTPUT]: 全局 `getDigitalProblems`、`updateDigitalProblem*`、聊天与任务跟踪读写；客户档案 `archiveNo`（首页「档案编号」、详情「案例编号」）；local/IndexedDB 用 `peekNextDigitalProblemArchiveNo` 单调递增；**online** 模式以服务端 `ProblemCase.archiveNo` 为准（见 `storage-http-adapter.js` FE-20260409-archive-no）；`ensureDigitalProblemArchiveNosPersisted` 为旧本地数据补号
 * [POS]: 前端持久化统一入口；online/local（IndexedDB）下痛点 session/单步须走 `upd()` 写适配器缓存
 *
 * [PROTOCOL]: 一旦本文件存储分流或 `updateDigitalProblem*` 行为变更，须同步更新本 Header 与 `frontend/js/AGENTS.md`
 *
 * FE-20260322-06：online 下 `updateDigitalProblemCoreBusinessObjectSessions` 走 adapter `upd`，与 `getItem` 双键查找一致。
 * FE-20260322-10：online 下 `updateDigitalProblemPainPointSessions` / `updateDigitalProblemPainPointStep` 同样走 adapter 内存 + PUT。
 * FE-20260324-09：`updateDigitalProblemCoreBusinessObjectSystemPromptOverride`、`removeDigitalProblemCompletedTaskId`（task11 修改链路两阶段确认）。
 * FE-20260401-04：task4 三子环节 Session — `updateDigitalProblemValueStreamDrawSessions`、`updateDigitalProblemValueStreamHardeningDraft`；`buildResetPreliminaryAdapterMergeClears` 与阶段回退时一并清零。
 * FE-20260328-14：`resetDigitalProblemToPreliminary` 在 online 浅合并路径下附带阶段/完成态/会话字段显式清零，避免重置后仍残留 `completedTaskIds`（顶栏/沟通历史误指 task10）。
 * FE-20260328-19：`buildResetPreliminaryAdapterMergeClears` 增加 `task1InitialLlmQuery: undefined`，避免浅合并残留旧提炼快照。
 * FE-20260330-6：**顶栏「重置」**（现语义）：回到 task1 待执行，保留 `customerName`/`archiveNo`；`requirementDetail` 与 History 清空；**FE-20260409**：V2 `preliminaryReq` 等 Json 列用 `null` PUT；**FE-20260415-reset**：纯 local 与 adapter 均 `clears+resetBase` 合并；`collectCaseSideStorageKeys` 清聊天双键、操作历史、任务追踪；online 另清 `problemTaskSummariesCache`（`clearProblemCaseTaskSummariesCacheForItem`）。
 * FE-20260401-06：`rollbackValueStreamItStatus`（清空环节 itStatus/itPlan 并收回 wf 位 1）；`updateDigitalProblemItStatusSessions` 按 `createdAt|id` 双键查找。
 * FE-20260402-02：`updateDigitalProblemE2eTransactionFlow` 持久化 task7 业务事务流 BPM JSON；阶段回退/重置路径清零 `e2eTransactionFlowJson`。**FE-20260409**：`updateDigitalProblemE2eRequirementScenarioSupplement` 持久化 task7「需求场景事务流补齐」BPM JSON（初步需求业务流程类目补齐）；与主事务流同步清零。**FE-20260412**：task7 类目补齐每完成一轮即 `upd` 当前合并 JSON（不必等全部类目），供工作区卡增量展示。**FE-20260412-05**：纯 local 列表按 `createdAt` 或 `id` 双键定位案例，与在线 `persistKey` 一致，避免仅有 `id` 或类型不一致时落库静默失败。
 * FE-20260403-19：task8 `itDesignSupplement*` 写库与 `findDigitalProblemIndexByCaseKey`（`createdAt` 或 `id`）对齐聊天 `caseKey`，避免仅有 `id` 时 `pushItDesignSupplementSessionsBlockAndRender` 提前 return 导致 Session 计划块不出现。
 * FE-20260403-20：task9 `updateDigitalProblemRoleTaskCenterPortalDesign` 纯 local 路径用 `findDigitalProblemIndexByCaseKey`，与 online `getDigitalProblemPersistKey` 一致。
 * FE-20260411：task9 `updateDigitalProblemObjectStateMachine` 持久化对象状态机 JSON；`clearDigitalProblemGlobalItGapAnalysis` 一并清空，与 task8 重置一致。
 * FE-20260407：`updateDigitalProblemValueStream` / `updateDigitalProblemValueStreamLogicText` 按 `createdAt|id` 双键定位案例，与 Session 计划更新一致，便于 task4 二次确认清空工作区时仅有 `id` 键也能落库。
 * FE-20260408：online 下 task8 `itDesignSupplement*` 单步 PUT 须后端 `ProblemCase.itDesignSupplementSessions` 与 `updateProblemCaseSchema` 白名单落库；详情刷新合并见 `main.js` / `storage-http-adapter.js`。
 * FE-20260417：`saveProblemDetailChatLocalStorageMulticast` 同步清空案例 `createdAt`/`id` 下本地 `problem_detail_chats` 映射，配合 `main.js` `getChatsForProblem` 空数组走内存，避免 task1 重启后沟通历史过程日志仍读旧键。
 * FE-20260411-plus-req：纯 local `restoreItemFromSnapshot` / `updateDigitalProblemMajorStage` 按 `createdAt|id` 定位案例，与 `getDigitalProblemPersistKey` 一致。
 * FE-20260411-chat-quota：`problem_detail_chats` 写入遇 `QuotaExceededError` 时按体积驱逐**其它**案例键后重试；仍失败仅 `console.warn`（不弹浏览器 `alert`，避免打断「+需求」等流程）。
 */
(function (global) {
  /**
   * 读取已保存的企业分析列表。
   * @returns {Array<Object>} 分析记录数组。
   */
  function getSavedAnalyses() {
    try {
      const raw = localStorage.getItem(global.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * 保存或覆盖同名企业分析记录。
   * @param {Object} record - 分析记录。
   * @returns {void}
   */
  function saveAnalysis(record) {
    const list = getSavedAnalyses();
    const idx = list.findIndex((r) => (r.companyName || '').trim() === (record.companyName || '').trim());
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    localStorage.setItem(global.STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 保存当前路由状态到会话存储。
   * @param {string} view - 当前视图标识。
   * @param {Object} params - 路由参数。
   * @returns {void}
   */
  function saveRouteState(view, params) {
    try {
      sessionStorage.setItem(global.ROUTE_STORAGE_KEY, JSON.stringify({ view, params: params || {} }));
    } catch (_) {}
  }

  /**
   * 读取数字化问题列表。
   * @returns {Array<Object>} 问题列表。
   */
  function getDigitalProblems() {
    try {
      const raw = localStorage.getItem(global.DIGITAL_PROBLEMS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /** 列表项定位：参数可为 createdAt 或 id（与 `getProblemDetailChatStorageKey` / HTTP 适配器 `getItem` 一致） */
  function findDigitalProblemIndexByCaseKey(list, key) {
    if (key == null || String(key).trim() === '') return -1;
    const k = String(key);
    return list.findIndex((it) => String(it.createdAt || '') === k || String(it.id || '') === k);
  }

  /**
   * 为缺少 archiveNo 的档案按 createdAt 升序补全编号（从当前最大编号+1 起递增），返回新列表与是否变更。
   * @param {Array<Object>} list
   * @returns {{ list: Array<Object>, changed: boolean }}
   */
  function applyDigitalProblemsArchiveNoMigration(list) {
    const arr = Array.isArray(list) ? list.slice() : [];
    let maxN = 0;
    for (const it of arr) {
      const n = Number(it?.archiveNo);
      if (Number.isFinite(n) && n > 0) maxN = Math.max(maxN, n);
    }
    const missing = arr.filter((it) => {
      const n = Number(it?.archiveNo);
      return !(Number.isFinite(n) && n > 0);
    });
    if (missing.length === 0) return { list: arr, changed: false };
    missing.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return ta - tb;
    });
    const assignMap = new Map();
    for (const it of missing) {
      maxN += 1;
      assignMap.set(it.createdAt, maxN);
    }
    const out = arr.map((it) => {
      const n = assignMap.get(it.createdAt);
      if (n == null) return it;
      return { ...it, archiveNo: n };
    });
    return { list: out, changed: true };
  }

  /**
   * 基于已有列表计算下一条档案编号（max(archiveNo)+1）。
   * @param {Array<Object>} list
   * @returns {number}
   */
  function peekNextDigitalProblemArchiveNo(list) {
    let maxN = 0;
    for (const it of list || []) {
      const n = Number(it?.archiveNo);
      if (Number.isFinite(n) && n > 0) maxN = Math.max(maxN, n);
    }
    return maxN + 1;
  }

  /**
   * 若存在无 archiveNo 的旧数据则写回存储（首页渲染前调用一次即可）。
   * @returns {void}
   */
  function ensureDigitalProblemArchiveNosPersisted() {
    try {
      /* online 模式列表在 HTTP 缓存，无整表 saveSnapshot；避免把迁移结果误写入纯 localStorage */
      const cfg = global.APP_CONFIG || {};
      if ((cfg.MODE === 'online') && global.STORAGE_HTTP_ADAPTER) return;
      const getList = global.getDigitalProblems;
      const saveSnap = global.saveDigitalProblemsSnapshot;
      if (typeof getList !== 'function' || typeof saveSnap !== 'function') return;
      const list = getList();
      const mig = applyDigitalProblemsArchiveNoMigration(list);
      if (!mig.changed) return;
      saveSnap(mig.list);
    } catch (_) {}
  }

  /**
   * 新增一条数字化问题记录。
   * @param {Object} item - 问题对象。
   * @returns {void}
   */
  function saveDigitalProblem(item) {
    let list = getDigitalProblems();
    const mig = applyDigitalProblemsArchiveNoMigration(list);
    list = mig.list;
    if (mig.changed) {
      localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
    }
    const nextNo = peekNextDigitalProblemArchiveNo(list);
    const existingNo = Number(item?.archiveNo);
    const archiveNo = Number.isFinite(existingNo) && existingNo > 0 ? existingNo : nextNo;
    list.unshift({ ...item, createdAt: new Date().toISOString(), archiveNo });
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 直接覆盖数字化问题列表快照（用于迁移补号或局部字段编辑后整表回写）。
   * @param {Array<Object>} list
   */
  function saveDigitalProblemsSnapshot(list) {
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  }

  /**
   * 按索引删除数字化问题。
   * @param {number} index - 列表索引。
   * @returns {void}
   */
  function removeDigitalProblem(index) {
    const list = getDigitalProblems();
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** @param {boolean} [markTaskComplete=true] 为 false 时仅保存数据，不更新 completedStages（等用户点击「已完成」后再更新） */
  function updateDigitalProblemBasicInfo(createdAt, basicInfo, markTaskComplete) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    if (markTaskComplete !== false) {
      const completed = item.completedStages || [];
      if (!completed.includes(0)) completed.push(0);
      completed.sort((a, b) => a - b);
      list[idx] = { ...item, basicInfo, completedStages: completed };
    } else {
      list[idx] = { ...item, basicInfo };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** @param {boolean} [markTaskComplete=true] 为 false 时仅保存数据，不更新 completedStages（等用户点击「已完成」后再更新） */
  function updateDigitalProblemBmc(createdAt, bmc, markTaskComplete) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    if (markTaskComplete !== false) {
      const completed = item.completedStages || [];
      if (!completed.includes(1)) completed.push(1);
      completed.sort((a, b) => a - b);
      list[idx] = { ...item, bmc, completedStages: completed };
    } else {
      list[idx] = { ...item, bmc };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** @param {boolean} [markTaskComplete=true] 为 false 时仅保存数据，不更新 completedStages（等用户点击「已完成」后再更新） */
  function updateDigitalProblemRequirementLogic(createdAt, requirementLogic, markTaskComplete) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    if (markTaskComplete !== false) {
      const completed = item.completedStages || [];
      if (!completed.includes(2)) completed.push(2);
      completed.sort((a, b) => a - b);
      list[idx] = { ...item, requirementLogic, completedStages: completed };
    } else {
      list[idx] = { ...item, requirementLogic };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  function updateDigitalProblemMajorStage(createdAt, majorStage) {
    const list = getDigitalProblems();
    const k = String(createdAt);
    const idx = list.findIndex((it) => String(it.createdAt) === k || String(it.id || '') === k);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, currentMajorStage: majorStage };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新 ITGap 阶段完成标记数组。
   * @param {string} createdAt - 问题创建时间。
   * @param {number[]} stages - 已完成阶段索引。
   * @returns {void}
   */
  function updateDigitalProblemItGapCompletedStages(createdAt, stages) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, itGapCompletedStages: stages };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 记录某任务 ID 为已完成。
   * @param {string} createdAt - 问题创建时间。
   * @param {string} taskId - 任务 ID。
   * @returns {void}
   */
  function updateDigitalProblemCompletedTaskId(createdAt, taskId) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const completed = item.completedTaskIds || [];
    if (completed.includes(taskId)) return;
    list[idx] = { ...item, completedTaskIds: [...completed, taskId].sort() };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新全局 ITGap 分析结果并推进对应阶段状态。
   * @param {string} createdAt - 问题创建时间。
   * @param {Object|string} analysisJson - 分析结果。
   * @returns {void}
   */
  function updateDigitalProblemGlobalItGapAnalysis(createdAt, analysisJson) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const itGapCompleted = item.itGapCompletedStages || [];
    if (!itGapCompleted.includes(1)) itGapCompleted.push(1);
    itGapCompleted.sort((a, b) => a - b);
    list[idx] = { ...item, globalItGapAnalysisJson: analysisJson, itGapCompletedStages: itGapCompleted };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 保存全局 ITGap 确认后「架构约束底座」压缩稿（Markdown），供后续全局架构等任务使用。
   * @param {string} createdAt
   * @param {string} constraintBaseMarkdown
   */
  function updateDigitalProblemGlobalItGapConstraintBase(createdAt, constraintBaseMarkdown) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    if (constraintBaseMarkdown == null || constraintBaseMarkdown === '') {
      const { globalItGapConstraintBaseMarkdown: _omit, ...rest } = item;
      list[idx] = rest;
    } else {
      list[idx] = { ...item, globalItGapConstraintBaseMarkdown: constraintBaseMarkdown };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 保存/清除 `e2eFlowLandscapeJson`（历史字段；全景观压缩已下线，新流程不再写入）。
   * @param {string} createdAt
   * @param {Object|string|undefined} landscapeJson
   */
  function updateDigitalProblemE2eFlowLandscape(createdAt, landscapeJson) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    if (landscapeJson == null || landscapeJson === '') {
      const { e2eFlowLandscapeJson: _omit, ...rest } = item;
      list[idx] = rest;
    } else {
      list[idx] = { ...item, e2eFlowLandscapeJson: landscapeJson };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 保存 task7 业务事务流 JSON（LLM 返回的 BPM 重组结果，供工作区 view/json）。
   * @param {string} createdAt
   * @param {Object|string|undefined} transactionFlowJson
   */
  function updateDigitalProblemE2eTransactionFlow(createdAt, transactionFlowJson) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const idx = list.findIndex(
      (it) => String(it.createdAt || '') === key || String(it.id || '') === key,
    );
    if (idx < 0) return;
    const item = list[idx];
    if (transactionFlowJson == null || transactionFlowJson === '') {
      const { e2eTransactionFlowJson: _omit, ...rest } = item;
      list[idx] = rest;
    } else {
      list[idx] = { ...item, e2eTransactionFlowJson: transactionFlowJson };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * task7：初步需求「业务流程」类目补齐后的事务流 BPM JSON（独立工作区卡「需求场景事务流补齐」）。
   * @param {string} createdAt
   * @param {Object|string|undefined|null} supplementJson
   */
  function updateDigitalProblemE2eRequirementScenarioSupplement(createdAt, supplementJson) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const idx = list.findIndex(
      (it) => String(it.createdAt || '') === key || String(it.id || '') === key,
    );
    if (idx < 0) return;
    const item = list[idx];
    if (supplementJson == null || supplementJson === '') {
      const { e2eRequirementScenarioSupplementJson: _omit, ...rest } = item;
      list[idx] = rest;
    } else {
      list[idx] = { ...item, e2eRequirementScenarioSupplementJson: supplementJson };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 清除全局 ITGap 及相关局部分析数据。
   * @param {string} createdAt - 问题创建时间。
   * @returns {void}
   */
  function clearDigitalProblemGlobalItGapAnalysis(createdAt) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const itGapCompleted = (item.itGapCompletedStages || []).filter((x) => x !== 1 && x !== 2).sort((a, b) => a - b);
    const {
      globalItGapAnalysisJson,
      globalItGapConstraintBaseMarkdown,
      localItGapAnalyses,
      localItGapSessions,
      roleTaskCenterPortalDesignJson,
      itDesignSupplementSessions,
      ...rest
    } = item;
    list[idx] = { ...rest, itGapCompletedStages: itGapCompleted };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * task8 IT设计补齐：写入按事务流对象的 session 列表（与聊天区 itDesignSupplementSessionsBlock 同源）。
   */
  function updateDigitalProblemItDesignSupplementSessions(createdAt, sessions) {
    const list = getDigitalProblems();
    const idx = findDigitalProblemIndexByCaseKey(list, createdAt);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, itDesignSupplementSessions: Array.isArray(sessions) ? sessions : [] };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * task8：下发新 Session 计划时重置全局 ITGap 落库字段，避免旧四阶段结果与新按事务设计混用。
   */
  function updateDigitalProblemTask8ItDesignPlanReset(createdAt, sessions) {
    const list = getDigitalProblems();
    const idx = findDigitalProblemIndexByCaseKey(list, createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const itGapCompleted = (item.itGapCompletedStages || []).filter((x) => x !== 1);
    list[idx] = {
      ...item,
      itDesignSupplementSessions: Array.isArray(sessions) ? sessions : [],
      globalItGapAnalysisJson: undefined,
      globalItGapConstraintBaseMarkdown: undefined,
      itGapCompletedStages: itGapCompleted,
    };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * task8：单事务 IT设计补齐 LLM 结果写回对应 session。
   */
  function updateDigitalProblemItDesignSupplementStep(createdAt, stepIndex, designOutputJson) {
    const list = getDigitalProblems();
    const idx = findDigitalProblemIndexByCaseKey(list, createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const sessions = item.itDesignSupplementSessions || [];
    const si = Number(stepIndex);
    const newSessions = sessions.map((s, i) =>
      Number(s.stepIndex) === si || i === si ? { ...s, designOutputJson: designOutputJson != null ? designOutputJson : null } : s,
    );
    list[idx] = { ...item, itDesignSupplementSessions: newSessions };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** task8：单事务 BPM 泳道流程图（LLM 文本/Mermaid/SVG）写回 session.bpmFlowDrawMarkdown */
  function updateDigitalProblemItDesignSupplementBpmDraw(createdAt, stepIndex, bpmFlowDrawMarkdown) {
    const list = getDigitalProblems();
    const idx = findDigitalProblemIndexByCaseKey(list, createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const sessions = item.itDesignSupplementSessions || [];
    const si = Number(stepIndex);
    const md = bpmFlowDrawMarkdown != null ? String(bpmFlowDrawMarkdown) : '';
    const newSessions = sessions.map((s, i) =>
      Number(s.stepIndex) === si || i === si ? { ...s, bpmFlowDrawMarkdown: md } : s,
    );
    list[idx] = { ...item, itDesignSupplementSessions: newSessions };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新对象状态机构建（task9）session 列表。
   * @param {string} createdAt - 问题创建时间。
   * @param {Array<Object>} sessions - session 列表。
   * @returns {void}
   */
  function updateDigitalProblemLocalItGapSessions(createdAt, sessions) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, localItGapSessions: sessions };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * task9：写入「流程、待办与决策中心」门户设计 JSON（BPM 角色视角）。
   */
  function updateDigitalProblemRoleTaskCenterPortalDesign(createdAt, portalJson) {
    const list = getDigitalProblems();
    const idx = findDigitalProblemIndexByCaseKey(list, createdAt);
    if (idx < 0) return;
    const item = list[idx];
    if (portalJson == null || portalJson === '') {
      const { roleTaskCenterPortalDesignJson: _omit, ...rest } = item;
      list[idx] = rest;
    } else {
      list[idx] = { ...item, roleTaskCenterPortalDesignJson: portalJson };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * task9：对象状态机构建 — 写入大模型产出的状态机 JSON。
   */
  function updateDigitalProblemObjectStateMachine(createdAt, stateMachineJson) {
    const list = getDigitalProblems();
    const idx = findDigitalProblemIndexByCaseKey(list, createdAt);
    if (idx < 0) return;
    const item = list[idx];
    if (stateMachineJson == null || stateMachineJson === '') {
      const { objectStateMachineJson: _omit, ...rest } = item;
      list[idx] = rest;
    } else {
      list[idx] = { ...item, objectStateMachineJson: stateMachineJson };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新某个环节的对象状态机构建（task9）分析内容。
   * @param {string} createdAt - 问题创建时间。
   * @param {string} stepName - 环节名。
   * @param {number} stepIndex - 环节索引。
   * @param {Object|string} analysisJson - 分析 JSON。
   * @param {string} analysisMarkdown - 分析 Markdown。
   * @returns {void}
   */
  function updateDigitalProblemLocalItGapAnalysis(createdAt, stepName, stepIndex, analysisJson, analysisMarkdown) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const si = Number(stepIndex);
    const analyses = item.localItGapAnalyses || [];
    const existing = analyses.findIndex((a) => Number(a.stepIndex) === si);
    const entry = { stepName, stepIndex: si, analysisJson };
    const newAnalyses = existing >= 0 ? analyses.map((a, i) => (i === existing ? entry : a)) : [...analyses, entry].sort((a, b) => a.stepIndex - b.stepIndex);
    // itGapCompletedStages 中的 2 仅在用户确认 task9（对象状态机构建）任务完成时写入，不在此处提前添加
    const sessions = item.localItGapSessions || [];
    if (sessions.length > 0) {
      // 与 localItGap.js 中 nextIndex（findIndex）对齐：按数组下标或数字 stepIndex 命中，避免 strict === 类型不一致或缺 stepIndex 时写不入 analysisJson → 自动顺序死循环请求 LLM
      const newSessions = sessions.map((s, i) =>
        i === si || Number(s.stepIndex) === si ? { ...s, analysisJson, analysisMarkdown: analysisMarkdown || s.analysisMarkdown } : s
      );
      list[idx] = { ...item, localItGapAnalyses: newAnalyses, localItGapSessions: newSessions };
    } else {
      list[idx] = { ...item, localItGapAnalyses: newAnalyses };
    }
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** 清除某环节的 task9 分析结果，便于该环节重做 */
  function clearDigitalProblemLocalItGapStep(createdAt, stepIndex) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const si = Number(stepIndex);
    const sessions = item.localItGapSessions || [];
    const analyses = (item.localItGapAnalyses || []).filter((a) => Number(a.stepIndex) !== si);
    const newSessions = sessions.map((s, i) =>
      i === si || Number(s.stepIndex) === si ? { ...s, analysisJson: undefined, analysisMarkdown: undefined } : s
    );
    list[idx] = { ...item, localItGapSessions: newSessions, localItGapAnalyses: analyses };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** 更新角色与权限模型推演 session 列表（用于逐步按环节分析） */
  function updateDigitalProblemRolePermissionSessions(createdAt, sessions) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, rolePermissionSessions: sessions };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** 更新某环节的角色与权限推演结果 */
  function updateDigitalProblemRolePermissionStep(createdAt, stepIndex, rolePermissionJson) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const sessions = item.rolePermissionSessions || [];
    const si = Number(stepIndex);
    const newSessions = sessions.map((s) =>
      Number(s.stepIndex) === si ? { ...s, rolePermissionJson } : s
    );
    list[idx] = { ...item, rolePermissionSessions: newSessions };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** 清除某环节的角色与权限推演结果，便于重做 */
  function clearDigitalProblemRolePermissionStep(createdAt, stepIndex) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const sessions = item.rolePermissionSessions || [];
    const si = Number(stepIndex);
    const newSessions = sessions.map((s) =>
      Number(s.stepIndex) === si ? { ...s, rolePermissionJson: undefined } : s
    );
    list[idx] = { ...item, rolePermissionSessions: newSessions };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** 更新核心业务对象推演 session 列表（用于逐步按环节分析）；local 模式写 localStorage */
  function updateDigitalProblemCoreBusinessObjectSessions(createdAt, sessions) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const idx = list.findIndex((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, coreBusinessObjectSessions: sessions };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** task11：持久化用户确认后的 system 提示词覆盖；空串则清除该字段 */
  function updateDigitalProblemCoreBusinessObjectSystemPromptOverride(createdAt, text) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const idx = list.findIndex((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
    if (idx < 0) return;
    const item = list[idx];
    const v = text != null && String(text).trim() !== '' ? String(text).trim() : undefined;
    list[idx] = { ...item, coreBusinessObjectSystemPromptOverride: v };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** 从 completedTaskIds 中移除指定 taskId（如 task11 按新提示词重新推演前取消完工态） */
  function removeDigitalProblemCompletedTaskId(createdAt, taskId) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const tid = String(taskId || '');
    if (!tid) return;
    const idx = list.findIndex((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
    if (idx < 0) return;
    const item = list[idx];
    const next = (item.completedTaskIds || []).filter((id) => String(id) !== tid);
    list[idx] = { ...item, completedTaskIds: next };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** 仅更新 valueStream 数据，不修改 workflowAlignCompletedStages（用于用户点击价值流 JSON 确认后，待用户再点「已完成」再推进阶段） */
  function updateDigitalProblemValueStreamDataOnly(createdAt, valueStream) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, valueStream };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新价值流图数据（vsm_data）。
   * FE-20260325-03：不在此推进 workflowAlignCompletedStages；task4「已完成」须由用户点完成确认后 advanceProblemState / 后端 confirm 写入。
   * @param {string} createdAt - 问题创建时间。
   * @param {Object} valueStream - 价值流数据。
   * @returns {void}
   */
  function updateDigitalProblemValueStream(createdAt, valueStream) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const idx = list.findIndex((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, valueStream };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新价值流设计逻辑说明（大模型返回的逻辑说明部分文字）。
   * @param {string} createdAt - 问题创建时间。
   * @param {string} logicText - 逻辑说明正文。
   * @param {'mirror'|'hardening'|'hardening_final'|undefined} [phase] - 两阶段协议：mirror / hardening 分字段持久化；缺省仅写 `valueStreamLogicText`（兼容旧调用）。
   * @returns {void}
   */
  function updateDigitalProblemValueStreamLogicText(createdAt, logicText, phase) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const idx = list.findIndex((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
    if (idx < 0) return;
    const item = list[idx];
    const lt = logicText != null ? String(logicText) : '';
    const patch = { valueStreamLogicText: lt };
    if (phase === 'mirror') patch.valueStreamLogicTextMirror = lt;
    else if (phase === 'hardening' || phase === 'hardening_final') patch.valueStreamLogicTextHardening = lt;
    list[idx] = { ...item, ...patch };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新价值流中的 IT 现状字段。
   * FE-20260325-03：不在此推进 workflowAlignCompletedStages（避免「输出已确认」被误判为 task5 已完成）。
   */
  function updateDigitalProblemValueStreamItStatus(createdAt, valueStream) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, valueStream };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新价值流中的痛点字段。
   * FE-20260325-03：不在此推进 workflowAlignCompletedStages（避免「输出已生成」被误判为 task6 已完成）。
   */
  function updateDigitalProblemValueStreamPainPoint(createdAt, valueStream) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, valueStream };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** 仅在 task4/5/6 用户确认「已完成」后写入 workflowAlignCompletedStages（与输出生成链路解耦） */
  function updateDigitalProblemWorkflowAlignCompletedStages(createdAt, workflowAlignCompletedStages) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const wf = Array.isArray(workflowAlignCompletedStages) ? [...workflowAlignCompletedStages].sort((a, b) => a - b) : [];
    list[idx] = { ...item, workflowAlignCompletedStages: wf };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新痛点标注 session 列表（环节列表，用于逐环节标注）。
   * @param {string} createdAt - 问题创建时间。
   * @param {Array<{stepName: string, stepIndex: number, stageName?: string, painPoint?: string|null}>} sessions - session 列表。
   * @returns {void}
   */
  function updateDigitalProblemPainPointSessions(createdAt, sessions) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, painPointSessions: sessions };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** task4：价值流绘制三子环节 Session 计划进度（与聊天区 `valueStreamDrawSessionsBlock` 同源） */
  function updateDigitalProblemValueStreamDrawSessions(createdAt, sessions) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const idx = list.findIndex((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, valueStreamDrawSessions: Array.isArray(sessions) ? sessions : [] };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /** task4：架构加固中间稿（仅内存/持久化草稿，不写入工作区主 `valueStream` 直至合成环节）；`draft == null` 时清除 */
  function updateDigitalProblemValueStreamHardeningDraft(createdAt, draft) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const idx = list.findIndex((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = {
      ...item,
      valueStreamHardeningDraft: draft == null ? undefined : draft && typeof draft === 'object' ? draft : undefined,
    };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新某环节的痛点标注结果，并写回价值流。
   * @param {string} createdAt - 问题创建时间。
   * @param {number} stepIndex - 环节索引（全局顺序）。
   * @param {string} painPoint - 该环节的痛点文案。
   * @returns {void}
   */
  function updateDigitalProblemPainPointStep(createdAt, stepIndex, painPoint) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const sessions = item.painPointSessions || [];
    const si = Number(stepIndex);
    // 与 adapter 一致：按 stepIndex 或数组下标匹配，避免缺省/字符串类型导致整表未更新，进而误判「已全部标注」、自动顺序只跑一环
    const newSessions = sessions.map((s, i) =>
      (Number(s.stepIndex) === si || i === si) ? { ...s, painPoint: painPoint || null } : s
    );
    const valueStream = item.valueStream;
    if (!valueStream || valueStream.raw || !Array.isArray(valueStream.stages)) {
      list[idx] = { ...item, painPointSessions: newSessions };
      localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
      return;
    }
    let globalStep = 0;
    const stages = valueStream.stages.map((s) => {
      const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
      const steps = rawSteps.map((st) => {
        const step = typeof st === 'object' && st != null ? { ...st } : { name: String(st) };
        if (globalStep === si) {
          if (painPoint != null) {
            step.painPoint = painPoint;
          } else {
            delete step.painPoint;
            delete step.pain_point;
          }
        }
        globalStep += 1;
        return step;
      });
      return { ...s, steps };
    });
    const mergedVs = { ...valueStream, stages };
    list[idx] = { ...item, painPointSessions: newSessions, valueStream: mergedVs };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 更新 IT 现状标注 session 列表（与 task6 painPointSessions 同源策略）。
   * @param {string} createdAt
   * @param {Array<{stepName: string, stepIndex: number, stageName?: string, itAnnotation?: object|null}>} sessions
   */
  function updateDigitalProblemItStatusSessions(createdAt, sessions) {
    const list = getDigitalProblems();
    const k = createdAt == null ? '' : String(createdAt);
    const idx = list.findIndex((it) => String(it.createdAt) === k || String(it.id || '') === k);
    if (idx < 0) return;
    const item = list[idx];
    list[idx] = { ...item, itStatusSessions: Array.isArray(sessions) ? sessions : [] };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 单环节 IT 现状 + IT 计划写回 itStatusSessions 与 valueStream 对应 step。
   * @param {string} createdAt
   * @param {number} stepIndex
   * @param {{type: string, detail: string}|null|undefined} itStatus
   * @param {{plan?: string}|null|undefined} itPlan
   * @param {object|null} [itAnnotation] - 写入 session 条目的 itAnnotation（含展示用文案等）
   */
  function updateDigitalProblemItStatusStep(createdAt, stepIndex, itStatus, itPlan, itAnnotation) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const sessions = item.itStatusSessions || [];
    const si = Number(stepIndex);
    const ann = itAnnotation != null && typeof itAnnotation === 'object' ? itAnnotation : null;
    const newSessions = sessions.map((s, i) =>
      Number(s.stepIndex) === si || i === si ? { ...s, itAnnotation: ann } : s
    );
    const valueStream = item.valueStream;
    if (!valueStream || valueStream.raw || !Array.isArray(valueStream.stages)) {
      list[idx] = { ...item, itStatusSessions: newSessions };
      localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
      return;
    }
    let globalStep = 0;
    const stages = valueStream.stages.map((s) => {
      const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
      const steps = rawSteps.map((st) => {
        const step = typeof st === 'object' && st != null ? { ...st } : { name: String(st) };
        if (globalStep === si) {
          if (itStatus != null && typeof itStatus === 'object') {
            step.itStatus = itStatus;
            step.it_status = itStatus;
          } else {
            delete step.itStatus;
            delete step.it_status;
          }
          delete step.itStatusLabel;
          if (itPlan != null && typeof itPlan === 'object' && String(itPlan.plan || '').trim()) {
            step.itPlan = { plan: String(itPlan.plan).trim() };
          } else {
            delete step.itPlan;
          }
        }
        globalStep += 1;
        return step;
      });
      return { ...s, steps };
    });
    const mergedVs = { ...valueStream, stages };
    list[idx] = { ...item, itStatusSessions: newSessions, valueStream: mergedVs };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 回滚价值流痛点标注及阶段完成标记。
   * @param {string} createdAt - 问题创建时间。
   * @returns {void}
   */
  function rollbackValueStreamPainPoint(createdAt) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const valueStream = item.valueStream;
    if (!valueStream || valueStream.raw) return;
    const rawStages = valueStream.stages ?? valueStream.phases ?? valueStream.nodes ?? [];
    if (!Array.isArray(rawStages)) return;
    const stages = rawStages.map((s) => {
      if (!s || typeof s !== 'object') return s;
      const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
      const steps = rawSteps.map((st) => {
        if (typeof st !== 'object' || st == null) return st;
        const { painPoint, pain_point, ...rest } = st;
        return rest;
      });
      return { ...s, steps };
    });
    const vsWithoutPain = { ...valueStream, stages };
    const wfCompleted = (item.workflowAlignCompletedStages || []).filter((x) => x !== 2).sort((a, b) => a - b);
    list[idx] = { ...item, valueStream: vsWithoutPain, workflowAlignCompletedStages: wfCompleted };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 回滚价值流上全部 IT 现状/IT 计划标注，并收回工作流对齐阶段中「IT 现状标注已完成」标记（位 1）。
   * @param {string} caseKey - `createdAt` 或 `id`（与聊天存储键一致）。
   * @returns {void}
   */
  function rollbackValueStreamItStatus(caseKey) {
    const list = getDigitalProblems();
    const k = caseKey == null ? '' : String(caseKey);
    const idx = list.findIndex((it) => String(it.createdAt) === k || String(it.id || '') === k);
    if (idx < 0) return;
    const item = list[idx];
    const valueStream = item.valueStream;
    if (!valueStream || valueStream.raw) return;
    const rawStages = valueStream.stages ?? valueStream.phases ?? valueStream.nodes ?? [];
    if (!Array.isArray(rawStages)) return;
    const stages = rawStages.map((s) => {
      if (!s || typeof s !== 'object') return s;
      const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
      const steps = rawSteps.map((st) => {
        if (typeof st !== 'object' || st == null) return st;
        const { itStatus, it_status, itPlan, it_plan, itStatusLabel, ...rest } = st;
        return rest;
      });
      return { ...s, steps };
    });
    const vsClean = { ...valueStream, stages };
    const wfCompleted = (item.workflowAlignCompletedStages || []).filter((x) => x !== 1).sort((a, b) => a - b);
    list[idx] = { ...item, valueStream: vsClean, workflowAlignCompletedStages: wfCompleted };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 删除需求逻辑并回滚需求理解阶段完成标记。
   * @param {string} createdAt - 问题创建时间。
   * @returns {void}
   */
  function deleteDigitalProblemRequirementLogic(createdAt) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return;
    const item = list[idx];
    const { requirementLogic, ...rest } = item;
    const completedStages = (item.completedStages || []).filter((x) => x !== 2).sort((a, b) => a - b);
    list[idx] = { ...rest, completedStages };
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 获取问题详情聊天记录映射。
   * @returns {Record<string, Array<Object>>} 以 createdAt 为 key 的聊天记录。
   */
  function getProblemDetailChats() {
    try {
      const raw = localStorage.getItem(global.PROBLEM_DETAIL_CHATS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /** @param {unknown} e */
  function isLocalStorageQuotaExceededError(e) {
    if (!e || typeof e !== 'object') return false;
    if (e.name === 'QuotaExceededError') return true;
    if (e.code === 22) return true;
    try {
      return typeof DOMException !== 'undefined' && e instanceof DOMException && e.code === 22;
    } catch {
      return false;
    }
  }

  /**
   * 写入 `problem_detail_chats` 整表；配额不足时删除非 protectedKeys 的键（按单键 JSON 体积从大到小）直至成功或无可删。
   * @param {Record<string, unknown>} chats
   * @param {Set<string>|string[]} protectedKeys
   * @returns {boolean} 是否已成功 setItem
   */
  function persistProblemDetailChatsMapWithQuotaRecovery(chats, protectedKeys) {
    const storageKey = global.PROBLEM_DETAIL_CHATS_STORAGE_KEY;
    const protect = new Set(
      Array.isArray(protectedKeys)
        ? protectedKeys.map((k) => String(k))
        : protectedKeys instanceof Set
          ? [...protectedKeys].map((k) => String(k))
          : [],
    );
    const tryWrite = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(chats));
        return true;
      } catch (e) {
        if (isLocalStorageQuotaExceededError(e)) return false;
        throw e;
      }
    };
    if (tryWrite()) return true;
    const sizeOfKey = (k) => {
      try {
        return JSON.stringify(chats[k]).length;
      } catch {
        return 0;
      }
    };
    const victims = Object.keys(chats)
      .filter((k) => !protect.has(String(k)))
      .sort((a, b) => sizeOfKey(b) - sizeOfKey(a));
    for (let i = 0; i < victims.length; i++) {
      delete chats[victims[i]];
      if (tryWrite()) {
        try {
          console.warn('[FE:problem-detail-chats-quota] 已移除其它案例本地聊天记录键以腾出配额:', victims[i]);
        } catch (_) {}
        return true;
      }
    }
    try {
      console.warn(
        '[FE:problem-detail-chats-quota] localStorage 仍无法写入 problem_detail_chats（当前案例数据可能已超过配额，或站点存储已满）。可导出/删旧案例或清理本站站点数据。',
      );
    } catch (_) {}
    return false;
  }

  /**
   * 保存某问题的详情聊天记录。
   * @param {string} createdAt - 问题创建时间。
   * @param {Array<Object>} messages - 聊天消息数组。
   * @returns {void}
   */
  /**
   * 直接写 localStorage 的聊天映射，对同一案例的 createdAt / id 等键同步为同一数组（不经过 Http 适配器），避免双键残留导致沟通历史误读旧过程日志。
   * @param {{ createdAt?: string, id?: string }} item
   * @param {Array<Object>} messages
   */
  function saveProblemDetailChatLocalStorageMulticast(item, messages) {
    if (!item || typeof item !== 'object') return;
    const keys = [];
    if (item.createdAt != null && String(item.createdAt).trim() !== '') keys.push(String(item.createdAt));
    if (item.id != null && String(item.id).trim() !== '') keys.push(String(item.id).trim());
    const uniq = [...new Set(keys.filter(Boolean))];
    if (uniq.length === 0) return;
    let chats = {};
    try {
      const raw = localStorage.getItem(global.PROBLEM_DETAIL_CHATS_STORAGE_KEY);
      chats = raw ? JSON.parse(raw) : {};
      if (!chats || typeof chats !== 'object') chats = {};
    } catch {
      chats = {};
    }
    const arr = Array.isArray(messages) ? messages.slice() : [];
    uniq.forEach((k) => {
      chats[k] = arr;
    });
    persistProblemDetailChatsMapWithQuotaRecovery(chats, uniq);
  }

  function saveProblemDetailChat(createdAt, messages) {
    const ck = String(createdAt);
    // 与 Http 适配器一致：单条 system 占位「请输入客户基本信息」不写入本地（防御性收口）
    if (Array.isArray(messages) && messages.length === 1) {
      const m = messages[0];
      if (
        m &&
        m.role === 'system' &&
        String(m.content || '').trim() === '请输入客户基本信息' &&
        (m.type == null || m.type === '')
      ) {
        const chats = getProblemDetailChats();
        chats[ck] = [];
        persistProblemDetailChatsMapWithQuotaRecovery(chats, [ck]);
        return;
      }
    }
    const chats = getProblemDetailChats();
    chats[ck] = messages;
    persistProblemDetailChatsMapWithQuotaRecovery(chats, [ck]);
  }

  /**
   * 获取操作历史栈映射。
   * @returns {Record<string, Array<Object>>} 历史记录映射。
   */
  function getOperationHistory() {
    try {
      const raw = localStorage.getItem(global.OPERATION_HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * 向操作历史压栈一条记录。
   * @param {string} createdAt - 问题创建时间。
   * @param {string} type - 操作类型。
   * @param {Object} snapshot - 数据快照。
   * @param {number} chatLengthBefore - 操作前聊天长度。
   * @returns {void}
   */
  function pushOperationToHistory(createdAt, type, snapshot, chatLengthBefore) {
    const all = getOperationHistory();
    if (!all[createdAt]) all[createdAt] = [];
    all[createdAt].push({ type, timestamp: Date.now(), snapshot, chatLengthBefore });
    localStorage.setItem(global.OPERATION_HISTORY_STORAGE_KEY, JSON.stringify(all));
  }

  /**
   * 从操作历史弹出最近一条记录。
   * @param {string} createdAt - 问题创建时间。
   * @returns {Object|null} 最近一次历史记录。
   */
  function popOperationFromHistory(createdAt) {
    const all = getOperationHistory();
    const stack = all[createdAt];
    if (!Array.isArray(stack) || stack.length === 0) return null;
    const entry = stack.pop();
    all[createdAt] = stack;
    localStorage.setItem(global.OPERATION_HISTORY_STORAGE_KEY, JSON.stringify(all));
    return entry;
  }

  /**
   * 使用快照恢复问题单数据。
   * @param {string} createdAt - 问题创建时间。
   * @param {Object} snapshot - 快照对象。
   * @returns {void}
   */
  function restoreItemFromSnapshot(createdAt, snapshot) {
    const list = getDigitalProblems();
    const k = String(createdAt);
    const idx = list.findIndex((it) => String(it.createdAt) === k || String(it.id || '') === k);
    if (idx < 0) return;
    const prev = list[idx];
    list[idx] = {
      ...snapshot,
      createdAt: prev.createdAt != null && String(prev.createdAt).trim() !== '' ? prev.createdAt : snapshot.createdAt,
    };
    if (prev.id != null && String(prev.id).trim() !== '') list[idx].id = prev.id;
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 获取任务跟踪数据映射。
   * @returns {Record<string, Object>} 跟踪数据映射。
   */
  function getTaskTrackingData() {
    try {
      const raw = localStorage.getItem(global.TASK_TRACKING_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * 保存某问题的任务跟踪数据。
   * @param {string} createdAt - 问题创建时间。
   * @param {Object} data - 跟踪数据。
   * @returns {void}
   */
  function saveTaskTrackingData(createdAt, data) {
    const all = getTaskTrackingData();
    all[createdAt] = data;
    localStorage.setItem(global.TASK_TRACKING_STORAGE_KEY, JSON.stringify(all));
  }

  /** 回退到上一个任务阶段：清空上一阶段所有数据，将 currentMajorStage 设为上一阶段，并返回更新后的问题单；若已在阶段 0 则返回 null */
  function rollbackDigitalProblemToPreviousStage(createdAt) {
    const list = getDigitalProblems();
    const idx = list.findIndex((it) => it.createdAt === createdAt);
    if (idx < 0) return null;
    const item = list[idx];
    const currentMajorStage = item.currentMajorStage ?? 0;
    if (currentMajorStage <= 0) return null;
    const targetStage = currentMajorStage - 1;
    let nextItem = { ...item, currentMajorStage: targetStage };
    if (targetStage === 0) {
      nextItem = {
        ...nextItem,
        completedStages: [],
        basicInfo: undefined,
        bmc: undefined,
        requirementLogic: undefined,
        workflowAlignCompletedStages: [],
        itGapCompletedStages: [],
        valueStream: undefined,
        valueStreamDrawSessions: undefined,
        valueStreamHardeningDraft: undefined,
        e2eFlowLandscapeJson: undefined,
        e2eTransactionFlowJson: undefined,
        e2eRequirementScenarioSupplementJson: undefined,
        globalItGapAnalysisJson: undefined,
        localItGapSessions: undefined,
        localItGapAnalyses: undefined,
        completedTaskIds: [],
      };
    } else if (targetStage === 1) {
      nextItem = {
        ...nextItem,
        workflowAlignCompletedStages: [],
        valueStream: undefined,
        valueStreamDrawSessions: undefined,
        valueStreamHardeningDraft: undefined,
        e2eFlowLandscapeJson: undefined,
        e2eTransactionFlowJson: undefined,
        e2eRequirementScenarioSupplementJson: undefined,
        itGapCompletedStages: [],
        globalItGapAnalysisJson: undefined,
        localItGapSessions: undefined,
        localItGapAnalyses: undefined,
        completedTaskIds: [],
      };
    } else if (targetStage === 2) {
      nextItem = {
        ...nextItem,
        itGapCompletedStages: [],
        e2eFlowLandscapeJson: undefined,
        e2eTransactionFlowJson: undefined,
        e2eRequirementScenarioSupplementJson: undefined,
        globalItGapAnalysisJson: undefined,
        localItGapSessions: undefined,
        localItGapAnalyses: undefined,
        completedTaskIds: [],
      };
    }
    list[idx] = nextItem;
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));
    return nextItem;
  }

  /**
   * online 下 `updateDigitalProblem` 为浅合并：重置时须显式写入空阶段/完成态与会话相关字段，
   * 否则旧键残留会导致 `resolveProblemItemForTaskNotification` 并集后仍认为 task10 等已完成（FE-20260328-14）。
   * @returns {Object}
   */
  function buildResetPreliminaryAdapterMergeClears() {
    return {
      currentMajorStage: 0,
      currentItStrategySubstep: 0,
      completedStages: [],
      completedTaskIds: [],
      workflowAlignCompletedStages: [],
      itGapCompletedStages: [],
      /** 顶栏「重置」全量回 task1 待执行：清空工商与需求摘要字段（与 buildResetPreliminaryItem 合并后 requirement* 仍以 Item 为准） */
      customerNeedsOrChallenges: null,
      customerItStatus: null,
      projectTimeRequirement: null,
      requirementDetail: null,
      requirementDetailHistory: null,
      operationModel: null,
      businessStatus: null,
      urgencyAnalysis: null,
      e2eFlowWorkspaceSuppressed: null,
      /** 顶栏重置：不在此写 `basicInfo: null`，避免 repository 对 Json 合并路径异常；未确认工商态由内存合并 `main.js` 在重置后显式 `basicInfo: undefined` 呈现，刷新后若后端仍有旧工商可再点重置或走专门清空接口 */
      basicInfo: undefined,
      bmc: null,
      requirementLogic: null,
      valueStream: null,
      e2eFlowLandscapeJson: undefined,
      e2eTransactionFlowJson: undefined,
      e2eRequirementScenarioSupplementJson: undefined,
      globalItGapAnalysisJson: null,
      globalItGapConstraintBaseMarkdown: undefined,
      localItGapSessions: null,
      localItGapAnalyses: null,
      rolePermissionSessions: null,
      rolePermissionModel: undefined,
      coreBusinessObjectSessions: null,
      coreBusinessObjectSystemPromptOverride: null,
      itDesignSupplementSessions: null,
      roleTaskCenterPortalDesignJson: null,
      objectStateMachineJson: null,
      painPointSessions: undefined,
      itStatusSessions: undefined,
      valueStreamDrawSessions: undefined,
      valueStreamHardeningDraft: undefined,
      valueStreamLogicText: undefined,
      valueStreamLogicTextMirror: undefined,
      valueStreamLogicTextHardening: undefined,
      task1InitialLlmQuery: null,
      preliminaryReq: null,
      task1PendingPreliminaryRequirement: null,
    };
  }

  /**
   * 构造「顶栏重置」后保留的档案壳：仅客户名与编号；需求/历史正文由 clears 与下方字段一并清空。
   * @param {Object} item - 当前列表中的问题行
   * @returns {Object|null}
   */
  function buildResetPreliminaryItem(item) {
    if (!item || typeof item !== 'object') return null;
    const createdAt = item.createdAt || item.id;
    return {
      createdAt,
      archiveNo: item.archiveNo,
      customerName: item.customerName ?? item.customer_name ?? '',
      requirementDetail: '',
      requirementDetailHistory: [],
    };
  }

  /** @param {{ createdAt?: string, id?: string }} item */
  function collectCaseSideStorageKeys(item) {
    if (!item || typeof item !== 'object') return [];
    const keys = [];
    if (item.createdAt != null && String(item.createdAt).trim() !== '') keys.push(String(item.createdAt).trim());
    if (item.id != null && String(item.id).trim() !== '') keys.push(String(item.id).trim());
    return [...new Set(keys)];
  }

  /** 从操作历史 / 任务追踪映射中删除本案例所有别名键（online 的 Skill 时间线等仍落在本地 KV） */
  function purgeCaseKeysFromSideMap(map, keys) {
    if (!Array.isArray(keys)) return map && typeof map === 'object' ? { ...map } : {};
    const next = map && typeof map === 'object' ? { ...map } : {};
    keys.forEach((k) => {
      if (k) delete next[k];
    });
    return next;
  }

  /** 顶栏「重置」：回到 task1 待执行，清空工作区/会话/聊天侧数据（纯 localStorage 路径与 adapter 路径语义对齐） */
  function resetDigitalProblemToPreliminary(createdAt) {
    const list = getDigitalProblems();
    const key = String(createdAt);
    const idx = list.findIndex(
      (it) => String(it.createdAt || '') === key || String(it.id || '') === key,
    );
    if (idx < 0) return false;
    const prev = list[idx];
    const resetBase = buildResetPreliminaryItem(prev);
    if (!resetBase) return false;
    const clears = buildResetPreliminaryAdapterMergeClears();
    const finalItem = { ...clears, ...resetBase, createdAt: prev.createdAt || resetBase.createdAt };
    if (prev.id != null && prev.id !== '') finalItem.id = prev.id;
    list[idx] = finalItem;
    localStorage.setItem(global.DIGITAL_PROBLEMS_STORAGE_KEY, JSON.stringify(list));

    saveProblemDetailChatLocalStorageMulticast(prev, []);

    const opHistory = purgeCaseKeysFromSideMap(getOperationHistory(), aliasKeys);
    localStorage.setItem(global.OPERATION_HISTORY_STORAGE_KEY, JSON.stringify(opHistory));
    const tracking = purgeCaseKeysFromSideMap(getTaskTrackingData(), aliasKeys);
    localStorage.setItem(global.TASK_TRACKING_STORAGE_KEY, JSON.stringify(tracking));
    return finalItem;
  }

  global.rollbackDigitalProblemToPreviousStage = rollbackDigitalProblemToPreviousStage;
  global.resetDigitalProblemToPreliminary = resetDigitalProblemToPreliminary;
  global.getSavedAnalyses = getSavedAnalyses;
  global.saveAnalysis = saveAnalysis;
  global.saveRouteState = saveRouteState;
  global.getDigitalProblems = getDigitalProblems;
  global.saveDigitalProblem = saveDigitalProblem;
  global.saveDigitalProblemsSnapshot = saveDigitalProblemsSnapshot;
  global.applyDigitalProblemsArchiveNoMigration = applyDigitalProblemsArchiveNoMigration;
  global.peekNextDigitalProblemArchiveNo = peekNextDigitalProblemArchiveNo;
  global.ensureDigitalProblemArchiveNosPersisted = ensureDigitalProblemArchiveNosPersisted;
  global.removeDigitalProblem = removeDigitalProblem;
  global.updateDigitalProblemBasicInfo = updateDigitalProblemBasicInfo;
  global.updateDigitalProblemBmc = updateDigitalProblemBmc;
  global.updateDigitalProblemRequirementLogic = updateDigitalProblemRequirementLogic;
  global.updateDigitalProblemMajorStage = updateDigitalProblemMajorStage;
  global.updateDigitalProblemItGapCompletedStages = updateDigitalProblemItGapCompletedStages;
  global.updateDigitalProblemCompletedTaskId = updateDigitalProblemCompletedTaskId;
  global.updateDigitalProblemGlobalItGapAnalysis = updateDigitalProblemGlobalItGapAnalysis;
  global.updateDigitalProblemGlobalItGapConstraintBase = updateDigitalProblemGlobalItGapConstraintBase;
  global.updateDigitalProblemE2eFlowLandscape = updateDigitalProblemE2eFlowLandscape;
  global.updateDigitalProblemE2eTransactionFlow = updateDigitalProblemE2eTransactionFlow;
  global.updateDigitalProblemE2eRequirementScenarioSupplement = updateDigitalProblemE2eRequirementScenarioSupplement;
  global.clearDigitalProblemGlobalItGapAnalysis = clearDigitalProblemGlobalItGapAnalysis;
  global.updateDigitalProblemLocalItGapSessions = updateDigitalProblemLocalItGapSessions;
  global.updateDigitalProblemRoleTaskCenterPortalDesign = updateDigitalProblemRoleTaskCenterPortalDesign;
  global.updateDigitalProblemObjectStateMachine = updateDigitalProblemObjectStateMachine;
  global.updateDigitalProblemLocalItGapAnalysis = updateDigitalProblemLocalItGapAnalysis;
  global.clearDigitalProblemLocalItGapStep = clearDigitalProblemLocalItGapStep;
  global.updateDigitalProblemRolePermissionSessions = updateDigitalProblemRolePermissionSessions;
  global.updateDigitalProblemRolePermissionStep = updateDigitalProblemRolePermissionStep;
  global.updateDigitalProblemCoreBusinessObjectSessions = updateDigitalProblemCoreBusinessObjectSessions;
  global.updateDigitalProblemCoreBusinessObjectSystemPromptOverride = updateDigitalProblemCoreBusinessObjectSystemPromptOverride;
  global.removeDigitalProblemCompletedTaskId = removeDigitalProblemCompletedTaskId;
  global.clearDigitalProblemRolePermissionStep = clearDigitalProblemRolePermissionStep;
  global.updateDigitalProblemValueStreamDataOnly = updateDigitalProblemValueStreamDataOnly;
  global.updateDigitalProblemValueStream = updateDigitalProblemValueStream;
  global.updateDigitalProblemValueStreamLogicText = updateDigitalProblemValueStreamLogicText;
  global.updateDigitalProblemValueStreamItStatus = updateDigitalProblemValueStreamItStatus;
  global.updateDigitalProblemValueStreamPainPoint = updateDigitalProblemValueStreamPainPoint;
  global.updateDigitalProblemWorkflowAlignCompletedStages = updateDigitalProblemWorkflowAlignCompletedStages;
  global.updateDigitalProblemPainPointSessions = updateDigitalProblemPainPointSessions;
  global.updateDigitalProblemPainPointStep = updateDigitalProblemPainPointStep;
  global.updateDigitalProblemItDesignSupplementSessions = updateDigitalProblemItDesignSupplementSessions;
  global.updateDigitalProblemTask8ItDesignPlanReset = updateDigitalProblemTask8ItDesignPlanReset;
  global.updateDigitalProblemItDesignSupplementStep = updateDigitalProblemItDesignSupplementStep;
  global.updateDigitalProblemItDesignSupplementBpmDraw = updateDigitalProblemItDesignSupplementBpmDraw;
  global.updateDigitalProblemItStatusSessions = updateDigitalProblemItStatusSessions;
  global.updateDigitalProblemItStatusStep = updateDigitalProblemItStatusStep;
  global.rollbackValueStreamPainPoint = rollbackValueStreamPainPoint;
  global.rollbackValueStreamItStatus = rollbackValueStreamItStatus;
  global.deleteDigitalProblemRequirementLogic = deleteDigitalProblemRequirementLogic;
  global.getProblemDetailChats = getProblemDetailChats;
  global.saveProblemDetailChat = saveProblemDetailChat;
  global.saveProblemDetailChatLocalStorageMulticast = saveProblemDetailChatLocalStorageMulticast;
  global.getProblemDetailTaskSummaries = function () { return {}; };
  global.refreshProblemDetailBundle = async function () { return null; };
  global.getOperationHistory = getOperationHistory;
  global.pushOperationToHistory = pushOperationToHistory;
  global.popOperationFromHistory = popOperationFromHistory;
  global.restoreItemFromSnapshot = restoreItemFromSnapshot;
  global.getTaskTrackingData = getTaskTrackingData;
  global.saveTaskTrackingData = saveTaskTrackingData;

  /** online / local（IndexedDB）模式下将存储委托给适配器 */
  const cfg = global.APP_CONFIG || {};
  const useBackend = (cfg.MODE === 'online') && global.STORAGE_HTTP_ADAPTER;
  const useLocalIndexedDb = (cfg.MODE === 'local') && global.STORAGE_INDEXEDDB_ADAPTER;
  if (useBackend || useLocalIndexedDb) {
    const adapter = useBackend ? global.STORAGE_HTTP_ADAPTER : global.STORAGE_INDEXEDDB_ADAPTER;
    if (!useBackend) {
      global.getSavedAnalyses = () => adapter.getSavedAnalyses();
      global.saveAnalysis = (record) => adapter.saveAnalysis(record);
      global.saveDigitalProblemsSnapshot = (list) => adapter.saveDigitalProblemsSnapshot(list);
      global.getOperationHistory = () => adapter.getOperationHistory();
      global.getTaskTrackingData = () => adapter.getTaskTrackingData();
      global.saveTaskTrackingData = (createdAt, data) => adapter.saveTaskTrackingData(createdAt, data);
      global.saveProblemDetailChat = (createdAt, messages) => adapter.saveProblemDetailChat(createdAt, messages);
      global.getProblemDetailChats = () => adapter.getProblemDetailChats();
      global.pushOperationToHistory = function (createdAt, type, snapshot, chatLengthBefore) {
        const all = adapter.getOperationHistory();
        if (!all[createdAt]) all[createdAt] = [];
        all[createdAt].push({ type, timestamp: Date.now(), snapshot, chatLengthBefore });
        adapter.saveOperationHistory(all);
      };
      global.popOperationFromHistory = function (createdAt) {
        const all = adapter.getOperationHistory();
        const stack = all[createdAt];
        if (!Array.isArray(stack) || stack.length === 0) return null;
        const entry = stack.pop();
        all[createdAt] = stack;
        adapter.saveOperationHistory(all);
        return entry;
      };
    }

    global.getDigitalProblems = () => adapter.getDigitalProblems();
    global.saveDigitalProblem = (item) => adapter.saveDigitalProblem(item);
    global.removeDigitalProblem = (index) => adapter.removeDigitalProblem(index);
    global.getProblemDetailChats = () => adapter.getProblemDetailChats();
    global.saveProblemDetailChat = (createdAt, messages) => adapter.saveProblemDetailChat(createdAt, messages);
    if (useBackend) {
      global.getProblemDetailTaskSummaries = () => (
        typeof adapter.getProblemDetailTaskSummaries === 'function' ? adapter.getProblemDetailTaskSummaries() : {}
      );
      global.refreshProblemDetailBundle = (createdAt) => (
        typeof adapter.refreshProblemDetailBundle === 'function' ? adapter.refreshProblemDetailBundle(createdAt) : Promise.resolve(null)
      );
    }

    const upd = (createdAt, updates) => adapter.updateDigitalProblem(createdAt, updates);
    const getItem = (createdAt) => {
      const key = String(createdAt);
      return adapter.getDigitalProblems().find((it) => String(it.createdAt || '') === key || String(it.id || '') === key);
    };

    global.updateDigitalProblemBasicInfo = function (createdAt, basicInfo, markTaskComplete) {
      const item = getItem(createdAt);
      if (!item) return;
      const updates = { basicInfo };
      if (markTaskComplete !== false) {
        const completed = [...(item.completedStages || []), 0].filter((a, i, arr) => arr.indexOf(a) === i).sort((a, b) => a - b);
        updates.completedStages = completed;
      }
      upd(createdAt, updates);
    };
    global.updateDigitalProblemBmc = function (createdAt, bmc, markTaskComplete) {
      const item = getItem(createdAt);
      if (!item) return;
      const updates = { bmc };
      if (markTaskComplete !== false) {
        const completed = [...(item.completedStages || []), 1].filter((a, i, arr) => arr.indexOf(a) === i).sort((a, b) => a - b);
        updates.completedStages = completed;
      }
      upd(createdAt, updates);
    };
    global.updateDigitalProblemRequirementLogic = function (createdAt, requirementLogic, markTaskComplete) {
      const item = getItem(createdAt);
      if (!item) return;
      const updates = { requirementLogic };
      if (markTaskComplete !== false) {
        const completed = [...(item.completedStages || []), 2].filter((a, i, arr) => arr.indexOf(a) === i).sort((a, b) => a - b);
        updates.completedStages = completed;
      }
      upd(createdAt, updates);
    };
    global.updateDigitalProblemMajorStage = (createdAt, majorStage) => upd(createdAt, { currentMajorStage: majorStage });
    global.updateDigitalProblemItGapCompletedStages = (createdAt, stages) => upd(createdAt, { itGapCompletedStages: stages });
    global.updateDigitalProblemCompletedTaskId = function (createdAt, taskId) {
      const item = getItem(createdAt);
      if (!item || (item.completedTaskIds || []).includes(taskId)) return;
      const completed = [...(item.completedTaskIds || []), taskId].sort();
      upd(createdAt, { completedTaskIds: completed });
    };
    global.updateDigitalProblemGlobalItGapAnalysis = function (createdAt, analysisJson) {
      const item = getItem(createdAt);
      if (!item) return;
      const itGapCompleted = [...(item.itGapCompletedStages || []), 1].filter((a, i, arr) => arr.indexOf(a) === i).sort((a, b) => a - b);
      upd(createdAt, { globalItGapAnalysisJson: analysisJson, itGapCompletedStages: itGapCompleted });
    };
    global.updateDigitalProblemGlobalItGapConstraintBase = function (createdAt, constraintBaseMarkdown) {
      if (constraintBaseMarkdown == null || constraintBaseMarkdown === '') {
        upd(createdAt, { globalItGapConstraintBaseMarkdown: undefined });
      } else {
        upd(createdAt, { globalItGapConstraintBaseMarkdown: constraintBaseMarkdown });
      }
    };
    global.updateDigitalProblemE2eFlowLandscape = function (createdAt, landscapeJson) {
      if (landscapeJson == null || landscapeJson === '') {
        upd(createdAt, { e2eFlowLandscapeJson: undefined });
      } else {
        upd(createdAt, { e2eFlowLandscapeJson: landscapeJson });
      }
    };
    global.updateDigitalProblemE2eTransactionFlow = function (createdAt, transactionFlowJson) {
      if (transactionFlowJson == null || transactionFlowJson === '') {
        upd(createdAt, { e2eTransactionFlowJson: undefined });
      } else {
        upd(createdAt, { e2eTransactionFlowJson: transactionFlowJson });
      }
    };
    global.updateDigitalProblemE2eRequirementScenarioSupplement = function (createdAt, supplementJson) {
      if (supplementJson == null || supplementJson === '') {
        upd(createdAt, { e2eRequirementScenarioSupplementJson: undefined });
      } else {
        upd(createdAt, { e2eRequirementScenarioSupplementJson: supplementJson });
      }
    };
    global.clearDigitalProblemGlobalItGapAnalysis = function (createdAt) {
      const item = getItem(createdAt);
      if (!item) return;
      const itGapCompleted = (item.itGapCompletedStages || []).filter((x) => x !== 1 && x !== 2).sort((a, b) => a - b);
      upd(createdAt, {
        globalItGapAnalysisJson: undefined,
        globalItGapConstraintBaseMarkdown: undefined,
        localItGapAnalyses: undefined,
        localItGapSessions: undefined,
        roleTaskCenterPortalDesignJson: undefined,
        objectStateMachineJson: undefined,
        itDesignSupplementSessions: undefined,
        itGapCompletedStages: itGapCompleted,
      });
    };
    global.updateDigitalProblemLocalItGapSessions = (createdAt, sessions) => upd(createdAt, { localItGapSessions: sessions });
    global.updateDigitalProblemRoleTaskCenterPortalDesign = (createdAt, portalJson) => {
      if (portalJson == null || portalJson === '') {
        upd(createdAt, { roleTaskCenterPortalDesignJson: undefined });
      } else {
        upd(createdAt, { roleTaskCenterPortalDesignJson: portalJson });
      }
    };
    global.updateDigitalProblemObjectStateMachine = (createdAt, stateMachineJson) => {
      if (stateMachineJson == null || stateMachineJson === '') {
        upd(createdAt, { objectStateMachineJson: undefined });
      } else {
        upd(createdAt, { objectStateMachineJson: stateMachineJson });
      }
    };
    global.updateDigitalProblemLocalItGapAnalysis = function (createdAt, stepName, stepIndex, analysisJson, analysisMarkdown) {
      const item = getItem(createdAt);
      if (!item) return;
      const si = Number(stepIndex);
      const analyses = (item.localItGapAnalyses || []).filter((a) => Number(a.stepIndex) !== si);
      analyses.push({ stepName, stepIndex: si, analysisJson });
      analyses.sort((a, b) => a.stepIndex - b.stepIndex);
      const sessions = item.localItGapSessions || [];
      const newSessions = sessions.length > 0
        ? sessions.map((s, i) =>
            i === si || Number(s.stepIndex) === si ? { ...s, analysisJson, analysisMarkdown: analysisMarkdown || s.analysisMarkdown } : s
          )
        : [];
      upd(createdAt, { localItGapAnalyses: analyses, localItGapSessions: newSessions.length ? newSessions : undefined });
    };
    global.clearDigitalProblemLocalItGapStep = function (createdAt, stepIndex) {
      const item = getItem(createdAt);
      if (!item) return;
      const si = Number(stepIndex);
      const sessions = (item.localItGapSessions || []).map((s, i) =>
        i === si || Number(s.stepIndex) === si ? { ...s, analysisJson: undefined, analysisMarkdown: undefined } : s
      );
      const analyses = (item.localItGapAnalyses || []).filter((a) => Number(a.stepIndex) !== si);
      upd(createdAt, { localItGapSessions: sessions, localItGapAnalyses: analyses });
    };
    global.updateDigitalProblemRolePermissionSessions = (createdAt, sessions) => upd(createdAt, { rolePermissionSessions: sessions });
    global.updateDigitalProblemRolePermissionStep = function (createdAt, stepIndex, rolePermissionJson) {
      const item = getItem(createdAt);
      if (!item) return;
      const si = Number(stepIndex);
      const sessions = (item.rolePermissionSessions || []).map((s) =>
        Number(s.stepIndex) === si ? { ...s, rolePermissionJson } : s
      );
      upd(createdAt, { rolePermissionSessions: sessions });
    };
    global.clearDigitalProblemRolePermissionStep = function (createdAt, stepIndex) {
      const item = getItem(createdAt);
      if (!item) return;
      const si = Number(stepIndex);
      const sessions = (item.rolePermissionSessions || []).map((s) =>
        Number(s.stepIndex) === si ? { ...s, rolePermissionJson: undefined } : s
      );
      upd(createdAt, { rolePermissionSessions: sessions });
    };
    /** online：task11 sessions 必须走 adapter 内存 + PUT，不能只写 localStorage（FE-20260322-06） */
    global.updateDigitalProblemCoreBusinessObjectSessions = function (createdAt, sessions) {
      const item = getItem(createdAt);
      if (!item) return;
      upd(createdAt, { coreBusinessObjectSessions: sessions });
    };
    global.updateDigitalProblemCoreBusinessObjectSystemPromptOverride = function (createdAt, text) {
      const item = getItem(createdAt);
      if (!item) return;
      const v = text != null && String(text).trim() !== '' ? String(text).trim() : null;
      upd(createdAt, { coreBusinessObjectSystemPromptOverride: v });
    };
    global.removeDigitalProblemCompletedTaskId = function (createdAt, taskId) {
      const item = getItem(createdAt);
      if (!item) return;
      const tid = String(taskId || '');
      const next = (item.completedTaskIds || []).filter((id) => String(id) !== tid);
      upd(createdAt, { completedTaskIds: next });
    };
    global.updateDigitalProblemValueStreamDataOnly = (createdAt, valueStream) => upd(createdAt, { valueStream });
    /** FE-20260325-03：仅写 valueStream，不附带推进 workflowAlignCompletedStages */
    global.updateDigitalProblemValueStream = (createdAt, valueStream) => upd(createdAt, { valueStream });
    global.updateDigitalProblemValueStreamLogicText = (createdAt, logicText, phase) => {
      const lt = logicText != null ? String(logicText) : '';
      const patch = { valueStreamLogicText: lt };
      if (phase === 'mirror') patch.valueStreamLogicTextMirror = lt;
      else if (phase === 'hardening' || phase === 'hardening_final') patch.valueStreamLogicTextHardening = lt;
      upd(createdAt, patch);
    };
    global.updateDigitalProblemValueStreamItStatus = (createdAt, valueStream) => upd(createdAt, { valueStream });
    global.updateDigitalProblemValueStreamPainPoint = (createdAt, valueStream) => upd(createdAt, { valueStream });
    global.updateDigitalProblemWorkflowAlignCompletedStages = (createdAt, workflowAlignCompletedStages) =>
      upd(createdAt, {
        workflowAlignCompletedStages: Array.isArray(workflowAlignCompletedStages) ? workflowAlignCompletedStages : [],
      });
    /** online：task6 痛点 session 列表写 adapter + PUT（与 task11 sessions 同源策略，FE-20260322-10） */
    global.updateDigitalProblemPainPointSessions = function (createdAt, sessions) {
      const item = getItem(createdAt);
      if (!item) return;
      upd(createdAt, { painPointSessions: sessions });
    };
    global.updateDigitalProblemValueStreamDrawSessions = function (createdAt, sessions) {
      if (!getItem(createdAt)) return;
      upd(createdAt, { valueStreamDrawSessions: Array.isArray(sessions) ? sessions : [] });
    };
    global.updateDigitalProblemValueStreamHardeningDraft = function (createdAt, draft) {
      if (!getItem(createdAt)) return;
      if (draft == null) upd(createdAt, { valueStreamHardeningDraft: undefined });
      else if (draft && typeof draft === 'object') upd(createdAt, { valueStreamHardeningDraft: draft });
    };
    /** online：单步痛点写回 painPointSessions 与 valueStream 对应 step（与 local 版语义一致） */
    global.updateDigitalProblemItDesignSupplementSessions = function (createdAt, sessions) {
      if (!getItem(createdAt)) return;
      upd(createdAt, { itDesignSupplementSessions: Array.isArray(sessions) ? sessions : [] });
    };
    global.updateDigitalProblemTask8ItDesignPlanReset = function (createdAt, sessions) {
      const item = getItem(createdAt);
      if (!item) return;
      const itGapCompleted = (item.itGapCompletedStages || []).filter((x) => x !== 1);
      upd(createdAt, {
        itDesignSupplementSessions: Array.isArray(sessions) ? sessions : [],
        globalItGapAnalysisJson: undefined,
        globalItGapConstraintBaseMarkdown: undefined,
        itGapCompletedStages: itGapCompleted,
      });
    };
    global.updateDigitalProblemItDesignSupplementStep = function (createdAt, stepIndex, designOutputJson) {
      const item = getItem(createdAt);
      if (!item) return;
      const sessions = item.itDesignSupplementSessions || [];
      const si = Number(stepIndex);
      const newSessions = sessions.map((s, i) =>
        Number(s.stepIndex) === si || i === si ? { ...s, designOutputJson: designOutputJson != null ? designOutputJson : null } : s,
      );
      upd(createdAt, { itDesignSupplementSessions: newSessions });
    };
    global.updateDigitalProblemItDesignSupplementBpmDraw = function (createdAt, stepIndex, bpmFlowDrawMarkdown) {
      const item = getItem(createdAt);
      if (!item) return;
      const sessions = item.itDesignSupplementSessions || [];
      const si = Number(stepIndex);
      const md = bpmFlowDrawMarkdown != null ? String(bpmFlowDrawMarkdown) : '';
      const newSessions = sessions.map((s, i) =>
        Number(s.stepIndex) === si || i === si ? { ...s, bpmFlowDrawMarkdown: md } : s,
      );
      upd(createdAt, { itDesignSupplementSessions: newSessions });
    };
    global.updateDigitalProblemPainPointStep = function (createdAt, stepIndex, painPoint) {
      const item = getItem(createdAt);
      if (!item) return;
      const si = Number(stepIndex);
      const sessions = item.painPointSessions || [];
      const newSessions = sessions.map((s, i) =>
        (Number(s.stepIndex) === si || i === si) ? { ...s, painPoint: painPoint || null } : s
      );
      const valueStream = item.valueStream;
      if (!valueStream || valueStream.raw || !Array.isArray(valueStream.stages)) {
        upd(createdAt, { painPointSessions: newSessions });
        return;
      }
      let globalStep = 0;
      const stages = valueStream.stages.map((s) => {
        const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
        const steps = rawSteps.map((st) => {
          const step = typeof st === 'object' && st != null ? { ...st } : { name: String(st) };
          if (globalStep === si) {
            if (painPoint != null) {
              step.painPoint = painPoint;
            } else {
              delete step.painPoint;
              delete step.pain_point;
            }
          }
          globalStep += 1;
          return step;
        });
        return { ...s, steps };
      });
      const mergedVs = { ...valueStream, stages };
      upd(createdAt, { painPointSessions: newSessions, valueStream: mergedVs });
    };
    global.updateDigitalProblemItStatusSessions = function (createdAt, sessions) {
      if (!getItem(createdAt)) return;
      upd(createdAt, { itStatusSessions: Array.isArray(sessions) ? sessions : [] });
    };
    global.updateDigitalProblemItStatusStep = function (createdAt, stepIndex, itStatus, itPlan, itAnnotation) {
      const item = getItem(createdAt);
      if (!item) return;
      const si = Number(stepIndex);
      const sessions = item.itStatusSessions || [];
      const ann = itAnnotation != null && typeof itAnnotation === 'object' ? itAnnotation : null;
      const newSessions = sessions.map((s, i) =>
        (Number(s.stepIndex) === si || i === si) ? { ...s, itAnnotation: ann } : s
      );
      const valueStream = item.valueStream;
      if (!valueStream || valueStream.raw || !Array.isArray(valueStream.stages)) {
        upd(createdAt, { itStatusSessions: newSessions });
        return;
      }
      let globalStep = 0;
      const stages = valueStream.stages.map((s) => {
        const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
        const steps = rawSteps.map((st) => {
          const step = typeof st === 'object' && st != null ? { ...st } : { name: String(st) };
          if (globalStep === si) {
            if (itStatus != null && typeof itStatus === 'object') {
              step.itStatus = itStatus;
              step.it_status = itStatus;
            } else {
              delete step.itStatus;
              delete step.it_status;
            }
            delete step.itStatusLabel;
            if (itPlan != null && typeof itPlan === 'object' && String(itPlan.plan || '').trim()) {
              step.itPlan = { plan: String(itPlan.plan).trim() };
            } else {
              delete step.itPlan;
            }
          }
          globalStep += 1;
          return step;
        });
        return { ...s, steps };
      });
      upd(createdAt, { itStatusSessions: newSessions, valueStream: { ...valueStream, stages } });
    };
    global.rollbackValueStreamPainPoint = function (createdAt) {
      const item = getItem(createdAt);
      if (!item || !item.valueStream || item.valueStream.raw) return;
      const vs = item.valueStream;
      const rawStages = vs.stages ?? vs.phases ?? vs.nodes ?? [];
      if (!Array.isArray(rawStages)) return;
      const stages = rawStages.map((s) => {
        if (!s || typeof s !== 'object') return s;
        const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
        const steps = rawSteps.map((st) => (typeof st === 'object' && st != null ? (({ painPoint, pain_point, ...r }) => r)(st) : st));
        return { ...s, steps };
      });
      const wfCompleted = (item.workflowAlignCompletedStages || []).filter((x) => x !== 2).sort((a, b) => a - b);
      upd(createdAt, { valueStream: { ...vs, stages }, workflowAlignCompletedStages: wfCompleted });
    };
    global.rollbackValueStreamItStatus = function (createdAt) {
      const item = getItem(createdAt);
      if (!item || !item.valueStream || item.valueStream.raw) return;
      const vs = item.valueStream;
      const rawStages = vs.stages ?? vs.phases ?? vs.nodes ?? [];
      if (!Array.isArray(rawStages)) return;
      const stages = rawStages.map((s) => {
        if (!s || typeof s !== 'object') return s;
        const rawSteps = s.steps ?? s.tasks ?? s.phases ?? s.items ?? [];
        const steps = rawSteps.map((st) =>
          typeof st === 'object' && st != null
            ? (({ itStatus, it_status, itPlan, it_plan, itStatusLabel, ...r }) => r)(st)
            : st,
        );
        return { ...s, steps };
      });
      const wfCompleted = (item.workflowAlignCompletedStages || []).filter((x) => x !== 1).sort((a, b) => a - b);
      upd(createdAt, { valueStream: { ...vs, stages }, workflowAlignCompletedStages: wfCompleted });
    };
    global.deleteDigitalProblemRequirementLogic = function (createdAt) {
      const item = getItem(createdAt);
      if (!item) return;
      const completedStages = (item.completedStages || []).filter((x) => x !== 2).sort((a, b) => a - b);
      upd(createdAt, { requirementLogic: undefined, completedStages });
    };
    global.restoreItemFromSnapshot = (createdAt, snapshot) => upd(createdAt, { ...snapshot, createdAt });
    global.rollbackDigitalProblemToPreviousStage = function (createdAt) {
      const item = getItem(createdAt);
      if (!item || (item.currentMajorStage ?? 0) <= 0) return null;
      const targetStage = (item.currentMajorStage ?? 0) - 1;
      let nextItem = { ...item, currentMajorStage: targetStage };
      if (targetStage === 0) {
        nextItem = { ...nextItem, completedStages: [], basicInfo: undefined, bmc: undefined, requirementLogic: undefined, workflowAlignCompletedStages: [], itGapCompletedStages: [], valueStream: undefined, globalItGapAnalysisJson: undefined, localItGapSessions: undefined, localItGapAnalyses: undefined, completedTaskIds: [] };
      } else if (targetStage === 1) {
        nextItem = { ...nextItem, workflowAlignCompletedStages: [], valueStream: undefined, itGapCompletedStages: [], globalItGapAnalysisJson: undefined, localItGapSessions: undefined, localItGapAnalyses: undefined, completedTaskIds: [] };
      } else if (targetStage === 2) {
        nextItem = { ...nextItem, itGapCompletedStages: [], globalItGapAnalysisJson: undefined, localItGapSessions: undefined, localItGapAnalyses: undefined, completedTaskIds: [] };
      }
      upd(createdAt, nextItem);
      adapter.saveProblemDetailChat(createdAt, adapter.getProblemDetailChats()[createdAt] || []);
      return nextItem;
    };
    global.resetDigitalProblemToPreliminary = function (createdAt) {
      const item = getItem(createdAt);
      if (!item) return false;
      const resetBase = buildResetPreliminaryItem(item);
      if (!resetBase) return false;
      const list = adapter.getDigitalProblems();
      const idx = list.findIndex((it) => String(it.createdAt || '') === String(createdAt) || String(it.id || '') === String(createdAt));
      if (idx < 0) return false;
      const prev = list[idx];
      const clears = buildResetPreliminaryAdapterMergeClears();
      const finalItem = { ...clears, ...resetBase, createdAt: prev.createdAt || resetBase.createdAt };
      if (prev.id != null && prev.id !== '') finalItem.id = prev.id;

      if (!useBackend && typeof adapter.saveDigitalProblemsSnapshot === 'function') {
        const newList = list.slice();
        newList[idx] = finalItem;
        adapter.saveDigitalProblemsSnapshot(newList);
      } else if (useBackend && typeof adapter.replaceDigitalProblem === 'function') {
        adapter.replaceDigitalProblem(createdAt, finalItem);
      } else {
        upd(createdAt, finalItem);
      }

      const chatSaveKey =
        typeof global.getProblemDetailChatStorageKey === 'function'
          ? global.getProblemDetailChatStorageKey(prev)
          : '';
      adapter.saveProblemDetailChat(chatSaveKey || createdAt, []);

      const aliasKeys = collectCaseSideStorageKeys(prev);
      const opSrc =
        useLocalIndexedDb && typeof adapter.getOperationHistory === 'function'
          ? adapter.getOperationHistory()
          : getOperationHistory();
      const nextOp = purgeCaseKeysFromSideMap(opSrc, aliasKeys);
      if (useLocalIndexedDb && typeof adapter.saveOperationHistory === 'function') {
        adapter.saveOperationHistory(nextOp);
      } else {
        try {
          localStorage.setItem(global.OPERATION_HISTORY_STORAGE_KEY, JSON.stringify(nextOp));
        } catch (_) {}
      }
      const trSrc =
        useLocalIndexedDb && typeof adapter.getTaskTrackingData === 'function'
          ? adapter.getTaskTrackingData()
          : getTaskTrackingData();
      const nextTr = purgeCaseKeysFromSideMap(trSrc, aliasKeys);
      if (useLocalIndexedDb && typeof adapter.saveTaskTrackingSnapshot === 'function') {
        adapter.saveTaskTrackingSnapshot(nextTr);
      } else {
        try {
          localStorage.setItem(global.TASK_TRACKING_STORAGE_KEY, JSON.stringify(nextTr));
        } catch (_) {}
      }

      if (useBackend && typeof adapter.clearProblemCaseTaskSummariesCacheForItem === 'function') {
        adapter.clearProblemCaseTaskSummariesCacheForItem(finalItem);
      }

      return finalItem;
    };
  }
})(typeof window !== 'undefined' ? window : this);
