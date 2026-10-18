import { parseProductSetRecency, parseListingRow } from './parser';
import { registerObservation, evaluateSeller } from './aggregator';
import { injectBadge } from './badge';

const isRecentSet = parseProductSetRecency();

async function processPageListings() {
  const listingRows = document.querySelectorAll('.product-listing, [data-testid="listing-row"]');

  for (const row of listingRows) {
    if (row.getAttribute('data-nm-scanned')) continue;
    row.setAttribute('data-nm-scanned', 'true');

    const obs = parseListingRow(row, isRecentSet);
    if (!obs) continue;

    const profile = await registerObservation(obs);
    let evalResult = evaluateSeller(profile);

    if (!evalResult.shouldBadge && obs.condition.toLowerCase().includes('light play') && !profile.audited) {
      chrome.runtime.sendMessage(
        { type: 'AUDIT_SELLER', sellerId: obs.sellerId },
        (response) => {
          if (response && response.auditResults) {
            profile.audited = true;
            profile.auditResults = response.auditResults;
            evalResult = evaluateSeller(profile);
            injectBadge(row, evalResult);
          }
        }
      );
    } else {
      injectBadge(row, evalResult);
    }
  }
}

const observer = new MutationObserver(() => processPageListings());
observer.observe(document.body, { childList: true, subtree: true });

processPageListings();