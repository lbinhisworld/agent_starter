-- CreateTable
CREATE TABLE `ToolExperienceChatState` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ToolExperienceChatState_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ToolExperienceChatState` ADD CONSTRAINT `ToolExperienceChatState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
