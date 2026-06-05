/**
 * [INPUT]: `window` 上的 el、getDigitalProblems、pushAndSaveProblemDetailChat、renderProblemDetailChatFromStorage、
 *          fetchDeepSeekChat/hasAiConfig、getTimeStr、escapeHtml、setCurrentProblemDetailItem、parseValueStreamGraph、globalThis.pushLlmRetryNoticeBlock（main 注入，LLM 失败可重试）、
 *          pickRawE2eTransactionFlowJsonFromItemAndMessages、updateDigitalProblemItDesignSupplementSessions、globalThis.getDigitalProblemPersistKey（与 main 同源）、
 *          updateDigitalProblemItDesignSupplementStep、updateDigitalProblemItDesignSupplementBpmDraw、updateDigitalProblemGlobalItGapAnalysis、buildLlmMetaHtml、
 *          renderProblemDetailContent、renderProblemDetailHistory、showTaskCompletionConfirm、FOLLOW_TASKS、ITGAP_HISTORY_TASKS、IT_STRATEGY_TASKS
 * [OUTPUT]: IT设计补齐（task8）按事务流对象 Session 计划 + 自动顺序 LLM；`generateItDesignSupplementSessions`、
 *          `runItDesignSupplementForNextStep`、`runItDesignInterleavedNextStep`、`runItDesignSupplementAutoSequential`（逐事务：IT设计补齐 → 同事务 BPM 泳道绘制）；收尾仅一条系统通知 + `itDesignSupplementAllDoneConfirmBlock`「全部确认」后聚合并交由 main 弹出任务完工确认；历史两阶段仍支持 `itDesignBpmDrawSessionsBlock` + `runItDesignBpmDrawAutoSequential`。工作区 view `buildItDesignSupplementTransactionViewHtml`、`isItDesignBpmDrawCompleteForItem`。
 *          task9「对象状态机构建」工作区由 `problem-detail-runtime` 占位展示；本文件不再提供 task9 角色汇总类 UI。
 * [POS]: task8 与端到端 BPM 事务 JSON 衔接，替代原四阶段全局 ITGap 主路径
 *
 * [PROTOCOL]: 变更提示词、session 形状或工作区 view 结构时同步 `frontend/js/AGENTS.md`、`PROMPTS.md`（task8）、`communication-history.js` 归属；「确认所有」文案与 `main.js` 的 `IT_DESIGN_SUPPLEMENT_ALL_DONE_CONFIRM_CONTENT`（`globalThis`）同源。**FE-20260415**：`IT_DESIGN_SUPPLEMENT_SYSTEM_PROMPT` 升级为 V2.0（业务可视度自检、禁止纯 ID 化、业务属性层/工程逻辑层与审计员可读约束）。**FE-20260415-bpm-field-zh**：工作区流程图 view 将 `data_objects.fields` 的编码→中文名写入泳道 JSON 的 `field_label_map`，`it-design-bpm-flow-render.js` 绘制「写入字段」标签时优先中文（悬停 title 为编码）。**FE-20260414-task8-role-pool**：IT 设计与 BPM 泳道提示词约束——角色须落在初步需求人员组织（`orgAndRoles.stakeholders`）与已识别角色并集内，勿臆造无关角色；系统处理节点统一「系统」。用户消息含 `buildPreliminaryOrgStakeholdersExcerpt`。**FE-20260423**：事务 view 树中「ITGap 分析」`<details>` 默认折叠（无 `open`）。task8 session 行与 `globalItGapAnalysisJson` 对齐见 `main.js` 的 `resolveItDesignSupplementSessionsForTask8` / `overlayItDesignSupplementSessionsFromGlobalAggregate`。**FE-20260408**：IT 设计补齐 run 入口用 `persistKeyForItDesignCase` 门禁（勿仅用 `createdAt`）；失败与自动顺序收尾补 `renderProblemDetailContent`；与 `problem-detail-runtime` 的 `isItDesignV1`（`idSessions.length > 0`）对齐以保证 Session 计划已下发即可展示事务子卡。BPM 泳道 LLM：成功/失败均推 `task8LlmQueryBlock`（`noteName: 'BPM流程绘制'`）；过程日志备注「绘制：流程名」见 `communication-history.js`。IT 设计（非 BPM）推 `noteName: 'IT设计补齐'` + `stepName`；过程日志备注「设计：流程名」同文件。**FE-20260408-bpm-user**：`buildItDesignBpmDrawUserContent` 仅本事务 `bpm_detailed_flow` + `buildSlimDesignOutputForBpmDraw`（`it_gap_analysis` 按本段 `bpm_node_id` 过滤），不注入整包端到端 JSON。**FE-20260408-itgap-bpm-cols**：ITGap 表增「节点描述」「逻辑」列，数据来自端到端本事务 `bpm_detailed_flow` 与 `bpm_node_id` 对齐；`getBpmDetailedFlowForItDesignSession` + `problem-detail-runtime` 注入。**FE-20260408-session-hydrate**：执行交错/单步前 `ensureItDesignSupplementSessionsHydratedFromChat` 用 `global.resolveItDesignSupplementSessionsForTask8` 从聊天计划回填并 `updateDigitalProblemItDesignSupplementSessions`，避免案例行空 sessions 导致首轮不发起 LLM；推送「正在…」后重绘聊天须用 `getProblemDetailChatMessages()` 最新数组。**FE-20260408-auto-seq-log**：控制台设 `window.__FE_TASK8_IT_DESIGN_AUTO_SEQ_LOG = true` 后过滤 `[FE:task8-it-design-auto-seq]`，可追踪点击自动顺序执行后的 hydrate、交错步与收尾；在线模型接口 401/403/428 另见 `[FE:task8-it-design-ai]`（无需开关）。**FE-20260408-it-design-error-stop**：设计/BPM LLM 失败时推 `pushLlmRetryNoticeBlock`（`task8-it-design-auto-seq`）、`runItDesignSupplementAutoSequential` 立即停步；`isItDesignBpmDrawCompleteForItem` 交错计划须每事务设计+BPM 齐；`isTaskCompleted(task8)` V1 路径须用户完工确认后才放行 task9。**FE-20260408-bpm-flow-tabs**：「流程图绘制」子折叠输出 view｜json Tab（json 面板 `JSON.stringify(..., null, 2)` 层级展示）与 `data-chunks-b64`；挂载由 `main.js` 的 `setupItDesignBpmFlowDrawTabs` / `hydrateItDesignBpmFlowViewIfNeeded` 执行。**FE-20260408-bpm-swimlane-json**：BPM 泳道 LLM 主路径为严格 JSON；`tryParseBpmFlowSwimlaneModel` + `splitItDesignBpmDrawMarkdownChunks` 产出 `flowJson`（或兼容 `svg`/`mermaid`/`md`）；view 主路径 `renderItDesignBpmSwimlaneSvg`（`it-design-bpm-flow-render.js`），历史 SVG 仍 `sanitizeItDesignBpmSvgHtml`，mermaid 仍 `sanitizeItDesignBpmMermaidForRender`。**FE-20260414-bpm-title**：`buildItDesignSupplementTransactionViewHtml` 第六参事务名在泳道 JSON 缺 `flow_title` 时仅改写 view 用分块，json 子卡仍为原始 `bpmFlowDrawMarkdown`。**FE-20260414-bpm-logic-extract**：`normalizeBpmFlowSwimlaneModel` 用 `extractBpmSwimlaneStepLogicString` 合并 `logic_text`/`logic`/camelCase/`logic_meta` 等写入 `logic_text`，与 `pickLogicBodyText` 对齐。
 */
