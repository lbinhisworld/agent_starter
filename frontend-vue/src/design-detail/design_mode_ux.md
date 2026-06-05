# 设计详情页 · 简洁交互模式 — 交互与体验台账（Design Mode UX）

> **维护约定**：本文件记录「设计详情页」在**简洁交互模式**下的**交互逻辑、沟通协议、对话/卡片形态**，不含 LLM 提示词全文（提示词见同目录 `design_mode_promts.md`）。
>
> **与提示词文档分工**：`design_mode_promts.md` = 各模型提示词真源；**本文件** = 用户可见流程、控件、消息类型、与主站详情差异。

## 版本与变更

| 日期 | 变更摘要 |
| ---- | -------- |
| 2026-06-01 | **「现状理解」画布 Tab**：任务 5.1 落库成功后，在 **「需求提炼」右侧** 追加 Tab；第一层 **价值主张理解**；第二层 **业务能力拆解**（能力单元卡 + 贝塞尔箭头）。**任务 5.2 落库成功后**刷新推理图，在各能力单元卡内以 **子卡片垂直排列** 展示 **业务能力字段集**（标题 = `Feature_Value` 切片名；子卡内字段标签 **每行 4 个**，数据来自 `fields_schema_tree`），按 **`associated_capability_unit`** 与能力单元标题匹配挂载。 |
| 2026-06-01 | **现状理解开放式滚动**：取消 Tab 内 `72vh` 嵌套滚区；由 **`.dd-workspace-body`**（含 **全屏**）统一纵向滚动，底部留白避免内容贴边被裁切。 |
| 2026-06-01 | **任务 5.2 表子任务子进度**：每张表下推送 **提炼字段集**（绿）+ **逻辑理解**（标签黑体 + 正文灰）；**仅调试模式**推送「大模型返回 json」+ JSON 灰块（`includeLlmJson`）；使用模式经 `isTask52TableLlmJsonProgressLine` 隐藏历史 JSON 行。 |
| 2026-06-01 | **任务 5.1 / 5.2 / 5.3 调试门闩**：`DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_52`（5.1→5.2）、`DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_53`（5.2→5.3）、`DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_55`（5.3→5.5）；**调试模式**推 **`→ 【调试】是否继续`** +「继续」；**使用模式**直落下一阶段；hydrate 经 **`reattachDebugPipelineContinueGatesFromLineState`** 恢复。 |
| 2026-05-28 | **使用模式 · Target_KV 落库成功行**：隐藏 **`→ 任务 N Target_KV 与逻辑链已写入服务端`** 与 **`→ Target_KV 落库完成（任务 *）`**（`isTargetKvSyncOkProgressLine`）；**保留** `inference_conclusion_sub` 说人话推理结论。 |
| 2026-05-28 | **使用模式 · 送模上下文行**：隐藏 **`→ 送模上下文约 … 字（任务…条特征；超时约…分钟）`** 等技术参数推送（`isLlmContextPayloadStatsProgressLine`）。 |
| 2026-05-28 | **使用模式 · 顶栏/标题栏收紧**：隐藏 **「选择重启」「重启当前」**、**「LLM」**、**「逻辑」**、**「Tree」**；**「完全重启」** 使用/调试均可见；任务进展标题栏右侧 **当前任务紫标** 仅调试模式展示；切回使用模式自动关闭 LLM/逻辑/Tree 浮层与选择重启弹层。 |
| 2026-05-28 | **已完成任务停止转圈**：任务 3 LLM 返回后须在 **`cloneDynamics()` 得到的 `c3o` 上 inline 摘环**，勿先 `withTask3L2DynamicsCard` 再 `dynamicsCards.value = cardsOut` 覆盖（与任务 4 一致）；`DesignTaskDynamicsCard` 在 **`completed`** 时不再渲染行尾 **`bmcGenUi: spinner`**（hydrate 脏快照兜底）。 |
| 2026-05-27 | **架构清单「ER 图」**：在「功能清单」右侧新增 **ER 图** 子 Tab；宿主大块 + 上层主表（蓝主题）/ 下层基础表（黄主题）+ 未定类别表现在下层「其它」；字段 pill **`名/类型`**；外键在 **`是否外键` + `被引用的表名` + `被引用的字段名`** 齐全时画紫色贝塞尔。**任务 14** 展示改名为 **「ER 图生成」**（内部线步 id 仍为 `field_design`，无新 LLM 流水线）。 |
| 2026-05-27 | **使用模式**：隐藏形如 **`→ Target_KV 落库完成（任务 *）`** 与 **`→ 任务 N Target_KV 与逻辑链已写入服务端`** 的成功里程碑行（`isTargetKvSyncOkProgressLine`）；**不调** hydration 快照与门闩检测（仍为原文）。 |
| 2026-05-27 | **使用模式 · 任务 1 合并进度**：需求批次合并入总体需求时，各 Tab 子行**不展示**「｜新增 token n 个，更新 token m 个」；改为 `→ （i/9）「Tab 名」` 行尾 **✓**（调试模式仍展示 token 统计）。 |
| 2026-05-27 | **深访问卷视觉**：`task*_alignment_questionnaire_sub` 与配套引导行（产生疑问 / 请在下方回复 / 深访洞察已写入 / 正在生成对齐问卷）采用**紫色字体**（`#6d28d9`，与顶栏当前任务标签同色系）。 |
| 2026-05-27 | **使用模式 · 任务进展收紧（续）**：额外隐藏「→ 已继承任务 N 对齐结论，跳过问卷｜…」、「→ 反向验证校验｜…」等反向验证门禁/免疫明细，以及「→ 任务 N token / feature 明细」标题行；**保留** 深访问卷、`inference_conclusion_sub` 推理结论与问卷引导。 |
| 2026-05-27 | **使用模式 · 任务进展收紧**：`isDesignDetailProgressLineVisibleForExperience` 额外隐藏 `user_quote` / `bmc_result_quote` / `token_validation_mapping_quote` 与链接构建子进度箭头行（正向/反向归纳、更新 tree、TVM 标题等）；**保留** 深访问卷子区（`task*_alignment_questionnaire_sub`）、问卷引导（「请在下方回复…」「深访洞察已写入」）与 `alignment_diff_sub`；**调试模式**仍全量展示。 |
| 2026-05-28 | **使用模式 · 深访反馈**：用户反馈写入 **`alignment_user_feedback_sub`**（紫字「」原文，hydrate 自旧 `user_quote` 升级）；隐藏 **「推理结果已提炼｜token…特征…逻辑边…」** 统计行。 |
| 2026-05-28 | **使用模式 · 任务 7+ 进度**：`isUsageModeTaskMilestoneProgressLine` 保留开篇/大模型/推理逻辑提取等用户向里程碑（**不含** Target_KV 落库成功行）；全行被过滤时展示占位说明；深访重跑后 **`continuePipelineAfterTask6SegmentForExperience`** 自动衔接任务 7。 |
| 2026-05-28 | **使用模式 · 任务卡串行展示**：`designDetailUsageModeProgressGate` — 上一线步对用户可见内容（含 `inference_conclusion_sub` 逐码点 reveal）展示完毕前，**不渲染**下一任务动态卡（`filterDynamicsCardViewsForUsageMode`）；各 `runTask*` 入口 **`awaitUsageModePriorLineTaskDisplayComplete`** 延迟创建/写入下一卡（调试模式不门控）。 |
| 2026-05-28 | **顶栏当前任务标签**：`resolveDesignDetailCurrentLineTaskIdForDisplay` 优先取动态卡中 `running` 线步；`reconcile` 不再因 task1 假阴性把已推进线步拽回任务 0。 |
| 2026-05-28 | **深访问卷回复**：`task*AlignmentPending` 在 hydrate / 发送前由进度卡 + localStorage 问卷（含冲突块 JSON）恢复；避免误走 task1 `gateProgress` 仅写入聊天 Tab。 |
| 2026-05-28 | **推理结论只推一次**：`hasCompletedFeatureInferenceConclusionPushForLineStep` 按「本步共形成 N 条」+ 已有正文条数判定已推满（**不因** Target_KV 重 sync 后 `featureId` 重分配而重推）；`mergeDynamicsCardsPreferRicherProgress` 行数相同时保留 **`inference_conclusion_sub` cursor 累计分更高** 的卡，避免 hydrate 快照 cursor 归零导致「擦除再推送」；正文去重后追加。 |
| 2026-05-28 | **任务 5 L3 提示词 V2**：`designDetailL5L3MacroProcessSystemPrompt.js` — 仅输出五大宏观 `Feature_Key`（**禁止**本步输出 `价值流阶段_*`，属任务 5.5）；**Validation_Status 中继** + **Resolved 流程控制密度收紧** + 四轨 TVM；TVM 兼容 `Mapped_L5_Feature`。 |
| 2026-05-28 | **任务 3 L2 提示词 V2**：`designDetailL3L2IndustryBusinessSystemPrompt.js` — **核心资产属性 / 交付模式 / 行业类别** 三元全量保活；Input 1＝任务2、Input 2.1/2.2＝任务1 实然与痛点雷达；四轨 TVM + Resolved 自愈；`buildTask3L2InferenceUserBlock` 与后端三键归一化对齐。 |
| 2026-05-24 | **任务 8.5→9 调试门闩（V4.1）**：`DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_9`；任务 8.5 收官后在 8.5 卡推 **`→ 【调试】是否继续`**，点「继续」后启动 **`runTask9L5BlueprintPipeline`**。任务 9 契约改为 **`L5_Blueprint_Domain_Matrix`**：仅 **`系统一级模块`** + **`Tech_Host_Platform`**；Input 1=任务 8.5、Input 2=任务 0、Input 3=任务 1~4。 |
| 2026-05-27 | **任务 1 · 现有表格**：仅当用户需求**明确写出表名**且带字段清单时才写入 `existingSpreadsheets` / 同步 `现有表格/{表名}`；**禁止**按字段语义或「数据表 N：（字段）」纯编号推测表名（`design-detail-existing-spreadsheet-parse.ts` ↔ `task1BusinessInsight.js`）。 |
| 2026-05-21 | **任务 1 · 现有表格（历史）**：支持 `《表名》：（字段）`、`数据表 N-具体名称：（字段）`；同步顺序在 **IT 现状与集成** 之后、**运营模式** 之前。 |
| 2026-05-21 | **逻辑树 · 现有表格**：任务 1 层 `现有表格/` 特征 **黄色主题**（`dd-tree-card--existing-spreadsheet`），无链也展示；绿反向验证时黄绿强调。 |
| 2026-05-20 | **任务 5 / 5.5 进度区**：L3/L3.5 大模型返回后 **`【调试】→ 推理完成`** + 截断 JSON 在灰色子区（**`task5_inference_sub` / `task55_inference_sub`**，`DesignTaskDynamicsCard.vue`）；蓝环 **`→ 正在进行…（大模型）`** / **`→ 正在写入 Target_KV…`** 与任务 3 同 **`withTask5L3DynamicsCard` / `withTask55L3DynamicsCard`** 写回；落库叙事 **`scope_green`**（`useDesignDetailChat.ts`）；工作区快照支持任务 5/5.5 动态卡（`designDetailProgressWorkspace.ts`）。 |
| 2026-05-20 | **逻辑树·任务 5.5**：`collectLogicTreeCrossLinks` 纳入 **任务 5.5** 链边；**`appendTask55OrphanEndpointNodes`** 补全未出现在链端点上的 **`价值流阶段_*`**（修复「落库 5 阶段、Tree 仅 2 节点」）。 |
| 2026-05-21 | **「重启当前」任务 11**：清设计报告 localStorage 叙事缓存 + 刷新架构清单画布 + 清任务 11 LLM 审计（含两章 callTarget）+ kickoff `runTask11AnalysisReportThenMaybeTask12`（从第一章「对需求痛点的理解」重跑）。 |
| 2026-05-21 | **「重启当前」任务 8.5**：`restartDesignDetailFromLineTaskAnchor` 锚点 `physical_hook_integration_inference` 须 kickoff `runTask85PhysicalHookPipeline`（此前仅建「即将开始」卡会挂死）。hydrate 对仅首句预置卡自动续跑。 |
| 2026-05-28 | **推理结论线性顺序**：Target_KV OK → **逐条推理结论**（`inferenceFeatureId` 增量，已推送 **永不擦除**）→ 正向/反向链接与 TVM 展示 → **反向验证门禁**（不一致才深访问卷）→ 下一任务（调试模式门闩确认）。hydrate/深访重跑仅补未推送 feature。 |
| 2026-05-28 | **左栏进展滚动 · 任务切换跟随**：`DesignDetailPage` 在**新增任务卡**或**活跃任务卡切换**（上一任务完成、下一任务开跑）时**强制**外层 `dd-chat-body` 滚至底部；同卡内进度更新仍仅在用户已接近底部时追底，避免打断手动上翻阅读。 |
| 2026-05-28 | **左栏「进展｜聊天」分段**：标题下 **进展 / 聊天** Tab；**进展** 为原任务动态卡；**聊天** 为时间线（用户右对齐、系统左对齐，时间戳 + **复制**）；系统项仅 **任务开/收官**、**推理结论**（`inference_conclusion_sub`）、**深访问卷**（`task*_alignment_questionnaire_sub`）及持久化 `taskStartNotification`；**Tab 与双区 `scrollTop`** 写入 `DesignDetailProgressWorkspace.payload.leftPanelUi`（debounce 与动态卡等同源落库），hydrate 后恢复阅读位置；`scroll* === 0` 时恢复为滚至底部（最新记录）；`localStorage` 键 `smart_cto_design_detail_chat_panel_mode_v1` 仅作离线兜底。 |
| 2026-05-28 | **任务 5 / 5.5 / 6 深访闭环**：任务 5、5.5 落库后 **`Token_Validation_Mapping` 门禁**；存在「潜在冲突」时生成对齐问卷（`task5_alignment_questionnaire_sub` / `task55_alignment_questionnaire_sub`），底部回复 → 深访合成 → 重跑本线步；**未消解前不**进入 5.5 / 6 / 7。任务 6 沿用原门禁。 |
| 2026-05-27 | **任务 6 L3 提示词 V2**：`designDetailL3ScenarioSystemPrompt.js` 升级为 **DAG Shifter + 折中意志熔断** 版；输出 **`L3_validate_Matrix`**（`Feature_Key=流程骨干校验`）替代历史 **`Token_Validation_Mapping`**；后端/前端解析兼容双形态。 |
| 2026-05-20 | **任务 6 L3 关键场景**：任务 5.5 收官后 **`runTask6L3ScenarioPipeline`**；`POST …/sync-task6-l3-scenario-target-kv-tokens`；提示词 **`designDetailL3ScenarioSystemPrompt.js`**。 |
| 2026-05-20 | **任务进展快照恢复**：`parseDynamicsCard` 须识别全设计线步（含 **`key_requirement_scenarios`** 任务 7）；若快照含未知线步卡，**跳过该卡**而非整表 `parse_snap_null`（否则 0006 等已到任务 7 的案例刷新后只剩任务 1 引导行，LLM/逻辑树仍正常）。 |
| 2026-05-20 | **任务 7 L4 协作节点**：任务 6 收官后 **`DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_7`** → **`runTask7L4CollaborationPipeline`**；`POST …/sync-task7-l4-collaboration-target-kv-tokens`；提示词 **`designDetailL4CollaborationSystemPrompt.js`**（**上游场景 100% 全量正向归纳** + **多源归流唯一流程** + **四维拓扑原语** 与 `Predecessor_Value` 咬合）；落库时 **`buildTask7IntraFlowForwardLinks`** 另写 **所属业务流程→协作节点** 正向归纳边；`Feature_Key` 仅 **`所属业务流程`** / **`协作节点`**。 |
| 2026-05-21 | **任务 8 L4.5 Tree 分块**：子块左→右与任务 7 **`buildTask7CollaborationNodesInTreeVisualOrder`**（流程块序 × 块内协作链序）一致；块内 **`space-evenly`**。 |
| 2026-05-21 | **任务 8→9 调试门闩**：任务 8 收官后须在 **`reconcileDesignDetailLineTaskId` 之后**再挂门闩；`holdPastTask8` 在线步为任务 9 时仍保留；`reconcile` 在 `holdPastTask8` 时不低于 **`business_capability_positioning`**；补挂/调度以任务 8 动态卡 **completed** 为准（勿仅依赖线步 id）。 |
| 2026-05-21 | **任务 9 L5 提示词 v3**：每行独立 **`Inference_Weight`（0~1）** + **`Belongs_To_Primary_Module`**；Input 3 含管控复杂度/数字化成熟度用于权重修剪；落库校验权重区间；一级→二级边权重取自菜单行。 |
| 2026-05-21 | **任务 9 逻辑树二级模式**：对齐任务 7 — 每个**系统一级模块**独立子块，块内首行一级模块节点卡、次行**二级功能菜单** `space-evenly` 平铺；落库合成 **一级模块→二级菜单** 正向边（`Belongs_To_Primary_Module`）。 |
| 2026-05-21 | **任务 9 L5 系统菜单与功能模块**：线步 **`business_capability_positioning`**；`POST …/sync-task9-l5-blueprint-target-kv-tokens`；任务 8 收官后调试门闩或自动衔接任务 9。 |
| 2026-05-20 | **逻辑树弹层**：移除标题下开发说明长文（原 `dd-tree-hint`）；仅保留标题、关闭与画布（`DesignDetailLogicTreeModal.vue`）。 |
| 2026-05-20 | **任务 3 落库进度**：`→ 进行任务 3 推理逻辑提取` 及落库后正向/反向/TVM 门禁里程碑行使用 **`scope_green`**；落库请求期间推 **`→ 正在写入任务 3 Target_KV 与逻辑链…`** 蓝环，**`finally` 从当前 `dynamicsCards` 摘环**（修复 `cloneDynamics()` 后仍改陈旧 card 导致进入任务 4 后转圈残留）；成功推绿色 **`→ 任务 3 Target_KV 与逻辑链已写入服务端`**；调试门闩前再 **`removeTask3L2SyncSpinnerLine`** 兜底（`withTask3L2DynamicsCard` / `useDesignDetailChat.ts`）。 |
| 2026-05-22 | **任务 0 落库诊断**：控制台 filter **`[design-detail:task0-sync]`** / **`[problem-case-api:task0-sync]`** / **`[design-detail:task0-tree]`**；服务端 **`[problem-case:task0-toolbox-primitives]`**；Tree online 仅 `ft_*`，offline 为 `preview:` 本地预览。 |
| 2026-05-22 | **任务 0→1 调试门闩**：`DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_1 === true`；任务 0 落库/收官后在任务 0 卡推 **`→ 【调试】是否继续`**，点「继续」后再挂载任务 1 引导卡。 |
| 2026-05-20 | **任务 3→4 调试门闩**：`DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_4 === true`；任务 3 推理/落库/TVM 门禁全部完成后在任务 3 卡推 **`→ 【调试】是否继续`**，点「继续」后再切线步并启动任务 4。 |
| 2026-05-12 | **调试：任务间手动继续**：`DESIGN_DETAIL_DEBUG_PIPELINE_STEP_CONTINUE === true` 时，任务 1→2、任务 3→4、任务 4→5 等段收官后推 **`→ 【调试】是否继续`** + **「继续」**。控制台：**`[design-detail:debug-pipeline-continue]`**、**`[design-detail:task3-l2-gate]`**。 |
| 2026-05-12 | **任务 2 L1 落库叙事**：`postDesignDetailSyncTask2L1TargetKvTokens` 成功后进度区依次 **`→ 开始提炼正向归纳链接`**（灰行：`FeatureId，token → …`）→ **`→ 更新 tree 视图`**（递增 **`logicTreeGraphRefreshTick`**）→ **`→ Token_Validation_Mapping：`** + JSON 灰块 → **`→ 开始提炼反向校验链接`** + 灰行 → **`→ 更新 tree 视图`**；**`DesignDetailLogicTreeModal`** 监听 **`graphRefreshTick`** 与 **`visible`/`caseId`** 一并 **`fetchGraph`**（`designDetailTask2L1SyncUiProgress.ts`、`useDesignDetailChat.ts`、`DesignDetailPage.vue`）。 |
| 2026-05-12 | **任务 3 调试行消失**：`POST …/sync-task3-l2-target-kv-tokens` 成功后已推「提取到 token/feature」，若轮询 hydrate 在 debounce PUT 之前用**旧**工作区快照 `tryRecover` 整表覆盖 `dynamicsCards`，会出现仅「→ 进行任务 3 推理逻辑提取」后空白。修复：`applyDesignDetailProgressWorkspaceSnapshot` 在**本地动态卡总行数多于快照**时保留本地进度；Target_KV 成功后 **立即 flush** 工作区；推理图无 `tasks` / 未挂载 `getDesignDetailTaskGraph` 时推可见说明行；`pickTask3TokensFeaturesFromGraphTasks` 同时认线步 id 与落库中文 `taskId`（`useDesignDetailChat.ts`）。 |
| 2026-05-12 | **「重启当前」与左栏动态卡**：非任务 1 锚点时按 `DESIGN_MODE_LINE_TASK_ORDER` **保留锚点之前**各线步任务动态卡（重启前内存快照 `cloneDynamics`），仅追加当前锚点一张「待重跑」卡（`buildPriorDynamicsPreservingCompletedSteps`）；缺任务 1 完成卡时用 `buildCatchUpTask1DoneCard` 从聊天补一条；避免先前整表 `[task1]+fresh` 导致任务 2 等前置卡被清掉（`useDesignDetailChat.ts`）。 |
| 2026-05-12 | **任务 2→3 串联**：任务 2 L1 **落库成功**后任务 2 动态卡 **淡绿收官**（`cardTone` 凡 `completed` 均为 `mint_done`）、线步切 **任务 3**、新建 **淡黄** 任务 3 卡；进度 **`→ 开始进行行业与业务属性推理`** + 两行 **`【调试】【任务 3】→ L1 推理结果：Feature 列表`** + L2 大模型行；L2 成功后先 **`【调试】【任务 3】→ 推理完成`**，模型输出在**灰色子区域**（`task3_inference_sub`，`DesignTaskDynamicsCard.vue`）；审计 `callTarget`=`行业与业务属性推理（L2 业务底色）`。**「重启当前」**在锚点任务 2/3 跑完 pipeline 后从 **`loadDesignDetailLineState`** 恢复线步，避免误写回锚点。 |
| 2026-05-08 | **推理图主键（新写入）**：`DesignDetailTaskToken.tokenId` 为 **`tk_{asciiTask}_{caseCompact}_{6位}`**；`DesignFeatureNode.featureId` 为 **`ft_`+12 位**全局序号；`DesignLogicLink.linkId` 为 **`lk_`+12 位**；分配见后端 **`design-detail-graph-ids.ts`**；与历史 **cuid** / **`dd:…`** 并存；逻辑弹层 **`features[].themeKey`** 对新 **`ft_`** 主键由后端按绑定 token 的 **`taskId`** + **`surfaceTokens`** 推断（见 **`docs/agents/backend/01-context.md`**）。 |
| 2026-05-08 | **逻辑弹层·任务 2 逻辑链 UI**：展开 **`linkId`** 后 Source/Target 子卡**隐藏** Token/Operator/Value **字面标签**（保留 **`aria-label`**）；中间列为 **权重（蓝底）+ 蓝色水平箭头 + 下方浅蓝圆角逻辑卡**（`logic` 全文）；桌面端箭头带竖直位置约在端点内容区 **上 1/3**（`flex:1`/`flex:2`）；窄屏改为纵向堆叠并收起顶空 flex（`DesignDetailLogicModal.vue`）。 |
| 2026-05-09 | **顶栏 Tree**：**「逻辑」**右侧 **Tree** 打开 **`DesignDetailLogicTreeModal`**：任务 1 / 任务 2 两行 **Feature** 横向栅格；任务 1 既有特征后接每条 **`DesignLogicLink`** 的 **Source** 列，同列下方对齐 **Target**；任务 2 独有特征接在右侧；**SVG** 蓝色贝塞尔连接源底→目标顶；合并规则复用 **`designDetailLogicGraphMerge.ts`**。 |
| 2026-05-07 | **移除顶栏「统计」**：原 `DesignDetailLlmStatsModal`（聊天内 `task1LlmQueryBlock` 汇总表）已删除；大模型调用次数/token 等仅通过顶栏 **「LLM」** 浮层查看服务端 `ProblemCaseLlmLog`；工作区快照字段 `llmStatsIncludeFromMessageIndex` 仍保留供 hydrate 与重启语义对齐。 |
| 2026-05-07 | **LLM 审计（task1）**：`ProblemCaseLlmLog.taskId` 统一 **「任务 1：客户基本情况了解」**；`callTarget`：**工商** `客户工商及经营范围信息提炼`、**需求提炼** `需求提炼#n`、**合并** `需求#n合并#token`（`designDetailRequirementMergeTokenPaths.ts`）、**BMC** `客户商业画布（BMC）生成`。合并走 **`summarizeDesignDetailRequirementMergeByLlm`**，失败回退 `summarizeMergeTwoStrings`；**≥2 条提炼**时 **`mergedRequirementBaselinePreview`** 规则预填。任务 1「重启当前」online：`llm-logs/clear` 含统一 taskId 及旧版 `customer_basic` / `customer_requirement` / `合并需求#1…64`。 |
| 2026-05-07 | **重启清 LLM 审计（修）**：`postClearCaseLlmLogsByTaskIds` 须在**设计线**当前步为 **`customer_basic`** 时传入 `buildDesignDetailTask1RestartLlmLogTaskIds()`；**勿**与全案 **`TASK1_ID === 'task1'`** 比较（误比则只清 `customer_basic`+`customer_requirement`，删不到库中 **`任务 1：…`** 行）。排查：浏览器 **`[design-detail:restart-llm-clear]`**、**`[problem-case-api] llm-logs/clear ok`**；服务端 **`[problem-case:llm-logs-clear]`**。 |
| 2026-05-07 | **桌面布局**：`DesignDetailPage.vue` 在 **≥901px** 时 `.dd-app` 视口定高、`dd-top-nav` / `dd-case-headline` / 左侧 `.dd-chat` 整列不随文档滚动；右侧 `.dd-workspace` 内 **`.dd-workspace-body`**（横向画布 Tab 以下）**独立纵向滚条**；**≤900px** 仍为纵向堆叠 + 整页滚动。 |
| 2026-05-07 | **增量总体需求合并**：每批需求在 **管理资源** 分域逻辑提炼成功后，进度 `→ 将需求批次#n 合并入总体需求`，再按 **业务背景→路线图** 各 Tab 子步骤大模型合并（共 9 步，与旧版 token 规则一致；**不含**分析师备注），写入 **`mergedRequirementParsedOverride`**；随后 **`是否继续补充需求？`**。「**否**」进入 **任务 2**（见下行），不再二次批量合并。 |
| 2026-05-08 | **任务 2 L1 落库后调试行**（默认 **关闭**）：`buildTask2L1InferenceInputFromTaskGraph.ts` 中 **`TASK2_L1_PROGRESS_DEBUG_UI_ENABLED === true`** 时，`postDesignDetailSyncTask2L1TargetKvTokens` 成功后仍可按分区逐行推 **`【调试】【任务 2】…`**；关闭时仅保留 **`→ 推理结果已提炼｜token…特征…逻辑边…`** 等常规行。 |
| 2026-05-08 | **「否」→ 任务 2**：任务 1 动态卡淡绿收官、新建第二张进度卡、`→ 尝试理解规模与组织模式` + L1 实体画像 LLM（`task1BusinessInsight.inferDesignDetailL1EntityPortraitFromContext`）；阶段 `completed`。**静态页须 `frontend-vue` 执行 `npm run build`** 更新 `vue-auth-assets/design-detail.js`，否则会仍执行旧脚本中的「已暂停当前任务」。 |
| 2026-05-07 | 合并进度子行：`（i/9）「Tab 名」｜新增 token n 个，更新 token m 个；` — **新增**＝被合并切片有、当前合并总集无的 token；**更新**＝两边均有的 token（`requirementMergeTabTokenStats.ts`）。 |
| 2026-05-08 | **痛点雷达**：单次提炼与合并需求均将 **IT 缺口** 作为子块嵌在 **痛点表现** 内，缺口正文 **红色**；**合并需求** Tab 下按 `dimension` **可折叠类别**（垂直排列，默认展开），类内痛点子卡 **一行 4 个**（窄屏 2/1 列）（`designDetailRequirementPrelimCanvasHtml.ts` + `DesignDetailRequirementPrelimPanels.vue`）。 |
| 2026-05-08 | **痛点雷达**：条带与合并网格内痛点卡 **橙色标题栏** 固定 **约 3 行** 高度（`-webkit-line-clamp: 3`），多列时内部区块水平对齐。 |
| 2026-05-08 | **痛点雷达**：橙色标题栏 **字号/行高** 与卡片内 `.dd-req-cbe-nest-b` 一致（`0.76rem` / `1.45`），栏高按该字号计算。 |
| 2026-05-07 | 需求提炼 Tab：顶栏固定 **「合并需求」** 绿底白字可折叠根卡片 + 与同套子 Tab（`mergedCustomerRequirementParsed` = 各次 `parsed` 自旧向新浅合并）；单次提炼根卡片列表 **新在上旧在下**（`isoTimestamp` 降序）；工作区快照含 `mergedRequirementActiveSubTabKey`（`designDetailProgressWorkspace.ts` + `useDesignDetailChat.ts` + `DesignDetailPage.vue`）。 |
| 2026-05-07 | 需求提炼子面板：`DesignDetailRequirementPrelimPanels` / `DesignDetailRequirementCoreEntitiesPanel` **去掉**子块视口 `max-height: min(*vh,*)` **裁切**；与上条 **桌面 `.dd-workspace-body` 滚条** 配合完整展示长内容（`DesignDetailPage.vue` 等）。 |
| 2026-05-07 | 「统计」弹层「耗时」与总耗时汇总：统一中文 **X时Y分Z秒**（零的高位单位省略；未满 1 分钟仅「秒」，可含小数）；`designDetailLlmStats.ts` 的 `formatDurationForStats`。 |
| 2026-05-06 | 任务动态卡标题栏：进行中**移除**右上角环形 spinner（`DesignTaskDynamicsCard.vue`）；进度行内联转圈/绿勾不变。 |
| 2026-05-10 | 数据：`DesignFeatureNode` 冗余列 **`TokenStr`**（与绑定 `DesignDetailTaskToken.tokens` 一致）；Prisma 字段名 **`surfaceTokens`** `@map("TokenStr")`。 |
| 2026-05-06 | 需求提炼画布就绪后：`online` **串行**同步至推理图：**业务背景 → 核心业务对象 → 状态转移矩阵 → 痛点雷达 → IT 现状与集成 → 运营模式 → 管理资源**（至管理资源后结束）；进度含「→ 正在提炼运营模式的逻辑」等；`DesignDetailTaskToken.tokens` 含 `运营模式/人员组织/…`、`运营模式/业务流程/…`、`管理资源/人力资源` 等（`design-detail-customer-req-section-graph.ts` + `useDesignDetailChat.ts`）。 |
| 2026-05-06 | 「重启当前」：`deleteDesignDetailTaskGraph` 除当前设计线步外**固定再删** `customer_requirement`，避免 `taskId = customer_requirement` 的分域 token（如历史版同步的 IT/运营等）在表中残留（`useDesignDetailChat.ts`）。 |
| 2026-05-09 | 数据：`DesignFeatureNode` 主键改为 `featureId`（移除 `id`）；`DesignLogicLink.sourceFeatureId` / `targetFeatureId` 外键引用 `DesignFeatureNode.featureId`（级联删）。 |
| 2026-05-09 | 数据：新增 `DesignLogicLink`（`linkId`、`sourceFeatureId` / `targetFeatureId`、`weight`、`logic`）。 |
| 2026-05-08 | 数据：新增 `DesignFeatureNode`（`featureId` + `tokenId` + `operator` + `value`），外键引用 `DesignDetailTaskToken`（初版行主键为 `id`，后于 2026-05-09 改为 `featureId` 主键）。 |
| 2026-05-08 | 数据：新增 `DesignDetailTaskToken`（案例 × 设计任务线步 × 概念多形态 `tokens` JSON 数组）；`caseId` 为 `ProblemCase.id`，非 `archiveNo`。 |
| 2026-04-30 | 画布横向 Tab：新建 Tab 自动切换 + **当前 Tab** `.dd-tab--on` **蓝色闪烁光晕**（`useDesignDetailChat` / `DesignDetailPage`）。需求提炼结构化子 Tab（除「核心业务对象」外）：「业务背景」「状态转移矩阵」「痛点雷达」「IT 现状与集成」「运营模式」「管理资源」「路线图」等（**不含**分析师备注）——**结构**与详情页初步需求 **view** 对应分区同构（`DesignDetailRequirementPrelimPanels.vue` + `designDetailRequirementPrelimCanvasHtml.ts`，亮色 `dd-prelim-*`；矩阵区展示转移列表 + Mermaid 源码，本页不跑 `mermaid.run`）。 |
| 2026-04-15 | 「需求提炼」横向 Tab **追加在最右侧**（晚于已有画布 Tab）；`collectCustomerRequirementBlocksFromChat` 忽略**无实质字段**的空 `llmOutputJson`，避免空根卡片。 |
| 2026-04-15 | 「重启当前」：`pruneDesignDetailPersistedChatForRestart` 从同源聊天**删除**本页三类 `task1LlmQueryBlock`（经营信息提炼 / BMC / 客户需求提炼）并链式去掉尾随未确认 `basicInfoCard`；`resetDesignCanvasWorkspace` 清空画布并移除两 Tab；`llmStatsIncludeFromMessageIndex` 对齐修剪后长度；`designDynamicsSuppressPersistedReplay` 为真期间 hydrate **不**执行 `syncCustomerRequirementCanvasEntriesFromMessages`。 |
| 2026-04-15 | 「需求提炼」子 Tab「核心业务对象」：按 **人/财/物/事** 分类栈 + 4 列响应式网格对象卡（概念解释 / 生命周期 chip+→ / 归属逻辑），逻辑与详情页初步需求「核心对象」一致；非数组或脏条目回退 `<pre>` JSON（`DesignDetailRequirementCoreEntitiesPanel.vue`、`coreEntitiesRequirementCanvas.ts`）。 |
| 2026-04-15 | 「统计」弹层：`llmStatsIncludeFromMessageIndex` 与修剪后消息长度对齐；重启后明细仅含此后新写入的 `task1LlmQueryBlock`（重启时已物理删除本页设计详情 LLM 块）；切换 `caseId` 归零；弹层文案补充说明。 |
| 2026-04-15 | 客户需求提炼进度灰行：顶层 JSON 字段 **逐行** `key: 值`，**每字段值仅前 10 个 Unicode 标量 + `...`**；完整结构仍写入 `task1LlmQueryBlock.llmOutputJson`（`buildCustomerRequirementProgressSummaryForCard`）。 |
| 2026-05-06 | 客户需求提炼进度灰行改为**单行简报**（有内容的顶层维度计数），**不**在分域逻辑提炼前预列各分域键；`postDesignDetailSyncCustomerReqSectionGraph` 每分域：**正在提炼…** 行尾转圈至接口成功 → 去掉转圈 → **完成…逻辑提炼** 行尾绿 ✓，上一域 reveal 后再短停顿进入下一域（`useDesignDetailChat`）。 |
| 2026-05-06 | 分域同步**全部成功**后（至管理资源）：进度区追加绿色「→ 是否继续补充需求？」+ 蓝底白字 **是/否**；「是」→ 绿字引导 +「→ 请输入用户需求」、阶段 `awaiting` 可再次提炼与同步；「否」→ **任务 2 流程**（见 2026-05-08 台账）；旧版曾为「→ 已暂停当前任务。」+ `paused`。**2026-05-08** 起以源码与 **`npm run build`** 产物为准。 |
| 2026-05-07 | 「是」后须防 **工作区快照**（debounce 尚未写入）在 `runHydrationCycle`/`tryRecover` 中把 `task1CustomerRequirementPhase` 与动态卡覆盖回 `completed`：恢复快照前读 `localStorage`，`awaiting`/`paused` 优先于快照中的 `completed`/`idle`；hydrate 后 `ensureCustomerRequirementAwaitingProgressUi` 补全绿字引导（`useDesignDetailChat.ts`）。 |
| 2026-04-15 | 任务动态卡内进度区（`DesignTaskDynamicsCard` 的 `.dd-dyn-body-scroll`）随 `rows` 深变更 **自动滚底**，与左侧 `dd-chat-body` 外层滚底并存，避免卡内截断时看不到最新行。 |
| 2026-04-15 | 左侧任务进展区（`dd-chat-body`）随 `dynamicsCardsView` 深变更 **自动滚底**；需求提炼成功后「→ 正在渲染需求画布」+ **需求提炼** Tab（自上而下根卡片 + 字段子 Tab，样式近详情 `.problem-detail-row`）。 |
| 2026-04-15 | 画布就绪后：绿色「→ 请输入用户需求」（现行：须在 **推导逻辑写库成功后** 才推送）+ 同套底部光晕（`designChatInputHighlightTask1ScopeOrRequirementAwait`）；发送后「→ 正在解析需求」蓝环 → ✓ + 需求 **摘要**灰行（非整段 JSON）；`smart_cto_design_detail_customer_req_v1:{caseId}` 门控工商/BMC 与需求提炼路径。 |
| 2026-04-15 | 底部输入框蓝色光晕：`sendBusy` 为真时不加 `dd-chat-input--await-task1-scope`（发送瞬间即消闪烁，与 `:disabled` 一致）。 |
| 2026-04-15 | 左侧聊天区 **不再**展示「任务动态」四字分区标题；进度区仅淡黄卡片流，无障碍仍用 `aria-label` 描述。 |
| 2026-04-15 | 任务 1 绿色引导「→ 请提供客户工商及经营范围信息」**完整 reveal** 且尚未发送提炼前：底部输入框 **蓝色闪烁光晕** + 占位固定为「请提供客户工商及经营范围信息」（`designChatInputHighlightTask1ScopeAwait` / `DesignDetailPage.vue`）。 |
| 2026-04-15 | 经营信息提炼 JSON **灰行**：与任务动态其它行一致 **逐码点** reveal；`appendTask1GrayJsonQuoteProgress` 不再 `startFullyRevealed`；「正在绘制客户基本信息画布」在 JSON reveal **结束后**再追加（`waitUntilDynamicsFullyRevealed`）。 |
| 2026-05-06 | 经营信息提炼 **进度灰行** 仅展示 **前 3 个顶层字段**（顺序同画布列）+ 后缀 **「。。。」**；完整结构仍在 `task1LlmQueryBlock` / `basicInfoCard` 与右侧「客户基本信息」表（`buildTask1BasicInfoProgressPreview`）。 |
| 2026-04-15 | 顶栏增加 **「统计」**：弹层展示本案例聊天中 `task1LlmQueryBlock` 的调用次数、总耗时、输入/输出 token 汇总与逐次明细（设计任务｜调用目标｜耗时｜token）；实现见 `DesignDetailLlmStatsModal.vue`、`designDetailLlmStats.ts`。 |
| 2026-05-11 | **统计**明细：设计任务列恒为「任务 1：客户基本情况了解」；调用目标——经营信息提炼为「**基本信息提取**」，客户需求提炼为「**需求提炼#序号**」（统计窗口内按时间序），BMC 等仍为去前缀后的备注名；见 `designDetailLlmStats.ts` 的 `resolveTask1CallTargetForStats`。 |
| 2026-05-06 | **需求提炼**根卡片标题栏：**蓝底序号**移至折叠按钮内、**「需求提炼」四字左侧**（chevron 之后），右侧仅保留「提炼结果」；`DesignDetailPage.vue`。 |
| 2026-05-06 | **需求提炼全案序号**：`task1LlmQueryBlock.task1RequirementDistillOrdinal`（`task1BusinessInsight.buildTask1LlmQueryMessage` + `useDesignDetailChat` 写入）；统计「需求提炼#n」与画布蓝底序号优先读该字段，缺省按聊天前缀推断；`designDetailLlmStats.ts` / `designDetailProgressWorkspace` 条目 `distillOrdinal`。 |
| 2026-05-06 | 「统计」明细「设计任务」列与顶栏任务线一致：`designLinePillLabel('customer_basic')`（含「设计详情客户需求提炼」）；`clampLlmStatsIncludeFromIndex` + hydrate 恢复后越界下标归零，避免漏计工商等早期块（`designDetailLlmStats.ts`、`useDesignDetailChat.ts`）。 |
| 2026-04-15 | 移除左侧任务进展区内 **独立 JSON 磨砂框**；提炼 JSON 仅任务动态灰行 + 右侧「客户基本信息」表。 |
| 2026-04-15 | 「重启当前」：**仅本页**重置任务动态与计时，不调 `problemDetailRestart`；并修剪同源聊天中本页写入的 LLM 块（见 `pruneDesignDetailPersistedChatForRestart`）；`designDynamicsSuppressPersistedReplay` 抑制 hydrate 回放直至再次发送。 |
| 2026-04-15 | 右侧画布区改为 **动态横向 Tab**（默认「案例概览」+ 提炼成功后的「客户基本信息」表格页）；提炼落库后任务动态追加 **「正在绘制客户基本信息画布」**（行尾态）再写入画布 Tab。 |
| 2026-04-15 | task1 用户返回工商后：进度行 **「正在提炼客户基本信息」** + 行尾 **蓝色**环形动画 → 返回后换 **绿色 ✓** → 其下灰块 JSON；**取消**「→ 接收到用户输入」进度推送；调用 `extractDesignDetailBusinessInfoFromUserFeedback`；**本发送流程内不调** `runDesignDetailBmcChain`。 |
| 2026-04-29 | 初版：从 `AGENTS.md` 与 `useDesignDetailChat.ts` 抽象协议与 UI 规则 |
| 2026-04-29 | 设计页里程碑与详情 canonical 任务线解耦：`collectPendingInteractiveBlockLines` 固定 task1 视角；进展区不再追加 `formatTaskStartNotifyBody`；`DesignSystemCard` 移除 `focusTaskId` |
| 2026-04-29 | 任务线独立 `localStorage`；左侧「任务动态」淡黄卡片流 + 标题栏右侧紫底白字当前任务标签 |
| 2026-04-30 | 任务线扩展为 **13 步**（客户基本情况了解 → … → 字段设计）+ `all_done`；移除旧「业务能力流程提取」及 canonical **`task2`** 在设计页收口；标题 **`任务 N：中文名`**（`designLinePillLabel`）；步进由 `designDetailLineInference` + `reconcileDesignDetailLineTaskId` 与聊天 JSON/阶段对齐 |
| 2026-05-07 | **任务推理**：已废止独立表 `DesignDetailTaskReasoning` 与台账 `design_mode_reasoning.md`；设计详情 LLM 审计以聊天 `task1LlmQueryBlock` + 任务进展工作区为准。 |
| 2026-04-29 | 任务 1 任务动态卡进度区移除 mirror 同源行（企业背景洞察 / 工商提炼完成 / 基本信息卡 / 自动确认工商等），仅保留卡首行、`designOnlyProgressTail`、完成行 |
| 2026-04-15 | task1 绿色引导改为「请提供客户工商及经营范围信息」；进度路径用户发送后：`→ 正在生成 bmc` 行尾环形动画 → 完成后绿色 ✓ → `→ bmc 生成` 换行 + 灰色引用 BMC JSON；持久化 `task1LlmQueryBlock`（备注「设计详情 BMC 生成」）；刷新由 hydrate 从聊天回放尾段 |
| 2026-04-15 | **修正**：工商提炼成功后不再经 `designOnlyProgressTail` 插入「请反馈客户的基本需求」（主站映射残留）；与进度路径一致 **直接** 走同一套 BMC 生成链。 |
| 2026-04-15 | **去主站映射**：task1 启动补丁写入 **设计页专用** 系统引导（`【设计详情】…`）；任务动态行不再用主站初需/工商短句驱动蓝字与 ⏳；`taskStartNotification.taskName` 与 `resolveTask1DisplayName` 固定为设计任务线「客户基本情况了解」，不读 `FOLLOW_TASKS`。 |
| 2026-04-15 | **门控**：不再因「未确认 basicInfoCard」阻塞设计页发送；发送前修剪尾随未确认卡 + 工商提炼块，保证可走 BMC。 |

