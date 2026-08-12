import assert from 'node:assert/strict';
import test from 'node:test';

import { revealedGlyphCount } from './animated-text-video.generator.js';

test('video reveal advances in row-major glyph order and finishes completely', () => {
  const counts = Array.from({ length: 5 }, (_, frame) => revealedGlyphCount(frame, 5, 12));
  assert.deepEqual(counts, [0, 3, 6, 9, 12]);
});

test('video reveal clamps frames before and after the animation', () => {
  assert.equal(revealedGlyphCount(-1, 10, 100), 0);
  assert.equal(revealedGlyphCount(20, 10, 100), 100);
});
