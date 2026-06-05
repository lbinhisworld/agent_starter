-- 任务 1 特征节点：历史痛点免疫 — 是否确认痛点及确认来源线步
ALTER TABLE `DesignFeatureNode`
  ADD COLUMN `painPointConfirmed` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `painPointConfirmedByLineStepId` VARCHAR(64) NULL;

CREATE INDEX `DesignFeatureNode_painPointConfirmed_idx` ON `DesignFeatureNode`(`painPointConfirmed`);
