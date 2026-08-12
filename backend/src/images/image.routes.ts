import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors.js';
import { generateImage } from './generation.service.js';
import {
  generateImageSchema,
  generateVideoSchema,
  imageIdSchema,
  imageListQuerySchema,
} from './image.schemas.js';
import {
  decodeImageCursor,
  deleteImage,
  getImage,
  getImages,
  getImageUrl,
  uploadImage,
} from './image.service.js';
import { uploadSingleImage } from './upload.middleware.js';
import { generateVideo } from './video-generation.service.js';

export const imageRouter = Router();

imageRouter.use(requireAuth);

function authenticatedUserId(value: string | undefined): string {
  if (!value) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

imageRouter.post('/', uploadSingleImage, async (request, response) => {
  const userId = authenticatedUserId(request.auth?.userId);
  response.status(201).json({ image: await uploadImage(userId, request.file) });
});

imageRouter.get('/', async (request, response) => {
  const userId = authenticatedUserId(request.auth?.userId);
  const query = imageListQuerySchema.parse(request.query);
  response.status(200).json(
    await getImages(userId, {
      limit: query.limit,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.cursor ? { cursor: decodeImageCursor(query.cursor) } : {}),
    }),
  );
});

imageRouter.post('/:id/generate', async (request, response) => {
  const userId = authenticatedUserId(request.auth?.userId);
  const imageId = imageIdSchema.parse(request.params.id);
  const settings = generateImageSchema.parse(request.body);
  response.status(201).json({ image: await generateImage(userId, imageId, settings) });
});

imageRouter.post('/:id/generate-video', async (request, response) => {
  const userId = authenticatedUserId(request.auth?.userId);
  const imageId = imageIdSchema.parse(request.params.id);
  const settings = generateVideoSchema.parse(request.body);
  response.status(201).json({ image: await generateVideo(userId, imageId, settings) });
});

imageRouter.get('/:id', async (request, response) => {
  const userId = authenticatedUserId(request.auth?.userId);
  const imageId = imageIdSchema.parse(request.params.id);
  response.status(200).json({ image: await getImage(userId, imageId) });
});

imageRouter.get('/:id/url', async (request, response) => {
  const userId = authenticatedUserId(request.auth?.userId);
  const imageId = imageIdSchema.parse(request.params.id);
  response.status(200).json(await getImageUrl(userId, imageId));
});

imageRouter.delete('/:id', async (request, response) => {
  const userId = authenticatedUserId(request.auth?.userId);
  const imageId = imageIdSchema.parse(request.params.id);
  await deleteImage(userId, imageId);
  response.status(204).send();
});
