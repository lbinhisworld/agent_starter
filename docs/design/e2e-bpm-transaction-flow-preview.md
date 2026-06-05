# 事务流程图预览（task7）— 设计说明

## 1. 目标

在问题详情聊天区事务节点卡上提供「成图预览」，于右侧滑出面板中**只读**展示单条事务的 `bpm_detailed_flow`：纵向流程、分支语义、与价值流工作区解耦的轻量示意图。

## 2. 入口与信息架构

| 元素 | 说明 |
| ---- | ---- |
| 触发 | 工作区事务节点标题栏「成图预览」按钮（`e2e-bpm-tx-preview-btn`，`data-tx-b64` 承载 UTF-8 安全 Base64 JSON） |
| 容器 | `#e2e-bpm-preview-drawer`，由 `frontend/js/core/problem-detail-chat.js` 注入 |
| 标题 | 「事务流程图预览」；副标题为 `transaction_id｜name` |
| 正文 | `.e2e-bpm-preview-drawer-body` 内挂载 `.e2e-bpm-preview-diagram` |

## 3. 渲染流水线（两段式）

1. **结构 HTML**（先节点、后占位）  
   - `globalThis.buildE2eBpmTransactionFlowPreviewDiagramHTML(tx)`（`frontend/js/valueStream.js`）  
   - 输出：开始/结束椭圆、圆角步骤卡、网关双列、`.e2e-bpm-preview-connector--legacy` 竖向占位等。  
   - **不**在模板内写死与像素相关的分叉 SVG 路径（已移除静态网关折线 SVG）。

2. **布局后连线**（清除旧层再绘制）  
   - `globalThis.syncE2eBpmPreviewDiagramWires(root)`：  
     - 删除全部 `.e2e-bpm-preview-wire-layer`；  
     - 按 `.e2e-bpm-preview-port` 的 `getBoundingClientRect()` 计算端点；**SVG 尺寸与位置**按全部端口的包围盒（含网关 `translate` 外溢），避免仅用 `scrollWidth` 导致裁切；**异列**（x 不同）连接用 **曼哈顿折线**，同列仍用竖线。  
     - 在 `.e2e-bpm-preview-diagram` 上叠加 **绝对定位 SVG**（`pointer-events: none`），绘制主竖链、网关 **T 型**、分列内竖链及汇至「结束」的线。  
     - **列内递归**：`wireColBody` 处理嵌套 `step--gateway`；若某列体在 `drawGatewayT` 之后**没有**后续兄弟节点，则按列别（pass/fail）取网关底出口 `[oPass, oFail]` 中对应一端，避免误丢出口产生长竖错位线。  
     - **T 型顶锚**：`findFirstInTopInColBody` 取列体 **首个直接子元素** 的顶入端口（顺序：`step--task` → `step--gateway`），不扫描整棵子树。  
     - **`drawGatewayT` 出口**：`outs` **必须**为固定二元组 **`[oPass, oFail]`**（允许 `null`），**禁止**对 `outs` 做 `filter(Boolean)` 再参与 `pickColumnOut`；否则一侧无出口时索引错位，会把 fail 出口当 pass 用，产生 **左侧长竖「幽灵线」** 与 T 型横杠错位。  
     - **失败支**：**无** `.e2e-bpm-preview-gw-col--fail` DOM；T 型右翼锚点取 **`gateway-split` 右缘 + 外偏像素 `E2E_BPM_FAIL_RAIL_OUTSET_PX`**（与通过列节点卡留白，避免竖轨贴边；SVG 宽同步 + 同值防裁切），经 **split 底缘** 得 **`oFail`**，与 **`oPass`** 一并汇入全局「结束」。  
     - **异列曼哈顿**：`connectPorts` 横杠 **贴在目的地端口 `b.y`**（勿取 `(a.y+b.y)/2`），避免横线穿过中间节点正文。  
     - **网关桥备注**：`.e2e-bpm-preview-gateway-bridge-flow-hint` 文案 **「通过则继续流转」**，说明 `tail` 续段仅在通过列继续主流程；失败支不镜像 `tail`。  
     - **T 型横杠高度**：`yBar` 由父节点底口 `O.y` 与两侧列首顶入点 `min(A.y,B.y)` 约束；**钳位在顶入点上方 ≥6px**，避免 stub 比例过大时横线切入节点卡片。  
     - **调试**：`globalThis.__FE_E2E_BPM_WIRE_DEBUG === true` 时控制台输出 `[FE:e2e-bpm-wire]`（SVG 尺寸、path 数量等）。  
   - **触发时机**：抽屉打开后 **双 `requestAnimationFrame`**；`ResizeObserver` 监听 `drawer-body` 防抖重绘；关闭抽屉时 `disconnect` 观察器。

