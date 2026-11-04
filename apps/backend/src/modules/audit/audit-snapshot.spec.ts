import { Prisma } from '@prisma/client';
import { auditSnapshot, auditUserAgent } from './audit-snapshot';

describe('Audit snapshot declared non-sensitive fields', () => {
  it('keeps nested business metadata and drops secrets, URLs, contact PII and free text', () => {
    const result = auditSnapshot({
      id: 'request-1', status: 'COMPLETED', totalRon: new Prisma.Decimal('1234.50'),
      user: { id: 'user-1', role: 'CLIENT', name: 'Private Name', email: 'private@example.invalid', phone: '0712345678', passwordHash: 'hash', accessToken: 'jwt', refresh_token: 'refresh' },
      company: { id: 'company-1', status: 'APPROVED', addressText: 'Private address', lat: 47, lng: 27, cui: 'RO123', iban: 'RO49...' },
      attachments: [{ id: 'attachment-1', status: 'SAFE', sizeBytes: 321, mimeType: 'application/pdf', filename: 'private-name.pdf', downloadUrl: 'https://store/file?X-Amz-Signature=secret' }],
      metadata: { threadId: 'thread-1', messageId: 'message-1', createdAt: new Date('2026-01-01T00:00:00Z'), body: 'private message', text: 'private text', content: { id: 'hidden' }, cookie: 'session', authorization: 'Bearer jwt' },
      title: 'Private project', comment: 'private review', customReason: 'private', unknownNewField: 'secret', checkoutUrl: 'https://stripe/secret', password: 'secret', token: 'secret', headers: { cookie: 'secret' },
    });
    expect(result).toEqual({ id: 'request-1', status: 'COMPLETED', totalRon: '1234.5', user: { id: 'user-1', role: 'CLIENT' }, company: { id: 'company-1', status: 'APPROVED' }, attachments: [{ id: 'attachment-1', status: 'SAFE', sizeBytes: 321, mimeType: 'application/pdf' }], metadata: { threadId: 'thread-1', messageId: 'message-1', createdAt: '2026-01-01T00:00:00.000Z' } });
  });

  it('rejects secret-like or contact values even under allowed scalar fields', () => {
    expect(auditSnapshot({ id: 'private@example.invalid', status: 'https://host/?token=secret', paymentIntentId: 'pi_123_secret_456', amount: 'not a number', createdAt: 'not a date' })).toBeUndefined();
  });

  it('preserves financial refs, zero values, false and null without retaining checkout secrets', () => {
    expect(auditSnapshot({ stripeSessionId: 'cs_test_123', paymentIntentId: 'pi_123', totalRon: 0, credits: null, isActive: false, invoiceNumber: 10, invoiceSeries: 'MM', invoiceLabel: 'MM-10', checkoutUrl: 'secret' })).toEqual({ stripeSessionId: 'cs_test_123', paymentIntentId: 'pi_123', totalRon: 0, credits: null, isActive: false, invoiceNumber: 10, invoiceSeries: 'MM', invoiceLabel: 'MM-10' });
  });

  it.each([['vat_rate', '21'], ['trial_enabled', 'false'], ['trial_plan', 'PLATINUM'], ['invoice_series', 'MM']])('preserves explicitly reviewed setting %s', (key, value) => {
    expect(auditSnapshot({ key, value })).toEqual({ key, value });
  });

  it.each(['seller_name', 'seller_cui', 'seller_reg_com', 'seller_address', 'seller_iban'])('keeps setting key but omits sensitive value %s', (key) => {
    expect(auditSnapshot({ key, value: 'Private value' })).toEqual({ key });
  });

  // E-admin-platform-4
  it('keeps seller readiness flags/codes but never the seller values', () => {
    const result = auditSnapshot({
      ready: false, stripeMode: 'test', eInvoicePendingCount: 3,
      problems: [{ field: 'iban', reason: 'PLACEHOLDER' }, { field: 'cui', reason: 'INVALID' }],
      name: 'Firma Reala SRL', cui: 'RO12345674', iban: 'RO08TEST0000000000000001', address: 'Str. Reala 1',
    });
    expect(result).toEqual({ ready: false, stripeMode: 'test', eInvoicePendingCount: 3, problems: [{ field: 'iban', reason: 'PLACEHOLDER' }, { field: 'cui', reason: 'INVALID' }] });
    expect(JSON.stringify(result)).not.toContain('RO08');
    expect(auditSnapshot({ id: 'o1', testMode: true, eInvoiceStatus: 'UPLOADED', anafUploadId: '5001234567', eInvoiceUpdatedAt: new Date('2026-09-29T10:00:00Z') })).toEqual({ id: 'o1', testMode: true, eInvoiceStatus: 'UPLOADED', anafUploadId: '5001234567', eInvoiceUpdatedAt: '2026-09-29T10:00:00.000Z' });
  });

  // E-admin-platform-2
  it('keeps accepted legal versions and moment, omits the contact email value', () => {
    expect(auditSnapshot({ id: 'user-1', termsVersion: '2026-09-29', privacyVersion: '2026-09-29', termsAcceptedAt: new Date('2026-09-29T10:00:00Z'), email: 'private@example.invalid' })).toEqual({ id: 'user-1', termsVersion: '2026-09-29', privacyVersion: '2026-09-29', termsAcceptedAt: '2026-09-29T10:00:00.000Z' });
    expect(auditSnapshot({ key: 'legal_contact_email', value: 'contact@cozy.test' })).toEqual({ key: 'legal_contact_email' });
    expect(auditSnapshot({ key: 'legal_identity_published', value: 'true' })).toEqual({ key: 'legal_identity_published', value: 'true' });
    // hotfix 2026-10-04: comutarea re-acceptarii ramane vizibila in audit
    expect(auditSnapshot({ key: 'legal_reaccept_existing_users', value: 'true' })).toEqual({ key: 'legal_reaccept_existing_users', value: 'true' });
  });

  // E-client-9
  it('keeps firm location ids and radii only, never address or coordinates', () => {
    const result = auditSnapshot({
      id: 'company-1', status: 'APPROVED', name: 'Firma',
      locations: [{ id: 'loc-1', addressText: 'Str. Privata 1', city: 'Cluj', county: 'Cluj', lat: 46.77, lng: 23.59, coverageRadiusKm: 50 }],
    });
    expect(result).toEqual({ id: 'company-1', status: 'APPROVED', locations: [{ id: 'loc-1', coverageRadiusKm: 50 }] });
    expect(auditSnapshot({ key: 'marketplace_distance_display', value: 'BAND' })).toEqual({ key: 'marketplace_distance_display', value: 'BAND' });
    expect(auditSnapshot({ key: 'marketplace_distance_display', value: 'EXACT' })).toEqual({ key: 'marketplace_distance_display' });
    expect(auditSnapshot({ key: 'company_locations_max', value: '10' })).toEqual({ key: 'company_locations_max', value: '10' });
    expect(auditSnapshot({ key: 'company_location_changes_per_day', value: '20' })).toEqual({ key: 'company_location_changes_per_day', value: '20' });
  });

  it('omits unknown settings, raw scalar responses and cyclic/deep payloads safely', () => {
    expect(auditSnapshot({ key: 'future_secret_setting', value: 'secret' })).toBeUndefined();
    expect(auditSnapshot('private message')).toBeUndefined();
    const cyclic: Record<string, unknown> = { id: 'user-1' }; cyclic.user = cyclic;
    expect(auditSnapshot(cyclic)).toEqual({ id: 'user-1' });
    expect(auditSnapshot(Array.from({ length: 500 }, (_, id) => ({ id: String(id) })))).toHaveLength(100);
  });

  it('E-company-19: PATCH /companies/me keeps isVatPayer, drops the firm name, address and CUI', () => {
    expect(auditSnapshot({ id: 'company-1', status: 'APPROVED', isVatPayer: true, name: 'Firma SRL', cui: '7850265', addressText: 'Str. X', members: [{ email: 'a@b.ro' }] })).toEqual({ id: 'company-1', status: 'APPROVED', isVatPayer: true });
  });

  it('normalizes user agents rather than persisting arbitrary headers', () => {
    expect(auditUserAgent('Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36 private@example.invalid')).toBe('Chrome/130.0.0.0');
    expect(auditUserAgent('Bearer secret-token')).toBe('other');
    expect(auditUserAgent('stripe-webhook')).toBe('stripe-webhook');
    expect(auditUserAgent('bank-transfer-expiry')).toBe('bank-transfer-expiry');
    expect(auditUserAgent(null)).toBeNull();
  });
});

