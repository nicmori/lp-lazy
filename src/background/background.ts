chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'AUDIT_SELLER') {
    auditSellerStorefront(message.sellerId).then((auditResults) => {
      sendResponse({ auditResults });
    });
    return true;
  }
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