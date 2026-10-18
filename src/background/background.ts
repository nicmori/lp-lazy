chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'AUDIT_SELLER') {
    void (async () => {
      try {
        const auditResults = await auditSellerStorefront(message.sellerId);
        sendResponse({ auditResults });
      } catch (error) {
        console.warn('AUDIT_SELLER failed while background context was active:', error);
        sendResponse({ auditResults: null });
      }
    })();
    return true;
  }

  return false;
});

async function auditSellerStorefront(sellerId: string) {
  try {
    const url = `https://www.tcgplayer.com/search/all/product?seller=${sellerId}&view=grid`;
    const res = await fetch(url);
    const html = await res.text();

    const lpMatches = (html.match(/Light Play/gi) || []).length;
    const nmMatches = (html.match(/Near Mint/gi) || []).length;
    const totalSampled = lpMatches + nmMatches;

    return {
      totalSampled,
      lpMatches,
      lpRatio: totalSampled > 0 ? lpMatches / totalSampled : 0,
    };
  } catch (err) {
    console.error('Storefront audit error:', err);
    return null;
  }
}