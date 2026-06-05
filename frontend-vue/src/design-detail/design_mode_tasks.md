# 设计详情页 · 设计模式任务线（Design Mode Task Line）

本文档描述 **设计详情独立页** 专用任务线，对齐 **全链路需求推理引擎架构矩阵 V4.1**（方案 B：任务 9 分层纠偏）。

## 任务列表与顺序（16 步 + 收官）

顺序 **固定**；标题栏与任务动态卡标题为 **`任务 N：中文名`**（`designLinePillLabel`）。

| 顺序 | 内部 id | 用户可见名称（摘要） | 层级 / 要点 |
| ---- | ------- | -------------------- | ----------- |
| 0 | `optional_toolbox_primitive` | 可选工具箱非结构化原语解构 | L0 工具原语；为任务 8.5 多工具对冲提供选型池 |
| 1 | `customer_basic` | 客户基本情况了解 | L1 实体画像 |
| 2 | `scale_org_mode_extract` | 规模与组织模式推理 | L1 |
| 3 | `industry_business_profile_extract` | 行业与业务属性推理 | L2 |
| 4 | `core_value_driver_inference` | 价值链分析推理 | L2 |
| 5 | `macro_process_flow_inference` | L3：宏观流程特征推理 | L3 流程骨干 |
| 5.1 | `value_proposition_capability_units` | L3.1：企业战略价值主张与部门级业务能力编排 | 价值主张 + 业务能力单元 |
| 5.2 | `capability_field_set_mapping` | 表格字段功能理解 | 按任务 1 现有表格逐表 LLM；字段集命名 `表名 - 能力单元` |
| 5.3 | `key_scenario_temporal_flow_inference` | 流程环节功能理解 | **5.2 收官后 → 5.3 → 5.5**；扫描任务 1 运营模式业务流程；`L3_Workflow_Flow_Matrix` / `关键工作流` |
| 5.5 | `vsm_stage_decomposition` | L3.5：价值流图 VSM 阶段拆解 | L3.5 |
| 6 | `pain_point_extraction` | 关键场景推理 | L3 |
| 7 | `key_requirement_scenarios` | 任务节点IT选型推理 | L4-IT选型层 |
| 8 | `role_object_stm_inference` | 业务对象与有限状态机矩阵推导 | L4 **纯业务真空**（无工具信息） |
| **8.5** | `physical_hook_integration_inference` | **物理外挂集成推理** | L4.7：任务 8 STM × 任务 0 工具原语；技术组件/Hook/前端载体 |
| 9 | `business_capability_positioning` | 领域驱动逻辑容器与工具宿主定义推理 | L5 **宏观合围**（非微观菜单流水线） |
| 10 | `process_type_derivation` | 物理建表 / 跨平台 EAI 接口同步 / RBAC 初始化推理（完整版） | 后续 JSON 门槛线步 |
| 11 | `process_node_design` | 分析报告生成 | 架构清单「设计报告」；任务 10 收官后调试门闩确认再起跑 |
| 12 | `role_and_business_object_derivation` | 流程图生成 | 架构清单「业务流程」 |
| 13 | `module_abstract_design` | 功能清单生成 | 架构清单「功能清单」（task-graph 任务 10 直刷） |
| 14 | `field_design` | ER 图生成 | 架构清单「ER 图」；task-graph 任务 10 物理表同源派生（只读画布） |
| 收官 | `all_done` | 已全部完成 | |

## V4.1 架构要点（任务 8 / 8.5 / 9）

- **任务 8**：产出 `操作角色` / `单据对象` / `状态转移矩阵`（OOAD+FSM+RBAC）；Input 1＝任务 7「所属业务流程」+「协作节点」；Input 2＝任务 1 全集（含 `现有表格/` 化石字段）；Input 3＝任务 1~4 商业基因；JSON 根键 `L4_Prototype_Inference_Matrix`。
- **任务 8.5**：吃进任务 8 状态转移矩阵，对撞任务 0 六维工具特征，并依 Input 3 五维商业基因执行**自适应柔性剪枝弹性大闸**；输出 `技术组件映射` / `自动化流Hook` / `前端交互载体`；JSON 根键 `L4_7_Tech_Integration_Matrix`；逻辑树双源归纳边：任务 8→8.5（琥珀）、任务 0→8.5（紫）。
- **任务 9**：仅做 DDD 宏观一级模块合围与**工具宿主裁决**；Input 1 来自任务 8.5（已穿技术外衣的微观资产），Input 2 为任务 0 工具原语，Input 3 为任务 1~4 商业基因；JSON 根键 `L5_Blueprint_Domain_Matrix`；`Target_KV` 仅 `Feature_Key=系统一级模块`，每行须带 `Tech_Host_Platform`；**严禁**在此拆分微观二级菜单流水线。

## 与代码映射

| 文档概念 | 代码位置 |
| -------- | -------- |
| 任务顺序、中文名 | `designModeTaskPipeline.ts` |
| 任务 8.5 流水线 | `runTask85PhysicalHookPipeline.ts`、`buildTask85PhysicalHookInferenceInputFromTaskGraph.ts` |
| 任务 8.5 提示词 | `frontend/js/designDetailL475PhysicalHookSystemPrompt.js` |
| 任务 9 流水线 | `runTask9L5BlueprintPipeline.ts`、`buildTask9L5BlueprintInferenceInputFromTaskGraph.ts` |
| 任务 9 提示词 | `frontend/js/designDetailL5BlueprintSystemPrompt.js` |
| 8.5→9 调试门闩 | `designDetailDebugFlags.ts`（`DESIGN_DETAIL_DEBUG_PAUSE_BEFORE_TASK_9`）、`useDesignDetailChat.ts` |
| 落库 API | `POST …/sync-task9-l5-blueprint-target-kv-tokens` |
| 任务 8 提示词 | `frontend/js/designDetailL4PrototypeSystemPrompt.js` |
| 8.5 落库 API | `POST …/sync-task85-l475-physical-hook-target-kv-tokens` |
| 线步 hold / reconcile | `designDetailLineState.ts`（`holdPastTask85`） |

**触发器**: 本目录任务线 id 或 V4.1 分层变更时更新本文档与 `AGENTS.md`。
