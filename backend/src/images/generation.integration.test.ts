import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import request from 'supertest';

import { createApp } from '../app.js';
import { migrate } from '../database/migrate.js';
import { closeInfrastructure, database, objectStorage, redis } from '../infrastructure.js';
import { deleteImageObject, getImageObject } from './image.storage.js';

const app = createApp();
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'Correct-Horse-42';
const createdUserIds: string[] = [];
const cleanupObjects: Array<{ bucket: string; objectKey: string }> = [];

async function createUser(label: string): Promise<{ userId: string; accessToken: string }> {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: `generation-${label}-${runId}@example.com`,
      password,
      displayName: `Generation ${label}`,
    });
  assert.equal(response.status, 201);
  createdUserIds.push(response.body.user.id);
  return { userId: response.body.user.id, accessToken: response.body.accessToken };
}

async function upload(accessToken: string, buffer: Buffer, name = 'source.png'): Promise<string> {
  const response = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${accessToken}`)
    .attach('file', buffer, { filename: name, contentType: 'image/png' });
  assert.equal(response.status, 201);
  return response.body.image.id;
}

async function storedObject(imageId: string): Promise<{ bucket: string; objectKey: string }> {
  const result = await database.query<{ bucket: string; object_key: string }>(
    'SELECT bucket, object_key FROM images WHERE id = $1',
    [imageId],
  );
  const row = result.rows[0];
  assert.ok(row);
  return { bucket: row.bucket, objectKey: row.object_key };
}

before(async () => {
  await migrate();
  if (!redis.isOpen) await redis.connect();
});

after(async () => {
  for (const object of cleanupObjects) {
    try {
      await deleteImageObject(object.bucket, object.objectKey);
    } catch {
      // Best-effort cleanup after a failed assertion.
    }
  }

  if (createdUserIds.length > 0) {
    await database.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUserIds]);
    for (const userId of createdUserIds) {
      const keys = await redis.keys(`auth:session:${userId}:*`);
      if (keys.length > 0) await redis.del(keys);
    }
  }
  await closeInfrastructure();
});

test('generation creates an owned PNG linked to its uploaded source', async () => {
  const owner = await createUser('owner');
  const stranger = await createUser('stranger');
  const sourceBuffer = await sharp({
    create: { width: 80, height: 40, channels: 3, background: { r: 230, g: 70, b: 30 } },
  })
    .png()
    .toBuffer();
  const sourceId = await upload(owner.accessToken, sourceBuffer);
  cleanupObjects.push(await storedObject(sourceId));

  const strangerAttempt = await request(app)
    .post(`/api/v1/images/${sourceId}/generate`)
    .set('Authorization', `Bearer ${stranger.accessToken}`)
    .send({ columns: 20 });
  assert.equal(strangerAttempt.status, 404);

  const unsafeCharacterSet = await request(app)
    .post(`/api/v1/images/${sourceId}/generate`)
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send({ columns: 20, characterSet: '<script>\n' });
  assert.equal(unsafeCharacterSet.status, 400);

  const generated = await request(app)
    .post(`/api/v1/images/${sourceId}/generate`)
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send({
      columns: 20,
      characterSet: '@. ',
      fontFamily: 'monospace',
      backgroundColor: '#102030',
    });
  assert.equal(generated.status, 201);
  assert.equal(generated.body.image.kind, 'GENERATED');
  assert.equal(generated.body.image.status, 'READY');
  assert.equal(generated.body.image.parentImageId, sourceId);
  assert.equal(generated.body.image.mimeType, 'image/png');
  assert.equal(generated.body.image.width, 160);
  assert.equal(generated.body.image.height, 80);
  assert.equal(generated.body.image.settings.columns, 20);
  assert.equal(generated.body.image.settings.backgroundColor, '#102030');
  assert.equal(generated.body.image.objectKey, undefined);

  const generatedId = generated.body.image.id as string;
  const generatedObject = await storedObject(generatedId);
  cleanupObjects.push(generatedObject);
  assert.match(
    generatedObject.objectKey,
    new RegExp(`^users/${owner.userId}/generated/${generatedId}/colored-text\\.png$`),
  );
  const head = await objectStorage.send(
    new HeadObjectCommand({ Bucket: generatedObject.bucket, Key: generatedObject.objectKey }),
  );
  assert.equal(head.ContentType, 'image/png');
  const outputMetadata = await sharp(
    await getImageObject(generatedObject.bucket, generatedObject.objectKey),
  ).metadata();
  assert.equal(outputMetadata.format, 'png');
  assert.equal(outputMetadata.width, 160);
  assert.equal(outputMetadata.height, 80);

  const generatedAsSource = await request(app)
    .post(`/api/v1/images/${generatedId}/generate`)
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send({ columns: 20 });
  assert.equal(generatedAsSource.status, 409);
  assert.equal(generatedAsSource.body.error.code, 'INVALID_SOURCE_IMAGE');

  const generatedList = await request(app)
    .get('/api/v1/images?kind=GENERATED&status=READY')
    .set('Authorization', `Bearer ${owner.accessToken}`);
  assert.equal(generatedList.status, 200);
  assert.ok(generatedList.body.items.some((image: { id: string }) => image.id === generatedId));

  const deleted = await request(app)
    .delete(`/api/v1/images/${sourceId}`)
    .set('Authorization', `Bearer ${owner.accessToken}`);
  assert.equal(deleted.status, 204);
  const records = await database.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM images WHERE id = ANY($1::uuid[])',
    [[sourceId, generatedId]],
  );
  assert.equal(records.rows[0]?.count, '0');
  await assert.rejects(
    objectStorage.send(
      new HeadObjectCommand({ Bucket: generatedObject.bucket, Key: generatedObject.objectKey }),
    ),
  );
});

test('generation failure is recorded as FAILED without an output object', async () => {
  const owner = await createUser('failure');
  const sourceBuffer = await sharp({
    create: { width: 40, height: 20, channels: 3, background: { r: 20, g: 200, b: 100 } },
  })
    .png()
    .toBuffer();
  const sourceId = await upload(owner.accessToken, sourceBuffer, 'missing-source.png');
  const sourceObject = await storedObject(sourceId);
  await deleteImageObject(sourceObject.bucket, sourceObject.objectKey);

  const response = await request(app)
    .post(`/api/v1/images/${sourceId}/generate`)
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send({ columns: 20 });
  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, 'IMAGE_GENERATION_FAILED');

  const failed = await database.query<{
    id: string;
    bucket: string;
    object_key: string;
    status: string;
    error_message: string | null;
  }>(
    `
      SELECT id, bucket, object_key, status, error_message
      FROM images
      WHERE parent_image_id = $1 AND kind = 'GENERATED'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [sourceId],
  );
  const failedImage = failed.rows[0];
  assert.ok(failedImage);
  assert.equal(failedImage.status, 'FAILED');
  assert.ok(failedImage.error_message);
  await assert.rejects(
    objectStorage.send(
      new HeadObjectCommand({ Bucket: failedImage.bucket, Key: failedImage.object_key }),
    ),
  );

  const deleted = await request(app)
    .delete(`/api/v1/images/${sourceId}`)
    .set('Authorization', `Bearer ${owner.accessToken}`);
  assert.equal(deleted.status, 204);
});
