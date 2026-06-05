# 本地 MySQL 搭建说明

当前本地开发库已经在这台机器上搭好了，采用的是 `MariaDB 12.2`，对当前项目来说可以按 `MySQL` 使用。

## 一、当前本地数据库状态

- 安装目录：`C:\Program Files\MariaDB 12.2`
- 本地数据目录：`C:\Users\LHT\Documents\Playground\local-mariadb\data`
- 本地配置文件：`C:\Users\LHT\Documents\Playground\local-mariadb\my.ini`
- 监听端口：`3306`
- 字符集：`utf8mb4`
- 项目数据库名：`smart_cto`

说明：

- 程序安装在 `Program Files`，但实际数据目录已经迁到用户目录，避免开发态写权限问题。
- 当前本地实例按开发模式启动，不依赖 Windows 服务，适合先把前后端数据库链路跑通。

## 二、当前项目建议连接方式

后端建议通过独立开发账号连接，不直接使用 `root`。

建议连接格式：

```env
DATABASE_URL="mysql://smart_cto_app:<your_password>@localhost:3306/smart_cto"
```

当前本机实际可用的连接信息已经写入本地 `backend/.env`，不提交到仓库。

## 三、手动启动命令

如果本地数据库进程退出了，可以手动重新启动：

```powershell
Start-Process -FilePath "C:\Program Files\MariaDB 12.2\bin\mariadbd.exe" `
  -ArgumentList "--defaults-file=C:/Users/LHT/Documents/Playground/local-mariadb/my.ini","--console"
```

## 四、连通性验证

验证端口：

```powershell
Test-NetConnection localhost -Port 3306
```

验证数据库连接：

```powershell
& "C:\Program Files\MariaDB 12.2\bin\mariadb.exe" `
  --user=smart_cto_app `
  --password="<your_password>" `
  --host=localhost `
  -e "SHOW DATABASES LIKE 'smart_cto';"
```

## 五、对当前项目的意义

这一步完成后，项目已经具备“本地真实 MySQL 环境”。

下一步可以直接继续：

1. 用 Prisma 把 `problem_cases`、`problem_case_messages` 落到数据库。
2. 把后端仓储从内存实现切到 Prisma/MySQL。
3. 先打通首页“解析 -> 创建客户档案 -> 数据库存储成功”闭环。
4. 再继续切 `ProblemDetail` 的消息和任务读写。
