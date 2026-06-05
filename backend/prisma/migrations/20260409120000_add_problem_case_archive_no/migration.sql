-- 档案编号：按 owner 维度自增，删除案例不回收号码；需 MySQL 8+ / MariaDB 10.2+（ROW_NUMBER）
ALTER TABLE `ProblemCase` ADD COLUMN `archiveNo` INTEGER NULL;

UPDATE `ProblemCase` AS `p`
INNER JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY IFNULL(`ownerSubjectType`, ''), IFNULL(`ownerSubjectId`, '')
      ORDER BY `createdAt` ASC
    ) AS `rn`
  FROM `ProblemCase`
) AS `x` ON `p`.`id` = `x`.`id`
SET `p`.`archiveNo` = `x`.`rn`;

ALTER TABLE `ProblemCase` MODIFY COLUMN `archiveNo` INTEGER NOT NULL;
