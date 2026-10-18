import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardActionItemDto } from '@marketplace/shared';
import ro from '../../../messages/ro.json';
import en from '../../../messages/en.json';
import { TodoNowCard } from './todo-now-card';

// E-admin-platform-44: "De facut acum" — fiecare element e un singur link spre pagina potrivita.
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const soon = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

function item(over: Partial<DashboardActionItemDto>): DashboardActionItemDto {
  return { kind: 'OFFERS_TO_REVIEW', requestId: 'r1', claimSlotId: null, title: 'Dulap dormitor', count: null, dueAt: null, ...over };
}

function renderCard(items: DashboardActionItemDto[], locale: 'ro' | 'en' = 'ro') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone="Europe/Bucharest">
      <TodoNowCard items={items} />
    </NextIntlClientProvider>,
  );
}

describe('TodoNowCard', () => {
  it('starea goala', () => {
    renderCard([]);
    expect(screen.getByText('De făcut acum')).toBeTruthy();
    expect(screen.getByText('Nimic urgent acum. Te anunțăm când apare ceva.')).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('un singur link per element, cu href-ul corect pentru fiecare tip', () => {
    const items: DashboardActionItemDto[] = [
      item({ kind: 'OFFERS_TO_REVIEW', requestId: 'r-off', count: 2 }),
      item({ kind: 'DELIVERY_TO_CONFIRM', requestId: 'r-del', dueAt: soon() }),
      item({ kind: 'CLARIFICATION_TO_ANSWER', requestId: 'r-cla', count: 1 }),
      item({ kind: 'REQUEST_EXPIRING', requestId: 'r-exp', dueAt: soon() }),
      item({ kind: 'UNASSIGNED_CLAIM', requestId: 'r-un', claimSlotId: 's-un', dueAt: soon() }),
      item({ kind: 'SLA_DUE_SOON', requestId: 'r-sla', claimSlotId: 's-sla', dueAt: soon() }),
    ];
    renderCard(items);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/requests/r-off/offers',
      '/requests/r-del/offers',
      '/requests/r-cla/offers',
      '/requests/r-exp',
      '/marketplace/claims/s-un',
      '/marketplace/claims/s-sla',
    ]);
    expect(screen.getByText('Preluare neatribuită')).toBeTruthy();
    expect(screen.getAllByText('Termenul ofertei se apropie')).toHaveLength(1);
    expect(screen.getByText(/^se confirmă automat /)).toBeTruthy();
  });

  it('pluralul romanesc (one / few / other) si cel englezesc', () => {
    renderCard([
      item({ kind: 'OFFERS_TO_REVIEW', requestId: 'a', count: 1 }),
      item({ kind: 'OFFERS_TO_REVIEW', requestId: 'b', count: 3 }),
      item({ kind: 'OFFERS_TO_REVIEW', requestId: 'c', count: 25 }),
    ]);
    expect(screen.getByText('1 ofertă de analizat')).toBeTruthy();
    expect(screen.getByText('3 oferte de analizat')).toBeTruthy();
    expect(screen.getByText('25 de oferte de analizat')).toBeTruthy();
  });

  it('in engleza', () => {
    renderCard([item({ kind: 'OFFERS_TO_REVIEW', count: 2 })], 'en');
    expect(screen.getByText('To do now')).toBeTruthy();
    expect(screen.getByText('2 offers to review')).toBeTruthy();
  });
});
