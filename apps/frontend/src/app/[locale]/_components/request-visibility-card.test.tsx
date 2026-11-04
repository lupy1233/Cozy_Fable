import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { RequestVisibilityDto } from '@marketplace/shared';
import ro from '../../../messages/ro.json';
import en from '../../../messages/en.json';
import { RequestVisibilityCard } from './request-visibility-card';

// E-client-9 (C7-16): cardul "Cine vede cererea".
function renderCard(visibility: RequestVisibilityDto, locale: 'ro' | 'en' = 'ro') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone="Europe/Bucharest">
      <RequestVisibilityCard visibility={visibility} />
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
  });

  it('contacte in asteptare (AFTER_GRACE): "din {ora}" in ora Romaniei, si in engleza', () => {
    const v = {
      requestId: 'r1',
      projectVisibleInMarketplace: true,
      contactHolders: [holder({ contactsVisibleFrom: '2026-09-30T08:30:00.000Z' })],
    };
    renderCard(v);
    expect(screen.getByText(/din 11:30/)).toBeTruthy();
    const { container } = renderCard(v, 'en');
    expect(container.textContent).toContain('Who can see this request');
    expect(container.textContent).toMatch(/from 11:30/);
  });
});
