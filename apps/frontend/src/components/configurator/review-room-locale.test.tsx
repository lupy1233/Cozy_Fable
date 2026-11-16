import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { getFlow, type AnswerMap } from '@marketplace/shared';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { ReviewRoomCard } from './review-room-card';

describe('localized customer review', () => {
  it.each([['en', en], ['ro', ro]] as const)('uses %s option labels and keeps workshop derivation unchanged', (locale, messages) => {
    const answers: AnswerMap = { layout: 'LINEAR', doorType: 'SLIDING', interiorModules: ['HANGING_RODS', 'SHOE_RACK', 'LED_LIGHTING'], material: 'ALTUL', materialOther: 'My custom finish', dimensions: { runA: 2.4, wardrobeHeight: 2.6 } };
    const flow = getFlow('DRESSING');
    const canonical = structuredClone(flow.deriveRoom(answers));
    const { container } = render(<NextIntlClientProvider locale={locale} messages={messages}><ReviewRoomCard room={{ localId: 'wardrobe', roomType: 'DRESSING', flowVersion: flow.version, completed: true, answers }} attachments={[]} designHelp={false} onEdit={() => {}} /></NextIntlClientProvider>);
    const preview = within(container.querySelector('[data-review-room-preview]') as HTMLElement);
    expect(preview.getByText(messages.Configurator.flows.DRESSING.doorType.options.SLIDING.label)).toBeVisible();
    // b10: modulele interioare nu sunt in lista scurta, ci in "Vezi toate"
    expect(container.querySelector('[data-review-room-more]')?.textContent).toContain(messages.Configurator.flows.DRESSING.interiorModules.options.HANGING_RODS.label);
    // b10: "Altul" si textul clientului pe un singur rand
    expect(preview.getByText(new RegExp(`— My custom finish$`))).toBeVisible();
    expect(container.textContent?.match(/My custom finish/g)).toHaveLength(1);
    expect(container.textContent).not.toMatch(/HANGING|SHOE_RACK|Material dorit:/);
    expect(flow.deriveRoom(answers)).toEqual(canonical);
  });
  it('shows per-piece material and opening in the short list; "see all" adds the rest', async () => {
    const answers: AnswerMap = { piecesNeeded: ['TV_UNIT'], tvStyle: 'FLOATING', materialTvUnit: 'ALTUL', materialTvUnitOther: 'Reclaimed oak', systemsTvUnit: ['PUSH'] };
    const { container } = render(<NextIntlClientProvider locale="en" messages={en}><ReviewRoomCard room={{ localId: 'living', roomType: 'LIVING', flowVersion: 3, completed: true, answers }} attachments={[]} designHelp={false} onEdit={() => {}} /></NextIntlClientProvider>);
    const preview = within(container.querySelector('[data-review-room-preview]') as HTMLElement);
    expect(preview.getByText(en.Configurator.flows.LIVING.piecesNeeded.options.TV_UNIT.label)).toBeVisible();
    // b10: materialele si deschiderile pe piese sunt in lista scurta, nu doar in "Vezi toate"
    expect(preview.getByText(/— Reclaimed oak$/)).toBeVisible();
    expect(preview.getByText(en.Configurator.common.systems.PUSH.label)).toBeVisible();
    await userEvent.click(screen.getByText(en.Configurator.review.rooms.allAnswers));
    const more = within(container.querySelector('[data-review-room-more]') as HTMLElement);
    expect(more.getByText(en.Configurator.flows.LIVING.tvStyle.summaryLabel)).toBeVisible();
    expect(more.queryByText(/Reclaimed oak/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Comoda TV|Material dorit:/)).not.toBeInTheDocument();
  });
  it('preserves freeform quantities, names and descriptions verbatim', () => {
    const answers: AnswerMap = { pieces: [{ name: 'Customer-designed stand', quantity: 3, material: 'PAL', systems: ['MANER'], description: 'Custom note: retain this wording.' }] };
    const { container } = render(<NextIntlClientProvider locale="en" messages={en}><ReviewRoomCard room={{ localId: 'custom', roomType: 'PIECES', flowVersion: 1, completed: true, answers }} attachments={[]} designHelp={false} onEdit={() => {}} /></NextIntlClientProvider>);
    const preview = within(container.querySelector('[data-review-room-preview]') as HTMLElement);
    expect(preview.getByText(/3× Customer-designed stand/)).toBeVisible();
    expect(preview.getByText('Custom note: retain this wording.')).toBeVisible();
  });
  // b10: randurile "Alta piesa" fara denumire nu apar (nici virgule, nici "1× —")
  it('hides unnamed freeform rows', () => {
    const answers: AnswerMap = { pieces: [{ name: '', quantity: 1, material: 'PAL', systems: [] }, { name: 'Shelf', quantity: 1, material: 'PAL', systems: [] }] };
    const { container } = render(<NextIntlClientProvider locale="en" messages={en}><ReviewRoomCard room={{ localId: 'custom', roomType: 'PIECES', flowVersion: 1, completed: true, answers }} attachments={[]} designHelp={false} onEdit={() => {}} /></NextIntlClientProvider>);
    const items = container.querySelectorAll('[data-review-room-preview] li');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toMatch(/^1× Shelf/);
  });
  it('keeps the room shell usable for an unsupported saved flow', () => {
    // sumarul (review-step) trimite problema din roomIssue: versiunea de flow necunoscuta
    render(<NextIntlClientProvider locale="en" messages={en}><ReviewRoomCard room={{ localId: 'legacy', roomType: 'DRESSING', flowVersion: 999, completed: false, answers: {} }} attachments={[]} designHelp={false} onEdit={() => {}} issue={{ problem: en.Configurator.validation.flowVersionUnsupported }} /></NextIntlClientProvider>);
    expect(screen.getByRole('button', { name: `Edit ${en.Configurator.rooms.type.DRESSING}` })).toBeVisible();
    expect(screen.getByText(en.Configurator.validation.flowVersionUnsupported)).toBeVisible();
    expect(screen.getByRole('button', { name: `Complete ${en.Configurator.rooms.type.DRESSING}` })).toBeVisible();
  });
});