## 4. 端口与对接（DOM 契约）

- 所有可连接节点在几何上暴露 **可测量** 圆点：  
  - `.e2e-bpm-preview-port--in-top`：上边中点入  
  - `.e2e-bpm-preview-port--out-bottom`：下边中点出  
- 适用于：`e2e-bpm-preview-terminal--start/end`、`e2e-bpm-preview-node--linear` 内矩形、`e2e-bpm-preview-rect--branch`（核验/决策网关上游）；失败支无独立列 DOM，锚点取自 **`.e2e-bpm-preview-gateway-split`** 的右缘与底缘。  
- 连线端点相对端口中心做 **小幅延伸（overlap）**，减轻亚像素缝隙导致的「断点」感。  
- 动态绘线成功后，图为 `.e2e-bpm-preview-diagram--wires-synced`，占位 connector 内线段隐藏（`visibility: hidden`），保留占位高度。

## 5. 分支与布局规则

| 类型 | 行为 |
| ---- | ---- |
| 普通步骤 | 线性段，仅竖向连接 |
| **核验** / **决策** | `isBranchingBpmNodeType`：`splitBpmFlowToSegments` 切出 `branch`；网关 `e2e-bpm-preview-gateway--verify`（橙）与 `--decision`（琥珀）区分描边/线色 |
| T 型分叉 | 自上游矩形 **底边中点** 竖出 → 横杆 → 左右竖落至各列首个矩形 **顶边中点**；无首节点时用列 `col-body` 顶部中心兜底 |
| 网关下游 | `.e2e-bpm-preview-gateway-split` 为 **单列 grid**（`minmax(16rem,1fr)`），仅 **`gw-col--pass`**；**通过列 `col-body` 不再保留双列时的左边线/左内边距**，与上网关节点同宽对齐，避免端口中心线与 SVG 竖链错位 |
| 「不通过」→ 全局结束 | **无** `gw-col--fail`；`drawGatewayT` 用 **`gateway-split` 右缘/底缘** 得 **`oFail`**，与 **`oPass`** 在 **「结束」椭圆** 汇合 |
| **失败支 vs `tail`** | `tailHtml` **仅渲染在通过列**；不复制 `tailHtml`（避免镜像），失败支无 DOM 列。若未来模型提供「不通过」独有步骤，再扩展 schema 与渲染。 |

## 6. 预览内容裁剪

预览卡片内 **不展示**：BPM 节点编号徽标、子卡「BPM 节点」「VSM 溯源」。  
保留：类型、描述、逻辑、字段备注（若有）。  
**决策 / 执行** 步若存在 **`core_object_state_changes`**：额外展示子卡 **「核心对象状态变更」**（列表项与工作区条带同源：`buildCoreObjectStateChangeLineHtml`，短格式 **对象｜A → B** + 分色 + 「状态 」前缀展示清洗；见 **`docs/design/visual_design.md`** §2.3）。

## 7. 面板视觉（chrome）

- 侧栏宽度：**`min(90vw, max(50vw, 320px), 800px)`**，**贴视口右侧**全高滑出（左上与左下圆角、右侧与视口齐平；上限 800px）；`.e2e-bpm-preview-diagram` 仍为 **`width: fit-content`**；`.e2e-bpm-preview-drawer-body` 使用 **`overflow-x: auto`** / **`overflow-y: auto`**，图宽超出面板时 **在正文区内横向滚动**。  
- 面板：**深色半透明玻璃**（`rgba(30,34,42,0.88)`）+ **`backdrop-filter` 磨砂** + **青描边**；节点卡片约 **240×200**（`min-height`）、**`#94a3b8` / 12px** 描述字色，与主站解耦的科技风预览（见 `frontend/styles.css` `.e2e-bpm-preview-*`）。

