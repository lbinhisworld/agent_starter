-- 任务 1 阶段 DesignDetailTaskToken：taskId 统一为产品中文名（读/删 API 仍接受 customer_basic、customer_requirement 别名）
UPDATE `DesignDetailTaskToken`
SET `taskId` = '任务 1：客户基本情况了解'
WHERE `taskId` IN ('customer_basic', 'customer_requirement');
