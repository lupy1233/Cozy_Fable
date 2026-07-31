'use client';

import {
  getFlow,
  stepAnswerSchema,
  visibleSteps,
  type AnswerMap,
  type InfoContentRef,
  type QuestionStep,
} from '@marketplace/shared';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AttachmentTarget } from '@/hooks/use-requests';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { InfoDialog } from './info-dialog';
import { StepRenderer } from './step-renderer';

// Valideaza raspunsul unui pas; intoarce cheia i18n a erorii sau undefined.
// Erorile care nu apartin namespace-ului Configurator.validation (ex. mesajele
// interne requestItemSchema pentru pieces) sunt normalizate la answerInvalid,
// ca sa nu apara chei i18n lipsa in UI.
function validateStep(step: QuestionStep, answers: AnswerMap): string | undefined {
  const val = answers[step.id];
  if (val === undefined) return step.optional ? undefined : 'validation.answerRequired';
  const parsed = stepAnswerSchema(step, answers).safeParse(val);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return msg && msg.startsWith('validation.') ? msg : 'validation.answerInvalid';
  }
  return undefined;
}

// Grupeaza step-urile vizibile consecutive cu acelasi screenGroup pe un singur
// ecran (ex. layout + insula la bucatarie). Validarea ramane per-step.
function groupScreens(steps: QuestionStep[]): QuestionStep[][] {
  const screens: QuestionStep[][] = [];
  for (const s of steps) {
    const last = screens[screens.length - 1];
    if (last && s.screenGroup && last[0]?.screenGroup === s.screenGroup) {
      last.push(s);
    } else {
      screens.push([s]);
    }
  }
  return screens;
}

