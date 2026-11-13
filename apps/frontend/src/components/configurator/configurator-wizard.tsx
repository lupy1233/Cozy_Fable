'use client';

import type { AnswerMap, RequestDto } from '@marketplace/shared';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, CloudOff, FilePlus2, History, Loader2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { useMe } from '@/hooks/use-auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCreateDraft,
  useDiscardDraft,
  useDraft,
  useAttachmentsStateFor,
  usePatchDraft,
  useRequest,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { track } from '@/lib/analytics';
import { ApiError } from '@/lib/api';
import { DRAFT_TOKEN_KEY } from '@/lib/session-cleanup';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';
import { Link, useRouter } from '@/i18n/routing';
import { CONFIGURATOR_STORAGE_KEY, isAbandonedEditSnapshot } from '@/stores/configurator-keys';
import {
  discardPendingEditSession,
  EDIT_RESUME_WINDOW_MS,
  enterEditSession,
  finishEditSession,
  holdEditSession,
  isStudioRoom,
  leaveEditSession,
  roomHasAnswers,
  useConfiguratorStore,
  type ConfiguratorPhase,
  type ConfiguratorSnapshot,
  type DetailsValues,
  type InspirationMeta,
  type RoomInstance,
  type StartMode,
} from '@/stores/configurator-store';
import { ClientOnlyNote, isNonClientRole } from './client-only-note';
import { DesignHelpConfirmDialog } from './design-help-dialog';
import { DetailsStep } from './details-step';
import { roomInstanceLabels } from './room-payload';
import { RequestSheet } from './review-rail';
import { ReviewStep } from './review-step';
import { CartBasket } from './cart-basket';
import { RoomCartStep } from './room-cart-step';
import { RoomFlowRunner } from './room-flow-runner';
import { screenIndexForStep } from './room-screens';
import { StartModeStep } from './start-mode-step';
import { UploadsStep } from './uploads-step';

// 'start' (PO r9) = alegerea modului pe cartonase, ca pas de sine statator;
// fisierele (planuri/poze) vin INAINTE de detaliile generale (decizie PO, overhaul 2026-07)
const PHASE_ORDER: ConfiguratorPhase[] = ['start', 'cart', 'rooms', 'uploads', 'details', 'review'];
// "am nevoie de ajutor" (PO 2026-07-31): fara chestionar per camera — alegi
// camerele, atasezi eventual poze, completezi detaliile si publici cu
// Proiectare platita; proiectarea o face atelierul care preia cererea.
const DESIGN_HELP_PHASE_ORDER: ConfiguratorPhase[] = ['start', 'cart', 'uploads', 'details', 'review'];

// Modul unei cereri publicate (contract b8, punctul 5): nu exista coloana de mod —
// hasOwnProject → "Am deja un proiect"; toate camerele cu needsDesignHelp →
// "Am nevoie de ajutor"; altfel "Stiu ce vreau".
export function startModeFromRequest(dto: Pick<RequestDto, 'hasOwnProject' | 'rooms'>): StartMode {
  if (dto.hasOwnProject) return 'OWN_PROJECT';
  if (dto.rooms.length > 0 && dto.rooms.every((r) => r.needsDesignHelp === true)) return 'DESIGN_HELP';
  return 'STANDARD';
}

