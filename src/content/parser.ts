import type { ListingObservation } from '../types/index.ts';

export function parseProductSetRecency(): boolean {
  const setElement = document.querySelector(
    '.product-details__set, .bread-crumbs__item:nth-last-child(2), [data-testid="set-name"], .set-name'
  );
  const setName = setElement?.textContent?.trim().toLowerCase() || '';
  const pageText = document.body.textContent?.toLowerCase() || '';

  const RECENT_KEYWORDS = [
    'surging sparks',
    'stellar crown',
    'twilight masquerade',
    'prismatic evolutions',
    '2024',
    '2025',
    '2026',
  ];

  return RECENT_KEYWORDS.some((kw) => setName.includes(kw) || pageText.includes(kw));
}

export function findListingRows(): Element[] {
  const selectors = [
    '.product-listing',
    '[data-testid="listing-row"]',
    '[data-testid="product-listing"]',
    '[class*="listing-row"]',
    '[class*="product-listing"]',
    'article',
    'li',
    'tr',
  ];

  const directRows = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const deduped = [...new Set(directRows)];

  if (deduped.length > 0) {
    return deduped.filter((row) => {
      const text = (row.textContent || '').toLowerCase();
      const hasSellerPattern = /seller|near mint|light play|condition/i.test(text);
      const hasLink = !!row.querySelector('a[href*="seller"], a[href*="/seller/"]');
      return hasSellerPattern || hasLink;
    });
  }

  const fallbackLinks = Array.from(document.querySelectorAll('a[href*="seller"], a[href*="/seller/"]'));
  return fallbackLinks
    .map((link) => link.closest('article, li, tr, div'))
    .filter((node): node is Element => Boolean(node));
}

export function parseListingRow(row: Element, isRecentSet: boolean): ListingObservation | null {
  const sellerAnchor = row.querySelector(
    'a[href*="seller"], a[href*="/seller/"], a.seller-info__name, [data-testid="seller-name"], [class*="seller-name"], [class*="seller-info"] a'
  ) as HTMLAnchorElement | null;
  const conditionElement = row.querySelector(
    '.product-listing__condition, [data-testid="lblCondition"], [data-testid="condition"], [class*="condition"]'
  );
  const qtyElement = row.querySelector(
    '.product-listing__quantity, .quantity-available, [data-testid="quantity"], [class*="quantity"]'
  );

  const sellerName = sellerAnchor?.textContent?.trim() || row.getAttribute('data-seller-name') || 'Unknown Seller';
  const href = sellerAnchor?.getAttribute('href') || row.getAttribute('data-seller-href') || '';
  const sellerIdMatch = href.match(/seller=([a-zA-Z0-9]+)/i) || href.match(/\/seller\/?([a-zA-Z0-9_-]+)/i);
  const sellerId = sellerIdMatch ? sellerIdMatch[1] : row.getAttribute('data-seller-id') || sellerName;

  const conditionText = conditionElement?.textContent?.trim() || row.textContent?.match(/(Light Play|Near Mint|NM|LP)/i)?.[0] || '';
  const condition = conditionText || 'Unknown';

  const qtyText = qtyElement?.textContent || row.textContent || '';
  const rawQtyMatch = qtyText.match(/(\d+)/);
  const quantity = rawQtyMatch ? parseInt(rawQtyMatch[1], 10) : 1;

  if (!sellerName || !href && !row.getAttribute('data-seller-id')) {
    return null;
  }

  return {
    sellerName,
    sellerId,
    condition,
    quantity,
    isRecentSet,
    timestamp: Date.now(),
  };
}