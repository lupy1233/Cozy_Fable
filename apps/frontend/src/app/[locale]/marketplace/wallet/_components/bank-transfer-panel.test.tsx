import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { BillingOrderDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../../../../messages/ro.json';
import { BankTransferPanel } from './bank-transfer-panel';

// g4 (etapa 7): „Ți-am trimis proforma” doar cand e-mailul cu proforma atasata chiar a plecat.

const order = (over: Partial<BillingOrderDto> = {}): BillingOrderDto => ({
  id: 'abcdef12-3456-4789-8abc-def012345678', orderType: 'CREDIT_PACKAGE', status: 'PENDING', planTier: null,
  credits: 100, baseAmountRon: 100, vatRate: 21, vatAmountRon: 21, totalRon: 121, invoiceSeries: null,
  invoiceNumber: null, invoiceLabel: null, paymentSource: null, hasStripeSession: false,
  createdAt: '2026-11-14T10:00:00.000Z', confirmedAt: null, testMode: false, paymentClaimedAt: null,
  transferExpiresAt: null, ...over,
});

function show(o: BillingOrderDto) {
  render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <BankTransferPanel
        order={o}
        bankTransfer={undefined}
        billingReady
        markPaidPending={false}
        markPaidError={null}
        onMarkPaid={vi.fn()}
        downloadingProforma={false}
        onDownloadProforma={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

describe('BankTransferPanel — textul despre proforma (g4)', () => {
  it('proforma a plecat atasata → „ți-am trimis”', () => {
    show(order({ proformaEmailedAt: '2026-11-14T10:01:00.000Z' }));
    expect(screen.getByText(ro.Billing.bankTransfer.emailed)).toBeInTheDocument();
  });

  it('nemarcata sau comanda veche (camp lipsa) → fara promisiune, cu indemnul de descarcare', () => {
    show(order({ proformaEmailedAt: null }));
    expect(screen.getByText(ro.Billing.bankTransfer.emailedNoProforma)).toBeInTheDocument();
    expect(screen.queryByText(ro.Billing.bankTransfer.emailed)).not.toBeInTheDocument();
  });

  it('revizie m11: comanda veche (camp lipsa) → textul nu pretinde nimic despre e-mail (nici „trimis”, nici „trimitem”)', () => {
    show(order());
    expect(screen.getByText(ro.Billing.bankTransfer.emailedNoProforma)).toBeInTheDocument();
    expect(ro.Billing.bankTransfer.emailedNoProforma).not.toMatch(/e-?mail/i);
    expect(screen.queryByText(/trimis pe email|trimitem pe email/i)).not.toBeInTheDocument();
  });
});
