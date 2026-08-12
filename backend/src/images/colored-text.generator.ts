import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import opentype from 'opentype.js';
import sharp, { type Metadata } from 'sharp';

import { config } from '../config.js';
import { AppError } from '../errors.js';
import type { GenerateImageInput } from './image.schemas.js';

const embeddedFontBuffer = readFileSync(
  fileURLToPath(
    new URL(
      '../../../node_modules/@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff',
      import.meta.url,
    ),
  ),
);
const embeddedFont = opentype.parse(
  embeddedFontBuffer.buffer.slice(
    embeddedFontBuffer.byteOffset,
    embeddedFontBuffer.byteOffset + embeddedFontBuffer.byteLength,
  ),
);
const glyphFontSize = 13;
const fontScale = glyphFontSize / embeddedFont.unitsPerEm;

export interface ColoredTextResult {
  buffer: Buffer;
  width: number;
  height: number;
  rows: number;
}

export function calculateGridDimensions(
  sourceWidth: number,
  sourceHeight: number,
  columns: number,
): { columns: number; rows: number; glyphs: number; width: number; height: number } {
  const rows = Math.max(
    1,
    Math.round(
      (sourceHeight / sourceWidth) *
        columns *
        (config.generation.cellWidth / config.generation.cellHeight),
    ),
  );
  const glyphs = columns * rows;

  if (glyphs > config.generation.maxGlyphs) {
    throw new AppError(
      422,
      'GENERATION_TOO_COMPLEX',
      `Generation would exceed the ${config.generation.maxGlyphs} glyph limit.`,
    );
  }

  return {
    columns,
    rows,
    glyphs,
    width: columns * config.generation.cellWidth,
    height: rows * config.generation.cellHeight,
  };
}

export function selectCharacter(luminance: number, characterSet: string): string {
  const characters = Array.from(characterSet);
  const normalized = Math.min(255, Math.max(0, luminance)) / 255;
  return characters[Math.round(normalized * (characters.length - 1))] ?? characters[0] ?? ' ';
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function parseHexColor(value: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  };
}

function luminance(red: number, green: number, blue: number): number {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function buildColoredTextSvg(
  pixels: Buffer,
  columns: number,
  rows: number,
  settings: GenerateImageInput,
): string {
  const expectedBytes = columns * rows * 3;
  if (pixels.length !== expectedBytes) {
    throw new Error(`Expected ${expectedBytes} RGB bytes, received ${pixels.length}.`);
  }

  const width = columns * config.generation.cellWidth;
  const height = rows * config.generation.cellHeight;
  const glyphDefinitions = new Map<string, { id: string; path: string; advanceWidth: number }>();
  for (const [index, character] of Array.from(settings.characterSet).entries()) {
    if (glyphDefinitions.has(character)) continue;
    const glyph = embeddedFont.charToGlyph(character);
    glyphDefinitions.set(character, {
      id: `glyph-${index}`,
      path: glyph.getPath(0, 0, glyphFontSize).toPathData(2),
      advanceWidth: (glyph.advanceWidth ?? embeddedFont.unitsPerEm) * fontScale,
    });
  }

  const glyphElements: string[] = [];
  const baselineOffset =
    config.generation.cellHeight / 2 +
    ((embeddedFont.ascender + embeddedFont.descender) * fontScale) / 2;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const offset = (row * columns + column) * 3;
      const red = pixels[offset] ?? 0;
      const green = pixels[offset + 1] ?? 0;
      const blue = pixels[offset + 2] ?? 0;
      const character = selectCharacter(luminance(red, green, blue), settings.characterSet);
      const glyph = glyphDefinitions.get(character);
      if (!glyph || !glyph.path) continue;
      const x =
        column * config.generation.cellWidth +
        (config.generation.cellWidth - glyph.advanceWidth) / 2;
      const y = row * config.generation.cellHeight + baselineOffset;

      glyphElements.push(
        `<use href="#${glyph.id}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})" fill="rgb(${red},${green},${blue})"/>`,
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<defs>',
    ...Array.from(glyphDefinitions.values(), (glyph) =>
      glyph.path ? `<path id="${glyph.id}" d="${glyph.path}"/>` : '',
    ),
    '</defs>',
    `<rect width="100%" height="100%" fill="${settings.backgroundColor}"/>`,
    ...glyphElements,
    '</svg>',
  ].join('');
}

function orientedDimensions(metadata: Metadata): { width: number; height: number } {
  if (!metadata.width || !metadata.height) {
    throw new AppError(
      422,
      'INVALID_IMAGE_DIMENSIONS',
      'Image dimensions could not be determined.',
    );
  }

  const swapsAxes = metadata.orientation !== undefined && metadata.orientation >= 5;
  return swapsAxes
    ? { width: metadata.height, height: metadata.width }
    : { width: metadata.width, height: metadata.height };
}

export async function generateColoredTextPng(
  source: Buffer,
  settings: GenerateImageInput,
): Promise<ColoredTextResult> {
  const input = sharp(source, { failOn: 'error', limitInputPixels: config.upload.maxPixels });
  const dimensions = orientedDimensions(await input.metadata());
  const grid = calculateGridDimensions(dimensions.width, dimensions.height, settings.columns);
  const background = parseHexColor(settings.backgroundColor);

  const pixels = await input
    .rotate()
    .resize(grid.columns, grid.rows, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .flatten({ background })
    .removeAlpha()
    .raw()
    .toBuffer();
  const svg = buildColoredTextSvg(pixels, grid.columns, grid.rows, settings);
  const buffer = await sharp(Buffer.from(svg), { limitInputPixels: config.upload.maxPixels })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return { buffer, width: grid.width, height: grid.height, rows: grid.rows };
}
