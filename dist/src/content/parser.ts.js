export function parseProductSetRecency() {
  const setElement = document.querySelector(".product-details__set, .bread-crumbs__item:nth-last-child(2)");
  const setName = setElement?.textContent?.trim().toLowerCase() || "";
  const RECENT_KEYWORDS = ["surging sparks", "stellar crown", "twilight masquerade", "prismatic evolutions", "2026"];
  return RECENT_KEYWORDS.some((kw) => setName.includes(kw));
}
export function parseListingRow(row, isRecentSet) {
  const sellerAnchor = row.querySelector("a.seller-info__name");
  const conditionElement = row.querySelector('.product-listing__condition, [data-testid="lblCondition"]');
  const qtyElement = row.querySelector(".product-listing__quantity, .quantity-available");
  if (!sellerAnchor || !conditionElement) return null;
  const sellerName = sellerAnchor.textContent?.trim() || "Unknown Seller";
  const href = sellerAnchor.getAttribute("href") || "";
  const sellerIdMatch = href.match(/seller=([a-zA-Z0-9]+)/);
  const sellerId = sellerIdMatch ? sellerIdMatch[1] : sellerName;
  const condition = conditionElement.textContent?.trim() || "";
  const rawQty = qtyElement?.textContent?.replace(/\D/g, "") || "1";
  const quantity = parseInt(rawQty, 10) || 1;
  return {
    sellerName,
    sellerId,
    condition,
    quantity,
    isRecentSet,
    timestamp: Date.now()
  };
}
