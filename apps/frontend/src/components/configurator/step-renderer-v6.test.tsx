import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import {
  FIRM_DECIDES,
  getFlow,
  NO_FRONTS,
  openingOptions,
  pieceRowV2Schema,
  sameFinishStep,
  type AnswerMap,
  type AnswerValue,
  type MultiChoiceStep,
  type PiecesStep,
  type QuestionStep,
  type RoomFlow,
  type RoomType,
} from '@marketplace/shared';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { StepRenderer } from './step-renderer';
import { getIllustration } from './illustrations';
import { getQuestionTargets } from './illustrations/question-anchor';
import { isKitchenFrontsScreen, screenSections } from './kitchen-front-zones';
import { validateStep } from './room-screens';

vi.mock('./piece3d/dynamic', () => ({ Configurator3dStep: () => null }));
vi.mock('./room-sketch-upload', () => ({ RoomSketchUpload: () => null }));

// Versiune fictiva (99) a dormitorului: pasii v2 + intrebarea comuna construita cu
// sameFinishStep din shared (dulap + comoda comune; patul are setul de lemn → nu e comun).
// Fluxurile reale ale valului 2 nu sunt inca scrise cand ruleaza testul.
const FAKE_VERSION = 99;
vi.mock('@marketplace/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketplace/shared')>();
  return {
    ...actual,
    getFlow: (roomType: RoomType, version?: number): RoomFlow => {
      // 99 = FAKE_VERSION (factory-ul vi.mock e ridicat deasupra constantelor)
      if (roomType !== 'BEDROOM' || version !== 99) return actual.getFlow(roomType, version);
      const base = actual.getFlow('BEDROOM', 2);
      const piece = (value: string, materialSet: 'BODY' | 'WOOD') => ({
        value,
        icon: 'package',
        itemName: value,
        materialStepId: `material${value}`,
        systemsStepId: `systems${value}`,
        materialSet,
        fronts: 'YES' as const,
        materialTitleKey: 'x',
      });
      const same = actual.sameFinishStep({ flowKey: 'flows.BEDROOM', common: true }, [
        piece('WARDROBE', 'BODY'),
        piece('BED_FRAME', 'WOOD'),
        piece('DRESSER', 'BODY'),
      ]);
      return { ...base, version: 99, steps: [...base.steps, same] };
    },
  };
});

const T = ro.Configurator;

function Harness({
  step,
  initial,
  roomType = 'BEDROOM',
  inline,
  onAnswers,
}: {
  step: QuestionStep;
  initial?: AnswerMap;
  roomType?: RoomType;
  inline?: boolean;
  onAnswers: (a: AnswerMap) => void;
}) {
  const [answers, setAnswers] = useState<AnswerMap>(initial ?? {});
  return (
    <StepRenderer
      step={step}
      answers={answers}
      roomType={roomType}
      inline={inline}
      onChange={(value: AnswerValue) => {
        const next = { ...answers, [step.id]: value };
        setAnswers(next);
        onAnswers(next);
      }}
      onInfo={() => {}}
    />
  );
}

function renderStep(step: QuestionStep, initial?: AnswerMap, roomType?: RoomType, inline?: boolean) {
  const onAnswers = vi.fn();
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <Harness step={step} initial={initial} roomType={roomType} inline={inline} onAnswers={onAnswers} />
    </NextIntlClientProvider>,
  );
  const last = () => (onAnswers.mock.calls.at(-1)?.[0] as AnswerMap)[step.id];
  return { onAnswers, last };
}

// butonul cartonasului al carui titlu e exact eticheta
const card = (label: string) => screen.getByText(label, { exact: true, selector: 'span' }).closest('button')!;

