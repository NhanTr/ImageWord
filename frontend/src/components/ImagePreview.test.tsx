import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { resetApiSessionForTests } from '../api';
import { ImagePreview } from './ImagePreview';

afterEach(() => {
  cleanup();
  resetApiSessionForTests();
});

it('renders generated video as an autoplaying muted loop on the web', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ url: 'http://localhost:9000/video.mp4', expiresIn: 300 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );

  render(<ImagePreview imageId="video-1" alt="Video chữ" mimeType="video/mp4" />);
  const video = (await screen.findByLabelText('Video chữ')) as HTMLVideoElement;
  expect(video.tagName).toBe('VIDEO');
  expect(video.autoplay).toBe(true);
  expect(video.loop).toBe(true);
  expect(video.muted).toBe(true);
  expect(video.playsInline).toBe(true);
  expect(video.controls).toBe(true);
});
