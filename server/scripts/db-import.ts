import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { gunzip } from 'node:zlib'
import mysql from 'mysql2/promise'
import { env } from '../src/env'

const gunzipAsync = promisify(gunzip)

const resolveFilePath = (input?: string) => {
  if (!input) {
    throw new Error('请在命令后附带备份文件路径，例如：yarn db:import server/backups/backup-2024-01-01.json.gz')
  }
  return path.isAbsolute(input) ? input : path.resolve(process.cwd(), input)
}

export const importData = async (targetPath?: string) => {
  const resolvedPath = resolveFilePath(targetPath)
  const buffer = await fs.readFile(resolvedPath)
  const json = await gunzipAsync(buffer)
  const payload = JSON.parse(json.toString('utf-8')) as Record<string, unknown[]>
  const tables = Object.keys(payload).sort()

  if (!tables.length) {
    console.log('⚠️ 备份文件不包含任何表数据')
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
    await connection.beginTransaction()
    await connection.query('SET FOREIGN_KEY_CHECKS=0')

    for (const table of tables) {
      await connection.query(`TRUNCATE TABLE \`${table}\``)
    }

    for (const table of tables) {
      const rows = payload[table]
      if (!Array.isArray(rows) || rows.length === 0) continue

      const normalizedRows = rows.map((row) => {
        if (typeof row !== 'object' || row === null) {
          throw new Error(`表 ${table} 的数据格式不正确`)
        }
        return row as Record<string, unknown>
      })

      const columns = Object.keys(normalizedRows[0] as Record<string, unknown>)
      if (columns.length === 0) continue
      const columnList = columns.map((column) => `\`${column}\``).join(', ')
      const placeholders = columns.map(() => '?').join(', ')
      const sql = `INSERT INTO \`${table}\` (${columnList})
                         VALUES (${placeholders})`

      for (const row of normalizedRows) {
        const values = columns.map((column) => row[column])
        await connection.query(sql, values)
      }
    }

    await connection.commit()
    console.log(`✅ 数据已从 ${resolvedPath} 导入完成`)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS=1')
    await connection.end()
  }
}

if (import.meta.main) {
  const [, , filePath] = process.argv
  importData(filePath).catch((error) => {
    console.error('❌ 数据导入失败', error)
    process.exitCode = 1
  })
}
