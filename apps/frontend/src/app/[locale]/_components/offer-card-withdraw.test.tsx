import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ClaimFirmActionsDto, QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { OfferCard, withdrawGraceHours } from './offer-card';

// a7 (etapa 7): dialogul de retragere a ofertei arata ACEEASI data ca fisa (termenul, fara
// gratie), gratia separat, iar pierderea si penalizarea la conditional.

const RULES = vi.hoisted(() => ({
  // revizie m6: regulile de azi au alta gratie (6h) decat preluarea (12h) — dialogul nu le foloseste
  sla: { workingDays: { SMALL: 3, MEDIUM: 3, LARGE: 5 }, graceHours: 6, clarificationExtensionWorkingDays: 1 },
  penalties: { points: { SLA_MISS: 3, VOLUNTARY_WITHDRAWAL: 1 } },
}));
vi.mock('@/hooks/use-legal', () => ({ useFirmRules: () => ({ data: RULES }), isFirmRules: () => true }));

vi.mock('@/hooks/use-quotes', () => {
  const stub = () => ({ mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() });
  return {
    useAcceptQuote: stub,
    useClientQuote: () => ({ data: undefined, isFetching: false, isLoading: false, isError: false, error: null }),
    useCreateConsultationInvite: stub,
    useEndNegotiation: stub,
    useExtendValidity: stub,
    useRejectChange: stub,
    useRequestChange: stub,
    useRequestExtension: stub,
    useRespondConsultationInvite: () => ({ ...stub(), variables: undefined }),
    useRefreshQuotes: () => vi.fn(),
    useWithdrawQuote: stub,
    useDeclineQuote: stub,
    useCreateQuote: stub,
    useReviseQuote: stub,
    useExtraVersion: stub,
    useReoffer: stub,
  };
});

const HOUR = 3_600_000;
const FUTURE = new Date(Date.now() + 10 * 24 * HOUR).toISOString();

function version(): QuoteVersionDto {
  return {
    id: 'v1', version: 1, isExtra: false, price: 10000, designFee: null, currency: 'RON',
    priceRon: 10000, priceEur: 2000, designFeeRon: null, designFeeEur: null, total: 10000, totalRon: 10000,
    totalEur: 2000, deliveryTerm: null, deliveryDate: null, warranty: null, description: 'Bucătărie',
    validUntil: FUTURE, isExpired: false, validityExtensionsUsed: 0, extensionRequestedAt: null,
    createdByUserId: 'u-firm', sentAt: new Date().toISOString(), changeRequest: null, attachments: [],
    roomPrices: [], vatMode: null, deliveryTermValue: null, deliveryTermUnit: null, warrantyMonths: null,
    includesTransport: null, includesAssembly: null, designIncludes: null, vatRatePercent: 21,
    priceWithVat: null, totalWithVat: null, deliveryWorkingDays: null,
  } as QuoteVersionDto;
}

function quote(): QuoteDto {
  return {
    id: 'q1', claimSlotId: 's1', requestId: 'r1', companyId: 'c1', companyName: 'Firma A', currency: 'RON',
    status: 'SENT', extraVersionsCount: 0, versionsUsed: 1, versionLimitReached: false, eurRonRate: 5,
    versions: [version()], consultationInvites: [], createdAt: new Date().toISOString(), acceptedAt: null,
    acceptedVersionId: null, declinedAt: null, declineReason: null, declineNote: null, changeRequests: [],
  } as QuoteDto;
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' }).format(new Date(iso));

function openDialog(deadlineMs: number) {
  const firmActions: ClaimFirmActionsDto = {
    claimCostCredits: 4,
    slaBreachAt: new Date(deadlineMs + 12 * HOUR).toISOString(),
    quoteWithdrawWindowEndsAt: new Date(Date.now() + 20 * HOUR).toISOString(),
    validityExtensionDays: 7,
  };
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Bucharest">
      <OfferCard
        quote={quote()}
        mode="company"
        includesPaidDesign={false}
        firmActions={firmActions}
        slaDeadlineAt={new Date(deadlineMs).toISOString()}
      />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: en.Quotes.withdraw }));
  return within(screen.getByRole('dialog', { name: en.Quotes.confirm.withdrawTitle }));
}

describe('OfferCard — dialogul de retragere (a7)', () => {
  it('termenul ca pe fisa (fara cele 12 ore), gratia separat, pierderea la conditional', () => {
    const deadline = Date.now() + 3 * 24 * HOUR;
    const d = openDialog(deadline);
    const deadlineIso = new Date(deadline).toISOString();
    const breachIso = new Date(deadline + 12 * HOUR).toISOString();
    expect(d.getByText(`The response deadline runs again: send a new offer by ${fmt(deadlineIso)}.`)).toBeInTheDocument();
    expect(d.getByText(`After the deadline you still have 12 hours of grace, until ${fmt(breachIso)}.`)).toBeInTheDocument();
    expect(
      d.getByText('If you don’t send a new offer by then, the claim expires, you lose 4 credits and the company receives 3 points of penalty.'),
    ).toBeInTheDocument();
    // penalizarea nu mai e spusa ca sigura
    expect(d.queryByText(/The firm also receives/)).not.toBeInTheDocument();
  });

  it('termenul a trecut, gratia inca merge → spune asta, cu ambele momente', () => {
    const deadline = Date.now() - HOUR;
    const d = openDialog(deadline);
    expect(
      d.getByText(
        `The response deadline has passed (${fmt(new Date(deadline).toISOString())}), but you are still in the grace period: send a new offer by ${fmt(new Date(deadline + 12 * HOUR).toISOString())}.`,
      ),
    ).toBeInTheDocument();
  });
});

describe('OfferCard — statusLabel (e4)', () => {
  it('eticheta data inlocuieste starea in randul de sub titlu; fara ea → starea standard', () => {
    const q = { ...quote(), status: 'WITHDRAWN' } as QuoteDto;
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <OfferCard quote={q} mode="company" includesPaidDesign={false} readOnly statusLabel={en.Quotes.requestDeletedByClient} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(new RegExp(en.Quotes.requestDeletedByClient))).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`· ${en.Quotes.status.WITHDRAWN}$`))).not.toBeInTheDocument();
    unmount();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <OfferCard quote={q} mode="company" includesPaidDesign={false} readOnly />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText(new RegExp(en.Quotes.requestDeletedByClient))).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(`· ${en.Quotes.status.WITHDRAWN}`))).toBeInTheDocument();
  });
});

describe('withdrawGraceHours', () => {
  it('diferenta dintre cele doua momente date de server; lipsa unuia → 0', () => {
    expect(withdrawGraceHours('2026-11-16T21:59:00.000Z', '2026-11-17T09:59:00.000Z')).toBe(12);
    expect(withdrawGraceHours(null, '2026-11-17T09:59:00.000Z')).toBe(0);
    expect(withdrawGraceHours('2026-11-17T09:59:00.000Z', '2026-11-17T09:59:00.000Z')).toBe(0);
  });
});
