import { config } from '../config.js';
import { redis } from '../infrastructure.js';
import { hashToken } from './token.service.js';

function sessionKey(userId: string, sessionId: string): string {
  return `auth:session:${userId}:${sessionId}`;
}

export async function createSession(
  userId: string,
  sessionId: string,
  refreshToken: string,
): Promise<void> {
  await redis.set(sessionKey(userId, sessionId), hashToken(refreshToken), {
    EX: config.auth.refreshTtlSeconds,
  });
}

export async function sessionExists(userId: string, sessionId: string): Promise<boolean> {
  return (await redis.exists(sessionKey(userId, sessionId))) === 1;
}

export async function consumeSession(
  userId: string,
  sessionId: string,
  refreshToken: string,
): Promise<boolean> {
  const key = sessionKey(userId, sessionId);
  const expectedHash = hashToken(refreshToken);
  const result = await redis.eval(
    `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
    `,
    { keys: [key], arguments: [expectedHash] },
  );

  return result === 1;
}
