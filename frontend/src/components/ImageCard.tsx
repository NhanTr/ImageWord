import { api, errorMessage } from '../api';
import type { ImageItem } from '../types';
import { ImagePreview } from './ImagePreview';

interface ImageCardProps {
  image: ImageItem;
  childCount: number;
  busy: boolean;
  onSelect: (image: ImageItem) => void;
  onDelete: (image: ImageItem) => void;
  onError: (message: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageCard({
  image,
  childCount,
  busy,
  onSelect,
  onDelete,
  onError,
}: ImageCardProps) {
  async function download() {
    try {
      const result = await api.getImageUrl(image.id);
      const anchor = document.createElement('a');
      anchor.href = result.url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.download = image.originalName ?? `imageword-${image.id}.png`;
      anchor.click();
    } catch (downloadError) {
      onError(errorMessage(downloadError));
    }
  }

  const imageLabel = image.kind === 'UPLOADED' ? 'Ảnh gốc' : 'Ảnh chữ';
  const createdAt = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(image.createdAt));

  return (
    <article className="image-card">
      <div className="image-frame">
        {image.status === 'READY' ? (
          <ImagePreview imageId={image.id} alt={image.originalName ?? imageLabel} />
        ) : (
          <div className={`preview-placeholder status-${image.status.toLowerCase()}`}>
            {image.status === 'FAILED' ? 'Tạo ảnh thất bại' : 'Đang xử lý…'}
          </div>
        )}
        <span className={`kind-badge kind-${image.kind.toLowerCase()}`}>{imageLabel}</span>
      </div>
      <div className="image-card-body">
        <div>
          <h3 title={image.originalName ?? image.id}>
            {image.originalName ?? 'Kết quả ImageWord'}
          </h3>
          <p>
            {image.width && image.height
              ? `${image.width} × ${image.height}`
              : 'Chưa có kích thước'}{' '}
            · {formatBytes(image.sizeBytes)} · {createdAt}
          </p>
          {image.kind === 'UPLOADED' && childCount > 0 && (
            <span className="relation-note">{childCount} kết quả trong trang này</span>
          )}
          {image.status === 'FAILED' && image.errorMessage && (
            <span className="error-note">{image.errorMessage}</span>
          )}
        </div>
        <div className="card-actions">
          {image.kind === 'UPLOADED' && image.status === 'READY' && (
            <button
              className="card-primary-action"
              type="button"
              onClick={() => onSelect(image)}
              disabled={busy}
            >
              Tạo chữ
            </button>
          )}
          {image.status === 'READY' && (
            <button type="button" onClick={() => void download()}>
              Tải xuống
            </button>
          )}
          <button
            className="danger-action"
            type="button"
            onClick={() => onDelete(image)}
            disabled={busy}
          >
            Xóa
          </button>
        </div>
      </div>
    </article>
  );
}
