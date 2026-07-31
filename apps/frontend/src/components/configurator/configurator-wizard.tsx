'use client';

import type { AnswerMap, RequestDto } from '@marketplace/shared';
import { motion } from 'framer-motion';
import { FilePlus2, History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Stepper } from '@/components/ui/stepper';
import {
  useCreateDraft,
  useDiscardDraft,
  useDraft,
  usePatchDraft,
  useRequest,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { ApiError } from '@/lib/api';
import { useRouter } from '@/i18n/routing';
import {
  useConfiguratorStore,
  type ConfiguratorPhase,
  type ConfiguratorSnapshot,
  type DetailsValues,
  type StartMode,
} from '@/stores/configurator-store';
import { DetailsStep } from './details-step';
import { ReviewStep } from './review-step';
import { RoomCartStep } from './room-cart-step';
import { RoomFlowRunner } from './room-flow-runner';
import { StartModeStep } from './start-mode-step';
import { UploadsStep } from './uploads-step';

const DRAFT_TOKEN_KEY = 'mm_draft_token';
// 'start' (PO r9) = alegerea modului pe cartonase, ca pas de sine statator;
// fisierele (planuri/poze) vin INAINTE de detaliile generale (decizie PO, overhaul 2026-07)
const PHASE_ORDER: ConfiguratorPhase[] = ['start', 'cart', 'rooms', 'uploads', 'details', 'review'];
// "am nevoie de ajutor" (PO 2026-07-31): fara chestionar per camera — alegi
// camerele, atasezi eventual poze, completezi detaliile si publici cu
// Proiectare platita; proiectarea o face atelierul care preia cererea.
const DESIGN_HELP_PHASE_ORDER: ConfiguratorPhase[] = ['start', 'cart', 'uploads', 'details', 'review'];

// Reconstruieste snapshot-ul wizard-ului dintr-o cerere publicata (edit mode).
// configuratorState e null dupa publish → sursa de adevar sunt answers per camera.
function buildSnapshotFromRequest(dto: RequestDto): ConfiguratorSnapshot {
  const details: Partial<DetailsValues> = {
    description: dto.description ?? '',
    budgetRange: dto.budgetRange,
    budgetEstimateRon: dto.budgetEstimateRon,
    deadlineBucket: dto.deadlineBucket ?? '',
    includesPaidDesign: dto.includesPaidDesign,
    hasOwnProject: dto.hasOwnProject,
    addressText: dto.addressText ?? '',
    county: dto.county ?? '',
    city: dto.city ?? '',
    country: dto.country ?? 'RO',
    contactPreferences: dto.contactPreferences.map((c) => ({
      channel: c.channel,
      value: c.value,
    })),
  };
  // modul de pornire se deduce din cerere: brief de proiectare (paid design,
  // camere fara raspunsuri) → DESIGN_HELP; proiect propriu → OWN_PROJECT
  const hasAnswers = dto.rooms.some((r) => r.answers && Object.keys(r.answers).length > 0);
  const startMode: StartMode =
    dto.includesPaidDesign && !hasAnswers
      ? 'DESIGN_HELP'
      : dto.hasOwnProject
        ? 'OWN_PROJECT'
        : 'STANDARD';
  return {
    phase: 'cart',
    startMode,
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
    inspirationPhotoIds: dto.inspirationPhotoIds ?? [],
    updatedAt: Date.now(),
  };
}

// exista progres de reluat? (camere adaugate, detalii completate sau pas inceput)
// 'start' si 'cart' sunt fazele de inceput — singure nu inseamna progres
function snapshotHasProgress(state: ConfiguratorSnapshot): boolean {
  return (
    state.roomInstances.length > 0 ||
    Object.keys(state.details).length > 0 ||
    (state.phase !== 'cart' && state.phase !== 'start')
  );
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
  const startMode = useConfiguratorStore((s) => s.startMode);
  const setStartMode = useConfiguratorStore((s) => s.setStartMode);
  const setDetails = useConfiguratorStore((s) => s.setDetails);
  const designHelp = startMode === 'DESIGN_HELP';

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
  const discardDraft = useDiscardDraft();
  const hydrated = useRef(false);
  // dialogul "continui sau incepi din nou?" cand exista o cerere neterminata
  const [resumePrompt, setResumePrompt] = useState(false);
  const resumeChecked = useRef(false);

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
    // dupa hidratare stim starea reala: daca exista progres, intreaba utilizatorul
    // daca vrea sa continue de unde a ramas sau sa inceapa o cerere noua (cerinta PO)
    if (!resumeChecked.current) {
      resumeChecked.current = true;
      if (snapshotHasProgress(store.getState().snapshot())) setResumePrompt(true);
    }
  }, [draft.data, isEdit, store]);

  // Token mort: ciorna a fost aruncata ("Incepe o cerere noua" pe alt tab) sau
  // baza a fost resetata → GET-ul da 404, dar starea locala persistata exista
  // in continuare. Fara tratare, utilizatorul relua TACUT o ciorna-fantoma
  // (patch/publish esuau pe tokenul mort) si dialogul de reluare nu mai aparea.
  // Aruncam tokenul vechi, cerem o ciorna noua (sync-ul debounced ii trimite
  // apoi progresul local) si punem aceeasi intrebare continua/de-la-zero.
  useEffect(() => {
    if (isEdit || hydrated.current) return;
    if (!(draft.error instanceof ApiError) || draft.error.status !== 404) return;
    hydrated.current = true;
    localStorage.removeItem(DRAFT_TOKEN_KEY);
    createDraft
      .mutateAsync({})
      .then((res) => {
        localStorage.setItem(DRAFT_TOKEN_KEY, res.draftToken);
        setTokenInStore(res.draftToken);
        setToken(res.draftToken);
      })
      .catch(() => {
        created.current = false;
      });
    if (!resumeChecked.current) {
      resumeChecked.current = true;
      if (snapshotHasProgress(store.getState().snapshot())) setResumePrompt(true);
    }
  }, [draft.error, isEdit, createDraft, setTokenInStore, store]);

  // "Incepe una noua": arunca draftul curent de pe server (altfel s-ar aduna
  // ciorne goale in cont — PO r5) si creeaza altul.
  const startFresh = () => {
    setResumePrompt(false);
    const oldToken = token ?? localStorage.getItem(DRAFT_TOKEN_KEY);
    localStorage.removeItem(DRAFT_TOKEN_KEY);
    // reset-ul readuce wizard-ul pe pasul "Cum pornim?"
    store.getState().reset();
    setToken(null);
    // best-effort: un esec de stergere nu blocheaza cererea noua (ciorna ramane
    // doar invizibila — listele de client exclud oricum status DRAFT)
    if (oldToken) discardDraft.mutate(oldToken);
    createDraft
      .mutateAsync({})
      .then((res) => {
        localStorage.setItem(DRAFT_TOKEN_KEY, res.draftToken);
        setTokenInStore(res.draftToken);
        setToken(res.draftToken);
      })
      .catch(() => {
        // reintra pe fluxul de creare de la montare la urmatoarea vizita
        created.current = false;
      });
  };

  // --- mod editare: reconstruim starea din cererea publicata ---
  const editRequest = useRequest(editId ?? '');
  useEffect(() => {
    if (!isEdit || hydrated.current || !editRequest.data) return;
    hydrated.current = true;
    store.getState().loadSnapshot(buildSnapshotFromRequest(editRequest.data));
  }, [editRequest.data, isEdit, store]);

  // La schimbarea fazei (cos → intrebari → fisiere → detalii → review) pagina
  // se intoarce sus — altfel pe mobil ramai cu scroll-ul fostei faze (item 7).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [phase]);

  // stare incoerenta (ex. snapshot vechi): modul "am nevoie de ajutor" nu are
  // faza de intrebari per camera
  useEffect(() => {
    if (designHelp && phase === 'rooms') setPhase('uploads');
  }, [designHelp, phase, setPhase]);

  // fara mod ales nu exista decat pasul de pornire (plasa de siguranta pentru
  // snapshot-uri vechi/incoerente)
  useEffect(() => {
    if (startMode == null && phase !== 'start') setPhase('start');
  }, [startMode, phase, setPhase]);

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

  // alegerea de pe pasul de pornire: seteaza modul, sincronizeaza detaliile
  // derivate si avanseaza la cos
  const pickStartMode = (mode: StartMode) => {
    setStartMode(mode);
    if (mode === 'OWN_PROJECT') setDetails({ hasOwnProject: true });
    if (mode === 'STANDARD') setDetails({ hasOwnProject: false, includesPaidDesign: false });
    if (mode === 'DESIGN_HELP') setDetails({ hasOwnProject: false, includesPaidDesign: true });
    setPhase('cart');
  };

  const phaseOrder = designHelp ? DESIGN_HELP_PHASE_ORDER : PHASE_ORDER;
  const phaseIndex = Math.max(0, phaseOrder.indexOf(phase));
  const phaseLabels = phaseOrder.map((p) => t(`phases.${p}`));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      {/* cerere neterminata gasita: continua sau incepe din nou (fara salvare) */}
      <Dialog open={resumePrompt} onOpenChange={setResumePrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('resume.title')}</DialogTitle>
            <DialogDescription>{t('resume.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {/* B5: contur vizibil — varianta ghost se pierdea pe fundal */}
            <Button type="button" variant="outline" onClick={startFresh}>
              <FilePlus2 className="mr-1.5 h-4 w-4" />
              {t('resume.startFresh')}
            </Button>
            <Button type="button" variant="walnut" onClick={() => setResumePrompt(false)}>
              <History className="mr-1.5 h-4 w-4" />
              {t('resume.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  total: phaseOrder.length,
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
        {phase === 'start' && (
          <StartModeStep value={startMode} onPick={pickStartMode} />
        )}
        {phase === 'cart' && (
          <RoomCartStep
            onBack={() => setPhase('start')}
            onContinue={() => {
              // "am nevoie de ajutor": fara chestionar per camera — direct la fisiere
              if (designHelp) {
                setPhase('uploads');
                return;
              }
              setActiveRoom(0);
              setPhase('rooms');
            }}
          />
        )}
        {phase === 'rooms' && !designHelp && (
          <RoomFlowRunner
            uploadTarget={uploadTarget}
            onExitToCart={() => setPhase('cart')}
            onAllDone={() => setPhase('uploads')}
          />
        )}
        {phase === 'uploads' && (
          <UploadsStep
            target={uploadTarget}
            onBack={() => setPhase(designHelp ? 'cart' : 'rooms')}
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
            uploadTarget={uploadTarget}
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