describe('etapa 6 — bifele exclusive (option.exclusive)', () => {
  // lista reala din shared: Maner, Push, Fara usi sau sertare (exclusiva), Decide firma (exclusiva)
  const step: MultiChoiceStep = {
    id: 'systemsDresser',
    type: 'multi-choice',
    titleKey: 'common.finish.allOpening.title',
    minSelected: 1,
    options: openingOptions('GENERAL', { noFronts: true }),
  };

  it('ticking an exclusive option clears the others; ticking another option drops it', async () => {
    const user = userEvent.setup();
    const { last } = renderStep(step);
    await user.click(card(T.common.systems.MANER.label));
    await user.click(card(T.common.systems.PUSH.label));
    expect(last()).toEqual(['MANER', 'PUSH']);
    await user.click(card(T.common.finish.firmDecides.label));
    expect(last()).toEqual([FIRM_DECIDES]);
    await user.click(card(T.common.finish.opening.NO_FRONTS.label));
    expect(last()).toEqual([NO_FRONTS]);
    await user.click(card(T.common.systems.PUSH.label));
    expect(last()).toEqual(['PUSH']);
    // debifarea ramane debifare
    await user.click(card(T.common.systems.PUSH.label));
    expect(last()).toEqual([]);
  });

  it('a step without exclusive options keeps multiple ticks exactly as before', async () => {
    const user = userEvent.setup();
    const legacy = getFlow('BEDROOM', 2).steps.find((s) => s.type === 'multi-choice' && s.id === 'piecesNeeded') as MultiChoiceStep;
    expect(legacy.options.some((o) => o.exclusive)).toBe(false);
    const { last } = renderStep(legacy);
    await user.click(card(T.flows.BEDROOM.piecesNeeded.options.WARDROBE.label));
    await user.click(card(T.flows.BEDROOM.piecesNeeded.options.DRESSER.label));
    expect(last()).toEqual(['WARDROBE', 'DRESSER']);
  });
});

