-- Task1 需求提炼显式轮次：`businessContext` 每轮同步递增 `designDetailRequirementSyncGen`，`DesignDetailTaskToken.requirementSyncGeneration` 记录写入轮次（逻辑弹层 `cr-*`）；旧行均为 0，读图仍可用 `createdAt` 启发式
ALTER TABLE `ProblemCase` ADD COLUMN `designDetailRequirementSyncGen` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `DesignDetailTaskToken` ADD COLUMN `requirementSyncGeneration` INTEGER NOT NULL DEFAULT 0;