---

## 1. 产品定位

- **入口**：首页客户档案卡「设计」→ `design-detail.html`（`?caseId=`）。
- **与主站详情差异**：不加载 `frontend/main.js`；亮色画布工作区 + 左侧**任务进展**轻量呈现；业务真源仍为同源案例与 `problem_detail_chats`（bundle + `saveProblemDetailChat`）。

---

## 2. 信息架构

| 区域 | 职责 |
| ---- | ---- |
| 顶栏 | **使用模式**：「← 返回首页」、**「完全重启」**、**使用/调试模式**切换；**调试模式**另含「选择重启」「重启当前」、**「LLM」**、**「逻辑」**、**「Tree」** |
| 左侧 · 任务进展 | 标题 **「任务进展」**（左）；**调试模式**下标题栏右侧 **紫底白字圆角标签**（当前任务中文名）；**使用模式**不展示该标签；其下 **无**「任务动态」小标题，直接为淡黄进度卡片流（每卡约 10 行滚动进度区、逐行逐字流式）；task1 卡进入：`→ 我即将开始…` 后紧跟 **绿色** `→ 请提供客户工商及经营范围信息`；用户从底部聊天发送且允许落库时，进度区追加 `→ 正在提炼客户基本信息`（行尾 **蓝色**环 → 完成后 **绿色 ✓**），再在其下追加 **灰色** `「` 引用 **经营信息提炼 JSON** 摘要行（**仅前 3 字段 +「。。。」**，短停后再「正在绘制客户基本信息画布」并更新右侧画布；完整 JSON 在聊天块与右侧表）；**不**再追加 `→ 接收到用户输入`；**若**后续步骤触发 BMC 链，可再出现 `→ 正在生成 bmc`（行尾环形动画 → 完成后绿色 ✓）、`→ bmc 生成` 与 **灰色** BMC JSON 引用块；task1 启动由 hydrate **自动确认**（无按钮） |
| 左侧 · 输入区 | 占位文案随任务状态更新；门控满足时可发**工商正文**等；任务 1 等待工商（绿色引导已完整展示且尚无「正在提炼」行）时占位为 **「请提供客户工商及经营范围信息」**，输入框 **蓝色闪烁光晕**；用户点击发送进入 `sendBusy` 后 **立即** 去掉光晕 class（与禁用态一致，避免发送过程中边框仍闪） |
| 右侧 | 亮色 **动态 Tab 画布**（横向 Tab + 独立面板；默认「案例概览」，提炼成功后「客户基本信息」表格页；**每新增一种**横向 Tab 自动切到该 Tab；**当前 Tab** 标题 **蓝色闪烁光晕**），与主站暗色主题区分 |