describe('etapa 6 — randul "Alta piesa" v2 (rowVersion 2)', () => {
  const v1Step = getFlow('PIECES', 1).steps.find((s) => s.id === 'pieces') as PiecesStep;
  const v2Step: PiecesStep = { ...v1Step, rowVersion: 2 };
  const row = { name: 'Etajeră', material: 'PAL' as const, systems: [], quantity: 1, description: '' };
  type Row = Record<string, unknown> & { systems: string[] };
  const lastRow = (last: () => unknown) => (last() as Row[])[0];

  it('writes optional cm dimensions as whole numbers and removes a cleared field', async () => {
    const user = userEvent.setup();
    const { last } = renderStep(v2Step, { pieces: [row] }, 'PIECES');
    const width = screen.getByLabelText(T.pieces.width);
    expect(width).toHaveAttribute('inputmode', 'numeric');
    await user.type(width, '120');
    await user.type(screen.getByLabelText(T.pieces.depth), '40');
    expect(lastRow(last)).toMatchObject({ widthCm: 120, depthCm: 40 });
    expect(lastRow(last)).not.toHaveProperty('heightCm');
    await user.clear(width);
    expect(lastRow(last)).not.toHaveProperty('widthCm');
    expect(screen.getByText(T.pieces.dimensionsHint)).toBeInTheDocument();
  });

  it('shows an out-of-range dimension as an error (what you see is what is sent)', async () => {
    const user = userEvent.setup();
    const { last } = renderStep(v2Step, { pieces: [row] }, 'PIECES');
    await user.type(screen.getByLabelText(T.pieces.height), '700');
    expect(lastRow(last)).toMatchObject({ heightCm: 700 });
    expect(screen.getByLabelText(T.pieces.height)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(new RegExp(T.validation.dimensionOutOfRange))).toBeInTheDocument();
  });

  // m1 (revizuire): virgula / punctul nu se mai sterg pe tacute ("12,5" nu devine 125)
  it('a decimal or non-number dimension gets a field error, blocks Continue and is never published', async () => {
    const user = userEvent.setup();
    const { last } = renderStep(v2Step, { pieces: [{ ...row, systems: ['MANER'] }] }, 'PIECES');
    const depth = screen.getByLabelText(T.pieces.depth);
    await user.type(depth, '12,5');
    expect(depth).toHaveValue('12,5');
    expect(depth).toHaveAttribute('aria-invalid', 'true');
    // ce se vede sta in raspuns: textul nevalid, pe care schema il respinge
    expect(lastRow(last)).toMatchObject({ depthCm: '12,5' });
    const err = screen.getByText(T.pieces.errors.wholeCm);
    expect(depth.getAttribute('aria-describedby')).toContain(err.id);
    // "Continua" respins; randul nu poate fi publicat
    expect(validateStep(v2Step, { pieces: last() as AnswerValue })).toBe('validation.dimensionOutOfRange');
    expect(pieceRowV2Schema.safeParse(lastRow(last)).success).toBe(false);
    await user.clear(depth);
    await user.type(depth, '60.5');
    expect(lastRow(last)).toMatchObject({ depthCm: '60.5' });
    expect(validateStep(v2Step, { pieces: last() as AnswerValue })).toBe('validation.dimensionOutOfRange');
    // corectat → trece
    await user.clear(depth);
    await user.type(depth, '125');
    expect(lastRow(last)).toMatchObject({ depthCm: 125 });
    expect(screen.queryByText(T.pieces.errors.wholeCm)).toBeNull();
    expect(validateStep(v2Step, { pieces: last() as AnswerValue })).toBeUndefined();
    // golit → cheia scoasa (dimensiune optionala)
    await user.clear(depth);
    expect(lastRow(last)).not.toHaveProperty('depthCm');
  });

  it('after a rejected Continue, a non-whole dimension keeps its own field error (no generic one above)', () => {
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <StepRenderer
          step={v2Step}
          answers={{ pieces: [{ ...row, systems: ['MANER'], widthCm: '12,5' }] as unknown as AnswerValue }}
          roomType="PIECES"
          error="validation.dimensionOutOfRange"
          onChange={() => {}}
          onInfo={() => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByLabelText(T.pieces.width)).toHaveValue('12,5');
    expect(screen.getAllByText(T.pieces.errors.wholeCm)).toHaveLength(1);
    expect(screen.queryByText(T.validation.dimensionOutOfRange)).toBeNull();
    expect(document.querySelector('[data-row-invalid]')).not.toBeNull();
  });

  // m2 (revizuire): dupa un "Continua" respins, eroarea sta pe randul si campul cu problema
  it('row errors appear next to the field of the faulty row, linked for screen readers', () => {
    const ok = { ...row, systems: ['MANER'] };
    const bad = { ...row, name: 'E', systems: [] };
    const onAnswers = vi.fn();
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <StepRenderer
          step={v2Step}
          answers={{ pieces: [ok, bad] as unknown as AnswerValue }}
          roomType="PIECES"
          error="validation.minOneOption"
          onChange={onAnswers}
          onInfo={() => {}}
        />
      </NextIntlClientProvider>,
    );
    const rows = document.querySelectorAll('[data-piece-row-version="2"]');
    expect(rows[0]).not.toHaveAttribute('data-row-invalid');
    expect(rows[1]).toHaveAttribute('data-row-invalid', 'true');
    const second = within(rows[1] as HTMLElement);
    const opening = second.getByRole('group', { name: T.pieces.openingTitle });
    const openingError = second.getByText(T.pieces.errors.opening);
    expect(opening.getAttribute('aria-describedby')).toBe(openingError.id);
    const nameError = second.getByText(T.pieces.errors.name);
    expect(second.getByLabelText(T.pieces.name).getAttribute('aria-describedby')).toContain(nameError.id);
    // nu si o data generic, sus pe pas
    expect(screen.queryByText(T.validation.minOneOption)).toBeNull();
    expect(within(rows[0] as HTMLElement).queryByText(T.pieces.errors.opening)).toBeNull();
  });

  it('without a rejected "Continue" a fresh row shows no errors yet', () => {
    renderStep(v2Step, { pieces: [row] }, 'PIECES');
    expect(screen.queryByText(T.pieces.errors.opening)).toBeNull();
    expect(screen.queryByText(T.pieces.errors.name)).toBeNull();
  });

  // m6 (revizuire): tinte de atingere de 44 px; "Sterge" nu e in grupul "Cum se deschide"
  it('opening checkboxes have 44 px touch targets and "Remove" sits outside the opening group', () => {
    renderStep(v2Step, { pieces: [row] }, 'PIECES');
    const opening = screen.getByRole('group', { name: T.pieces.openingTitle });
    for (const box of within(opening).getAllByRole('checkbox')) {
      expect(box.closest('label')?.className).toContain('min-h-11');
    }
    expect(within(opening).queryByRole('button', { name: new RegExp(T.pieces.remove) })).toBeNull();
    expect(screen.getByRole('button', { name: new RegExp(T.pieces.remove) }).className).toContain('min-h-11');
  });

  // verificarea in browser: textul lung se taia in lista → eticheta scurta, textul lung sub lista
  it('the material list uses the short "Decide firma" label; the long text shows as a description once chosen', async () => {
    const user = userEvent.setup();
    renderStep(v2Step, { pieces: [row] }, 'PIECES');
    const select = screen.getByLabelText(T.pieces.material);
    const option = within(select).getByRole('option', { name: T.pieces.firmDecidesShort });
    expect(T.pieces.firmDecidesShort).toBe('Decide firma');
    expect(option).toHaveValue(FIRM_DECIDES);
    expect(option).toHaveAttribute('title', T.pieces.firmDecides);
    expect(within(select).queryByRole('option', { name: T.pieces.firmDecides })).toBeNull();
    expect(document.querySelector('[data-firm-decides-hint]')).toBeNull();
    await user.selectOptions(select, FIRM_DECIDES);
    expect(document.querySelector('[data-firm-decides-hint]')).toHaveTextContent(T.pieces.firmDecides);
  });

  it('"firm decides" on material saves ALTUL + materialChoice; a real material removes the marker', async () => {
    const user = userEvent.setup();
    const { last } = renderStep(v2Step, { pieces: [row] }, 'PIECES');
    const select = screen.getByLabelText(T.pieces.material);
    await user.selectOptions(select, FIRM_DECIDES);
    expect(lastRow(last)).toMatchObject({ material: 'ALTUL', materialChoice: FIRM_DECIDES });
    // nu e "Altul" ales de client: fara indemnul de a scrie materialul
    expect(screen.queryByText(T.pieces.otherMaterialHint)).not.toBeInTheDocument();
    await user.selectOptions(select, 'MDF_VOPSIT');
    expect(lastRow(last)).toMatchObject({ material: 'MDF_VOPSIT' });
    expect(lastRow(last)).not.toHaveProperty('materialChoice');
  });

  it('opening: Maner / Push, plus the exclusive exits "firm decides" and "no doors or drawers"', async () => {
    const user = userEvent.setup();
    const { last } = renderStep(v2Step, { pieces: [row] }, 'PIECES');
    const opening = screen.getByRole('group', { name: T.pieces.openingTitle });
    const box = (label: string) => within(opening).getByRole('checkbox', { name: label });
    // regula unica: fara "Usi glisante"
    expect(within(opening).queryByRole('checkbox', { name: T.common.systems.GLISANTE.label })).toBeNull();
    await user.click(box(T.common.systems.MANER.label));
    expect(lastRow(last).systems).toEqual(['MANER']);
    await user.click(box(T.pieces.firmDecides));
    expect(lastRow(last)).toMatchObject({ systems: [], openingChoice: FIRM_DECIDES });
    expect(box(T.common.systems.MANER.label)).not.toBeChecked();
    await user.click(box(T.pieces.noFronts));
    expect(lastRow(last)).toMatchObject({ systems: [], openingChoice: NO_FRONTS });
    expect(box(T.pieces.firmDecides)).not.toBeChecked();
    await user.click(box(T.common.systems.PUSH.label));
    expect(lastRow(last).systems).toEqual(['PUSH']);
    expect(lastRow(last)).not.toHaveProperty('openingChoice');
  });

  it('a row filled through the UI passes pieceRowV2Schema; details are capped at 1800', async () => {
    const user = userEvent.setup();
    const { last } = renderStep(v2Step, { pieces: [row] }, 'PIECES');
    await user.selectOptions(screen.getByLabelText(T.pieces.material), FIRM_DECIDES);
    await user.type(screen.getByLabelText(T.pieces.width), '120');
    await user.type(screen.getByLabelText(T.pieces.height), '80');
    await user.click(screen.getByRole('checkbox', { name: T.pieces.noFronts }));
    expect(pieceRowV2Schema.safeParse(lastRow(last)).success).toBe(true);
    expect(screen.getByLabelText(T.pieces.details)).toHaveAttribute('maxlength', '1800');
  });

  it('v1 rows stay exactly as today (no cm fields, sliding doors offered, 2000 details)', () => {
    renderStep(v1Step, { pieces: [row] }, 'PIECES');
    expect(screen.queryByLabelText(T.pieces.width)).toBeNull();
    expect(screen.getByRole('checkbox', { name: T.common.systems.GLISANTE.label })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: T.pieces.firmDecides })).toBeNull();
    expect(screen.getByLabelText(T.pieces.details)).toHaveAttribute('maxlength', '2000');
    expect(document.querySelector('[data-piece-row-version="2"]')).toBeNull();
  });

  it('adding a v2 row starts empty and can be typed into without leaking v1 defaults', () => {
    const { last } = renderStep(v2Step, { pieces: [] }, 'PIECES');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T.pieces.add) }));
    expect(last()).toEqual([{ name: '', material: 'PAL', systems: [], quantity: 1, description: '' }]);
  });
});

