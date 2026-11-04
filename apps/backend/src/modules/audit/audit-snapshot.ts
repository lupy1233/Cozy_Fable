import { Prisma } from '@prisma/client';
import { PLAN_CODE_RE, PLAN_FEATURE_KEYS } from '@marketplace/shared';

// Invarianta 3.9: schema explicita pentru snapshots, nu blacklist de secrete.
// Campurile noi nu intra automat in audit; adaugarea lor cere review de sensibilitate.
const IDS = new Set(['id', 'userId', 'companyId', 'requestId', 'claimSlotId', 'threadId', 'chatThreadId', 'messageId', 'quoteId', 'quoteVersionId', 'acceptedVersionId', 'attachmentId', 'withdrawalId', 'reviewId', 'disputeId', 'orderId', 'paymentId', 'planId', 'packageId', 'subscriptionId', 'invoiceId', 'createdByUserId', 'requestedByUserId', 'reviewedByUserId', 'resolvedByUserId', 'assignedToUserId', 'clientUserId', 'paymentIntentId', 'stripePaymentIntentId', 'stripeSessionId', 'anafUploadId', 'anafDownloadId']);
const CODES = new Set(['status', 'role', 'memberRole', 'type', 'orderType', 'tier', 'planTier', 'currency', 'roomType', 'size', 'reasonType', 'ruleKey', 'paymentSource', 'source', 'invoiceSeries', 'invoiceLabel', 'queue', 'creditOutcome', 'reason', 'openedBy', 'response', 'termsVersion', 'privacyVersion', 'eInvoiceStatus', 'field', 'stripeMode', 'code']);
const NUMBERS = new Set(['amount', 'amountRon', 'price', 'priceRon', 'baseAmountRon', 'vatRate', 'vatAmountRon', 'totalRon', 'credits', 'includedCredits', 'bonusCredits', 'reservedCredits', 'availableCredits', 'claimCostCreditsSnapshot', 'points', 'pointsApplied', 'penaltyPoints', 'minScore', 'maxScore', 'gatingDelayMinutes', 'marketplaceGatingDelayMin', 'daysLeft', 'durationDays', 'sizeBytes', 'version', 'extraVersionsCount', 'count', 'invoiceNumber', 'rating', 'maxClaims', 'attempts', 'eInvoicePendingCount', 'weight', 'previousWeight', 'coverageRadiusKm', 'limit', 'limitValue']);
const FLAGS = new Set(['ok', 'success', 'isActive', 'active', 'isTrial', 'published', 'featured', 'refunded', 'approved', 'suspended', 'disputed', 'dismissed', 'autoCompleted', 'hasStripeSession', 'stripeEnabled', 'readOnly', 'replayed', 'testMode', 'ready', 'isWorkingDay', 'isVatPayer', 'isFree', 'enabled']);
const DATES = new Set(['createdAt', 'updatedAt', 'startedAt', 'expiresAt', 'confirmedAt', 'paidAt', 'reviewedAt', 'resolvedAt', 'acceptedAt', 'withdrawnAt', 'deliveredAt', 'suspendedAt', 'suspendedUntil', 'blockedAt', 'deletedAt', 'sentAt', 'validUntil', 'slaDeadlineAt', 'assignDeadlineAt', 'cancelledAt', 'termsAcceptedAt', 'eInvoiceUpdatedAt', 'date', 'paymentClaimedAt', 'transferExpiresAt']);
// E-admin-platform-25: 'date' (zi din calendarul de lucru), 'isWorkingDay', 'weight' + 'previousWeight' (puncte marime proiect, inainte/dupa); 'name' ramane afara (text liber).
// E-admin-platform-4: 'problems' (readiness) pastreaza doar field/reason — valorile seller_* nu intra in audit.
// E-client-9: 'locations' + 'coverageRadiusKm' — auditul locatiilor firmei pastreaza doar id-urile si razele;
// adresa (addressText/city/county) si coordonatele (lat/lng) raman afara (localizare).
// E-company-19: 'isVatPayer' (PATCH /companies/me); numele/adresa firmei raman afara (text liber).
// E-company-24: 'paymentClaimedAt'/'transferExpiresAt' (comenzi prin transfer); billingEmail ramane afara (PII).
// E-admin-platform-58: planuri ca date — 'code' (codul planului), 'features' + cheile din registru
// (PLAN_FEATURE_KEYS) cu enabled/limit, 'isFree'; nameRo/nameEn raman afara (text liber, ca 'name').
const CONTAINERS = new Set(['order', 'subscription', 'plan', 'package', 'company', 'user', 'request', 'quote', 'versions', 'attachments', 'withdrawal', 'review', 'dispute', 'result', 'items', 'metadata', 'problems', 'locations', 'features', ...PLAN_FEATURE_KEYS]);
const NUMERIC_SETTINGS = new Set(['quote_validity_default_days', 'consultation_invite_expiry_days', 'company_penalty_threshold', 'company_suspension_months', 'eur_ron_rate', 'vat_rate', 'trial_duration_days', 'trial_bonus_credits', 'max_claims_per_request', 'expired_offer_autoclose_days', 'delivery_reminder_days_before', 'completed_claim_contact_retention_days', 'company_locations_max', 'company_location_changes_per_day', 'credit_value_ron', 'claim_cost_min', 'claim_cost_max', 'bank_transfer_reminder_days', 'bank_transfer_expiry_days']);
const SETTING_KEYS = new Set([...NUMERIC_SETTINGS, 'trial_enabled', 'trial_plan', 'invoice_series', 'expired_offer_autoclose_enabled', 'claims_open_after_first_offer', 'expired_offer_autoclose_credit_outcome', 'seller_name', 'seller_cui', 'seller_reg_com', 'seller_address', 'seller_iban', 'legal_contact_email', 'legal_identity_published', 'legal_reaccept_existing_users', 'claim_contact_reveal_policy', 'pre_claim_contact_text_policy', 'marketplace_distance_display']);
const OPAQUE = /^[a-zA-Z0-9_-]{1,128}$/;
const NUMBER = /^-?\d{1,15}(?:\.\d{1,8})?$/;
const SECRET_VALUE = /(?:secret|token|password|bearer)[\s:=_-]/i;

