import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { ChatThreadDto, QuoteDto } from '@marketplace/shared';
import ro from '../../../messages/ro.json';
import { OffersComparison, RequestJourney, UnreadBanner } from './offers-comparison';

// Laws of UX (2026-11-08): tabelul de comparatie, drumul cererii, firmele cu mesaje noi.

function thread(id: string, claim: string, name: string, unread = 0): ChatThreadDto {
  return {
    id,
    claimSlotId: claim,
    requestId: 'r1',
    companyName: name,
    unreadCount: unread,
    claimStatus: 'OFFER_SENT',
    readOnly: false,
    lastMessage: null,
    createdAt: new Date().toISOString(),
  } as unknown as ChatThreadDto;
}

function quote(claim: string, total: number, extra: Partial<QuoteDto> = {}): QuoteDto {
  return {
    id: `q-${claim}`,
    claimSlotId: claim,
    companyName: claim,
    currency: 'RON',
    status: 'SENT',
    acceptedVersionId: null,
    versions: [
      {
        id: `v-${claim}`,
        version: 1,
        total,
        totalRon: total,
        deliveryTerm: '6 săptămâni',
        deliveryDate: null,
        warranty: '24 luni',
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        isExpired: false,
      },
    ],
    ...extra,
  } as unknown as QuoteDto;
}

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      {ui}
    </NextIntlClientProvider>,
  );

describe('OffersComparison', () => {
  it('nu apare cu o singura oferta', () => {
    const { container } = wrap(
      <OffersComparison threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B')]} quoteByClaim={new Map([['s1', quote('s1', 1000)]])} />,
    );
    expect(container.textContent).toBe('');
  });

  it('pune ofertele una langa alta si marcheaza cel mai mic total', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'Atelier A'), thread('t2', 's2', 'Atelier B'), thread('t3', 's3', 'Atelier C')]}
        quoteByClaim={new Map([
          ['s1', quote('s1', 13900)],
          ['s2', quote('s2', 11450)],
        ])}
      />,
    );
    expect(screen.getByText('Ofertele, una lângă alta')).toBeTruthy();
    const lowest = screen.getByText('cel mai mic');
    expect(lowest.closest('td')?.textContent).toContain('11.450');
    // firma fara oferta apare ca "in lucru", cu link spre conversatie
    expect(screen.getByText('ofertă în lucru')).toBeTruthy();
    expect(screen.getByText('Vezi conversația').getAttribute('href')).toBe('#firm-s3');
    expect(screen.getAllByText('Vezi și alege')).toHaveLength(2);
  });

  it('fara eticheta cand totalurile minime sunt egale', () => {
    wrap(
      <OffersComparison
        threads={[thread('t1', 's1', 'A'), thread('t2', 's2', 'B')]}
        quoteByClaim={new Map([
          ['s1', quote('s1', 5000)],
          ['s2', quote('s2', 5000)],
        ])}
      />,
    );
    expect(screen.queryByText('cel mai mic')).toBeNull();
  });
});

describe('RequestJourney', () => {
  it('evidentiaza pasul curent', () => {
    wrap(<RequestJourney status="OFFERS_RECEIVED" />);
    expect(screen.getByText('Oferte primite').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Publicată').closest('li')?.getAttribute('aria-current')).toBeNull();
  });

  it('dispare pentru cererile iesite din drum', () => {
    const { container } = wrap(<RequestJourney status="CANCELLED" />);
    expect(container.textContent).toBe('');
  });
});

describe('UnreadBanner', () => {
  it('listeaza doar firmele cu mesaje noi', () => {
    wrap(<UnreadBanner threads={[thread('t1', 's1', 'Atelier A', 2), thread('t2', 's2', 'Atelier B')]} />);
    expect(screen.getByText('Atelier A ți-a scris: 2 mesaje noi').closest('a')?.getAttribute('href')).toBe('#firm-s1');
    expect(screen.queryByText(/Atelier B/)).toBeNull();
  });
});
