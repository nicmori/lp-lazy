import test from 'node:test';
import assert from 'node:assert/strict';

import { canObserveDocument } from '../src/content/domSafety.ts';

test('canObserveDocument returns false when no body exists before DOM is ready', () => {
  assert.equal(canObserveDocument({ body: null, readyState: 'loading' }), false);
});

test('canObserveDocument returns true when body is available', () => {
  assert.equal(canObserveDocument({ body: {} as HTMLBodyElement, readyState: 'interactive' }), true);
});
