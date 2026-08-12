CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE image_kind AS ENUM ('UPLOADED', 'GENERATED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE image_status AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_normalized_check CHECK (email = lower(email))
);

CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  kind image_kind NOT NULL,
  status image_status NOT NULL DEFAULT 'PENDING',
  original_name VARCHAR(255),
  object_key TEXT NOT NULL UNIQUE,
  bucket VARCHAR(63) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT images_parent_kind_check CHECK (
    (kind = 'UPLOADED' AND parent_image_id IS NULL)
    OR
    (kind = 'GENERATED' AND parent_image_id IS NOT NULL)
  ),
  CONSTRAINT images_ready_dimensions_check CHECK (
    status <> 'READY'
    OR
    (width IS NOT NULL AND height IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx ON users (lower(email));
CREATE INDEX IF NOT EXISTS images_user_created_idx ON images (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS images_parent_idx ON images (parent_image_id);
CREATE INDEX IF NOT EXISTS images_user_kind_status_idx ON images (user_id, kind, status);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS images_set_updated_at ON images;
CREATE TRIGGER images_set_updated_at
BEFORE UPDATE ON images
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
