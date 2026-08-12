import assert from 'node:assert/strict';
import { test } from 'node:test';

import sharp from 'sharp';

import type { GenerateImageInput } from './image.schemas.js';
import {
  buildColoredTextSvg,
  calculateGridDimensions,
  escapeXml,
  generateColoredTextPng,
  selectCharacter,
} from './colored-text.generator.js';

const settings: GenerateImageInput = {
  columns: 20,
  characterSet: '@. ',
  fontFamily: 'monospace',
  backgroundColor: '#000000',
};

test('grid preserves source ratio after accounting for monospace cell ratio', () => {
  const grid = calculateGridDimensions(400, 200, 100);
  assert.deepEqual(grid, { columns: 100, rows: 25, glyphs: 2_500, width: 800, height: 400 });
  assert.equal(grid.width / grid.height, 2);
});

test('grid rejects work above the configured glyph limit', () => {
  assert.throws(
    () => calculateGridDimensions(1, 1_000, 300),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      (error as { code: unknown }).code === 'GENERATION_TOO_COMPLEX',
  );
});

test('luminance selects the character ramp from dense to light', () => {
  assert.equal(selectCharacter(0, '@. '), '@');
  assert.equal(selectCharacter(128, '@. '), '.');
  assert.equal(selectCharacter(255, '@. '), ' ');
});

test('SVG output converts characters to safe vector paths and preserves sampled RGB colors', () => {
  const svg = buildColoredTextSvg(Buffer.from([255, 0, 0, 0, 0, 255]), 2, 1, {
    ...settings,
    characterSet: '<& ',
  });

  assert.match(svg, /fill="rgb\(255,0,0\)"/);
  assert.match(svg, /fill="rgb\(0,0,255\)"/);
  assert.ok(svg.includes('<defs><path'));
  assert.ok(!svg.includes('<text'));
  assert.ok(!svg.includes('<script>'));
  assert.equal(
    escapeXml(`<tag attr="x">&'</tag>`),
    '&lt;tag attr=&quot;x&quot;&gt;&amp;&apos;&lt;/tag&gt;',
  );
});

test('PNG generation is deterministic and uses the calculated dimensions', async () => {
  const source = await sharp({
    create: { width: 40, height: 20, channels: 3, background: { r: 180, g: 30, b: 90 } },
  })
    .png()
    .toBuffer();
  const first = await generateColoredTextPng(source, settings);
  const second = await generateColoredTextPng(source, settings);
  const metadata = await sharp(first.buffer).metadata();

  assert.equal(first.width, 160);
  assert.equal(first.height, 80);
  assert.equal(first.rows, 5);
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, first.width);
  assert.equal(metadata.height, first.height);
  assert.deepEqual(first.buffer, second.buffer);
});
