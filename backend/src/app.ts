import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { authRouter } from './auth/auth.routes.js';
import { AppError } from './errors.js';
import { checkInfrastructure } from './infrastructure.js';
import { imageRouter } from './images/image.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/v1/health/live', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.get('/api/v1/health/ready', async (_request, response) => {
    try {
      await checkInfrastructure();
      response.status(200).json({
        status: 'ready',
        dependencies: ['postgres', 'redis', 'minio'],
      });
    } catch (error) {
      console.error('Readiness check failed', error);
      response.status(503).json({
        status: 'not_ready',
        message: 'One or more dependencies are unavailable.',
      });
    }
  });

  app.get('/api/v1', (_request, response) => {
    response.status(200).json({ name: 'ImageWord API', version: 'v1' });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/images', imageRouter);

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      const isTooLarge = error.code === 'LIMIT_FILE_SIZE';
      response.status(isTooLarge ? 413 : 400).json({
        error: {
          code: isTooLarge ? 'IMAGE_TOO_LARGE' : 'INVALID_MULTIPART_UPLOAD',
          message: isTooLarge
            ? 'Image exceeds the configured upload size limit.'
            : 'Multipart image upload is invalid.',
        },
      });
      return;
    }

    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
      });
      return;
    }

    if (error instanceof AppError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    console.error('Unhandled request error', error);
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  });

  return app;
}
