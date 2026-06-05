# 首页设计描述

> 最近更新：2026-03-21。与当前实现（index.html `#homeView`、main.js 首页解析与客户档案列表、js/preliminaryRequirement.js 解析预览）保持一致。客户档案卡片在时间戳下方展示 **当前任务** 圆角标签（`getFirstUncompletedTask` → 任务名；全部完成则「已全部完成」）。**local + IndexedDB**：页面加载后 `storage-indexeddb-adapter` 异步回填内存缓存，`main.js` 除 `DOMContentLoaded` 首次渲染外，监听 `storageIndexedDbReady` 再次调用 `renderProblemFollowList()`（与 online 模式 `storageBackendReady` 对称），避免刷新后客户档案条数短暂为 0。进入问题详情后，侧滑「沟通历史」的过程日志标签排版见 [数字化问题跟进阶段设计.md](../数字化问题跟进阶段设计.md) §0.6。

---

## 1. 功能定位与总体目标

- **定位**：应用默认入口视图，用于录入新的数字化问题并管理已有客户档案。
- **入口**：顶部导航中的「首页」按钮（`#btnHome`），点击后切换至 `#homeView`，并隐藏其他视图。
- **核心目标**：
  - 提供**统一输入区**：用户可输入企业名称、需求描述、IT 现状、时间要求或在线会议总结等文本。
  - 通过**解析**对输入进行多维度提炼，并在**解析预览**中展示结构化结果，用户确认后**启动跟进**生成新客户档案。
  - 在首页下方展示**客户档案列表**，支持点击进入该问题的详情/任务追踪视图。

---

## 2. UI 结构

### 2.1 布局容器

- **根节点**：`#homeView`，class `view home-intake-view`，为单页多视图之一。
- **内容容器**：`.home-intake-center`，居中承载标题、输入区、解析预览与客户档案列表。

### 2.2 主要区块

| 区块 | DOM | 说明 |
|------|-----|------|
| 标题 | `.home-intake-title` | 圆角蓝底白字标签 `.home-intake-title-brand`「&lt;七巧 Creator:/&gt;」+ `.home-intake-title-main` 主文案 |
| 输入区 | `.home-intake-row` | `.home-intake-input-wrap`：多行输入 + 底部分栏（顶部分割线）+ 全宽「开始」按钮 |
| 输入框 | `#digitalProblemInput` | textarea，与按钮区由 `.home-intake-parse-footer` 上边框分隔 |
| 开始按钮 | `#btnParse` `.btn-parse` | 文案「开始」；点击后调用初步需求提炼（原解析逻辑），加载态「开始中…」；成功后展示解析预览 |
| 解析预览 | `#parsePreview` | 默认 `hidden`；解析成功后显示，内含标题、启动跟进按钮及预览网格 |
| 预览标题 | `.parse-preview-title` | 「解析预览」 |
| 启动跟进 | `#btnStartFollow` | 将当前解析结果写入新客户档案并跳转/刷新列表 |
| 预览内容 | `#parsePreviewContent` | `<dl class="parse-preview-grid">`，由 `renderParsePreview` 等填充多维度字段 |
| 客户档案区 | `#problemFollowListSection` | 展示档案数量与列表 |
| 档案数量 | `#problemFollowCount` | 文案如「共有 N 个客户档案」 |
| 档案列表 | `#problemFollowListContent` | `.problem-follow-list`，卡片列表；每张含标题、时间戳、`.problem-follow-card-task-row`（`.problem-follow-card-task-badge`「当前任务」+ `.problem-follow-card-task-text` 阶段备注）、详情/复制/删除 |

### 2.3 样式与状态

- 解析预览支持退出动效（如 `parse-preview-exiting`），用于「启动跟进」后收起预览。
- 客户档案卡片样式与交互由 `styles.css` 中 `.problem-follow-section`、`.problem-follow-list`、卡片类定义。

---

## 3. 交互与流程

### 3.1 解析流程

1. 用户在 `#digitalProblemInput` 输入或粘贴文本。
2. 点击「开始」→ 调用 `parseDigitalProblemInput`（preliminaryRequirement.js）进行多维度提炼。
3. 解析成功：将结果写入 `lastParsedResult`（及 `lastParsedLlmQuery`），调用 `renderParsePreview` 填充 `#parsePreviewContent`，并显示 `#parsePreview`。
4. 解析失败：在预览区展示错误信息，仍显示 `#parsePreview`。

### 3.2 启动跟进

1. 用户查看解析预览后点击「启动跟进」。
2. 使用 `lastParsedResult` 创建新客户档案（含初步需求等），写入存储（或通过 storage-http-adapter 同步后端）。
3. 清空输入框、隐藏/收起解析预览，刷新客户档案列表 `renderProblemFollowList()`。
4. 可选：自动选中新建档案并进入问题详情视图（以当前实现为准）。

### 3.3 客户档案列表

- 进入首页或从其他视图返回首页时，调用 `renderProblemFollowList()` 从存储拉取档案列表并渲染到 `#problemFollowListContent`。
- 点击某条档案卡片：根据问题 ID 切换至问题详情视图（`problemDetailView`），并更新顶部导航为「企业详情」等。

### 3.4 导航

- 顶部「首页」：显示 `#homeView`，隐藏任务追踪、问题详情、知识库等视图。
- 从问题详情「返回」可回到首页或任务追踪（依产品逻辑）。

---

## 4. 解析预览字段说明

解析预览展示的字段来自**初步需求多维度提炼**结果，与问题详情中的「初步需求」卡片一致。字段定义、标签与嵌套结构见：

- **多维度提炼提示词与输出结构**：`PROMPTS.md` §1。
- **字段标签、路径与渲染**：`js/preliminaryRequirement.md`、`js/preliminaryRequirement.js`（如 `PARSE_PREVIEW_FIELDS`、`renderParsePreview`）。

常用顶层或嵌套字段包括：客户名称、客户需求/挑战、IT 现状、项目时间要求、运营模式（业务流程、组织架构）、经营状态、紧急度分析（当前优先、可延后、紧急度等级）及需求详情等。

---

## 5. 与实现的对应关系

| 设计点 | 实现位置 |
|--------|----------|
| 首页视图与导航切换 | `index.html` `#homeView`；`js/navigation.js` 视图显隐；`main.js` `btnHome` 点击 |
| 解析按钮与解析流程 | `main.js` `handleParseClick`、解析调用与 `lastParsedResult` 写入 |
| 解析预览渲染 | `js/preliminaryRequirement.js` `renderParsePreview`；`main.js` 中调用与 `parsePreviewContent`/`parsePreview` 控制 |
| 启动跟进 | `main.js` `handleStartFollowClick`（或等价函数），写档案、清空输入、刷新列表 |
| 客户档案列表渲染与点击 | `main.js` `renderProblemFollowList`、`problemFollowListContent` 上的点击委托 |
| 样式 | `styles.css` `.home-intake-*`、`.parse-preview*`、`.problem-follow-*` |

---

**触发器**：首页 DOM 结构、区块职责或交互流程变更时，请同步更新本文档及（若涉及）`js/preliminaryRequirement.md`、`PROMPTS.md` 的引用说明。
