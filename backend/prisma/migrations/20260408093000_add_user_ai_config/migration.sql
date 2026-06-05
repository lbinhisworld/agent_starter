-- CreateTable
CREATE TABLE `UserAiConfig` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'deepseek',
    `apiKeyCiphertext` LONGTEXT NOT NULL,
    `apiUrl` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserAiConfig_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserAiConfig` ADD CONSTRAINT `UserAiConfig_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
