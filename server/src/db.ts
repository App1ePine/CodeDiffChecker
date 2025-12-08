import { env, isInstalled } from './env'
import { PrismaClient as MSSQLClient } from './generated/client-mssql'
import { PrismaClient as MySQLClient } from './generated/client-mysql'
import { PrismaClient as PGClient } from './generated/client-pg'

type DbClient = Pick<MySQLClient, 'user' | 'share'> &
  Pick<PGClient, 'user' | 'share'> &
  Pick<MSSQLClient, 'user' | 'share'>

let db: DbClient | null = null

export const initDb = () => {
  if (isInstalled && env.DB_TYPE) {
    const encodedUser = encodeURIComponent(env.DB_USER ?? '')
    const encodedPassword = encodeURIComponent(env.DB_PASSWORD ?? '')
    const encodedDbName = encodeURIComponent(env.DB_NAME ?? '')
    let url = ''
    if (env.DB_TYPE === 'mysql') {
      url = `mysql://${encodedUser}:${encodedPassword}@${env.DB_HOST}:${env.DB_PORT}/${encodedDbName}`
    } else if (env.DB_TYPE === 'postgresql') {
      url = `postgresql://${encodedUser}:${encodedPassword}@${env.DB_HOST}:${env.DB_PORT}/${encodedDbName}`
    } else {
      url = `sqlserver://${env.DB_HOST}:${env.DB_PORT};database=${encodedDbName};user=${encodedUser};password=${encodedPassword};encrypt=true;trustServerCertificate=true`
    }

    if (env.DB_TYPE === 'mysql') {
      db = new MySQLClient({
        datasources: {
          db: {
            url,
          },
        },
      }) as unknown as DbClient
    } else if (env.DB_TYPE === 'postgresql') {
      db = new PGClient({
        datasources: {
          db: {
            url,
          },
        },
      }) as unknown as DbClient
    } else {
      db = new MSSQLClient({
        datasources: {
          db: {
            url,
          },
        },
      }) as unknown as DbClient
    }
  }
}

initDb()

export const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized or not installed')
  }
  return db
}
