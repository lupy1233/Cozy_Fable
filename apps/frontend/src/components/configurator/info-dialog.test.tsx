import type { InfoContentRef } from '@marketplace/shared';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { InfoDialog } from './info-dialog';

// c12-1 (etapa 12): fraza despre metrul liniar apare sub pret doar cand pretul e pe metru liniar
const info = (prefix: string, withPrice = true): InfoContentRef => ({
  titleKey: `${prefix}.info.title`,
  bodyKey: `${prefix}.info.body`,
  prosKeys: [`${prefix}.info.pros1`],
  consKeys: [`${prefix}.info.cons1`],
  ...(withPrice ? { priceHintKey: `${prefix}.info.price` } : {}),
});

function renderDialog(messages: typeof ro, locale: 'ro' | 'en', ref: InfoContentRef) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <InfoDialog info={ref} open onOpenChange={() => {}} />
    </NextIntlClientProvider>,
  );
}

const note = () => document.querySelector('[data-linear-metre-note]');

describe('InfoDialog — linear metre note', () => {
  it.each([['ro', ro], ['en', en]] as const)('shows the note under a price per linear metre (%s)', (locale, messages) => {
    expect(messages.Configurator.common.materials.PAL.info.price).toMatch(/m liniar|linear metre/);
    renderDialog(messages, locale, info('common.materials.PAL'));
    expect(screen.getByText(messages.Configurator.common.materials.PAL.info.price)).toBeInTheDocument();
    expect(note()?.textContent).toBe(messages.Configurator.info.linearMetreNote);
  });

  it.each([['ro', ro], ['en', en]] as const)('no note for a price per piece (%s)', (locale, messages) => {
    const price = messages.Configurator.common.systems.MANER.info.price;
    expect(price).not.toMatch(/m liniar|linear metre/);
    renderDialog(messages, locale, info('common.systems.MANER'));
    expect(screen.getByText(price)).toBeInTheDocument();
    expect(note()).toBeNull();
  });

  it.each([['ro', ro], ['en', en]] as const)('no note when the option has no price (%s)', (locale, messages) => {
    renderDialog(messages, locale, info('common.materials.PAL', false));
    expect(screen.getByText(messages.Configurator.common.materials.PAL.info.title)).toBeInTheDocument();
    expect(note()).toBeNull();
    expect(screen.queryByText(messages.Configurator.info.avgPrice, { exact: false })).toBeNull();
  });
});
