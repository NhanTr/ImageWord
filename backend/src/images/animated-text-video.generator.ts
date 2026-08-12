import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';

import { config } from '../config.js';
import { AppError } from '../errors.js';
import {
  calculateGridDimensions,
  generateColoredTextPng,
  parseHexColor,
} from './colored-text.generator.js';
import type { GenerateVideoInput } from './image.schemas.js';

export interface AnimatedTextVideoResult {
  buffer: Buffer;
  width: number;
  height: number;
  rows: number;
  durationSeconds: number;
  frameCount: number;
}

export function revealedGlyphCount(frame: number, revealFrames: number, glyphs: number): number {
  if (frame <= 0 || revealFrames <= 1) return frame <= 0 ? 0 : glyphs;
  const progress = Math.min(1, frame / (revealFrames - 1));
  return Math.min(glyphs, Math.floor(progress * glyphs));
}

function fillBackground(frame: Buffer, color: { r: number; g: number; b: number }): void {
  for (let offset = 0; offset < frame.length; offset += 3) {
    frame[offset] = color.r;
    frame[offset + 1] = color.g;
    frame[offset + 2] = color.b;
  }
}

function revealCell(
  frame: Buffer,
  finalFrame: Buffer,
  width: number,
  columns: number,
  glyphIndex: number,
): void {
  const column = glyphIndex % columns;
  const row = Math.floor(glyphIndex / columns);
  const startX = column * config.generation.cellWidth;
  const startY = row * config.generation.cellHeight;
  const rowBytes = config.generation.cellWidth * 3;

  for (let y = 0; y < config.generation.cellHeight; y += 1) {
    const offset = ((startY + y) * width + startX) * 3;
    finalFrame.copy(frame, offset, offset, offset + rowBytes);
  }
}

async function writeFrame(stream: NodeJS.WritableStream, frame: Buffer): Promise<void> {
  if (!stream.write(Buffer.from(frame))) await once(stream, 'drain');
}

async function encodeFrames(input: {
  finalFrame: Buffer;
  width: number;
  height: number;
  columns: number;
  rows: number;
  durationSeconds: number;
  backgroundColor: string;
}): Promise<{ buffer: Buffer; frameCount: number; durationSeconds: number }> {
  const directory = await mkdtemp(join(tmpdir(), 'imageword-video-'));
  const outputPath = join(directory, 'animated-text.mp4');
  const revealFrames = Math.max(2, Math.round(input.durationSeconds * config.video.fps));
  const holdFrames = Math.max(0, Math.round(config.video.holdSeconds * config.video.fps));
  const glyphs = input.columns * input.rows;
  const frame = Buffer.alloc(input.width * input.height * 3);
  fillBackground(frame, parseHexColor(input.backgroundColor));

  const encoder = spawn(
    config.video.ffmpegPath,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'rawvideo',
      '-pixel_format',
      'rgb24',
      '-video_size',
      `${input.width}x${input.height}`,
      '-framerate',
      String(config.video.fps),
      '-i',
      'pipe:0',
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '22',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  );
  let stderr = '';
  encoder.stderr.setEncoding('utf8');
  encoder.stderr.on('data', (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-4_000);
  });

  const completion = new Promise<void>((resolve, reject) => {
    encoder.once('error', reject);
    encoder.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });
  });

  try {
    let visibleGlyphs = 0;
    for (let frameIndex = 0; frameIndex < revealFrames; frameIndex += 1) {
      const target = revealedGlyphCount(frameIndex, revealFrames, glyphs);
      while (visibleGlyphs < target) {
        revealCell(frame, input.finalFrame, input.width, input.columns, visibleGlyphs);
        visibleGlyphs += 1;
      }
      await writeFrame(encoder.stdin, frame);
    }
    for (let frameIndex = 0; frameIndex < holdFrames; frameIndex += 1) {
      await writeFrame(encoder.stdin, frame);
    }
    encoder.stdin.end();
    await completion;
    return {
      buffer: await readFile(outputPath),
      frameCount: revealFrames + holdFrames,
      durationSeconds: (revealFrames + holdFrames) / config.video.fps,
    };
  } finally {
    encoder.stdin.destroy();
    await rm(directory, { recursive: true, force: true });
  }
}

export async function generateAnimatedTextVideo(
  source: Buffer,
  settings: GenerateVideoInput,
): Promise<AnimatedTextVideoResult> {
  const sourceMetadata = await sharp(source, {
    failOn: 'error',
    limitInputPixels: config.upload.maxPixels,
  }).metadata();
  if (!sourceMetadata.width || !sourceMetadata.height) {
    throw new AppError(
      422,
      'INVALID_IMAGE_DIMENSIONS',
      'Image dimensions could not be determined.',
    );
  }
  const swapsAxes = sourceMetadata.orientation !== undefined && sourceMetadata.orientation >= 5;
  const sourceWidth = swapsAxes ? sourceMetadata.height : sourceMetadata.width;
  const sourceHeight = swapsAxes ? sourceMetadata.width : sourceMetadata.height;
  const grid = calculateGridDimensions(sourceWidth, sourceHeight, settings.columns);
  if (settings.columns > config.video.maxColumns || grid.glyphs > config.video.maxGlyphs) {
    throw new AppError(
      422,
      'VIDEO_GENERATION_TOO_COMPLEX',
      `Video would exceed the ${config.video.maxGlyphs} glyph limit.`,
    );
  }

  const still = await generateColoredTextPng(source, settings);
  const { data: finalFrame, info } = await sharp(still.buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const encoded = await encodeFrames({
    finalFrame,
    width: info.width,
    height: info.height,
    columns: settings.columns,
    rows: still.rows,
    durationSeconds: settings.durationSeconds,
    backgroundColor: settings.backgroundColor,
  });

  return {
    ...encoded,
    width: info.width,
    height: info.height,
    rows: still.rows,
  };
}
