-- 案例级 LLM 调用审计表：设计详情等入口写入，供独立详情页聚合
CREATE TABLE `ProblemCaseLlmLog` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `callTarget` VARCHAR(512) NOT NULL,
    `inputPrompt` LONGTEXT NOT NULL,
    `inputTokens` INTEGER NULL,
    `outputContent` LONGTEXT NOT NULL,
    `outputTokens` INTEGER NULL,
    `durationMs` INTEGER NOT NULL,
    `model` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ProblemCaseLlmLog_caseId_createdAt_idx` ON `ProblemCaseLlmLog`(`caseId`, `createdAt`);

ALTER TABLE `ProblemCaseLlmLog` ADD CONSTRAINT `ProblemCaseLlmLog_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `ProblemCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
