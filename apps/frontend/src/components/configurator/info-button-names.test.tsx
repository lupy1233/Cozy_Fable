import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { getFlow, ROOM_TYPES, type QuestionStep, type RoomType } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { PlayingCard } from './playing-card';
import { StepRenderer } from './step-renderer';

// m1 (etapa 12): butoanele de informatii spun a cui optiune / intrebare sunt
vi.mock('./piece3d/dynamic', () => ({ Configurator3dStep: () => null }));
vi.mock('./room-sketch-upload', () => ({ RoomSketchUpload: () => null }));

const textOf = (messages: typeof ro, key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages.Configurator) as string;

// o intrebare cu buton de informatii la titlu si cu optiuni cu detalii, din fluxurile curente
function findStep(): { roomType: RoomType; step: QuestionStep } {
  for (const roomType of ROOM_TYPES) {
    for (const step of getFlow(roomType).steps) {
      if (step.type === 'single-choice' && step.info && step.options.some((o) => o.info)) return { roomType, step };
    }
  }
  throw new Error('no step with info found');
}

describe('info buttons have a name that says what they are about (m1)', () => {
  it('the big option card: "Details: {option}"', () => {
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <PlayingCard selected={false} onSelect={() => {}} title="Lemn masiv" visual={null} info={{ titleKey: 'x', bodyKey: 'x', prosKeys: [] }} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'Detalii: Lemn masiv' })).toBeInTheDocument();
    expect(en.Configurator.info.showInfoFor).toBe('Details: {option}');
  });

  it.each([['ro', ro], ['en', en]] as const)('next to the question title and on each option card (%s)', (locale, messages) => {
    const { roomType, step } = findStep();
    if (step.type !== 'single-choice') throw new Error('unexpected');
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <StepRenderer step={step} answers={{}} roomType={roomType} onChange={() => {}} onInfo={() => {}} />
      </NextIntlClientProvider>,
    );
    const about = (name: string) => messages.Configurator.info.showInfoFor.replace('{option}', name);
    expect(screen.getByRole('button', { name: about(textOf(messages, step.titleKey)) })).toBeInTheDocument();
    for (const opt of step.options.filter((o) => o.info)) {
      expect(screen.getByRole('button', { name: about(textOf(messages, opt.labelKey)) })).toBeInTheDocument();
    }
    // niciun buton de informatii fara nume de optiune / intrebare
    expect(screen.queryByRole('button', { name: messages.Configurator.info.showInfo })).not.toBeInTheDocument();
  });
});