(function (global) {
  'use strict';

  /** 与 main.js `retryLlmFlowByAction` /「异常继续」一致 */
  const TASK8_IT_DESIGN_RETRY_ACTION = 'task8-it-design-auto-seq';

  /** 控制台 `window.__FE_TASK8_IT_DESIGN_AUTO_SEQ_LOG = true` 后输出，用于排查点击自动顺序执行后跳登录等问题 */
  function logItDesignAutoSeq(phase, payload) {
    try {
      if (typeof globalThis === 'undefined' || globalThis.__FE_TASK8_IT_DESIGN_AUTO_SEQ_LOG !== true) return;
      console.warn('[FE:task8-it-design-auto-seq]', phase, payload == null ? '' : payload);
    } catch (_) {}
  }

  const IT_DESIGN_SUPPLEMENT_SYSTEM_PROMPT = `# Role: 首席软件架构师 & 数字化转型专家
# Task: 针对事务流进行【IT Gap 诊断、角色权限推演与核心对象建模】的一体化收网设计（V2.0 - 业务丰满度强化版）

## 1. 建模背景与继承 (Context)
请基于以下存量资产进行增量设计，确保系统逻辑的一致性：

- **可引用角色池**: {已识别角色} ∪ {人员组织摘录中出现的岗位/角色称谓} ∪ {「系统」}。**统一使用标准中文称谓，禁止臆造**。人员组织摘录见用户消息中 **「人员组织（初步需求·可引用）」** 等建模背景段落（源自初步需求 \`preliminaryReq.operationModel.orgAndRoles.stakeholders\`）；已识别角色见同条用户消息中的角色列表汇总。
- **已识别对象/字段**: 见用户消息中的对象列表及字段备注摘录。

## 2. 三位一体执行逻辑 (Execution Logic)

### 第一步：IT Gap 诊断 (Finding the Gap)
- **数字化对标**：识别 \`bpm_detailed_flow\` 节点在手工环境下的痛点。
- **业务可视度自检（新增）**：诊断当前节点的数据流是否仅满足「逻辑运行」。若一个【人工操作/审核节点】仅能看到 ID 而看不到业务描述（如：能看到 applicant_id 但看不到 applicant_name），则判定为 **「业务可视度缺口」**。
- **输出要求**：明确该节点所需的【技术补丁】（如：自动化规则、审计快照、业务字段补全）。

### 第二步：角色权限补强 (Role & Access)
- **系统处理节点**：凡**纯系统自动执行**节点，责任方统一使用 **「系统」**（禁止使用 System、System_Trigger、Auditor、机器人等别名）。
- **与 BPM 与角色池一致**：\`role_and_permission\` 须能覆盖本事务 \`bpm_detailed_flow\` 各节点责任方；**人工节点**的 \`role_name\` 须与节点 \`actor\` 及**可引用角色池**对齐，**不得**使用池外名称。除「系统」外**不得**新增池外无关角色；若需表达自动核验/审计，归在 **「系统」** 的 \`permission_logic\` 内说明，或落在已有人工角色的权限边界内。
- **动态权限**：定义各角色在不同业务状态下对字段的【R:读/W:写/X:执行/L:锁定】权限。

### 第三步：对象与字段建模 (Modeling & Engineering - 核心修正)
**禁止「纯 ID 化」建模**。每个对象必须具备支撑「人眼可读」与「逻辑运行」的完整能力，强制分为两个层级：

**1. 业务属性层 (Business Layer - 补「肉」)**
- **基础描述字段**：严禁仅输出 ID。每个对象必须包含支撑 UI 展示和人工审计的描述性字段（如：name 名称, mobile 联系方式, description 摘要, reason 理由/备注）。
- **场景快照字段**：在事务单据中，须冗余存储关联主数据的【关键快照信息】（如：申请时的职级、当时的联系方式），防止主数据变更导致历史记录失真。

**2. 工程逻辑层 (Engineering Layer - 固「骨」)**
- **逻辑控制**：\`status_code\`, \`is_locked\`, \`version\`（乐观锁）, \`parent_transaction_id\`。
- **审计防线**：\`snapshot_data\`（JSON）记录全量变更快照，\`op_log_id\`, \`client_ip\`。
- **物理精度**：涉及金融/比例数据，必须标注精度（如 4 位小数）。

## 3. 严格输出 Schema (JSON Only)
{
  "design_output": {
    "it_gap_analysis": [
      { "bpm_node_id": "bpm.Txx.xxx", "gap_desc": "含逻辑落差与业务可视度落差", "it_remedy": "拟采用的技术手段与字段补强方案" }
    ],
    "role_and_permission": [
      {
        "role_name": "角色名",
        "type": "继承/新增",
        "reason": "说明为何该角色在此节点需要特定权限",
        "permission_logic": "该角色在各核心节点的权限边界(R/W/X/L)"
      }
    ],
    "data_objects": [
      {
        "object_name": "对象名",
        "table_code": "物理表名",
        "is_new": "True/False",
        "fields": [
          {
            "code": "字段编码",
            "name": "中文名",
            "type": "类型",
            "source": "Field_Memo / IT_Gap补全",
            "memo": "需注明是逻辑字段还是业务描述字段，及其在 UI 或审计中的意义"
          }
        ]
      }
    ]
  }
}

## 4. 输出约束
- 请严格只输出**一个** JSON 对象，不要 Markdown 代码围栏与解释性前言。
- 根对象可直接为 \`{ "design_output": ... }\`，或解析后等价包含 \`design_output\` 字段（与解析器兼容）。
- **确保** \`data_objects\` 里的字段足以支撑一名**不熟悉背景**的审计员直接看懂单据内容。
- 用户消息将提供「建模背景摘录」与「本阶段事务流 JSON」。`;

  /** task8·BPM 泳道矩阵图：用户消息提供 §5 数据；**仅输出严格 JSON**（前端用 \`it-design-bpm-flow-render.js\` 绘 SVG）；历史可为 svg/mermaid 文本 */
  const IT_DESIGN_BPM_SWIMLANE_SYSTEM_PROMPT = `# Role: 高级 IT 方案架构师 / 系统逻辑建模专家
# Task: 基于 BPM 节点与 IT 设计产出，生成**二维泳道矩阵**的**唯一结构化数据源**。前端将按固定算法绘制成 SVG（含连线与沿路径运动箭头），你**不要**输出 SVG/Mermaid/Markdown 正文。

## 1. 坐标系（与渲染器一致）
- **flow_title**（可选）：本事务流程在图顶的**标题**（建议与事务名称一致）。
- **departments**（**角色**列表）：每一项须出现在用户消息 **「角色边界摘录」** 的**合并角色池**内——即：**人员组织（初步需求）摘录** ∪ 本事务 \`design_output.role_and_permission\` 的 \`role_name\` ∪ 本事务 \`bpm_detailed_flow\` 已出现的 \`actor\` 中文称谓 ∪ **{「系统」}**；并与 \`role_and_permission\` 一致。**禁止**使用合并角色池中不存在的虚构角色列名。**前端绘制为垂直泳道**：**每一列对应一个角色**，列标题在泳道图**顶部**；**从左到右**依次为：**外部角色**（客户、面试者等）→ **内部角色**；内部列顺序为**审批/权限越高越靠右**（顾问、教练、代理…、总代理管理员等）；**无步骤的角色列不画**。说明：布局上「系统」列可能被前端合并展示，但你在 JSON 的 \`steps[].dept\` 中仍须对系统步写 **「系统」**，勿将系统步挂到人工角色列名上。
- **stages**（**BPM 阶段**列表）：与 \`bpm_detailed_flow[].type\` 语义对应；五类顺序：输入 → 核验 → 决策 → 执行 → 留痕（可略作业务化）。用于决定每步的**节点形态**（核验/决策/执行等），**不再作为横向泳道列**。
- **steps**：按**业务流程先后**排列；同列内自上而下串接；**允许多步落在同一角色列**（垂直堆叠）。

## 2. 映射规则
1. 每个 \`bpm_detailed_flow\` 节点须映射为**至少一步**。\`dept\` **必须**属于上条合并角色池：与节点 \`actor\` 对齐时使用池中一致的中文称谓；**凡属系统处理节点**（无人工 actor、或语义为规则/定时/后台自动执行），\`dept\` **一律为「系统」**（中文二字）。\`type\` 决定 **stage** 列。
2. **节点描述与逻辑**：**推荐**分项输出——\`description\` 或 \`node_description\`（**节点描述**，用于非核验/非决策步的**标题栏**）；\`logic\`（**逻辑说明**）。\`sentence\` 仍必填作兼容与回退。**阶段与展示**：**核验**步仅需输出**校验逻辑**（写入 \`logic\`）；**决策**步仅需**判断逻辑**（写入 \`logic\`）；流程图 view 中决策与其它步相同为**顺序单出口**（底边中点连向下一节点），**无需** \`branch_no_to\`。**执行**步须输出逻辑 + \`db_write_fields\`；**核验/决策步不要输出** \`db_ref_fields\` / \`db_compute_fields\`（前端不展示）。其余步数据库字段三项仍以 **string[]** 为首选。
3. **数据库字段（对接 \`data_objects\`）**：**执行**步须尽量给出 \`db_write_fields\`（无则 \`[]\`）；\`db_ref_fields\` / \`db_compute_fields\` 仅非核验/非决策步需要时给出。

## 3. 输入数据范围
用户消息「§5 待处理数据」**仅**含本事务 \`bpm_detailed_flow\`、\`role_and_permission\`、\`data_objects\`、与本段 BPM 对齐的 \`it_gap_analysis\`；不含其它事务或整包端到端 JSON。

## 4. 输出（**硬性**）
- **只输出一个 JSON 对象**，UTF-8，**不要** Markdown 代码围栏、不要前言/后记、不要注释。
- 根对象字段：
  - \`format_version\`：字符串，固定 \`"1.4.0"\`。
  - \`flow_title\`（可选）：string，流程标题。
  - \`departments\`：string[]，长度 ≥1。
  - \`stages\`：string[]，长度 = 5。
  - \`steps\`：对象数组，长度 ≥1。每项必含 \`id\`、\`dept\`、\`stage\`、\`sentence\`（与 departments/stages 精确匹配）；**推荐** \`description\`/\`node_description\`、\`logic\`；**执行步**须含 \`db_write_fields\`（**优先 string[]**）。

**示例（字段齐全，内容替换为你的建模结果）：**
{"format_version":"1.4.0","flow_title":"招募发起与追踪","departments":["客户","总代理","系统"],"stages":["输入","核验","决策","执行","留痕"],"steps":[{"id":1,"dept":"客户","stage":"输入","description":"客户提交意向","logic":"采集基础资料","sentence":"客户提交意向","db_write_fields":[],"db_ref_fields":[],"db_compute_fields":[]},{"id":2,"dept":"总代理","stage":"核验","logic":"校验资料完整性","sentence":"总代理核验资料"},{"id":3,"dept":"总代理","stage":"决策","logic":"是否准入","sentence":"总代理判断是否准入"},{"id":4,"dept":"总代理","stage":"执行","description":"生成邀约","logic":"写入邀约记录","sentence":"生成邀约","db_write_fields":["invite.id"]},{"id":5,"dept":"总代理","stage":"留痕","description":"流程留痕","logic":"记录结果","sentence":"流程留痕","db_write_fields":[]}]}`;

  function extractJsonObjectFromLlmContent(content) {
    const jsonMatch = content != null ? String(content).match(/\{[\s\S]*\}/) : null;
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (_) {
      return null;
    }
  }

  function normalizeDesignOutput(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.design_output && typeof parsed.design_output === 'object') return parsed;
    if (
      parsed.it_gap_analysis ||
      parsed.role_and_permission ||
      parsed.data_objects
    ) {
      return { design_output: parsed };
    }
    return parsed;
  }

  /** 将 permission_logic 按行首 bpm.xxx 拆成多段（与单事务 view 内角色卡一致） */
  function buildPermissionLogicSectionsHtml(logic, esc) {
    const t = logic == null ? '' : String(logic).trim();
    if (!t) return `<p class="it-design-tree-empty">—</p>`;
    const lines = t.split(/\n/);
    const sections = [];
    let curHead = null;
    let curLines = [];
    const lineHasBpmOnly = (line) => {
      const m = line.match(/^\s*(?:节点\s*)?(bpm\.[A-Za-z0-9_.]+)\s*([：:]\s*)?$/);
      return m ? m[1] : null;
    };
    const lineStartsWithBpm = (line) => /^\s*(?:节点\s*)?bpm\.[A-Za-z0-9_.]+/.test(line);
    for (const line of lines) {
      const onlyId = lineHasBpmOnly(line);
      if (onlyId) {
        if (curHead != null || curLines.length) {
          sections.push({ bpmNode: curHead, text: curLines.join('\n').trim() });
        }
        curHead = onlyId;
        curLines = [];
        continue;
      }
      if (lineStartsWithBpm(line) && !onlyId) {
        const m = line.match(/(?:节点\s*)?(bpm\.[A-Za-z0-9_.]+)\s*[：:]\s*(.*)$/);
        if (m) {
          if (curHead != null || curLines.length) {
            sections.push({ bpmNode: curHead, text: curLines.join('\n').trim() });
          }
          curHead = m[1];
          curLines = m[2] ? [m[2]] : [];
          continue;
        }
      }
      curLines.push(line);
    }
    sections.push({ bpmNode: curHead, text: curLines.join('\n').trim() });
    const nonempty = sections.filter((s) => s.bpmNode || (s.text && s.text.length));
    if (nonempty.length === 0) {
      return `<div class="it-design-role-logic-fallback">${esc(t)}</div>`;
    }
    if (nonempty.length === 1 && !nonempty[0].bpmNode) {
      return `<div class="it-design-role-logic-fallback">${esc(nonempty[0].text || t)}</div>`;
    }
    return nonempty
      .map((s) => {
        const headHtml = s.bpmNode
          ? `<div class="it-design-role-bpm-tag">${esc(s.bpmNode)}</div>`
          : '';
        const body = s.text && s.text.trim() ? esc(s.text) : '—';
        return `<div class="it-design-role-bpm-section">${headHtml}<div class="it-design-role-bpm-text">${body}</div></div>`;
      })
      .join('');
  }

  /** 单条角色权限黄主题卡（供事务 view 与 task9 汇总复用） */
  function buildSingleRoleCardHtml(r, esc) {
    const name = r && r.role_name != null ? String(r.role_name) : '未命名角色';
    const typeStr = r && r.type != null ? String(r.type).trim() : '';
    const reasonStr = r && r.reason != null ? String(r.reason).trim() : '';
    const metaParts = [];
    if (typeStr) metaParts.push(`类型：${typeStr}`);
    if (reasonStr) metaParts.push(`说明：${reasonStr}`);
    const metaHtml =
      metaParts.length > 0
        ? `<div class="it-design-role-card-meta">${esc(metaParts.join('｜'))}</div>`
        : '';
    const logicInner = buildPermissionLogicSectionsHtml(r && r.permission_logic, esc);
    return `<div class="it-design-role-card">
            <div class="it-design-role-card-head">${esc(name)}</div>
            ${metaHtml}
            <div class="it-design-role-card-body">${logicInner}</div>
          </div>`;
  }

  /**
   * 从 BPM 合并 JSON 生成 task8 Session：每个 transaction 节点一条。
   * @param {object|null} e2eJson
   * @returns {Array<{stepIndex:number,stageName:string,transactionId:string,transactionName:string,designOutputJson?:object|null}>}
   */
  function generateItDesignSupplementSessions(e2eJson) {
    if (!e2eJson || typeof e2eJson !== 'object') return [];
    const sessions = [];
    let flatIdx = 0;
    const stages = Array.isArray(e2eJson.stages) ? e2eJson.stages : [];
    if (stages.length > 0) {
      for (const st of stages) {
        const sn = String(st?.stage_name || '').trim() || '';
        const nodes = Array.isArray(st.transaction_nodes) ? st.transaction_nodes : [];
        for (const tx of nodes) {
          if (!tx || typeof tx !== 'object') continue;
          sessions.push({
            stepIndex: flatIdx,
            stageName: sn,
            transactionId: String(tx.transaction_id || `T_${flatIdx + 1}`),
            transactionName: String(tx.name || tx.transaction_id || `事务${flatIdx + 1}`),
            designOutputJson: null,
          });
          flatIdx += 1;
        }
      }
      return sessions;
    }
    const flat = Array.isArray(e2eJson.transaction_nodes) ? e2eJson.transaction_nodes : [];
    for (const tx of flat) {
      if (!tx || typeof tx !== 'object') continue;
      sessions.push({
        stepIndex: flatIdx,
        stageName: '',
        transactionId: String(tx.transaction_id || `T_${flatIdx + 1}`),
        transactionName: String(tx.name || tx.transaction_id || `事务${flatIdx + 1}`),
        designOutputJson: null,
      });
      flatIdx += 1;
    }
    return sessions;
  }

  /** 从合并 BPM JSON 中取出第 stepIndex 条事务节点完整对象 */
  function getTransactionNodeByStepIndex(e2eJson, stepIndex) {
    if (!e2eJson || typeof e2eJson !== 'object') return null;
    const si = Number(stepIndex);
    let i = 0;
    const stages = Array.isArray(e2eJson.stages) ? e2eJson.stages : [];
    if (stages.length > 0) {
      for (const st of stages) {
        const nodes = Array.isArray(st.transaction_nodes) ? st.transaction_nodes : [];
        for (const tx of nodes) {
          if (i === si) return tx;
          i += 1;
        }
      }
      return null;
    }
    const flat = Array.isArray(e2eJson.transaction_nodes) ? e2eJson.transaction_nodes : [];
    return flat[si] || null;
  }

  /**
   * 按 stepIndex 优先、其次 transaction_id 匹配，解析 IT 设计补齐 session 对应的事务节点（含 bpm_detailed_flow）。
   */
  function resolveTransactionNodeForItDesignSession(e2eJson, session) {
    if (!e2eJson || typeof e2eJson !== 'object' || !session || typeof session !== 'object') return null;
    const wantId = String(session.transactionId || '').trim();
    const byIdx = getTransactionNodeByStepIndex(e2eJson, session.stepIndex);
    if (byIdx && typeof byIdx === 'object') {
      const gotId = String(byIdx.transaction_id || '').trim();
      if (!wantId || !gotId || gotId === wantId) return byIdx;
    }
    if (wantId) {
      const stages = Array.isArray(e2eJson.stages) ? e2eJson.stages : [];
      if (stages.length > 0) {
        for (const st of stages) {
          for (const tx of Array.isArray(st.transaction_nodes) ? st.transaction_nodes : []) {
            if (tx && String(tx.transaction_id || '').trim() === wantId) return tx;
          }
        }
      } else {
        for (const tx of Array.isArray(e2eJson.transaction_nodes) ? e2eJson.transaction_nodes : []) {
          if (tx && String(tx.transaction_id || '').trim() === wantId) return tx;
        }
      }
    }
    return byIdx || null;
  }

  /** 本事务 BPM 细流数组，供 ITGap 表与 bpm_node_id 对齐展示「节点描述 / 逻辑」 */
  function getBpmDetailedFlowForItDesignSession(e2eJson, session) {
    const tx = resolveTransactionNodeForItDesignSession(e2eJson, session);
    return tx && Array.isArray(tx.bpm_detailed_flow) ? tx.bpm_detailed_flow : [];
  }

  function buildModelingContextBullets(item, e2eJson) {
    const roles = new Set();
    const objects = new Set();
    const fieldMemos = [];
    const vs = item?.valueStream;
    if (vs && !vs.raw && typeof global.parseValueStreamGraph === 'function') {
      try {
        const { stages } = global.parseValueStreamGraph(vs);
        for (const st of stages || []) {
          const steps = st.steps ?? st.tasks ?? st.phases ?? st.items ?? [];
          for (const step of steps) {
            if (step && typeof step === 'object') {
              const r = step.role ?? step.actor ?? step.owner;
              if (r != null && String(r).trim()) roles.add(String(r).trim());
              const mo = step.main_object ?? step.mainObject ?? step.object;
              if (mo != null && String(mo).trim()) objects.add(String(mo).trim());
            }
          }
        }
      } catch (_) {}
    }
    const walkTx = (tx) => {
      if (!tx || typeof tx !== 'object') return;
      const actor = tx.actor;
      if (actor != null && String(actor).trim()) roles.add(String(actor).trim());
      const ent = tx.data_entity_impact;
      if (ent && typeof ent === 'object') {
        const t = ent.target_object ?? ent.targetObject;
        if (t != null && String(t).trim()) objects.add(String(t).trim());
        const fc = ent.field_changes ?? ent.fieldChanges;
        if (fc != null && String(fc).trim()) fieldMemos.push(String(fc).trim());
      }
      const flow = tx.bpm_detailed_flow;
      if (Array.isArray(flow)) {
        for (const n of flow) {
          if (n && n.field_memo != null && String(n.field_memo).trim()) {
            fieldMemos.push(String(n.field_memo).trim());
          }
        }
      }
    };
    const stages = Array.isArray(e2eJson?.stages) ? e2eJson.stages : [];
    if (stages.length) {
      for (const st of stages) {
        for (const tx of Array.isArray(st.transaction_nodes) ? st.transaction_nodes : []) walkTx(tx);
      }
    } else {
      for (const tx of Array.isArray(e2eJson?.transaction_nodes) ? e2eJson.transaction_nodes : []) walkTx(tx);
    }
    const roleStr = [...roles].slice(0, 40).join('、') || '（暂无，请结合事务流推断）';
    const objStr = [...objects].slice(0, 40).join('、') || '（暂无，请结合事务流推断）';
    const fieldStr =
      fieldMemos.length > 0
        ? fieldMemos.slice(0, 30).join('；')
        : '（请从本事务流 JSON 的 field_memo / data_entity_impact 提取）';
    return { roleStr, objStr, fieldStr };
  }

  /**
   * 初步需求·人员组织 stakeholders 摘录，供 task8 提示词约束「角色须在组织内 + 系统步统一为系统」
   * @param {object|null|undefined} item
   * @returns {string}
   */
  function buildPreliminaryOrgStakeholdersExcerpt(item) {
    const pr = item?.preliminaryReq;
    if (!pr || typeof pr !== 'object') {
      return '（当前案例暂无初步需求 `preliminaryReq`：请仅用「已识别角色」与本事务 BPM `actor` 对齐，勿臆造组织外角色；**系统节点统一使用角色名「系统」**。）';
    }
    const om = pr.operationModel;
    const org = om && typeof om === 'object' ? om.orgAndRoles : null;
    const sh = org && Array.isArray(org.stakeholders) ? org.stakeholders : [];
    const parts = sh.map((x) => String(x ?? '').trim()).filter(Boolean);
    if (parts.length === 0) {
      return '（初步需求中暂无 `operationModel.orgAndRoles.stakeholders`：请用「已识别角色」与 BPM `actor` 对齐，勿新增无关角色；**系统节点用「系统」**。）';
    }
    return parts.slice(0, 30).join('；');
  }

  function buildItDesignSupplementUserContent(item, e2eJson, session, txNode) {
    const { roleStr, objStr, fieldStr } = buildModelingContextBullets(item, e2eJson);
    const orgExcerpt = buildPreliminaryOrgStakeholdersExcerpt(item);
    const txJson =
      txNode && typeof txNode === 'object'
        ? JSON.stringify(txNode, null, 2)
        : JSON.stringify({ error: 'missing_transaction_node' }, null, 2);
    const header = session.stageName
      ? `阶段：${session.stageName}；事务：${session.transactionName}（${session.transactionId}）`
      : `事务：${session.transactionName}（${session.transactionId}）`;
    return `## 建模背景摘录
- **已识别角色**: ${roleStr}
- **人员组织（初步需求·可引用）**: ${orgExcerpt}
- **已识别对象**: ${objStr}
- **已识别字段/备注**: ${fieldStr}

## 当前对象
${header}

## 4. 输入数据
- **本阶段事务流 JSON**（单事务对象，须完整用于诊断）

\`\`\`json
${txJson}
\`\`\`

请严格按系统指令只输出一个 JSON 对象。`;
  }

  /** 与 main.js `getDigitalProblemPersistKey` 一致：在线案可能仅有 id，勿只用 createdAt 写库 */
  function persistKeyForItDesignCase(item) {
    if (item && typeof global.getDigitalProblemPersistKey === 'function') {
      const k = global.getDigitalProblemPersistKey(item);
      if (k != null && String(k).trim() !== '') return String(k).trim();
    }
    const ca = item?.createdAt != null && String(item.createdAt).trim() !== '' ? String(item.createdAt).trim() : '';
    const id = item?.id != null && String(item.id).trim() !== '' ? String(item.id).trim() : '';
    return ca || id;
  }

  function getDetailItemForTask8() {
    const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
    const cur =
      typeof global.getCurrentProblemDetailItem === 'function'
        ? global.getCurrentProblemDetailItem()
        : null;
    const pk = cur ? persistKeyForItDesignCase(cur) : '';
    if (pk) {
      const fresh = list.find((it) => persistKeyForItDesignCase(it) === pk);
      return fresh || cur;
    }
    return cur;
  }

  /** 在线案可仅有 id：与 run 入口门禁一致，勿依赖 createdAt */
  function hasItDesignCaseKey(item) {
    return !!persistKeyForItDesignCase(item);
  }

  function syncCurrent(item) {
    if (typeof global.setCurrentProblemDetailItem === 'function') {
      global.setCurrentProblemDetailItem(item);
    }
  }

  /**
   * 聊天里已有 Session 计划块但案例行尚未带上 `itDesignSupplementSessions` 时，先落库并 syncCurrent，
   * 避免 `runItDesignInterleavedNextStep` 读到空数组导致既不请求模型、界面又停在「正在…」前置句。
   */
  function ensureItDesignSupplementSessionsHydratedFromChat(item) {
    if (!item || !hasItDesignCaseKey(item)) return item;
    const hasRows =
      Array.isArray(item.itDesignSupplementSessions) && item.itDesignSupplementSessions.length > 0;
    if (hasRows) return item;
    const msgs =
      typeof global.getProblemDetailChatMessages === 'function'
        ? global.getProblemDetailChatMessages()
        : global.problemDetailChatMessages;
    const resolved =
      typeof global.resolveItDesignSupplementSessionsForTask8 === 'function'
        ? global.resolveItDesignSupplementSessionsForTask8(item, msgs || [])
        : [];
    if (!resolved.length) return item;
    const caseKey = persistKeyForItDesignCase(item);
    if (caseKey && typeof global.updateDigitalProblemItDesignSupplementSessions === 'function') {
      logItDesignAutoSeq('hydrate-write-sessions', { caseKey, resolvedLen: resolved.length });
      global.updateDigitalProblemItDesignSupplementSessions(caseKey, resolved);
    }
    const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
    const pk = persistKeyForItDesignCase(item);
    const fresh = list.find((it) => persistKeyForItDesignCase(it) === pk);
    if (fresh) {
      syncCurrent(fresh);
      return fresh;
    }
    const merged = { ...item, itDesignSupplementSessions: resolved };
    syncCurrent(merged);
    return merged;
  }

  /**
   * 执行下一条未产出 designOutputJson 的 session。
   * @returns {Promise<{ stepIndex: number }|null>}
   */
  /**
   * 在「设计 → 同事务 BPM」交错顺序下执行下一步 LLM（优先完成靠前事务的 BPM，再进入下一事务设计）。
   * @returns {Promise<{ stepIndex: number, kind: 'design'|'bpm' }|{ abortedError: true }|null>}
   */
  async function runItDesignInterleavedNextStep(optionalItem) {
    let item =
      optionalItem && hasItDesignCaseKey(optionalItem) ? optionalItem : getDetailItemForTask8();
    item = ensureItDesignSupplementSessionsHydratedFromChat(item);
    const sessions = Array.isArray(item?.itDesignSupplementSessions) ? item.itDesignSupplementSessions : [];
    logItDesignAutoSeq('interleaved-enter', {
      persistKey: persistKeyForItDesignCase(item),
      sessionLen: sessions.length,
    });
    let firstNoDesign = -1;
    let firstNeedBpm = -1;
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (!s) continue;
      if (s.designOutputJson == null) {
        firstNoDesign = i;
        break;
      }
    }
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (!s || s.designOutputJson == null) continue;
      const md = s.bpmFlowDrawMarkdown;
      if (md == null || !String(md).trim()) {
        firstNeedBpm = i;
        break;
      }
    }
    if (firstNeedBpm >= 0 && (firstNoDesign < 0 || firstNeedBpm < firstNoDesign)) {
      logItDesignAutoSeq('interleaved-next-bpm', { firstNeedBpm, sessionLen: sessions.length });
      const r = await runItDesignBpmDrawForNextStep(item);
      if (r && r.abortedError) return { abortedError: true };
      return r ? { stepIndex: r.stepIndex, kind: 'bpm' } : null;
    }
    if (firstNoDesign >= 0) {
      logItDesignAutoSeq('interleaved-next-design', { firstNoDesign, sessionLen: sessions.length });
      const r = await runItDesignSupplementForNextStep(item);
      if (r && r.abortedError) return { abortedError: true };
      return r ? { stepIndex: r.stepIndex, kind: 'design' } : null;
    }
    logItDesignAutoSeq('interleaved-next-none', { sessionLen: sessions.length });
    return null;
  }

  async function runItDesignSupplementForNextStep(optionalItem) {
    const container = global.el?.problemDetailChatMessages;
    let item =
      optionalItem && hasItDesignCaseKey(optionalItem) ? optionalItem : getDetailItemForTask8();
    item = ensureItDesignSupplementSessionsHydratedFromChat(item);
    if (!container || !hasItDesignCaseKey(item) || !global.hasAiConfig?.()) {
      logItDesignAutoSeq('design-skip', {
        noContainer: !container,
        noCaseKey: !hasItDesignCaseKey(item),
        noAiConfig: !global.hasAiConfig?.(),
      });
      return null;
    }
    const msgs =
      typeof global.getProblemDetailChatMessages === 'function'
        ? global.getProblemDetailChatMessages()
        : global.problemDetailChatMessages;
    const pick =
      typeof global.pickRawE2eTransactionFlowJsonFromItemAndMessages === 'function'
        ? global.pickRawE2eTransactionFlowJsonFromItemAndMessages(item, msgs || [])
        : item?.e2eTransactionFlowJson || null;
    const sessions = item.itDesignSupplementSessions || [];
    const nextIdx = sessions.findIndex((s) => s.designOutputJson == null);
    if (nextIdx < 0) {
      logItDesignAutoSeq('design-skip-no-pending', { sessionLen: sessions.length });
      return null;
    }
    const session = sessions[nextIdx];
    const txNode = getTransactionNodeByStepIndex(pick, session.stepIndex);
    const stepLabel = session.transactionName || `事务${session.stepIndex + 1}`;
    const userContent = buildItDesignSupplementUserContent(item, pick, session, txNode);
    const fullPrompt = `${IT_DESIGN_SUPPLEMENT_SYSTEM_PROMPT}\n\n【用户】\n${userContent}`;

    global.pushAndSaveProblemDetailChat?.({
      role: 'system',
      content: `正在对事务【${stepLabel}】进行 IT设计补齐…`,
      timestamp: global.getTimeStr?.(),
    });
    const msgsAfterBusy =
      typeof global.getProblemDetailChatMessages === 'function'
        ? global.getProblemDetailChatMessages()
        : global.problemDetailChatMessages;
    container.innerHTML = '';
    global.renderProblemDetailChatFromStorage?.(
      container,
      Array.isArray(msgsAfterBusy) ? msgsAfterBusy : [],
    );
    container.scrollTop = container.scrollHeight;

    const esc = global.escapeHtml || ((s) => String(s));
    const parsingBlock = document.createElement('div');
    parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在对事务【${esc(
      stepLabel,
    )}】进行 IT设计补齐…</span></div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr?.() || ''}</div>`;
    container.appendChild(parsingBlock);
    container.scrollTop = container.scrollHeight;

    try {
      const fetchFn = global.fetchDeepSeekChat || global.fetchChat;
      if (typeof fetchFn !== 'function') throw new Error('未配置大模型调用');
      const designTaskTag = `task8-it-design-supplement-${session.stepIndex}`;
      logItDesignAutoSeq('design-before-llm', {
        taskTag: designTaskTag,
        stepIndex: session.stepIndex,
        stepLabel,
        userChars: userContent.length,
      });
      const { content, usage, model, durationMs } = await fetchFn(
        [
          { role: 'system', content: IT_DESIGN_SUPPLEMENT_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        { taskTag: designTaskTag },
      );
      logItDesignAutoSeq('design-after-llm', { taskTag: designTaskTag, durationMs, outChars: (content || '').length });
      parsingBlock.remove();
      const raw = content != null ? String(content) : '';
      const parsed = extractJsonObjectFromLlmContent(raw);
      const normalized = normalizeDesignOutput(parsed);
      if (!normalized) {
        throw new Error('模型返回无法解析为 JSON');
      }
      const llmMeta = { usage, model, durationMs };
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        type: 'task8LlmQueryBlock',
        taskId: 'task8',
        noteName: 'IT设计补齐',
        stepName: stepLabel,
        phaseIndex: session.stepIndex,
        llmInputPrompt: fullPrompt,
        llmOutputRaw: raw,
        llmMeta,
        timestamp: global.getTimeStr?.(),
        confirmed: false,
      });
      if (typeof global.updateDigitalProblemItDesignSupplementStep === 'function') {
        const pkStep = persistKeyForItDesignCase(item);
        global.updateDigitalProblemItDesignSupplementStep(pkStep, session.stepIndex, normalized);
        const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
        const updated = list.find((it) => persistKeyForItDesignCase(it) === pkStep);
        if (updated) syncCurrent(updated);
      }
      container.innerHTML = '';
      const afterMsgs =
        typeof global.getProblemDetailChatMessages === 'function'
          ? global.getProblemDetailChatMessages()
          : global.problemDetailChatMessages;
      global.renderProblemDetailChatFromStorage?.(container, Array.isArray(afterMsgs) ? afterMsgs : []);
      container.scrollTop = container.scrollHeight;
      global.renderProblemDetailContent?.();
      global.renderProblemDetailHistory?.();
      return { stepIndex: session.stepIndex };
    } catch (err) {
      logItDesignAutoSeq('design-llm-catch', {
        message: err && err.message != null ? String(err.message) : String(err),
        name: err && err.name,
      });
      parsingBlock.remove();
      const msg = err && err.message != null ? String(err.message) : String(err);
      if (typeof global.pushLlmRetryNoticeBlock === 'function') {
        global.pushLlmRetryNoticeBlock(
          'task8',
          `调用异常：IT设计补齐失败（${msg}）。自动执行已暂停；可点「重新尝试」或顶栏「异常继续」从首个未完成事务继续。`,
          TASK8_IT_DESIGN_RETRY_ACTION,
          'IT设计补齐',
        );
      } else {
        global.pushAndSaveProblemDetailChat?.({
          role: 'system',
          content: 'IT设计补齐失败：' + msg,
          timestamp: global.getTimeStr?.(),
        });
      }
      container.innerHTML = '';
      const afterErr =
        typeof global.getProblemDetailChatMessages === 'function'
          ? global.getProblemDetailChatMessages()
          : global.problemDetailChatMessages;
      global.renderProblemDetailChatFromStorage?.(container, Array.isArray(afterErr) ? afterErr : []);
      container.scrollTop = container.scrollHeight;
      global.renderProblemDetailContent?.();
      global.renderProblemDetailHistory?.();
      return { abortedError: true };
    }
  }

  async function runItDesignSupplementAutoSequential(optionalItem) {
    const item =
      optionalItem && hasItDesignCaseKey(optionalItem) ? optionalItem : getDetailItemForTask8();
    logItDesignAutoSeq('auto-seq-start', {
      hasCaseKey: hasItDesignCaseKey(item),
      persistKey: item ? persistKeyForItDesignCase(item) : '',
      preSessionLen: Array.isArray(item?.itDesignSupplementSessions) ? item.itDesignSupplementSessions.length : 0,
    });
    if (!hasItDesignCaseKey(item)) return;
    const btn = document.querySelector('.btn-auto-it-design-supplement-sessions');
    if (btn && !btn.disabled) btn.disabled = true;
    global.renderProblemDetailContent?.();
    let loopCount = 0;
    for (;;) {
      const r = await runItDesignInterleavedNextStep(getDetailItemForTask8());
      loopCount += 1;
      if (r && r.abortedError) {
        logItDesignAutoSeq('auto-seq-aborted-llm-error', { loopCount });
        break;
      }
      if (!r) {
        logItDesignAutoSeq('auto-seq-loop-stop', { loopCount, lastResult: r });
        break;
      }
      logItDesignAutoSeq('auto-seq-loop-step', { loopCount, kind: r.kind, stepIndex: r.stepIndex });
    }
    const fresh = getDetailItemForTask8();
    const sess = fresh?.itDesignSupplementSessions || [];
    const allDone =
      sess.length > 0 &&
      sess.every((s) => {
        if (!s || s.designOutputJson == null) return false;
        const md = s.bpmFlowDrawMarkdown;
        return md != null && String(md).trim() !== '';
      });
    if (allDone) {
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        content: '事务已经生成并绘制完成。',
        timestamp: global.getTimeStr?.(),
      });
      const content =
        typeof global.IT_DESIGN_SUPPLEMENT_ALL_DONE_CONFIRM_CONTENT === 'string' &&
        global.IT_DESIGN_SUPPLEMENT_ALL_DONE_CONFIRM_CONTENT.trim()
          ? global.IT_DESIGN_SUPPLEMENT_ALL_DONE_CONFIRM_CONTENT
          : '请确认是否将上述 IT 设计补齐与 BPM 泳道绘制结果写入工作区汇总；点击「全部确认」后将下发本任务是否视为完成的确认。';
      global.pushAndSaveProblemDetailChat?.({
        type: 'itDesignSupplementAllDoneConfirmBlock',
        content,
        taskId: 'task8',
        timestamp: global.getTimeStr?.(),
        confirmed: false,
      });
    }
    const chatContainer = global.el?.problemDetailChatMessages;
    if (chatContainer) {
      chatContainer.innerHTML = '';
      const m =
        typeof global.getProblemDetailChatMessages === 'function'
          ? global.getProblemDetailChatMessages()
          : global.problemDetailChatMessages;
      global.renderProblemDetailChatFromStorage?.(chatContainer, Array.isArray(m) ? m : []);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    global.renderProblemDetailHistory?.();
    global.renderProblemDetailContent?.();
    if (btn) {
      const s2 = getDetailItemForTask8()?.itDesignSupplementSessions || [];
      const hasUnfinished = s2.some((s) => {
        if (!s || s.designOutputJson == null) return true;
        const md = s.bpmFlowDrawMarkdown;
        return md == null || !String(md).trim();
      });
      btn.disabled = !hasUnfinished;
    }
    logItDesignAutoSeq('auto-seq-finish', {
      allDone,
      postSessionLen: (getDetailItemForTask8()?.itDesignSupplementSessions || []).length,
    });
  }

  /**
   * BPM 绘制 user 消息内的 design_output：IT Gap 仅保留与本事务 \`bpm_detailed_flow\` 中 \`bpm_node_id\` 对齐的条目，
   * 避免无关段落；角色与数据对象仍为当前 session 该事务的产出（已是单事务范围）。
   * @param {object} designOut \`design_output\` 根对象
   * @param {Array} bpmFlow 本事务 \`bpm_detailed_flow\`
   */
  function buildSlimDesignOutputForBpmDraw(designOut, bpmFlow) {
    if (!designOut || typeof designOut !== 'object') {
      return { it_gap_analysis: [], role_and_permission: [], data_objects: [] };
    }
    const flow = Array.isArray(bpmFlow) ? bpmFlow : [];
    const bpmIds = new Set();
    for (const step of flow) {
      if (!step || typeof step !== 'object') continue;
      const id = step.bpm_node_id != null ? String(step.bpm_node_id).trim() : '';
      if (id) bpmIds.add(id);
    }
    const roles = Array.isArray(designOut.role_and_permission) ? designOut.role_and_permission : [];
    const objs = Array.isArray(designOut.data_objects) ? designOut.data_objects : [];
    const rawGaps = Array.isArray(designOut.it_gap_analysis) ? designOut.it_gap_analysis : [];
    let it_gap_analysis = rawGaps;
    if (bpmIds.size > 0 && rawGaps.length > 0) {
      const filtered = rawGaps.filter((g) => {
        if (!g || typeof g !== 'object') return false;
        const gid = g.bpm_node_id != null ? String(g.bpm_node_id).trim() : '';
        return gid && bpmIds.has(gid);
      });
      if (filtered.length > 0) it_gap_analysis = filtered;
    }
    return {
      it_gap_analysis,
      role_and_permission: roles,
      data_objects: objs,
    };
  }

  function buildItDesignBpmDrawUserContent(session, txNode, designNorm) {
    const item = getDetailItemForTask8();
    const bpmFlow = txNode && Array.isArray(txNode.bpm_detailed_flow) ? txNode.bpm_detailed_flow : [];
    const baseOut =
      designNorm && designNorm.design_output && typeof designNorm.design_output === 'object'
        ? designNorm.design_output
        : {};
    const d = buildSlimDesignOutputForBpmDraw(baseOut, bpmFlow);
    const transactionsPayload = [
      {
        transaction_id: session.transactionId,
        transaction_name: session.transactionName,
        stage_name: session.stageName || '',
        design_output: d,
      },
    ];
    const header = session.stageName
      ? `阶段：${session.stageName}；事务：${session.transactionName}（${session.transactionId}）`
      : `事务：${session.transactionName}（${session.transactionId}）`;
    const orgExcerpt = buildPreliminaryOrgStakeholdersExcerpt(item);
    const rolesFromDesign = Array.isArray(d.role_and_permission)
      ? d.role_and_permission
          .map((r) => (r && r.role_name != null ? String(r.role_name).trim() : ''))
          .filter(Boolean)
      : [];
    const roleLine =
      rolesFromDesign.length > 0 ? rolesFromDesign.slice(0, 40).join('、') : '（见下方 JSON）';
    return `## 当前对象
