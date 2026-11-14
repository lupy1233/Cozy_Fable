import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { RequestVisibilityClosedReasonDto, RequestVisibilityDto } from '@marketplace/shared';
import ro from '../../../messages/ro.json';
import en from '../../../messages/en.json';
import { RequestVisibilityCard } from './request-visibility-card';

// E-client-9 (C7-16): cardul "Cine vede cererea".
// a6: acoperirea lipsa din fixture = exista firme in zona (COVERED)
type CardInput = Omit<RequestVisibilityDto, 'coverage'> & Partial<Pick<RequestVisibilityDto, 'coverage'>> & RequestVisibilityClosedReasonDto;
function renderCard(visibility: CardInput, locale: 'ro' | 'en' = 'ro') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone="Europe/Bucharest">
      <RequestVisibilityCard visibility={{ coverage: 'COVERED', ...visibility }} />
    </NextIntlClientProvider>,
  );
}

const holder = (over: Partial<RequestVisibilityDto['contactHolders'][number]> = {}) => ({
  claimSlotId: 's1',
  companyName: 'A Mobila Premium',
  claimStatus: 'ACTIVE' as const,
  claimedAt: '2026-09-30T08:00:00.000Z',
  contactsVisibleFrom: null,
  ...over,
});

describe('RequestVisibilityCard', () => {
  it('fara preluari: proiectul e in lista firmelor, nimeni nu are contactele', () => {
    renderCard({ requestId: 'r1', projectVisibleInMarketplace: true, contactHolders: [] });
    expect(screen.getByRole('heading', { name: 'Cine vede cererea' })).toBeTruthy();
    expect(screen.getByText(ro.Requests.visibility.projectVisible)).toBeTruthy();
    expect(screen.getByText(ro.Requests.visibility.contactsNone)).toBeTruthy();
    expect(screen.getByText(ro.Requests.visibility.note)).toBeTruthy();
  });

  it('cu firme care detin contactele: lista numelor, proiect inchis', () => {
    renderCard({
      requestId: 'r1',
      projectVisibleInMarketplace: false,
      contactHolders: [holder(), holder({ claimSlotId: 's2', companyName: 'B Design', claimStatus: 'OFFER_SENT' })],
    });
    expect(screen.getByText(ro.Requests.visibility.projectClosed)).toBeTruthy();
    expect(screen.getByText('A Mobila Premium')).toBeTruthy();
    expect(screen.getByText('B Design')).toBeTruthy();
    expect(screen.queryByText(ro.Requests.visibility.contactsNone)).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    // contactele sunt deja vizibile: langa nume apare momentul preluarii, in ora Romaniei
    expect(screen.getAllByText(/^preluată pe .*11:00/)).toHaveLength(2);
  });

  // a1: textul spune de ce firme noi nu mai vad cererea
  it.each([
    ['SLOTS_FULL', ro.Requests.visibility.closedReason.SLOTS_FULL],
    ['OFFER_ACCEPTED', ro.Requests.visibility.closedReason.OFFER_ACCEPTED],
    ['FIRST_OFFER_RULE', ro.Requests.visibility.closedReason.FIRST_OFFER_RULE],
    ['EXPIRED', ro.Requests.visibility.closedReason.EXPIRED],
  ] as const)('proiect inchis cu motivul %s', (reason, text) => {
    renderCard({ requestId: 'r1', projectVisibleInMarketplace: false, contactHolders: [], marketplaceClosedReason: reason });
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText(ro.Requests.visibility.projectClosed)).toBeNull();
  });

  // a6 (PO a6-1): avertisment doar la NONE si doar cat cererea e in piata; niciodata un numar
  it('nicio firma in zona (NONE): avertismentul in locul textului "vizibila", RO si EN', () => {
    const v = { requestId: 'r1', projectVisibleInMarketplace: true, contactHolders: [], coverage: 'NONE' as const };
    renderCard(v);
    const warning = screen.getByTestId('no-coverage-warning');
    expect(warning.textContent).toContain(ro.Requests.visibility.noCoverage.title);
    expect(warning.textContent).toContain(ro.Requests.visibility.noCoverage.body);
    expect(warning.textContent).not.toMatch(/\d/);
    expect(screen.queryByText(ro.Requests.visibility.projectVisible)).toBeNull();
    const { container } = renderCard(v, 'en');
    expect(container.textContent).toContain(en.Requests.visibility.noCoverage.title);
  });

  it.each(['COVERED', 'UNKNOWN'] as const)('acoperire %s: fara avertisment, textul obisnuit', (coverage) => {
    renderCard({ requestId: 'r1', projectVisibleInMarketplace: true, contactHolders: [], coverage });
    expect(screen.queryByTestId('no-coverage-warning')).toBeNull();
    expect(screen.getByText(ro.Requests.visibility.projectVisible)).toBeTruthy();
  });

  it('NONE dar cererea nu mai e in piata: motivul inchiderii, fara avertisment', () => {
    renderCard({ requestId: 'r1', projectVisibleInMarketplace: false, contactHolders: [], coverage: 'NONE', marketplaceClosedReason: 'EXPIRED' });
    expect(screen.queryByTestId('no-coverage-warning')).toBeNull();
    expect(screen.getByText(ro.Requests.visibility.closedReason.EXPIRED)).toBeTruthy();
  });

  it('contacte in asteptare (AFTER_GRACE): "din {ora}" in ora Romaniei, si in engleza', () => {
    const v = {
      requestId: 'r1',
      projectVisibleInMarketplace: true,
      contactHolders: [holder({ contactsVisibleFrom: '2026-09-30T08:30:00.000Z' })],
    };
    renderCard(v);
    expect(screen.getByText(/din 11:30/)).toBeTruthy();
    expect(screen.queryByText(/preluată pe/)).toBeNull();
    const { container } = renderCard(v, 'en');
    expect(container.textContent).toContain('Who can see this request');
    expect(container.textContent).toMatch(/from 11:30/);
  });

  // d5: dupa preluare, cardul spune ce date vede firma
  it('firma cu contacte: "Firma X iti vede numele, contactele alese si adresa completa"', () => {
    renderCard({ requestId: 'r1', projectVisibleInMarketplace: false, contactHolders: [holder()] });
    expect(screen.getByText('A Mobila Premium îți vede numele, contactele alese și adresa completă.')).toBeTruthy();
  });

  it('contacte in asteptare: "iti va vedea … de la ora afisata"', () => {
    renderCard({ requestId: 'r1', projectVisibleInMarketplace: true, contactHolders: [holder({ contactsVisibleFrom: '2026-09-30T08:30:00.000Z' })] });
    expect(screen.getByText(/A Mobila Premium îți va vedea numele/)).toBeTruthy();
  });

  // e4: o firma a avut datele si a renuntat — istoricul in locul lui "Nicio firma inca"
  it('istoric: "O firma a avut acces la datele tale pana pe …", fara "Nicio firma inca", RO si EN', () => {
    const v = {
      requestId: 'r1',
      projectVisibleInMarketplace: true,
      contactHolders: [],
      pastContactAccess: [{ until: '2026-11-10T13:05:00.000Z' }],
    };
    renderCard(v);
    expect(screen.queryByText(ro.Requests.visibility.contactsNone)).toBeNull();
    expect(screen.getByText(ro.Requests.visibility.contactsNoneNow)).toBeTruthy();
    expect(screen.getByText(/^O firmă a avut acces la datele tale până pe 10 noiembrie.*15:05\.$/)).toBeTruthy();
    const { container } = renderCard(v, 'en');
    expect(container.textContent).toMatch(/A company had access to your details until November 10.*3:05/);
  });

  it('istoric langa o firma care are acum datele: ambele apar', () => {
    renderCard({
      requestId: 'r1',
      projectVisibleInMarketplace: true,
      contactHolders: [holder()],
      pastContactAccess: [{ until: '2026-11-10T13:05:00.000Z' }],
    });
    expect(screen.getByText('A Mobila Premium')).toBeTruthy();
    expect(screen.getByText(/O firmă a avut acces/)).toBeTruthy();
    expect(screen.queryByText(ro.Requests.visibility.contactsNoneNow)).toBeNull();
  });
});