---

## 3. 沟通协议（数据与同步）

### 3.1 真源

- **案例与聊天**：与详情同源 API / 存储适配器（`refreshProblemDetailBundle`、`saveProblemDetailChat`、`getProblemDetailChatStorageKey` 等）。
- **设计页不写独立聊天库**：所有持久化消息类型与主站一致，便于详情页续办。
- **任务进展左栏 UI 快照**（进度卡流式行、画布 Tab、底部草稿等）：表 `DesignDetailProgressWorkspace`（`GET/PUT/DELETE …/problem-cases/:id/design-detail/progress-workspace`）；与当前聊天 **消息指纹**（条数 + 末条 `id`）一致时才 hydrate 后覆盖 UI；**online 亦镜像** `localStorage` 键 `smart_cto_dd_progress_ws_v1:{caseId}`（登录超时 / 远端 PUT 失败时 hydrate 择优恢复）；offline 仅 localStorage；LLM 日志 / 逻辑树刷新时 **立即 flush**（与 debounce 落库并存）；「重启当前」/「完全重启」均会删远端/本地快照。实现见 `designDetailProgressWorkspace.ts`、`useDesignDetailChat.ts`。
- **任务关键词多形态**：表 `DesignDetailTaskToken`（**`tokenId`**：新写入 **`tk_*`**，历史可能 **cuid**；`caseId`＝`ProblemCase.id`、`taskId`＝设计任务线内部 id、`tokens`＝JSON 字符串数组）；与展示用档案号 `archiveNo` 不同源，需 join；`GET …/design-detail/task-graph` 只读聚合。
- **特征取值节点**：表 `DesignFeatureNode`（**`featureId` 主键**：新写入 **`ft_`+12 位**，历史可能 **`dd:…`** 或 **cuid**；`tokenId`→`DesignDetailTaskToken.tokenId`；**列 `TokenStr` JSON**（Prisma：`surfaceTokens`）与同 token 行 `tokens` 一致、`operator`、`value` JSON）。
- **特征间逻辑边**：表 `DesignLogicLink`（**`linkId`**：新写入 **`lk_`+12 位**，历史可能 **cuid**；`sourceFeatureId` / `targetFeatureId` **FK→`DesignFeatureNode.featureId`**、`weight`∈[0,1]、`logic`）；删特征级联删边。
- **逻辑弹层任务 1 pill 配色**：`GET …/design-detail/task-graph` 各行含 **`pillBatchKey`**（工商 `customer_basic` 恒 `cb-0`；`customer_requirement` **优先**按 token 的 **`requirementSyncGeneration`**（与案例 `designDetailRequirementSyncGen` 对齐：`businessContext` 分域每轮全量同步时递增，同轮其它分域沿用该值）映射为 `cr-0`…`cr-7`；未写轮次的旧行仍按 `createdAt` 最大间隔启发式，默认阈值 10 分钟 → 至多 `cr-0`/`cr-1`）；**同一 `pillBatchKey` 下不论业务分域**，Token / Feature / 逻辑 pill **同色**；仍保留 `themeKey` 供语义；旧客户端无 `pillBatchKey` 时弹层回退按 `themeKey` 分域色（`.dd-logic-pill.dd-logic-pill--tk-*`）。
- **逻辑弹层任务 2（`scale_org_mode_extract`）**：**逻辑** Tab 在 **`links.length > 0`** 时以 **`linkId`** 为一级可折叠行；展开后为 **2×3 网格**：首行标题 **SourceFeature / （Logic·读屏） / TargetFeature**；次行左、右为 **三块圆角子卡**（内容仍为 **`tokenDisplay` / `operator` / `name`**，与 `DesignFeatureNode` 对齐，**不**再展示 Token/Operator/Value **标签字**）；**中间列**为 **蓝底 `weight` 标签 + 蓝色水平箭头（源→向）+ 下方浅蓝圆角卡**展示 **`logic` 全文**；桌面端箭头竖直位置约在端点内容区 **上 1/3**；若接口尚未下发 `source`/`target`，主卡内提示需部署并**重启后端**后硬刷新；其余任务步仍为逻辑 pill。
- **Task1 客户基本信息图（online）**：顺序为 **JSON 灰行 reveal 完毕** → **「正在绘制客户基本信息画布」+ 右侧 Tab/表就绪** → **「→ 提炼推导逻辑」**（行尾蓝环 → ✓）→ `postDesignDetailSyncTask1BasicInfoGraph`；**仅同步成功（或离线视为完成）后** 再推送绿色 **「→ 请输入用户需求」** 并将阶段置 `awaiting`。按字段写 `DesignDetailTaskToken`；空值不写 `DesignFeatureNode`；**当前不写**任务 1 推导用 `DesignLogicLink`（逻辑弹层任务 1「逻辑」Tab 恒为空）。
- **设计任务线图清理**：`DELETE /api/problem-cases/:id/design-detail/task-graph/:taskId` 删除该步 `DesignDetailTaskToken`（级联 `DesignFeatureNode`、`DesignLogicLink`）；**「完全重启」**（online）调用 **无后缀** `DELETE …/design-detail/task-graph` 一次清空本案例**全部**线步图；**「重启当前」**（online）在修剪聊天后按 **`buildTaskGraphDeleteTaskIdsForRestartAnchor`** 对**锚点线步及之后**各 `:taskId` 调用删除；**仅锚点为任务 1（`customer_basic`）时**再删 `taskId = customer_requirement`（需求提炼分域同步用，≠ 线步 id），避免任务 1 重启后残留分域 token。
- **设计页「当前任务」步进**：独立键 `smart_cto_design_detail_line_v1:{caseId}`（见 `design_mode_tasks.md`），与详情步骤条 **解耦**；任务 1 依赖 `isTaskCompleted(task1)` + 任务动态卡内完成行流式结束；任务 2～13 由 **`reconcileDesignDetailLineTaskId`**（需求 JSON + 本页需求阶段）推断，**不**依赖 canonical `task2`。

