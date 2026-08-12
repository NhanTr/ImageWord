import bcrypt from 'bcryptjs';

import { config } from '../config.js';
import { AppError } from '../errors.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  toPublicUser,
  type PublicUser,
  type UserRecord,
} from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { consumeSession, createSession } from './session.store.js';
import { createTokenPair, verifyRefreshToken } from './token.service.js';

interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const dummyPasswordHash = '$2b$12$qRlaO5.rABmOkX2fh.wPTeGlWxOUA2e/GtJdUVWy2VL1Sai525EXq';

async function createAuthenticatedSession(user: UserRecord): Promise<AuthResult> {
  const tokenPair = await createTokenPair(user.id);
  await createSession(user.id, tokenPair.sessionId, tokenPair.refreshToken);

  return {
    user: toPublicUser(user),
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresIn: config.auth.accessTtlSeconds,
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await createUser({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });
    return await createAuthenticatedSession(user);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await findUserByEmail(input.email);
  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? dummyPasswordHash,
  );

  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  return createAuthenticatedSession(user);
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  const claims = await verifyRefreshToken(refreshToken);
  const user = await findUserById(claims.userId);

  if (!user) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.');
  }

  const consumed = await consumeSession(claims.userId, claims.sessionId, refreshToken);
  if (!consumed) {
    throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token is invalid or has been used.');
  }

  return createAuthenticatedSession(user);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;

  try {
    const claims = await verifyRefreshToken(refreshToken);
    await consumeSession(claims.userId, claims.sessionId, refreshToken);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await findUserById(userId);
  if (!user) throw new AppError(401, 'USER_NOT_FOUND', 'Authenticated user no longer exists.');
  return toPublicUser(user);
}
