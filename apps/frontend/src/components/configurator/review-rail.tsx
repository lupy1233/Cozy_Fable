'use client';

import type { QuestionStep } from '@marketplace/shared';
import { Check, ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useConfiguratorStore, type ConfiguratorPhase } from '@/stores/configurator-store';
import { roomScreens, validateStep } from './room-screens';
import { buildSummaryRows, summaryLabel, type SummaryRow } from './summary-rows';

// "Fisa cererii" — panoul din dreapta chestionarului (design 2026-11): firul de
// verificare cu un nod pe sectiune si raspunsurile date pana acum. Doar citeste
// starea; navigarea foloseste aceleasi actiuni din store ca runner-ul
// (setActiveRoom / setStepIndex), deci nu ocoleste nicio validare:
// inapoi se poate oricand, inainte doar daca toate ecranele dinainte sunt valide
// (acelasi drum ca apasarea repetata pe "Continua").
// Nod plin salvie = sectiune completa; alama = sectiunea curenta;
// contur chihlimbar = lipseste ceva; contur neutru = inca neatinsa.

export type RailState = 'done' | 'now' | 'issue' | 'next';

export function RailNode({ state, className }: { state: RailState; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'box-border h-2.5 w-2.5 shrink-0 rounded-full border-2',
        state === 'done' && 'border-sage bg-sage',
        state === 'now' && 'border-brass bg-brass',
        state === 'issue' && 'border-amber bg-amber-soft',
        state === 'next' && 'border-muted-2 bg-surface-2',
        className,
      )}
    />
  );
}

interface SheetRow {
  key: string;
  label?: string;
  value?: string;
  mono?: boolean;
  muted?: boolean;
  // raspuns obligatoriu care lipseste: linie punctata chihlimbar
  missing?: boolean;
  // b10: valoare in afara intervalului — rosu + "de corectat", nu ca valoare acceptata
  invalid?: boolean;
}

interface SheetSection {
  index: number;
  title: string;
  state: RailState;
  reachable: boolean;
  rows: SheetRow[];
  // sectiune neatinsa: doar "N intrebari" / "optional"
  hint?: string;
}

// fazele de dupa camere, in ordinea wizard-ului
const TAIL_PHASES: ConfiguratorPhase[] = ['uploads', 'details', 'review'];

// j1: pe ecrane mici Fisa e pliata implicit; de la lg (1024 px) e mereu deschisa
const LG_QUERY = '(min-width: 1024px)';