${header}

## 角色边界摘录（**硬性**；\`departments\` 与每步 \`dept\` 须遵守）
- **人员组织（初步需求·可引用）**: ${orgExcerpt}
- **本事务设计产出中的角色名（\`role_and_permission.role_name\`）**: ${roleLine}
- **合并角色池**：以上人员组织摘录中的称谓 + 上表 JSON 内 \`role_name\` + 下方 \`bpm_detailed_flow\` 各节点 \`actor\` 已出现的中文称谓 ∪ **「系统」**。\`departments\` 与 \`steps[].dept\` **只能**使用该池内名称，**禁止**发明池外角色。**纯系统处理**节点 \`dept\` **一律「系统」**。

## 5. 待处理数据（**仅本事务当前 Session**；不含端到端其它事务或整包合并 JSON）

### BPM 节点流（本事务 \`bpm_detailed_flow\`）
\`\`\`json
${JSON.stringify(bpmFlow, null, 2)}
\`\`\`

### 角色与数据设计（本事务单条；\`design_output.it_gap_analysis\` 已按上表 BPM 节点 id 过滤）
\`\`\`json
${JSON.stringify(transactionsPayload, null, 2)}
\`\`\`

请严格遵循系统指令全文与上文「角色边界摘录」及本节数据范围输出。`;
  }

  /**
   * 推过 BPM 绘制 Session 计划后，须每事务均有 bpmFlowDrawMarkdown 才视为 task8 可完工；未推过计划的老数据不卡。
   * @param {object} item
   * @param {Array} [chatMessages]
   */
  function isItDesignBpmDrawCompleteForItem(item, chatMessages) {
    const s = item?.itDesignSupplementSessions || [];
    const msgs = Array.isArray(chatMessages) ? chatMessages : [];
    const hasLegacyBpmPlan = msgs.some((m) => m && m.type === 'itDesignBpmDrawSessionsBlock');
    let interleavedFromBlock = false;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m && m.type === 'itDesignSupplementSessionsBlock') {
        interleavedFromBlock = m.interleavedBpmDrawPlan === true;
        break;
      }
    }
    if (interleavedFromBlock) {
      if (s.length === 0) return true;
      // 交错计划：须**每一事务**均已有设计产出且已有 BPM 绘制，缺设计不得视为「BPM 已齐」（否则 isTaskCompleted(task8) 误判 → 误发 task9）
      return s.every((x) => {
        if (!x || x.designOutputJson == null) return false;
        const md = x.bpmFlowDrawMarkdown;
        return md != null && String(md).trim() !== '';
      });
    }
    if (!hasLegacyBpmPlan) return true;
    const withDesign = s.filter((x) => x && x.designOutputJson != null);
    if (withDesign.length === 0) return true;
    return withDesign.every((x) => {
      const md = x.bpmFlowDrawMarkdown;
      return md != null && String(md).trim() !== '';
    });
  }

  async function runItDesignBpmDrawForNextStep(optionalItem) {
    const container = global.el?.problemDetailChatMessages;
    let item =
      optionalItem && hasItDesignCaseKey(optionalItem) ? optionalItem : getDetailItemForTask8();
    item = ensureItDesignSupplementSessionsHydratedFromChat(item);
    if (!container || !hasItDesignCaseKey(item) || !global.hasAiConfig?.()) {
      logItDesignAutoSeq('bpm-skip', {
        noContainer: !container,
        noCaseKey: !hasItDesignCaseKey(item),
        noAiConfig: !global.hasAiConfig?.(),
      });
      return null;
    }
    const msgs =
      typeof global.getProblemDetailChatMessages === 'function'
        ? global.getProblemDetailChatMessages()
        : global.problemDetailChatMessages;
    const pick =
      typeof global.pickRawE2eTransactionFlowJsonFromItemAndMessages === 'function'
        ? global.pickRawE2eTransactionFlowJsonFromItemAndMessages(item, msgs || [])
        : item?.e2eTransactionFlowJson || null;
    const sessions = item.itDesignSupplementSessions || [];
    const nextIdx = sessions.findIndex((s) => {
      if (!s || s.designOutputJson == null) return false;
      const md = s.bpmFlowDrawMarkdown;
      return md == null || !String(md).trim();
    });
    if (nextIdx < 0) {
      logItDesignAutoSeq('bpm-skip-no-pending', { sessionLen: sessions.length });
      return null;
    }
    const session = sessions[nextIdx];
    const txNode = getTransactionNodeByStepIndex(pick, session.stepIndex);
    const designNorm = normalizeDesignOutput(session.designOutputJson);
    if (!designNorm) {
      logItDesignAutoSeq('bpm-skip-bad-design', { stepIndex: session.stepIndex });
      return null;
    }
    const stepLabel = session.transactionName || `事务${session.stepIndex + 1}`;
    const userContent = buildItDesignBpmDrawUserContent(session, txNode, designNorm);
    const fullPrompt = `${IT_DESIGN_BPM_SWIMLANE_SYSTEM_PROMPT}\n\n【用户】\n${userContent}`;

    global.pushAndSaveProblemDetailChat?.({
      role: 'system',
      content: `正在绘制事务【${stepLabel}】的 BPM 泳道流程图…`,
      timestamp: global.getTimeStr?.(),
    });
    const msgsAfterBusyBpm =
      typeof global.getProblemDetailChatMessages === 'function'
        ? global.getProblemDetailChatMessages()
        : global.problemDetailChatMessages;
    container.innerHTML = '';
    global.renderProblemDetailChatFromStorage?.(
      container,
      Array.isArray(msgsAfterBusyBpm) ? msgsAfterBusyBpm : [],
    );
    container.scrollTop = container.scrollHeight;

    const esc = global.escapeHtml || ((s) => String(s));
    const parsingBlock = document.createElement('div');
    parsingBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system problem-detail-chat-msg-parsing';
    parsingBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-parsing-inner"><span class="problem-detail-chat-spinner"></span><span class="problem-detail-chat-msg-content">正在绘制事务【${esc(
      stepLabel,
    )}】的 BPM 泳道流程图…</span></div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr?.() || ''}</div>`;
    container.appendChild(parsingBlock);
    container.scrollTop = container.scrollHeight;

    try {
      const fetchFn = global.fetchDeepSeekChat || global.fetchChat;
      if (typeof fetchFn !== 'function') throw new Error('未配置大模型调用');
      const bpmTaskTag = `task8-it-design-bpm-draw-${session.stepIndex}`;
      logItDesignAutoSeq('bpm-before-llm', {
        taskTag: bpmTaskTag,
        stepIndex: session.stepIndex,
        stepLabel,
        userChars: userContent.length,
      });
      const { content, usage, model, durationMs } = await fetchFn(
        [
          { role: 'system', content: IT_DESIGN_BPM_SWIMLANE_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        { taskTag: bpmTaskTag },
      );
      logItDesignAutoSeq('bpm-after-llm', { taskTag: bpmTaskTag, durationMs, outChars: (content || '').length });
      parsingBlock.remove();
      const raw = content != null ? String(content).trim() : '';
      if (!raw) throw new Error('模型返回为空');
      const llmMeta = { usage, model, durationMs };
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        type: 'task8LlmQueryBlock',
        taskId: 'task8',
        noteName: 'BPM流程绘制',
        stepName: stepLabel,
        phaseIndex: session.stepIndex,
        llmInputPrompt: fullPrompt,
        llmOutputRaw: raw,
        llmMeta,
        timestamp: global.getTimeStr?.(),
        confirmed: false,
      });
      if (typeof global.updateDigitalProblemItDesignSupplementBpmDraw === 'function') {
        const pkBpm = persistKeyForItDesignCase(item);
        global.updateDigitalProblemItDesignSupplementBpmDraw(pkBpm, session.stepIndex, raw);
        const list = global.getDigitalProblems ? global.getDigitalProblems() : [];
        const updated = list.find((it) => persistKeyForItDesignCase(it) === pkBpm);
        if (updated) syncCurrent(updated);
      }
      const freshSessions = getDetailItemForTask8()?.itDesignSupplementSessions || [];
      if (typeof global.updateDigitalProblemGlobalItGapAnalysis === 'function') {
        const pkAgg = persistKeyForItDesignCase(item);
        global.updateDigitalProblemGlobalItGapAnalysis(pkAgg, buildAggregateGlobalItGapFromSessions(freshSessions));
        const list2 = global.getDigitalProblems ? global.getDigitalProblems() : [];
        const u2 = list2.find((it) => persistKeyForItDesignCase(it) === pkAgg);
        if (u2) syncCurrent(u2);
      }
      container.innerHTML = '';
      const afterMsgs =
        typeof global.getProblemDetailChatMessages === 'function'
          ? global.getProblemDetailChatMessages()
          : global.problemDetailChatMessages;
      global.renderProblemDetailChatFromStorage?.(container, Array.isArray(afterMsgs) ? afterMsgs : []);
      container.scrollTop = container.scrollHeight;
      global.renderProblemDetailContent?.();
      global.renderProblemDetailHistory?.();
      return { stepIndex: session.stepIndex };
    } catch (err) {
      logItDesignAutoSeq('bpm-llm-catch', {
        message: err && err.message != null ? String(err.message) : String(err),
        name: err && err.name,
      });
      parsingBlock.remove();
      const escHtml = global.escapeHtml || ((s) => String(s));
      const errBlock = document.createElement('div');
      errBlock.className = 'problem-detail-chat-msg problem-detail-chat-msg-system';
      errBlock.innerHTML = `<div class="problem-detail-chat-msg-content-wrap"><div class="problem-detail-chat-msg-content">BPM 流程绘制失败：${escHtml(
        err.message || String(err),
      )}</div></div><div class="problem-detail-chat-msg-time">${global.getTimeStr?.() || ''}</div>`;
      container.appendChild(errBlock);
      const errText = err && err.message != null ? String(err.message) : String(err);
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        type: 'task8LlmQueryBlock',
        taskId: 'task8',
        noteName: 'BPM流程绘制',
        stepName: stepLabel,
        phaseIndex: session.stepIndex,
        llmInputPrompt: fullPrompt,
        llmOutputRaw: `（调用失败）${errText}`,
        llmMeta: { usage: {}, model: '', durationMs: 0 },
        timestamp: global.getTimeStr?.(),
        confirmed: false,
      });
      if (typeof global.pushLlmRetryNoticeBlock === 'function') {
        global.pushLlmRetryNoticeBlock(
          'task8',
          `调用异常：BPM 流程绘制失败（${errText}）。自动执行已暂停；可点「重新尝试」或顶栏「异常继续」从首个未完成步骤继续。`,
          TASK8_IT_DESIGN_RETRY_ACTION,
          'IT设计补齐',
        );
      } else {
        global.pushAndSaveProblemDetailChat?.({
          role: 'system',
          content: 'BPM 流程绘制失败：' + errText,
          timestamp: global.getTimeStr?.(),
        });
      }
      container.innerHTML = '';
      const afterBpmErr =
        typeof global.getProblemDetailChatMessages === 'function'
          ? global.getProblemDetailChatMessages()
          : global.problemDetailChatMessages;
      global.renderProblemDetailChatFromStorage?.(container, Array.isArray(afterBpmErr) ? afterBpmErr : []);
      container.scrollTop = container.scrollHeight;
      global.renderProblemDetailContent?.();
      global.renderProblemDetailHistory?.();
      return { abortedError: true };
    }
  }

  async function runItDesignBpmDrawAutoSequential(optionalItem) {
    const item =
      optionalItem && hasItDesignCaseKey(optionalItem) ? optionalItem : getDetailItemForTask8();
    if (!hasItDesignCaseKey(item)) return;
    const btn = document.querySelector('.btn-auto-it-design-bpm-draw-sessions');
    if (btn && !btn.disabled) btn.disabled = true;
    for (;;) {
      const r = await runItDesignBpmDrawForNextStep(getDetailItemForTask8());
      if (!r) break;
    }
    const sess = getDetailItemForTask8()?.itDesignSupplementSessions || [];
    const msgs =
      typeof global.getProblemDetailChatMessages === 'function'
        ? global.getProblemDetailChatMessages()
        : global.problemDetailChatMessages;
    const needBpm =
      Array.isArray(msgs) &&
      msgs.some((m) => m && m.type === 'itDesignBpmDrawSessionsBlock') &&
      sess.some((s) => s.designOutputJson != null);
    const allBpmDone =
      !needBpm ||
      sess
        .filter((s) => s.designOutputJson != null)
        .every((s) => s.bpmFlowDrawMarkdown != null && String(s.bpmFlowDrawMarkdown).trim());
    const chatContainer = global.el?.problemDetailChatMessages;
    if (chatContainer) {
      chatContainer.innerHTML = '';
      const m =
        typeof global.getProblemDetailChatMessages === 'function'
          ? global.getProblemDetailChatMessages()
          : global.problemDetailChatMessages;
      global.renderProblemDetailChatFromStorage?.(chatContainer, Array.isArray(m) ? m : []);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    global.renderProblemDetailHistory?.();
    global.renderProblemDetailContent?.();
    if (btn) {
      const s2 = getDetailItemForTask8()?.itDesignSupplementSessions || [];
      const hasUnfinished = s2.some(
        (s) => s.designOutputJson != null && (s.bpmFlowDrawMarkdown == null || !String(s.bpmFlowDrawMarkdown).trim()),
      );
      btn.disabled = !hasUnfinished;
    }
    if (allBpmDone && needBpm) {
      global.pushAndSaveProblemDetailChat?.({
        role: 'system',
        content: '全部事务的 BPM 泳道流程图已绘制完毕，结果已同步至工作区各事务「流程图绘制」折叠区。',
        timestamp: global.getTimeStr?.(),
      });
      if (chatContainer) {
        chatContainer.innerHTML = '';
        const m =
          typeof global.getProblemDetailChatMessages === 'function'
            ? global.getProblemDetailChatMessages()
            : global.problemDetailChatMessages;
        global.renderProblemDetailChatFromStorage?.(chatContainer, Array.isArray(m) ? m : []);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      global.renderProblemDetailHistory?.();
      const tasks = []
        .concat(global.FOLLOW_TASKS || [])
        .concat(global.ITGAP_HISTORY_TASKS || [])
        .concat(global.IT_STRATEGY_TASKS || []);
      const t8Name = tasks.find((t) => t && t.id === 'task8')?.name || 'IT设计补齐';
      requestAnimationFrame(() => global.showTaskCompletionConfirm?.('task8', t8Name));
    }
  }

  function buildAggregateGlobalItGapFromSessions(sessions) {
    return {
      itDesignSupplementV1: true,
      transactions: (sessions || []).map((s) => {
        const md =
          s.bpmFlowDrawMarkdown != null && String(s.bpmFlowDrawMarkdown).trim()
            ? String(s.bpmFlowDrawMarkdown).trim()
            : undefined;
        return {
          stepIndex: s.stepIndex,
          stageName: s.stageName,
          transactionId: s.transactionId,
          transactionName: s.transactionName,
          design_output:
            s.designOutputJson && s.designOutputJson.design_output
              ? s.designOutputJson.design_output
              : s.designOutputJson,
          ...(md ? { bpm_flow_diagram_markdown: md } : {}),
        };
      }),
    };
  }

  /** 与 `it-design-bpm-flow-render.js`、提示词一致 */
  const BPM_SWIMLANE_JSON_FORMAT_VERSION = '1.4.0';

  /**
   * 将 LLM 给出的字段列表归一为展示用字符串（数组或分号/顿号分隔字符串）
   * @param {unknown} val
   * @returns {string}
   */
  function normalizeBpmSwimlaneFieldList(val) {
    if (Array.isArray(val)) {
      return val
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .join('、');
    }
    if (val == null) return '';
    return String(val).trim();
  }

  /**
   * 自字符串中截取第一个平衡 `{ ... }`（尊重 JSON 字符串内括号）
   * @param {string} s
   * @returns {string|null}
   */
  function extractFirstBalancedJsonObjectString(s) {
    // 优先从泳道 Schema 特征键起算，避免历史 SVG 内联 CSS 的 `{` 干扰
    const prefer = s.search(/\{\s*"format_version"\s*:/);
    const start = prefer >= 0 ? prefer : s.indexOf('{');
    if (start < 0) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    return null;
  }

  /**
   * 从 LLM 单步对象提取逻辑说明（多键名、数组/对象兼容）；与 `it-design-bpm-flow-render.js` 的 `pickLogicBodyText` 语义对齐
   * @param {object} st
   * @returns {string}
   */
  function extractBpmSwimlaneStepLogicString(st) {
    if (!st || typeof st !== 'object') return '';
    const tryVal = (v) => {
      if (v == null) return '';
      if (Array.isArray(v)) {
        return v
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .join('；');
      }
      if (typeof v === 'object') {
        if (v.text != null && String(v.text).trim()) return String(v.text).trim();
        if (v.content != null && String(v.content).trim()) return String(v.content).trim();
        const parts = [];
        if (v.constraints != null && String(v.constraints).trim()) parts.push(String(v.constraints).trim());
        if (v.details != null && String(v.details).trim()) parts.push(String(v.details).trim());
        return parts.length ? parts.join('；') : '';
      }
      return String(v).trim();
    };
    const keys = [
      'logic_text',
      'logicText',
      'logic',
      'bpm_logic',
      'bpmLogic',
      'validation_logic',
      'verify_logic',
      'judgment_logic',
      'decision_logic',
      'check_logic',
      'logic_description',
      'field_memo',
    ];
    for (let i = 0; i < keys.length; i++) {
      const t = tryVal(st[keys[i]]);
      if (t) return t;
    }
    if (st.logic_meta != null && typeof st.logic_meta === 'object') {
      const t = tryVal(st.logic_meta);
      if (t) return t;
    }
    return '';
  }

  /**
   * 归一化泳道 JSON；非法则返回 null（走 svg/mermaid 兼容路径）
   * @param {object} obj
   * @returns {{ format_version: string, flow_title?: string, departments: string[], stages: string[], steps: { id: number, dept: string, stage: string, sentence: string, node_description: string, logic_text: string, db_write_fields: string, db_ref_fields: string, db_compute_fields: string, branch_no_to?: number }[] } | null}
   */
  function normalizeBpmFlowSwimlaneModel(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const departments = (Array.isArray(obj.departments) ? obj.departments : [])
      .map((x) => String(x ?? '').trim())
      .filter(Boolean);
    const stages = (Array.isArray(obj.stages) ? obj.stages : [])
      .map((x) => String(x ?? '').trim())
      .filter(Boolean);
    if (departments.length < 1 || stages.length < 1) return null;
    const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
    if (rawSteps.length < 1) return null;

    const steps = [];
    for (let i = 0; i < rawSteps.length; i++) {
      const st = rawSteps[i];
      if (!st || typeof st !== 'object') return null;
      const deptStr = String(st.dept ?? '').trim();
      const stageStr = String(st.stage ?? '').trim();
      const dci = departments.findIndex((d) => d === deptStr);
      const sci = stages.findIndex((stg) => stg === stageStr);
      if (dci < 0 || sci < 0) return null;
      const descExplicit = String(
        st.description != null && String(st.description).trim() !== ''
          ? st.description
          : st.node_description != null && String(st.node_description).trim() !== ''
            ? st.node_description
            : st.desc != null && String(st.desc).trim() !== ''
              ? st.desc
              : '',
      ).trim();
      const sentence = String(
        st.sentence != null && String(st.sentence).trim() !== ''
          ? st.sentence
          : st.text != null
            ? st.text
            : '',
      ).trim();
      const sentenceOut = sentence || descExplicit;
      if (!sentenceOut) return null;
      let logicText = extractBpmSwimlaneStepLogicString(st);
      if (
        !logicText &&
        /核验|校验|验证|决策|判断|网关/i.test(stageStr)
      ) {
        logicText = descExplicit || '';
      }
      const dbWrite = normalizeBpmSwimlaneFieldList(st.db_write_fields ?? st.write_fields);
      const dbRef = normalizeBpmSwimlaneFieldList(st.db_ref_fields ?? st.ref_fields);
      const dbCompute = normalizeBpmSwimlaneFieldList(st.db_compute_fields ?? st.compute_fields);
      const row = {
        id: i + 1,
        dept: departments[dci],
        stage: stages[sci],
        sentence: sentenceOut,
        node_description: descExplicit,
        logic_text: logicText,
        db_write_fields: dbWrite,
        db_ref_fields: dbRef,
        db_compute_fields: dbCompute,
      };
      const bnt = st.branch_no_to != null ? Number(st.branch_no_to) : NaN;
      if (!Number.isNaN(bnt) && bnt >= 1) {
        row.branch_no_to = bnt;
      }
      steps.push(row);
    }

    const fv =
      typeof obj.format_version === 'string' && obj.format_version.trim()
        ? obj.format_version.trim()
        : BPM_SWIMLANE_JSON_FORMAT_VERSION;

    const flowTitle =
      typeof obj.flow_title === 'string' && obj.flow_title.trim()
        ? obj.flow_title.trim()
        : typeof obj.title === 'string' && obj.title.trim()
          ? obj.title.trim()
          : typeof obj.transaction_name === 'string' && obj.transaction_name.trim()
            ? obj.transaction_name.trim()
            : '';

    const base = {
      format_version: fv,
      ...(flowTitle ? { flow_title: flowTitle } : {}),
      departments: departments.slice(),
      stages: stages.slice(),
      steps,
    };
    const flmIn = obj.field_label_map;
    if (flmIn && typeof flmIn === 'object' && !Array.isArray(flmIn)) {
      const safe = {};
      for (const k of Object.keys(flmIn)) {
        const sk = String(k).trim();
        if (!sk) continue;
        const sv = flmIn[k];
        if (sv != null && String(sv).trim()) safe[sk] = String(sv).trim();
      }
      if (Object.keys(safe).length) base.field_label_map = safe;
    }
    return base;
  }

  /**
   * 从 IT 设计 `data_objects` 构建字段编码 → 中文展示名（供泳道图「写入字段」渲染）
   * @param {Array<object>|null|undefined} dataObjs
   * @returns {Record<string, string>}
   */
  function buildFieldLabelMapFromItDesignDataObjects(dataObjs) {
    /** @type {Record<string, string>} */
    const m = Object.create(null);
    if (!Array.isArray(dataObjs)) return m;
    for (let oi = 0; oi < dataObjs.length; oi++) {
      const obj = dataObjs[oi];
      if (!obj || typeof obj !== 'object') continue;
      const tableCode =
        obj.table_code != null && String(obj.table_code).trim() ? String(obj.table_code).trim() : '';
      const fields = Array.isArray(obj.fields) ? obj.fields : [];
      for (let fi = 0; fi < fields.length; fi++) {
        const f = fields[fi];
        if (!f || typeof f !== 'object') continue;
        const code = f.code != null ? String(f.code).trim() : '';
        if (!code) continue;
        const name = f.name != null ? String(f.name).trim() : '';
        const label = name || code;
        if (!m[code]) m[code] = label;
        if (tableCode) {
          const qual = `${tableCode}.${code}`;
          if (!m[qual]) m[qual] = label;
        }
      }
    }
    return m;
  }

  /**
   * 从 LLM 原文解析泳道模型（整段 JSON、文内 ```json 围栏、或大括号对象）
   * @param {string} raw
   * @returns {ReturnType<typeof normalizeBpmFlowSwimlaneModel>}
   */
  function tryParseBpmFlowSwimlaneModel(raw) {
    const t0 = String(raw ?? '').trim();
    if (!t0) return null;

    /** @type {string[]} */
    const candidates = [];
    candidates.push(t0);
    if (t0.startsWith('```')) {
      let u = t0.replace(/^```(?:json)?\s*/i, '');
      const idx = u.lastIndexOf('```');
      if (idx >= 0) u = u.slice(0, idx);
      candidates.push(u.trim());
    }
    let fm;
    const reFence = /```(?:json)?\s*\n?([\s\S]*?)```/gi;
    while ((fm = reFence.exec(t0)) !== null) {
      const inner = fm[1].trim();
      if (inner.startsWith('{')) candidates.push(inner);
    }
    const balanced = extractFirstBalancedJsonObjectString(t0);
    if (balanced) candidates.push(balanced);

    let obj = null;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const o = JSON.parse(candidates[i]);
        if (o && typeof o === 'object' && !Array.isArray(o)) {
          obj = o;
          break;
        }
      } catch (_) {}
    }
    if (!obj) return null;
    return normalizeBpmFlowSwimlaneModel(obj);
  }

  /**
   * 将 BPM 绘制原文拆成 Markdown 段、svg、mermaid，或**单块**泳道 JSON（主路径：`flowJson` → `renderItDesignBpmSwimlaneSvg`）。
   * @param {string} raw
   * @returns {{ type: 'flowJson'|'md'|'svg'|'mermaid', text: string }[]}
   */
  function splitItDesignBpmDrawMarkdownChunks(raw) {
    const text = raw != null ? String(raw) : '';
    if (!text.trim()) return [];
    const swim = tryParseBpmFlowSwimlaneModel(text);
    if (swim) {
      return [{ type: 'flowJson', text: JSON.stringify(swim) }];
    }
    const chunks = [];
    const re = /```\s*(svg|mermaid)\s*([\s\S]*?)```/gi;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        const md = text.slice(last, m.index).trim();
        if (md) chunks.push({ type: 'md', text: md });
      }
      const lang = String(m[1] || '').toLowerCase();
      const inner = m[2] != null ? String(m[2]).trim() : '';
      if (inner) {
        chunks.push({ type: lang === 'mermaid' ? 'mermaid' : 'svg', text: inner });
      }
      last = re.lastIndex;
    }
    if (last < text.length) {
      const tail = text.slice(last).trim();
      if (tail) {
        let t = 'md';
        if (looksLikeBareSvg(tail)) t = 'svg';
        else if (looksLikeBareMermaidDiagram(tail)) t = 'mermaid';
        chunks.push({ type: t, text: tail });
      }
    }
    if (chunks.length === 0 && text.trim()) {
      const t = text.trim();
      let ty = 'md';
      if (looksLikeBareSvg(t)) ty = 'svg';
      else if (looksLikeBareMermaidDiagram(t)) ty = 'mermaid';
      chunks.push({ type: ty, text: t });
    }
    return chunks;
  }

  function looksLikeBareSvg(s) {
    const t = String(s).trim().replace(/<\?xml[\s\S]*?\?>\s*/gi, '');
    return /^<svg\b/i.test(t);
  }

  function looksLikeBareMermaidDiagram(s) {
    const t = String(s).trim();
    if (!t) return false;
    return /^(%%[^\n]*\n|\s)*\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|gantt|pie|journey|C4Context|mindmap)\b/i.test(
      t,
    );
  }

  /**
   * 工作区 view：单条事务的 design_output 树形子卡片（ITGap 表 / 角色卡 / 数据对象网格卡+字段列表）
   * @param {object|string|null} designOutputRoot
   * @param {(s: string) => string} escapeHtml
   * @param {string|null|undefined} [bpmFlowDrawMarkdown] — 泳道图 LLM 输出（主路径：**严格 JSON**；兼容 Markdown + \`\`\`svg\`\`\` / \`\`\`mermaid\`\`\`）；**json** 子卡内层级化 `JSON.stringify` 展示
   * @param {(s: string) => string} [renderMarkdownFn] — 将 Markdown 段渲染为 HTML；SVG 块由 main 侧 DOMPurify 清洗后注入，Mermaid 块仍走 mermaid.run
   * @param {Array<object>|null|undefined} [bpmDetailedFlow] — 本事务 `bpm_detailed_flow`；与 `it_gap_analysis[].bpm_node_id` 对齐填「节点描述 / 逻辑」列
   * @param {string|null|undefined} [transactionFlowTitleFallback] — 泳道 JSON 无 `flow_title` 时写入该事务名，供 view 顶栏展示（json 子卡仍展示 LLM 原文）
   */
  function buildItDesignSupplementTransactionViewHtml(
    designOutputRoot,
    escapeHtml,
    bpmFlowDrawMarkdown,
    renderMarkdownFn,
    bpmDetailedFlow,
    transactionFlowTitleFallback,
  ) {
    const esc =
      typeof escapeHtml === 'function'
        ? escapeHtml
        : function (s) {
            return String(s ?? '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
          };
    /** 流程图「json」子卡：优先层级化 JSON.stringify；否则泳道解析结果；再否则原文 */
    function formatBpmFlowDrawForJsonPanel(s0) {
      const t = String(s0 ?? '').trim();
      if (!t) return '';
      try {
        return esc(JSON.stringify(JSON.parse(t), null, 2));
      } catch (_) {
        /* fall through */
      }
      const swim = tryParseBpmFlowSwimlaneModel(t);
      if (swim) return esc(JSON.stringify(swim, null, 2));
      return esc(t);
    }
    let root = designOutputRoot;
    if (typeof root === 'string') {
      try {
        root = JSON.parse(root);
      } catch (_) {
        root = null;
      }
    }
    const norm = normalizeDesignOutput(root);
    const d = norm && typeof norm === 'object' ? norm.design_output : null;
    if (!d || typeof d !== 'object') {
      return '<p class="problem-detail-local-itgap-pending">暂无结构化设计输出</p>';
    }
    const itGapRows = Array.isArray(d.it_gap_analysis) ? d.it_gap_analysis : [];
    const roleList = Array.isArray(d.role_and_permission) ? d.role_and_permission : [];
    const dataObjs = Array.isArray(d.data_objects) ? d.data_objects : [];

    /** @type {Map<string, object>} */
    const bpmByNodeId = new Map();
    if (Array.isArray(bpmDetailedFlow)) {
      for (const n of bpmDetailedFlow) {
        if (!n || typeof n !== 'object') continue;
        const nid = n.bpm_node_id != null ? String(n.bpm_node_id).trim() : '';
        if (nid) bpmByNodeId.set(nid, n);
      }
    }

    function pickBpmDescAndLogic(node) {
      if (!node || typeof node !== 'object') return { desc: '—', logic: '—' };
      const descRaw = node.desc != null ? String(node.desc).trim() : '';
      const desc =
        descRaw ||
        (node.description != null && String(node.description).trim() ? String(node.description).trim() : '') ||
        '—';
      const logicRaw = node.logic != null ? String(node.logic).trim() : '';
      const logic = logicRaw || '—';
      return { desc, logic };
    }

    let itGapTableHtml = '';
    if (itGapRows.length === 0) {
      itGapTableHtml =
        '<p class="it-design-tree-empty">暂无 ITGap 分析条目</p>';
    } else {
      const thead =
        '<thead><tr><th scope="col">BPM 节点</th><th scope="col">节点描述</th><th scope="col">逻辑</th><th scope="col">分析结论</th><th scope="col">解决手段</th></tr></thead>';
      const tbodyRows = itGapRows
        .map((row) => {
          const idKey = row && row.bpm_node_id != null ? String(row.bpm_node_id).trim() : '';
          const id = idKey || '—';
          const bpmNode = idKey ? bpmByNodeId.get(idKey) : null;
          const { desc, logic } = pickBpmDescAndLogic(bpmNode);
          const gap = row && row.gap_desc != null ? String(row.gap_desc) : '—';
          const remedy = row && row.it_remedy != null ? String(row.it_remedy) : '—';
          const descSupPrefix =
            bpmNode && bpmNode.e2e_gap_supplement === true
              ? '<span class="it-design-itgap-desc-sup-prefix" title="需求场景事务流补齐写入">（补齐）</span> '
              : '';
          return `<tr><td class="it-design-itgap-cell-id">${esc(id)}</td><td class="it-design-itgap-cell-desc">${descSupPrefix}${esc(
            desc,
          )}</td><td class="it-design-itgap-cell-logic">${esc(logic)}</td><td>${esc(gap)}</td><td>${esc(remedy)}</td></tr>`;
        })
        .join('');
      itGapTableHtml = `<div class="it-design-itgap-table-wrap"><table class="it-design-itgap-table">${thead}<tbody>${tbodyRows}</tbody></table></div>`;
    }

    let roleCardsHtml = '';
    if (roleList.length === 0) {
      roleCardsHtml = '<p class="it-design-tree-empty">暂无角色权限条目</p>';
    } else {
      roleCardsHtml = `<div class="it-design-role-cards-row">${roleList
        .map((r) => buildSingleRoleCardHtml(r, esc))
        .join('')}</div>`;
    }

    function dataObjectIsNewBadge(isNewRaw) {
      const s = String(isNewRaw ?? '')
        .trim()
        .toLowerCase();
      if (
        s === 'true' ||
        s === '1' ||
        s === 'yes' ||
        s === 'y' ||
        s === '是' ||
        s === '新增' ||
        s === 'new'
      ) {
        return { label: '新增', cls: 'it-design-do-is-new--yes' };
      }
      if (
        s === 'false' ||
        s === '0' ||
        s === 'no' ||
        s === 'n' ||
        s === '否' ||
        s === '存量' ||
        s === 'existing'
      ) {
        return { label: '存量', cls: 'it-design-do-is-new--no' };
      }
      if (!s) return { label: '—', cls: 'it-design-do-is-new--unk' };
      return { label: esc(String(isNewRaw).trim()), cls: 'it-design-do-is-new--unk' };
    }

    let dataObjectsHtml = '';
    if (dataObjs.length === 0) {
      dataObjectsHtml = '<p class="it-design-tree-empty">暂无数据对象</p>';
    } else {
      const cardsInner = dataObjs
        .map((obj, i) => {
          const objTitle =
            obj && obj.object_name != null && String(obj.object_name).trim()
              ? String(obj.object_name).trim()
              : obj && obj.table_code != null && String(obj.table_code).trim()
                ? String(obj.table_code).trim()
                : `数据对象 ${i + 1}`;
          const badge = dataObjectIsNewBadge(obj && obj.is_new);
          const fields = Array.isArray(obj && obj.fields) ? obj.fields : [];
          let fieldsTableBody = '';
          if (fields.length === 0) {
            fieldsTableBody =
              '<tr><td colspan="3" class="it-design-fields-empty-cell">暂无字段</td></tr>';
          } else {
            fieldsTableBody = fields
              .map((f) => {
                const fname =
                  f && f.name != null && String(f.name).trim()
                    ? String(f.name).trim()
                    : f && f.code != null && String(f.code).trim()
                      ? String(f.code).trim()
                      : '—';
                const ftype = f && f.type != null ? String(f.type) : '—';
                let memo = f && f.memo != null ? String(f.memo) : '';
                const src = f && f.source != null ? String(f.source).trim() : '';
                if (src && memo && !memo.includes(src)) {
                  memo = memo ? `${memo}（来源：${src}）` : `来源：${src}`;
                } else if (src && !memo) {
                  memo = `来源：${src}`;
                }
                if (!memo) memo = '—';
                return `<tr>
                  <td class="it-design-field-cell-name">${esc(fname)}</td>
                  <td class="it-design-field-cell-type">${esc(ftype)}</td>
                  <td class="it-design-field-cell-memo">${esc(memo)}</td>
                </tr>`;
              })
              .join('');
          }
          return `<div class="it-design-data-object-card">
            <div class="it-design-data-object-card-head">
              <span class="it-design-data-object-card-title">${esc(objTitle)}</span>
              <span class="it-design-do-is-new-badge ${badge.cls}" title="是否新增">${badge.label}</span>
            </div>
            <div class="it-design-data-object-card-body">
              <table class="it-design-fields-table">
                <thead>
                  <tr>
                    <th scope="col">字段名</th>
                    <th scope="col">字段类型</th>
                    <th scope="col">设计说明</th>
                  </tr>
                </thead>
                <tbody>${fieldsTableBody}</tbody>
              </table>
            </div>
          </div>`;
        })
        .join('');
      dataObjectsHtml = `<div class="it-design-data-objects-grid">${cardsInner}</div>`;
    }

    const bpmRaw = bpmFlowDrawMarkdown != null ? String(bpmFlowDrawMarkdown).trim() : '';
    const txTitleFb =
      transactionFlowTitleFallback != null ? String(transactionFlowTitleFallback).trim() : '';
    /** view 用：在严格 JSON 且缺 flow_title 时补事务名；json Tab 仍用 `bpmRaw` */
    let bpmRawForViewChunks = bpmRaw;
    if (bpmRaw && txTitleFb) {
      const swimForTitle = tryParseBpmFlowSwimlaneModel(bpmRaw);
      if (swimForTitle && !String(swimForTitle.flow_title || '').trim()) {
        bpmRawForViewChunks = JSON.stringify({ ...swimForTitle, flow_title: txTitleFb });
      }
    }
    let bpmFlowHtml = '';
    if (bpmRaw) {
      let chunks = splitItDesignBpmDrawMarkdownChunks(bpmRawForViewChunks);
      if (!chunks.length) {
        chunks = [{ type: 'md', text: bpmRaw }];
      }
      const fieldLabelMapForFlow = buildFieldLabelMapFromItDesignDataObjects(dataObjs);
      if (Object.keys(fieldLabelMapForFlow).length) {
        chunks = chunks.map((ch) => {
          if (!ch || ch.type !== 'flowJson' || !ch.text) return ch;
          try {
            const o = JSON.parse(ch.text);
            if (!o || typeof o !== 'object' || Array.isArray(o)) return ch;
            o.field_label_map = fieldLabelMapForFlow;
            return { type: 'flowJson', text: JSON.stringify(o) };
          } catch (_) {
            return ch;
          }
        });
      }
      let chunksB64 = '';
      try {
        chunksB64 = btoa(unescape(encodeURIComponent(JSON.stringify(chunks))));
      } catch (_) {
        chunksB64 = '';
      }
      const mountAttr = chunksB64 ? ` data-chunks-b64="${esc(chunksB64)}"` : '';
      bpmFlowHtml = `<details class="it-design-tree-folder it-design-bpm-flow-folder" open>
        <summary class="it-design-tree-folder-summary">流程图绘制</summary>
        <div class="it-design-tree-folder-body it-design-bpm-flow-folder-inner">
          <div class="it-design-bpm-flow-tabs" role="tablist" aria-label="流程图展示方式">
            <button type="button" class="it-design-bpm-flow-tab it-design-bpm-flow-tab--active" role="tab" data-tab="view" aria-selected="true" aria-pressed="true">view</button>
            <button type="button" class="it-design-bpm-flow-tab" role="tab" data-tab="json" aria-selected="false" aria-pressed="false">json</button>
          </div>
          <div class="it-design-bpm-flow-panel-wrap">
            <div class="it-design-bpm-flow-panel it-design-bpm-flow-panel--view" data-panel="view" role="tabpanel">
              <div class="it-design-bpm-flow-view-mount it-design-bpm-flow-body"${mountAttr}></div>
            </div>
            <div class="it-design-bpm-flow-panel it-design-bpm-flow-panel--json" data-panel="json" role="tabpanel" hidden>
              <pre class="it-design-bpm-flow-pre it-design-bpm-flow-json-pre" tabindex="0">${formatBpmFlowDrawForJsonPanel(bpmRaw)}</pre>
            </div>
          </div>
        </div>
      </details>`;
    } else {
      bpmFlowHtml = `<details class="it-design-tree-folder it-design-bpm-flow-folder">
        <summary class="it-design-tree-folder-summary">流程图绘制</summary>
        <div class="it-design-tree-folder-body"><p class="it-design-tree-empty">待绘制：请在聊天区「IT设计补齐 Session 计划」中点击「自动顺序执行」（将在本事务 IT 设计完成后自动绘制 BPM 泳道图）。</p></div>
      </details>`;
    }

    return `<div class="it-design-tx-tree-root">
      <details class="it-design-tree-folder">
        <summary class="it-design-tree-folder-summary">ITGap 分析</summary>
        <div class="it-design-tree-folder-body">${itGapTableHtml}</div>
      </details>
      <details class="it-design-tree-folder">
        <summary class="it-design-tree-folder-summary">角色权限设计</summary>
        <div class="it-design-tree-folder-body">${roleCardsHtml}</div>
      </details>
      <details class="it-design-tree-folder">
        <summary class="it-design-tree-folder-summary">数据对象设计</summary>
        <div class="it-design-tree-folder-body">${dataObjectsHtml}</div>
      </details>
      ${bpmFlowHtml}
    </div>`;
  }

  global.generateItDesignSupplementSessions = generateItDesignSupplementSessions;
  global.runItDesignSupplementForNextStep = runItDesignSupplementForNextStep;
  global.runItDesignInterleavedNextStep = runItDesignInterleavedNextStep;
  global.runItDesignSupplementAutoSequential = runItDesignSupplementAutoSequential;
  global.buildAggregateGlobalItGapFromSessions = buildAggregateGlobalItGapFromSessions;
  global.buildItDesignSupplementTransactionViewHtml = buildItDesignSupplementTransactionViewHtml;
  global.getBpmDetailedFlowForItDesignSession = getBpmDetailedFlowForItDesignSession;
  global.runItDesignBpmDrawForNextStep = runItDesignBpmDrawForNextStep;
  global.runItDesignBpmDrawAutoSequential = runItDesignBpmDrawAutoSequential;
  global.isItDesignBpmDrawCompleteForItem = isItDesignBpmDrawCompleteForItem;
})(typeof window !== 'undefined' ? window : this);
