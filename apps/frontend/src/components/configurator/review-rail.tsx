'use client';

import { summarizeAnswers, type AnswerSummaryEntry, type QuestionStep } from '@marketplace/shared';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useConfiguratorStore, type ConfiguratorPhase } from '@/stores/configurator-store';
import { config3dChips } from './piece3d/config-chips';
import { roomScreens, validateStep } from './room-screens';

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

const UNIT_FACTOR = { m: 1, cm: 100, mm: 1000 } as const;

// fazele de dupa camere, in ordinea wizard-ului
const TAIL_PHASES: ConfiguratorPhase[] = ['uploads', 'details', 'review'];

export function RequestSheet({
  phase,
  phaseOrder,
  designHelp,
  className,
}: {
  phase: ConfiguratorPhase;
  // ordinea fazelor pentru modul curent (fara 'rooms' la "am nevoie de ajutor")
  phaseOrder: ConfiguratorPhase[];
  designHelp: boolean;
  className?: string;
}) {
  const t = useTranslations('Configurator');
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const activeRoomIndex = useConfiguratorStore((s) => s.activeRoomIndex);
  const activeStepIndex = useConfiguratorStore((s) => s.activeStepIndex);
  const hasOwnProject = useConfiguratorStore((s) => s.details.hasOwnProject === true);
  const unit = useConfiguratorStore((s) => s.dimensionUnit);
  const setActiveRoom = useConfiguratorStore((s) => s.setActiveRoom);
  const setStepIndex = useConfiguratorStore((s) => s.setStepIndex);

  // ecranele + rezumatul fiecarei camere; flow necunoscut → camera fara sectiuni
  const model = useMemo(
    () =>
      rooms.map((room) => {
        let screens: QuestionStep[][] = [];
        let entries: AnswerSummaryEntry[] = [];
        try {
          screens = roomScreens(room, hasOwnProject);
          entries = summarizeAnswers(room.roomType, room.answers, room.flowVersion);
        } catch {
          screens = [];
          entries = [];
        }
        const valid = screens.map((screen) => screen.every((s) => validateStep(s, room.answers) === undefined));
        const required = screens.flat().filter((s) => !s.optional);
        const answered = required.filter((s) => validateStep(s, room.answers) === undefined).length;
        return { screens, byStep: new Map(entries.map((e) => [e.stepId, e])), valid, required: required.length, answered };
      }),
    [rooms, hasOwnProject],
  );

  const inRooms = phase === 'rooms' && !designHelp;
  const totalRequired = model.reduce((n, m) => n + m.required, 0);
  const totalAnswered = model.reduce((n, m) => n + m.answered, 0);

  const fmtDim = (meters: number) => `${Math.round(meters * UNIT_FACTOR[unit] * 10000) / 10000} ${unit}`;

  const rowsForStep = (step: QuestionStep, entry: AnswerSummaryEntry | undefined, withLabel: boolean): SheetRow[] => {
    const label = withLabel
      ? t(step.type === 'boolean' && step.cardLabelKey ? step.cardLabelKey : step.titleKey)
      : undefined;
    if (!entry) {
      if (step.optional) return withLabel ? [] : [{ key: step.id, value: t('sheet.optional'), muted: true }];
      return [{ key: step.id, label, missing: true }];
    }
    switch (entry.kind) {
      case 'choice':
        return [{ key: step.id, label, value: entry.optionLabelKeys.map((k) => t(k)).join(', ') }];
      case 'boolean':
        return [{ key: step.id, label, value: t(entry.value ? 'common.boolean.yes' : 'common.boolean.no') }];
      case 'dimensions':
        return entry.slots.map((slot, i) => ({
          key: `${step.id}:${i}`,
          label: t(slot.labelKey),
          value: fmtDim(slot.value),
          mono: true,
        }));
      case 'number':
        return [{ key: step.id, label, value: String(entry.value), mono: true }];
      case 'text':
        return [{ key: step.id, label, value: entry.value }];
      case 'pieces':
        return [
          {
            key: step.id,
            label,
            value: entry.pieces.map((p) => (p.quantity > 1 ? `${p.quantity}× ${p.name}` : p.name)).join(', '),
          },
        ];
      case 'files':
        return [{ key: step.id, label, value: t('summaryFiles.count', { n: entry.count }) }];
      case 'config3d':
        return [{ key: step.id, label, value: config3dChips(t, entry.config)[0], mono: true }];
    }
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
      const title = first ? t(first.type === 'boolean' && first.cardLabelKey ? first.cardLabelKey : first.titleKey) : '';
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
      const rows = screen.flatMap((s) => rowsForStep(s, m.byStep.get(s.id), screen.length > 1));
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

  return (
    <aside
      aria-label={t('sheet.title')}
      className={cn('flex flex-col gap-4 rounded-xl border border-border-2 bg-surface-2 p-5 sm:p-6', className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="heading-section">{t('sheet.title')}</h2>
        {!designHelp && totalRequired > 0 && (
          <span className="data-mono text-muted-foreground">
            <span aria-hidden>
              {totalAnswered} / {totalRequired}
            </span>
            <span className="sr-only">{t('sheet.progressLabel', { done: totalAnswered, total: totalRequired })}</span>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        {rooms.map((room, i) => {
          const roomLabel = t(`rooms.type.${room.roomType}`);
          const number = String(i + 1).padStart(2, '0');
          const expanded = inRooms && i === activeRoomIndex;
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
                              <span className="max-w-[55%] truncate text-muted-foreground" title={row.label}>
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
                            ) : (
                              <span
                                className={cn(
                                  'line-clamp-3 min-w-0 break-words',
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
          const m = model[i];
          const status = designHelp
            ? t('sheet.withDesigner')
            : room.completed
              ? t('sheet.roomDone')
              : t('sheet.sections', { count: m?.screens.length ?? 0 });
          return (
            <div key={room.localId} className="flex items-baseline justify-between gap-2.5">
              {inRooms ? (
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
                  !designHelp && room.completed ? 'text-sage' : 'text-muted-foreground',
                )}
              >
                {!designHelp && room.completed && <Check aria-hidden className="h-3.5 w-3.5" />}
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
                <span className="shrink-0 text-ui text-muted-foreground">
                  {hasOwnProject ? t('sheet.required') : t('sheet.optional')}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {inRooms && <p className="text-xs leading-relaxed text-muted-foreground">{t('sheet.hint')}</p>}
    </aside>
  );
}
