import mysql from 'mysql2/promise'
import { env } from '../src/env'

const assertAdminConfig = () => {
  const missing: string[] = []
  if (!env.DB_ADMIN_HOST) missing.push('DB_ADMIN_HOST')
  if (!env.DB_ADMIN_PORT) missing.push('DB_ADMIN_PORT')
  if (!env.DB_ADMIN_USER) missing.push('DB_ADMIN_USER')
  if (!env.DB_ADMIN_PASSWORD) missing.push('DB_ADMIN_PASSWORD')

  if (missing.length > 0) {
    throw new Error(`缺少以下数据库管理员配置：${missing.join(', ')}。请在 server/.env.* 中补充。`)
  }
}

const buildConnectionConfig = () => {
  assertAdminConfig()
  return {
    host: env.DB_ADMIN_HOST,
    port: env.DB_ADMIN_PORT,
    user: env.DB_ADMIN_USER,
    password: env.DB_ADMIN_PASSWORD,
    multipleStatements: true,
  }
}

export const createDatabase = async () => {
  const connection = await mysql.createConnection(buildConnectionConfig())

  try {
    const dbName = connection.escapeId(env.DB_NAME)
    console.log(`⏳ 正在创建数据库 ${env.DB_NAME}...`)
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)

    const quotedUser = connection.escape(env.DB_USER)
    const quotedPassword = connection.escape(env.DB_PASSWORD)
    const hosts = ['%', 'localhost']

    for (const host of hosts) {
      const quotedHost = connection.escape(host)
      await connection.query(`CREATE USER IF NOT EXISTS ${quotedUser}@${quotedHost} IDENTIFIED BY ${quotedPassword}`)
      await connection.query(`ALTER USER ${quotedUser}@${quotedHost} IDENTIFIED BY ${quotedPassword}`)
      await connection.query(`GRANT ALL PRIVILEGES ON ${dbName}.* TO ${quotedUser}@${quotedHost}`)
    }

    await connection.query('FLUSH PRIVILEGES')

    console.log(`✅ 数据库 ${env.DB_NAME} 已准备就绪`)
  } finally {
    await connection.end()
  }
}

if (import.meta.main) {
  createDatabase().catch((error) => {
    console.error('❌ 数据库创建失败', error)
    process.exitCode = 1
  })
}
