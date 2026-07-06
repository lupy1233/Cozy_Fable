'use client';

import type { AnswerMap, RequestDto } from '@marketplace/shared';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Stepper } from '@/components/ui/stepper';
import {
  useCreateDraft,
  useDraft,
  usePatchDraft,
  useRequest,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { useRouter } from '@/i18n/routing';
import {
  useConfiguratorStore,
  type ConfiguratorPhase,
  type ConfiguratorSnapshot,
  type DetailsValues,
} from '@/stores/configurator-store';
import { DetailsStep } from './details-step';
import { ReviewStep } from './review-step';
import { RoomCartStep } from './room-cart-step';
import { RoomFlowRunner } from './room-flow-runner';
import { UploadsStep } from './uploads-step';

const DRAFT_TOKEN_KEY = 'mm_draft_token';
// fisierele (planuri/poze) vin INAINTE de detaliile generale (decizie PO, overhaul 2026-07)
const PHASE_ORDER: ConfiguratorPhase[] = ['cart', 'rooms', 'uploads', 'details', 'review'];

// Reconstruieste snapshot-ul wizard-ului dintr-o cerere publicata (edit mode).
// configuratorState e null dupa publish → sursa de adevar sunt answers per camera.
function buildSnapshotFromRequest(dto: RequestDto): ConfiguratorSnapshot {
  const details: Partial<DetailsValues> = {
    description: dto.description ?? '',
    budgetRange: dto.budgetRange,
    deadlineBucket: dto.deadlineBucket ?? '',
    includesPaidDesign: dto.includesPaidDesign,
    hasOwnProject: dto.hasOwnProject,
    addressText: dto.addressText ?? '',
    county: dto.county ?? '',
    city: dto.city ?? '',
    contactPreferences: dto.contactPreferences.map((c) => ({
      channel: c.channel,
      value: c.value,
    })),
  };
  return {
    phase: 'cart',
    roomInstances: dto.rooms
      .filter((r) => r.answers)
      .map((r) => ({
        localId: `r_${Math.random().toString(36).slice(2, 10)}`,
        roomType: r.roomType,
        flowVersion: r.flowVersion ?? 1,
        answers: r.answers as AnswerMap,
        completed: true,
      })),
    activeRoomIndex: 0,
    activeStepIndex: 0,
    details,
    updatedAt: Date.now(),
  };
}

export function ConfiguratorWizard({ editId }: { editId?: string }) {
  const t = useTranslations('Configurator');
  const router = useRouter();
  const isEdit = Boolean(editId);
  const createDraft = useCreateDraft();
  const created = useRef(false);
  const [token, setToken] = useState<string | null>(null);

  const store = useConfiguratorStore;
  const phase = useConfiguratorStore((s) => s.phase);
  const setPhase = useConfiguratorStore((s) => s.setPhase);
  const setActiveRoom = useConfiguratorStore((s) => s.setActiveRoom);
  const setTokenInStore = useConfiguratorStore((s) => s.setToken);
  const updatedAt = useConfiguratorStore((s) => s.updatedAt);

  // --- mod creare: draft anonim cu token ---
  // La montare: refoloseste tokenul din localStorage sau creeaza un draft nou.
  useEffect(() => {
    if (isEdit || created.current) return;
    created.current = true;
    const existing =
      typeof window !== 'undefined' ? localStorage.getItem(DRAFT_TOKEN_KEY) : null;
    if (existing) {
      setToken(existing);
      setTokenInStore(existing);
      return;
    }
    // mutateAsync (nu mutate+onSuccess): callback-urile per-apel ale unei mutatii
    // React Query sunt ignorate daca observer-ul se demonteaza inainte de rezolvare
    // (cazul remount-ului simulat de React StrictMode in dev) — promisiunea ruleaza mereu.
    createDraft
      .mutateAsync({})
      .then((res) => {
        localStorage.setItem(DRAFT_TOKEN_KEY, res.draftToken);
        store.getState().reset();
        setTokenInStore(res.draftToken);
        setToken(res.draftToken);
      })
      .catch(() => {
        // permite o noua incercare la remount daca crearea draftului esueaza
        created.current = false;
      });
  }, [createDraft, isEdit, setTokenInStore, store]);

  const draft = useDraft(isEdit ? null : token);
  const patchDraft = usePatchDraft(token ?? '');
  const hydrated = useRef(false);

  // Resume (creare): daca nu exista stare locala dar serverul are configuratorState.
  useEffect(() => {
    if (isEdit || hydrated.current || !draft.data) return;
    hydrated.current = true;
    const local = store.getState().snapshot();
    const hasLocal =
      local.roomInstances.length > 0 || Object.keys(local.details).length > 0;
    const serverState = draft.data.configuratorState as ConfiguratorSnapshot | null;
    if (!hasLocal && serverState && Array.isArray(serverState.roomInstances)) {
      store.getState().loadSnapshot(serverState);
    }
  }, [draft.data, isEdit, store]);

  // --- mod editare: reconstruim starea din cererea publicata ---
  const editRequest = useRequest(editId ?? '');
  useEffect(() => {
    if (!isEdit || hydrated.current || !editRequest.data) return;
    hydrated.current = true;
    store.getState().loadSnapshot(buildSnapshotFromRequest(editRequest.data));
  }, [editRequest.data, isEdit, store]);

  // Sync server debounced (doar creare): backup pentru resume de pe alt device.
  useEffect(() => {
    if (isEdit || !token) return;
    const handle = setTimeout(() => {
      patchDraft.mutate({
        configuratorState: store.getState().snapshot() as unknown as Record<string, unknown>,
      });
    }, 1500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedAt, token, isEdit]);

  const ready = isEdit ? Boolean(editRequest.data) : Boolean(token);
  if (!ready) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  const uploadTarget: AttachmentTarget = isEdit
    ? { kind: 'request', id: editId! }
    : { kind: 'draft', token: token! };

  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const phaseLabels = PHASE_ORDER.map((p) => t(`phases.${p}`));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <p className="kicker">{t(isEdit ? 'editKicker' : 'kicker')}</p>
        <h1 className="page-title mt-1.5">{t(isEdit ? 'editTitle' : 'title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(isEdit ? 'editSubtitle' : 'subtitle')}
        </p>
      </div>

      {/* plansa de atelier: colturi de registru + cartus (title block) */}
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute -left-1.5 -top-1.5 h-3 w-3 border-l border-t border-ink/30" />
        <span aria-hidden className="pointer-events-none absolute -right-1.5 -top-1.5 h-3 w-3 border-r border-t border-ink/30" />
        <span aria-hidden className="pointer-events-none absolute -bottom-1.5 -left-1.5 h-3 w-3 border-b border-l border-ink/30" />
        <span aria-hidden className="pointer-events-none absolute -bottom-1.5 -right-1.5 h-3 w-3 border-b border-r border-ink/30" />

        <div className="border border-ink/15 bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-ink/15 px-6 py-3.5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-2">
                {t('sheet.phaseLabel', {
                  current: phaseIndex + 1,
                  total: PHASE_ORDER.length,
                })}
              </span>
              <span className="font-serif text-lg tracking-[-0.01em]">
                {phaseLabels[phaseIndex]}
              </span>
            </div>
            <Stepper steps={phaseLabels} current={phaseIndex} />
          </div>

          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="p-6 sm:p-7"
          >
        {phase === 'cart' && (
          <RoomCartStep
            onContinue={() => {
              setActiveRoom(0);
              setPhase('rooms');
            }}
          />
        )}
        {phase === 'rooms' && (
          <RoomFlowRunner
            uploadTarget={uploadTarget}
            onExitToCart={() => setPhase('cart')}
            onAllDone={() => setPhase('uploads')}
          />
        )}
        {phase === 'uploads' && (
          <UploadsStep
            target={uploadTarget}
            onBack={() => setPhase('rooms')}
            onContinue={() => setPhase('details')}
          />
        )}
        {phase === 'details' && (
          <DetailsStep onBack={() => setPhase('uploads')} onContinue={() => setPhase('review')} />
        )}
        {phase === 'review' && (
          <ReviewStep
            token={token}
            editId={editId}
            onBack={() => setPhase('details')}
            onEditRoom={(i) => {
              setActiveRoom(i);
              setPhase('rooms');
            }}
            onEditDetails={() => setPhase('details')}
            onPublished={(id) => {
              if (!isEdit && token) {
                localStorage.setItem(`mm_req_token_${id}`, token);
                localStorage.removeItem(DRAFT_TOKEN_KEY);
              }
              store.getState().reset();
              router.push(`/requests/${id}`);
            }}
          />
        )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
