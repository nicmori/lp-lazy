export async function registerObservation(obs) {
  const data = await chrome.storage.session.get(["sellerProfiles"]);
  const profiles = data.sellerProfiles || {};
  const profile = profiles[obs.sellerId] || {
    sellerId: obs.sellerId,
    sellerName: obs.sellerName,
    observations: []
  };
  profile.observations.push(obs);
  profiles[obs.sellerId] = profile;
  await chrome.storage.session.set({ sellerProfiles: profiles });
  return profile;
}
export function evaluateSeller(profile) {
  const total = profile.observations.length;
  const lpObs = profile.observations.filter((o) => o.condition.toLowerCase().includes("light play"));
  const lpCount = lpObs.length;
  let score = 0;
  const reasons = [];
  const recentLpCount = lpObs.filter((o) => o.isRecentSet).length;
  if (recentLpCount >= 2) {
    score += 40;
    reasons.push(`Multiple recent set LP listings (${recentLpCount}x)`);
  } else if (recentLpCount === 1) {
    score += 15;
  }
  const bulkLpCount = lpObs.filter((o) => o.quantity >= 4).length;
  if (bulkLpCount >= 2) {
    score += 35;
    reasons.push("Multiple bulk/playset LP listings");
  } else if (bulkLpCount === 1) {
    score += 15;
  }
  if (total >= 3) {
    const ratio = lpCount / total;
    if (ratio >= 0.8) {
      score += 45;
      reasons.push(`High LP Concentration (${Math.round(ratio * 100)}% on page)`);
    }
  }
  if (profile.auditResults) {
    if (profile.auditResults.lpRatio >= 0.75 && profile.auditResults.totalSampled >= 8) {
      score += 50;
      reasons.push(`Storefront Audit Passed (${Math.round(profile.auditResults.lpRatio * 100)}% LP across inventory)`);
    }
  }
  const hasMinDataPoints = lpCount >= 2 || profile.auditResults && profile.auditResults.lpRatio >= 0.75;
  const shouldBadge = Boolean(hasMinDataPoints && score >= 60);
  return {
    shouldBadge,
    confidence: score >= 85 ? "HIGH" : shouldBadge ? "MEDIUM" : "NONE",
    score,
    reasons
  };
}
