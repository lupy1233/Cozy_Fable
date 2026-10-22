'use client';

import {
  getFlow,
  mergeAccountEmail,
  resolveBudgetFields,
  type BudgetRange,
  type ConfiguratorContentInput,
  type ContactPreferenceInput,
} from '@marketplace/shared';
import { ArrowLeft, Loader2, LogIn, Send, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import {
  useAttachmentsFor,
  useEditRequestById,
  usePublishDraft,
  useUploadAttachmentFor,
  type AttachmentTarget,
} from '@/hooks/use-requests';
import { useRouter } from '@/i18n/routing';
import { useConfiguratorStore, type RoomInstance } from '@/stores/configurator-store';
import { synchronizeStudioSnapshots, invalidStudioRequestEntries } from '@/stores/studio-transfer';
import { InspirationPicker } from './inspiration-picker';
import { ReviewFactsCard } from './review-facts-card';
import { ReviewRoomCard, type ReviewRoomIssue } from './review-room-card';
import { roomIssue } from './room-screens';
import { AttachmentThumb } from './attachment-item';

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

export function ReviewStep({
  token,
  editId,
  uploadTarget,
  onBack,
  onEditRoom,
  onEditDetails,
  onEditFiles,
  onPublished,
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
}) {
  const t = useTranslations('Configurator');
  const tr = useTranslations('Requests');
  const router = useRouter();
  const me = useMe();
  const authed = !!me.data;
  const isEdit = Boolean(editId);
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const studioScenes = useConfiguratorStore((s) => s.studioScenes);
  const synchronizedScenes = useMemo(() => synchronizeStudioSnapshots(studioScenes ?? [], rooms), [studioScenes, rooms]);
  const invalidStudioEntries = useMemo(() => invalidStudioRequestEntries(synchronizedScenes), [synchronizedScenes]);
  const details = useConfiguratorStore((s) => s.details);
  const designHelp = useConfiguratorStore((s) => s.startMode === 'DESIGN_HELP');
  const inspirationPhotoIds = useConfiguratorStore((s) => s.inspirationPhotoIds);
  const inspirationMeta = useConfiguratorStore((s) => s.inspirationMeta);
  const setInspirationRoom = useConfiguratorStore((s) => s.setInspirationRoom);
  const snapshots3d = useConfiguratorStore((s) => s.snapshots3d);
  const setAnswer = useConfiguratorStore((s) => s.setAnswer);
  const setDetails = useConfiguratorStore((s) => s.setDetails);
  const setInspirationPhotos = useConfiguratorStore((s) => s.setInspirationPhotos);
  const syncCompletion = useConfiguratorStore((s) => s.syncCompletion);
  const ownProject = details.hasOwnProject === true;
  const attachments = useAttachmentsFor(uploadTarget);
  const uploadAttachment = useUploadAttachmentFor(uploadTarget);
  const publishDraft = usePublishDraft(token ?? '');
  const editRequest = useEditRequestById(editId ?? '');
  const publish = isEdit ? editRequest : publishDraft;
  // urcarea snapshot-urilor 3D dinaintea publish-ului (R4)
  const [preparing, setPreparing] = useState(false);

  // titlul nu mai e cerut: e generat automat pe server din camere + oras
  const detailsComplete = Boolean(
    details.addressText &&
      details.county &&
      details.city &&
      (details.contactPreferences?.length ?? 0) > 0,
  );
  // Completitudinea vine din validarea stricta de publicare (aceeasi functie ca
  // serverul), nu din flag-ul `completed` al runner-ului — drafturi vechi sau
  // camere editate partial nu mai ajung la un 400 opac (E-client-2).
  // "am nevoie de ajutor": camerele nu au chestionar — e suficient sa existe
  const localIssues = useMemo(
    () => rooms.map((r) => invalidStudioEntries.has(r.localId) ? { stepId: 'config3d', messageKey: 'validation.studioPieceDoesNotFit' } : designHelp ? null : roomIssue(r, { ownProject })),
    [rooms, designHelp, ownProject, invalidStudioEntries],
  );
  const allRoomsComplete =
    rooms.length > 0 && localIssues.every((issue) => issue === null);

  // flag-ul `completed` (bifele din runner) urmeaza validarea
  useEffect(() => {
    if (!designHelp) syncCompletion(ownProject);
  }, [designHelp, ownProject, syncCompletion]);

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

  const doPublish = async () => {
    if (!detailsComplete || !allRoomsComplete || preparing) return;

    // D-3D-4 (aprobat): snapshotul PNG al pieselor configurate 3D urca AUTOMAT
    // prin fluxul presigned existent (3.4) si intra in answers.snapshot3d.
    // Best-effort: un esec de upload nu blocheaza publicarea (step optional).
    const snapshotByRoom: Record<string, string[]> = {};
    setPreparing(true);
    try {
      for (const room of rooms) {
        const dataUrl = snapshots3d[room.localId];
        if (room.answers.config3d === undefined || !dataUrl) continue;
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `configurare-3d-${room.roomType.toLowerCase()}.png`, {
            type: 'image/png',
          });
          const att = await uploadAttachment.mutateAsync(file);
          snapshotByRoom[room.localId] = [att.id];
          // pastreaza id-ul si in store — o re-publicare nu mai urca inca o data
          setAnswer(room.localId, 'snapshot3d', [att.id]);
        } catch {
          // fara snapshot; cererea ramane valida
        }
      }
    } finally {
      setPreparing(false);
    }

    // bucket-ul derivat din estimarea RON — aceeasi regula ca serverul
    const budget = resolveBudgetFields(
      (details.budgetRange as BudgetRange | undefined) ?? 'UNDER_5K',
      details.budgetEstimateRon,
    );
    const payload: ConfiguratorContentInput = {
      description: details.description ?? '',
      budgetRange: budget.budgetRange,
      budgetEstimateRon: budget.budgetEstimateRon ?? undefined,
      deadlineBucket:
        (details.deadlineBucket as ConfiguratorContentInput['deadlineBucket']) || undefined,
      includesPaidDesign: details.includesPaidDesign ?? false,
      hasOwnProject: details.hasOwnProject ?? false,
      addressText: details.addressText!,
      county: details.county!,
      city: details.city!,
      country: details.country ?? 'RO',
      rooms: rooms.map((r) => ({
        sourceLocalId: r.localId,
        roomType: r.roomType,
        flowVersion: r.flowVersion,
        answers: snapshotByRoom[r.localId]
          ? { ...r.answers, snapshot3d: snapshotByRoom[r.localId] }
          : r.answers,
      })),
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
    publish.mutate(payload, { onSuccess: (req) => onPublished(req.id) });
  };

  const apiErr = publish.error ? publish.error instanceof ApiError ? publish.error.code : 'GENERIC' : null;
  const apiDetails = publish.error instanceof ApiError ? publish.error.details : undefined;
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
    let step: { titleKey: string } | undefined;
    try {
      step = stepId ? getFlow(room.roomType, room.flowVersion).steps.find((s) => s.id === stepId) : undefined;
    } catch {
      step = undefined;
    }
    if (step && t.has(step.titleKey)) return { stepLabel: t(step.titleKey), problem };
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
  const projectFiles = attachments.filter((attachment) => !referencedIds.has(attachment.id));

  // Overlay-ul ramane vizibil si dupa succes (isSuccess), pana la redirect:
  // publish-ul face geocoding pe server si poate dura cateva secunde.
  const publishing = preparing || publish.isPending || publish.isSuccess;

  const readyToPublish = detailsComplete && allRoomsComplete;

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
            <p className="max-w-xs text-sm text-muted-foreground">{t('review.publishingHint')}</p>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-serif text-2xl tracking-[-0.01em]">{t('review.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('review.subtitle')}</p>
      </div>

      <div>
        <div className="flex flex-col gap-5">
          {/* Detalii generale */}
          <ReviewFactsCard details={details} complete={detailsComplete} designHelp={designHelp} onEdit={onEditDetails} />

          {/* brief de proiectare: banner cu ce urmeaza dupa publicare */}
          {designHelp && <Alert tone="info">{t('review.designHelpBanner')}</Alert>}

          {/* Camere */}
          {rooms.map((room, i) => <ReviewRoomCard
            key={room.localId}
            room={room}
            attachments={attachments}
            designHelp={designHelp}
            onEdit={() => onEditRoom(i)}
            issue={roomIssues[i]?.issue ?? null}
            onFix={() => onEditRoom(i, roomIssues[i]?.stepId ?? undefined)}
          />)}

          {projectFiles.length > 0 && <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="font-serif text-xl">{t('review.filesTitle')}</h3>
            <div className="mt-3 flex flex-wrap gap-2">{projectFiles.map((attachment) => <AttachmentThumb key={attachment.id} attachment={attachment} />)}</div>
          </section>}

          <InspirationPicker blockedNoteIds={blockedNoteIds} />

          {apiErr && (
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

          {droppedContacts.length > 0 && (
            <Alert tone="info">
              {t('review.contactsAdjusted', { removed: droppedContacts.map((c) => c.value).join(', ') })}
            </Alert>
          )}

          {/* Poti completa cererea ca vizitator, dar publicarea necesita cont */}
          {!authed && !me.isPending && readyToPublish && (
            <Alert tone="info">{t('review.loginToPublishHint')}</Alert>
          )}
        </div>
      </div>

      <div>
        <div className="border-t border-ink/15 pt-4">
          {/* randul-sumar al comenzii — doar din datele deja existente */}
          {readyToPublish ? (
            <p className="font-mono text-meta leading-relaxed text-muted-2">
              {t('cart.totalRooms', { count: rooms.length })}
              {' — '}
              {rooms.map((r) => t(`rooms.type.${r.roomType}`)).join(', ')}
              {details.city ? ` · ${details.city}` : ''}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 text-ui text-amber">
              {!detailsComplete && <p>{t('review.detailsIncomplete')}</p>}
              {rooms.length === 0 && <p>{t('cart.totalRooms', { count: 0 })}</p>}
              {!designHelp &&
                rooms
                  .filter((_, i) => localIssues[i] !== null)
                  .map((r) => (
                    <p key={r.localId}>
                      {t(`rooms.type.${r.roomType}`)} — {t('review.roomIncomplete')}
                    </p>
                  ))}
            </div>
          )}

          <div className="mt-4 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('nav.back')}
            </Button>
            {authed ? (
              <Button
                type="button"
                variant="walnut"
                size="lg"
                disabled={!detailsComplete || !allRoomsComplete || publish.isPending || preparing}
                onClick={() => void doPublish()}
              >
                <Send className="mr-1 h-4 w-4" />
                {isEdit ? t('review.saveEdit') : tr('publish')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="walnut"
                size="lg"
                disabled={!detailsComplete || !allRoomsComplete || me.isPending}
                onClick={() => router.push('/login?redirect=/requests/new')}
              >
                <LogIn className="mr-1 h-4 w-4" />
                {t('review.loginToPublish')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
