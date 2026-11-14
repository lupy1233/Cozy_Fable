import { FLOW_REGISTRY, getFlow, type AnswerMap, type DimensionGroupStep, type RoomType } from '@marketplace/shared';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { buildSummaryRows, otherTextPairs, rowImportance, summaryLabel, type Translate } from './summary-rows';

// traducator real (ICU) + has(), ca in componente
function translator(locale: 'ro' | 'en'): Translate {
  const messages = locale === 'ro' ? ro : en;
  const base = createTranslator({ locale, messages, namespace: 'Configurator' } as never) as unknown as (key: string, values?: Record<string, string | number>) => string;
  const lookup = (key: string) => key.split('.').reduce<unknown>((o, p) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[p] : undefined), messages.Configurator);
  const t = ((key: string, values?: Record<string, string | number>) => base(key, values)) as Translate;
  t.has = (key: string) => typeof lookup(key) === 'string';
  return t;
}

const tRo = translator('ro');
const tEn = translator('en');
const RO = { unit: 'cm' as const, locale: 'ro' };

const allFlows = () =>
  (Object.keys(FLOW_REGISTRY) as RoomType[]).flatMap((roomType) =>
    Object.values(FLOW_REGISTRY[roomType]).map((flow) => ({ roomType, flow })),
  );

describe('summaryLabel — toate fluxurile si versiunile', () => {
  it.each([['ro', tRo], ['en', tEn]] as const)('%s: every visible step has a short summary label (≤ 40 characters)', (_locale, t) => {
    const tooLong: string[] = [];
    for (const { roomType, flow } of allFlows()) {
      for (const step of flow.steps) {
        if (step.hidden) continue;
        const label = summaryLabel(t, step);
        // eticheta e un text, nu o cheie lipsa
        expect(label, `${roomType} v${flow.version} ${step.id}`).not.toMatch(/^flows\.|^common\.|^config3d\./);
        if (label.length > 40 || label.trim() === '') tooLong.push(`${roomType} v${flow.version} ${step.id}: ${label}`);
      }
    }
    expect(tooLong).toEqual([]);
  });

  it('uses the short label, with the full title as the fallback', () => {
    const layout = getFlow('KITCHEN', 4).steps.find((s) => s.id === 'layout')!;
    expect(summaryLabel(tRo, layout)).toBe('Formă');
    const noHas = ((key: string) => key) as Translate;
    expect(summaryLabel(noHas, layout)).toBe(layout.titleKey);
  });

  it('kitchen: the four opening questions get four different labels', () => {
    const steps = getFlow('KITCHEN', 4).steps.filter((s) => s.id.startsWith('openingSystems'));
    const labels = steps.map((s) => summaryLabel(tRo, s));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('Deschidere — suspendate');
  });
});

describe('importance — lista scurta din Sumar', () => {
  it('pieces, 3D, dimensions, material / opening steps and the first screen are main; files are extra', () => {
    for (const { roomType, flow } of allFlows()) {
      const visible = flow.steps.filter((s) => !s.hidden);
      const first = visible[0];
      const firstIds = new Set(first?.screenGroup ? visible.filter((s) => s.screenGroup === first.screenGroup).map((s) => s.id) : [first?.id]);
      for (const step of visible) {
        const where = `${roomType} v${flow.version} ${step.id}`;
        const imp = rowImportance(step, firstIds as Set<string>);
        if (step.type === 'upload') expect(imp, where).toBe('extra');
        else if (['pieces', 'configurator-3d', 'dimension-group'].includes(step.type)) expect(imp, where).toBe('main');
        else if (/^(material|frontMaterial|openingSystems|systems)/.test(step.id)) expect(imp, where).toBe('main');
        else if (firstIds.has(step.id)) expect(imp, where).toBe('main');
      }
    }
  });

  it('main and extra split the rows without overlap', () => {
    const answers: AnswerMap = { piecesNeeded: ['TV_UNIT'], tvStyle: 'FLOATING', materialTvUnit: 'PAL', systemsTvUnit: ['PUSH'], ledPieces: ['TV_UNIT'] };
    const rows = buildSummaryRows({ roomType: 'LIVING', answers, flowVersion: 3 }, tRo, RO);
    const main = rows.filter((r) => r.importance === 'main').map((r) => r.key);
    const extra = rows.filter((r) => r.importance === 'extra').map((r) => r.key);
    expect(main.length + extra.length).toBe(rows.length);
    expect(main.filter((k) => extra.includes(k))).toEqual([]);
    expect(main).toEqual(expect.arrayContaining(['piecesNeeded', 'materialTvUnit', 'systemsTvUnit']));
    expect(extra).toEqual(expect.arrayContaining(['tvStyle', 'ledPieces']));
  });
});

