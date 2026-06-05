-- 设计详情：`DesignLogicLink` 增加边类型（正向归纳 / 反向校验），并按端点 token 的 `taskId` 回填历史行
ALTER TABLE `DesignLogicLink` ADD COLUMN `linkKind` ENUM('FORWARD_INDUCTION', 'REVERSE_VALIDATION') NOT NULL DEFAULT 'FORWARD_INDUCTION';

UPDATE `DesignLogicLink` l
INNER JOIN `DesignFeatureNode` sf ON sf.featureId = l.sourceFeatureId
INNER JOIN `DesignDetailTaskToken` st ON st.tokenId = sf.tokenId
INNER JOIN `DesignFeatureNode` tf ON tf.featureId = l.targetFeatureId
INNER JOIN `DesignDetailTaskToken` tt ON tt.tokenId = tf.tokenId
SET l.linkKind = CASE
  WHEN (
    tt.taskId IN ('customer_basic', 'customer_requirement', '任务 1：客户基本情况了解')
    AND st.taskId NOT IN ('customer_basic', 'customer_requirement', '任务 1：客户基本情况了解')
  ) THEN 'REVERSE_VALIDATION'
  ELSE 'FORWARD_INDUCTION'
END;
