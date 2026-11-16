/**
 * Future SaaS Growth & Tiering Scaffold (Dormant / Free-Access Mode).
 * Payments remain intentionally disabled; all 30 PDF tools and citizen utilities
 * remain 100% free and active until server-side billing webhooks are activated later.
 */
export type SaasPlanTier = 'free_unlimited' | 'pro_csc' | 'enterprise';

export interface SaasEntitlements {
  billingActive: boolean;
  plan: SaasPlanTier;
  maxBatchFiles: number;
  maxPdfSizeMb: number;
  dailyAiPosterQuota: number;
}

export const SAAS_BILLING_ENABLED = false;

export function getActiveSaasEntitlements(_plan: SaasPlanTier = 'free_unlimited'): SaasEntitlements {
  return {
    billingActive: SAAS_BILLING_ENABLED,
    plan: 'free_unlimited',
    maxBatchFiles: 50,
    maxPdfSizeMb: 50,
    dailyAiPosterQuota: 100,
  };
}
