import type { EvaluationResult } from '../types/index.ts';

export function injectBadge(row: Element, evalResult: EvaluationResult, sellerName: string) {
  if (!evalResult.shouldBadge) return;

  const targetContainer = row.querySelector('.seller-info') || row;
  let badge = targetContainer.querySelector('.tcg-nm-badge') as HTMLElement;

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'tcg-nm-badge';
    targetContainer.appendChild(badge);
  }

  row.setAttribute('data-lp-lazy-badged', 'true');
  row.setAttribute('data-lp-lazy-seller-name', sellerName);

  const isHigh = evalResult.confidence === 'HIGH';
  const bgColor = isHigh ? '#059669' : '#d97706';

  badge.textContent = isHigh ? '🎯 Stealth NM' : '⚡ Likely Conservative LP';
  badge.title = `Confidence Score: ${evalResult.score}\nFlags:\n- ${evalResult.reasons.join('\n- ')}`;

  badge.style.cssText = `
    background-color: ${bgColor};
    color: white;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    margin-left: 8px;
    display: inline-flex;
    align-items: center;
    cursor: help;
  `;
}