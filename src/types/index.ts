export interface ListingObservation {
  sellerName: string;
  sellerId: string;
  condition: string;
  quantity: number;
  isRecentSet: boolean;
  timestamp: number;
}

export interface SellerProfile {
  sellerId: string;
  sellerName: string;
  observations: ListingObservation[];
  audited?: boolean;
  auditResults?: {
    totalSampled: number;
    lpMatches: number;
    lpRatio: number;
  };
}

export interface EvaluationResult {
  shouldBadge: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'NONE';
  score: number;
  reasons: string[];
}

export interface SellerEligibilitySummary {
  sellerId: string;
  sellerName: string;
  eligible: boolean;
  status: '🎯 Stealth NM' | '⚡ Likely Conservative LP' | 'Not eligible';
  confidence: EvaluationResult['confidence'];
  score: number;
  reasons: string[];
}