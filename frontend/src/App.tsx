import { useEffect, useState } from 'react';

import { api, errorMessage } from './api';
import { AuthScreen } from './components/AuthScreen';
import { Workspace } from './components/Workspace';
import type { User } from './types';

type SessionState =
  { status: 'loading' } | { status: 'guest' } | { status: 'authenticated'; user: User };

export function App() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .refresh()
      .then((result) => {
        if (active) setSession({ status: 'authenticated', user: result.user });
      })
      .catch(() => {
        if (active) setSession({ status: 'guest' });
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    try {
      await api.logout();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSession({ status: 'guest' });
    }
  }

  if (session.status === 'loading') {
    return (
      <main className="loading-screen">
        <div className="brand-mark" aria-hidden="true">
          IW
        </div>
        <p>Đang khôi phục phiên làm việc…</p>
      </main>
    );
  }

  if (session.status === 'guest') {
    return <AuthScreen onAuthenticated={(user) => setSession({ status: 'authenticated', user })} />;
  }

  return (
    <Workspace
      user={session.user}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
      onLogout={() => void logout()}
    />
  );
}
