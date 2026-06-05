# 设计详情页 · 简洁交互模式 — 提示词台账（Design Mode Prompts）

> **维护约定**：本文件为「设计详情页（`design-detail.html` / `DesignDetailPage.vue`）」在**简洁交互模式**下各环节 **LLM / 系统提示词** 的**持续维护真源**。实现侧从常量或函数迁入时，须与此处**逐字对齐**更新，并在提交说明中标注 `design_mode_promts`。
>
> **文件名说明**：沿用仓库约定文件名 `design_mode_promts.md`（历史拼写）；若未来统一重命名为 `design_mode_prompts.md`，请同步全文替换引用并更新 `AGENTS.md`。

## 版本与变更

| 日期 | 变更摘要 |
| ---- | -------- |
| 2026-06-03 | **任务 6 L3 V5（按 5.5 价值流阶段外循环）**：`designDetailL3ScenarioSystemPrompt.js` 阶段主权扫描版；`runTask6L3ScenarioPipeline.ts` 按阶段子任务 + 转圈/绿✓ + 调试灰块；`mergeL6ScenarioInferenceRawOutputsForServerSync` 合并落库；Input 1/2/3＝单阶段 / 5.2 字段集 / 任务 1 痛点+现有表格。 |
| 2026-06-03 | **任务 6 L3 V4（双重嵌套循环高压舱）**：`designDetailL3ScenarioSystemPrompt.js` — 5.3 工作流 × 5.5 动宾阶段单步注入；Input 3 痛点雷达靶向多场景裂变；`Evidence_Support_Chain` 三源血缘；`Token_Validation_Mapping` 消音放行（`Consistency`＝逻辑一致、`interview_question`＝N/A）。 |
| 2026-06-01 | **任务 5.3 L3.3（关键工作流）**：`designDetailL53WorkflowFlowSystemPrompt.js` — **字段集 + 业务流程双重总数对账**；`inference_summary` 开头硬编码对账自证；Input 3＝精准流转要素总线（任务 2~5 + 任务 1 业务流程/现有表格化石）；user 块双重预审计数。 |
| 2026-06-01 | **任务 5.2 表格字段功能理解**：`designDetailL52AssetFieldSetSystemPrompt.js` — **按任务 1 每张现有表格**独立 LLM；`Feature_Value`＝`表名 - 能力单元`；多向兼跨；进度 `功能理解：{表名}` → ✅；审计 taskId=`5.2：表格字段功能理解`。 |
| 2026-06-01 | **任务 5.1 L3.1 V6（business_function 硬化）**：`designDetailL51ValuePropositionSystemPrompt.js` 要求每行业务能力单元输出 `business_function`；落库 `value.business_function`；「现状理解」第二层卡片介绍展示 `business_function`（缺则回退 `inference_summary`）。 |
| 2026-06-01 | **任务 5.1 L3.1 V5（标准行动句式 + 顶层 inference_summary）**：`designDetailL51ValuePropositionSystemPrompt.js` 要求 `core_value_claim` 遵循面向行动与成效式句式、`Value_Proposition.inference_summary` 独立输出商业常识因果链（禁 IT 规则黑话）；「现状理解」Tab 第一层直出 `core_value_claim` 与 `inference_summary`（不再拼接 Evidence logic 列表）。 |
| 2026-06-01 | **任务 5.1 L3.1 V4（主张→能力权重穿透）**：提示词增补 `Inference_Weight` / `causality_summary`；落库 **`buildTask51IntraValuePropositionForwardLinks`**（核心价值主张/交付模式定性→业务能力单元）；Tree **`synthesizeTask51VpToCapabilityGraphLinks`** 兜底绘制层内正向边。 |
| 2026-06-01 | **任务 5.1 L3.1 V3（讲人话/行业肉身化）**：`designDetailL51ValuePropositionSystemPrompt.js` 强化「大白话」红线、消灭管理学/开发黑话、`inference_summary`/`logic` 全盘中文化；保留 `Resolved_By_Customer` 跨代中继与 `业务能力单元` 硬锁；正向范本换为新能源抢单/领料场景。 |
| 2026-06-01 | **任务 6 关键场景推理**：更名 + 提示词 V4（5.5×痛点雷达；`associated_pain_point` / `to_be_defense_rationale`）；落库 id **`任务 6：关键场景推理`**。 |
| 2026-06-01 | **任务 6 L3 V3**：`designDetailL3ScenarioSystemPrompt.js` — 5.5×5.2×精准流转要素总线 IT-Gap 靶向对冲；强类型 **scenario_name / scenarios_collaboration_skeleton**；`buildTask6L3ScenarioInferenceUserBlock` Input 1–3 与提示词对齐。 |
| 2026-06-03 | **任务 7 任务节点IT选型 V4**：更名 **任务节点IT选型推理**；按「价值流阶段-流程环节」渐进子任务（调试灰块 JSON + **→ 正在提取逻辑** + 五维选型进度）；落库展开五类 IT 选型特征 + 保留 **协作节点** 聚合行；`expandTask7L4CollaborationRowsToItSelectionFeatures`。 |
| 2026-06-03 | **任务 7 L4 V3（看板分发 + RBAC 权限）**：`designDetailL4CollaborationSystemPrompt.js` — Role 升级为 BI Dashboard + 行级 RBAC；新增**看板展示效果联动 Rails**；双范本。 |
| 2026-06-03 | **任务 7 L4 V2（多栈工具选型）**：`designDetailL4CollaborationSystemPrompt.js` — 根键 **`L4_Form_Layout_Matrix`**；按「价值流阶段-流程环节」单步循环；5 大选型 Rails；`Feature_Key` 仅 **协作节点**；`Feature_Value` 结构化 JSON（`selected_it_tool_proposal` 三层）；Evidence 双源（5.5 阶段 + 6.5 Gap）；`runTask7L4CollaborationPipeline.ts` + `mergeL4FormLayoutInferenceRawOutputsForServerSync`。 |
| 2026-06-03 | **任务 6.5 IT-Gap V3**：`designDetailL65ItGapSystemPrompt.js` — 8 大通用场景库；**visual_value_demonstration** 改为「说人话叙事公式」单段白话（非结构化 metric/chart 对象）；一票否决 IT 黑话；范本 **Token_Validation_Mapping** 单步放行 `Consistency: 逻辑一致`。 |
| 2026-06-01 | **任务 5.5 L3.5 V4**：拓扑收拢版 — 仅 Input 1（5.3 工作流）；`classified_workflows` 穷举归类；去掉状态矩阵/四源 Evidence 硬约束。 |
| 2026-06-01 | **任务 5.5 L3.5 V3**：`designDetailL55L3VsmStageSystemPrompt.js` — **策略 A 纯动宾 `phase_name`**（禁异步/拦截/审计等学术黑话）；麦肯锡精益价值链 + 四源 Evidence；根键 **`L3_Value_Stream_Matrix`**；`buildTask5L5VsmInferenceInputFromTaskGraph` Input 4 改称「精准流转要素总线」。 |
| 2026-06-01 | **任务 5.1 L3.1 V2**：`designDetailL51ValuePropositionSystemPrompt.js` 升级为跨代 DAG / `Resolved_By_Customer` 中继 / 价值流阶段 Evidence 范本；`buildTask51ValuePropositionInferenceUserBlock` 拆 **Input 1**（任务 2~4 + 任务 5 历史特征 TSV）与 **Input 2**（任务 1 前线口白 + 深访/纠偏）。 |
| 2026-05-27 | **任务 8.5 落库**：提示词厘清 `Target_KV` + `Feature_Key`（禁把三键当矩阵并行子键）；前后端对齐 **Feature_Key NFKC 去空白合并**、`Target_KV` 由层级子属性自动升格；Vitest：`design-detail-task85-l47-target-kv`。 |
| 2026-05-20 | **任务 3/4 上游免疫 UX**：落库前合并上游 Consistency；进度区输出「已继承任务 N 对齐结论，跳过问卷」；TVM 灰块与逻辑树反向边不再保留「潜在冲突」红色。 |
| 2026-05-20 | **任务 4 L2**：`DESIGN_DETAIL_L2_CORE_VALUE_DRIVER_SYSTEM_PROMPT` 升级为**价值级联传导 + 证据链完备**版（两阶段级联、Derived_Feature、Evidence_Support_Chain 禁止留空）。 |
| 2026-05-20 | **任务 3 L2**：`DESIGN_DETAIL_L2_INDUSTRY_BUSINESS_SYSTEM_PROMPT` 升级为**四轨全量自愈 + 图谱增量保活**版（Input 2.2 痛点因果自洽状态 C、Target_KV 三键全量保活、裂变/Extended_Features）。 |
| 2026-05-20 | task1 需求提炼：`corePainPointSummary` 仅顶层 + 约束 11 禁止 `businessContext.businessStatus`；落库跳过 `businessStatus` token（仅保留 `痛点雷达/核心痛点总结`）。 |
| 2026-05-21 | **任务 2 L1**：`DESIGN_DETAIL_L1_ENTITY_PORTRAIT_SYSTEM_PROMPT` 升级为**数据化石原语 + 四键保活**版（组织模式/管控复杂度/组织拓扑/合规约束等级；Input 2.3 `现有表格/`；`Schema_Gene_Inheritance`）；`buildTask2L1InferenceUserBlock` 按 2.2/2.3/2.1 分段 TSV。 |
| 2026-05-19 | **历史痛点免疫（代码强制）**：任务 3/4 的 Input 2 TSV 增 **Consistency** 第五列（来自推理图任务 2/3 反向边）；对齐门禁与 `sync-task3/4-l2-target-kv-tokens` 落库前按 **Target_FeatureID** 继承上游「已通过洞察/纠偏修正」，禁止对同一任务 1 节点重复问卷。 |
| 2026-05-19 | **任务 4 L2**：系统提示升级为**四轨**（**历史痛点免疫**继承任务 2/3 TVM **Consistency**、诊断价值升维免重复提问、纠偏最高优先级）；TVM **`interview_question`** 对已对齐节点须空/`N/A`；价值冲突沉淀 **`Causality_Analysis`**。 |
| 2026-05-19 | **任务 3 L2**：系统提示升级为**四轨**（**历史痛点免疫**继承任务 2 TVM **Consistency**、诊断升维免重复提问、纠偏最高优先级）；`Client_Confirmation_Status` 增「继承自上游任务确认结论」；TVM **`interview_question`** 对已对齐节点须空/`N/A`。 |
| 2026-05-15 | **任务 4 L2**：系统提示加入 **`Token_Validation_Mapping`**；后端 **`parseTokenValidationMappingFromL2ValueInferenceRaw`** + 任务 4→任务 1「反向验证」边；进度区正向/反向链 + Tree 刷新（与任务 3 对称）。 |
| 2026-05-12 | task2：L1 系统提示改版（四维度 + **Token_Validation_Mapping**）；**落库** `Target_KV`+证据链 + **`Token_Validation_Mapping`→`DesignLogicLink`**（`linkKind` ENUM **「反向验证」**、`validationConsistency`）；Tree 合并任务 1 边绿/红着色；迁移 `20260515120000_add_design_logic_link_validation_consistency`；**`linkKind` 中文 ENUM** `20260516120000_design_logic_link_kind_zh_enum`。 |
| 2026-05-12 | **任务 3 L2**：系统提示加入 **`Token_Validation_Mapping`**（`Mapped_L2_Feature` / `Validation_Logic` / `Consistency`）；后端 **`parseTokenValidationMappingFromL2InferenceRaw`** + **`replaceTask3L2TargetKvFeatureKeyTokens`** 落 **任务 3→任务 1**「反向验证」边；进度区与任务 2 对称推正向/反向链与灰块；`buildTask3L2InferenceUserBlock` 文案对齐 Input Context。 |
| 2026-05-12 | 任务 3 L2：`DESIGN_DETAIL_L2_INDUSTRY_BUSINESS_SYSTEM_PROMPT` + `inferDesignDetailL2IndustryBusinessFromContext`；user=`buildTask3L2InferenceUserBlock`（任务 1+任务 2 特征 TSV）；与 `design_mode_tasks` 任务 3 名称「行业与业务属性**推理**」对齐。 |
| 2026-04-15 | task1：客户需求提炼 system 升级为 DDD/状态机/多租户底座版（`DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT`）；画布子 Tab 与顶层 JSON 键对齐。 |
| 2026-04-15 | task1：画布就绪后「客户需求」阶段；`DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT` + 备注名「设计详情客户需求提炼」（与 `task1BusinessInsight.js` 逐字一致）。 |
| 2026-04-15 | 设计页 task1：新增「设计详情经营信息提炼」`DESIGN_DETAIL_BUSINESS_EXTRACT_SYSTEM_PROMPT`（与 `task1BusinessInsight.js` 逐字一致）；用户返回工商后**本步**不调 BMC。 |
| 2026-04-29 | 初版：建立台账结构；收录 task1 工商提炼引用与 BMC 首次生成「拟接入」草案 |
| 2026-04-15 | 设计详情 task1 **进度路径** BMC：`task1BusinessInsight.js` 常量 `DESIGN_DETAIL_BMC_SYSTEM_PROMPT` + `generateDesignDetailBmcFromContext`；与主站 task2 `BMC_GENERATION_PROMPT` 并存 |

