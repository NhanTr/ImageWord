import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { api, errorMessage } from '../api';
import type { GenerateSettings, GenerateVideoSettings, ImageItem, ImageKind, User } from '../types';
import { ImageCard } from './ImageCard';
import { ImagePreview } from './ImagePreview';

interface WorkspaceProps {
  user: User;
  notice: string | null;
  onDismissNotice: () => void;
  onLogout: () => void;
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxFileBytes = 10 * 1024 * 1024;

export function Workspace({ user, notice, onDismissNotice, onLogout }: WorkspaceProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | ImageKind>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedSource, setSelectedSource] = useState<ImageItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [outputMode, setOutputMode] = useState<'image' | 'video'>('image');
  const [columns, setColumns] = useState(120);
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [characterSet, setCharacterSet] = useState('@%#*+=-:. ');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(
    async (cursor?: string, requestedFilter = filter) => {
      const result = await api.listImages({
        limit: 24,
        ...(requestedFilter !== 'ALL' ? { kind: requestedFilter } : {}),
        ...(cursor ? { cursor } : {}),
      });
      setImages((current) => (cursor ? [...current, ...result.items] : result.items));
      setNextCursor(result.nextCursor);
    },
    [filter],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadImages()
      .catch((loadError) => {
        if (active) setMessage({ tone: 'error', text: errorMessage(loadError) });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadImages]);

  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(candidate: File | undefined) {
    if (!candidate) return;
    if (!allowedTypes.has(candidate.type)) {
      setMessage({ tone: 'error', text: 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.' });
      return;
    }
    if (candidate.size > maxFileBytes) {
      setMessage({ tone: 'error', text: 'Ảnh không được vượt quá 10 MB.' });
      return;
    }
    setFile(candidate);
    setMessage(null);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const result = await api.uploadImage(file);
      setSelectedSource(result.image);
      setFile(null);
      setFilter('ALL');
      await loadImages(undefined, 'ALL');
      setMessage({ tone: 'success', text: 'Ảnh đã được tải lên. Bạn có thể tạo ảnh chữ ngay.' });
      document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (uploadError) {
      setMessage({ tone: 'error', text: errorMessage(uploadError) });
    } finally {
      setUploading(false);
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource) return;
    const settings: GenerateSettings = {
      columns,
      characterSet,
      fontFamily: 'monospace',
      backgroundColor,
    };

    setGenerating(true);
    setBusyId(selectedSource.id);
    setMessage(null);
    try {
      if (outputMode === 'video') {
        const videoSettings: GenerateVideoSettings = { ...settings, durationSeconds };
        await api.generateVideo(selectedSource.id, videoSettings);
      } else {
        await api.generateImage(selectedSource.id, settings);
      }
      setFilter('ALL');
      await loadImages(undefined, 'ALL');
      setMessage({
        tone: 'success',
        text:
          outputMode === 'video'
            ? 'Video chữ đã sẵn sàng và sẽ tự lặp trong thư viện.'
            : 'Ảnh chữ đã sẵn sàng trong thư viện.',
      });
      document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (generationError) {
      setMessage({ tone: 'error', text: errorMessage(generationError) });
      await loadImages().catch(() => undefined);
    } finally {
      setGenerating(false);
      setBusyId(null);
    }
  }

  function selectSource(image: ImageItem) {
    setSelectedSource(image);
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function removeImage(image: ImageItem) {
    const detail =
      image.kind === 'UPLOADED'
        ? 'Xóa ảnh gốc cũng sẽ xóa tất cả ảnh và video chữ được tạo từ ảnh này. Bạn có chắc không?'
        : `Bạn có chắc muốn xóa ${image.mimeType.startsWith('video/') ? 'video chữ' : 'ảnh chữ'} này?`;
    if (!window.confirm(detail)) return;

    setBusyId(image.id);
    try {
      await api.deleteImage(image.id);
      if (selectedSource?.id === image.id) setSelectedSource(null);
      await loadImages();
      setMessage({ tone: 'success', text: 'Ảnh đã được xóa khỏi thư viện.' });
    } catch (deleteError) {
      setMessage({ tone: 'error', text: errorMessage(deleteError) });
    } finally {
      setBusyId(null);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      await loadImages(nextCursor);
    } catch (loadError) {
      setMessage({ tone: 'error', text: errorMessage(loadError) });
    } finally {
      setLoadingMore(false);
    }
  }

  const childCounts = new Map<string, number>();
  for (const image of images) {
    if (image.parentImageId) {
      childCounts.set(image.parentImageId, (childCounts.get(image.parentImageId) ?? 0) + 1);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="wordmark" href="#top" aria-label="ImageWord">
          <span>IW</span> IMAGEWORD
        </a>
        <nav aria-label="Điều hướng chính">
          <a href="#create">Tải ảnh</a>
          <a href="#generator">Tạo tác phẩm</a>
          <a href="#gallery">Thư viện</a>
        </nav>
        <div className="account-menu">
          <span className="avatar" aria-hidden="true">
            {user.displayName.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
          </div>
          <button type="button" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      <main id="top">
        <section className="workspace-hero">
          <div className="hero-copy">
            <p className="eyebrow">IMAGE → COLORED TEXT</p>
            <h1>
              Biến ảnh thành
              <br />
              <em>những con chữ.</em>
            </h1>
            <p>Mỗi ký tự mang màu của chính pixel nó đại diện. Chỉ cần một bức ảnh để bắt đầu.</p>
            <a className="hero-action" href="#create">
              Bắt đầu sáng tạo <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span>IMAGEWORD</span>
            <pre>{'@#%*+=-:.\n+#%@*=-:.\n.:=+*%@#'}</pre>
          </div>
        </section>

        <nav className="workflow-nav" aria-label="Quy trình tạo tác phẩm">
          <a href="#create">
            <span>01</span>
            <strong>Tải ảnh</strong>
            <small>JPEG, PNG, WebP</small>
          </a>
          <a href="#generator">
            <span>02</span>
            <strong>Tùy chỉnh</strong>
            <small>Kiểu chữ và mật độ</small>
          </a>
          <a href="#gallery">
            <span>03</span>
            <strong>Nhận kết quả</strong>
            <small>Ảnh PNG hoặc video MP4</small>
          </a>
        </nav>

        {(notice || message) && (
          <div
            className={`toast ${(message?.tone ?? 'error') === 'error' ? 'toast-error' : 'toast-success'}`}
            role="status"
          >
            <span>{notice ?? message?.text}</span>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => {
                onDismissNotice();
                setMessage(null);
              }}
            >
              ×
            </button>
          </div>
        )}

        <section className="creator-grid" id="create">
          <div className="section-copy">
            <span className="step-number">01</span>
            <p className="kicker">ẢNH NGUỒN</p>
            <h2>Tải ảnh lên</h2>
            <p>JPEG, PNG hoặc WebP. Tối đa 10 MB.</p>
          </div>
          <div className="upload-column">
            <div
              className={`drop-zone ${dragging ? 'is-dragging' : ''} ${localPreview ? 'has-preview' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {localPreview ? (
                <img src={localPreview} alt="Xem trước ảnh chuẩn bị tải lên" />
              ) : (
                <>
                  <span className="upload-icon" aria-hidden="true">
                    ↥
                  </span>
                  <h3>Kéo thả ảnh vào đây</h3>
                  <p>hoặc chọn từ thiết bị của bạn</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFileChange}
                aria-label="Chọn ảnh tải lên"
              />
              <button
                className="secondary-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                {localPreview ? 'Chọn ảnh khác' : 'Chọn ảnh'}
              </button>
            </div>
            {file && (
              <div className="file-selection">
                <span>
                  <strong>{file.name}</strong>
                  <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
                </span>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void upload()}
                  disabled={uploading}
                >
                  {uploading ? 'Đang tải lên…' : 'Tải lên & tiếp tục'}
                </button>
              </div>
            )}
          </div>
        </section>

        <section
          className={`generator-section ${selectedSource ? '' : 'is-disabled'}`}
          id="generator"
        >
          <div className="section-copy">
            <span className="step-number">02</span>
            <p className="kicker">CẤU HÌNH</p>
            <h2>Tạo ảnh hoặc video chữ</h2>
            <p>
              {selectedSource
                ? 'Chọn ảnh tĩnh hoặc video in chữ tuần tự.'
                : 'Tải lên hoặc chọn một ảnh gốc trong thư viện.'}
            </p>
          </div>
          <div className="generator-card">
            {selectedSource ? (
              <>
                <div className="source-preview">
                  <ImagePreview
                    imageId={selectedSource.id}
                    alt={selectedSource.originalName ?? 'Ảnh nguồn'}
                  />
                  <div>
                    <span>ĐANG CHỌN</span>
                    <strong>{selectedSource.originalName ?? 'Ảnh nguồn'}</strong>
                  </div>
                </div>
                <form onSubmit={(event) => void generate(event)}>
                  <div className="output-tabs" role="group" aria-label="Loại kết quả">
                    <button
                      type="button"
                      className={outputMode === 'image' ? 'is-active' : ''}
                      aria-pressed={outputMode === 'image'}
                      onClick={() => setOutputMode('image')}
                    >
                      Ảnh PNG
                    </button>
                    <button
                      type="button"
                      className={outputMode === 'video' ? 'is-active' : ''}
                      aria-pressed={outputMode === 'video'}
                      onClick={() => {
                        setOutputMode('video');
                        setColumns((value) => Math.min(value, 120));
                      }}
                    >
                      Video MP4
                    </button>
                  </div>
                  {outputMode === 'video' && (
                    <div className="effect-note">
                      <span className="effect-scan" aria-hidden="true">
                        A<br />
                        BC
                        <br />
                        DEF
                      </span>
                      <p>
                        <strong>Hiệu ứng in tuần tự</strong>Từ trái sang phải, từ trên xuống dưới và
                        tự lặp trên web.
                      </p>
                    </div>
                  )}
                  <label className="range-label">
                    <span>
                      Mật độ cột <output>{columns}</output>
                    </span>
                    <input
                      type="range"
                      min="20"
                      max={outputMode === 'video' ? 120 : 300}
                      value={columns}
                      onChange={(event) => setColumns(Number(event.target.value))}
                    />
                    <small>Ít chi tiết</small>
                    <small>Nhiều chi tiết</small>
                  </label>
                  {outputMode === 'video' && (
                    <label className="range-label">
                      <span>
                        Thời gian in chữ <output>{durationSeconds} giây</output>
                      </span>
                      <input
                        type="range"
                        min="2"
                        max="10"
                        step="0.5"
                        value={durationSeconds}
                        onChange={(event) => setDurationSeconds(Number(event.target.value))}
                      />
                      <small>Nhanh</small>
                      <small>Chậm</small>
                    </label>
                  )}
                  <label>
                    Bộ ký tự
                    <input
                      className="mono-input"
                      value={characterSet}
                      minLength={2}
                      maxLength={32}
                      pattern="[ -~]+"
                      onChange={(event) => setCharacterSet(event.target.value)}
                      required
                    />
                  </label>
                  <label className="color-field">
                    Màu nền
                    <span>
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(event) => setBackgroundColor(event.target.value)}
                      />
                      <code>{backgroundColor}</code>
                    </span>
                  </label>
                  <button
                    className="primary-button generate-button"
                    type="submit"
                    disabled={generating}
                  >
                    {generating
                      ? outputMode === 'video'
                        ? 'Đang dựng video…'
                        : 'Đang biến đổi ảnh…'
                      : outputMode === 'video'
                        ? 'Tạo video chữ'
                        : 'Tạo ảnh chữ'}{' '}
                    <span aria-hidden="true">✦</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="empty-generator">
                <span aria-hidden="true">Aa</span>
                <p>Chưa chọn ảnh nguồn</p>
              </div>
            )}
          </div>
        </section>

        <section className="gallery-section" id="gallery">
          <div className="gallery-heading">
            <div>
              <p className="kicker">BỘ SƯU TẬP CỦA BẠN</p>
              <div className="gallery-title-row">
                <h2>Thư viện</h2>
                {!loading && <span>{images.length} mục</span>}
              </div>
            </div>
            <div className="filter-tabs" role="group" aria-label="Lọc thư viện">
              {(
                [
                  ['ALL', 'Tất cả'],
                  ['UPLOADED', 'Ảnh gốc'],
                  ['GENERATED', 'Kết quả'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? 'is-active' : ''}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="gallery-state">
              <span className="spinner" />
              Đang tải thư viện…
            </div>
          ) : images.length === 0 ? (
            <div className="gallery-state empty">
              <strong>Thư viện đang trống.</strong>
              <span>Tải bức ảnh đầu tiên để bắt đầu.</span>
            </div>
          ) : (
            <div className="image-grid">
              {images.map((image) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  childCount={childCounts.get(image.id) ?? 0}
                  busy={busyId === image.id}
                  onSelect={selectSource}
                  onDelete={(item) => void removeImage(item)}
                  onError={(text) => setMessage({ tone: 'error', text })}
                />
              ))}
            </div>
          )}
          {nextCursor && (
            <button
              className="load-more"
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? 'Đang tải…' : 'Xem thêm'}
            </button>
          )}
        </section>
      </main>

      <footer>
        <span>IMAGEWORD</span>
        <p>Ảnh của bạn. Chữ của bạn. Màu sắc nguyên bản.</p>
      </footer>
    </div>
  );
}
