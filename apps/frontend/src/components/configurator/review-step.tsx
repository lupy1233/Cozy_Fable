'use client';

import {
  getFlow,
  mergeAccountEmail,
  type ConfiguratorContentInput,
  type ContactPreferenceInput,
  type QuestionStep,
} from '@marketplace/shared';
import { ArrowLeft, Check, Loader2, LogIn, Send, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useMe } from '@/hooks/use-auth';
import {
  useAttachmentsStateFor,
  useDraftCoverage,
  useEditRequestById,
  usePublishDraft,
  useRemoveAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { useRouter } from '@/i18n/routing';
import { excludedFileIds, useConfiguratorStore, type RoomInstance } from '@/stores/configurator-store';
import { synchronizeStudioSnapshots, invalidStudioRequestEntries } from '@/stores/studio-transfer';
import { ApproxLengthNote, needsApproxLength } from './approx-length-field';
import { InspirationPicker } from './inspiration-picker';
import { ReviewFactsCard } from './review-facts-card';
import { budgetPayload, isBudgetChosen } from './budget-choice';
import { RailNode } from './review-rail';
import { ReviewRoomCard, type ReviewRoomIssue } from './review-room-card';
import { anyRoomNeedsDesignHelp, roomInstanceLabels, toServerRoom } from './room-payload';
import { toast } from '@/components/ui/toaster';
import { roomIssue } from './room-screens';
import { AttachmentThumb } from './attachment-item';
import { ClientOnlyNote, isNonClientRole } from './client-only-note';
import { useReviewSnapshots } from './snapshot3d-sync';
import { SNAPSHOT3D_STEP_ID, snapshot3dIds } from '@/stores/snapshot3d';
import { editSnapshotIdsToRemove, resetEditSnapshotFiles } from '@/stores/edit-snapshot-files';
import { BELOW_LG, useMediaQuery } from '@/components/ui/use-media-query';
import { loginTarget } from '@/lib/session-lost';
import { StickyActionBar } from './sticky-action-bar';
import { summaryLabel } from './summary-rows';

// O problema de camera intoarsa de server: details[] de la CONFIGURATOR_ANSWERS_INVALID /
// FILE_SCAN_BLOCKED sau obiectul {roomIndex} de la CONFIGURATOR_FLOW_VERSION_UNSUPPORTED.
interface ServerRoomIssue {
  roomIndex: number;
  stepId: string | null;
  messageKey: string;
}

function serverRoomIssues(code: string | null, details: unknown): ServerRoomIssue[] {
  const read = (d: unknown): ServerRoomIssue | null => {
    if (!d || typeof d !== 'object') return null;
    const o = d as { roomIndex?: unknown; stepId?: unknown; messageKey?: unknown };
    if (typeof o.roomIndex !== 'number') return null;
    return {
      roomIndex: o.roomIndex,
      stepId: typeof o.stepId === 'string' ? o.stepId : null,
      messageKey: typeof o.messageKey === 'string'
        ? o.messageKey
        : code === 'CONFIGURATOR_FLOW_VERSION_UNSUPPORTED' ? 'validation.flowVersionUnsupported' : 'validation.answerInvalid',
    };
  };
  const list = Array.isArray(details) ? details.map(read) : [read(details)];
  return list.filter((issue): issue is ServerRoomIssue => issue !== null);
}

// E-admin-platform-45: REQUEST_CONTACT_INFO_IN_TEXT cu { field: 'description' } = mesajul
// pentru firme din Detalii contine date de contact (politica BLOCK).
function hasDescriptionContact(code: string | null, details: unknown): boolean {
  return code === 'REQUEST_CONTACT_INFO_IN_TEXT' && Array.isArray(details) &&
    details.some((d) => d && typeof d === 'object' && (d as { field?: unknown }).field === 'description');
}

// E-client-34: photoId-urile ale caror notita contine date de contact (politica BLOCK)
function inspirationNoteContactIds(code: string | null, details: unknown): string[] {
  if (code !== 'REQUEST_CONTACT_INFO_IN_TEXT' || !Array.isArray(details)) return [];
  return details.flatMap((d) => {
    if (!d || typeof d !== 'object') return [];
    const o = d as { field?: unknown; photoId?: unknown };
    return o.field === 'inspirationNote' && typeof o.photoId === 'string' ? [o.photoId] : [];
  });
}

// E-client-34: VALIDATION_ERROR cu field 'inspirationPhotos' = camera aleasa nu mai exista in cerere
function inspirationRoomUnknownIds(code: string | null, details: unknown): string[] {
  if (code !== 'VALIDATION_ERROR' || !Array.isArray(details)) return [];
  return details.flatMap((d) => {
    if (!d || typeof d !== 'object') return [];
    const o = d as { field?: unknown; photoId?: unknown };
    return o.field === 'inspirationPhotos' && typeof o.photoId === 'string' ? [o.photoId] : [];
  });
}

// VALIDATION_ERROR cu `path` in details = campuri din Detalii (ex. contactele).
function hasDetailPaths(details: unknown): boolean {
  return Array.isArray(details) && details.some((d) => d && typeof d === 'object' && 'path' in d);
}

// m7: cat asteptam stergerea fisierelor camerelor scoase inainte sa renuntam
export const FILE_REMOVAL_TIMEOUT_MS = 10_000;

export function ReviewStep({
  token,
  editId,
  uploadTarget,
  onBack,
  onEditRoom,
  onEditDetails,
  onEditFiles,
  onPublished,
  onPublishingChange,
}: {
  // mod creare: tokenul draftului; mod editare: id-ul cererii publicate
  token: string | null;
  editId?: string;
  // sursa atasamentelor pentru preview-urile din sumar (item 10)
  uploadTarget: AttachmentTarget;
  onBack: () => void;
  // stepId (optional): pasul la care se redeschide camera ("Completeaza")
  onEditRoom: (index: number, stepId?: string) => void;
  onEditDetails: () => void;
  onEditFiles?: () => void;
  onPublished: (requestId: string) => void;
  // b3: true de la clic pana la reusita (wizard-ul opreste salvarea ciornei), false la esec
  onPublishingChange?: (busy: boolean) => void;
}) {
  const t = useTranslations('Configurator');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const authed = !!me.data;
  // f2: firma / adminul nu publica; vede nota in locul butonului
  const nonClient = isNonClientRole(me.data?.role);
  const isEdit = Boolean(editId);
  const removeAttachment = useRemoveAttachmentFor(uploadTarget);
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  // b6 + M1: fisierele camerelor scoase si cele ascunse (poza 3D) ale camerelor bifate nu
  // pleaca la firme si nu sunt fisiere ale proiectului; pe ciorna se sterg inainte de publicare
  const discardedFiles = useConfiguratorStore((s) => s.discardedFiles);
  const discarded = useMemo(() => excludedFileIds(rooms, discardedFiles), [rooms, discardedFiles]);
  // m7: publicarea nu pleaca daca fisierele de mai sus n-au putut fi scoase de pe ciorna
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const studioScenes = useConfiguratorStore((s) => s.studioScenes);
  const synchronizedScenes = useMemo(() => synchronizeStudioSnapshots(studioScenes ?? [], rooms), [studioScenes, rooms]);
  const invalidStudioEntries = useMemo(() => invalidStudioRequestEntries(synchronizedScenes), [synchronizedScenes]);
  const details = useConfiguratorStore((s) => s.details);
  const startMode = useConfiguratorStore((s) => s.startMode);
  const designHelp = startMode === 'DESIGN_HELP';
  const inspirationPhotoIds = useConfiguratorStore((s) => s.inspirationPhotoIds);
  const inspirationMeta = useConfiguratorStore((s) => s.inspirationMeta);
  const setInspirationRoom = useConfiguratorStore((s) => s.setInspirationRoom);
  const setDetails = useConfiguratorStore((s) => s.setDetails);
  const setInspirationPhotos = useConfiguratorStore((s) => s.setInspirationPhotos);
  const syncCompletion = useConfiguratorStore((s) => s.syncCompletion);
  const ownProject = details.hasOwnProject === true;
  const labels = roomInstanceLabels(rooms, (rt) => t(`rooms.type.${rt}`));
  const roomLabel = (localId: string) => labels.get(localId) ?? '';
  const attachmentState = useAttachmentsStateFor(uploadTarget);
  const attachments = attachmentState.attachments;
  // d4: imaginile 3D ale pieselor (miniatura in card, desenare ascunsa, urcare)
  const snapshots = useReviewSnapshots({ rooms, attachments, target: uploadTarget, isEdit });
  const publishDraft = usePublishDraft(token ?? '');
  const editRequest = useEditRequestById(editId ?? '');
  const publish = isEdit ? editRequest : publishDraft;
  // urcarea snapshot-urilor 3D dinaintea publish-ului (R4)
  const [preparing, setPreparing] = useState(false);
  // a6: cu adresa completata intrebam serverul daca exista vreo firma in zona; la NONE aratam
  // avertismentul inaintea butonului (publicarea ramane posibila). UNKNOWN / eroare → nimic.
  const coverage = useDraftCoverage(isEdit ? null : token, {
    addressText: details.addressText,
    city: details.city,
    county: details.county,
    country: details.country ?? 'RO',
  });
  const noCoverage = !isEdit && coverage.data?.coverage === 'NONE';

  // titlul nu mai e cerut: e generat automat pe server din camere + oras
  // b11: bugetul ales de client (o suma sau "Prefer sa nu spun") face parte din Date generale
  const detailsComplete = Boolean(
    isBudgetChosen(details) &&
      details.addressText &&
      details.county &&
      details.city &&
      (details.contactPreferences?.length ?? 0) > 0,
  );
  // Completitudinea vine din validarea stricta de publicare (aceeasi functie ca
  // serverul), nu din flag-ul `completed` al runner-ului — drafturi vechi sau
  // camere editate partial nu mai ajung la un 400 opac (E-client-2).
  // camerele bifate "am nevoie de ajutor" nu au chestionar (roomIssue = null) — e suficient sa existe
  const localIssues = useMemo(
    () => rooms.map((r) => !r.needsDesignHelp && invalidStudioEntries.has(r.localId) ? { stepId: 'config3d', messageKey: 'validation.studioPieceDoesNotFit' } : roomIssue(r, { ownProject })),
    [rooms, ownProject, invalidStudioEntries],
  );
  const allRoomsComplete =
    rooms.length > 0 && localIssues.every((issue) => issue === null);

  // flag-ul `completed` (bifele din runner) urmeaza validarea
  useEffect(() => {
    syncCompletion(ownProject);
  }, [ownProject, syncCompletion]);

  // Emailul contului pe primul loc + plafoanele (max 2 per canal, max 4), cu
  // acelasi helper ca serverul; clientul vede ce s-a scos INAINTE de publicare.
  const accountEmail = me.data?.email ?? null;
  const [droppedContacts, setDroppedContacts] = useState<ContactPreferenceInput[]>([]);
  useEffect(() => {
    if (!accountEmail) return;
    const current = (details.contactPreferences ?? []) as ContactPreferenceInput[];
    const merged = mergeAccountEmail(current, accountEmail);
    if (JSON.stringify(merged.contacts) === JSON.stringify(current)) return;
    setDetails({ contactPreferences: merged.contacts });
    if (merged.dropped.length > 0) setDroppedContacts(merged.dropped);
  }, [accountEmail, details.contactPreferences, setDetails]);

  // m7: sterge fisierele, cu limita de timp; un fisier deja disparut (404) e considerat sters
  const removeFiles = async (ids: string[]): Promise<boolean> => {
    if (ids.length === 0) return true;
    const all = Promise.all(ids.map((id) => removeAttachment.mutateAsync(id).then(
      () => true,
      (err: unknown) => err instanceof ApiError && err.status === 404,
    ))).then((results) => results.every(Boolean));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), FILE_REMOVAL_TIMEOUT_MS); });
    try {
      return await Promise.race([all, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  const doPublish = async () => {
    if (!detailsComplete || !allRoomsComplete || preparing || nonClient) return;
    setCleanupFailed(false);
    onPublishingChange?.(true);

    // D-3D-4 + d4: imaginea PNG a pieselor configurate 3D (answers.snapshot3d). Imaginile
    // asteptate urca acum (ciorna: de obicei deja urcate; editare: abia la salvare). O piesa
    // fara imaginea configuratiei de acum pleaca fara imagine — niciodata cu una veche.
    // Best-effort: un esec de urcare nu blocheaza publicarea (pas optional).
    let stripSnapshotRooms = new Set<string>();
    let staleSnapshotIds = new Set<string>();
    setPreparing(true);
    try {
      const plan = await snapshots.prepareForPublish();
      stripSnapshotRooms = plan.stripRooms;
      staleSnapshotIds = new Set(plan.removeIds);
      // b6 + M1: schitele camerelor scoase (nesterse la scoatere) si poza 3D a camerelor
      // bifate se sterg acum de pe ciorna, altfel ar pleca la firme drept fisiere ale
      // proiectului. d4: la fel imaginile 3D vechi. m7: lista neincarcata sau o stergere
      // esuata opresc publicarea.
      const latest = useConfiguratorStore.getState();
      const removeBefore = new Set([...excludedFileIds(latest.roomInstances, latest.discardedFiles), ...staleSnapshotIds]);
      if (!isEdit && removeBefore.size > 0) {
        const ok = attachmentState.isSuccess && await removeFiles(attachments.filter((a) => removeBefore.has(a.id)).map((a) => a.id));
        if (!ok) {
          setCleanupFailed(true);
          onPublishingChange?.(false);
          return;
        }
      }
    } finally {
      setPreparing(false);
    }

    // b11: treapta derivata din suma (aceeasi regula ca serverul) + suma aleasa de client;
    // fara cadere pe o treapta pusa din oficiu
    const budget = budgetPayload(details);
    const payload: ConfiguratorContentInput = {
      description: details.description ?? '',
      budgetRange: budget.budgetRange,
      budgetEstimateRon: budget.budgetEstimateRon,
      budgetDeclared: budget.budgetDeclared,
      deadlineBucket:
        (details.deadlineBucket as ConfiguratorContentInput['deadlineBucket']) || undefined,
      // b8: derivat din camere (serverul il recalculeaza oricum); modul = singura sursa pentru proiect
      includesPaidDesign: anyRoomNeedsDesignHelp(rooms),
      hasOwnProject: startMode === 'OWN_PROJECT',
      addressText: details.addressText!,
      // b12: gol = nimic (la editare serverul il goleste)
      addressDetails: details.addressDetails?.trim() || undefined,
      county: details.county!,
      city: details.city!,
      country: details.country ?? 'RO',
      // camerele bifate pleaca doar cu tipul, fisierele lor si bifa (PO b8-3)
      // d4: camerele citite acum din store (imaginile urcate mai sus sunt deja in raspunsuri)
      rooms: useConfiguratorStore.getState().roomInstances.map((r) => {
        const room = toServerRoom(r);
        if (!stripSnapshotRooms.has(r.localId)) return { sourceLocalId: r.localId, ...room };
        const answers = { ...room.answers };
        delete answers[SNAPSHOT3D_STEP_ID];
        return { sourceLocalId: r.localId, ...room, answers };
      }),
      contactPreferences: (details.contactPreferences ?? []) as ContactPreferenceInput[],
      // E-client-34: notita + camera per poza (camera doar daca inca exista in cos)
      inspirationPhotos: inspirationPhotoIds.map((photoId) => {
        const m = inspirationMeta?.[photoId];
        return {
          photoId,
          note: m?.note?.trim() || undefined,
          roomLocalId: m?.roomLocalId && rooms.some((r) => r.localId === m.roomLocalId) ? m.roomLocalId : undefined,
        };
      }),
      studioScenes: synchronizedScenes,
    };
    // mutateAsync (nu callback-uri pe mutate): continuarea ruleaza si daca pagina se demonteaza
    let req: Awaited<ReturnType<typeof publish.mutateAsync>>;
    try {
      req = await publish.mutateAsync(payload);
    } catch {
      // eroarea o arata publish.error
      onPublishingChange?.(false);
      return;
    }
    // b6 + M1: la editare fisierele de mai sus sunt ale cererii; se sterg abia acum, dupa ce
    // salvarea a reusit. m7: o stergere care nu raspunde nu tine ecranul la nesfarsit.
    if (isEdit && editId) {
      // d4 + M2: plus toate imaginile 3D atinse de editare (si la incercarile esuate dinainte)
      // pe care cererea salvata nu le foloseste — pe piesa ramane doar imaginea salvata
      // camerele cu "am nevoie de ajutor" pleaca fara raspunsuri → fara imagine 3D
      const saved = new Set(
        payload.rooms.flatMap((r) =>
          snapshot3dIds({
            answers: (('answers' in r && r.answers) || {}) as Parameters<typeof snapshot3dIds>[0]['answers'],
          }),
        ),
      );
      const unusedSnapshots = editSnapshotIdsToRemove(editId, saved);
      resetEditSnapshotFiles(editId);
      const stale = [...new Set([
        ...(req.attachments ?? []).filter((a) => discarded.has(a.id) || staleSnapshotIds.has(a.id)).map((a) => a.id),
        ...unusedSnapshots,
      ])];
      if (!(await removeFiles(stale))) {
        // ce n-a putut fi sters se sterge la iesirea din editare (finishEditSession)
        resetEditSnapshotFiles(editId, unusedSnapshots);
        toast.warning(t('review.filesLeftWarning'));
      }
    }
    onPublished(req.id);
  };

  const apiErr = publish.error ? publish.error instanceof ApiError ? publish.error.code : 'GENERIC' : null;
  const apiDetails = publish.error instanceof ApiError ? publish.error.details : undefined;
  // b9 (etapa 8): sesiunea a expirat / a fost inchisa de o alta autentificare — mesaj clar si
  // drumul inapoi aici dupa login (faza "review" e deja salvata in ciorna / in editare)
  const sessionExpired =
    apiErr === 'UNAUTHORIZED' ||
    apiErr === 'SESSION_SUPERSEDED' ||
    (publish.error instanceof ApiError && publish.error.status === 401);
  const sessionLoginHref = loginTarget(isEdit && editId ? `/requests/${editId}/edit` : '/requests/new', '', { expired: true });
  // j1: pe telefon (sub lg) "Inapoi" si actiunea principala stau in bara lipita jos; pe desktop
  // in coloana de publicare. Un singur buton in pagina la orice latime (nu doua ascunse cu CSS).
  const isPhone = useMediaQuery(BELOW_LG);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (apiErr) errorRef.current?.focus();
  }, [apiErr, publish.failureCount]);

  // pozele retrase din galerie intre timp: scoase din selectie, clientul
  // apasa din nou pe Publica (INSPIRATION_UNAVAILABLE, details.photoIds)
  useEffect(() => {
    if (apiErr !== 'INSPIRATION_UNAVAILABLE') return;
    const ids = (apiDetails as { photoIds?: unknown } | undefined)?.photoIds;
    if (!Array.isArray(ids) || ids.length === 0) return;
    const gone = new Set(ids.filter((id): id is string => typeof id === 'string'));
    const selected = useConfiguratorStore.getState().inspirationPhotoIds;
    if (selected.some((id) => gone.has(id))) setInspirationPhotos(selected.filter((id) => !gone.has(id)));
  }, [apiErr, apiDetails, setInspirationPhotos]);

  // E-client-34: camera unei poze dispare din cerere intre timp: legatura se scoate, clientul alege din nou
  const unknownRoomPhotoIds = inspirationRoomUnknownIds(apiErr, apiDetails);
  useEffect(() => {
    for (const photoId of inspirationRoomUnknownIds(apiErr, apiDetails)) setInspirationRoom(photoId, null);
  }, [apiErr, apiDetails, setInspirationRoom]);
  const blockedNoteIds = inspirationNoteContactIds(apiErr, apiDetails);

  // problemele de camera de la server (indexul = ordinea din store, aceeasi ca in payload)
  const serverIssues = apiErr ? serverRoomIssues(apiErr, apiDetails) : [];
  const describeIssue = (room: RoomInstance, stepId: string | null, messageKey: string): ReviewRoomIssue => {
    const roomLabel = t(`rooms.type.${room.roomType}`);
    const problem = t.has(messageKey) ? t(messageKey) : t('validation.answerInvalid');
    let step: QuestionStep | undefined;
    try {
      step = stepId ? getFlow(room.roomType, room.flowVersion).steps.find((s) => s.id === stepId) : undefined;
    } catch {
      step = undefined;
    }
    // b10: eticheta scurta de rezumat (rezerva = titlul intrebarii)
    if (step && t.has(step.titleKey)) return { stepLabel: summaryLabel(t, step), problem };
    // fara pas cunoscut: versiunea de flow are mesajul ei, restul — mesajul generic de camera
    return { problem: stepId === null && t.has(messageKey) ? problem : t('review.issueRoom', { room: roomLabel }) };
  };
  const issueLine = (room: RoomInstance, issue: ReviewRoomIssue) =>
    issue.stepLabel
      ? t('review.issueRoomStep', { room: t(`rooms.type.${room.roomType}`), step: issue.stepLabel, problem: issue.problem })
      : issue.problem;
  const firstServerIssueByRoom = new Map<number, ServerRoomIssue>();
  for (const issue of serverIssues) {
    if (!firstServerIssueByRoom.has(issue.roomIndex)) firstServerIssueByRoom.set(issue.roomIndex, issue);
  }
  const roomIssues = rooms.map((room, i) => {
    const local = localIssues[i];
    if (local) return { issue: describeIssue(room, local.stepId, local.messageKey), stepId: local.stepId };
    const server = firstServerIssueByRoom.get(i);
    if (server) return { issue: describeIssue(room, server.stepId, server.messageKey), stepId: server.stepId };
    return null;
  });
  const referencedIds = new Set(rooms.flatMap((room) => Object.values(room.answers).flatMap((value) =>
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [],
  )));
  const liveAttachments = attachments.filter((attachment) => !discarded.has(attachment.id));
  const projectFiles = liveAttachments.filter((attachment) => !referencedIds.has(attachment.id));

  // Overlay-ul ramane vizibil si dupa succes (isSuccess), pana la redirect:
  // publish-ul face geocoding pe server si poate dura cateva secunde.
  const publishing = preparing || publish.isPending || publish.isSuccess;

  const readyToPublish = detailsComplete && allRoomsComplete;

  // actiunea principala: "Publica cererea" / "Salveaza modificarile" sau, ca vizitator,
  // autentificarea. Randata intr-un singur loc (cardul de publicare sau bara de pe telefon).
  const primaryAction = (className: string) =>
    authed ? (
      <Button
        type="button"
        variant="walnut"
        size="xl"
        className={cn('px-4', className)}
        disabled={!detailsComplete || !allRoomsComplete || publish.isPending || preparing}
        onClick={() => void doPublish()}
      >
        <Send aria-hidden />
        {isEdit ? t('review.saveEdit') : tr('publish')}
      </Button>
    ) : (
      <Button
        type="button"
        variant="walnut"
        size="xl"
        className={cn('h-auto min-h-12 whitespace-normal px-4 py-2 text-sm', className)}
        disabled={!detailsComplete || !allRoomsComplete || me.isPending}
        onClick={() => router.push('/login?redirect=/requests/new')}
      >
        <LogIn aria-hidden />
        {t('review.loginToPublish')}
      </Button>
    );

  return (
    <div className="flex flex-col gap-6">
      {publishing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-10 py-8 text-center shadow-lg"
          >
            <Loader2 className="h-7 w-7 animate-spin text-walnut" />
            <p className="font-serif text-lg">
              {isEdit ? t('review.publishingEdit') : t('review.publishing')}
            </p>
            {/* m2: publicarea asteapta imaginea 3D care inca se pregateste */}
            <p className="max-w-xs text-sm text-muted-foreground">{snapshots.waiting ? t('review.snapshot3d.working') : t('review.publishingHint')}</p>
          </div>
        </div>
      )}

      {/* titlul pasului ("Verifica si publica") sta in antetul paginii (wizard) */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Detalii generale */}
          <ReviewFactsCard
            details={details}
            complete={detailsComplete}
            mode={startMode}
            helpRooms={rooms.filter((r) => r.needsDesignHelp).map((r) => roomLabel(r.localId))}
            onEdit={onEditDetails}
          />

          {/* brief de proiectare: banner cu ce urmeaza dupa publicare */}
          {designHelp && <Alert tone="info">{t('review.designHelpBanner')}</Alert>}

          {/* Camere */}
          {rooms.map((room, i) => {
            const card = <ReviewRoomCard
              key={room.localId}
              room={room}
              index={i + 1}
              attachments={attachments}
              designHelp={room.needsDesignHelp === true}
              onEdit={() => onEditRoom(i)}
              issue={roomIssues[i]?.issue ?? null}
              onFix={() => onEditRoom(i, roomIssues[i]?.stepId ?? undefined)}
              snapshot3d={snapshots.byRoom.get(room.localId) ?? null}
            />;
            // d3: lungimea aproximativa data cu "Am deja un proiect", sub camera ei
            if (startMode !== 'OWN_PROJECT' || typeof room.approxLengthM !== 'number' || !needsApproxLength(room, true)) return card;
            return <div key={room.localId} className="flex flex-col gap-2">{card}<ApproxLengthNote value={room.approxLengthM} /></div>;
          })}

          {projectFiles.length > 0 && <section aria-labelledby="review-files-title" className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface px-5 py-5 sm:px-6">
            <h2 id="review-files-title" className="heading-section">{t('review.filesTitle')}</h2>
            <div className="flex flex-wrap gap-2">{projectFiles.map((attachment) => <AttachmentThumb key={attachment.id} attachment={attachment} />)}</div>
          </section>}

          <InspirationPicker blockedNoteIds={blockedNoteIds} />

          {/* d4: scena piesei fara imagine, desenata ascuns (in afara ecranului) */}
          {snapshots.renderer}

          {droppedContacts.length > 0 && (
            <Alert tone="info">
              {t('review.contactsAdjusted', { removed: droppedContacts.map((c) => c.value).join(', ') })}
            </Alert>
          )}

          {!isPhone && (
            <Button type="button" variant="outline" size="lg" className="h-11 self-start" onClick={onBack}>
              <ArrowLeft aria-hidden />
              {t('nav.back')}
            </Button>
          )}
        </div>

        {/* coloana de publicare: eroarea serverului, starea cererii, actiunea principala */}
        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto">
          {apiErr && sessionExpired && (
            <div ref={errorRef} tabIndex={-1} role="alert" data-session-expired className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson">
              <Alert tone="crimson">
                <p>{t('review.sessionExpired')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 min-h-11"
                  onClick={() => router.push(sessionLoginHref)}
                >
                  <LogIn aria-hidden className="mr-1 h-4 w-4" />
                  {t('review.sessionExpiredLogin')}
                </Button>
              </Alert>
            </div>
          )}
          {apiErr && !sessionExpired && (
            <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson">
            <Alert tone="crimson">
              {t.has(`apiErrors.${apiErr}`)
                ? t(`apiErrors.${apiErr}`)
                : tr.has(`apiErrors.${apiErr}`)
                  ? tr(`apiErrors.${apiErr}`)
                  : t('apiErrors.GENERIC')}
            </Alert>
            {/* ce anume blocheaza: camera + pasul, cu salt direct la el */}
            {(serverIssues.length > 0 || (apiErr === 'VALIDATION_ERROR' && hasDetailPaths(apiDetails)) || (apiErr === 'REQUEST_PROJECT_FILE_REQUIRED' && onEditFiles) || hasDescriptionContact(apiErr, apiDetails) || blockedNoteIds.length > 0 || unknownRoomPhotoIds.length > 0) && (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {blockedNoteIds.length > 0 && <li>{t('inspirationPicker.noteContactBlocked')}</li>}
                {unknownRoomPhotoIds.length > 0 && <li>{t('validation.inspirationRoomUnknown')}</li>}
                {hasDescriptionContact(apiErr, apiDetails) && <li className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t('contactInText.descriptionIssue')}</span>
                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onEditDetails}>
                    <Wrench aria-hidden className="mr-1 h-4 w-4" />{t('review.fix')}
                  </Button>
                </li>}
                {serverIssues.map((issue, k) => {
                  const room = rooms[issue.roomIndex];
                  if (!room) return null;
                  return <li key={`${issue.roomIndex}-${issue.stepId ?? ''}-${k}`} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{issueLine(room, describeIssue(room, issue.stepId, issue.messageKey))}</span>
                    <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onEditRoom(issue.roomIndex, issue.stepId ?? undefined)} aria-label={t('review.fixRoom', { room: t(`rooms.type.${room.roomType}`) })}>
                      <Wrench aria-hidden className="mr-1 h-4 w-4" />{t('review.fix')}
                    </Button>
                  </li>;
                })}
                {apiErr === 'VALIDATION_ERROR' && hasDetailPaths(apiDetails) && <li className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onEditDetails}>
                    <Wrench aria-hidden className="mr-1 h-4 w-4" />{t('review.fix')}
                  </Button>
                </li>}
                {apiErr === 'REQUEST_PROJECT_FILE_REQUIRED' && onEditFiles && <li className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onEditFiles}>
                    <Wrench aria-hidden className="mr-1 h-4 w-4" />{t('review.fix')}
                  </Button>
                </li>}
              </ul>
            )}
            </div>
          )}

          {cleanupFailed && (
            <div role="alert" data-cleanup-failed>
              <Alert tone="crimson">
                <p>{t('review.cleanupFailed')}</p>
                <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11" onClick={() => void doPublish()}>
                  {t('review.cleanupRetry')}
                </Button>
              </Alert>
            </div>
          )}

          <section
            aria-labelledby="review-publish-title"
            className="flex flex-col gap-4 rounded-xl border border-brass bg-surface p-5 shadow-sheet sm:p-6"
          >
            <h2 id="review-publish-title" className="font-serif text-2xl leading-tight">
              {readyToPublish
                ? t(isEdit ? 'review.readyTitleEdit' : 'review.readyTitle')
                : t('review.notReadyTitle')}
            </h2>

            {/* starea cererii — doar din datele deja existente */}
            <ul className="flex flex-col gap-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <ReadyMark ok={allRoomsComplete} />
                <span className="min-w-0 break-words">
                  {t('cart.totalRooms', { count: rooms.length })}
                  {rooms.length > 0 && ` — ${rooms.map((r) => t(`rooms.type.${r.roomType}`)).join(', ')}`}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ReadyMark ok={detailsComplete} />
                <span className={detailsComplete ? undefined : 'text-amber'}>
                  {detailsComplete ? t('review.checkDetails') : t('review.detailsIncomplete')}
                </span>
              </li>
              {liveAttachments.length > 0 && (
                <li className="flex items-start gap-2.5">
                  <ReadyMark ok />
                  <span>{t('summaryFiles.count', { n: liveAttachments.length })}</span>
                </li>
              )}
            </ul>
            {localIssues.some((issue) => issue !== null) && (
              <div className="flex flex-col gap-0.5 text-ui text-amber">
                {rooms
                  .filter((_, i) => localIssues[i] !== null)
                  .map((r) => (
                    <p key={r.localId}>
                      {t(`rooms.type.${r.roomType}`)} — {t('review.roomIncomplete')}
                    </p>
                  ))}
              </div>
            )}

            {/* a6 (PO a6-1 / a6-2): nicio firma in zona — avertisment cinstit, fara numar de firme */}
            {noCoverage && (
              <div
                role="status"
                data-testid="no-coverage-warning"
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-ui text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <p className="font-medium">{tr('visibility.noCoverage.title')}</p>
                <p className="mt-1">{tr('visibility.noCoverage.reviewBody')}</p>
              </div>
            )}

            {/* singura actiune principala a ecranului (pe telefon sta in bara de jos) */}
            {nonClient ? <ClientOnlyNote /> : !isPhone && primaryAction('w-full')}

            {/* Poti completa cererea ca vizitator, dar publicarea necesita cont */}
            {!authed && !me.isPending && readyToPublish ? (
              <p className="text-ui text-muted-foreground">{t('review.loginToPublishHint')}</p>
            ) : (
              authed && !nonClient && !isEdit && <p className="text-ui text-muted-foreground">{t('review.publishNote')}</p>
            )}
          </section>

          {/* cine vede cererea: aceleasi doua propozitii ca pana acum, mutate din cardul de detalii */}
          <section
            aria-labelledby="review-visibility-title"
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 px-5 py-5 sm:px-6"
          >
            <h2 id="review-visibility-title" className="heading-card">
              {tr('visibility.title')}
            </h2>
            <div>
              <h3 className="text-sm font-semibold">{tr('visibility.projectLabel')}</h3>
              <p className="text-ui text-muted-foreground">{t('review.facts.projectVisibility')}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">{tr('visibility.contactsLabel')}</h3>
              <p className="text-ui text-muted-foreground">{t('review.facts.contactVisibility')}</p>
            </div>
          </section>
        </div>
      </div>

      {/* j1: bara lipita jos pe telefon — ultimul copil al ecranului, fara margini negative
          (Sumarul nu sta intr-un card) */}
      {isPhone && (
        <StickyActionBar bleed={false} className="flex-nowrap">
          <Button type="button" variant="outline" size="xl" className="shrink-0 px-4 text-sm" onClick={onBack}>
            <ArrowLeft aria-hidden />
            {t('nav.back')}
          </Button>
          {!nonClient && primaryAction('min-w-0 flex-1')}
        </StickyActionBar>
      )}
    </div>
  );
}

// Bifa salvie = in regula; nod chihlimbar = mai e ceva de completat.
function ReadyMark({ ok }: { ok: boolean }) {
  return ok ? (
    <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sage" strokeWidth={2.5} />
  ) : (
    <RailNode state="issue" className="mx-[3px] mt-[5px]" />
  );
}
