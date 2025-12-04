import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Hono } from 'hono'
import { z } from 'zod'
import { initDb } from '../db'
import { env, isInstalled, reloadEnv } from '../env'
import { PrismaClient as MSSQLClient } from '../generated/client-mssql'
import { PrismaClient as MySQLClient } from '../generated/client-mysql'
import { PrismaClient as PGClient } from '../generated/client-pg'

import { hashPassword } from '../utils/password'

const router = new Hono()

const installSchema = z.object({
  dbType: z.enum(['mysql', 'postgresql', 'mssql']),
  dbHost: z.string().min(1),
  dbPort: z.coerce.number().default(3306).optional(),
  dbName: z.string().min(1),
  dbUser: z.string().min(1),
  dbPassword: z.string(),
  jwtSecret: z.string().min(32),
  adminUsername: z
    .string()
    .min(3)
    .max(12)
    .regex(/^[a-zA-Z0-9_]+$/),
  adminPassword: z.string().min(6).max(24),
  adminEmail: z.string().email(),
  adminNickname: z.string().min(2).max(24),
})

router.get('/status', (c) => c.json({ installed: isInstalled }))

router.post('/', async (c) => {
  if (isInstalled) {
    return c.json({ error: 'Already installed' }, 403)
  }

  const parsed = installSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const {
    dbType,
    dbHost,
    dbPort,
    dbName,
    dbUser,
    dbPassword,
    jwtSecret,
    adminUsername,
    adminPassword,
    adminEmail,
    adminNickname,
  } = parsed.data
  const defaultPortMap = { mysql: 3306, postgresql: 5432, mssql: 1433 } as const
  const resolvedDbPort = dbPort ?? defaultPortMap[dbType]
  const encodedUser = encodeURIComponent(dbUser)
  const encodedPassword = encodeURIComponent(dbPassword)
  const encodedDbName = encodeURIComponent(dbName)

  try {
    const adminPasswordHash = await hashPassword(adminPassword)

    // 1. 验证连接并创建数据库（如果需要）
    let url = ''
    if (dbType === 'mysql') {
      url = `mysql://${encodedUser}:${encodedPassword}@${dbHost}:${resolvedDbPort}`
    } else if (dbType === 'postgresql') {
      url = `postgresql://${encodedUser}:${encodedPassword}@${dbHost}:${resolvedDbPort}/postgres`
    } else {
      url = `sqlserver://${dbHost}:${resolvedDbPort};database=master;user=${encodedUser};password=${encodedPassword};encrypt=true;trustServerCertificate=true`
    }

    if (dbType === 'mysql') {
      const client = new MySQLClient({ datasources: { db: { url } } })
      try {
        // 尝试连接
        await client.$connect()
        // 如果数据库不存在则创建
        await client.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
        await client.$disconnect()
      } catch (e) {
        throw new Error(`Failed to connect to MySQL: ${e instanceof Error ? e.message : e}`)
      }

      // 连接到新数据库
      const dbUrl = `mysql://${encodedUser}:${encodedPassword}@${dbHost}:${resolvedDbPort}/${encodedDbName}`
      const dbClient = new MySQLClient({ datasources: { db: { url: dbUrl } } })
      await dbClient.$connect()

      // 执行 DDL
      await dbClient.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS users (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            nickname VARCHAR(100) NOT NULL,
            created_at INT UNSIGNED NOT NULL DEFAULT 0,
            updated_at INT UNSIGNED NOT NULL DEFAULT 0
        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
      `)
      await dbClient.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS shares (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            slug VARCHAR(32) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            left_content MEDIUMTEXT NOT NULL,
            right_content MEDIUMTEXT NOT NULL,
            hidden TINYINT (1) NOT NULL DEFAULT 0,
            password_hash VARCHAR(255) NULL DEFAULT NULL,
            expires_at INT UNSIGNED NULL DEFAULT NULL,
            created_at INT UNSIGNED NOT NULL DEFAULT 0,
            updated_at INT UNSIGNED NOT NULL DEFAULT 0,
            deleted_at INT UNSIGNED NULL DEFAULT NULL,
            CONSTRAINT fk_shares_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
      `)
      // 创建索引
      await dbClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares (user_id);`)
      await dbClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares (expires_at);`)
      await dbClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_shares_deleted_at ON shares (deleted_at);`)

      // 插入管理员用户
      await dbClient.$executeRawUnsafe(`
        INSERT INTO users (username, email, password_hash, nickname, created_at, updated_at)
        VALUES ('${adminUsername}', '${adminEmail}', '${adminPasswordHash}', '${adminNickname}', UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
      `)

      await dbClient.$disconnect()
    } else if (dbType === 'postgresql') {
      // PostgreSQL
      const client = new PGClient({ datasources: { db: { url } } })
      try {
        await client.$connect()
        // 检查数据库是否存在
        type PgDatabaseQueryResult = Array<Record<string, unknown>>
        const result = (await client.$queryRawUnsafe(
          `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`
        )) as PgDatabaseQueryResult
        if (result.length === 0) {
          await client.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`)
        }
        await client.$disconnect()
      } catch (e) {
        // 忽略数据库已存在或连接失败的错误（如果是关键错误会在后续失败）
        // 实际上，如果连接失败，我们应该抛出错误
        if (!String(e).includes('already exists')) {
          // throw new Error(`Failed to connect to Postgres: ${e}`)
          // 如果无法连接到 'postgres' 数据库，也许可以直接连接到目标数据库（如果存在）
        }
      }

      // 连接到目标数据库
      const dbUrl = `postgresql://${encodedUser}:${encodedPassword}@${dbHost}:${resolvedDbPort}/${encodedDbName}`
      const dbClient = new PGClient({ datasources: { db: { url: dbUrl } } })
      await dbClient.$connect()

      // 执行 PostgreSQL DDL
      await dbClient.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            nickname VARCHAR(100) NOT NULL,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        );
      `)
      await dbClient.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS shares (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            slug VARCHAR(32) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            left_content TEXT NOT NULL,
            right_content TEXT NOT NULL,
            hidden BOOLEAN NOT NULL DEFAULT FALSE,
            password_hash VARCHAR(255) NULL DEFAULT NULL,
            expires_at INTEGER NULL DEFAULT NULL,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            deleted_at INTEGER NULL DEFAULT NULL,
            CONSTRAINT fk_shares_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `)
      // 索引
      await dbClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares (user_id);`)
      await dbClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares (expires_at);`)
      await dbClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_shares_deleted_at ON shares (deleted_at);`)

      // 插入管理员用户
      await dbClient.$executeRawUnsafe(`
        INSERT INTO users (username, email, password_hash, nickname, created_at, updated_at)
        VALUES ('${adminUsername}', '${adminEmail}', '${adminPasswordHash}', '${adminNickname}', CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER), CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER))
      `)

      await dbClient.$disconnect()
    } else if (dbType === 'mssql') {
      // SQL Server
      const client = new MSSQLClient({ datasources: { db: { url } } })
      try {
        await client.$connect()
        await client.$executeRawUnsafe(`
          IF DB_ID('${dbName}') IS NULL
          BEGIN
            CREATE DATABASE [${dbName}]
          END;
        `)
        await client.$disconnect()
      } catch (e) {
        throw new Error(`Failed to connect to MSSQL: ${e instanceof Error ? e.message : e}`)
      }

      const dbUrl = `sqlserver://${dbHost}:${resolvedDbPort};database=${encodedDbName};user=${encodedUser};password=${encodedPassword};encrypt=true;trustServerCertificate=true`
      const dbClient = new MSSQLClient({ datasources: { db: { url: dbUrl } } })
      await dbClient.$connect()

      await dbClient.$executeRawUnsafe(`
        IF OBJECT_ID('dbo.users', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.users (
            id INT IDENTITY(1, 1) PRIMARY KEY,
            username NVARCHAR(50) NOT NULL UNIQUE,
            email NVARCHAR(255) NOT NULL UNIQUE,
            password_hash NVARCHAR(255) NOT NULL,
            nickname NVARCHAR(100) NOT NULL,
            created_at INT NOT NULL DEFAULT 0,
            updated_at INT NOT NULL DEFAULT 0
          )
        END;
      `)
      await dbClient.$executeRawUnsafe(`
        IF OBJECT_ID('dbo.shares', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.shares (
            id INT IDENTITY(1, 1) PRIMARY KEY,
            user_id INT NOT NULL,
            slug NVARCHAR(32) NOT NULL UNIQUE,
            title NVARCHAR(255) NOT NULL,
            left_content NVARCHAR(MAX) NOT NULL,
            right_content NVARCHAR(MAX) NOT NULL,
            hidden BIT NOT NULL DEFAULT 0,
            password_hash NVARCHAR(255) NULL DEFAULT NULL,
            expires_at INT NULL DEFAULT NULL,
            created_at INT NOT NULL DEFAULT 0,
            updated_at INT NOT NULL DEFAULT 0,
            deleted_at INT NULL DEFAULT NULL,
            CONSTRAINT fk_shares_user FOREIGN KEY (user_id) REFERENCES dbo.users (id) ON DELETE CASCADE
          )
        END;
      `)
      await dbClient.$executeRawUnsafe(`
        IF NOT EXISTS (
          SELECT name FROM sys.indexes WHERE name = 'idx_shares_user_id' AND object_id = OBJECT_ID('dbo.shares')
        )
        BEGIN
          CREATE INDEX idx_shares_user_id ON dbo.shares (user_id)
        END;
      `)
      await dbClient.$executeRawUnsafe(`
        IF NOT EXISTS (
          SELECT name FROM sys.indexes WHERE name = 'idx_shares_expires_at' AND object_id = OBJECT_ID('dbo.shares')
        )
        BEGIN
          CREATE INDEX idx_shares_expires_at ON dbo.shares (expires_at)
        END;
      `)
      await dbClient.$executeRawUnsafe(`
        IF NOT EXISTS (
          SELECT name FROM sys.indexes WHERE name = 'idx_shares_deleted_at' AND object_id = OBJECT_ID('dbo.shares')
        )
        BEGIN
          CREATE INDEX idx_shares_deleted_at ON dbo.shares (deleted_at)
        END;
      `)

      await dbClient.$executeRawUnsafe(`
        INSERT INTO dbo.users (username, email, password_hash, nickname, created_at, updated_at)
        VALUES (N'${adminUsername}', N'${adminEmail}', N'${adminPasswordHash}', N'${adminNickname}', DATEDIFF(SECOND, '1970-01-01', SYSUTCDATETIME()), DATEDIFF(SECOND, '1970-01-01', SYSUTCDATETIME()))
      `)

      await dbClient.$disconnect()
    }

    // 2. 写入 .env 文件
    const envContent = `
      NODE_ENV=production
      PORT=${env.PORT}
      DB_TYPE=${dbType}
      DB_HOST=${dbHost}
      DB_PORT=${resolvedDbPort}
      DB_NAME=${dbName}
      DB_USER=${dbUser}
      DB_PASSWORD=${dbPassword}
      JWT_SECRET=${jwtSecret}
      TOKEN_EXPIRES_IN=7d
      FRONTEND_ORIGIN=${env.FRONTEND_ORIGIN}
      SHARE_BASE_URL=${env.SHARE_BASE_URL}
    `.trim()

    await writeFile(resolve(process.cwd(), 'server/.env'), envContent)

    // 3. 重新加载环境变量并初始化数据库
    reloadEnv()
    initDb()

    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: error instanceof Error ? error.message : 'Installation failed' }, 500)
  }
})

export default router
