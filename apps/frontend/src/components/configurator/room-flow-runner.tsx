'use client';

import type { InfoContentRef, QuestionStep } from '@marketplace/shared';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { AttachmentTarget } from '@/hooks/use-requests';
import { cn } from '@/lib/utils';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { InfoDialog } from './info-dialog';
import { isStudioNightstand, roomScreens, validateStep } from './room-screens';
import { StepRenderer } from './step-renderer';

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

  // step-urile hidden nu primesc ecran; cu proiect propriu sar dimensiunile +
  // schitele (ownProject in engine); la noptiera din Studio sare "cate bucati"
  const screens = roomScreens(room, hasOwnProject);
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

  const offset = reduce ? 0 : 24;

  // Ce urmeaza dupa "Continua" (doar eticheta): ecranul urmator al camerei,
  // urmatoarea camera necompletata sau pasul Fisiere — aceeasi ordine ca goNext.
  const nextScreen = screens[screenIndex + 1];
  const nextRoom = rooms.find((r, i) => i !== activeRoomIndex && !r.completed);
  const nextLabel = nextScreen?.[0]
    ? t(nextScreen[0].titleKey)
    : nextRoom
      ? t(`rooms.type.${nextRoom.roomType}`)
      : t('phases.uploads');

  // Pur vizual: bifa compacta si textul conditionat ("Altul" → descrie) tin de
  // intrebarea de dinaintea lor — nu primesc numar si nici linie despartitoare.
  const isFollowUp = (s: QuestionStep) =>
    (s.type === 'boolean' && s.toggleStyle === 'checkbox') || (s.type === 'text' && Boolean(s.visibleIf));
  const numbered = screen.filter((s) => !isFollowUp(s));
  const counterOf = (s: QuestionStep) =>
    numbered.length > 1 && numbered.includes(s) ? `${numbered.indexOf(s) + 1}/${numbered.length}` : undefined;

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
      {/* antetul pasului: in ce camera esti + cat mai e din ea */}
      <div className="flex flex-col gap-4">
        <div role="group" aria-label={t('nav.roomsLabel')} className="flex flex-wrap gap-2">
          {rooms.map((r, i) => {
            const active = i === activeRoomIndex;
            const pill = cn(
              'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors',
              active
                ? 'border-foreground bg-foreground text-primary-foreground'
                : 'border-border-2 bg-surface text-muted-foreground hover:border-muted-2 hover:text-foreground',
            );
            const content = (
              <>
                {r.completed && (
                  <Check aria-hidden className={cn('h-3.5 w-3.5', active ? 'text-primary-foreground' : 'text-sage')} />
                )}
                {t(`rooms.type.${r.roomType}`)}
              </>
            );
            // o singura camera: eticheta, nu buton (un click ar reseta pasul la primul ecran)
            return rooms.length > 1 ? (
              <button
                key={r.localId}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveRoom(i)}
                className={pill}
              >
                {content}
              </button>
            ) : (
              <span key={r.localId} className={pill}>
                {content}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-3.5">
          <span className="font-mono text-xs tabular-nums text-walnut">
            {String(screenIndex + 1).padStart(2, '0')}/{String(screens.length).padStart(2, '0')}
          </span>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={screens.length}
            aria-valuenow={screenIndex + 1}
            className="relative h-1 flex-1 overflow-hidden rounded-full bg-border"
          >
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-brass"
              initial={false}
              animate={{ width: `${((screenIndex + 1) / screens.length) * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {isStudioNightstand(room) && <Alert tone="info">{t('studioNightstandNote')}</Alert>}

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
          className="flex flex-col"
        >
          {screen.map((s, si) => (
            // intrebarile ecranului sunt despartite de o linie fina; bifa si
            // textul conditionat raman lipite de intrebarea lor
            <div
              key={s.id}
              className={cn(si > 0 && (isFollowUp(s) ? 'mt-4' : 'mt-7 border-t border-border pt-6'))}
            >
              <StepRenderer
                step={s}
                answers={room.answers}
                roomType={room.roomType}
                flowVersion={room.flowVersion}
                inline={si > 0}
                counter={counterOf(s)}
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
            </div>
          ))}
        </motion.div>
      </div>

      {/* un singur buton principal; "Inapoi" ramane discret, in stanga */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <Button type="button" variant="outline" size="xl" className="px-4 text-sm" onClick={goBack}>
          <ArrowLeft aria-hidden />
          {t('nav.back')}
        </Button>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <span className="hidden max-w-[16rem] truncate text-ui text-muted-foreground sm:inline">
            {t('nav.nextUp', { label: nextLabel })}
          </span>
          <Button type="button" variant="walnut" size="xl" onClick={goNext}>
            {t('nav.next')}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>

      <InfoDialog info={info} open={infoOpen} onOpenChange={setInfoOpen} />
    </div>
  );
}