function numeric(value: unknown): number | string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const text = Prisma.Decimal.isDecimal(value) ? value.toString() : value;
  return typeof text === 'string' && NUMBER.test(text) ? text : undefined;
}

function settingValue(key: unknown, value: unknown): unknown {
  if (typeof key !== 'string') return undefined;
  if (NUMERIC_SETTINGS.has(key)) return numeric(value);
  if ((key === 'trial_enabled' || key === 'expired_offer_autoclose_enabled' || key === 'legal_identity_published' || key === 'legal_reaccept_existing_users' || key === 'claims_open_after_first_offer') && (value === true || value === false || value === 'true' || value === 'false')) return value;
  if (key === 'expired_offer_autoclose_credit_outcome' && (value === 'REFUND' || value === 'CONSUME' || value === 'UNSET')) return value;
  if (key === 'claim_contact_reveal_policy' && (value === 'ON_CLAIM' || value === 'AFTER_GRACE')) return value;
  if (key === 'pre_claim_contact_text_policy' && (value === 'MASK' || value === 'BLOCK')) return value;
  if (key === 'marketplace_distance_display' && (value === 'KM' || value === 'BAND')) return value;
  if (key === 'trial_plan' && typeof value === 'string' && PLAN_CODE_RE.test(value)) return value;
  if (key === 'invoice_series' && typeof value === 'string' && /^[A-Z0-9-]{1,20}$/.test(value)) return value;
  return undefined;
}

export function auditSnapshot(input: unknown): Prisma.InputJsonValue | undefined {
  const seen = new WeakSet<object>();
  let remaining = 2000;
  const visit = (value: unknown, depth: number): unknown => {
    if (depth > 6 || remaining-- <= 0 || value == null || typeof value !== 'object') return undefined;
    if (seen.has(value)) return undefined;
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 100).map((item) => visit(item, depth + 1)).filter((item) => item !== undefined);
    const output: Record<string, unknown> = {};
    const source = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(source)) {
      let safe: unknown;
      if (IDS.has(key) || CODES.has(key)) {
        if (item === null || (typeof item === 'string' && OPAQUE.test(item) && !SECRET_VALUE.test(item))) safe = item;
      } else if (NUMBERS.has(key)) safe = numeric(item);
      else if (FLAGS.has(key) && (typeof item === 'boolean' || item === null)) safe = item;
      else if (DATES.has(key)) {
        const date = item instanceof Date ? item : typeof item === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(item) ? new Date(item) : null;
        if (item === null) safe = null;
        else if (date && Number.isFinite(date.getTime())) safe = date.toISOString();
      } else if (key === 'mimeType' && typeof item === 'string' && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(item)) safe = item;
      else if (key === 'key' && typeof item === 'string' && SETTING_KEYS.has(item)) safe = item;
      else if (key === 'value') safe = settingValue(source.key, item);
      else if (CONTAINERS.has(key)) safe = visit(item, depth + 1);
      if (safe !== undefined) output[key] = safe;
    }
    return Object.keys(output).length ? output : undefined;
  };
  return visit(input, 0) as Prisma.InputJsonValue | undefined;
}

// User-Agent este controlat de client: retinem familia/versiunea, nu text arbitrar.
export function auditUserAgent(value?: string | null): string | null {
  if (!value) return null;
  // markerii joburilor de sistem (fara browser): webhook Stripe, anularea automata a transferurilor (E-company-24)
  if (value === 'stripe-webhook' || value === 'bank-transfer-expiry') return value;
  for (const browser of ['Edg', 'Firefox', 'Chrome', 'Version', 'curl', 'PostmanRuntime']) {
    const match = value.slice(0, 2048).match(new RegExp(`(?:^|[\\s(])${browser}/(\\d+(?:\\.\\d+){0,3})(?:[\\s;)]|$)`));
    if (match) return `${browser === 'Version' ? 'Safari' : browser}/${match[1]}`;
  }
  return 'other';
}
