import type { PoolConnection } from 'mariadb';
import { execute, pool, query } from './pool';

export type UserRecord = {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
};

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const rows = await query<UserRecord>(
    'SELECT id, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<number> {
  const result = await execute(
    'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, NOW())',
    [email, passwordHash]
  );
  const insertId = typeof result.insertId === 'bigint' ? Number(result.insertId) : result.insertId;
  return insertId as number;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const rows = await query<UserRecord>(
    'SELECT id, email, password_hash, created_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

export async function withTransaction<T>(handler: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