### 3.2 轮询与 hydrate

- **轮询间隔**：`useDesignDetailChat.ts` 内 `POLL_MS`（当前 2800ms）拉 bundle；`mergeResolvedItemForDesign` 仍合并列表态（**仅**用于 item 字段真源，**不**驱动设计模式里程碑）。
- **任务动态进度行（task1 步）**：**不**再合并 `collectTask1ChatProcessMirrorLines` / `collectPendingInteractiveBlockLines` / `formatDesignProgressTaskStartLine`；仅 `makeCard` 首行 + `designOnlyProgressTail`（若有）+ 完成行；指纹为 `designOnlyProgressTail.join('\u0001')` 驱动 tail 追加。

### 3.3 task1 启动与确认

- **在线**：检测到 task1 未确认 `taskStartNotification` 时自动 `POST .../tasks/task1/start` 并补丁聊天（与后端 task 契约对齐；设计页无手动按钮）。
- **持久化策略**：`taskStartNotification` 可仅持久化；设计页**不**在进展区自动插入详情同款「任务通知：我即将开始…」前缀（见 `shouldPersistTask1StartNotification` 与镜像规则）。
- **启动后系统引导**：`applyTask1StartConfirmToMessages` 写入 **`DESIGN_DETAIL_TASK1_GUIDE_CONTENT`**（见 `designDetailProgressGovernance.ts`），**不**再写入主站同款「请提供企业基本工商信息」。
- **`designOnlyProgressTail`**：仅用于其它本地进度短句扩展；**不再**用于插入「请反馈客户的基本需求」。

