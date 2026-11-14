import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import {
  getFlow,
  requestItemSchema,
  type AnswerMap,
  type AnswerValue,
  type QuestionStep,
  type RequestItemInput,
} from '@marketplace/shared';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { PIECE_DETAILS_MAX, PIECE_NAME_MAX, StepRenderer } from './step-renderer';

vi.mock('./piece3d/dynamic', () => ({ Configurator3dStep: () => null }));
vi.mock('./room-sketch-upload', () => ({ RoomSketchUpload: () => null }));

// c10: randul "Alta piesa" — Detalii legat de description, limite vizibile, liste de azi
const flow = getFlow('PIECES');
const step = flow.steps.find((s) => s.id === 'pieces') as QuestionStep;
const T = ro.Configurator;

function Harness({ initial, onAnswers }: { initial?: AnswerValue; onAnswers: (a: AnswerMap) => void }) {
  const [answers, setAnswers] = useState<AnswerMap>(initial ? { pieces: initial } : {});
  return (
    <StepRenderer
      step={step}
      answers={answers}
      roomType="PIECES"
      onChange={(value) => {
        const next = { ...answers, pieces: value };
        setAnswers(next);
        onAnswers(next);
      }}
      onInfo={() => {}}
    />
  );
}

function renderPieces(initial?: RequestItemInput[], locale: 'ro' | 'en' = 'ro') {
  const onAnswers = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <Harness initial={initial as AnswerValue | undefined} onAnswers={onAnswers} />
    </NextIntlClientProvider>,
  );
  return { onAnswers };
}

const lastPieces = (fn: ReturnType<typeof vi.fn>) =>
  (fn.mock.calls.at(-1)?.[0] as AnswerMap).pieces as RequestItemInput[];

const piece = (patch: Partial<RequestItemInput> = {}): RequestItemInput => ({
  name: 'Etajera',
  material: 'PAL',
  systems: [],
  quantity: 1,
  description: '',
  ...patch,
});

describe('StepRenderer — randul "Altă piesă" (c10)', () => {
  it('are campul "Detalii", iar textul ajunge in descrierea piesei si in camera derivata', async () => {
    const { onAnswers } = renderPieces();
    await userEvent.click(screen.getByRole('button', { name: T.pieces.add }));
    await userEvent.click(screen.getByLabelText(T.pieces.name));
    await userEvent.paste('Etajeră baie');
    await userEvent.click(screen.getByLabelText(T.pieces.details));
    await userEvent.paste('120 x 80 x 40 cm, alb mat');
    const pieces = lastPieces(onAnswers);
    expect(pieces[0].description).toBe('120 x 80 x 40 cm, alb mat');
    // aceeasi valoare pleaca mai departe prin deriveRoom (items -> fisa firmei)
    const room = flow.deriveRoom(onAnswers.mock.calls.at(-1)?.[0] as AnswerMap);
    expect(room.items[0].description).toBe('120 x 80 x 40 cm, alb mat');
    expect(requestItemSchema.safeParse(room.items[0]).success).toBe(true);
  }, 20000);

  it('arata limitele: 150 la nume si 2000 la detalii, cu contor', async () => {
    renderPieces([piece({ name: 'Raft', description: 'abc' })]);
    const name = screen.getByLabelText(T.pieces.name) as HTMLInputElement;
    const details = screen.getByLabelText(T.pieces.details) as HTMLTextAreaElement;
    expect(name.maxLength).toBe(PIECE_NAME_MAX);
    expect(PIECE_NAME_MAX).toBe(150);
    expect(details.maxLength).toBe(PIECE_DETAILS_MAX);
    expect(PIECE_DETAILS_MAX).toBe(2000);
    expect(screen.getByText('4 / 150 caractere')).toBeVisible();
    expect(screen.getByText('3 / 2000 caractere')).toBeVisible();
    await userEvent.type(name, 'ă');
    expect(screen.getByText('5 / 150 caractere')).toBeVisible();
  });

  it('lista de material arata doar materialele de azi (fara MDF simplu)', () => {
    renderPieces([piece()]);
    const select = screen.getByLabelText(T.pieces.material) as HTMLSelectElement;
    const values = within(select)
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV', 'ALTUL']);
  });

  it('la "Altul" ii spune clientului sa scrie materialul in "Detalii"', async () => {
    renderPieces([piece()]);
    expect(screen.queryByText(T.pieces.otherMaterialHint)).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText(T.pieces.material), 'ALTUL');
    expect(screen.getByText(T.pieces.otherMaterialHint)).toBeVisible();
    // m8: cititorul de ecran afla indemnul din campul Detalii
    expect(screen.getByLabelText(T.pieces.details)).toHaveAccessibleDescription(
      expect.stringContaining(T.pieces.otherMaterialHint),
    );
  });

  it('lista de deschidere arata doar Mâner / Push / Uși glisante', () => {
    renderPieces([piece()]);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((b) => b.closest('label')?.textContent)).toEqual([
      T.common.systems.MANER.label,
      T.common.systems.PUSH.label,
      T.common.systems.GLISANTE.label,
    ]);
  });

  it('o valoare veche deja salvata ramane afisata si selectata', () => {
    renderPieces([piece({ material: 'MDF', systems: ['BUTON_PRESIUNE', 'GOLA'] })]);
    const select = screen.getByLabelText(T.pieces.material) as HTMLSelectElement;
    expect(select.value).toBe('MDF');
    expect(within(select).getByRole('option', { name: T.common.materials.MDF.label })).toBeInTheDocument();
    for (const s of ['BUTON_PRESIUNE', 'GOLA'] as const) {
      expect(screen.getByRole('checkbox', { name: T.common.systems[s].label })).toBeChecked();
    }
    // validarea din shared accepta in continuare valorile vechi
    expect(
      requestItemSchema.safeParse(piece({ material: 'MDF', systems: ['BUTON_PRESIUNE', 'GOLA', 'AVENTOS'] })).success,
    ).toBe(true);
  });

  it('in engleza eticheta si contorul sunt traduse', () => {
    renderPieces([piece({ name: 'Shelf' })], 'en');
    expect(screen.getByLabelText(en.Configurator.pieces.details)).toBeVisible();
    expect(screen.getByText('5 / 150 characters')).toBeVisible();
  });
});

