-- task7：端到端事务流 / 需求场景补齐 / 历史全景观 JSON 落库（与前端 PUT 白名单一致）
ALTER TABLE `ProblemCase` ADD COLUMN `e2eFlowLandscapeJson` JSON NULL COMMENT 'task7 历史全景观压缩 JSON（兼容）';
ALTER TABLE `ProblemCase` ADD COLUMN `e2eTransactionFlowJson` JSON NULL COMMENT 'task7 端到端业务事务流 BPM JSON';
ALTER TABLE `ProblemCase` ADD COLUMN `e2eRequirementScenarioSupplementJson` JSON NULL COMMENT 'task7 初步需求 FVS 完整性补齐事务流 JSON';