### 3.4 工商发送链路（设计页）

- 门控满足时：用户输入 **工商/经营范围正文** → 持久化 user 消息 → 任务动态 **「正在提炼客户基本信息」** + 行尾加载态 → `extractDesignDetailBusinessInfoFromUserFeedback`（`task1BusinessInsight.js`）→ 行尾换 ✓ → 灰块 JSON **按码点流式揭示**（与进展区 ticker 一致）→ 聊天写入 `task1LlmQueryBlock` + 未确认 `basicInfoCard` → JSON reveal **结束后**短停顿再追加 **「正在绘制客户基本信息画布」**（行尾态）→ **再**更新右侧画布 Tab/表。**本步不**调用 `runDesignDetailBmcChain` / `generateDesignDetailBmcFromContext`；**不**推送「接收到用户输入」进度行。
- **尾随未确认卡**：本页再次发送成功门内会摘除**末尾**未确认 `basicInfoCard`（及紧邻「工商信息提炼」或「设计详情经营信息提炼」`task1LlmQueryBlock`），避免详情页遗留卡导致无法写入；不依赖用户先去详情点确认。

---

## 4. 进展区 / 任务动态 UI 规则

| 元素 | 规则 |
| ---- | ---- |
| 标题栏当前任务标签 | **紫底白字**、圆角矩形、`justify-content: space-between` 靠右；仅 **任务中文名**（无「任务1/2」前缀）；`all_done` 时为「已全部完成」 |
| 任务动态卡标题栏 | 进行中：**无**右上角转圈；已完成：**绿色 ✓** + 耗时 **绿色圆角描边**（固定整秒，由 `startedAtMs`/`completedAtMs` 或 `durationSec` 得出） |
| 任务动态进度区 | 约 **10 行**可视高度、`overflow-y: auto`；行首蓝色 `→`；**逐行**且每行 **逐码点** reveal（同原进展区 ticker 策略）；经营信息提炼后的 **灰色 JSON 引用行**（`user_quote`）与箭头行共用同一 ticker，**摘要 JSON（前 3 字段 +「。。。」）按码点流式揭示**（含换行），再进入「正在绘制客户基本信息画布」与画布 Tab 更新 |
| 需用户返回内容的行 | 设计页已 **关闭** 与主站初需/工商引导语联动的蓝字 + ⏳（`designDetailProgressLineNeedsUserInput` / `…Spinner` 恒为假）；若未来需要本页专用「待输入」行，再单独约定短句与门控 |

