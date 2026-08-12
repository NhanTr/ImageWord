import 'dotenv/config';

function readInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

function readDurationSeconds(value: string | undefined, fallback: string): number {
  const duration = value ?? fallback;
  const match = /^(\d+)(s|m|h|d)$/.exec(duration);

  if (!match) {
    throw new Error(`Invalid duration "${duration}". Use a value such as 15m, 2h or 7d.`);
  }

  const amount = Number.parseInt(match[1] ?? '', 10);
  const multiplier = { s: 1, m: 60, h: 3_600, d: 86_400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return amount * multiplier;
}

function readJwtSecret(value: string | undefined, fallback: string, name: string): string {
  const secret = value ?? fallback;
  if (secret.length < 32) throw new Error(`${name} must contain at least 32 characters.`);
  return secret;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: readInteger(process.env.BACKEND_PORT ?? process.env.PORT, 3000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://imageword:imageword_postgres_dev@localhost:5432/imageword',
  redisUrl: process.env.REDIS_URL ?? 'redis://:imageword_redis_dev@localhost:6379',
  auth: {
    issuer: 'imageword-api',
    audience: 'imageword-web',
    accessSecret: readJwtSecret(
      process.env.JWT_ACCESS_SECRET,
      'imageword-access-development-secret',
      'JWT_ACCESS_SECRET',
    ),
    refreshSecret: readJwtSecret(
      process.env.JWT_REFRESH_SECRET,
      'imageword-refresh-development-secret',
      'JWT_REFRESH_SECRET',
    ),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
    accessTtlSeconds: readDurationSeconds(process.env.JWT_ACCESS_TTL, '15m'),
    refreshTtlSeconds: readDurationSeconds(process.env.JWT_REFRESH_TTL, '7d'),
    refreshCookieName: 'imageword_refresh',
    secureCookie: (process.env.NODE_ENV ?? 'development') === 'production',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.MINIO_REGION ?? 'us-east-1',
    accessKeyId: process.env.MINIO_ROOT_USER ?? 'imageword',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? 'imageword_minio_dev',
    bucket: process.env.MINIO_BUCKET ?? 'imageword',
    forcePathStyle: readBoolean(process.env.MINIO_FORCE_PATH_STYLE, true),
    presignedUrlTtlSeconds: readInteger(process.env.MINIO_PRESIGNED_URL_TTL_SECONDS, 300),
  },
  upload: {
    maxBytes: readInteger(process.env.UPLOAD_MAX_BYTES, 10 * 1024 * 1024),
    maxPixels: readInteger(process.env.UPLOAD_MAX_PIXELS, 40_000_000),
  },
} as const;
