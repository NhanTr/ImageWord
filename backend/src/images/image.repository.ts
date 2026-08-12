import type { PoolClient, QueryResultRow } from 'pg';

import { database } from '../infrastructure.js';
import type { ImageKind, ImageRecord, ImageStatus } from './image.types.js';

interface ImageRow extends QueryResultRow {
  id: string;
  user_id: string;
  parent_image_id: string | null;
  kind: ImageKind;
  status: ImageStatus;
  original_name: string | null;
  object_key: string;
  bucket: string;
  mime_type: string;
  size_bytes: string;
  width: number | null;
  height: number | null;
  settings: Record<string, unknown>;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

const imageColumns = `
  id, user_id, parent_image_id, kind, status, original_name, object_key, bucket,
  mime_type, size_bytes, width, height, settings, error_message, created_at, updated_at
`;

function mapImage(row: ImageRow): ImageRecord {
  return {
    id: row.id,
    userId: row.user_id,
    parentImageId: row.parent_image_id,
    kind: row.kind,
    status: row.status,
    originalName: row.original_name,
    objectKey: row.object_key,
    bucket: row.bucket,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    width: row.width,
    height: row.height,
    settings: row.settings,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertUploadedImage(input: {
  id: string;
  userId: string;
  originalName: string;
  objectKey: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}): Promise<ImageRecord> {
  const result = await database.query<ImageRow>(
    `
      INSERT INTO images (
        id, user_id, kind, status, original_name, object_key, bucket,
        mime_type, size_bytes, width, height, settings
      )
      VALUES ($1, $2, 'UPLOADED', 'READY', $3, $4, $5, $6, $7, $8, $9, '{}')
      RETURNING ${imageColumns}
    `,
    [
      input.id,
      input.userId,
      input.originalName,
      input.objectKey,
      input.bucket,
      input.mimeType,
      input.sizeBytes,
      input.width,
      input.height,
    ],
  );

  const row = result.rows[0];
  if (!row) throw new Error('Image insert did not return a row.');
  return mapImage(row);
}

export async function findOwnedImage(imageId: string, userId: string): Promise<ImageRecord | null> {
  const result = await database.query<ImageRow>(
    `SELECT ${imageColumns} FROM images WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [imageId, userId],
  );
  return result.rows[0] ? mapImage(result.rows[0]) : null;
}

export interface ImageListFilters {
  limit: number;
  kind?: ImageKind;
  status?: ImageStatus;
  cursor?: { createdAt: Date; id: string };
}

export async function listOwnedImages(
  userId: string,
  filters: ImageListFilters,
): Promise<ImageRecord[]> {
  const values: unknown[] = [userId];
  const conditions = ['user_id = $1'];

  if (filters.kind) {
    values.push(filters.kind);
    conditions.push(`kind = $${values.length}`);
  }
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }
  if (filters.cursor) {
    values.push(filters.cursor.createdAt, filters.cursor.id);
    conditions.push(`(created_at, id) < ($${values.length - 1}, $${values.length})`);
  }

  values.push(filters.limit + 1);
  const result = await database.query<ImageRow>(
    `
      SELECT ${imageColumns}
      FROM images
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT $${values.length}
    `,
    values,
  );
  return result.rows.map(mapImage);
}

export async function lockOwnedImageTree(
  client: PoolClient,
  imageId: string,
  userId: string,
): Promise<Array<{ id: string; bucket: string; objectKey: string }>> {
  const result = await client.query<{ id: string; bucket: string; object_key: string }>(
    `
      WITH RECURSIVE image_tree AS (
        SELECT id, bucket, object_key
        FROM images
        WHERE id = $1 AND user_id = $2
        UNION ALL
        SELECT child.id, child.bucket, child.object_key
        FROM images child
        INNER JOIN image_tree parent ON child.parent_image_id = parent.id
        WHERE child.user_id = $2
      )
      SELECT image.id, image.bucket, image.object_key
      FROM images image
      INNER JOIN image_tree tree ON tree.id = image.id
      FOR UPDATE OF image
    `,
    [imageId, userId],
  );

  return result.rows.map((row) => ({ id: row.id, bucket: row.bucket, objectKey: row.object_key }));
}

export async function deleteOwnedImageRow(
  client: PoolClient,
  imageId: string,
  userId: string,
): Promise<void> {
  await client.query('DELETE FROM images WHERE id = $1 AND user_id = $2', [imageId, userId]);
}
