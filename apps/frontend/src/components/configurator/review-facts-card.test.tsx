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
  it('keeps undisclosed budget private even if a stale numeric estimate is present', () => {
    show('UNDISCLOSED', 12345);
    expect(screen.getByText('I prefer not to share')).toBeVisible();
    expect(screen.queryByText(/Your estimated budget/)).not.toBeInTheDocument();
    expect(screen.getByText(/client@example.test/)).toBeVisible();
  });
  it('labels a provided estimate separately from a company quote', () => {
    show('FROM_5K_TO_15K', 12000);
    expect(screen.getByText(/not a company quote/)).toBeVisible();
    expect(screen.getByText('A bright reading room')).toBeVisible();
  });
  // b8 / b10: un singur rand despre mod, nu trei (am proiect / proiectare / ajutor)
  it('shows the start mode on a single row, with the rooms that need design help', () => {
    show('FROM_5K_TO_15K', 12000, 'STANDARD', ['Bathroom']);
    expect(screen.getByText(en.Configurator.review.facts.mode)).toBeVisible();
    expect(screen.getByText(en.Configurator.start.STANDARD.title)).toBeVisible();
    expect(screen.getByText(/Bathroom/)).toBeVisible();
    expect(screen.queryByText(en.Requests.field.hasOwnProject)).not.toBeInTheDocument();
    expect(screen.queryByText(/paid design/i)).not.toBeInTheDocument();
  });
});
