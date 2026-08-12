import { randomUUID } from 'node:crypto';

import { config } from '../config.js';
import { AppError } from '../errors.js';
import { generateColoredTextPng } from './colored-text.generator.js';
import {
  findOwnedImage,
  insertGeneratedImage,
  markGeneratedImageFailed,
  markGeneratedImageReady,
} from './image.repository.js';
import type { GenerateImageInput } from './image.schemas.js';
import { deleteImageObject, getImageObject, putImageObject } from './image.storage.js';
import { toPublicImage, type PublicImage } from './image.types.js';

export async function generateImage(
  userId: string,
  sourceImageId: string,
  settings: GenerateImageInput,
): Promise<PublicImage> {
  const sourceImage = await findOwnedImage(sourceImageId, userId);
  if (!sourceImage) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image was not found.');
  if (sourceImage.kind !== 'UPLOADED') {
    throw new AppError(409, 'INVALID_SOURCE_IMAGE', 'Only uploaded images can be generated.');
  }
  if (sourceImage.status !== 'READY' || !sourceImage.width || !sourceImage.height) {
    throw new AppError(409, 'IMAGE_NOT_READY', 'Source image is not ready for generation.');
  }

  calculateComplexityBeforeInsert(sourceImage.width, sourceImage.height, settings.columns);

  const generatedImageId = randomUUID();
  const bucket = config.minio.bucket;
  const objectKey = `users/${userId}/generated/${generatedImageId}/colored-text.png`;
  const storedSettings = {
    ...settings,
    cellWidth: config.generation.cellWidth,
    cellHeight: config.generation.cellHeight,
  };

  await insertGeneratedImage({
    id: generatedImageId,
    userId,
    parentImageId: sourceImage.id,
    objectKey,
    bucket,
    settings: storedSettings,
  });

  let outputStored = false;
  try {
    const source = await getImageObject(sourceImage.bucket, sourceImage.objectKey);
    const generated = await generateColoredTextPng(source, settings);
    await putImageObject({
      bucket,
      objectKey,
      body: generated.buffer,
      mimeType: 'image/png',
      userId,
      imageId: generatedImageId,
    });
    outputStored = true;

    const readyImage = await markGeneratedImageReady({
      id: generatedImageId,
      userId,
      sizeBytes: generated.buffer.length,
      width: generated.width,
      height: generated.height,
    });
    if (!readyImage) {
      throw new Error('Generated image record disappeared before completion.');
    }

    return toPublicImage(readyImage);
  } catch (error) {
    if (outputStored) {
      try {
        await deleteImageObject(bucket, objectKey);
      } catch (cleanupError) {
        console.error('Failed to roll back generated MinIO object', { objectKey, cleanupError });
      }
    }

    try {
      await markGeneratedImageFailed(
        generatedImageId,
        userId,
        'Image generation failed. Retry from the source image.',
      );
    } catch (statusError) {
      console.error('Failed to persist generated image failure status', {
        generatedImageId,
        statusError,
      });
    }
    console.error('Image generation failed', { sourceImageId, generatedImageId, error });
    throw new AppError(500, 'IMAGE_GENERATION_FAILED', 'Image generation failed.');
  }
}

function calculateComplexityBeforeInsert(width: number, height: number, columns: number): void {
  const rows = Math.max(
    1,
    Math.round(
      (height / width) * columns * (config.generation.cellWidth / config.generation.cellHeight),
    ),
  );
  if (columns * rows > config.generation.maxGlyphs) {
    throw new AppError(
      422,
      'GENERATION_TOO_COMPLEX',
      `Generation would exceed the ${config.generation.maxGlyphs} glyph limit.`,
    );
  }
}
