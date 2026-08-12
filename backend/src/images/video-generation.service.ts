import { randomUUID } from 'node:crypto';

import { config } from '../config.js';
import { AppError } from '../errors.js';
import { generateAnimatedTextVideo } from './animated-text-video.generator.js';
import {
  findOwnedImage,
  insertGeneratedImage,
  markGeneratedImageFailed,
  markGeneratedImageReady,
} from './image.repository.js';
import type { GenerateVideoInput } from './image.schemas.js';
import { deleteImageObject, getImageObject, putImageObject } from './image.storage.js';
import { toPublicImage, type PublicImage } from './image.types.js';

export async function generateVideo(
  userId: string,
  sourceImageId: string,
  settings: GenerateVideoInput,
): Promise<PublicImage> {
  const sourceImage = await findOwnedImage(sourceImageId, userId);
  if (!sourceImage) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image was not found.');
  if (sourceImage.kind !== 'UPLOADED') {
    throw new AppError(409, 'INVALID_SOURCE_IMAGE', 'Only uploaded images can generate video.');
  }
  if (sourceImage.status !== 'READY') {
    throw new AppError(409, 'IMAGE_NOT_READY', 'Source image is not ready for generation.');
  }

  const generatedId = randomUUID();
  const bucket = config.minio.bucket;
  const objectKey = `users/${userId}/generated/${generatedId}/animated-text.mp4`;
  const storedSettings = {
    ...settings,
    output: 'video',
    animation: 'row-major-reveal',
    fps: config.video.fps,
    holdSeconds: config.video.holdSeconds,
    cellWidth: config.generation.cellWidth,
    cellHeight: config.generation.cellHeight,
  };

  await insertGeneratedImage({
    id: generatedId,
    userId,
    parentImageId: sourceImage.id,
    objectKey,
    bucket,
    mimeType: 'video/mp4',
    settings: storedSettings,
  });

  let outputStored = false;
  try {
    const source = await getImageObject(sourceImage.bucket, sourceImage.objectKey);
    const generated = await generateAnimatedTextVideo(source, settings);
    await putImageObject({
      bucket,
      objectKey,
      body: generated.buffer,
      mimeType: 'video/mp4',
      userId,
      imageId: generatedId,
    });
    outputStored = true;
    const ready = await markGeneratedImageReady({
      id: generatedId,
      userId,
      sizeBytes: generated.buffer.length,
      width: generated.width,
      height: generated.height,
    });
    if (!ready) throw new Error('Generated video record disappeared before completion.');
    return toPublicImage(ready);
  } catch (error) {
    if (outputStored) {
      try {
        await deleteImageObject(bucket, objectKey);
      } catch (cleanupError) {
        console.error('Failed to roll back generated video object', { objectKey, cleanupError });
      }
    }
    try {
      await markGeneratedImageFailed(
        generatedId,
        userId,
        'Video generation failed. Retry from the source image.',
      );
    } catch (statusError) {
      console.error('Failed to persist generated video failure status', {
        generatedId,
        statusError,
      });
    }
    console.error('Video generation failed', { sourceImageId, generatedId, error });
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'VIDEO_GENERATION_FAILED', 'Video generation failed.');
  }
}
