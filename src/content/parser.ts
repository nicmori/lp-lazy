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

export function extractSellerIdentityFromHref(href: string): { sellerName: string; sellerId: string } | null {
  if (!href) {
    return null;
  }

  const sellerNameMatch = href.match(/\/sellers\/([^/?#]+)/i) || href.match(/seller=([^&?#]+)/i);
  if (!sellerNameMatch) {
    return null;
  }

  const sellerName = decodeURIComponent(sellerNameMatch[1].replace(/[-_]/g, ' ')).trim();
  const sellerId = decodeURIComponent(sellerNameMatch[1]).trim();
  return sellerName ? { sellerName, sellerId } : null;
}

export function findListingRows(): Element[] {
  const selectors = [
    '.product-listing',
    '[data-testid="listing-row"]',
    '[data-testid="product-listing"]',
    '[class*="listing-row"]',
    '[class*="product-listing"]',
    '[class*="seller-info"]',
    '[class*="seller-profile"]',
    'a[href*="/sellers/"]',
    'a[href*="seller="]',
    'article',
    'li',
    'tr',
  ];

  const directRows = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const deduped = [...new Set(directRows)];

  if (deduped.length > 0) {
    return deduped.filter((row) => {
      const text = (row.textContent || '').toLowerCase();
      const hasSellerPattern = /seller|sellers|near mint|light play|condition/i.test(text);
      const hasSellerLink = !!row.querySelector('a[href*="seller"], a[href*="/seller/"], a[href*="/sellers/"]');
      const hasSellerInfo = !!row.closest('[class*="seller-info"], [class*="seller-profile"], [class*="spotlight__seller"]');
      return hasSellerPattern || hasSellerLink || hasSellerInfo;
    });
  }

  const fallbackLinks = Array.from(document.querySelectorAll('a[href*="/sellers/"], a[href*="seller="]'));
  return fallbackLinks
    .map((link) => link.closest('article, li, tr, section, div'))
    .filter((node): node is Element => Boolean(node));
}

export function parseListingRow(row: Element, isRecentSet: boolean): ListingObservation | null {
  const sellerAnchor = (row.matches && row.matches('a[href*="seller"], a[href*="/seller/"], a[href*="/sellers/"]')
    ? row as HTMLAnchorElement
    : row.querySelector(
        'a[href*="seller"], a[href*="/seller/"], a[href*="/sellers/"], a.seller-info__name, [data-testid="seller-name"], [class*="seller-name"], [class*="seller-info"] a'
      ) as HTMLAnchorElement | null);
  const conditionElement = row.querySelector(
    '.product-listing__condition, [data-testid="lblCondition"], [data-testid="condition"], [class*="condition"]'
  );
  const qtyElement = row.querySelector(
    '.product-listing__quantity, .quantity-available, [data-testid="quantity"], [class*="quantity"]'
  );

  const href = sellerAnchor?.getAttribute('href') || row.getAttribute('data-seller-href') || '';
  const sellerIdentity = href ? extractSellerIdentityFromHref(href) : null;
  const sellerName = sellerAnchor?.textContent?.trim() || sellerIdentity?.sellerName || row.getAttribute('data-seller-name') || 'Unknown Seller';
  const sellerId = sellerIdentity?.sellerId || row.getAttribute('data-seller-id') || sellerName;

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