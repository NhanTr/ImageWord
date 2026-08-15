import type { AuthResult, GenerateSettings, ImageItem } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

let accessToken: string | null = null;
let refreshPromise: Promise<AuthResult> | null = null;

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Responses from a proxy or unavailable service may not be JSON.
  }

  return new ApiError(
    response.status,
    body?.error?.code ?? 'REQUEST_FAILED',
    body?.error?.message ?? `Yêu cầu thất bại (${response.status}).`,
    body?.error?.details,
  );
}

async function rawRequest<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (authenticated && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;

    try {
      await refreshSession();
    } catch {
      accessToken = null;
      throw error;
    }
    return rawRequest<T>(path, init);
  }
}

export function refreshSession(): Promise<AuthResult> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = rawRequest<AuthResult>('/auth/refresh', { method: 'POST' }, false)
    .then((result) => {
      accessToken = result.accessToken;
      return result;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function acceptAuth(result: AuthResult): AuthResult {
  accessToken = result.accessToken;
  return result;
}

export const api = {
  register(input: { email: string; password: string; displayName: string }) {
    return rawRequest<AuthResult>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(input) },
      false,
    ).then(acceptAuth);
  },

  login(input: { email: string; password: string }) {
    return rawRequest<AuthResult>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(input) },
      false,
    ).then(acceptAuth);
  },

  async logout() {
    try {
      await rawRequest<void>('/auth/logout', { method: 'POST' }, false);
    } finally {
      accessToken = null;
    }
  },

  refresh: refreshSession,

  listImages(input: { kind?: string; cursor?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    query.set('limit', String(input.limit ?? 24));
    if (input.kind) query.set('kind', input.kind);
    if (input.cursor) query.set('cursor', input.cursor);
    return request<{ items: ImageItem[]; nextCursor: string | null }>(`/images?${query}`);
  },

  uploadImage(file: File) {
    const body = new FormData();
    body.set('file', file);
    return request<{ image: ImageItem }>('/images', { method: 'POST', body });
  },

  generateImage(imageId: string, settings: GenerateSettings) {
    return request<{ image: ImageItem }>(`/images/${imageId}/generate`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  getImageUrl(imageId: string) {
    return request<{ url: string; expiresIn: number }>(`/images/${imageId}/url`);
  },

  deleteImage(imageId: string) {
    return request<void>(`/images/${imageId}`, { method: 'DELETE' });
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const translations: Record<string, string> = {
      INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
      EMAIL_ALREADY_EXISTS: 'Email này đã được đăng ký.',
      VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
      IMAGE_TOO_LARGE: 'Ảnh vượt quá dung lượng cho phép.',
      UNSUPPORTED_IMAGE_TYPE: 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.',
      MIME_TYPE_MISMATCH: 'Định dạng khai báo không khớp nội dung ảnh.',
      INVALID_IMAGE: 'Ảnh không hợp lệ hoặc có kích thước pixel quá lớn.',
      GENERATION_TOO_COMPLEX: 'Mật độ ký tự quá lớn cho bức ảnh này.',
      IMAGE_GENERATION_FAILED: 'Không thể tạo ảnh chữ. Vui lòng thử lại.',
    };
    return translations[error.code] ?? error.message;
  }
  return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
}

export function resetApiSessionForTests(): void {
  accessToken = null;
  refreshPromise = null;
}