## 8. 依赖与加载顺序

- `valueStream.js` 须先于使用 `buildE2eBpmTransactionFlowPreviewDiagramHTML` / `syncE2eBpmPreviewDiagramWires` 的脚本加载（如 `problem-detail-chat` 打开抽屉时调用）。  
- 约束编号与历史收口：**FE-20260402-06**（`frontend/js/AGENTS.md`）。

## 9. 维护清单（变更时自检）

- [ ] 改 HTML 结构或端口 class → 更新 `syncE2eBpmPreviewDiagramWires` 查询与本文档 §4。  
- [ ] 改网关几何或 `gateway-split` → 更新 §5 与 `styles.css`。  
- [ ] 改抽屉尺寸或磨砂 → 更新 §7 与 `frontend/js/AGENTS.md` 相关句。  
- [ ] 改 `renderSegmentsFrom` 的 pass/fail 与 `tail` 策略 → 同步 §5「失败列 vs tail」与 §10；用 **至少一条含多层嵌套分支** 的 `bpm_detailed_flow` fixture 做结构快照或人工验收（失败列不应再出现与通过列相同的整棵子树）。
- [ ] 改 **`core_object_state_changes`** 的解析、展示格式或子卡结构 → 同步本文 §6 与 **`docs/design/visual_design.md`** §2.3、`frontend/PROMPTS.md` §6.1。

### 9.1 为何结构问题易与连线问题混淆、如何避免漏测

| 原因 | 建议 |
| ---- | ---- |
| 迭代焦点在 **`syncE2eBpmPreviewDiagramWires`**（端口、曼哈顿线、`outs` 二元组），未逐行审 **`buildE2eBpmTransactionFlowPreviewDiagramHTML` 的 pass/fail DOM 策略** | 变更 checklist 区分 **「结构 HTML」** 与 **「布局后连线」**；PR 中两者都过同一套嵌套 fixture |
| 仅用「线是否贴黄点」验收，不校验 **横线是否穿过卡片正文**、失败列是否出现多余可视块 | 用嵌套 + 宽偏移端口 fixture；肉眼检查类型/描述/逻辑区是否被线横穿 |
| 仅凭「线是否贴黄点」验收，不校验 **失败列节点数/是否与通过重复** | 加粗浅断言：失败列内 **不应** 出现与通过列同深度、同标题的整段平行子树（或 DOM 深度/节点数上限） |

## 10. 已知问题与修复记录（连线）

| 现象 | 根因 | 处理 |
| ---- | ---- | ---- |
| 左侧长竖「幽灵线」、T 型横杠与黄点错位 | `drawGatewayT` 曾 `outs.filter(Boolean)`，一侧 `null` 时 pass/fail 索引错位 | 固定返回 `[oPass, oFail]`；汇至「结束」时仅 `push` 非空 |
| split 底缘汇线被裁切 | 包围盒仅扫端口 | 同步纳入 `.e2e-bpm-preview-gateway-split` 的 rect |
| **`gw-col--fail` 占宽** | 曾双列 grid + 空失败列 | 去掉失败列 DOM，改单列 + 几何锚点 |
| **异列连线横穿节点正文** | `connectPorts` 取 `yMid=(a.y+b.y)/2` 作横杠 | 横杠改为 **`yRail=b.y`**（贴目的地顶入点行） |
| `wireColBody` 失败无列体 | 移除 `gw-col--fail` | `split` 右缘顶锚 + 底缘 `oFail` |
| 视口装不下宽图 | — | 抽屉正文 `overflow-x: auto`（见 §7） |
| **左右列镜像、多份相同网关与任务卡** | `renderSegmentsFrom` 曾向失败列 **`push(tailHtml)`** | 已移除失败列 DOM；不复制 tail，`oFail` 由 split 几何导出 |
| **横线横穿节点正文** | T 型 `yBar = O.y + stub` 未上限，间距短时 `yBar` 低于两侧顶入点 | `yBar` 钳位为 `≤ min(A.y,B.y) - 6`（见 §3） |
| **`drawGatewayT` 缺端口时 outs 形态不一** | 曾 `return { outs: [] }` | 统一为 `{ outs: [null, null] }` 便于 `pickColumnOut` |
