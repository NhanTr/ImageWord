import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import request from 'supertest';

import { createApp } from '../app.js';
import { config } from '../config.js';
import { migrate } from '../database/migrate.js';
import { closeInfrastructure, database, objectStorage, redis } from '../infrastructure.js';
import { deleteImageObject, putImageObject } from './image.storage.js';

const app = createApp();
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'Correct-Horse-42';
const createdUserIds: string[] = [];
const createdObjects: Array<{ bucket: string; objectKey: string }> = [];
let pngBuffer: Buffer;

async function createAuthenticatedUser(label: string): Promise<{
  userId: string;
  accessToken: string;
}> {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: `images-${label}-${runId}@example.com`,
      password,
      displayName: `Image ${label}`,
    });
  assert.equal(response.status, 201);
  createdUserIds.push(response.body.user.id);
  return { userId: response.body.user.id, accessToken: response.body.accessToken };
}

async function objectKeyFor(imageId: string): Promise<{ bucket: string; objectKey: string }> {
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
  pngBuffer = await sharp({
    create: { width: 3, height: 2, channels: 3, background: { r: 30, g: 140, b: 220 } },
  })
    .png()
    .toBuffer();
});

after(async () => {
  for (const object of createdObjects) {
    try {
      await deleteImageObject(object.bucket, object.objectKey);
    } catch {
      // Best-effort cleanup for test failures.
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

test('upload validates authentication, size, magic bytes and MIME type', async () => {
  const user = await createAuthenticatedUser('validation');

  const noAuthentication = await request(app)
    .post('/api/v1/images')
    .attach('file', pngBuffer, { filename: 'pixel.png', contentType: 'image/png' });
  assert.equal(noAuthentication.status, 401);

  const missingFile = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${user.accessToken}`);
  assert.equal(missingFile.status, 400);
  assert.equal(missingFile.body.error.code, 'IMAGE_FILE_REQUIRED');

  const unsupported = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .attach('file', Buffer.from('not an image'), {
      filename: 'fake.png',
      contentType: 'image/png',
    });
  assert.equal(unsupported.status, 415);
  assert.equal(unsupported.body.error.code, 'UNSUPPORTED_IMAGE_TYPE');

  const mismatch = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .attach('file', pngBuffer, { filename: 'pixel.jpg', contentType: 'image/jpeg' });
  assert.equal(mismatch.status, 415);
  assert.equal(mismatch.body.error.code, 'MIME_TYPE_MISMATCH');

  const tooLarge = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .attach('file', Buffer.alloc(config.upload.maxBytes + 1), {
      filename: 'large.png',
      contentType: 'image/png',
    });
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.body.error.code, 'IMAGE_TOO_LARGE');
});

test('image lifecycle is private, paginated and ownership-scoped', async () => {
  const userA = await createAuthenticatedUser('owner-a');
  const userB = await createAuthenticatedUser('owner-b');

  const firstUpload = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${userA.accessToken}`)
    .attach('file', pngBuffer, { filename: '../first-image.png', contentType: 'image/png' });
  assert.equal(firstUpload.status, 201);
  assert.equal(firstUpload.body.image.kind, 'UPLOADED');
  assert.equal(firstUpload.body.image.status, 'READY');
  assert.equal(firstUpload.body.image.width, 3);
  assert.equal(firstUpload.body.image.height, 2);
  assert.equal(firstUpload.body.image.objectKey, undefined);

  const firstImageId = firstUpload.body.image.id as string;
  const firstObject = await objectKeyFor(firstImageId);
  createdObjects.push(firstObject);
  assert.match(
    firstObject.objectKey,
    new RegExp(`^users/${userA.userId}/uploads/${firstImageId}/`),
  );
  await objectStorage.send(
    new HeadObjectCommand({ Bucket: firstObject.bucket, Key: firstObject.objectKey }),
  );

  const anonymousObject = await fetch(
    `${config.minio.endpoint}/${firstObject.bucket}/${firstObject.objectKey}`,
  );
  assert.equal(anonymousObject.status, 403);

  const secondUpload = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${userA.accessToken}`)
    .attach('file', pngBuffer, { filename: 'second.webp', contentType: 'image/png' });
  assert.equal(secondUpload.status, 201);
  const secondImageId = secondUpload.body.image.id as string;
  const secondObject = await objectKeyFor(secondImageId);
  createdObjects.push(secondObject);

  const firstPage = await request(app)
    .get('/api/v1/images?limit=1&kind=UPLOADED&status=READY')
    .set('Authorization', `Bearer ${userA.accessToken}`);
  assert.equal(firstPage.status, 200);
  assert.equal(firstPage.body.items.length, 1);
  assert.ok(firstPage.body.nextCursor);

  const secondPage = await request(app)
    .get(`/api/v1/images?limit=1&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
    .set('Authorization', `Bearer ${userA.accessToken}`);
  assert.equal(secondPage.status, 200);
  assert.equal(secondPage.body.items.length, 1);
  assert.notEqual(secondPage.body.items[0].id, firstPage.body.items[0].id);

  const invalidCursor = await request(app)
    .get('/api/v1/images?cursor=invalid')
    .set('Authorization', `Bearer ${userA.accessToken}`);
  assert.equal(invalidCursor.status, 400);
  assert.equal(invalidCursor.body.error.code, 'INVALID_CURSOR');

  const userBList = await request(app)
    .get('/api/v1/images')
    .set('Authorization', `Bearer ${userB.accessToken}`);
  assert.equal(userBList.status, 200);
  assert.equal(userBList.body.items.length, 0);

  for (const path of [`/${firstImageId}`, `/${firstImageId}/url`]) {
    const forbiddenRead = await request(app)
      .get(`/api/v1/images${path}`)
      .set('Authorization', `Bearer ${userB.accessToken}`);
    assert.equal(forbiddenRead.status, 404);
  }
  const forbiddenDelete = await request(app)
    .delete(`/api/v1/images/${firstImageId}`)
    .set('Authorization', `Bearer ${userB.accessToken}`);
  assert.equal(forbiddenDelete.status, 404);

  const detail = await request(app)
    .get(`/api/v1/images/${firstImageId}`)
    .set('Authorization', `Bearer ${userA.accessToken}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.image.id, firstImageId);

  const signedUrl = await request(app)
    .get(`/api/v1/images/${firstImageId}/url`)
    .set('Authorization', `Bearer ${userA.accessToken}`);
  assert.equal(signedUrl.status, 200);
  assert.equal(signedUrl.body.expiresIn, config.minio.presignedUrlTtlSeconds);
  const parsedUrl = new URL(signedUrl.body.url);
  assert.equal(parsedUrl.origin, config.minio.publicEndpoint);
  assert.ok(parsedUrl.searchParams.has('X-Amz-Signature'));

  const generatedImageId = crypto.randomUUID();
  const generatedObject = {
    bucket: config.minio.bucket,
    objectKey: `users/${userA.userId}/generated/${generatedImageId}/colored-text.png`,
  };
  await putImageObject({
    ...generatedObject,
    body: pngBuffer,
    mimeType: 'image/png',
    userId: userA.userId,
    imageId: generatedImageId,
  });
  createdObjects.push(generatedObject);
  await database.query(
    `
      INSERT INTO images (
        id, user_id, parent_image_id, kind, status, object_key, bucket,
        mime_type, size_bytes, width, height, settings
      ) VALUES ($1, $2, $3, 'GENERATED', 'READY', $4, $5, 'image/png', $6, 3, 2, '{}')
    `,
    [
      generatedImageId,
      userA.userId,
      firstImageId,
      generatedObject.objectKey,
      generatedObject.bucket,
      pngBuffer.length,
    ],
  );

  const deleted = await request(app)
    .delete(`/api/v1/images/${firstImageId}`)
    .set('Authorization', `Bearer ${userA.accessToken}`);
  assert.equal(deleted.status, 204);

  const remaining = await database.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM images WHERE id = ANY($1::uuid[])',
    [[firstImageId, generatedImageId]],
  );
  assert.equal(remaining.rows[0]?.count, '0');
  await assert.rejects(
    objectStorage.send(
      new HeadObjectCommand({ Bucket: firstObject.bucket, Key: firstObject.objectKey }),
    ),
  );
  await assert.rejects(
    objectStorage.send(
      new HeadObjectCommand({ Bucket: generatedObject.bucket, Key: generatedObject.objectKey }),
    ),
  );

  const deleteSecond = await request(app)
    .delete(`/api/v1/images/${secondImageId}`)
    .set('Authorization', `Bearer ${userA.accessToken}`);
  assert.equal(deleteSecond.status, 204);
});
