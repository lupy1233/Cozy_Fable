import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { RoomAnswerSummary } from './room-answer-summary';

// d1 / m4: dimensiunile din Sumar se formateaza dupa limba aplicatiei
describe('RoomAnswerSummary dimensions', () => {
  const answers = { layout: 'LINEAR', doorType: 'SLIDING', dimensions: { runA: 2.5, wardrobeHeight: 2.45 }, interiorModules: ['HANGING_RODS'], material: 'PAL' };

  it('uses a decimal comma in Romanian', () => {
    const { container } = render(<NextIntlClientProvider locale="ro" messages={ro}><RoomAnswerSummary roomType="DRESSING" answers={answers} flowVersion={3} /></NextIntlClientProvider>);
    expect(container.textContent).toContain('2,5 m');
    expect(container.textContent).toContain('2,45 m');
  });

  it('uses a decimal point in English', () => {
    const { container } = render(<NextIntlClientProvider locale="en" messages={en}><RoomAnswerSummary roomType="DRESSING" answers={answers} flowVersion={3} /></NextIntlClientProvider>);
    expect(container.textContent).toContain('2.5 m');
  });
});
