import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { RoomAnswerSummary } from './room-answer-summary';

// d1 / m4 / c4: dimensiunile din Sumar se formateaza dupa limba aplicatiei, in unitatea clientului
describe('RoomAnswerSummary dimensions', () => {
  const answers = { layout: 'LINEAR', doorType: 'SLIDING', dimensions: { runA: 2.455, wardrobeHeight: 2.45 }, interiorModules: ['HANGING_RODS'], material: 'PAL' };

  it('an old request without a unit shows centimetres, with a decimal comma in Romanian', () => {
    const { container } = render(<NextIntlClientProvider locale="ro" messages={ro}><RoomAnswerSummary roomType="DRESSING" answers={answers} flowVersion={3} /></NextIntlClientProvider>);
    expect(container.textContent).toContain('245,5 cm');
    expect(container.textContent).toContain('245 cm');
    expect(container.textContent).not.toMatch(/\d m\b/);
  });

  it('uses a decimal point in English', () => {
    const { container } = render(<NextIntlClientProvider locale="en" messages={en}><RoomAnswerSummary roomType="DRESSING" answers={answers} flowVersion={3} /></NextIntlClientProvider>);
    expect(container.textContent).toContain('245.5 cm');
  });

  it('follows the unit chosen by the client', () => {
    const { container } = render(<NextIntlClientProvider locale="ro" messages={ro}><RoomAnswerSummary roomType="DRESSING" answers={answers} flowVersion={3} unit="m" /></NextIntlClientProvider>);
    expect(container.textContent).toContain('2,455 m');
  });
});

// b10: etichete scurte, "Altul" + text pe un rand, lista scurta / restul fara repetari
describe('RoomAnswerSummary rows', () => {
  const answers = { layout: 'LINEAR', doorType: 'SLIDING', interiorModules: ['HANGING_RODS'], material: 'ALTUL', materialOther: 'sticlă fumurie' };
  const show = (only?: 'main' | 'extra') =>
    render(<NextIntlClientProvider locale="ro" messages={ro}><RoomAnswerSummary roomType="DRESSING" answers={answers} flowVersion={4} only={only} /></NextIntlClientProvider>);

  it('uses the short labels instead of the full questions', () => {
    const { container } = show();
    const labels = [...container.querySelectorAll('dt')].map((dt) => dt.textContent);
    expect(labels).toContain(ro.Configurator.flows.DRESSING.layout.summaryLabel);
    expect(labels).not.toContain(ro.Configurator.flows.DRESSING.layout.title);
  });

  it('puts "Altul" and the client text on one row', () => {
    const { container } = show();
    expect(container.textContent).toContain('Altul — sticlă fumurie');
    expect(container.textContent?.match(/sticlă fumurie/g)).toHaveLength(1);
  });

  it('the extra list does not repeat the main rows', () => {
    const main = [...show('main').container.querySelectorAll('dt')].map((dt) => dt.textContent);
    const extra = [...show('extra').container.querySelectorAll('dt')].map((dt) => dt.textContent);
    expect(main.length).toBeGreaterThan(0);
    expect(extra.length).toBeGreaterThan(0);
    expect(main.filter((label) => extra.includes(label))).toEqual([]);
  });

  it('long text without spaces can wrap inside the value', () => {
    const { container } = render(<NextIntlClientProvider locale="ro" messages={ro}><RoomAnswerSummary roomType="DRESSING" answers={{ ...answers, materialOther: 'x'.repeat(120) }} flowVersion={4} /></NextIntlClientProvider>);
    const dd = [...container.querySelectorAll('dd')].find((el) => el.textContent?.includes('xxxx'));
    expect(dd?.className).toContain('[overflow-wrap:anywhere]');
    expect(dd?.className).toContain('min-w-0');
  });
});
