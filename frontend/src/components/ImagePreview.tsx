import { useEffect, useState } from 'react';

import { api } from '../api';

export function ImagePreview({
  imageId,
  alt,
  mimeType = 'image/png',
}: {
  imageId: string;
  alt: string;
  mimeType?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    api
      .getImageUrl(imageId)
      .then((result) => {
        if (active) setUrl(result.url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [imageId]);

  if (failed) return <div className="preview-placeholder">Không tải được ảnh</div>;
  if (!url)
    return (
      <div className="preview-placeholder">
        <span className="spinner" />
        Đang tải
      </div>
    );
  if (mimeType.startsWith('video/')) {
    return (
      <video
        src={url}
        aria-label={alt}
        autoPlay
        loop
        muted
        playsInline
        controls
        preload="metadata"
      />
    );
  }
  return <img src={url} alt={alt} loading="lazy" />;
}