describe('Textele cosului si lista de deschidere (c10, c3)', () => {
  const pieceKeys = ['PIECE_TV_UNIT', 'PIECE_BOOKCASE', 'PIECE_DESK', 'PIECE_SHOE_CABINET'] as const;
  const banned = {
    ro: [/pe colț/i, /perete media/i, /vitrin/i, /rabatabil/i],
    en: [/corner/i, /media wall/i, /display/i, /tilt/i],
  };

  it.each(['ro', 'en'] as const)('descrierile din cos nu promit optiuni inexistente (%s)', (locale) => {
    const m = locale === 'ro' ? ro : en;
    const texts = [
      ...pieceKeys.map((k) => m.Configurator.rooms.desc[k]),
      m.Configurator.flows.PIECE_SHOE_CABINET.config3d.subtitle,
    ];
    for (const text of texts) for (const re of banned[locale]) expect(text).not.toMatch(re);
  });

  it('"Glisante" devine "Uși glisante (culisante)" si descrierea nu mai pomeneste sertarele', () => {
    expect(ro.Configurator.common.systems.GLISANTE.label).toBe('Uși glisante (culisante)');
    expect(en.Configurator.common.systems.GLISANTE.label).toBe('Sliding doors');
    expect(ro.Configurator.common.systems.GLISANTE.description).not.toMatch(/sertar/i);
    expect(ro.Configurator.common.systems.GLISANTE.info.body).not.toMatch(/sertar/i);
    expect(en.Configurator.common.systems.GLISANTE.description).not.toMatch(/drawer/i);
    expect(en.Configurator.common.systems.GLISANTE.info.body).not.toMatch(/drawer/i);
  });

  it('pretul usilor glisante e acelasi cu cel de la intrebarea despre usile dulapului (m1)', () => {
    expect(ro.Configurator.common.systems.GLISANTE.info.price).toBe(
      ro.Configurator.flows.PIECE_WARDROBE.doorType.options.SLIDING.info.price,
    );
    expect(ro.Configurator.common.systems.GLISANTE.info.price).toBe('+800–2.000 lei');
    expect(en.Configurator.common.systems.GLISANTE.info.price).toContain('800–2,000');
  });

  it.each(['ro', 'en'] as const)('biroul din cos nu promite picioare (m9, %s)', (locale) => {
    const m = locale === 'ro' ? ro : en;
    expect(m.Configurator.rooms.desc.PIECE_DESK).not.toMatch(locale === 'ro' ? /picioare/i : /legs/i);
  });
});