---

## 5. 对话卡片与消息类型（设计页相关子集）

以下为设计页 hydrate / 镜像会消费或与主站对齐的类型（扩展简洁模式时在本表追加）。

| 类型 / 概念 | 说明 |
| ------------ | ---- |
| `DesignTaskDynamicsCard.vue` | 淡黄任务动态卡：标题、进行中/完成态、进度滚动区 |
| `dynamicsCardsView`（`useDesignDetailChat` 导出） | 任务动态卡列表；与 `designDetailLineState` 当前步联动 |
| `taskStartNotification` | taskId、确认前/后文案；设计页对前缀展示有裁剪策略（见 §3） |
| `task1LlmQueryBlock` | 经营信息提炼 / 工商提炼 /（若存在）BMC 等过程日志；设计页 **不**再在左侧聊天区单独展示提炼 JSON 磨砂块（JSON 仅任务动态灰行 + 右侧「客户基本信息」表） |
| `basicInfoCard` | 结构化工商卡；未确认时不重复提炼 |
| `preliminaryRequirementFollowupBlock` 等 | 设计页通过 `lastHydratedPreliminaryFollowupActive` 参与沙漏门控 |

---

## 6. 「重启当前」与「完全重启」（设计详情页）

### 6.1 「重启当前」

- **本页行为**：顶栏按钮 **不**调用 `SmartCto.problemDetailRestart`。以 **`currentDesignLineTaskId` 为锚**（`restartCurrentTaskFromDesignPage`，`source: current`）：默认 **仅清空当前线步 X**（`current_line_step`）；**任务 5.1～5.5** 子链例外——「重启当前」会级联清空 **锚点之后至 5.5**（如锚点 5.3 会删 5.3+5.5 推理图/LLM，**不**删任务 6/8.5）。`deleteDesignDetailTaskGraph` / `llm-logs/clear` 与推理图落库 **中文 taskId** 对齐（含 **任务 8.5**）。若要清空 **Y 及之后全部线步**（含 6、8.5 等），请用 **§6.3 选择重启** 或 **§6.2 完全重启**。
- **「现状理解」画布**：重启影响 **任务 5.1** 时清空整 Tab 数据；影响 **5.2～5.5** 时 `refreshCurrentStateUnderstandingFromTaskGraph`；影响 **任务 6**（含选择重启从 5.5 起连带 6）时先 **摘掉内存中任务 6 推理图**（第四层关键场景列清空），再拉 task-graph 刷新，与 5.3 落库后刷新第三层口径一致。
- **`designDynamicsSuppressPersistedReplay`**：非任务 1 锚点重启、已从聊天拉回任务 1 画布后再次置 **true**，至用户再次在底部 **发送** 前，轮询 **不**把历史任务动态从 hydrate 回放进卡，避免与刚清空的进度打架。
- **其它入口**：`problemDetailRestartFromCase.ts` 仍向 `window` 注册 `SmartCto.problemDetailRestart`，供主站详情等使用；与设计页本按钮 **解耦**。

