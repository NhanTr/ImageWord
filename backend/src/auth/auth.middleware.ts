import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors.js';
import { sessionExists } from './session.store.js';
import { verifyAccessToken } from './token.service.js';

export async function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorization = request.header('authorization');
    const [scheme, token] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'A valid access token is required.');
    }

    const claims = await verifyAccessToken(token);
    if (!(await sessionExists(claims.userId, claims.sessionId))) {
      throw new AppError(401, 'SESSION_EXPIRED', 'The login session has expired.');
    }

    request.auth = claims;
    next();
  } catch (error) {
    next(error);
  }
}
