import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { getFlow, type AnswerMap, type QuestionStep } from '@marketplace/shared';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { isKitchenFrontsScreen, screenSections } from './kitchen-front-zones';
import { RoomFlowRunner } from './room-flow-runner';
import { roomScreens } from './room-screens';
import { StepRenderer } from './step-renderer';

vi.mock('./piece3d/dynamic', () => ({ Configurator3dStep: () => null }));
vi.mock('./room-sketch-upload', () => ({ RoomSketchUpload: () => null }));

// Etapa 6, pasii "acum, fara versiune noua": c2, c1, c7, c14

function strings(o: unknown): string[] {
  if (typeof o === 'string') return [o];
  if (o && typeof o === 'object') return Object.values(o).flatMap(strings);
  return [];
}

describe('texte formular (c2, c1)', () => {
  it('c2: subtitlul deschiderii are textul nou in RO si EN', () => {
    expect(ro.Configurator.common.pieceSystems.subtitle).toBe(
      'Pentru ușile și sertarele piesei. Dacă piesa nu are, alege varianta cea mai apropiată sau scrie în detalii.',
    );
    expect(en.Configurator.common.pieceSystems.subtitle).toContain("If the piece has none");
  });

  it('c1: niciun text din formular nu mai contine "lei/ml" (RO) sau "RON/lm" (EN)', () => {
    expect(strings(ro.Configurator).filter((s) => s.includes('lei/ml'))).toEqual([]);
    expect(strings(en.Configurator).filter((s) => /RON\/lm|\/lm\b/.test(s))).toEqual([]);
    expect(ro.Configurator.common.materials.PAL.info.price).toBe('250–450 lei pe metru liniar');
    // etapa 8 (glosar, D10): „lei” si in engleza
    expect(en.Configurator.common.materials.PAL.info.price).toBe('250–450 lei per linear metre');
  });

  it('c1: subtitlurile de material nu se mai contrazic', () => {
    expect(ro.Configurator.flows.DRESSING.material.subtitle).not.toContain('modulelor interioare');
    expect(ro.Configurator.flows.DRESSING.material.subtitle).toContain('corpul și ușile');
    for (const k of ['PIECE_SIDEBOARD', 'PIECE_WALL_CABINET', 'PIECE_BATHROOM_VANITY', 'PIECE_ENTRYWAY'] as const) {
      expect(ro.Configurator.flows[k].material.subtitle).toContain('corpul și fronturile');
      expect(en.Configurator.flows[k].material.subtitle).toContain('carcass and fronts');
    }
  });
});

describe('c7: contor sub campul "Altul"', () => {
  const flow = getFlow('DRESSING');
  const step = flow.steps.find((s) => s.id === 'materialOther') as QuestionStep;

  function Harness() {
    const [answers, setAnswers] = useState<AnswerMap>({ material: 'ALTUL' });
    return (
      <StepRenderer
        step={step}
        answers={answers}
        roomType="DRESSING"
        onChange={(value) => setAnswers((a) => ({ ...a, materialOther: value }))}
        onInfo={() => {}}
      />
    );
  }

  it('arata "x / 120" si numara caracterele; limita ramane 120', async () => {
    expect(step.type === 'text' && step.maxLength).toBe(120);
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <Harness />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('0 / 120 caractere')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('maxlength', '120');
    await userEvent.click(input);
    await userEvent.paste('Placaj de mesteacăn');
    expect(screen.getByText('19 / 120 caractere')).toBeInTheDocument();
    // contorul e legat de camp (cititoare de ecran)
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('19 / 120 caractere').id);
  }, 20000);
});

