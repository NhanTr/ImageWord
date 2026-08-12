import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetApiSessionForTests } from './api';
import { App } from './App';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  cleanup();
  resetApiSessionForTests();
});

describe('App', () => {
  it('restores the guest screen and completes registration', async () => {
    const user = {
      id: 'user-2',
      email: 'lan@example.com',
      displayName: 'Lan',
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(
          { error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'Required' } },
          401,
        );
      }
      if (url.endsWith('/auth/register')) {
        return jsonResponse(
          { user, accessToken: 'access-token', tokenType: 'Bearer', expiresIn: 900 },
          201,
        );
      }
      if (url.includes('/images?')) return jsonResponse({ items: [], nextCursor: null });
      return jsonResponse({}, 500);
    });
    vi.stubGlobal('fetch', fetchMock);
    const interaction = userEvent.setup();

    render(<App />);
    await interaction.click(await screen.findByRole('tab', { name: 'Đăng ký' }));
    await interaction.type(screen.getByLabelText('Tên hiển thị'), user.displayName);
    await interaction.type(screen.getByLabelText('Email'), user.email);
    await interaction.type(screen.getByLabelText('Mật khẩu'), 'password123');
    await interaction.click(screen.getByRole('button', { name: /Tạo tài khoản/ }));

    expect(await screen.findByText(user.email)).toBeTruthy();
    expect(await screen.findByText('Thư viện đang trống.')).toBeTruthy();
  });
});
