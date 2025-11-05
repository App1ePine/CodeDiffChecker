import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import {env} from '../src/env'
import {createDatabase} from './db-create'

const INIT_SQL_PATH = path.resolve(process.cwd(), 'server/sql/init.sql')

export const initializeDatabase = async () => {
    await createDatabase()

    if (!fs.existsSync(INIT_SQL_PATH)) {
        throw new Error('未找到 server/sql/init.sql，无法继续初始化')
    }

    const initSql = fs.readFileSync(INIT_SQL_PATH, 'utf-8').trim()
    if (!initSql) {
        console.log('⚠️ init.sql 为空，跳过数据初始化')
        return
    }

    const connection = await mysql.createConnection({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        multipleStatements: true,
    })

    try {
        console.log('⏳ 正在执行数据库初始化 SQL...')
        await connection.query(initSql)
        console.log('✅ 初始化完成（请尽快修改默认管理员密码）')
    } finally {
        await connection.end()
    }
}

if (import.meta.main) {
    initializeDatabase().catch((error) => {
        console.error('❌ 数据库初始化失败', error)
        process.exitCode = 1
    })
}
