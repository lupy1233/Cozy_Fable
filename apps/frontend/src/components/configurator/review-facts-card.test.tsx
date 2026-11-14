import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import additions from '../../../../../docs/experience-locale-additions.json';
import type { StartMode } from '@/stores/configurator-store';
import { ReviewFactsCard } from './review-facts-card';

// E-client-9: `facts` se imbina pe chei (fragmentul vechi nu are projectVisibility)
const messages = { ...en, Configurator: { ...en.Configurator, review: { ...en.Configurator.review, ...additions.en.Configurator.review, facts: { ...en.Configurator.review.facts, ...additions.en.Configurator.review.facts } } } };
function show(budgetRange: string, estimate: number, mode: StartMode = 'STANDARD', helpRooms: string[] = []) {
  render(<NextIntlClientProvider locale="en" messages={messages}><ReviewFactsCard details={{ budgetRange, budgetEstimateRon: estimate, contactPreferences: [{ channel: 'EMAIL', value: 'client@example.test' }], country: 'RO', city: 'Cluj', description: 'A bright reading room' }} complete mode={mode} helpRooms={helpRooms} onEdit={() => {}} /></NextIntlClientProvider>);
}
describe('review project facts', () => {
  // b11: acelasi format ca la firma — suma in lei sau 'Buget nedeclarat', fara trepte
  it('keeps undisclosed budget private even if a stale numeric estimate is present', () => {
    show('UNDISCLOSED', 12345);
    expect(screen.getByText(en.Requests.budgetView.undisclosed)).toBeVisible();
    expect(screen.queryByText(/12,345/)).not.toBeInTheDocument();
    expect(screen.getByText(/client@example.test/)).toBeVisible();
  });
  it('shows the chosen amount in lei, without a budget band', () => {
    show('FROM_5K_TO_15K', 12000);
    expect(screen.getByText('12,000 lei')).toBeVisible();
    expect(screen.queryByText(en.Requests.budget.FROM_5K_TO_15K)).not.toBeInTheDocument();
    expect(screen.queryByText(/RON/)).not.toBeInTheDocument();
    expect(screen.getByText('A bright reading room')).toBeVisible();
  });
  it('an unchosen budget (old draft) shows as not provided, never a default band', () => {
    show('UNDER_5K', undefined as unknown as number);
    expect(screen.getAllByText(en.Configurator.review.facts.notProvided).length).toBeGreaterThan(0);
    expect(screen.queryByText(en.Requests.budget.UNDER_5K)).not.toBeInTheDocument();
  });
  // b8 / b10: un singur rand despre mod, nu trei (am proiect / proiectare / ajutor)
  it('shows the start mode on a single row, with the rooms that need design help', () => {
    show('FROM_5K_TO_15K', 12000, 'STANDARD', ['Bathroom']);
    expect(screen.getByText(en.Configurator.review.facts.mode)).toBeVisible();
    expect(screen.getByText(en.Configurator.start.STANDARD.title)).toBeVisible();
    expect(screen.getByText(/Bathroom/)).toBeVisible();
    expect(screen.queryByText(en.Requests.field.hasOwnProject)).not.toBeInTheDocument();
    // glosar etapa 8: randul camerelor spune „Paid design for: …”; nu exista un rand separat „Paid design”
    expect(screen.queryByText(en.Requests.designHelpIncluded)).not.toBeInTheDocument();
    expect(screen.getAllByText(/paid design/i)).toHaveLength(1);
  });
});

// b12: adresa fara dubluri; tara doar cand nu e Romania
describe('review address (b12)', () => {
  const showAddress = (details: Record<string, string>) => render(<NextIntlClientProvider locale="en" messages={messages}><ReviewFactsCard details={{ budgetRange: 'UNDISCLOSED', budgetChosen: true, contactPreferences: [], ...details }} complete mode={null} onEdit={() => {}} /></NextIntlClientProvider>);
  it('Bucharest / Bucharest: the city is not repeated and Romania is not shown', () => {
    showAddress({ addressText: 'Strada Fabricii 5', addressDetails: 'bl. A2, ap. 14', city: 'București', county: 'București', country: 'RO' });
    expect(screen.getByText('Strada Fabricii 5, bl. A2, ap. 14, București')).toBeVisible();
  });
  it('a foreign country is shown by name, in the app language', () => {
    showAddress({ addressText: 'Hauptstraße 1', city: 'München', county: 'Bayern', country: 'DE' });
    expect(screen.getByText('Hauptstraße 1, München, Bayern, Germany')).toBeVisible();
  });
});
