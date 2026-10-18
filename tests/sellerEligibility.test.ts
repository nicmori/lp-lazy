import test from 'node:test';
import assert from 'node:assert/strict';

import { describeSellerEligibility } from '../src/content/aggregator.ts';
import type { SellerProfile } from '../src/types/index.ts';

test('describeSellerEligibility includes the LP bulk-lister status for eligible sellers', () => {
  const profile: SellerProfile = {
    sellerId: 'seller-1',
    sellerName: 'Test Seller',
    observations: [
      {
        sellerName: 'Test Seller',
        sellerId: 'seller-1',
        condition: 'Light Play',
        quantity: 8,
        isRecentSet: true,
        timestamp: Date.now(),
      },
    ],
  };

  const result = describeSellerEligibility(profile, {
    shouldBadge: true,
    confidence: 'HIGH',
    score: 90,
    reasons: ['Multiple recent set LP listings (2x)'],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.status, '🎯 Stealth NM');
  assert.deepEqual(result.reasons, ['Multiple recent set LP listings (2x)']);
});

test('describeSellerEligibility explains why a seller is not eligible', () => {
  const profile: SellerProfile = {
    sellerId: 'seller-2',
    sellerName: 'Low Signal Seller',
    observations: [],
  };

  const result = describeSellerEligibility(profile, {
    shouldBadge: false,
    confidence: 'NONE',
    score: 10,
    reasons: [],
  });

  assert.equal(result.eligible, false);
  assert.equal(result.status, 'Not eligible');
  assert.match(result.reasons[0], /minimum|threshold|No LP bulk-lister signal/i);
});