### 6.2 「完全重启」

- **语义**：全案例在**设计页语境下**「从零开始」——同源 `problem_detail_chats` **整段清空**后仅保留已确认的 task1 `taskStartNotification`（见 `applyDesignDetailFullSessionResetForCaseId`）；全案 item 回退 **task1**（含 `currentMajorStage: 0`、剔除 `completedTaskIds` 中的 `task1` 等，与主站 task1 重启口径对齐）；`DELETE …/design-detail/task-graph` 删除**全部**推理图行；随后 **`POST …/design-detail/sync-task0-toolbox-primitives`**（有工具原语时）写入逻辑树 **任务 0 / L0-工具原语层** 并递增 **`logicTreeGraphRefreshTick`**；`POST …/llm-logs/clear` **`{ all: true }`** 删除**全部** `ProblemCaseLlmLog`；任务进展工作区 `DELETE`；画布 `resetDesignCanvasWorkspace`；设计线 **强制** `optional_toolbox_primitive`（任务 0，勿与全案 `task1` id 混淆）；收尾 **`bumpLlmLogAuditRefresh`**。
- **竞态收口**：若「任务 2 L1」`/ai/chat` 仍在进行时点完全重启，须 **Abort** 在途请求（`fetchDeepSeekChat` 合并 `options.signal`）并递增会话代数，避免清库后旧请求成功再写一条审计；清库后 **约 2.2s 再执行一次** `llm-logs/clear { all:true }` 并 `bumpLlmLogAuditRefresh` 作兜底。
- **排查日志**：控制台过滤 **`[design-detail:full-restart]`**（`phase` 含 `button_*`、`handler_*`、`persist_*`、`llm_logs_clear_all_*`、`online_api_probe` 等）；HTTP 层另见 **`[problem-case-api]`** `llm-logs/clear`；服务端见 **`[problem-case:llm-logs-clear]`**。若 `llm_logs_clear_all_skipped` 且 `postClearCaseLlmLogsAll_missing`，说明未加载 `problem-case-api` 或未挂载 `SmartCto.problemCaseApi`，清库不会发往后端。
- **与 6.1 / 6.3 差异**：6.2 为**整聊天** + **全部图/逻辑边** + **全部审计** + **全案 task1 回退**。

