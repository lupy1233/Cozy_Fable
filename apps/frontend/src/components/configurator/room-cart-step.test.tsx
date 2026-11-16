import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ROOM_TYPES } from '@marketplace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AttachmentTarget } from '@/hooks/use-requests';
import { api } from '@/lib/api';
import ro from '@/messages/ro.json';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { CartBasket } from './cart-basket';
import { CART_ART } from './cart-visual';
import { RoomCartStep } from './room-cart-step';

// hookul de scoatere a camerelor (b6) sterge schitele prin TanStack Query
function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="ro" messages={ro}>{children}</NextIntlClientProvider>
    </QueryClientProvider>
  );
}

function show(target?: AttachmentTarget) {
  const onContinue = vi.fn();
  render(
    <Providers>
      <RoomCartStep onBack={() => {}} onContinue={onContinue} uploadTarget={target} />
      <CartBasket uploadTarget={target} />
    </Providers>,
  );
  return { onContinue };
}

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(async () => undefined),
}));
const apiMock = vi.mocked(api);

const tile = (roomType: string) => document.querySelector<HTMLElement>(`[data-cart-tile="${roomType}"]`)!;
const types = () => useConfiguratorStore.getState().roomInstances.map((r) => r.roomType);

describe('cosul de camere si piese', () => {
  beforeEach(() => {
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().setStartMode('STANDARD');
  });

  it('fiecare tip de camera sau piesa are o imagine in cos', () => {
    for (const roomType of ROOM_TYPES) expect(CART_ART[roomType], roomType).toBeDefined();
  });

  it('pozele din cos exista pe disc, iar piesele tapitate au redare, nu schita', () => {
    for (const roomType of ROOM_TYPES) {
      const art = CART_ART[roomType];
      if (art.kind === 'photo') expect(existsSync(join(process.cwd(), 'public', art.src)), art.src).toBe(true);
    }
    for (const roomType of ['PIECE_SOFA', 'PIECE_ARMCHAIR', 'PIECE_OTTOMAN'] as const) {
      expect(CART_ART[roomType].kind, roomType).toBe('photo');
    }
  });

  it('butonul "Adauga {tip}" e unic si adauga o singura camera (nu si prin cartonas)', () => {
    show();
    // un singur buton cu acest nume: testele e2e si cititoarele de ecran se bazeaza pe el
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Bucătărie' }));
    expect(types()).toEqual(['KITCHEN']);
    expect(tile('KITCHEN')).toHaveAttribute('data-selected');
    // dupa adaugare, acelasi nume il poarta "+" din pasul de cantitate
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Bucătărie' }));
    expect(types()).toEqual(['KITCHEN', 'KITCHEN']);
    fireEvent.click(screen.getByRole('button', { name: 'Șterge Bucătărie' }));
    expect(types()).toEqual(['KITCHEN']);
  });

  it('click pe cartonas adauga doar cat timp tipul nu e in cos', () => {
    show();
    fireEvent.click(tile('BEDROOM'));
    fireEvent.click(tile('BEDROOM'));
    expect(types()).toEqual(['BEDROOM']);
  });

  it('cosul grupeaza camerele si piesele, cu cantitate si numar de sectiuni', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Dormitor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Dormitor' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Piese individuale' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Canapea' }));

    const basket = within(screen.getByRole('complementary', { name: 'Coșul cererii tale' }));
    expect(basket.getByText('2 camere · o piesă')).toBeInTheDocument();
    expect(basket.getByText('Dormitor')).toBeInTheDocument();
    expect(basket.getByText('Canapea')).toBeInTheDocument();
    expect(basket.getAllByText(/câteva întrebări/).length).toBe(2);

    fireEvent.click(basket.getByRole('button', { name: 'Scoate Dormitor din coș' }));
    expect(types()).toEqual(['BEDROOM', 'PIECE_SOFA']);
  });

  it('"Alta piesa" intra o singura data si se poate elimina', () => {
    show();
    fireEvent.click(screen.getByRole('tab', { name: 'Piese individuale' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă piese' }));
    expect(types()).toEqual(['PIECES']);
    expect(screen.queryByRole('button', { name: 'Adaugă piese' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Elimină' }));
    expect(types()).toEqual([]);
  });

  // b8-2: bifa "Am deja un proiect" a disparut; ramane linia "Mod: … · Schimba"
  it('arata modul cu "Schimba" in locul bifei "Am deja un proiect"', () => {
    const onBack = vi.fn();
    render(
      <Providers>
        <RoomCartStep onBack={onBack} onContinue={() => {}} />
      </Providers>,
    );
    expect(screen.queryByText('Am deja un proiect pentru toată locuința')).not.toBeInTheDocument();
    const mode = document.querySelector<HTMLElement>('[data-cart-mode]')!;
    expect(mode).toHaveTextContent(ro.Configurator.start.STANDARD.title);
    fireEvent.click(within(mode).getByRole('button', { name: ro.Configurator.cart.modeChange }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // b8 (PO g0-8): bifa de ajutor pe fiecare camera, cu avertisment cand camera are raspunsuri
  it('fiecare camera are bifa de ajutor; camera cu raspunsuri cere confirmare', () => {
    useConfiguratorStore.getState().addRoomWithAnswers('KITCHEN', { layout: 'L_SHAPE' });
    useConfiguratorStore.getState().addRoom('BEDROOM');
    show();
    const box = within(document.querySelector<HTMLElement>('[data-cart-design-help]')!);
    const [kitchen, bedroom] = box.getAllByRole('checkbox');
    fireEvent.click(bedroom);
    expect(useConfiguratorStore.getState().roomInstances.find((r) => r.roomType === 'BEDROOM')?.needsDesignHelp).toBe(true);
    fireEvent.click(kitchen);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(ro.Configurator.designHelpSwitch.kept);
    fireEvent.click(within(dialog).getByRole('button', { name: ro.Configurator.designHelpSwitch.confirm }));
    const rooms = useConfiguratorStore.getState().roomInstances;
    expect(rooms.every((r) => r.needsDesignHelp)).toBe(true);
    // toate bifate = "Am nevoie de ajutor"; raspunsurile raman in ciorna
    expect(useConfiguratorStore.getState().startMode).toBe('DESIGN_HELP');
    expect(rooms.find((r) => r.roomType === 'KITCHEN')?.answers.layout).toBe('L_SHAPE');
  });

  it('in "Am deja un proiect" nu exista bifa de ajutor', () => {
    useConfiguratorStore.getState().setStartMode('OWN_PROJECT');
    useConfiguratorStore.getState().addRoom('KITCHEN');
    show();
    expect(document.querySelector('[data-cart-design-help]')).toBeNull();
  });

  it('nu se poate continua cu cosul gol', () => {
    const { onContinue } = show();
    const next = screen.getByRole('button', { name: ro.Configurator.nav.startQuestions });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă Living' }));
    fireEvent.click(next);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
  // b6: scoaterea unei camere cu raspunsuri cere confirmare
  it("\"−\" scoate intai baia fara raspunsuri, fara dialog", () => {
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      roomInstances: [
        { localId: "full", roomType: "BATHROOM", flowVersion: 1, answers: { anything: "X" }, completed: false },
        { localId: "empty", roomType: "BATHROOM", flowVersion: 1, answers: {}, completed: false },
      ],
    });
    const filled = "full";
    show();
    fireEvent.click(screen.getByRole("button", { name: "Șterge Baie" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useConfiguratorStore.getState().roomInstances.map((r) => r.localId)).toEqual([filled]);
  });

  it("\"×\" pe o camera cu raspunsuri deschide dialogul; \"Păstrează\" nu schimba nimic", () => {
    useConfiguratorStore.getState().addRoomWithAnswers("KITCHEN", { layout: "L_SHAPE" });
    show();
    const basket = within(screen.getByRole("complementary", { name: "Coșul cererii tale" }));
    fireEvent.click(basket.getByRole("button", { name: "Scoate Bucătărie din coș" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Scoți Bucătărie?");
    expect(dialog).toHaveTextContent("Se pierde un răspuns.");
    // "Pastreaza" e butonul implicit (are focusul)
    expect(within(dialog).getByRole("button", { name: ro.Configurator.cart.removeDialog.keep })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: ro.Configurator.cart.removeDialog.keep }));
    expect(types()).toEqual(["KITCHEN"]);
  });

  it("la doua camere cu raspunsuri dialogul spune care se scoate; la confirmare schitele se sterg de pe ciorna", async () => {
    const A = "0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e";
    const B = "1c7be641-4d10-4d4a-9b50-9b5a4e6c3c7f";
    apiMock.mockClear();
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      roomInstances: [
        { localId: "b1", roomType: "BEDROOM", flowVersion: 2, answers: { sketch: [A] }, completed: false },
        { localId: "b2", roomType: "BEDROOM", flowVersion: 2, answers: { sketch: [B] }, completed: false, needsDesignHelp: true },
      ],
    });
    show({ kind: "draft", token: "tok" });
    fireEvent.click(screen.getByRole("button", { name: "Șterge Dormitor" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Scoți Dormitor 2?");
    expect(dialog).toHaveTextContent("se scoate Dormitor 2");
    expect(dialog).toHaveTextContent("Se șterge definitiv o schiță sau un fișier al camerei.");
    expect(dialog).toHaveTextContent(ro.Configurator.cart.removeDialog.help);
    fireEvent.click(within(dialog).getByRole("button", { name: ro.Configurator.cart.removeDialog.remove }));
    expect(useConfiguratorStore.getState().roomInstances.map((r) => r.localId)).toEqual(["b1"]);
    expect(useConfiguratorStore.getState().discardedFiles).toEqual([B]);
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/requests/drafts/tok/attachments/" + B, { method: "DELETE" }));
  });

  it("la editarea unei cereri publicate fisierele camerei scoase nu se sterg de pe server inainte de salvare", () => {
    apiMock.mockClear();
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      roomInstances: [{ localId: "b1", roomType: "BEDROOM", flowVersion: 2, answers: { sketch: ["0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e"] }, completed: true }],
    });
    show({ kind: "request", id: "req-1" });
    fireEvent.click(screen.getByRole("button", { name: "Șterge Dormitor" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("se scoate din cerere când salvezi modificările");
    fireEvent.click(within(dialog).getByRole("button", { name: ro.Configurator.cart.removeDialog.remove }));
    expect(types()).toEqual([]);
    expect(apiMock).not.toHaveBeenCalled();
  });
});

describe('cos — piese din Studio 3D', () => {
  beforeEach(() => {
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().setStartMode('STANDARD');
  });

  it('piesa din Studio nu are bifa de ajutor, ci o nota', () => {
    useConfiguratorStore.getState().loadSnapshot({
      ...useConfiguratorStore.getState().snapshot(),
      startMode: 'STANDARD',
      roomInstances: [
        { localId: 'k', roomType: 'KITCHEN', flowVersion: 1, answers: {}, completed: false },
        { localId: 's', roomType: 'PIECE_NIGHTSTAND', flowVersion: 1, answers: {}, completed: false, sourceStudio: { sceneId: 'scene', placementId: 'p' } },
      ],
    });
    show();
    const box = document.querySelector<HTMLElement>('[data-cart-design-help]')!;
    expect(within(box).getAllByRole('checkbox')).toHaveLength(1);
    expect(box.querySelector('[data-design-help-studio]')).toHaveTextContent(ro.Configurator.cart.designHelpStudio);
  });
});

// m3: ciorna veche cu bifa "Include proiectare cu plata"
describe('cos — nota pentru bifa veche de proiectare (m3)', () => {
  beforeEach(() => {
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().loadSnapshot({
      phase: 'cart', startMode: 'STANDARD', activeRoomIndex: 0, activeStepIndex: 0, inspirationPhotoIds: [], updatedAt: 1,
      roomInstances: [
        { localId: 'k', roomType: 'KITCHEN', flowVersion: 1, answers: {}, completed: false },
        { localId: 'b', roomType: 'BEDROOM', flowVersion: 1, answers: {}, completed: false },
      ],
      details: { includesPaidDesign: true } as never,
    });
  });

  it('apare o data si dispare dupa ce clientul bifeaza o camera', () => {
    show();
    const note = () => document.querySelector('[data-legacy-paid-design]');
    expect(note()).toHaveTextContent(ro.Configurator.cart.legacyPaidDesign);
    const box = within(document.querySelector<HTMLElement>('[data-cart-design-help]')!);
    fireEvent.click(box.getAllByRole('checkbox')[0]);
    expect(note()).toBeNull();
  });

  it('se poate inchide', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: ro.Configurator.cart.legacyPaidDesignClose }));
    expect(document.querySelector('[data-legacy-paid-design]')).toBeNull();
    expect(useConfiguratorStore.getState().legacyPaidDesignNote).toBe(false);
  });
});

// j1 (etapa 8): bara de jos lipita pe telefon, cu "{camere} · {piese}" langa "Incepe"; titlul nou
describe('cosul — bara de jos si titlul (etapa 8)', () => {
  beforeEach(() => {
    useConfiguratorStore.getState().reset();
    useConfiguratorStore.getState().setStartMode('STANDARD');
  });

  it('titlul pomeneste camerele si piesele', () => {
    show();
    expect(screen.getByRole('heading', { name: ro.Configurator.cart.title })).toBeInTheDocument();
    expect(ro.Configurator.cart.title).toBe('Ce vrei să mobilezi?');
    expect(screen.getByText(ro.Configurator.cart.subtitle)).toBeInTheDocument();
  });

  it('"Înapoi", rezumatul cosului si "Începe" stau in bara lipita, ultimul element al ecranului', () => {
    useConfiguratorStore.getState().addRoom('KITCHEN');
    useConfiguratorStore.getState().addRoom('PIECE_DESK');
    show();
    const bar = document.querySelector<HTMLElement>('[data-sticky-action-bar]')!;
    expect(bar).not.toBeNull();
    expect(bar.parentElement?.lastElementChild).toBe(bar);
    expect(bar).toContainElement(screen.getByRole('button', { name: ro.Configurator.nav.back }));
    const start = within(bar).getByRole('button', { name: ro.Configurator.nav.startQuestions });
    expect(start).toBeEnabled();
    expect(within(bar).getByText(/o cameră/)).toBeInTheDocument();
    expect(within(bar).getByText(/o piesă/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: ro.Configurator.nav.startQuestions })).toHaveLength(1);
  });
});
