import type { QueryResultRow } from 'pg';

import { database } from '../infrastructure.js';

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<UserRecord> {
  const result = await database.query<UserRow>(
    `
      INSERT INTO users (email, password_hash, display_name)
      VALUES ($1, $2, $3)
      RETURNING id, email, password_hash, display_name, created_at, updated_at
    `,
    [input.email, input.passwordHash, input.displayName],
  );

  const row = result.rows[0];
  if (!row) throw new Error('User insert did not return a row.');
  return mapUser(row);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await database.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  );

  const row = result.rows[0];
  return row ? mapUser(row) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await database.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  const row = result.rows[0];
  return row ? mapUser(row) : null;
}
