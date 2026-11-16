import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { getFlow, type AnswerMap, type QuestionStep, type RoomType } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { isNotRecommendedHere } from './material-warning';
import { StepRenderer } from './step-renderer';

vi.mock('./piece3d/dynamic', () => ({ Configurator3dStep: () => null }));
vi.mock('./room-sketch-upload', () => ({ RoomSketchUpload: () => null }));

// c13 (etapa 12): "Nerecomandat aici" pe PAL / MDF la balcon deschis si pe PAL la baia neventilata,
// pe aceiasi pasi si din aceleasi raspunsuri ca insigna "Recomandat". Doar afisare.

function stepOf(roomType: RoomType, version: number, id: string): QuestionStep {
  const step = getFlow(roomType, version).steps.find((s) => s.id === id);
  if (!step) throw new Error(`pas lipsa ${roomType}@v${version}/${id}`);
  return step;
}

const OPEN: AnswerMap = { enclosed: 'OPEN' };
const ENCLOSED: AnswerMap = { enclosed: 'ENCLOSED' };
const NO_VENT: AnswerMap = { ventilation: 'NONE' };
const WINDOW: AnswerMap = { ventilation: 'WINDOW' };

describe('isNotRecommendedHere', () => {
  it('balcon deschis (v4): PAL si toate MDF-urile, nu lemnul masiv / Altul / decide firma', () => {
    const step = stepOf('BALCONY', 4, 'materialTallCabinet');
    for (const v of ['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'MDF_INTEGRAL']) {
      expect(isNotRecommendedHere('BALCONY', step, v, OPEN)).toBe(true);
    }
    for (const v of ['LEMN_MASIV', 'ALTUL', 'FIRM_DECIDES']) {
      expect(isNotRecommendedHere('BALCONY', step, v, OPEN)).toBe(false);
    }
  });

  it('balcon inchis sau fara raspuns: nimic', () => {
    const step = stepOf('BALCONY', 4, 'materialShelves');
    expect(isNotRecommendedHere('BALCONY', step, 'PAL', ENCLOSED)).toBe(false);
    expect(isNotRecommendedHere('BALCONY', step, 'PAL', {})).toBe(false);
  });

  it('versiunile vechi ale balconului: aceeasi regula pe pasii cu insigna (v1: PAL si MDF)', () => {
    const v1 = stepOf('BALCONY', 1, 'material');
    expect(isNotRecommendedHere('BALCONY', v1, 'PAL', OPEN)).toBe(true);
    expect(isNotRecommendedHere('BALCONY', v1, 'MDF', OPEN)).toBe(true);
    expect(isNotRecommendedHere('BALCONY', v1, 'LEMN_MASIV', OPEN)).toBe(false);
  });

  it('blatul balconului (fara insigna, c6) nu primeste avertisment', () => {
    const worktop = stepOf('BALCONY', 4, 'materialWorktop');
    expect(isNotRecommendedHere('BALCONY', worktop, 'PAL', OPEN)).toBe(false);
  });

  it('baie neventilata: doar PAL; MDF-urile raman fara avertisment', () => {
    for (const [version, id] of [[4, 'materialVanity'], [2, 'materialTall']] as const) {
      const step = stepOf('BATHROOM', version, id);
      expect(isNotRecommendedHere('BATHROOM', step, 'PAL', NO_VENT)).toBe(true);
      expect(isNotRecommendedHere('BATHROOM', step, 'MDF_INFOLIAT', NO_VENT)).toBe(false);
      expect(isNotRecommendedHere('BATHROOM', step, 'MDF_VOPSIT', NO_VENT)).toBe(false);
      expect(isNotRecommendedHere('BATHROOM', step, 'PAL', WINDOW)).toBe(false);
    }
  });

  it('alte camere (spalatoria are insigna, dar nu avertisment)', () => {
    const step = stepOf('LAUNDRY', 4, 'materialStorage');
    expect(isNotRecommendedHere('LAUNDRY', step, 'PAL', NO_VENT)).toBe(false);
  });
});

function renderStep(step: QuestionStep, roomType: RoomType, answers: AnswerMap, locale: 'ro' | 'en' = 'ro') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <StepRenderer step={step} answers={answers} roomType={roomType} onChange={() => {}} onInfo={() => {}} />
    </NextIntlClientProvider>,
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// butonul cartonasului al carui nume accesibil incepe cu eticheta optiunii
const button = (label: string) => screen.getByRole('button', { name: new RegExp(`^${escapeRe(label)}`) });

describe('afisarea in pasul de material', () => {
  it('balcon deschis: PAL are "Nerecomandat aici" in numele butonului, lemnul masiv are "Recomandat"', () => {
    renderStep(stepOf('BALCONY', 4, 'materialTallCabinet'), 'BALCONY', OPEN);
    const pal = button(ro.Configurator.common.materials.PAL.label);
    expect(within(pal).getByText('Nerecomandat aici')).toBeTruthy();
    const wood = button(ro.Configurator.common.materials.LEMN_MASIV.label);
    expect(within(wood).queryByText('Nerecomandat aici')).toBeNull();
    expect(screen.getAllByText('Nerecomandat aici').length).toBe(5);
  });

  it('balcon inchis: niciun avertisment', () => {
    renderStep(stepOf('BALCONY', 4, 'materialTallCabinet'), 'BALCONY', ENCLOSED);
    expect(screen.queryByText('Nerecomandat aici')).toBeNull();
  });

  it('baie neventilata, in engleza: doar PAL', () => {
    renderStep(stepOf('BATHROOM', 4, 'materialVanity'), 'BATHROOM', NO_VENT, 'en');
    expect(screen.getAllByText('Not recommended here').length).toBe(1);
    const pal = button(en.Configurator.common.materials.PAL.label);
    expect(within(pal).getByText('Not recommended here')).toBeTruthy();
  });
});