describe('etapa 6 — banda de piese pe ecranul comun piece:ALL', () => {
  const allStep: QuestionStep = {
    id: 'materialAll',
    type: 'single-choice',
    titleKey: 'common.finish.allMaterial.title',
    screenGroup: 'piece:ALL',
    options: [],
  };

  it('shows only the common pieces that are ticked, all highlighted', () => {
    const strip = getQuestionTargets('BEDROOM', allStep, { piecesNeeded: ['WARDROBE', 'BED_FRAME', 'DRESSER'] }, FAKE_VERSION);
    expect(strip?.active).toBe('*');
    expect(strip?.items.map((i) => i.key)).toEqual(['WARDROBE', 'DRESSER']);
    expect(strip?.items.every((i) => i.labelKey)).toBe(true);
  });

  it('falls back to every ticked piece when the flow has no common question', () => {
    const strip = getQuestionTargets('BEDROOM', allStep, { piecesNeeded: ['WARDROBE', 'BED_FRAME'] }, 2);
    expect(strip).toMatchObject({ active: '*' });
    expect(strip?.items.map((i) => i.key)).toEqual(['WARDROBE', 'BED_FRAME']);
  });

  it('a per-piece screen keeps today\'s behaviour (one piece highlighted)', () => {
    const step = { ...allStep, id: 'materialWardrobe', screenGroup: 'piece:WARDROBE' } as QuestionStep;
    const strip = getQuestionTargets('BEDROOM', step, { piecesNeeded: ['WARDROBE', 'DRESSER'] }, 2);
    expect(strip?.active).toBe('WARDROBE');
  });

  it('renders the strip above the common material question', () => {
    renderStep(allStep, { piecesNeeded: ['WARDROBE', 'DRESSER'] });
    // fluxul real (v2, versiunea camerei nedata) nu are intrebarea comuna → toate piesele bifate
    expect(screen.getByText(T.flows.BEDROOM.piecesNeeded.options.WARDROBE.label)).toBeInTheDocument();
    expect(screen.getByText(T.flows.BEDROOM.piecesNeeded.options.DRESSER.label)).toBeInTheDocument();
  });

  it('the fake flow really carries the common question built by shared', () => {
    const step = getFlow('BEDROOM', FAKE_VERSION).steps.find((s) => s.id === 'sameFinishAll');
    expect(step?.visibleIf).toEqual({ questionId: 'piecesNeeded', in: ['WARDROBE', 'DRESSER'], atLeast: 2 });
    expect(sameFinishStep({ flowKey: 'flows.BEDROOM', common: true }, []).id).toBe('sameFinishAll');
  });
});