// Reconstruieste snapshot-ul wizard-ului dintr-o cerere publicata (edit mode).
// configuratorState e null dupa publish → sursa de adevar sunt answers per camera.
export function buildSnapshotFromRequest(dto: RequestDto): ConfiguratorSnapshot {
  // camerele legacy (answers null, fara bifa) nu intra in editare, deci nici in mod
  const editableRooms = dto.rooms.filter((r) => r.answers || r.needsDesignHelp);
  const startMode = startModeFromRequest({ hasOwnProject: dto.hasOwnProject, rooms: editableRooms });
  const details: Partial<DetailsValues> = {
    description: dto.description ?? '',
    budgetRange: dto.budgetRange,
    budgetEstimateRon: dto.budgetEstimateRon,
    deadlineBucket: dto.deadlineBucket ?? '',
    hasOwnProject: startMode === 'OWN_PROJECT',
    addressText: dto.addressText ?? '',
    county: dto.county ?? '',
    city: dto.city ?? '',
    country: dto.country ?? 'RO',
    contactPreferences: dto.contactPreferences.map((c) => ({
      channel: c.channel,
      value: c.value,
    })),
  };
  // camerele legacy (answers null) raman pe dinafara; o camera bifata "am nevoie de
  // ajutor" vine fara raspunsuri (doar, eventual, fisierele ei) si se pastreaza
  const roomInstances: RoomInstance[] = editableRooms
    .map((r) => {
      const sourceStudio = dto.studioScenes?.flatMap((entry) => Object.entries(entry.data.requestEntryIds ?? {}).filter(([, roomId]) => roomId === r.id).map(([placementId]) => ({ sceneId: entry.data.scene.id, placementId })))[0];
      return {
        localId: r.id,
        sourceStudio,
        roomType: r.roomType,
        flowVersion: r.flowVersion ?? 1,
        answers: (r.answers ?? {}) as AnswerMap,
        completed: true,
        // piesele din Studio 3D nu au bifa de ajutor (deja configurate)
        needsDesignHelp: startMode !== 'OWN_PROJECT' && !sourceStudio && r.needsDesignHelp === true,
      };
    });
  // E-client-34: notita + camera per poza; la editare localId = id-ul camerei persistate
  // (camerele legacy fara answers lipsesc din roomInstances → poza trece pe "toata locuinta")
  const inspirationPhotos = dto.inspirationPhotos ?? [];
  const inspirationMeta: Record<string, InspirationMeta> = {};
  for (const p of inspirationPhotos) {
    const entry: InspirationMeta = {};
    if (p.note) entry.note = p.note;
    if (p.requestRoomId && roomInstances.some((r) => r.localId === p.requestRoomId)) {
      entry.roomLocalId = p.requestRoomId;
    }
    if (entry.note !== undefined || entry.roomLocalId !== undefined) inspirationMeta[p.photoId] = entry;
  }
  return {
    phase: 'cart',
    startMode,
    roomInstances,
    activeRoomIndex: 0,
    activeStepIndex: 0,
    details,
    inspirationPhotoIds: dto.inspirationPhotos?.map((p) => p.photoId) ?? dto.inspirationPhotoIds ?? [],
    inspirationMeta,
    studioScenes: dto.studioScenes?.map((entry) => entry.data),
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

// Limitele de editare (docs/03 §4.3): 3 inainte de prima preluare, 1 dupa.
const MAX_PRE_CLAIM_EDITS = 3;
const MAX_POST_CLAIM_EDITS = 1;

// Fazele cererii: o bara pe faza (salvie = facuta, nuc = curenta, gri = urmeaza).
// Pe telefon raman doar barele + "Faza X din Y · nume"; etichetele apar de la sm.
// b8 (pasul 6): fazele deja trecute sunt butoane — drumul inapoi la Pornire e un clic.
function PhaseTrack({ labels, current, onSelect }: { labels: string[]; current: number; onSelect?: (index: number) => void }) {
  const t = useTranslations('Configurator');
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5 sm:px-5 sm:py-4">
      <ol
        aria-label={t('phasesLabel')}
        className="grid grid-flow-col auto-cols-fr gap-1.5 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] sm:gap-3"
      >
        {labels.map((label, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'next';
          const content = (
            <>
              <span
                aria-hidden
                className={cn(
                  'h-1 rounded-full',
                  state === 'done' ? 'bg-sage' : state === 'now' ? 'bg-walnut' : 'bg-border-2',
                )}
              />
              <span
                className={cn(
                  'hidden items-baseline gap-1.5 text-ui sm:flex',
                  state === 'done' ? 'text-sage' : state === 'now' ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className="font-mono text-meta">{i + 1}</span>
                {label}
              </span>
              <span className="sr-only sm:hidden">{label}</span>
            </>
          );
          return (
            <li key={i} aria-current={state === 'now' ? 'step' : undefined} className="flex flex-col">
              {state === 'done' && onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  aria-label={t('phaseGoTo', { phase: label })}
                  className="group flex min-h-11 flex-col gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut [&>span:nth-child(2)]:underline-offset-2 hover:[&>span:nth-child(2)]:underline"
                >
                  {content}
                </button>
              ) : (
                <span className="flex flex-col gap-2">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2.5 flex items-baseline gap-2 sm:hidden">
        <span className="font-mono text-meta text-muted-foreground">
          {t('sheet.phaseLabel', { current: current + 1, total: labels.length })}
        </span>
        <span className="text-sm font-semibold">{labels[current]}</span>
      </p>
    </div>
  );
}

// Starea ciornei, la vedere: progresul e mereu salvat in browser, iar copia de pe
// server (reluare de pe alt dispozitiv) urmeaza la ~1,5 s dupa fiecare schimbare.
// Fara role="status": pagina are deja o zona de stare (publicarea), iar anuntarea
// fiecarei salvari ar fi zgomot pentru cititoarele de ecran.
function DraftStatus({ saving, failed, savedAt, onRetry }: { saving: boolean; failed: boolean; savedAt: number; onRetry?: () => void }) {
  const t = useTranslations('Configurator');
  const format = useFormatter();
  const base = 'inline-flex min-h-11 items-center gap-2 font-mono text-xs';
  if (saving) {
    return (
      <p className={cn(base, 'text-muted-foreground')}>
        <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
        {t('draft.saving')}
      </p>
    );
  }
  if (failed) {
    // b3 (pasul 4): salvarea pe server a esuat (ex. 502 intamplator) — se poate reincerca
    return (
      <p className={cn(base, 'text-amber')}>
        <CloudOff aria-hidden className="h-3.5 w-3.5" />
        {t('draft.localOnly')}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center font-sans text-sm font-medium text-walnut underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut"
          >
            {t('draft.retry')}
          </button>
        )}
      </p>
    );
  }
  return (
    <p className={cn(base, 'text-sage')}>
      <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
      {savedAt > 0
        ? t('draft.savedAt', {
            time: format.dateTime(new Date(savedAt), { hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE }),
          })
        : t('draft.saved')}
    </p>
  );
}

// Mod editare: a cata editare este si cate mai raman, din contoarele cererii
// deja incarcate (preClaimEditsUsed / postClaimEditsUsed). Salvarea consuma una.
function EditNotice({ request, className }: { request: RequestDto; className?: string }) {
  const t = useTranslations('Configurator');
  const preClaim = request.status === 'IN_MARKETPLACE';
  const postClaim = request.status === 'CLAIMED_PARTIAL' || request.status === 'CLAIMED_FULL';
  if (!preClaim && !postClaim) return null;
  const max = preClaim ? MAX_PRE_CLAIM_EDITS : MAX_POST_CLAIM_EDITS;
  const used = Math.min(max, preClaim ? request.preClaimEditsUsed : request.postClaimEditsUsed);
  const exhausted = used >= max;
  const current = exhausted ? max : used + 1;
  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border border-amber/30 bg-amber-soft px-4 py-4 text-amber sm:px-5', className)}>
      <p className="font-semibold">{exhausted ? t('edit.noneLeft') : t('edit.counter', { current, max })}</p>
      <div aria-hidden className={cn('grid max-w-xs gap-1.5', preClaim ? 'grid-cols-3' : 'grid-cols-1')}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={cn('h-1.5 rounded-full', i < current ? 'bg-amber' : 'bg-amber/25')} />
        ))}
      </div>
      {/* cu toate editarile folosite serverul refuza salvarea: fara notele despre "consuma una" */}
      {!exhausted && (
        <>
          <p className="text-ui">{preClaim ? t('edit.preClaimNote', { max }) : t('edit.postClaimNote')}</p>
          <p className="text-ui">{t('edit.saveHint')}</p>
        </>
      )}
    </div>
  );
}

export function ConfiguratorWizard({ editId }: { editId?: string }) {
  const t = useTranslations('Configurator');
  const router = useRouter();
  const locale = useLocale();
  const isEdit = Boolean(editId);
  const createDraft = useCreateDraft();
  const { mutateAsync: createDraftAsync } = createDraft;
  const created = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const resetOnCreate = useRef(true);

  const store = useConfiguratorStore;
  const phase = useConfiguratorStore((s) => s.phase);
  const setPhase = useConfiguratorStore((s) => s.setPhase);
  const setActiveRoom = useConfiguratorStore((s) => s.setActiveRoom);
  const setTokenInStore = useConfiguratorStore((s) => s.setToken);
  const updatedAt = useConfiguratorStore((s) => s.updatedAt);
  const startMode = useConfiguratorStore((s) => s.startMode);
  const setStartMode = useConfiguratorStore((s) => s.setStartMode);
  const designHelp = startMode === 'DESIGN_HELP';
  // b8-3: camerele cu raspunsuri afectate de trecerea pe "Am nevoie de ajutor"
  const [modeConfirm, setModeConfirm] = useState<string[] | null>(null);

  const createAnonymousDraft = useCallback((resetProgress: boolean) => {
    created.current = true;
    resetOnCreate.current = resetProgress;
    setBootstrapFailed(false);
    setCreatingDraft(true);
    return createDraftAsync({})
      .then((res) => {
        localStorage.setItem(DRAFT_TOKEN_KEY, res.draftToken);
        if (resetProgress) store.getState().reset();
        setTokenInStore(res.draftToken);
        setToken(res.draftToken);
        // E-admin-platform-8: doar un draft NOU conteaza (reutilizarea tokenului salvat, nu)
        track('wizard_start', locale);
      })
      .catch(() => {
        // Retry explicit: un serviciu indisponibil nu trebuie sa declanseze POST-uri in bucla.
        setBootstrapFailed(true);
      })
      .finally(() => setCreatingDraft(false));
  }, [createDraftAsync, locale, setTokenInStore, store]);

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
    void createAnonymousDraft(!snapshotHasProgress(store.getState().snapshot()));
  }, [createAnonymousDraft, isEdit, setTokenInStore, store]);

  const draft = useDraft(isEdit ? null : token);
  const draftLoaded = Boolean(draft.data);
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
    // b8: build-urile vechi puteau trimite pe ciorna o editare abandonata — nu o reluam
    if (!hasLocal && serverState && Array.isArray(serverState.roomInstances) && !isAbandonedEditSnapshot(serverState)) {
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
    setToken(null);
    void createAnonymousDraft(false);
    if (!resumeChecked.current) {
      resumeChecked.current = true;
      if (snapshotHasProgress(store.getState().snapshot())) setResumePrompt(true);
    }
  }, [draft.error, isEdit, createAnonymousDraft, store]);

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
    void createAnonymousDraft(false);
  };

  // --- mod editare: memorie proprie (b8, pasul 1) ---
  // Editarea lucreaza in sessionStorage, pe cheia cererii editate; ciorna cererii
  // noi (localStorage) nu e atinsa. La reincarcarea paginii editarea se reia din tab;
  // altfel se construieste din cererea publicata. Iesirea (fara salvare) o arunca.
  const editRequest = useRequest(editId ?? '');
  const [editReady, setEditReady] = useState(false);
  useEffect(() => {
    if (!isEdit || !editId || hydrated.current || !editRequest.data) return;
    hydrated.current = true;
    const resumed = enterEditSession(editId);
    if (!resumed) store.getState().loadSnapshot(buildSnapshotFromRequest(editRequest.data));
    setEditReady(true);
  }, [editId, editRequest.data, isEdit, store]);
  // Demontarea (fara salvare) arunca editarea abia dupa EDIT_RESUME_WINDOW_MS: schimbarea
  // limbii si dubla montare din dev remonteaza aceeasi editare, care continua de unde era.
  // La remontare aruncarea programata se anuleaza imediat (cererea poate veni mai tarziu).
  // m1: iesirea EXPLICITA ("Inapoi la cerere") arunca editarea pe loc; fereastra e doar
  // pentru remontarea aceleiasi pagini (schimbarea limbii). Pagina cererii arunca si ea
  // o editare in asteptare (orice alt drum inapoi la cerere).
  const explicitExit = useRef(false);
  useEffect(() => {
    if (!isEdit || !editId) return;
    holdEditSession(editId);
    explicitExit.current = false;
    return () => {
      hydrated.current = false;
      setEditReady(false);
      leaveEditSession(explicitExit.current ? undefined : { keepForMs: EDIT_RESUME_WINDOW_MS });
    };
  }, [editId, isEdit]);
  // pe /requests/new o editare lasata in asteptare se arunca pe loc
  useEffect(() => {
    if (!isEdit) discardPendingEditSession();
  }, [isEdit]);

  // Referinte la fisiere sterse (schite/snapshot3d scoase de pe draft sau de pe
  // cererea publicata): se curata o data dupa incarcare si la fiecare intrare in
  // review, doar pe o lista incarcata cu succes si nu in timpul unui refetch.
  // Niciodata in faza 'rooms': o schita poate fi in curs de urcare (E-client-2).
  const attachmentState = useAttachmentsStateFor(
    isEdit ? { kind: 'request', id: editId ?? '' } : { kind: 'draft', token: token ?? '' },
  );
  const initialPruneDone = useRef(false);
  const lastPrunedPhase = useRef<ConfiguratorPhase | null>(null);
  useEffect(() => {
    if (!hydrated.current || !attachmentState.isSuccess || attachmentState.isFetching) return;
    if (phase === 'rooms') {
      lastPrunedPhase.current = phase;
      return;
    }
    const enteringReview = phase === 'review' && lastPrunedPhase.current !== 'review';
    lastPrunedPhase.current = phase;
    if (initialPruneDone.current && !enteringReview) return;
    initialPruneDone.current = true;
    store.getState().pruneAttachmentRefs(new Set(attachmentState.attachments.map((a) => a.id)));
  }, [attachmentState.isSuccess, attachmentState.isFetching, attachmentState.attachments, phase, store]);

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

  // b3: de la "Publica cererea" pana la plecarea de pe pagina ciorna nu se mai trimite
  // (ar ajunge pe o ciorna deja publicata si ar afisa "salvata doar pe acest dispozitiv")
  const publishingRef = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const onPublishingChange = useCallback((busy: boolean) => {
    publishingRef.current = busy;
    setPublishing(busy);
  }, []);
  // b2: o singura salvare pe server in curs; schimbarile venite intre timp pleaca
  // intr-o singura salvare, dupa ce se termina cea curenta
  const patchRef = useRef(patchDraft);
  patchRef.current = patchDraft;
  const patchInFlight = useRef(false);
  const patchQueued = useRef(false);
  const sendDraft = useCallback(function send() {
    if (publishingRef.current) return;
    if (patchInFlight.current) {
      patchQueued.current = true;
      return;
    }
    patchInFlight.current = true;
    patchRef.current
      .mutateAsync({ configuratorState: store.getState().snapshot() as unknown as Record<string, unknown> })
      .catch(() => {
        // starea de eroare o arata DraftStatus (cu "Reincearca")
      })
      .finally(() => {
        patchInFlight.current = false;
        if (patchQueued.current) {
          patchQueued.current = false;
          send();
        }
      });
  }, [store]);

  // Sync server debounced (doar creare): backup pentru resume de pe alt device.
  useEffect(() => {
    if (isEdit || !token || !draftLoaded || publishing) return;
    const handle = setTimeout(sendDraft, 1500);
    return () => clearTimeout(handle);
  }, [updatedAt, token, isEdit, draftLoaded, publishing, sendDraft]);

  // b3: memoria ciornei publicate se goleste abia dupa plecarea de pe pagina, ca
  // formularul sa nu mai arate primul pas intre reusita si pagina cererii
  const clearOnLeave = useRef(false);
  useEffect(() => () => {
    if (!clearOnLeave.current) return;
    clearOnLeave.current = false;
    store.getState().reset();
  }, [store]);

  // f2: un cont de firma / admin nu poate publica — afla de la inceput
  const me = useMe();
  const nonClient = isNonClientRole(me.data?.role);

  // la editare: abia dupa trecerea pe memoria editarii (altfel pasii ar randa, si
  // ar putea scrie, peste ciorna cererii noi)
  const ready = isEdit ? Boolean(editRequest.data) && editReady : Boolean(token && draft.data);
  if (!ready) {
    const failed = isEdit ? editRequest.isError : bootstrapFailed || (draft.isError && !(draft.error instanceof ApiError && draft.error.status === 404));
    const retrying = isEdit ? editRequest.isFetching : creatingDraft || draft.isFetching;
    if (failed) return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center" role="alert">
        <h1 className="font-serif text-2xl">{t('bootstrap.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('bootstrap.description')}</p>
        <Button type="button" variant="walnut" disabled={retrying} onClick={() => {
          if (isEdit) void editRequest.refetch();
          else if (token) void draft.refetch();
          else void createAnonymousDraft(resetOnCreate.current);
        }}>{t('bootstrap.retry')}</Button>
      </div>
    );
    return <p role="status" className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  const uploadTarget: AttachmentTarget = isEdit
    ? { kind: 'request', id: editId! }
    : { kind: 'draft', token: token! };

  // alegerea de pe pasul de pornire: modul e singura sursa (b8) — setStartMode
  // aduce dupa el hasOwnProject si bifele de ajutor ale camerelor — apoi la cos.
  // Trecerea pe "Am nevoie de ajutor" cu raspunsuri deja date cere confirmare (b8-3).
  const applyStartMode = (mode: StartMode) => {
    setStartMode(mode);
    setPhase('cart');
  };
  const pickStartMode = (mode: StartMode) => {
    if (mode === 'DESIGN_HELP' && startMode !== 'DESIGN_HELP') {
      // piesele din Studio 3D nu se bifeaza, deci nu-si pierd nimic
      const answered = store.getState().roomInstances.filter((r) => !r.needsDesignHelp && !isStudioRoom(r) && roomHasAnswers(r));
      if (answered.length > 0) {
        const labels = roomInstanceLabels(store.getState().roomInstances, (rt) => t(`rooms.type.${rt}`));
        setModeConfirm(answered.map((r) => labels.get(r.localId) ?? ''));
        return;
      }
    }
    applyStartMode(mode);
  };

  const phaseOrder = designHelp ? DESIGN_HELP_PHASE_ORDER : PHASE_ORDER;
  const phaseIndex = Math.max(0, phaseOrder.indexOf(phase));
  const phaseLabels = phaseOrder.map((p) => t(`phases.${p}`));
  // clic pe o faza trecuta din bara de sus (b8, pasul 6); la "Detalii camere" se
  // deschide prima camera care are intrebari (nu una bifata "am nevoie de ajutor")
  const goToPhase = (index: number) => {
    const target = phaseOrder[index];
    if (!target || index >= phaseIndex) return;
    if (target === 'rooms') {
      const rooms = store.getState().roomInstances;
      const active = rooms[store.getState().activeRoomIndex];
      if (!active || active.needsDesignHelp) {
        const first = rooms.findIndex((r) => !r.needsDesignHelp);
        if (first < 0) return;
        setActiveRoom(first);
      }
    }
    setPhase(target);
  };

  // sumarul isi are propria asezare (carduri + coloana de publicare); "Fisa cererii"
  // insoteste fazele in care exista deja camere de urmarit
  const inReview = phase === 'review';
  const showSheet = phase === 'rooms' || phase === 'uploads' || phase === 'details';
  // la pasul de camere, coloana din dreapta tine cosul; "Fisa cererii" ii ia locul
  // cand incep intrebarile, deci asezarea paginii nu sare intre cele doua faze
  const showBasket = phase === 'cart';
  const showSide = showSheet || showBasket;
  const headTitle = inReview ? t('review.title') : t(isEdit ? 'editTitle' : 'title');
  const headSubtitle = inReview
    ? t('review.subtitle')
    : isEdit
      ? t('editSubtitle')
      : phase === 'start'
        ? t('subtitle')
        : null;
  const editedRequest = isEdit ? editRequest.data : undefined;

  return (
    <div className="flex flex-col gap-6">
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

      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          {isEdit && editId && (
            <Link
              href={`/requests/${editId}`}
              onClick={() => {
                explicitExit.current = true;
              }}
              className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-walnut hover:text-walnut-deep"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
              {t('edit.backToRequest')}
            </Link>
          )}
          <p className="kicker">{t(isEdit ? 'editKicker' : 'kicker')}</p>
          <h1 className="page-title">{headTitle}</h1>
          {headSubtitle && <p className="max-w-3xl text-lead text-muted-foreground">{headSubtitle}</p>}
        </div>
        {/* la editare nu exista ciorna: modificarile se salveaza abia din Sumar */}
        {!isEdit && (
          <DraftStatus
            saving={patchDraft.isPending}
            failed={patchDraft.isError && !publishing}
            savedAt={patchDraft.isSuccess ? draft.dataUpdatedAt : 0}
            onRetry={sendDraft}
          />
        )}
      </header>

      {/* f2: doar un cont de client publica cereri */}
      {!isEdit && nonClient && <ClientOnlyNote />}

      {/* sub antet pe ecrane mici si in fazele fara coloana laterala; altfel sta in coloana */}
      {editedRequest && <EditNotice request={editedRequest} className={cn(showSide && 'lg:hidden')} />}

      <DesignHelpConfirmDialog
        open={modeConfirm !== null}
        rooms={modeConfirm ?? []}
        wholeRequest
        onCancel={() => setModeConfirm(null)}
        onConfirm={() => {
          setModeConfirm(null);
          applyStartMode('DESIGN_HELP');
        }}
      />

      <PhaseTrack labels={phaseLabels} current={phaseIndex} onSelect={goToPhase} />

      {inReview ? (
        <motion.div
          key="review"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <ReviewStep
            token={token}
            editId={editId}
            uploadTarget={uploadTarget}
            onBack={() => setPhase('details')}
            onEditRoom={(i, stepId) => {
              // "Completeaza" din sumar: camera se redeschide exact la pasul problema
              const state = store.getState();
              const room = state.roomInstances[i];
              if (!room) return;
              state.markRoomCompleted(room.localId, false);
              state.focusRoomStep(i, stepId ? screenIndexForStep(room, stepId, state.details.hasOwnProject === true) : 0);
              setPhase('rooms');
            }}
            onEditDetails={() => setPhase('details')}
            onEditFiles={() => setPhase('uploads')}
            onPublishingChange={onPublishingChange}
            onPublished={(id) => {
              // b3: intai plecarea, apoi golirea memoriei (ecranul "Se publica…" ramane
              // pana apare pagina cererii)
              if (!isEdit) {
                // tokenul moare la publicare (SEC2-4): nu se mai pastreaza per cerere;
                // repostul/editarea merg pe rutele autentificate :id. Copia din browser
                // se sterge acum (o reincarcare / un tab inchis nu mai readuce cererea
                // publicata ca "Continui?"); memoria din pagina, la demontare.
                try {
                  localStorage.removeItem(DRAFT_TOKEN_KEY);
                  localStorage.removeItem(CONFIGURATOR_STORAGE_KEY);
                } catch {
                  // storage indisponibil
                }
                clearOnLeave.current = true;
              }
              // la editare: editarea salvata se sterge acum si nu mai poate fi reluata;
              // store-ul revine pe ciorna cererii noi (neatinsa, b8) la demontare
              if (isEdit) finishEditSession();
              toast.success(t(isEdit ? 'review.editSavedToast' : 'review.publishedToast'));
              router.push(`/requests/${id}`);
            }}
          />
        </motion.div>
      ) : (
        <div className={cn('grid items-start gap-6', showSide && 'lg:grid-cols-[minmax(0,1fr)_320px]')}>
          <motion.section
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="min-w-0 rounded-xl border border-border bg-surface p-5 shadow sm:p-7"
          >
        {phase === 'start' && (
          <StartModeStep value={startMode} onPick={pickStartMode} />
        )}
        {phase === 'cart' && (
          <RoomCartStep
            uploadTarget={uploadTarget}
            onBack={() => setPhase('start')}
            onContinue={() => {
              // "am nevoie de ajutor": fara chestionar per camera — direct la fisiere
              // camerele bifate "am nevoie de ajutor" sar intrebarile (PO g0-8)
              const first = store.getState().roomInstances.findIndex((r) => !r.needsDesignHelp);
              if (designHelp || first < 0) {
                setPhase('uploads');
                return;
              }
              setActiveRoom(first);
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
          </motion.section>

          {showSide && (
            <div
              className={cn(
                'min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto',
                // cosul are pe ecrane mici banda lui din pas (CartBasketStrip)
                showBasket ? 'hidden lg:flex' : 'flex',
              )}
            >
              {editedRequest && <EditNotice request={editedRequest} className="hidden lg:flex" />}
              {showBasket ? (
                <CartBasket uploadTarget={uploadTarget} />
              ) : (
                <RequestSheet phase={phase} phaseOrder={phaseOrder} designHelp={designHelp} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
