import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import request from 'supertest';

import { createApp } from '../app.js';
import { config } from '../config.js';
import { migrate } from '../database/migrate.js';
import { database, redis } from '../infrastructure.js';

function refreshCookie(response: request.Response): string {
  const setCookie = response.headers['set-cookie'];
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(header, 'Expected a Set-Cookie header.');
  return header.split(';')[0] ?? '';
}

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emailA = `auth-a-${runId}@example.com`;
const emailB = `auth-b-${runId}@example.com`;
const password = 'Correct-Horse-42';
const app = createApp();
const createdUserIds: string[] = [];

before(async () => {
  await migrate();
  if (!redis.isOpen) await redis.connect();
});

after(async () => {
  if (createdUserIds.length > 0) {
    await database.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUserIds]);

    for (const userId of createdUserIds) {
      const keys = await redis.keys(`auth:session:${userId}:*`);
      if (keys.length > 0) await redis.del(keys);
    }
  }

  await Promise.allSettled([database.end(), redis.isOpen ? redis.quit() : Promise.resolve()]);
});

test('auth lifecycle rotates sessions and isolates user identity', async () => {
  const registerA = await request(app).post('/api/v1/auth/register').send({
    email: emailA.toUpperCase(),
    password,
    displayName: 'User A',
  });

  assert.equal(registerA.status, 201);
  assert.equal(registerA.body.user.email, emailA);
  assert.equal(registerA.body.tokenType, 'Bearer');
  assert.equal(registerA.body.expiresIn, config.auth.accessTtlSeconds);
  assert.ok(registerA.body.accessToken);
  createdUserIds.push(registerA.body.user.id);

  const accessA1 = registerA.body.accessToken as string;
  const refreshA1 = refreshCookie(registerA);

  const storedUser = await database.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [registerA.body.user.id],
  );
  assert.notEqual(storedUser.rows[0]?.password_hash, password);
  assert.match(storedUser.rows[0]?.password_hash ?? '', /^\$2[aby]\$12\$/);

  const initialSessionKeys = await redis.keys(`auth:session:${registerA.body.user.id}:*`);
  assert.equal(initialSessionKeys.length, 1);
  const storedSession = await redis.get(initialSessionKeys[0] ?? '');
  assert.match(storedSession ?? '', /^[a-f0-9]{64}$/);
  assert.notEqual(storedSession, refreshA1);
  assert.ok((await redis.ttl(initialSessionKeys[0] ?? '')) > 0);

  const profileA = await request(app)
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${accessA1}`);
  assert.equal(profileA.status, 200);
  assert.equal(profileA.body.user.id, registerA.body.user.id);
  assert.equal(profileA.body.user.passwordHash, undefined);

  const duplicate = await request(app).post('/api/v1/auth/register').send({
    email: emailA,
    password,
    displayName: 'Duplicate',
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'EMAIL_ALREADY_EXISTS');

  const wrongPassword = await request(app).post('/api/v1/auth/login').send({
    email: emailA,
    password: 'This-is-wrong-42',
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.body.error.code, 'INVALID_CREDENTIALS');

  const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshA1);
  assert.equal(rotated.status, 200);
  const accessA2 = rotated.body.accessToken as string;
  const refreshA2 = refreshCookie(rotated);
  assert.notEqual(refreshA2, refreshA1);

  const oldAccess = await request(app)
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${accessA1}`);
  assert.equal(oldAccess.status, 401);
  assert.equal(oldAccess.body.error.code, 'SESSION_EXPIRED');

  const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshA1);
  assert.equal(replay.status, 401);
  assert.equal(replay.body.error.code, 'REFRESH_TOKEN_REUSED');

  const registerB = await request(app).post('/api/v1/auth/register').send({
    email: emailB,
    password,
    displayName: 'User B',
  });
  assert.equal(registerB.status, 201);
  createdUserIds.push(registerB.body.user.id);

  const profileB = await request(app)
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${registerB.body.accessToken}`);
  assert.equal(profileB.status, 200);
  assert.equal(profileB.body.user.id, registerB.body.user.id);
  assert.notEqual(profileB.body.user.id, registerA.body.user.id);

  const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', refreshA2);
  assert.equal(logout.status, 204);

  const afterLogout = await request(app)
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${accessA2}`);
  assert.equal(afterLogout.status, 401);
  assert.equal(afterLogout.body.error.code, 'SESSION_EXPIRED');
});

test('auth endpoints validate input and require authentication', async () => {
  const invalidRegister = await request(app).post('/api/v1/auth/register').send({
    email: 'not-an-email',
    password: 'short',
    displayName: '',
  });
  assert.equal(invalidRegister.status, 400);
  assert.equal(invalidRegister.body.error.code, 'VALIDATION_ERROR');

  const missingAccessToken = await request(app).get('/api/v1/auth/me');
  assert.equal(missingAccessToken.status, 401);
  assert.equal(missingAccessToken.body.error.code, 'AUTHENTICATION_REQUIRED');

  const missingRefreshCookie = await request(app).post('/api/v1/auth/refresh');
  assert.equal(missingRefreshCookie.status, 401);
  assert.equal(missingRefreshCookie.body.error.code, 'REFRESH_TOKEN_REQUIRED');
});
