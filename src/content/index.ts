import { parseProductSetRecency, parseListingRow, findListingRows } from './parser';
import { registerObservation, evaluateSeller, applyAuditResult } from './aggregator';
import { injectBadge } from './badge';

const isRecentSet = parseProductSetRecency();
let scanRetries = 0;
let pageTimer: number | undefined;

function schedulePageScan(delay = 1500) {
  if (pageTimer) {
    window.clearTimeout(pageTimer);
  }

  pageTimer = window.setTimeout(() => {
    void processPageListings();
  }, delay);
}

function isRuntimeAvailable(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function setScanStatus(
  state: 'scanning' | 'done' | 'idle',
  message: string,
  sellers: string[] = [],
  currentSeller?: string,
  details?: string
) {
  if (!isRuntimeAvailable()) {
    return;
  }

  try {
    void chrome.storage.local.set({
      scanStatus: {
        state,
        message,
        sellers,
        currentSeller: currentSeller || null,
        details: details || '',
        updatedAt: Date.now(),
      },
    }).catch(() => {
      // The extension context can close while async scans are in flight.
    });
  } catch {
    // The extension context can close while async scans are in flight.
  }
}

function summarizeFlaggedSellers() {
  const flaggedRows = [...document.querySelectorAll('[data-lp-lazy-badged="true"]')];
  const sellers = flaggedRows
    .map((row) => row.getAttribute('data-lp-lazy-seller-name'))
    .filter((name): name is string => Boolean(name));

  return [...new Set(sellers)];
}

function completeScanIfReady(pendingAudits: { value: number }, finalize: () => void) {
  if (pendingAudits.value === 0) {
    finalize();
  }
}

async function processPageListings() {
  const listingRows = findListingRows();

  if (listingRows.length === 0) {
    scanRetries += 1;

    if (scanRetries < 5) {
      setScanStatus('scanning', `Waiting for listings to load (${scanRetries}/4)…`);
      schedulePageScan(1200);
      return;
    }

    scanRetries = 0;
    setScanStatus('done', 'Scan complete — no listings found on this page.', []);
    return;
  }

  scanRetries = 0;
  setScanStatus('scanning', 'Scanning sellers on this page…');

  const pendingAudits = { value: 0 };
  const finalize = () => {
    const sellers = summarizeFlaggedSellers();
    if (sellers.length > 0) {
      setScanStatus('done', `Scan complete — ${sellers.length} seller(s) flagged.`, sellers);
    } else {
      setScanStatus('done', 'Scan complete — no sellers were flagged.', []);
    }
  };

  for (const row of listingRows) {
    if (row.getAttribute('data-nm-scanned')) continue;
    row.setAttribute('data-nm-scanned', 'true');

    const obs = parseListingRow(row, isRecentSet);
    if (!obs) continue;

    setScanStatus(
      'scanning',
      `Scanning seller: ${obs.sellerName}`,
      summarizeFlaggedSellers(),
      obs.sellerName,
      `Checking ${obs.condition} listing for signals like recent-set concentration and bulk LP patterns.`
    );

    const profile = await registerObservation(obs);
    let evalResult = evaluateSeller(profile);

    if (!evalResult.shouldBadge && obs.condition.toLowerCase().includes('light play') && !profile.audited) {
      pendingAudits.value += 1;

      if (!isRuntimeAvailable()) {
        pendingAudits.value -= 1;
        injectBadge(row, evalResult, obs.sellerName);
      } else {
        chrome.runtime.sendMessage(
          { type: 'AUDIT_SELLER', sellerId: obs.sellerId },
          async (response) => {
            pendingAudits.value -= 1;

            if (chrome.runtime.lastError) {
              console.warn('Seller audit skipped because the extension context was invalidated:', chrome.runtime.lastError.message);
              completeScanIfReady(pendingAudits, finalize);
              return;
            }

            if (response && response.auditResults) {
              setScanStatus(
                'scanning',
                `Auditing seller: ${obs.sellerName}`,
                summarizeFlaggedSellers(),
                obs.sellerName,
                `Storefront audit: ${response.auditResults.lpMatches} LP vs ${response.auditResults.nmMatches || 0} NM samples.`
              );

              try {
                const nextProfile = applyAuditResult(profile, response.auditResults);
                const storage = chrome.storage.session || chrome.storage.local;
                const savedProfiles = (await storage.get(['sellerProfiles'])).sellerProfiles || {};
                savedProfiles[nextProfile.sellerId] = nextProfile;
                await storage.set({ sellerProfiles: savedProfiles });
                profile.audited = nextProfile.audited;
                profile.auditResults = nextProfile.auditResults;
                evalResult = evaluateSeller(profile);
              } catch {
                // This page may have been torn down while the async audit was still resolving.
              }
            }

            injectBadge(row, evalResult, obs.sellerName);
            completeScanIfReady(pendingAudits, finalize);
          }
        );
      }
    } else {
      injectBadge(row, evalResult, obs.sellerName);
    }
  }

  completeScanIfReady(pendingAudits, finalize);
}

const observer = new MutationObserver(() => {
  schedulePageScan(1000);
});
observer.observe(document.body, { childList: true, subtree: true });

schedulePageScan(1500);