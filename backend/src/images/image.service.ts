import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';

import { fileTypeFromBuffer } from 'file-type';
import sharp, { type Metadata } from 'sharp';

import { config } from '../config.js';
import { AppError } from '../errors.js';
import { database } from '../infrastructure.js';
import {
  deleteOwnedImageRow,
  findOwnedImage,
  insertUploadedImage,
  listOwnedImages,
  lockOwnedImageTree,
  type ImageListFilters,
} from './image.repository.js';
import {
  createImageDownloadUrl,
  deleteImageObject,
  deleteImageObjects,
  putImageObject,
} from './image.storage.js';
import { toPublicImage, type PublicImage } from './image.types.js';

const supportedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function sanitizeOriginalName(value: string): string {
  const normalized = Array.from(basename(value.replaceAll('\\', '/')).normalize('NFC'))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join('')
    .trim();
  return (normalized || 'image').slice(0, 255);
}

function encodeCursor(image: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: image.createdAt.toISOString(), id: image.id }),
  ).toString('base64url');
}

export function decodeImageCursor(cursor: string): NonNullable<ImageListFilters['cursor']> {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt?: unknown;
      id?: unknown;
    };
    const createdAt = new Date(typeof decoded.createdAt === 'string' ? decoded.createdAt : '');

    if (
      Number.isNaN(createdAt.getTime()) ||
      typeof decoded.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.id)
    ) {
      throw new Error('Invalid cursor content.');
    }

    return { createdAt, id: decoded.id };
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Pagination cursor is invalid.');
  }
}

export async function uploadImage(userId: string, file: Express.Multer.File | undefined) {
  if (!file) throw new AppError(400, 'IMAGE_FILE_REQUIRED', 'Multipart field "file" is required.');

  const detected = await fileTypeFromBuffer(file.buffer);
  const extension = detected ? supportedTypes.get(detected.mime) : undefined;
  if (!detected || !extension) {
    throw new AppError(
      415,
      'UNSUPPORTED_IMAGE_TYPE',
      'Only JPEG, PNG and WebP images are supported.',
    );
  }
  if (file.mimetype !== detected.mime) {
    throw new AppError(
      415,
      'MIME_TYPE_MISMATCH',
      'Declared MIME type does not match file content.',
    );
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(file.buffer, {
      failOn: 'error',
      limitInputPixels: config.upload.maxPixels,
    }).metadata();
  } catch {
    throw new AppError(
      422,
      'INVALID_IMAGE',
      'The uploaded image is invalid or exceeds pixel limits.',
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new AppError(
      422,
      'INVALID_IMAGE_DIMENSIONS',
      'Image dimensions could not be determined.',
    );
  }

  const imageId = randomUUID();
  const objectKey = `users/${userId}/uploads/${imageId}/source.${extension}`;
  const bucket = config.minio.bucket;

  await putImageObject({
    bucket,
    objectKey,
    body: file.buffer,
    mimeType: detected.mime,
    userId,
    imageId,
  });

  try {
    const image = await insertUploadedImage({
      id: imageId,
      userId,
      originalName: sanitizeOriginalName(file.originalname),
      objectKey,
      bucket,
      mimeType: detected.mime,
      sizeBytes: file.size,
      width: metadata.width,
      height: metadata.height,
    });
    return toPublicImage(image);
  } catch (error) {
    try {
      await deleteImageObject(bucket, objectKey);
    } catch (cleanupError) {
      console.error('Failed to roll back uploaded MinIO object', { objectKey, cleanupError });
    }
    throw error;
  }
}

export async function getImage(userId: string, imageId: string): Promise<PublicImage> {
  const image = await findOwnedImage(imageId, userId);
  if (!image) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image was not found.');
  return toPublicImage(image);
}

export async function getImages(
  userId: string,
  filters: ImageListFilters,
): Promise<{ items: PublicImage[]; nextCursor: string | null }> {
  const rows = await listOwnedImages(userId, filters);
  const hasNextPage = rows.length > filters.limit;
  const page = hasNextPage ? rows.slice(0, filters.limit) : rows;
  const lastImage = page.at(-1);

  return {
    items: page.map(toPublicImage),
    nextCursor: hasNextPage && lastImage ? encodeCursor(lastImage) : null,
  };
}

export async function getImageUrl(
  userId: string,
  imageId: string,
): Promise<{ url: string; expiresIn: number }> {
  const image = await findOwnedImage(imageId, userId);
  if (!image) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image was not found.');
  if (image.status !== 'READY') {
    throw new AppError(409, 'IMAGE_NOT_READY', 'Image is not ready for download.');
  }

  return {
    url: await createImageDownloadUrl(image.bucket, image.objectKey),
    expiresIn: config.minio.presignedUrlTtlSeconds,
  };
}

export async function deleteImage(userId: string, imageId: string): Promise<void> {
  const client = await database.connect();

  try {
    await client.query('BEGIN');
    const images = await lockOwnedImageTree(client, imageId, userId);
    if (images.length === 0) {
      throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image was not found.');
    }

    await deleteImageObjects(images);
    await deleteOwnedImageRow(client, imageId, userId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
