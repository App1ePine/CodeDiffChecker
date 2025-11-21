import { env, isInstalled } from './env'
import { PrismaClient as MySQLClient } from './generated/client-mysql'
import { PrismaClient as PGClient } from './generated/client-pg'

type DbClient = MySQLClient | PGClient

let db: DbClient | null = null

export const initDb = () => {
  if (isInstalled && env.DB_TYPE) {
    const url =
      env.DB_TYPE === 'mysql'
        ? `mysql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`
        : `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`

    if (env.DB_TYPE === 'mysql') {
      db = new MySQLClient({
        datasources: {
          db: {
            url,
          },
        },
      })
    } else {
      db = new PGClient({
        datasources: {
          db: {
            url,
          },
        },
      })
    }
  }
}

initDb()

export const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized or not installed')
  }
  // Cast to MySQLClient for TypeScript compatibility since APIs are identical
  return db as unknown as MySQLClient
}
