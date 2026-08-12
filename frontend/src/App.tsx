import { useEffect, useState } from 'react';

type ApiState = 'checking' | 'ready' | 'unavailable';

export function App() {
  const [apiState, setApiState] = useState<ApiState>('checking');

  useEffect(() => {
    const controller = new AbortController();
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

    fetch(`${baseUrl}/health/ready`, { signal: controller.signal })
      .then((response) => {
        setApiState(response.ok ? 'ready' : 'unavailable');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setApiState('unavailable');
      });

    return () => controller.abort();
  }, []);

  const statusText = {
    checking: 'Đang kiểm tra các dịch vụ…',
    ready: 'Backend, PostgreSQL, Redis và MinIO đã sẵn sàng.',
    unavailable: 'Một hoặc nhiều dịch vụ chưa sẵn sàng.',
  }[apiState];

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">IMAGEWORD</p>
        <h1>Biến từng pixel thành ký tự có màu.</h1>
        <p className="description">
          Nền tảng dự án đã được khởi tạo. Đăng nhập, upload và chuyển đổi ảnh sẽ được bổ sung ở các
          mốc tiếp theo.
        </p>
        <div className={`status status--${apiState}`}>
          <span aria-hidden="true" />
          {statusText}
        </div>
      </section>
    </main>
  );
}
