export type ImageKind = 'UPLOADED' | 'GENERATED';
export type ImageStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface ImageRecord {
  id: string;
  userId: string;
  parentImageId: string | null;
  kind: ImageKind;
  status: ImageStatus;
  originalName: string | null;
  objectKey: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  settings: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicImage {
  id: string;
  parentImageId: string | null;
  kind: ImageKind;
  status: ImageStatus;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  settings: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPublicImage(image: ImageRecord): PublicImage {
  return {
    id: image.id,
    parentImageId: image.parentImageId,
    kind: image.kind,
    status: image.status,
    originalName: image.originalName,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    width: image.width,
    height: image.height,
    settings: image.settings,
    errorMessage: image.errorMessage,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };
}
