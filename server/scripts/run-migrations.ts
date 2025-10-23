import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { env } from '../src/env'

async function runMigrations() {
  const migrationsDir = path.resolve(process.cwd(), 'server/migrations')
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  if (migrationFiles.length === 0) {
    console.log('No migrations found.')
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
    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(migrationPath, 'utf-8')
      console.log(`Applying migration: ${file}`)
      await connection.query(sql)
    }

    console.log('All migrations applied successfully.')
  } finally {
    await connection.end()
  }
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error)
  process.exitCode = 1
})
