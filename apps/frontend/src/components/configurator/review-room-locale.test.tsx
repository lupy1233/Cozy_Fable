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
    expect(preview.getByText(messages.Configurator.flows.DRESSING.interiorModules.options.HANGING_RODS.label, { exact: false })).toBeVisible();
    expect(preview.getByText('My custom finish')).toBeVisible();
    expect(container.textContent).not.toMatch(/HANGING|SHOE_RACK|Material dorit:/);
    expect(flow.deriveRoom(answers)).toEqual(canonical);
  });
  it('keeps per-piece material and custom notes in the localized full answers', async () => {
    const answers: AnswerMap = { piecesNeeded: ['TV_UNIT'], tvStyle: 'FLOATING', materialTvUnit: 'ALTUL', materialTvUnitOther: 'Reclaimed oak', systemsTvUnit: ['PUSH'] };
    const { container } = render(<NextIntlClientProvider locale="en" messages={en}><ReviewRoomCard room={{ localId: 'living', roomType: 'LIVING', flowVersion: 3, completed: true, answers }} attachments={[]} designHelp={false} onEdit={() => {}} /></NextIntlClientProvider>);
    expect(within(container.querySelector('[data-review-room-preview]') as HTMLElement).getByText(en.Configurator.flows.LIVING.piecesNeeded.options.TV_UNIT.label)).toBeVisible();
    await userEvent.click(screen.getByText(en.Configurator.review.rooms.allAnswers));
    expect(screen.getByText('Reclaimed oak')).toBeVisible();
    expect(screen.getByText(en.Configurator.common.systems.PUSH.label)).toBeVisible();
    expect(screen.queryByText(/Comoda TV|Material dorit:/)).not.toBeInTheDocument();
  });
  it('preserves freeform quantities, names and descriptions verbatim', () => {
    const answers: AnswerMap = { pieces: [{ name: 'Customer-designed stand', quantity: 3, material: 'PAL', systems: ['MANER'], description: 'Custom note: retain this wording.' }] };
    const { container } = render(<NextIntlClientProvider locale="en" messages={en}><ReviewRoomCard room={{ localId: 'custom', roomType: 'PIECES', flowVersion: 1, completed: true, answers }} attachments={[]} designHelp={false} onEdit={() => {}} /></NextIntlClientProvider>);
    const preview = within(container.querySelector('[data-review-room-preview]') as HTMLElement);
    expect(preview.getByText(/3× Customer-designed stand/)).toBeVisible();
    expect(preview.getByText('Custom note: retain this wording.')).toBeVisible();
  });
  it('keeps the room shell usable for an unsupported saved flow', () => {
    // sumarul (review-step) trimite problema din roomIssue: versiunea de flow necunoscuta
    render(<NextIntlClientProvider locale="en" messages={en}><ReviewRoomCard room={{ localId: 'legacy', roomType: 'DRESSING', flowVersion: 999, completed: false, answers: {} }} attachments={[]} designHelp={false} onEdit={() => {}} issue={{ problem: en.Configurator.validation.flowVersionUnsupported }} /></NextIntlClientProvider>);
    expect(screen.getByRole('button', { name: `Edit ${en.Configurator.rooms.type.DRESSING}` })).toBeVisible();
    expect(screen.getByText(en.Configurator.validation.flowVersionUnsupported)).toBeVisible();
    expect(screen.getByRole('button', { name: `Complete ${en.Configurator.rooms.type.DRESSING}` })).toBeVisible();
  });
});
