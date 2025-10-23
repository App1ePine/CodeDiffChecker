import type { PoolOptions } from 'mysql2'
import mysql from 'mysql2/promise'
import { env } from './env'

const options: PoolOptions = {
	host: env.DB_HOST,
	port: env.DB_PORT,
	user: env.DB_USER,
	password: env.DB_PASSWORD,
	database: env.DB_NAME,
	waitForConnections: true,
	connectionLimit: 10,
	namedPlaceholders: true,
	timezone: 'Z',
}

export const pool = mysql.createPool(options)

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
	const [rows] = await pool.query(sql, params)
	return rows as T[]
}

export async function queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
	const rows = await query<T>(sql, params)
	return rows.length > 0 ? rows[0]! : null
}
