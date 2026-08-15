export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export type ImageKind = 'UPLOADED' | 'GENERATED';
export type ImageStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface ImageItem {
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

export interface AuthResult {
  user: User;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface GenerateSettings {
  columns: number;
  characterSet: string;
  fontFamily: 'monospace';
  backgroundColor: string;
}