// E-admin-platform-58: planuri ca date — codul, functiile si isFree intra in audit; numele (text liber) nu
describe('Audit snapshot for subscription plans', () => {
  it('keeps plan code, prices, flags and feature toggles but drops free-text names', () => {
    const result = auditSnapshot({
      id: 'plan-1', code: 'TEST_FREE', tier: 'TEST_FREE', nameRo: 'Plan privat', nameEn: 'Private plan',
      priceRon: 0, includedCredits: 0, marketplaceGatingDelayMin: 60, isActive: true, isFree: true,
      features: { MARKETPLACE_ACCESS: { enabled: false, limit: null }, UNKNOWN_FEATURE: { enabled: true } },
    });
    expect(result).toEqual({
      id: 'plan-1', code: 'TEST_FREE', tier: 'TEST_FREE', priceRon: 0, includedCredits: 0, marketplaceGatingDelayMin: 60,
      isActive: true, isFree: true, features: { MARKETPLACE_ACCESS: { enabled: false, limit: null } },
    });
  });

  it.each([['TEST_FREE', 'TEST_FREE'], ['GOLD', 'GOLD'], ['not a code', undefined]])('trial_plan %s is kept only as a plan code', (value, kept) => {
    expect(auditSnapshot({ key: 'trial_plan', value })).toEqual(kept === undefined ? { key: 'trial_plan' } : { key: 'trial_plan', value: kept });
  });
});