describe('c14: ecranul "Fronturi" al bucatariei pe zone (doar vizual)', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  beforeEach(() => {
    useConfiguratorStore.getState().reset();
  });

  const allAnswers: AnswerMap = { layout: 'L_SHAPE', hasIsland: true, separateFrontMaterials: true };

  function frontsScreen(answers: AnswerMap) {
    act(() => useConfiguratorStore.getState().addRoomWithAnswers('KITCHEN', answers));
    const room = useConfiguratorStore.getState().roomInstances[0];
    const screens = roomScreens(room, false);
    const index = screens.findIndex((s) => isKitchenFrontsScreen('KITCHEN', s));
    return { room, screens, index };
  }

  it('aceleasi pasi si acelasi numar de ecrane; in fiecare zona ordinea din flux', () => {
    const { room, screens, index } = frontsScreen(allAnswers);
    // etapa 6: bucataria noua porneste pe v4 (aceleasi id-uri de pas ca v3 → aceleasi zone)
    expect(room.flowVersion).toBe(4);
    expect(index).toBeGreaterThan(-1);
    const fronts = screens[index];
    // lista pasilor ecranului vine neschimbata din flux (screenGroup 'fronts')
    const flowIds = getFlow('KITCHEN', room.flowVersion)
      .steps.filter((s) => s.screenGroup === 'fronts')
      .map((s) => s.id);
    expect(fronts.map((s) => s.id).every((id) => flowIds.includes(id))).toBe(true);

    const sections = screenSections('KITCHEN', fronts, room.answers);
    expect(sections.map((s) => s.zone)).toEqual(['base', 'wall', 'island']);
    const shown = sections.flatMap((s) => s.steps.map((x) => x.id));
    // aceiasi pasi, fiecare o singura data
    expect([...shown].sort()).toEqual(fronts.map((s) => s.id).sort());
    for (const sec of sections) {
      const ids = sec.steps.map((s) => s.id);
      expect(ids).toEqual(flowIds.filter((id) => ids.includes(id)));
    }
    expect(sections[1].steps.map((s) => s.id)).toEqual(['frontMaterialWall', 'openingSystemsWall']);
    expect(sections[2].steps.map((s) => s.id)).toEqual(['frontMaterialIsland', 'openingSystemsIsland']);
  });

  it('fara "materiale diferite": materialul comun sus, zonele doar cu deschiderea', () => {
    const { room, screens, index } = frontsScreen({ layout: 'L_SHAPE', hasIsland: false });
    const sections = screenSections('KITCHEN', screens[index], room.answers);
    expect(sections.map((s) => s.zone)).toEqual([undefined, 'base', 'wall']);
    expect(sections[0].steps.map((s) => s.id)).toEqual(['frontMaterialBase', 'separateFrontMaterials']);
    expect(sections[1].steps.map((s) => s.id)).toEqual(['openingSystemsBase']);
  });

  it('alte ecrane raman o singura sectiune, fara titlu', () => {
    const { screens, index } = frontsScreen(allAnswers);
    const other = screens[index - 1];
    expect(screenSections('KITCHEN', other, {})).toEqual([{ steps: other }]);
  });

  it('runner-ul arata titlurile de zona pe ecranul "Fronturi"', () => {
    const { index } = frontsScreen(allAnswers);
    act(() => useConfiguratorStore.getState().setStepIndex(index));
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <RoomFlowRunner uploadTarget={{ kind: 'draft' } as never} onExitToCart={() => {}} onAllDone={() => {}} />
      </NextIntlClientProvider>,
    );
    const zones = ro.Configurator.flows.KITCHEN.v3.zones;
    const titles = new Set<string>([zones.base, zones.wall, zones.island]);
    const headings = screen
      .getAllByRole('heading')
      .map((h) => h.textContent ?? '')
      .filter((x) => titles.has(x));
    expect(headings).toEqual([zones.base, zones.wall, zones.island]);
    // zona "Corpuri suspendate" contine materialul si deschiderea suspendatelor
    const wall = screen.getByRole('region', { name: zones.wall });
    expect(wall.querySelector('[data-question-id="frontMaterialWall"]')).not.toBeNull();
    expect(wall.querySelector('[data-question-id="openingSystemsWall"]')).not.toBeNull();
    expect(within(wall).queryByText(zones.island)).toBeNull();
    expect(en.Configurator.flows.KITCHEN.v3.zones).toEqual({ base: 'Base units', wall: 'Wall units', island: 'Island' });
  }, 20000);
});