export function RoomFlowRunner({
  uploadTarget,
  onExitToCart,
  onAllDone,
}: {
  uploadTarget: AttachmentTarget;
  onExitToCart: () => void;
  onAllDone: () => void;
}) {
  const t = useTranslations('Configurator');
  const reduce = useReducedMotion();
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const activeRoomIndex = useConfiguratorStore((s) => s.activeRoomIndex);
  const activeStepIndex = useConfiguratorStore((s) => s.activeStepIndex);
  const hasOwnProject = useConfiguratorStore((s) => s.details.hasOwnProject === true);
  const setAnswer = useConfiguratorStore((s) => s.setAnswer);
  const setSnapshot3d = useConfiguratorStore((s) => s.setSnapshot3d);
  const copyRoomAnswers = useConfiguratorStore((s) => s.copyRoomAnswers);
  const setStepIndex = useConfiguratorStore((s) => s.setStepIndex);
  const setActiveRoom = useConfiguratorStore((s) => s.setActiveRoom);
  const markRoomCompleted = useConfiguratorStore((s) => s.markRoomCompleted);

  // erori per step (un ecran poate avea mai multe step-uri)
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<InfoContentRef | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const dir = useRef(1);
  const topRef = useRef<HTMLDivElement>(null);

  const room = rooms[activeRoomIndex];
  const roomKey = room?.localId ?? '';

  // La schimbarea intrebarii/camerei, readu utilizatorul la titlul intrebarii —
  // pe mobil scroll-ul ramanea jos, unde au fost optiunile (feedback PO item 7).
  // scroll-mt pe container tine cont de headerul sticky.
  useEffect(() => {
    if (!roomKey) return;
    topRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [roomKey, activeStepIndex, reduce]);

  if (!room) {
    onExitToCart();
    return null;
  }

  const flow = getFlow(room.roomType, room.flowVersion);
  // step-urile hidden (ex. snapshot3d, scris programatic) nu primesc ecran;
  // cu proiect propriu (PO 2026-07-31) sar si pasii de dimensiuni + schite —
  // proiectul incarcat la pasul Fisiere e sursa de adevar, validarea de publish
  // ii trateaza ca optionali (ownProject in engine)
  const screens = groupScreens(
    visibleSteps(flow, room.answers).filter(
      (s) =>
        !s.hidden &&
        !(hasOwnProject && (s.type === 'dimension-group' || s.type === 'upload')),
    ),
  );
  const screenIndex = Math.min(activeStepIndex, screens.length - 1);
  const screen = screens[screenIndex];

  const openInfo = (ref: InfoContentRef) => {
    setInfo(ref);
    setInfoOpen(true);
  };

  const goNext = () => {
    const nextErrors: Record<string, string> = {};
    for (const s of screen) {
      const err = validateStep(s, room.answers);
      if (err) nextErrors[s.id] = err;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    if (screenIndex < screens.length - 1) {
      dir.current = 1;
      setStepIndex(screenIndex + 1);
      return;
    }
    // ultimul ecran al camerei: marcheaza completa, treci la urmatoarea camera incompleta
    markRoomCompleted(room.localId, true);
    const nextIncomplete = rooms.findIndex((r, i) => i !== activeRoomIndex && !r.completed);
    if (nextIncomplete >= 0) {
      setActiveRoom(nextIncomplete);
    } else {
      onAllDone();
    }
  };

  const goBack = () => {
    setErrors({});
    if (screenIndex > 0) {
      dir.current = -1;
      setStepIndex(screenIndex - 1);
    } else {
      onExitToCart();
    }
  };

  const isLastScreen = screenIndex === screens.length - 1;
  const isLastRoom = !rooms.some((r, i) => i !== activeRoomIndex && !r.completed);
  const offset = reduce ? 0 : 24;

  // sursa pentru "copiaza raspunsurile": o camera terminata de acelasi tip si
  // aceeasi versiune de flow; oferit doar cand camera curenta e inca goala
  const copySource =
    Object.keys(room.answers).length === 0
      ? rooms.find(
          (r) =>
            r.localId !== room.localId &&
            r.roomType === room.roomType &&
            r.flowVersion === room.flowVersion &&
            r.completed,
        )
      : undefined;

  return (
    <div ref={topRef} className="flex scroll-mt-20 flex-col gap-6">
      {/* selector camere (chips) + progres */}
      <div className="flex flex-col gap-3">
        {rooms.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {rooms.map((r, i) => (
              <button
                key={r.localId}
                type="button"
                onClick={() => setActiveRoom(i)}
                className={
                  'flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ' +
                  (i === activeRoomIndex
                    ? 'border-ink/40 bg-surface-2 text-foreground'
                    : 'border-border-2 text-muted-foreground hover:border-muted-2')
                }
              >
                {r.completed && <Check className="h-3 w-3 text-sage" />}
                {t(`rooms.type.${r.roomType}`)}
              </button>
            ))}
          </div>
        )}
        {/* progres tip rigla gradata: umplere brass + gradatii peste */}
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={screens.length}
            aria-valuenow={screenIndex + 1}
            className="relative h-2.5 flex-1 overflow-hidden rounded-[2px] border border-border-2 bg-surface"
          >
            <motion.div
              className="absolute inset-y-0 left-0 bg-brass/90"
              initial={false}
              animate={{ width: `${((screenIndex + 1) / screens.length) * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-[repeating-linear-gradient(to_right,transparent,transparent_7px,hsl(var(--card))_7px,hsl(var(--card))_8px)]"
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(screenIndex + 1).padStart(2, '0')}/{String(screens.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      {copySource && (
        <button
          type="button"
          onClick={() => copyRoomAnswers(copySource.localId, room.localId)}
          className="flex items-center gap-2 self-start rounded-lg border border-dashed border-walnut/50 bg-walnut-soft px-3 py-2 text-sm text-walnut transition-colors hover:border-walnut"
        >
          <Copy className="h-4 w-4" />
          {t('copyFromPrevious', { room: t(`rooms.type.${room.roomType}`) })}
        </button>
      )}

      {/* Ecranul curent (1+ step-uri), animat DOAR la intrare. Fara exit +
          AnimatePresence(wait): exit-ul depinde de rAF, iar intr-un tab ascuns
          (mobil, schimbare de aplicatie) rAF e pauzat si ecranul urmator nu se
          mai monta deloc — wizard blocat. */}
      <div className="min-h-[16rem]">
        <motion.div
          key={`${room.localId}:${screen[0]?.id}`}
          initial={{ opacity: 0, x: dir.current * offset }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
          className="flex flex-col gap-8"
        >
          {screen.map((s, si) => (
            <StepRenderer
              key={s.id}
              step={s}
              answers={room.answers}
              roomType={room.roomType}
              inline={si > 0}
              uploadContext={{ target: uploadTarget, hasOwnProject, roomCount: rooms.length }}
              config3dContext={{ onSnapshot: (dataUrl) => setSnapshot3d(room.localId, dataUrl) }}
              onChange={(value) => {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next[s.id];
                  return next;
                });
                setAnswer(room.localId, s.id, value);
              }}
              onInfo={openInfo}
              error={errors[s.id]}
            />
          ))}
        </motion.div>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={goBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('nav.back')}
        </Button>
        <Button type="button" variant="walnut" size="lg" onClick={goNext}>
          {isLastScreen && isLastRoom ? t('nav.toDetails') : t('nav.next')}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <InfoDialog info={info} open={infoOpen} onOpenChange={setInfoOpen} />
    </div>
  );
}