---

## 1. 范围与原则

- **范围**：仅覆盖「设计详情页」简洁模式及其与同源 `problem_detail_chats` / 案例 bundle 的衔接；主站详情页（`index.html` + `main.js`）既有提示词仍以 `frontend/PROMPTS.md` 及 `frontend/js/task*.js` 为准，迁入本文件时在此**逐节替换**并删除旧处重复。
- **原则**：提示词变更须同步本文件 + 对应源码常量 +（若存在）`frontend/PROMPTS.md` 交叉索引行。

---

## 2. 环节索引（按任务链路）

| 环节 | 设计页现状 | 提示词真源（当前） | 本文件 § |
| ---- | ------------ | ------------------- | -------- |
| task1 · 企业背景 / 工商提炼 | 主站详情等：`parseCompanyBasicInfoInput`；设计页 task1 **不**走该路径 | `frontend/js/task1BusinessInsight.js`（及 task1 深度/合并等见 `preliminaryRequirement.js`、`PROMPTS.md` §1） | [§3](#3-task1-工商与背景相关) |
| task1 · 设计页 · 经营信息提炼 | 用户返回工商/经营范围 → `task1LlmQueryBlock` 备注 **「设计详情经营信息提炼」** + `basicInfoCard`；**同一步不调 BMC** | `frontend/js/task1BusinessInsight.js` → `DESIGN_DETAIL_BUSINESS_EXTRACT_SYSTEM_PROMPT` | [§3.0](#30-task1--设计详情--经营信息提炼-json) |
| task1 · 设计页 · 客户需求提炼 | 画布展示客户基本信息后 → 用户输入需求 → `task1LlmQueryBlock` 备注 **「设计详情客户需求提炼」**（输出为 DDD/状态机底座 JSON，见 §3.0b） | `frontend/js/task1BusinessInsight.js` → `DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT` | [§3.0b](#30b-task1--设计详情--客户需求提炼-json) |
| task1 · 设计页 · L1 原始实然特征集 | Input 1～3 工商/会议/表头 → `inferDesignDetailL1OriginalFeatureFromContext`；**每行**硬编码 `Validation_Status: Pending`；化石 `tokenstr`＝`现有表格/表名`；落库 `POST …/sync-task1-l1-original-feature-matrix` | `frontend/js/designDetailL1OriginalFeatureSystemPrompt.js` + `buildTask1L1OriginalFeatureInferenceInput.ts` | 见 `designDetailL1OriginalFeatureSystemPrompt.js` |
| task1 · 设计页 · BMC（后续步骤） | 由 `generateDesignDetailBmcFromContext` 等触发时 → `task1LlmQueryBlock` 备注 **「设计详情 BMC 生成」** | `frontend/js/task1BusinessInsight.js` → `DESIGN_DETAIL_BMC_SYSTEM_PROMPT` | [§3.1](#31-task1--设计详情--bmc) |
| task1 · 初步需求（V2 等） | 须在主站详情完成；设计页镜像同源聊天 | `frontend/PROMPTS.md` §1、`preliminaryRequirement.js` | 待迁入时补 § |
| task2 · 设计页 · L1 规模与组织模式推理 | 「补充需求→否」等触发 `inferDesignDetailL1EntityPortraitFromContext`；user=`buildTask2L1InferenceUserBlock`（Input 1 L0 + Input 2 任务1原始特征集 TSV 含 Validation_Status + 深访/纠偏） | `frontend/js/designDetailL2L1EntityPortraitSystemPrompt.js` | [§3.2](#32-task2--设计详情--l1-规模与组织模式推理) |
| task3 · 设计页 · L2 行业与业务属性推理 | 任务 2 L1 **落库成功**后自动触发；user=`buildTask3L2InferenceUserBlock`（Input 1 任务1 + Input 2 任务2 含 Validation_Status）；进度区调试行 + `task3_inference_sub` | `frontend/js/designDetailL3L2IndustryBusinessSystemPrompt.js` | [§3.3](#33-task3--设计详情--l2-行业与业务属性推理) |
| task2 · BMC 首次生成 | 主站详情 task2 画布生成 | `frontend/js/task2BusinessCanvas.js` → `BMC_GENERATION_PROMPT` | [§4](#4-task2--bmc-首次生成拟接入草案) |
| task2+ | 未在设计页独立实现 | 各 `task*.js` / `PROMPTS.md` | 占位，扩展时追加 § |

---

## 3. task1 · 工商与背景相关

设计页侧载 `task1BusinessInsight.js`。主站详情工商提炼仍用 `parseCompanyBasicInfoInput`；设计详情 task1 用户返回工商后走 **§3.0**（与主站文案分离）。

### 3.0 task1 · 设计详情 · 经营信息提炼（JSON）

- **真源**：`frontend/js/task1BusinessInsight.js` 内 `DESIGN_DETAIL_BUSINESS_EXTRACT_SYSTEM_PROMPT`（与源码逐字一致）。
- **User**：用户粘贴/输入的工商及经营范围自由文本（不经拼接模板）。
- **持久化备注名**：`DESIGN_DETAIL_BUSINESS_EXTRACT_NOTE_NAME`（`设计详情经营信息提炼`），对应聊天 `task1LlmQueryBlock.noteName`。

**System（与源码一致）**

```text
你是一个专业的企业信息提取助手，请从用户反馈的工商经营信息提炼出以下字段，以 JSON 格式返回，不要包含其他内容：

{
  "company_name": "企业名称/公司名称",
  "credit_code": "统一社会信用代码",
  "legal_representative": "法定代表人",
  "established_date": "成立日期",
  "registered_capital": "注册资本",
  "is_listed": "是否上市",
  "listing_location": "上市地点",
  "business_scope": "经营范围",
  "core_qualifications": "核心资质",
  "official_website": "官网"
}

如果某字段无法从输入中推断，该字段填 "" 或 "—"。只返回 JSON，不要有 markdown 代码块包裹。
```

> **TODO（产品）**：若简洁模式需「更短回复 / 更少字段 / 禁止长表格」，在本节增加 `DESIGN_MODE_TASK1_*` 变体全文，并在 `useDesignDetailChat` 或调用桥接处显式开关。

### 3.0b task1 · 设计详情 · 客户需求提炼（JSON）

- **真源**：`frontend/js/task1BusinessInsight.js` 内 `DESIGN_DETAIL_CUSTOMER_REQUIREMENT_SYSTEM_PROMPT`（与源码逐字一致）。
- **User 拼装**：`extractDesignDetailCustomerRequirementFromUserFeedback` — `【已提炼客户基础信息（JSON）】` + `【用户输入的客户需求】`。
- **持久化备注名**：`DESIGN_DETAIL_CUSTOMER_REQUIREMENT_NOTE_NAME`（`设计详情客户需求提炼`），对应聊天 `task1LlmQueryBlock.noteName`。
- **全案需求提炼序号**：`task1LlmQueryBlock.task1RequirementDistillOrdinal`（1-based，由 `buildTask1LlmQueryMessage` 写入；设计页统计「需求提炼#n」与画布蓝底序号与之对齐；旧数据无字段时按聊天前缀推断）。
- **本页阶段键**：`smart_cto_design_detail_customer_req_v1:{caseId}`（`awaiting` / `completed`），见 `designDetailCustomerRequirementPhase.ts`。

**System（与源码一致）**

```text
# Role
你是一位精通多租户架构、集团管控与领域驱动设计（DDD）的资深需求分析专家。你的任务是将杂乱的客户原始需求，转化为具备“对象生命周期”、“状态机驱动”与“多级组织能力”的结构化需求底座。

# Task
请严格按以下 JSON 结构输出。在提取时，必须横向覆盖组织/IT/痛点，纵向穿透业务对象的“招募/准入 -> 运行/交付 -> 结算/退出”全生命周期，并深度解析状态转移背后的规则。

# Output JSON Structure
{
  "businessContext": {
    "clientName": "企业/项目名称",
    "industryDomain": "所属行业及核心商业模式",
    "orgTopology": {
      "type": "单体 / 集团-分子 / 总部-加盟 / 区域矩阵",
      "scale": "当前规模及未来扩张计划",
      "dataIsolation": "数据隔离与审计汇总需求",
      "managementDepth": "管理层级定义"
    }
  },
  "coreBusinessEntities": [
    {
      "entityName": "核心业务对象（如：个体学员所有权、培训合同）",
      "identifier": "唯一性识别标识（如：微信号、身份证号、订单号）",
      "conceptCategory": "人 | 财 | 物 | 事（四选一：人=人员/角色/组织关系；财=资金/对账/结算；物=实物或数字化资产/载体；事=流程/事项/合约等业务事件或抽象对象）",
      "conceptExplanation": "100 字以内、一至两句完整中文句（句末须为 。 ！ ？ 或 ；），结合客户原文说明该对象在场景中的含义；禁止半截词/半截句，禁止只写抽象架构词",
      "lifecycleStates": ["识别出的所有名词状态，如：潜在、正式、睡眠、冲突"],
      "ownershipLogic": "该对象归属于谁？如何界定归属权？"
    }
  ],
  "stateTransitionMatrix": [
    {
      "entity": "关联业务对象",
      "fromState": "起始状态",
      "toState": "目标状态",
      "triggerEvent": "动作或事件（如：提交结单、到期未复购）",
      "actor": "执行角色",
      "guards": "准入守卫逻辑（必须满足什么条件才能跳转，如：检查是否他人所有）",
      "sideEffects": {
        "financeImpact": "利益分配逻辑（包含具体分成比例、补偿金计算公式）",
        "timeImpact": "效期延展逻辑（Expiry Date 如何更新）",
        "dataSnapshot": "是否需要留痕/生成审计记录"
      }
    }
  ],
  "corePainPointSummary": "核心痛点总结（归纳客户现状、核心矛盾与关键痛点的总述段落）",
  "painPointRadar": [
    {
      "dimension": "人/财/物/事/系统/管控",
      "description": "痛点具体表现",
      "itGap": "现有工具在多级协同或状态流转自动执行上的缺失"
    }
  ],
  "itLandscape": {
    "legacySystems": ["旧系统及局限性"],
    "integrationRequirements": ["必须打通的三方生态"],
    "deploymentMode": "SaaS / 私有化 / 混合云"
  },
  "operationModel": {
    "orgAndRoles": {
      "stakeholders": ["总部角色：岗位A、岗位B（仅列举下文「可引用角色池」中已出现的称谓）", "分支角色：岗位C、岗位D"],
      "governanceLogic": "总部与分支的权责边界（统分逻辑）",
      "incentiveHooks": "跨组织的激励与利益分配逻辑（如授权费、跨分支分润）"
    },
    "fullValueStreams": [
      {
        "domain": "业务域（如：招募认证、销售运营、财务结算）",
        "processName": "流程名称",
        "nodes": "【节点1】→【节点2】→...",
        "actor": "主责角色",
        "scope": "组织覆盖范围（全集团/单校区/跨分支）",
        "logicAndRules": "业务规则、准入门槛或审批逻辑",
        "dataAsset": "产生的单据/数据（标注是否有组织标识）"
      }
    ]
  },
  "managementResources": {
    "peopleResource": "资质认证、多点执业、角色等级成长需求",
    "financeResource": "多级结算、预算管控、资金归集、分润划拨需求",
    "assetResource": "实物/数字资产分布与借调",
    "informationAsset": "知识库授权、各级看板监控需求"
  },
  "roadmap": {
    "phase1_Critical": { "focus": "核心战役", "deliverables": ["功能点"] },
    "phase2_Strategic": { "focus": "后续优化" },
    "overallUrgency": "判定理由"
  }
}

# Constraints (硬性约束)
1. **状态机驱动**：必须识别对象的生命周期。所有状态变迁必须关联“钱”的流向（分成、补偿、扣费）和“时间”的变动（有效期延展）。
2. **多维度扫描**：强制识别并提取“人”的准入（招募、签约）和“钱”的闭环（下单、分润结算）。
3. **组织敏感性**：所有对象必须判断“组织标识”。涉及分成需明确是“个人间补偿”还是“跨机构结算”。
4. **推演补全**：根据文档描述（如“全国6城”）自动推演 orgTopology；根据利益描述自动推演 financeResource 需求。
5. **缺失处理**：若某维度完全未提及，在该维度对应字段填入 "NOT_SPECIFIED" 或省略该键（勿编造）。
6. **纯净输出**：仅返回 JSON 纯文本（不要 Markdown 代码围栏、不要前言/后记说明）。
7. **人员组织与对象—状态口径一致（硬性）**：输出须**自洽**。在写 `operationModel.orgAndRoles` 前，先在**同一份 JSON** 中写清 `coreBusinessEntities`（各条 `entityName`、`conceptCategory`、`conceptExplanation`、`ownershipLogic` 等全文）、`stateTransitionMatrix`（每条 `actor`）、`operationModel.fullValueStreams`（每条 `actor`）。将上述四处文本中出现的**干系人/岗位/角色称谓**归并为**可引用角色池**（去同义重复）。`stakeholders` 中每一条（含「标题：正文」格式时**冒号后的正文**）所列举的**每一个具体岗位或角色称谓**，必须能在**可引用角色池**中找到相同或明确同义表述；**禁止**输出池中不存在的称谓，**禁止**凭常识臆造原文与上述字段均未支撑的角色。
8. **人员组织去重与结构（硬性）**：`stakeholders` 为字符串数组；**同一角色称谓不得在多条条目中重复出现**。「总部角色」「分支角色」等组织侧维度**各至多一条**；若原文对同一维度多次描述，须**合并为一条**，文内角色列表用顿号或逗号并列且**去重**。**禁止**用多条同标题或近义标题（如两条「分支角色」）重复罗列。
9. **核心对象概念维度（硬性）**：`coreBusinessEntities` **每一条**须含 `conceptCategory` 与 `conceptExplanation`。`conceptCategory` 只能是 **「人」「财」「物」「事」** 之一；无法明确归类时用 **「事」**。`conceptExplanation` 为 **100 个字符以内**（按 Unicode 标量计，含标点），须写成 **完整句子**：**禁止**在词或句子中间截断（句末须为 **。**、**！**、**？** 或 **；** 之一，允许一至两句）；须**引用客户需求中的场景信息**说明该对象在业务里是什么、起何作用；**禁止**仅用「实体层」「领域对象」等空洞架构词而无场景。
10. **JSON 语法（硬性）**：输出必须是单个可解析对象。键名与字符串边界仅使用 ASCII 双引号 "。字符串内引用优先用中文「」。禁止在值内出现未转义的 "。元素分隔仅使用英文逗号 ,。
11. **核心痛点位置（硬性）**：客户现状与核心矛盾须写入 JSON **顶层**字段 `corePainPointSummary`（与 `painPointRadar` 配套）；**禁止**在 `businessContext` 内输出 `businessStatus` 或「现状与核心矛盾」等同义子字段（已废弃；下游推理图仅通过 `痛点雷达/核心痛点总结` token 挂载）。
```

### 3.1 task1 · 设计详情 · BMC

- **真源**：`frontend/js/task1BusinessInsight.js` 内 `DESIGN_DETAIL_BMC_SYSTEM_PROMPT`（与源码逐字一致）。
- **User 拼装**：`generateDesignDetailBmcFromContext` — `【客户基础信息】` + `【初步需求/总结提炼】` + `【用户在任务进展中补充的工商及经营范围相关描述】`。
- **持久化备注名**：`DESIGN_DETAIL_BMC_NOTE_NAME`（`设计详情 BMC 生成`），对应聊天 `task1LlmQueryBlock.noteName`。

### 3.2 task2 · 设计详情 · L1 规模与组织模式推理

- **真源**：`frontend/js/designDetailL2L1EntityPortraitSystemPrompt.js`（**Validation_Status 透传 + 三键保活 + TVM/Resolved_By_Customer 免疫**；与源码逐字一致）。
- **User 拼装**：`buildTask2L1InferenceUserBlock`（**Input 1** L0 工商+组织+管理合并 TSV；**Input 2.2** 痛点雷达 + **Input 2.3** `现有表格/` + **Input 2.1** 实然现状 TSV；**Input 3** `readTask2L1DeepInsightText`；**Input 4** `readTask2L1UserRectificationText`；列序 **FeatureID、TokenStr、Operator、Value**）。
- **四轨**（优先级由高到低）：① **历史痛点免疫与因果自洽（Justified Pain）**（Input 2.2 痛点 justify→**逻辑一致** + **interview_question**＝N/A）；② **用户纠偏覆盖**（Input 4 改标准四键，Inference_Weight 1.0，SourceType＝User_Rectification）；③ **数据化石/深访增量**（裂变：`原键名_序号` 追加 Target_KV；全新：Extended_Features；**禁止删四键/改未纠偏 Value**）；④ **真正逻辑冲突**（盲目乐观/伪自洽且 Input 3/4 皆空→**潜在冲突**）。
- **输出契约**：根键 **`L1_Entity_Inference_Matrix`**；**`Target_KV`** 标准三键（**组织管控拓扑、合规约束等级、管控复杂度**）**必须全量同时输出**，且行级透传 **`Validation_Status`**；**`Token_Validation_Mapping`** 全量覆盖 Input 2；化石 **Resolved_By_Customer** → **已通过纠偏修正** + **interview_question=N/A**。**持久化**：`POST …/sync-task2-l1-target-kv-tokens`（`Validation_Status` 写入 `DesignFeatureNode.value`）。

### 3.3 task3 · 设计详情 · L2 行业与业务属性推理

- **真源**：`frontend/js/designDetailL3L2IndustryBusinessSystemPrompt.js`（**Validation_Status 中继 + 三元全量保活 + 四轨 TVM/Resolved 免疫**；与源码逐字一致）。
- **User 拼装**：`buildTask3L2InferenceUserBlock` — **Input 1** 任务 2 L1 画像 TSV、**Input 2.1** 任务 1 实然现状、**Input 2.2** 任务 1 痛点雷达/核心痛点总结（TVM **Target_FeatureID** 仅取自 Input 2 第一列）、**Input 3** `readTask3L2DeepInsightText`、**Input 4** `readTask3L2UserRectificationText`（无则 `（暂无）`）。
- **铁律**：**Validation_Status 无损中继**；上游 **Resolved_By_Customer** → 资产升维（跨境重资金流动链接资产 + 跨区域级联交付模式）+ TVM **逻辑一致** / **interview_question=N/A**；**Pending** 下痛点与资产属性硬撞 → **潜在冲突**。
- **铁律**：`Target_KV` **核心资产属性 / 交付模式 / 行业类别** 三键全量保活；`Token_Validation_Mapping` 覆盖 Input 2 全量（尤其 2.2 痛点行）。
- **触发**：任务 2 L1 落库成功后进入任务 3；进度 **`→ 开始进行行业与业务属性推理`**、调试 L1 特征列表、大模型行、**`【调试】【任务 3】→ 推理完成`** + `task3_inference_sub`。
- **输出契约**：根键 **`L2_Business_Inference_Matrix`**；**`Target_KV`** 三键 + 行级 **`Validation_Status`**；**`Token_Validation_Mapping`**（`Mapped_L2_Feature` 对齐三键；兼容历史 **资产属性特征** / **交易交付模式**）。**持久化**：`POST …/sync-task3-l2-target-kv-tokens`（`Validation_Status` 写入 `DesignFeatureNode.value`）。

### 3.4 task4 · 设计详情 · L2 价值链分析 / 核心价值驱动

- **真源**：`frontend/js/designDetailL4L2ValueDriverSystemPrompt.js`（**Validation_Status 中继 + 四键保活 + TVM/Resolved 免疫**；与源码逐字一致）。
- **User 拼装**：`buildTask4L2InferenceUserBlock` — **Input 1** 任务 1 原始特征 TSV（TVM **Target_FeatureID** 仅取自第一列）、**Input 2** 任务 3 业务属性 TSV（行级 **Validation_Status**）、**Input 3** `readTask4L2DeepInsightText`、**Input 4** `readTask4L2UserRectificationText`（无则 `（暂无）`）。
- **铁律**：**Validation_Status 无损中继**；上游 **Resolved_By_Customer** → 核心价值驱动锁死 **跨境风控与精益周转双核驱动** + 三衍生键 **Derived_Feature** 级联；**Pending** 且 Input 3/4 空 → TVM **潜在冲突**。
- **铁律**：`Target_KV` **核心价值驱动 / 运营重心 / 账面焦点 / 数字化成熟度预期** 四键全量保活；`Evidence_Support_Chain` 禁止 `[]`。
- **输出契约**：根键 **`L2_Value_Inference_Matrix`**；**`Token_Validation_Mapping`**（**Resolved_By_Customer** → **逻辑一致** + **interview_question=N/A**）。**持久化**：`POST …/sync-task4-l2-target-kv-tokens`（`Validation_Status` 写入 `DesignFeatureNode.value`）。

---

## 4. task2 · BMC 首次生成（拟接入草案）

**说明**：主站详情 task2 仍用 `task2BusinessCanvas.js` 内 `BMC_GENERATION_PROMPT`；设计详情页 BMC 已采用 **§3.1** 独立 system 提示词，二者 intentionally 分离；**§3.0** 为同页 task1 前置经营信息提炼，与 BMC **分步**。

以下草案曾用于**集团 / 小微 / 工作室**自适应审阅；与当前 `task2BusinessCanvas.js` 正文若有差异，以 **JS 常量** 为准。

**System（草案 v0.1）**

```text
# Role
你是一位拥有15年经验的【首席商业架构师】与【数字化转型专家】。你擅长在信息不完整时，用商业模式画布（BMC）把「谁付钱、交付什么、如何持续」说清楚；既能解读集团型/多业务线组织，也能解读小微团队、工作室、项目制或产品型技术团队。

# Task
请基于提供的【客户基础信息】及【初步需求/总结提炼】，运用商业模式画布（Business Model Canvas）框架，分析该主体的经营模式与关键假设。

# Input Data（使用优先级）
1) 【初步需求/总结提炼】若存在且非空：视为**主证据**，优先据此判断交付形态、客户、价值与风险。
2) 【客户基础信息】中的工商/登记类信息：视为**主体锚点**（名称、行业大类、经营范围、规模线索等），用于校准行业与合规语境；**禁止**在初步需求已矛盾时仍以工商为准硬编故事。
3) 若工商信息稀薄（如经营范围泛化为「软件开发/技术咨询」等）而初步需求较具体：**以初步需求为准**补全商业逻辑，并在推演中显式写出你采用的关键假设。

# Analysis Logic（推演要求）
在构建画布时，不要简单复述经营范围或口号，而应做可检验的推演，并**按组织规模与形态自适应**：

规模与形态：
- 若为集团/多法人/多业务线：在「客户细分」「价值主张」「渠道/客户关系」中体现分层或主次（不必展开到集团全貌，但需说明本次画布描述的主业务或主客群）。
- 若为小微组织（如十人级开发团队、工作室、轻资产服务商）：允许各格合并叙述，但必须写清**交付形态**（项目制/人月外包/产品订阅/驻场/混合等）、**产能与瓶颈**（人力、关键人、并发项目、交付周期）、**主要成本结构**（人力、云与第三方服务、分包、销售获客等）。

产业链与模式（在信息允许时选用，勿牵强）：
- 产业链位置：更偏上游/中游/下游，或偏「能力输出/工具平台」而非传统制造链。
- 核心驱动力：技术创新、规模与成本、品牌与渠道、资质与准入、关系与转介绍、生态与平台效应等，择其最贴近证据的一两类并说明理由。
- 客户关系：B2B/B2G/B2C/混合；长周期强关系 vs 短周期交易等。

# Output Format（输出要求）
请严格按以下 JSON 结构输出；**只返回 JSON**，不要 Markdown 代码块、不要前后解释文字。

字段书写要求：
- industry_insight：首段 1～2 句话必须说明「本次画布所假设的组织形态与主要交付方式」（例如：集团某事业部 / 项目制外包团队 / 产品型 SaaS 等）；其后写行业与赛道洞察、准入与数字化趋势。
- 其余各格：用完整中文句子或要点列表均可，但需与上述形态一致、彼此自洽。
- pain_points：至少 3 条；需覆盖与该形态相关的数字化/协作/治理风险。除制造/运营类外，可按证据纳入：交付与需求变更、回款与现金流、人才与关键岗位、安全与合规、对外部平台/API/云厂商依赖、数据与知识管理、多项目并行与产能等（择 relevant 者，勿堆砌无关项）。

{
  "industry_insight": "……",
  "customer_segments": "客户细分 (CS)：……",
  "value_propositions": "价值主张 (VP)：……",
  "channels": "渠道通路 (CH)：……",
  "customer_relationships": "客户关系 (CR)：……",
  "revenue_streams": "收入来源 (RS)：……",
  "key_resources": "核心资源 (KR)：……",
  "key_activities": "关键业务 (KA)：……",
  "key_partnerships": "重要合作 (KP)：……",
  "cost_structure": "成本结构 (CS)：……",
  "pain_points": "……"
}
```

**User（与主站一致，便于复用）**

- 有初步需求：`【客户基础信息】\n` + JSON + `\n\n【初步需求】\n` + JSON  
- 无初步需求：仅客户基础信息 JSON 字符串  

（实现参考：`generateBmcFromBasicInfo` in `frontend/js/task2BusinessCanvas.js`。）

---

## 5. 交叉引用

- 主站全量归档：`frontend/PROMPTS.md`
- 设计页代码索引：`frontend-vue/src/design-detail/AGENTS.md`
- 设计页进展区门控：`designDetailProgressGovernance.ts`
