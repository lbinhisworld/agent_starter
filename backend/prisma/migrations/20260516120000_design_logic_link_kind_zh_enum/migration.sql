-- `DesignLogicLink.linkKind`：ENUM 取值改为中文「正向归纳」「反向验证」（与 `schema.prisma` 中 `@map` 一致）
ALTER TABLE `DesignLogicLink` MODIFY COLUMN `linkKind` VARCHAR(32) NOT NULL DEFAULT '正向归纳';

UPDATE `DesignLogicLink` SET `linkKind` = CASE `linkKind`
  WHEN 'FORWARD_INDUCTION' THEN '正向归纳'
  WHEN 'REVERSE_VALIDATION' THEN '反向验证'
  ELSE '正向归纳'
END;

ALTER TABLE `DesignLogicLink` MODIFY COLUMN `linkKind` ENUM('正向归纳', '反向验证') NOT NULL DEFAULT '正向归纳';