describe('etapa 6 — ilustratiile valorilor noi (DESIGN §8)', () => {
  const name = (rt: RoomType, stepId: string, value: string) => {
    const Illu = getIllustration(rt, stepId, value);
    return Illu ? (Illu.displayName ?? Illu.name) : null;
  };

  it.each([
    'FIRM_DECIDES', 'NO_FRONTS', 'PISTONS', 'MDF_INTEGRAL',
    'MIRROR_FRAMELESS', 'MIRROR_FRAME_WOOD', 'MIRROR_FRAME_MDF', 'MIRROR_FRAME_METAL',
    'WORKTOP_PAL_POSTFORMED', 'WORKTOP_HPL', 'WORKTOP_HPL_COMPACT', 'WORKTOP_QUARTZ', 'WORKTOP_SOLID_WOOD',
  ])('%s has a picture in any room and step', (value) => {
    for (const rt of ['BEDROOM', 'HALLWAY', 'LAUNDRY', 'BALCONY', 'KITCHEN', 'PIECE_TABLE'] as RoomType[]) {
      expect(getIllustration(rt, 'anyStep', value)).not.toBeNull();
    }
  });

  it('maps the new values to the agreed pictures', () => {
    expect(name('BEDROOM', 'materialBed', 'FIRM_DECIDES')).toBe('IlluFirmDecides');
    expect(name('LIVING', 'systemsBookshelf', 'NO_FRONTS')).toBe('IlluNoFronts');
    expect(name('HALLWAY', 'materialMirror', 'MIRROR_FRAMELESS')).toBe('IlluMirrorFrameless');
    expect(name('HALLWAY', 'materialMirror', 'MIRROR_FRAME_METAL')).toBe('IlluMirrorMetal');
    expect(getIllustration('KITCHEN', 'openingSystemsWall', 'PISTONS')).toBe(getIllustration('KITCHEN', 'x', 'AVENTOS'));
    expect(getIllustration('BATHROOM', 'materialVanity', 'MDF_INTEGRAL')).toBe(getIllustration('BATHROOM', 'x', 'MDF_VOPSIT'));
    expect(getIllustration('HALLWAY', 'materialMirror', 'MIRROR_FRAME_WOOD')).toBe(getIllustration('HALLWAY', 'x', 'LEMN_MASIV'));
    expect(getIllustration('HALLWAY', 'materialMirror', 'MIRROR_FRAME_MDF')).toBe(getIllustration('HALLWAY', 'x', 'MDF_VOPSIT'));
    expect(name('LAUNDRY', 'materialCountertop', 'WORKTOP_HPL')).toMatch(/OptionPhoto|countertop/i);
    // holul v2: tipul usilor dulapului, aceleasi poze ca la dormitor
    expect(getIllustration('HALLWAY', 'wardrobeDoorType', 'SLIDING')).toBe(getIllustration('BEDROOM', 'wardrobeDoorType', 'SLIDING'));
    expect(getIllustration('HALLWAY', 'wardrobeDoorType', 'HINGED')).toBe(getIllustration('BEDROOM', 'wardrobeDoorType', 'HINGED'));
    // valorile vechi ale blatului de bucatarie raman neschimbate
    expect(getIllustration('KITCHEN', 'countertop', 'HPL')).not.toBe(getIllustration('KITCHEN', 'countertop', 'WORKTOP_HPL_COMPACT'));
  });
});