function useIsLg(enabled: boolean): boolean {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(LG_QUERY);
    setIsLg(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setIsLg(event.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [enabled]);
  return isLg;
}

function hasAnswer(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function RequestSheet({
  phase,
  phaseOrder,
  designHelp,
  filesCount,
  collapsible = false,
  className,
}: {
  phase: ConfiguratorPhase;
  // ordinea fazelor pentru modul curent (fara 'rooms' la "am nevoie de ajutor")
  phaseOrder: ConfiguratorPhase[];
  designHelp: boolean;
  // b10: fisierele cererii (fara imaginile 3D); lipsa = "opțional" / "obligatoriu" ca inainte
  filesCount?: number;
  // j1: pliata implicit sub lg, deschisa mereu de la lg
  collapsible?: boolean;
  className?: string;
}) {
  const t = useTranslations('Configurator');
  const locale = useLocale();
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const activeRoomIndex = useConfiguratorStore((s) => s.activeRoomIndex);
  const activeStepIndex = useConfiguratorStore((s) => s.activeStepIndex);
  const hasOwnProject = useConfiguratorStore((s) => s.details.hasOwnProject === true);
  const unit = useConfiguratorStore((s) => s.dimensionUnit);
  const setActiveRoom = useConfiguratorStore((s) => s.setActiveRoom);
  const setStepIndex = useConfiguratorStore((s) => s.setStepIndex);
  const isLg = useIsLg(collapsible);
  const [openSmall, setOpenSmall] = useState(false);

  // ecranele + randurile de rezumat ale fiecarei camere; flow necunoscut → camera fara sectiuni
  const model = useMemo(
    () =>
      rooms.map((room) => {
        let screens: QuestionStep[][] = [];
        let rows: SummaryRow[] = [];
        // b8: camera bifata "am nevoie de ajutor" nu are intrebari de numarat
        if (room.needsDesignHelp) {
          return { screens, byStep: new Map<string, SummaryRow[]>(), valid: [] as boolean[], required: 0, answered: 0 };
        }
        try {
          screens = roomScreens(room, hasOwnProject);
          rows = buildSummaryRows(room, t, { unit, locale });
        } catch {
          screens = [];
          rows = [];
        }
        const byStep = new Map<string, SummaryRow[]>();
        for (const row of rows) byStep.set(row.stepId, [...(byStep.get(row.stepId) ?? []), row]);
        const valid = screens.map((screen) => screen.every((s) => validateStep(s, room.answers) === undefined));
        const required = screens.flat().filter((s) => !s.optional);
        const answered = required.filter((s) => validateStep(s, room.answers) === undefined).length;
        return { screens, byStep, valid, required: required.length, answered };
      }),
    [rooms, hasOwnProject, t, unit, locale],
  );

  const inRooms = phase === 'rooms' && !designHelp;
  const totalRequired = model.reduce((n, m) => n + m.required, 0);
  const totalAnswered = model.reduce((n, m) => n + m.answered, 0);

  const rowsForStep = (step: QuestionStep, rows: SummaryRow[] | undefined, answered: boolean, withLabel: boolean): SheetRow[] => {
    const label = withLabel ? summaryLabel(t, step) : undefined;
    if (!rows || rows.length === 0) {
      // raspuns dat, dar fara rand propriu: textul "Altul" e deja pe randul alegerii
      if (answered && step.type === 'text') return [];
      if (step.optional) return withLabel ? [] : [{ key: step.id, value: t('sheet.optional'), muted: true }];
      return [{ key: step.id, label, missing: true }];
    }
    return rows.map((row) => ({
      key: row.key,
      // dimensiunile au mereu eticheta slotului
      label: row.kind === 'dimensions' ? row.label : label,
      value: row.value,
      mono: row.mono,
      invalid: row.invalid,
    }));
  };

  const sectionsOf = (roomIndex: number): SheetSection[] => {
    const room = rooms[roomIndex];
    const m = model[roomIndex];
    if (!room || !m) return [];
    const current = Math.min(activeStepIndex, m.screens.length - 1);
    return m.screens.map((screen, index) => {
      const touched = screen.some((s) => room.answers[s.id] !== undefined);
      const state: RailState =
        index === current
          ? 'now'
          : m.valid[index] && (index < current || touched)
            ? 'done'
            : !m.valid[index] && (index < current || touched)
              ? 'issue'
              : 'next';
      const first = screen[0];
      const title = first ? summaryLabel(t, first) : '';
      if (state === 'next') {
        const requiredCount = screen.filter((s) => !s.optional).length;
        return {
          index,
          title,
          state,
          reachable: m.valid.slice(0, index).every(Boolean),
          rows: [],
          hint: requiredCount === 0 ? t('sheet.optional') : t('sheet.questions', { count: requiredCount }),
        };
      }
      const rows = screen.flatMap((s) => rowsForStep(s, m.byStep.get(s.id), hasAnswer(room.answers[s.id]), screen.length > 1));
      return {
        index,
        title,
        state,
        reachable: index <= current || m.valid.slice(0, index).every(Boolean),
        rows,
      };
    });
  };

  const phaseState = (p: ConfiguratorPhase): RailState => {
    const at = phaseOrder.indexOf(phase);
    const mine = phaseOrder.indexOf(p);
    return mine === at ? 'now' : mine < at ? 'done' : 'next';
  };

  // b10: o singura numaratoare, cu eticheta: "6 din 19 răspunsuri obligatorii"
  const progress =
    !designHelp && totalRequired > 0 ? t('sheet.progress', { done: totalAnswered, total: totalRequired }) : null;

  // fisierele cererii: numarul, cand il stim; la 0 "opțional" / "obligatoriu" (proiect propriu)
  const filesHint =
    filesCount !== undefined && filesCount > 0
      ? t('summaryFiles.count', { n: filesCount })
      : hasOwnProject
        ? t('sheet.required')
        : t('sheet.optional');

  const body = (
    <>
      <div className={cn('flex items-baseline justify-between gap-3', collapsible && 'hidden lg:flex')}>
        <h2 className="heading-section">{t('sheet.title')}</h2>
        {progress && <span className="text-right text-ui text-muted-foreground" data-sheet-progress>{progress}</span>}
      </div>

      <div className="flex flex-col gap-3.5">
        {rooms.map((room, i) => {
          const roomLabel = t(`rooms.type.${room.roomType}`);
          const number = String(i + 1).padStart(2, '0');
          const flagged = designHelp || room.needsDesignHelp === true;
          const expanded = inRooms && i === activeRoomIndex && !flagged;
          if (expanded) {
            const sections = sectionsOf(i);
            return (
              <div key={room.localId} className="flex flex-col gap-3">
                <p className="label text-foreground">
                  <span className="mr-1.5 font-mono">{number}</span>
                  {roomLabel}
                </p>
                <ol className="flex flex-col">
                  {sections.map((s, si) => (
                    <li key={s.index} className="flex gap-3" aria-current={s.state === 'now' ? 'step' : undefined}>
                      <span aria-hidden className="flex w-3 flex-none flex-col items-center">
                        <RailNode state={s.state} className="mt-[5px]" />
                        {si < sections.length - 1 && <span className="w-px flex-1 bg-border-2" />}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 pb-3.5">
                        <div className="flex items-baseline justify-between gap-2.5">
                          {s.state !== 'now' && s.reachable ? (
                            <button
                              type="button"
                              onClick={() => setStepIndex(s.index)}
                              className={cn(
                                'min-w-0 rounded-sm text-left text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut',
                                s.state === 'next' && 'text-muted-foreground',
                              )}
                            >
                              {s.title}
                            </button>
                          ) : (
                            <span
                              className={cn(
                                'min-w-0 text-sm',
                                s.state === 'now' ? 'font-semibold' : 'font-medium',
                                s.state === 'next' && 'text-muted-foreground',
                              )}
                            >
                              {s.title}
                            </span>
                          )}
                          {s.hint && <span className="shrink-0 text-ui text-muted-foreground">{s.hint}</span>}
                        </div>
                        {s.rows.map((row) => (
                          <div key={row.key} className="flex justify-between gap-2.5 text-ui">
                            {row.label && (
                              <span className="max-w-[45%] shrink-0 break-words text-muted-foreground">
                                {row.label}
                              </span>
                            )}
                            {row.missing ? (
                              <span className="ml-auto text-amber">
                                <span aria-hidden className="tracking-[0.2em]">
                                  - - - - -
                                </span>
                                <span className="sr-only">{t('sheet.missing')}</span>
                              </span>
                            ) : row.invalid ? (
                              <span className="ml-auto min-w-0 text-right text-crimson" data-sheet-invalid>
                                <span className={cn('break-words [overflow-wrap:anywhere]', row.mono && 'font-mono text-xs')}>
                                  {row.value}
                                </span>{' '}
                                <span className="text-xs font-medium">{t('sheet.toFix')}</span>
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  'line-clamp-3 min-w-0 break-words [overflow-wrap:anywhere]',
                                  row.label && 'text-right',
                                  row.mono && 'font-mono text-xs',
                                  row.muted && 'text-muted-foreground',
                                )}
                              >
                                {row.value}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            );
          }
          // b10: camerele pliate nu mai numara nimic ("câteva întrebări" / "gata")
          const status = flagged
            ? t('sheet.withDesigner')
            : room.completed
              ? t('sheet.roomDone')
              : t('sheet.someQuestions');
          return (
            <div key={room.localId} className="flex items-baseline justify-between gap-2.5">
              {inRooms && !flagged ? (
                <button
                  type="button"
                  onClick={() => setActiveRoom(i)}
                  className="label min-w-0 rounded-sm text-left underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut"
                >
                  <span className="mr-1.5 font-mono">{number}</span>
                  {roomLabel}
                </button>
              ) : (
                <span className="label min-w-0">
                  <span className="mr-1.5 font-mono">{number}</span>
                  {roomLabel}
                </span>
              )}
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 text-ui',
                  !flagged && room.completed ? 'text-sage' : 'text-muted-foreground',
                )}
              >
                {!flagged && room.completed && <Check aria-hidden className="h-3.5 w-3.5" />}
                {status}
              </span>
            </div>
          );
        })}
      </div>

      <ul className="flex flex-col gap-2.5 border-t border-dashed border-muted-2 pt-4">
        {TAIL_PHASES.filter((p) => phaseOrder.includes(p)).map((p) => {
          const state = phaseState(p);
          return (
            <li
              key={p}
              className="flex items-center justify-between gap-2.5"
              aria-current={state === 'now' ? 'step' : undefined}
            >
              <span className="flex min-w-0 items-center gap-2">
                <RailNode state={state} />
                <span className={cn('label', state === 'now' && 'text-foreground')}>{t(`phases.${p}`)}</span>
              </span>
              {p === 'uploads' && (
                <span className="shrink-0 text-ui text-muted-foreground" data-sheet-files>
                  {filesHint}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {inRooms && <p className="text-xs leading-relaxed text-muted-foreground">{t('sheet.hint')}</p>}
    </>
  );

  const asideClass = cn('flex flex-col gap-4 rounded-xl border border-border-2 bg-surface-2 p-5 sm:p-6', className);
  if (!collapsible) {
    return (
      <aside aria-label={t('sheet.title')} className={asideClass}>
        {body}
      </aside>
    );
  }
  // j1: <details> inchis implicit pe ecrane mici; de la lg deschis mereu, fara rezumat
  const open = isLg || openSmall;
  return (
    <aside aria-label={t('sheet.title')} className={cn(asideClass, 'gap-0')}>
      <details
        open={open}
        onToggle={(event) => {
          if (!isLg) setOpenSmall((event.currentTarget as HTMLDetailsElement).open);
        }}
        className="group"
        data-sheet-collapsible
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut lg:hidden [&::-webkit-details-marker]:hidden">
          <span className="heading-section">{t('sheet.title')}</span>
          <span className="flex items-center gap-2 text-ui text-muted-foreground">
            {progress}
            <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="mt-4 flex flex-col gap-4 lg:mt-0">{body}</div>
      </details>
    </aside>
  );
}
