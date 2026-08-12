import type { CookieOptions, Request, Response } from 'express';
import { Router } from 'express';

import { config } from '../config.js';
import { AppError } from '../errors.js';
import { requireAuth } from './auth.middleware.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import {
  getProfile,
  login as loginUser,
  logout as logoutUser,
  refresh as refreshSession,
  register as registerUser,
} from './auth.service.js';

export const authRouter = Router();

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.auth.secureCookie,
  sameSite: 'lax',
  path: '/api/v1/auth',
  maxAge: config.auth.refreshTtlSeconds * 1_000,
};

function setRefreshCookie(response: Response, refreshToken: string): void {
  response.cookie(config.auth.refreshCookieName, refreshToken, refreshCookieOptions);
}

function clearRefreshCookie(response: Response): void {
  response.clearCookie(config.auth.refreshCookieName, {
    httpOnly: refreshCookieOptions.httpOnly,
    secure: refreshCookieOptions.secure,
    sameSite: refreshCookieOptions.sameSite,
    path: refreshCookieOptions.path,
  });
}

function authResponse(result: Awaited<ReturnType<typeof registerUser>>) {
  return {
    user: result.user,
    accessToken: result.accessToken,
    tokenType: 'Bearer',
    expiresIn: result.expiresIn,
  };
}

function readRefreshCookie(request: Request): string | undefined {
  const value = (request.cookies as Record<string, unknown> | undefined)?.[
    config.auth.refreshCookieName
  ];
  return typeof value === 'string' ? value : undefined;
}

authRouter.post('/register', async (request, response) => {
  const input = registerSchema.parse(request.body);
  const result = await registerUser(input);
  setRefreshCookie(response, result.refreshToken);
  response.status(201).json(authResponse(result));
});

authRouter.post('/login', async (request, response) => {
  const input = loginSchema.parse(request.body);
  const result = await loginUser(input);
  setRefreshCookie(response, result.refreshToken);
  response.status(200).json(authResponse(result));
});

authRouter.post('/refresh', async (request, response) => {
  const refreshToken = readRefreshCookie(request);
  if (!refreshToken) {
    throw new AppError(401, 'REFRESH_TOKEN_REQUIRED', 'A refresh token cookie is required.');
  }

  try {
    const result = await refreshSession(refreshToken);
    setRefreshCookie(response, result.refreshToken);
    response.status(200).json(authResponse(result));
  } catch (error) {
    clearRefreshCookie(response);
    throw error;
  }
});

authRouter.post('/logout', async (request, response) => {
  await logoutUser(readRefreshCookie(request));
  clearRefreshCookie(response);
  response.status(204).send();
});

authRouter.get('/me', requireAuth, async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  response.status(200).json({ user: await getProfile(userId) });
});
