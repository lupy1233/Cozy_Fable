'use client';

import { defaultPieceConfig, type Piece3dKind } from '@marketplace/shared';
import {
  CheckCircle2,
  DoorOpen,
  FolderOpen,
  Hammer,
  Layers,
  Maximize2,
  Move,
  Orbit,
  Paintbrush,
  RotateCw,
  Ruler,
  Send,
  Trophy,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useStudioStore } from '@/stores/studio-store';
import { cn } from '@/lib/utils';
import { PiecePreview } from './previews';

// Turul de invatare al Studioului (feedback PO): la prima vizita, o invitatie;
// apoi un jurnal de misiuni andocat in panoul "Piesele mele" — noua misiuni
// scurte pe care utilizatorul le EXECUTA, nu doar le citeste. Studioul
// detecteaza singur reusita (urmarind tranzitiile din store, respectiv gestul
// de orbita pe canvas), bifeaza si trece mai departe; tinta misiunii pulseaza
// discret in pagina (.tut-pulse). Se poate sari orice pas sau tot turul, iar
// din butonul "?" turul se reia oricand. "tutorialSeen" (persistat) opreste
// invitatia sa revina singura.

type StudioState = ReturnType<typeof useStudioStore.getState>;

// scena activa dintr-un snapshot de stare (nu hook — comparam prev vs. next)
function sceneOf(s: StudioState) {
  return s.scenes.find((sc) => sc.id === s.activeSceneId) ?? s.scenes[0];
}

export type TutorialPhase = 'welcome' | 'finale' | number | null;

export type TutorialTarget =
  | 'newPiece'
  | 'orbit'
  | 'rotate'
  | 'openings'
  | 'room'
  | 'newScene'
  | 'undo';

interface TutorialStep {
  key:
    | 'createPiece'
    | 'orbit'
    | 'movePiece'
    | 'rotatePiece'
    | 'addOpening'
    | 'adjustOpening'
    | 'styleRoom'
    | 'addScene'
    | 'undo';
  icon: LucideIcon;
  // ce element din pagina pulseaza cat timp misiunea e activa
  target: TutorialTarget | null;
  // misiunile pe store se considera indeplinite cand tranzitia prev→next o
  // dovedeste; 'orbit' e singura detectata din gest DOM (nu trece prin store)
  isDone?: (next: StudioState, prev: StudioState) => boolean;
}

// comparatiile ruleaza DOAR pe aceeasi scena — schimbarea tabului intre camere
// nu trebuie sa treaca misiuni din oficiu
function sameScene(next: StudioState, prev: StudioState) {
  const a = sceneOf(next);
  const b = sceneOf(prev);
  return a.id === b.id ? ([a, b] as const) : null;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    key: 'createPiece',
    icon: Hammer,
    target: 'newPiece',
    isDone: (next, prev) => Object.keys(next.pieces).length > Object.keys(prev.pieces).length,
  },
  {
    key: 'orbit',
    icon: Orbit,
    target: 'orbit',
  },
  {
    key: 'movePiece',
    icon: Move,
    target: null,
    isDone: (next, prev) => {
      const pair = sameScene(next, prev);
      if (!pair) return false;
      return pair[0].placements.some((pl) => {
        const old = pair[1].placements.find((x) => x.id === pl.id);
        return !!old && (old.x !== pl.x || old.z !== pl.z);
      });
    },
  },
  {
    key: 'rotatePiece',
    icon: RotateCw,
    target: 'rotate',
    isDone: (next, prev) => {
      const pair = sameScene(next, prev);
      if (!pair) return false;
      return pair[0].placements.some((pl) => {
        const old = pair[1].placements.find((x) => x.id === pl.id);
        return !!old && old.rotation !== pl.rotation;
      });
    },
  },
  {
    key: 'addOpening',
    icon: DoorOpen,
    target: 'openings',
    isDone: (next, prev) => {
      const pair = sameScene(next, prev);
      return !!pair && pair[0].openings.length > pair[1].openings.length;
    },
  },
  {
    key: 'adjustOpening',
    icon: Ruler,
    target: null,
    isDone: (next, prev) => {
      const pair = sameScene(next, prev);
      if (!pair) return false;
      return pair[0].openings.some((o) => {
        const old = pair[1].openings.find((x) => x.id === o.id);
        return (
          !!old &&
          (old.offset !== o.offset ||
            old.wall !== o.wall ||
            old.w !== o.w ||
            old.h !== o.h ||
            old.sill !== o.sill)
        );
      });
    },
  },
  {
    key: 'styleRoom',
    icon: Paintbrush,
    target: 'room',
    isDone: (next, prev) => {
      const pair = sameScene(next, prev);
      if (!pair) return false;
      const [a, b] = [pair[0].room, pair[1].room];
      return (
        a.widthM !== b.widthM ||
        a.depthM !== b.depthM ||
        a.wallColor !== b.wallColor ||
        a.floorColor !== b.floorColor
      );
    },
  },
  {
    key: 'addScene',
    icon: Layers,
    target: 'newScene',
    isDone: (next, prev) => next.scenes.length > prev.scenes.length,
  },
  {
    key: 'undo',
    icon: Undo2,
    target: 'undo',
    // singura actiune care SCADE istoria e undo-ul
    isDone: (next, prev) => next.history.length < prev.history.length,
  },
];

