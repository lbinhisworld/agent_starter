## `prisma.ts` 使用说明

本文件负责在后端项目中**初始化并导出全局唯一的 Prisma Client**（`prisma`），用于访问数据库（MariaDB/MySQL）。

### 什么时候用它

- 在 Repository / Service 层需要读写数据库时，统一从这里引入 `prisma`。
- 在本地开发（非生产）环境下，会复用同一个 PrismaClient，避免热重载/重复初始化导致连接数耗尽。

### 依赖与前置条件

- 必须设置环境变量 `DATABASE_URL`，示例：

```env
DATABASE_URL="mysql://smart_cto_app:<your_password>@localhost:3306/smart_cto"
```

未配置时会直接抛错：`DATABASE_URL is required to initialize PrismaClient.`

### 如何在代码中使用

在任意需要访问数据库的模块中直接引入：

```ts
import { prisma } from '../lib/prisma';

// 示例：读取 problemCase 列表
const items = await prisma.problemCase.findMany({ orderBy: { createdAt: 'desc' } });
```

### `createPrismaClient()` 的作用

`createPrismaClient()` 会从 `DATABASE_URL` 解析出 host/port/user/password/database，并通过 `@prisma/adapter-mariadb` 创建连接适配器，再构造 `PrismaClient`。

### 开发环境连接复用策略

- 生产环境：每个进程一个 PrismaClient（常规做法）。
- 非生产环境：将 client 缓存在 `global.__smartCtoPrisma__`，下次加载模块时直接复用。

