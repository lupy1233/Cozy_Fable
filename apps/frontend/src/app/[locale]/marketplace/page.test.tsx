import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketplaceItemDto } from '@marketplace/shared';
import en from '@/messages/en.json';
import MarketplacePage from './page';
import { MIN_BUDGET_DEBOUNCE_MS } from './min-budget-filter';

const state = vi.hoisted(() => ({
  calls: [] as number[],
  items: [] as unknown[],
}));
vi.mock('@/hooks/use-auth', () => ({
  useMe: () => ({ isPending: false, isError: false, data: { role: 'COMPANY_USER', email: 'firma@demo.ro' } }),
}));
vi.mock('@/hooks/use-marketplace', () => ({
  useMarketplace: (min = 0) => {
    state.calls.push(min);
    // cu filtrul pus, serverul nu gaseste nimic
    return { isPending: false, isSuccess: true, isError: false, data: min > 0 ? [] : state.items, refetch: vi.fn() };
  },
  useWallet: () => ({ data: { available: 50 } }),
}));
vi.mock('./_components/subscription-status-notice', () => ({
  SubscriptionStatusNotice: () => null,
  useSubscriptionLapsed: () => false,
}));
vi.mock('./_components/worksheet-button', () => ({ WorksheetButton: () => null }));
vi.mock('@/lib/relative-time', () => ({ useRelativeTime: () => () => 'now' }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

function item(over: Partial<MarketplaceItemDto>): MarketplaceItemDto {
  return {
    id: 'r1', title: 'Kitchen — Cluj', description: 'desc', budgetRange: 'FROM_5K_TO_15K', budgetEstimateRon: 12000,
    budgetDeclared: true, city: 'Cluj-Napoca', county: 'Cluj', size: 'MEDIUM', creditCost: 4, includesPaidDesign: false,
    hasOwnProject: false, distanceKm: 3, distanceBand: 'UNDER_5', publishedAt: new Date().toISOString(),
    publishedAgoMinutes: 1, activeClaims: 0, maxClaims: 3, alreadyClaimedByMyCompany: false, ...over,
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MarketplacePage />
    </NextIntlClientProvider>,
  );
}
const slider = () => screen.getByRole('slider', { name: new RegExp(en.Marketplace.minBudget) });

beforeEach(() => {
  state.calls = [];
  state.items = [
    item({}),
    // M2: suma nedeclarata nu vine de la server; cardul arata "Buget nedeclarat"
    item({ id: 'r2', title: 'Old — Iasi', budgetEstimateRon: null, budgetDeclared: false }),
  ];
});
afterEach(() => vi.useRealTimers());

describe('marketplace list budget (b11)', () => {
  it('cards show the declared amount in lei, or "Budget not stated" — never a band', () => {
    renderPage();
    expect(screen.getByText('12,000 lei')).toBeInTheDocument();
    expect(screen.getByText(en.Requests.budgetView.undisclosed)).toBeInTheDocument();
    expect(screen.queryByText(en.Requests.budget.FROM_5K_TO_15K)).not.toBeInTheDocument();
  });

  // m7: "Reseteaza filtrele" castiga in fata unei mutari a glisorului inca netrimise
  it('"Reset filters" cancels a pending move of the minimum budget slider', () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.change(slider(), { target: { value: '15000' } });
    act(() => vi.advanceTimersByTime(MIN_BUDGET_DEBOUNCE_MS + 10));
    expect(state.calls.at(-1)).toBe(15000);
    // serverul nu gaseste nimic → butonul de reset
    fireEvent.change(slider(), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: en.Marketplace.resetFilters }));
    act(() => vi.advanceTimersByTime(MIN_BUDGET_DEBOUNCE_MS * 3));
    expect(state.calls.at(-1)).toBe(0);
    expect(state.calls).not.toContain(20000);
    expect(slider()).toHaveValue('0');
  });
});

// b12: orasul nu se repeta ca judet; adresa exacta nu exista in lista (inainte de preluare)
describe('marketplace list place (b12)', () => {
  it('Bucharest / Bucharest shows once', () => {
    state.items = [item({ city: 'București', county: 'București' })];
    renderPage();
    expect(screen.getByText('București')).toBeInTheDocument();
    expect(screen.queryByText('București, București')).not.toBeInTheDocument();
  });
});
