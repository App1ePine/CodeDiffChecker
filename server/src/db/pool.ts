import mariadb from 'mariadb';
import { appConfig } from '../config/env';

export const pool = mariadb.createPool({
  host: appConfig.db.host,
  port: appConfig.db.port,
  user: appConfig.db.user,
  password: appConfig.db.password,
  database: appConfig.db.database,
  connectionLimit: 5
});

export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(sql, params);
    if (Array.isArray(result)) {
      return result as T[];
    }
    return [];
  } finally {
    conn.release();
  }
}

export async function execute(sql: string, params: unknown[] = []) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(sql, params);
    return result;
  } finally {
    conn.release();
  }
}
