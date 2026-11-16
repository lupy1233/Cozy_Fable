import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { CreditHistoryItemDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../../../../messages/ro.json';
import en from '../../../../../messages/en.json';
import { CreditHistorySection } from './credit-history-section';

// h3 (etapa 9): fila „Istoric credite” — gol, cu rânduri, „Vezi mai multe”.

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const item = (over: Partial<CreditHistoryItemDto> = {}): CreditHistoryItemDto => ({
  id: 'i1', createdAt: '2026-11-14T08:30:00.000Z', type: 'GRANT', kind: 'OPENING_BALANCE', reason: 'OPENING_BALANCE',
  amount: 200, availableDelta: 200, reservedDelta: 0, availableAfter: 200, reservedAfter: 0,
  claimSlotId: null, requestId: null, requestTitle: null, ...over,
});

function show(props: Partial<React.ComponentProps<typeof CreditHistorySection>> = {}, locale: 'ro' | 'en' = 'ro') {
  const onLoadMore = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone="Europe/Bucharest">
      <CreditHistorySection
        pending={false}
        error={false}
        items={[]}
        hasMore={false}
        loadingMore={false}
        onLoadMore={onLoadMore}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onLoadMore };
}

describe('CreditHistorySection', () => {
  it('fără mișcări → mesajul gol, fără „Vezi mai multe”', () => {
    show({ items: [] });
    expect(screen.getByText(ro.Billing.history.empty)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ro.Billing.history.loadMore })).not.toBeInTheDocument();
  });

  it('rânduri: ce s-a întâmplat, motivul, cererea legată, suma cu semn, soldul după și ora României', () => {
    show({
      items: [
        item({
          id: 'i3', type: 'REFUND', kind: 'REFUND', reason: 'SLA_BREACH', amount: 5, availableDelta: 5, reservedDelta: -5,
          availableAfter: 197, reservedAfter: 3, claimSlotId: 's1', requestId: 'r1', requestTitle: 'Bucătărie Ana',
        }),
        item({ id: 'i2', type: 'CONSUME', kind: 'CONSUME', reason: 'COMPLETED', amount: 3, availableDelta: 0, reservedDelta: -3, availableAfter: 192, reservedAfter: 0 }),
        item({ id: 'i1', kind: 'OTHER', reason: null }),
      ],
    });
    const rows = screen.getAllByTestId('credit-history-row');
    expect(rows).toHaveLength(3);
    const refund = within(rows[0]);
    expect(refund.getByText(ro.Billing.history.kind.REFUND)).toBeInTheDocument();
    expect(refund.getByText(ro.Billing.history.reason.SLA_BREACH)).toBeInTheDocument();
    expect(refund.getByRole('link', { name: 'Bucătărie Ana' })).toHaveAttribute('href', '/marketplace/claims/s1');
    expect(refund.getByText('+5 disponibile')).toBeInTheDocument();
    expect(refund.getByText('-5 rezervate')).toBeInTheDocument();
    expect(refund.getByText('După: 197 disponibile · 3 rezervate')).toBeInTheDocument();
    // 08:30 UTC = 10:30 la București (noiembrie, UTC+2)
    expect(refund.getByText(/10:30/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(ro.Billing.history.kind.CONSUME)).toBeInTheDocument();
    expect(within(rows[1]).getByText('-3 rezervate')).toBeInTheDocument();
    expect(within(rows[2]).getByText(ro.Billing.history.kind.OTHER)).toBeInTheDocument();
  });

  it('„Vezi mai multe” cere pagina următoare; e oprit cât se încarcă', () => {
    const { onLoadMore } = show({ items: [item()], hasMore: true });
    fireEvent.click(screen.getByRole('button', { name: ro.Billing.history.loadMore }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('se încarcă pagina următoare → butonul e dezactivat', () => {
    show({ items: [item()], hasMore: true, loadingMore: true });
    expect(screen.getByRole('button', { name: ro.Billing.history.loadMore })).toBeDisabled();
  });

  it('eroare → mesaj, nu lista goală', () => {
    show({ items: undefined, error: true });
    expect(screen.getByRole('alert')).toHaveTextContent(ro.Billing.history.loadFailed);
    expect(screen.queryByText(ro.Billing.history.empty)).not.toBeInTheDocument();
  });

  it('EN: textele în engleză', () => {
    show({ items: [item()] }, 'en');
    expect(screen.getByText(en.Billing.history.kind.OPENING_BALANCE)).toBeInTheDocument();
    expect(screen.getByText('+200 available')).toBeInTheDocument();
  });
});