describe('"Altul" + text on one row', () => {
  it('material "Altul" takes the client text, and the text row disappears', () => {
    const answers: AnswerMap = { layout: 'LINEAR', material: 'ALTUL', materialOther: 'sticlă fumurie' };
    const rows = buildSummaryRows({ roomType: 'DRESSING', answers, flowVersion: 4 }, tRo, RO);
    const material = rows.find((r) => r.stepId === 'material');
    expect(material?.value).toBe('Altul — sticlă fumurie');
    expect(rows.some((r) => r.stepId === 'materialOther')).toBe(false);
  });

  it('works for a multi-choice "Other piece" too', () => {
    const answers: AnswerMap = { piecesNeeded: ['TV_UNIT', 'OTHER'], piecesOtherText: 'Raft pe colț' };
    const rows = buildSummaryRows({ roomType: 'LIVING', answers, flowVersion: 3 }, tEn, { unit: 'cm', locale: 'en' });
    expect(rows.find((r) => r.stepId === 'piecesNeeded')?.value).toMatch(/— Raft pe colț$/);
    expect(rows.some((r) => r.stepId === 'piecesOtherText')).toBe(false);
  });

  it('finds the text pairs from the flow conditions', () => {
    const pairs = otherTextPairs(getFlow('LIVING', 4).steps);
    expect(pairs.get('materialTvUnitOther')).toBe('materialTvUnit');
    expect(pairs.get('materialAllOther')).toBe('materialAll');
    expect(pairs.get('piecesOtherText')).toBe('piecesNeeded');
  });
});

describe('dimensions', () => {
  const step = getFlow('DRESSING', 4).steps.find((s) => s.id === 'dimensions') as DimensionGroupStep;
  const base: AnswerMap = { layout: 'LINEAR' };
  const [first] = step.slots(base);

  it('formats meters in the client unit, with the app language decimal mark', () => {
    const answers: AnswerMap = { ...base, dimensions: { [first.id]: 2.455 } };
    const room = { roomType: 'DRESSING' as const, answers, flowVersion: 4 };
    expect(buildSummaryRows(room, tRo, RO).find((r) => r.kind === 'dimensions')?.value).toBe('245,5 cm');
    expect(buildSummaryRows(room, tEn, { unit: 'cm', locale: 'en' }).find((r) => r.kind === 'dimensions')?.value).toBe('245.5 cm');
    expect(buildSummaryRows(room, tRo, { unit: 'm', locale: 'ro' }).find((r) => r.kind === 'dimensions')?.value).toBe('2,455 m');
  });

  it('marks a value outside the allowed range as invalid', () => {
    const answers: AnswerMap = { ...base, dimensions: { [first.id]: first.max + 1 } };
    const row = buildSummaryRows({ roomType: 'DRESSING', answers, flowVersion: 4 }, tRo, RO).find((r) => r.kind === 'dimensions');
    expect(row?.invalid).toBe(true);
    const ok = buildSummaryRows({ roomType: 'DRESSING', answers: { ...base, dimensions: { [first.id]: first.min } }, flowVersion: 4 }, tRo, RO);
    expect(ok.find((r) => r.kind === 'dimensions')?.invalid).toBeUndefined();
  });
});

describe('pieces', () => {
  it('skips rows without a name (no stray commas)', () => {
    const answers: AnswerMap = {
      pieces: [
        { name: '  ', quantity: 1, material: 'PAL', systems: [] },
        { name: 'Masă', quantity: 2, material: 'PAL', systems: [] },
      ],
    };
    const row = buildSummaryRows({ roomType: 'PIECES', answers, flowVersion: 1 }, tRo, RO).find((r) => r.kind === 'pieces');
    expect(row?.value).toBe('2× Masă');
    expect(row?.pieces).toHaveLength(1);
  });

  it('no row at all when every piece is unnamed', () => {
    const answers: AnswerMap = { pieces: [{ name: '', quantity: 1, material: 'PAL', systems: [] }] };
    expect(buildSummaryRows({ roomType: 'PIECES', answers, flowVersion: 1 }, tRo, RO).some((r) => r.kind === 'pieces')).toBe(false);
  });
});