// tinta activa pentru pagina (pulseaza butonul corespunzator)
export function tutorialTargetFor(phase: TutorialPhase): TutorialTarget | null {
  return typeof phase === 'number' ? (TUTORIAL_STEPS[phase]?.target ?? null) : null;
}

// Dialog centrat pe modelul StudioModal (invitatia si finalul turului).
function TutorialModal({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// mini-plansele decorative din invitatie: elevatii reale, prinse cu ac de
// alama si usor rotite — acelasi limbaj cu ghost-ul de drag si landingul
const WELCOME_PLANSE: Array<{ kind: Piece3dKind; tilt: string }> = [
  { kind: 'BOOKCASE', tilt: '-rotate-3' },
  { kind: 'DRESSER', tilt: 'rotate-2' },
  { kind: 'DESK', tilt: '-rotate-1' },
];

export function StudioTutorial({
  phase,
  onPhase,
  canvasRef,
}: {
  phase: TutorialPhase;
  onPhase: (phase: TutorialPhase) => void;
  canvasRef: RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations('Studio');
  const setSeen = useStudioStore((s) => s.setTutorialSeen);
  // misiunea de undo n-are ce anula pe istorie goala (ex. tur pornit imediat
  // dupa un refresh) — cardul explica, iar butonul nu pulseaza degeaba
  const canUndo = useStudioStore((s) => s.history.length > 0);
  const stepIdx = typeof phase === 'number' ? phase : null;
  // bifa "Misiune indeplinita" e doar un strat vizual de ~1s: pasul urmator
  // e deja activ dedesubt, cu detectoarele armate — un gest facut imediat
  // dupa reusita conteaza pentru noua misiune, nu cade intr-o fereastra moarta
  const [flash, setFlash] = useState(false);

  const nextStep = useCallback(
    (from: number) => {
      setFlash(false);
      onPhase(from + 1 < TUTORIAL_STEPS.length ? from + 1 : 'finale');
    },
    [onPhase],
  );

  const advance = useCallback(
    (from: number) => {
      setFlash(true);
      onPhase(from + 1 < TUTORIAL_STEPS.length ? from + 1 : 'finale');
    },
    [onPhase],
  );

  const closeTour = useCallback(() => {
    setSeen(true);
    setFlash(false);
    onPhase(null);
  }, [setSeen, onPhase]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(false), 1000);
    return () => clearTimeout(id);
  }, [flash]);

  // detectia misiunilor pe store: comparam fiecare tranzitie prev→next
  useEffect(() => {
    if (stepIdx == null) return;
    const step = TUTORIAL_STEPS[stepIdx];
    if (!step?.isDone) return;
    let fired = false;
    const unsub = useStudioStore.subscribe((next, prev) => {
      if (fired) return;
      // undo/redo/draft incarcat inlocuiesc continutul "in masa" — nu sunt
      // gesturi de-ale utilizatorului si nu bifeaza misiuni (exceptie:
      // misiunea de undo, care exact tranzitia asta o cere)
      if (step.key !== 'undo' && next.bulkOps !== prev.bulkOps) return;
      if (!step.isDone!(next, prev)) return;
      fired = true;
      advance(stepIdx);
    });
    return unsub;
  }, [stepIdx, advance]);

  // misiunea de orbita: gest real pe fereastra 3D (drag >30px sau scroll);
  // nu trece prin store, asa ca ascultam DOM-ul cadrului
  useEffect(() => {
    if (stepIdx == null || TUTORIAL_STEPS[stepIdx]?.key !== 'orbit') return;
    const el = canvasRef.current;
    if (!el) return;
    let start: { x: number; y: number; scene: unknown } | null = null;
    let fired = false;
    const done = () => {
      if (fired) return;
      fired = true;
      advance(stepIdx);
    };
    const onDown = (e: PointerEvent) => {
      // orbita porneste DOAR de pe canvasul WebGL — nu de pe panoul plutitor
      // sau alte elemente HTML suprapuse cadrului
      if (e.button !== 0 || !(e.target instanceof HTMLCanvasElement)) return;
      start = { x: e.clientX, y: e.clientY, scene: sceneOf(useStudioStore.getState()) };
    };
    const onMove = (e: PointerEvent) => {
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 30) return;
      // daca gestul a miscat o piesa/un gol (scena s-a schimbat), e drag de
      // mutare, nu rotire de camera — gestul acesta nu mai conteaza
      if (sceneOf(useStudioStore.getState()) !== start.scene) {
        start = null;
        return;
      }
      done();
    };
    const onUp = () => {
      start = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (e.target instanceof HTMLCanvasElement) done();
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [stepIdx, canvasRef, advance]);

  if (phase === 'welcome') {
    return (
      <TutorialModal label={t('tutorial.welcomeTitle')} onClose={closeTour}>
        <div className="flex items-end justify-center gap-3 py-2">
          {WELCOME_PLANSE.map(({ kind, tilt }) => (
            <div
              key={kind}
              className={cn(
                'relative rounded-lg border border-border-2 bg-surface-2/70 p-2 shadow-sm',
                tilt,
              )}
            >
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#b08d57]" />
              <PiecePreview kind={kind} config={defaultPieceConfig(kind)} className="h-14 w-16" />
            </div>
          ))}
        </div>
        <h3 className="mt-3 text-center font-serif text-2xl leading-tight">
          {t('tutorial.welcomeTitle')}
        </h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          {t('tutorial.welcomeBody')}
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button
            variant="walnut"
            className="w-full"
            onClick={() => {
              // invitatia nu mai revine singura nici daca reincarci la mijloc
              setSeen(true);
              setFlash(false);
              onPhase(0);
            }}
          >
            {t('tutorial.start')}
          </Button>
          <button
            type="button"
            onClick={closeTour}
            className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            {t('tutorial.skipAll')}
          </button>
        </div>
      </TutorialModal>
    );
  }

  if (phase === 'finale') {
    return (
      <TutorialModal label={t('tutorial.finaleTitle')} onClose={closeTour}>
        <div className="grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-walnut-soft text-walnut">
            <Trophy className="h-7 w-7" />
          </span>
        </div>
        <h3 className="mt-3 text-center font-serif text-2xl leading-tight">
          {t('tutorial.finaleTitle')}
        </h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          {t('tutorial.finaleBody')}
        </p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {(
            [
              [FolderOpen, t('tutorial.finaleTip1')],
              [Maximize2, t('tutorial.finaleTip2')],
              [Send, t('tutorial.finaleTip3')],
            ] as Array<[LucideIcon, string]>
          ).map(([Icon, tip], i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-walnut-soft text-walnut">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{tip}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t('tutorial.finaleReplay')}
        </p>
        <Button variant="walnut" className="mt-4 w-full" onClick={closeTour}>
          {t('tutorial.finaleCta')}
        </Button>
      </TutorialModal>
    );
  }

  if (stepIdx == null) return null;
  const step = TUTORIAL_STEPS[stepIdx];
  const Icon = step.icon;

  // jurnalul de misiuni — andocat in panoul "Piesele mele" (nu acopera nimic)
  return (
    <div className="relative rounded-2xl border border-walnut/40 bg-surface p-3 shadow-sm">
      <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#b08d57]" />
      {flash ? (
        <div className="flex items-center justify-center gap-2.5 py-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-sage" />
          <p className="font-serif text-base">{t('tutorial.done')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t('tutorial.missionLabel', { n: stepIdx + 1, total: TUTORIAL_STEPS.length })}
            </span>
            <button
              type="button"
              title={t('tutorial.closeTour')}
              aria-label={t('tutorial.closeTour')}
              onClick={closeTour}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1.5 flex items-start gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-walnut-soft text-walnut">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-serif text-base leading-tight">
                {t(`tutorial.steps.${step.key}.title`)}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t(`tutorial.steps.${step.key}.body`)}
              </p>
              {step.key === 'undo' && !canUndo && (
                <p className="mt-1.5 rounded-lg bg-amber-soft/60 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/80">
                  {t('tutorial.steps.undo.hint')}
                </p>
              )}
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-walnut transition-all duration-500"
                style={{ width: `${(stepIdx / TUTORIAL_STEPS.length) * 100}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => nextStep(stepIdx)}
              className="shrink-0 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {t('tutorial.skipStep')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
