import { createHash, randomUUID } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

import { config } from '../config.js';
import { AppError } from '../errors.js';

const accessSecret = new TextEncoder().encode(config.auth.accessSecret);
const refreshSecret = new TextEncoder().encode(config.auth.refreshSecret);

interface VerifiedToken {
  userId: string;
  sessionId: string;
}

async function signAccessToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ typ: 'access', sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(config.auth.issuer)
    .setAudience(config.auth.audience)
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(config.auth.accessTtl)
    .sign(accessSecret);
}

async function signRefreshToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(config.auth.issuer)
    .setAudience(config.auth.audience)
    .setSubject(userId)
    .setJti(sessionId)
    .setIssuedAt()
    .setExpirationTime(config.auth.refreshTtl)
    .sign(refreshSecret);
}

function requireClaims(
  payload: { sub?: string; jti?: string; typ?: unknown; sid?: unknown },
  expectedType: 'access' | 'refresh',
): VerifiedToken {
  const sessionId = expectedType === 'access' ? payload.sid : payload.jti;

  if (
    payload.typ !== expectedType ||
    typeof payload.sub !== 'string' ||
    typeof sessionId !== 'string'
  ) {
    throw new AppError(401, 'INVALID_TOKEN', 'Token is invalid or expired.');
  }

  return { userId: payload.sub, sessionId };
}

export async function createTokenPair(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}> {
  const sessionId = randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId, sessionId),
    signRefreshToken(userId, sessionId),
  ]);

  return { accessToken, refreshToken, sessionId };
}

export async function verifyAccessToken(token: string): Promise<VerifiedToken> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, {
      issuer: config.auth.issuer,
      audience: config.auth.audience,
      algorithms: ['HS256'],
    });
    return requireClaims(payload, 'access');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, 'INVALID_TOKEN', 'Token is invalid or expired.');
  }
}

export async function verifyRefreshToken(token: string): Promise<VerifiedToken> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret, {
      issuer: config.auth.issuer,
      audience: config.auth.audience,
      algorithms: ['HS256'],
    });
    return requireClaims(payload, 'refresh');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.');
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
