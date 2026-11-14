import type { InfoContentRef } from '@marketplace/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { PlayingCard } from './playing-card';

// c12-1 (etapa 12) + verificarea in browser: pretul pe metru liniar e explicat si pe spatele
// cartonasului care se intoarce, nu doar in fereastra de detalii.
const info = (prefix: string): InfoContentRef => ({
  titleKey: `${prefix}.info.title`,
  bodyKey: `${prefix}.info.body`,
  prosKeys: [`${prefix}.info.pros1`],
  consKeys: [`${prefix}.info.cons1`],
  priceHintKey: `${prefix}.info.price`,
});

function renderCard(messages: typeof ro, locale: 'ro' | 'en', ref: InfoContentRef) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PlayingCard selected={false} onSelect={() => {}} title="Material" visual={<svg />} info={ref} />
    </NextIntlClientProvider>,
  );
}

const note = () => document.querySelector('[data-linear-metre-note]');
// butonul de informatii: „Detalii: Material” / „Details: Material”
const flip = (messages: typeof ro) =>
  fireEvent.click(screen.getByRole('button', { name: messages.Configurator.info.showInfoFor.replace('{option}', 'Material') }));

describe('PlayingCard — spatele cartonasului', () => {
  it.each([['ro', ro], ['en', en]] as const)('explica metrul liniar sub pretul pe metru liniar (%s)', (locale, messages) => {
    const price = messages.Configurator.common.materials.PAL.info.price;
    expect(price).toMatch(/m liniar|linear metre/);
    renderCard(messages, locale, info('common.materials.PAL'));
    expect(note()).toBeNull(); // pe fata nu apare
    flip(messages);
    expect(document.querySelector('[data-choice-face="details"]')).not.toBeNull();
    expect(note()?.textContent).toBe(messages.Configurator.info.linearMetreShort);
  });

  it.each([['ro', ro], ['en', en]] as const)('fara nota la un pret pe bucata (%s)', (locale, messages) => {
    const price = messages.Configurator.common.systems.MANER.info.price;
    expect(price).not.toMatch(/m liniar|linear metre/);
    renderCard(messages, locale, info('common.systems.MANER'));
    flip(messages);
    expect(document.querySelector('[data-choice-face="details"]')).not.toBeNull();
    expect(note()).toBeNull();
  });
});
