import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import type { RowDataPacket } from 'mysql2/promise'
import mysql from 'mysql2/promise'
import { env } from '../src/env'

const gzipAsync = promisify(gzip)

const resolveBackupDir = () => {
  const dir = env.DB_BACKUP_DIR ?? 'server/backups'
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir)
}

export const exportData = async () => {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  })

  let serialized = '{}'

  try {
    const [tables] = await connection.query<RowDataPacket[]>(`SHOW TABLES`)
    if (!tables.length) {
      console.log('⚠️ 数据库中没有可导出的表')
      return
    }

    const tableNames = tables.map((row) => row[Object.keys(row)[0]] as string)
    const data: Record<string, unknown[]> = {}

    for (const table of tableNames) {
      const [rows] = await connection.query<RowDataPacket[]>(`SELECT *
                                                                    FROM \`${table}\``)
      data[table] = rows
    }

    serialized = JSON.stringify(data, null, 2)
  } finally {
    await connection.end()
  }

  const compressed = await gzipAsync(serialized)
  const backupDir = resolveBackupDir()
  await fs.mkdir(backupDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(backupDir, `backup-${timestamp}.json.gz`)
  await fs.writeFile(filePath, compressed)

  console.log(`✅ 数据已导出到 ${filePath}`)
}

if (import.meta.main) {
  exportData().catch((error) => {
    console.error('❌ 数据导出失败', error)
    process.exitCode = 1
  })
}
