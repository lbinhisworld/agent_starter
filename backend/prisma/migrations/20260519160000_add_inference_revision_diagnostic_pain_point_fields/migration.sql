-- 推理修订审计：Diagnostic_Pain_Points 四字段 + 记录类型「诊断痛点」
ALTER TABLE `DesignDetailInferenceRevisionRecord`
    ADD COLUMN `conflictDescription` TEXT NULL COMMENT 'Diagnostic_Pain_Points.Conflict_Description',
    ADD COLUMN `insightConfirmation` TEXT NULL COMMENT 'Diagnostic_Pain_Points.Insight_Confirmation',
    ADD COLUMN `rootCauseAnalysis` TEXT NULL COMMENT 'Diagnostic_Pain_Points.Root_Cause_Analysis',
    ADD COLUMN `designConstraint` TEXT NULL COMMENT 'Diagnostic_Pain_Points.Design_Constraint';

ALTER TABLE `DesignDetailInferenceRevisionRecord`
    MODIFY COLUMN `recordKind` ENUM('特征取值', '反向验证', '诊断痛点') NOT NULL;
