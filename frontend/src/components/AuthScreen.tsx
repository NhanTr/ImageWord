import { type FormEvent, useState } from 'react';

import { api, errorMessage } from '../api';
import type { User } from '../types';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    setPending(true);
    setError(null);
    try {
      const result =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({
              email,
              password,
              displayName: String(form.get('displayName') ?? ''),
            });
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setPending(false);
    }
  }

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode);
    setError(null);
  }

  return (
    <main className="auth-layout">
      <section className="auth-intro">
        <a className="wordmark" href="/" aria-label="ImageWord">
          <span>IW</span> IMAGEWORD
        </a>
        <div>
          <p className="eyebrow">PIXEL → TYPE</p>
          <h1>
            Mỗi điểm ảnh,
            <br />
            một ký tự sống động.
          </h1>
          <p className="intro-copy">
            Tải ảnh lên, biến sắc độ thành ký tự và giữ nguyên màu của từng vùng ảnh — tất cả trong
            thư viện riêng của bạn.
          </p>
        </div>
        <p className="intro-footnote">Ảnh gốc và kết quả được lưu riêng tư.</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Tài khoản">
            <button
              className={mode === 'login' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
            >
              Đăng nhập
            </button>
            <button
              className={mode === 'register' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
            >
              Đăng ký
            </button>
          </div>

          <div className="auth-heading">
            <p className="kicker">
              {mode === 'login' ? 'CHÀO MỪNG TRỞ LẠI' : 'TẠO KHÔNG GIAN RIÊNG'}
            </p>
            <h2 id="auth-title">
              {mode === 'login' ? 'Tiếp tục sáng tạo.' : 'Bắt đầu với ImageWord.'}
            </h2>
          </div>

          <form onSubmit={(event) => void submit(event)}>
            {mode === 'register' && (
              <label>
                Tên hiển thị
                <input
                  name="displayName"
                  autoComplete="name"
                  minLength={1}
                  maxLength={100}
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="ban@example.com"
                required
              />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                maxLength={72}
                placeholder="Tối thiểu 8 ký tự"
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button auth-submit" type="submit" disabled={pending}>
              {pending ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
              {!pending && <span aria-hidden="true">↗</span>}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
