-- task9 对象状态机构建：LLM 产出的状态机 JSON（供工作区与导出）
ALTER TABLE `ProblemCase` ADD COLUMN `objectStateMachineJson` JSON NULL;
