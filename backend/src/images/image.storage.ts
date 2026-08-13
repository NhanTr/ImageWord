import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { config } from '../config.js';
import { objectStorage, publicObjectStorage } from '../infrastructure.js';

export async function putImageObject(input: {
  bucket: string;
  objectKey: string;
  body: Buffer;
  mimeType: string;
  userId: string;
  imageId: string;
}): Promise<void> {
  await objectStorage.send(
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.objectKey,
      Body: input.body,
      ContentType: input.mimeType,
      Metadata: { userId: input.userId, imageId: input.imageId },
    }),
  );
}

export async function deleteImageObject(bucket: string, objectKey: string): Promise<void> {
  await objectStorage.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}

export async function deleteImageObjects(
  objects: Array<{ bucket: string; objectKey: string }>,
): Promise<void> {
  const byBucket = new Map<string, Array<{ bucket: string; objectKey: string }>>();
  for (const object of objects) {
    const bucketObjects = byBucket.get(object.bucket) ?? [];
    bucketObjects.push(object);
    byBucket.set(object.bucket, bucketObjects);
  }

  for (const [bucket, bucketObjects] of byBucket) {
    for (let start = 0; start < bucketObjects.length; start += 1_000) {
      const batch = bucketObjects.slice(start, start + 1_000);
      const result = await objectStorage.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((object) => ({ Key: object.objectKey })), Quiet: true },
        }),
      );

      if (result.Errors && result.Errors.length > 0) {
        throw new Error(`MinIO failed to delete ${result.Errors.length} object(s).`);
      }
    }
  }
}

export async function createImageDownloadUrl(bucket: string, objectKey: string): Promise<string> {
  return getSignedUrl(
    publicObjectStorage,
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    {
      expiresIn: config.minio.presignedUrlTtlSeconds,
    },
  );
}
