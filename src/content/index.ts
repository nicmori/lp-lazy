import { parseProductSetRecency, parseListingRow, findListingRows } from './parser.ts';
import {
  registerObservation,
  evaluateSeller,
  applyAuditResult,
  describeSellerEligibility,
} from './aggregator.ts';
import { injectBadge } from './badge.ts';
import { canObserveDocument, getObservationRoot } from './domSafety.ts';

const isRecentSet = parseProductSetRecency();
let scanRetries = 0;
let pageTimer: number | undefined;

function schedulePageScan(delay = 1500) {
  if (document.readyState === 'loading' && !document.body) {
    return;
  }

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
  details?: string,
  sellerResults: ReturnType<typeof describeSellerEligibility>[] = []
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
        sellerResults,
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
  try {
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
    const checkedSellers = new Map<string, ReturnType<typeof describeSellerEligibility>>();
    const finalize = () => {
      const sellerResults = Array.from(checkedSellers.values());
      const sellers = sellerResults.map((seller) => seller.sellerName);
      const eligibleCount = sellerResults.filter((seller) => seller.eligible).length;
      if (sellerResults.length > 0) {
        setScanStatus(
          'done',
          `Scan complete — checked ${sellerResults.length} seller(s) (${eligibleCount} eligible).`,
          sellers,
          undefined,
          '',
          sellerResults
        );
      } else {
        setScanStatus('done', 'Scan complete — no sellers were checked.', [], undefined, '', []);
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
      checkedSellers.set(obs.sellerId, describeSellerEligibility(profile, evalResult));

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
                  checkedSellers.set(obs.sellerId, describeSellerEligibility(profile, evalResult));
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

      checkedSellers.set(obs.sellerId, describeSellerEligibility(profile, evalResult));
    }

    completeScanIfReady(pendingAudits, finalize);
  } catch (error) {
    console.warn('lp-lazy scan failed while processing the page:', error);
    setScanStatus('done', 'Scan stopped because the page changed while scanning.', []);
  }
}

function attachPageMutationObserver() {
  if (!canObserveDocument(document)) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachPageMutationObserver, { once: true });
    }
    return;
  }

  const root = getObservationRoot(document);
  if (!root) {
    return;
  }

  const observer = new MutationObserver(() => {
    try {
      schedulePageScan(1000);
    } catch (error) {
      console.warn('lp-lazy mutation observer failed:', error);
    }
  });

  observer.observe(root, { childList: true, subtree: true });
}

attachPageMutationObserver();

schedulePageScan(1500);