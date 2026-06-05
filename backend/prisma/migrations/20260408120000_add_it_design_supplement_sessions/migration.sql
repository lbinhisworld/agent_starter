-- task8：IT设计补齐按事务 session 列表（刷新后恢复工作区进度）
ALTER TABLE `ProblemCase` ADD COLUMN `itDesignSupplementSessions` JSON NULL;