// M1 (revizuire): intrebarea da / nu OBLIGATORIE de pe un ecran cu alte intrebari
describe('etapa 6 — perechea Da / Nu pentru sameFinishAll (inline, obligatoriu)', () => {
  const same = getFlow('BEDROOM', 3).steps.find((s) => s.id === 'sameFinishAll') as QuestionStep;
  const yes = () => screen.getByRole('button', { name: new RegExp(`^${T.common.boolean.yes}$`) });
  const no = () => screen.getByRole('button', { name: new RegExp(`^${T.common.boolean.no}$`) });

  it('shows Da and Nu with nothing chosen; Nu can be chosen directly and is announced', async () => {
    const user = userEvent.setup();
    const { last } = renderStep(same, { piecesNeeded: ['WARDROBE', 'DRESSER'] }, 'BEDROOM', true);
    expect(same.optional).toBeFalsy();
    expect(screen.getByRole('group', { name: T.common.finish.sameAll.title })).toBeInTheDocument();
    expect(yes()).toHaveAttribute('aria-pressed', 'false');
    expect(no()).toHaveAttribute('aria-pressed', 'false');
    await user.click(no());
    expect(last()).toBe(false);
    expect(no()).toHaveAttribute('aria-pressed', 'true');
    expect(yes()).toHaveAttribute('aria-pressed', 'false');
    await user.click(yes());
    expect(last()).toBe(true);
    expect(yes()).toHaveAttribute('aria-pressed', 'true');
  });

  it('an untouched required question does not pass validation', () => {
    expect(validateStep(same, { piecesNeeded: ['WARDROBE', 'DRESSER'] })).toBe('validation.answerRequired');
    expect(validateStep(same, { piecesNeeded: ['WARDROBE', 'DRESSER'], sameFinishAll: false })).toBeUndefined();
  });

  it('an optional inline yes / no (kitchen island) keeps its single card', () => {
    const island = getFlow('KITCHEN', 3).steps.find((s) => s.id === 'hasIsland') as QuestionStep;
    renderStep(island, {}, 'KITCHEN', true);
    expect(document.querySelector('[data-boolean-pair]')).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(`^${T.common.boolean.no}$`) })).toBeNull();
    expect(screen.getByText(T.flows.KITCHEN.hasIsland.cardLabel)).toBeInTheDocument();
  });
});

// m3 (revizuire): zonele "Fronturi" doar la bucataria v3 / v4
describe('etapa 6 — zonele ecranului Fronturi nu apar la bucataria v2', () => {
  it('the separate v2 opening screen keeps a single untitled section', () => {
    const steps = getFlow('KITCHEN', 2).steps.filter((s) => s.id === 'openingSystemsBase');
    expect(isKitchenFrontsScreen('KITCHEN', steps)).toBe(false);
    expect(screenSections('KITCHEN', steps, {})).toEqual([{ steps }]);
  });

  it('the single v4 fronts screen still has zones', () => {
    const flow = getFlow('KITCHEN', 4);
    const fronts = flow.steps.filter((s) => s.screenGroup === 'fronts' && !s.visibleIf);
    expect(isKitchenFrontsScreen('KITCHEN', fronts)).toBe(true);
  });
});
