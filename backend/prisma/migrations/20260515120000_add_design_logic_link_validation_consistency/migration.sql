-- 任务 2 L1：`Token_Validation_Mapping` 落库反向校验边时记录 **Consistency**（逻辑一致 / 潜在冲突），供 Tree 边着色
ALTER TABLE `DesignLogicLink` ADD COLUMN `validationConsistency` VARCHAR(32) NULL;
