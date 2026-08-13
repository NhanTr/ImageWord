import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';
import { createClient } from 'redis';

import { config } from './config.js';

export const database = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export const redis = createClient({
  url: config.redisUrl,
});

redis.on('error', (error: Error) => {
  console.error('Redis client error', error.message);
});

export const objectStorage = new S3Client({
  endpoint: config.minio.endpoint,
  region: config.minio.region,
  forcePathStyle: config.minio.forcePathStyle,
  credentials: {
    accessKeyId: config.minio.accessKeyId,
    secretAccessKey: config.minio.secretAccessKey,
  },
});

export const publicObjectStorage = new S3Client({
  endpoint: config.minio.publicEndpoint,
  region: config.minio.region,
  forcePathStyle: config.minio.forcePathStyle,
  credentials: {
    accessKeyId: config.minio.accessKeyId,
    secretAccessKey: config.minio.secretAccessKey,
  },
});

export async function connectInfrastructure(): Promise<void> {
  await database.query('SELECT 1');

  if (!redis.isOpen) {
    await redis.connect();
  }

  await objectStorage.send(new HeadBucketCommand({ Bucket: config.minio.bucket }));
}

export async function checkInfrastructure(): Promise<void> {
  await Promise.all([
    database.query('SELECT 1'),
    redis.ping(),
    objectStorage.send(new HeadBucketCommand({ Bucket: config.minio.bucket })),
  ]);
}

export async function closeInfrastructure(): Promise<void> {
  await Promise.allSettled([database.end(), redis.isOpen ? redis.quit() : Promise.resolve()]);
  objectStorage.destroy();
  publicObjectStorage.destroy();
}