### 6.3 「选择重启」

- **语义**：用户选定线步 **Y**（`restartFromSelectedLineTaskAnchor`，`source: select`）→ `from_line_step_inclusive`：清空 **Y 及之后** 全部线步的推理图（含任务 7 的 `key_requirement_scenarios` 与 `任务 7：…` 落库 id）、LLM 审计、修订记录等；**保留** Y 之前线步数据；设计线写回 **Y**。案例 0006 若当前在任务 1 但库中仍有任务 7 逻辑边，应使用本按钮选 **任务 1** 或 **完全重启**，勿仅用「重启当前」。
- **工作区（2026-06）**：在 **1≤Y≤当前线步 A** 且 A 之后无产物时，**不再** `DELETE` 整表 `progress-workspace`；保留严格早于 **Y** 的 `dynamicsCards` 快照，仅裁剪 **Y～A** 线步对应内存字段（5.1 现状理解 / 6.5 诊断审查等）并 `PUT` 回写。推理图/LLM 仍清 **Y 及之后**（与上条一致）。**完全重启** / **重启当前** / 锚点任务 1 仍整表删工作区。

---

## 7. 已知限制（与案例详情能力边界）

- 工商卡 **确认**、初步需求提炼完整闭环仍须在**案例详情页**完成（设计页为简洁入口，数据仍写同源聊天）。
- 未执行 `main.js` 内 `pushTask1PreliminaryLlmQueryFromCaseIfNeeded` 等部分 item 侧合并逻辑；扩展能力时在本节更新差异清单。

---

## 8. 后续扩展（占位）

- [ ] 简洁模式后续若独立接入主站 task2 BMC 入口时的**卡片形态**与**确认条**文案（与当前 13 步任务线并列评估）。
- [ ] 右侧画布与左侧某条镜像行的**锚点联动**（滚动/高亮）。
- [ ] 离线/弱网下的重试与 `llmRetryNoticeBlock` 对齐策略。

---

## 9. 交叉引用

- 提示词台账：`design_mode_promts.md`
- 代码索引：`AGENTS.md`
- 设计页进度/工商门控：`designDetailProgressGovernance.ts`（案例详情仍可有 `frontend/js/core/design-detail-progress-mirror.js`，与 Vue 治理层字面上可不一致）
