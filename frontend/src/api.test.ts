import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, resetApiSessionForTests } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const user = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

afterEach(() => resetApiSessionForTests());

describe('API session client', () => {
  it('refreshes an expired access token once and retries the protected request', async () => {
    const calls: Array<{ url: string; authorization: string | null }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get('Authorization');
      calls.push({ url, authorization });

      if (url.endsWith('/auth/login')) {
        return jsonResponse({
          user,
          accessToken: 'expired-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        });
      }
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse({
          user,
          accessToken: 'fresh-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        });
      }
      if (url.includes('/images?') && authorization === 'Bearer expired-token') {
        return jsonResponse({ error: { code: 'TOKEN_EXPIRED', message: 'Expired' } }, 401);
      }
      if (url.includes('/images?') && authorization === 'Bearer fresh-token') {
        return jsonResponse({ items: [], nextCursor: null });
      }
      return jsonResponse({}, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.login({ email: user.email, password: 'password123' });
    await expect(api.listImages()).resolves.toEqual({ items: [], nextCursor: null });

    expect(calls.filter((call) => call.url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(calls.at(-1)?.authorization).toBe('Bearer fresh-token');
  });
});
