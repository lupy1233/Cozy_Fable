import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import additions from '../../../../../docs/experience-locale-additions.json';
import { ReviewFactsCard } from './review-facts-card';

// E-client-9: `facts` se imbina pe chei (fragmentul vechi nu are projectVisibility)
const messages = { ...en, Configurator: { ...en.Configurator, review: { ...en.Configurator.review, ...additions.en.Configurator.review, facts: { ...en.Configurator.review.facts, ...additions.en.Configurator.review.facts } } } };
function show(budgetRange: string, estimate: number) {
  render(<NextIntlClientProvider locale="en" messages={messages}><ReviewFactsCard details={{ budgetRange, budgetEstimateRon: estimate, contactPreferences: [{ channel: 'EMAIL', value: 'client@example.test' }], country: 'RO', city: 'Cluj', description: 'A bright reading room' }} complete designHelp={false} onEdit={() => {}} /></NextIntlClientProvider>);
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
});
