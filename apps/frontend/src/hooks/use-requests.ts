'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { resolveAttachmentMime } from '@marketplace/shared';
import type {
  AnswerMap,
  AttachmentDto,
  BudgetEstimateDto,
  ClientDashboardStatsDto,
  ConfiguratorContentInput,
  PresignUploadInput,
  PresignUploadResultDto,
  RequestCoverageDto,
  RequestDraftCreatedDto,
  RequestDraftPatchInput,
  RequestDto,
  RequestListItemDto,
  RequestVisibilityDto,
  RoomType,
} from '@marketplace/shared';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import {
  blockedAttachmentId,
  rejection,
  rejectReasonFromError,
  splitFiles,
  type RejectedUpload,
  type UploadRejectReason,
} from '@/lib/attachment-upload';
import { waitForSafeUpload } from '@/lib/upload-scan';

const draftKey = (token: string) => ['request', 'draft', token] as const;
const MINE_KEY = ['requests', 'mine'] as const;

// Tinta operatiilor pe atasamente: draft (secret = token) sau cererea proprie
// (autentificat, dupa publish — editare de pe orice device).
export type AttachmentTarget =
  | { kind: 'draft'; token: string }
  | { kind: 'request'; id: string };

const attachmentsBase = (t: AttachmentTarget) =>
  t.kind === 'draft' ? `/requests/drafts/${t.token}/attachments` : `/requests/${t.id}/attachments`;

const targetQueryKey = (t: AttachmentTarget) =>
  t.kind === 'draft' ? draftKey(t.token) : (['request', t.id] as const);

// --- draft anonim cu token ---
export function useCreateDraft() {
  return useMutation({
    mutationFn: (patch: RequestDraftPatchInput = {}) =>
      api<RequestDraftCreatedDto>('/requests/drafts', {
        method: 'POST',
        body: JSON.stringify(patch),
      }),
  });
}

export function useDraft(token: string | null) {
  return useQuery({
    queryKey: draftKey(token ?? ''),
    queryFn: async () => withoutRemoved(await api<RequestDto>(`/requests/drafts/${token}`)),
    // doar cat e CIORNA: dupa publicare tokenul da 404, polling-ul ar pica
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'DRAFT' && data.attachments.some((a) => a.status === 'PENDING_SCAN') ? 2000 : false;
    },
    enabled: !!token,
    retry: false,
  });
}

export function usePatchDraft(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: RequestDraftPatchInput) =>
      api<RequestDto>(`/requests/drafts/${token}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    // b5: o salvare pornita inainte de „Elimină” nu readuce fisierul sters
    onSuccess: (data) => qc.setQueryData(draftKey(token), withoutRemoved(data)),
  });
}

// "Incepe o cerere noua": arunca ciorna abandonata de pe server (soft delete),
// ca sa nu se acumuleze cereri goale in cont (PO r5).
export function useDiscardDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<{ ok: true }>(`/requests/drafts/${token}`, { method: 'DELETE' }),
    onSuccess: (_data, token) => qc.removeQueries({ queryKey: draftKey(token) }),
  });
}

export function usePublishDraft(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: ConfiguratorContentInput) =>
      api<RequestDto>(`/requests/drafts/${token}/publish`, {
        method: 'POST',
        body: JSON.stringify(content),
      }),
    onSuccess: (data) => {
      qc.setQueryData(draftKey(token), data);
      // seed pentru pagina de detalii: redirectul de dupa publish randeaza
      // instant din cache in loc sa refaca fetch-ul complet
      qc.setQueryData(['request', data.id], data);
      qc.invalidateQueries({ queryKey: MINE_KEY });
      // E-admin-platform-8: statistica fara cookie-uri (no-op daca nu e configurata)
      track('request_published', document.documentElement.lang === 'en' ? 'en' : 'ro');
    },
  });
}

// Repost din contul proprietarului, de pe orice device (tokenul de draft moare la publicare).
export function useRepostRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<RequestDto>(`/requests/${id}/repost`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.setQueryData(['request', data.id], data);
      qc.invalidateQueries({ queryKey: MINE_KEY });
      qc.invalidateQueries({ queryKey: ['requests', 'dashboard-stats'] });
    },
  });
}

// --- atasamente: presign → PUT direct in storage → confirm (draft SAU cerere proprie) ---
export function useUploadAttachmentFor(target: AttachmentTarget) {
  const qc = useQueryClient();
  const base = attachmentsBase(target);
  return useMutation({
    mutationFn: async (file: File): Promise<AttachmentDto> => {
      // b5: pe Windows unele fisiere vin fara tip → MIME-ul din extensie (aceeasi lista ca serverul);
      // acelasi MIME la presign si la PUT, altfel confirmarea il respinge ca nepotrivit
      const mimeType = resolveAttachmentMime(file.name, file.type) ?? file.type;
      const input: PresignUploadInput = {
        filename: file.name,
        mimeType: mimeType as PresignUploadInput['mimeType'],
        sizeBytes: file.size,
      };
      const presign = await api<PresignUploadResultDto>(base, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: file,
      });
      if (!put.ok) throw new Error('upload failed');
      return waitForSafeUpload(() => api<AttachmentDto>(`${base}/${presign.attachmentId}/confirm`, { method: 'POST' }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: targetQueryKey(target) }),
  });
}

// b5 pas 5: id-urile sterse in sesiunea curenta. Un raspuns pornit inainte de stergere (salvarea
// ciornei, polling-ul de scanare) nu are voie sa readuca randul in lista. Id-urile sunt UUID-uri
// nerefolosite, deci setul doar creste (mic, cat tine pagina).
const removedAttachmentIds = new Set<string>();

function withoutRemoved<T extends { attachments: AttachmentDto[] } | undefined>(data: T): T {
  if (!data || removedAttachmentIds.size === 0) return data;
  if (!data.attachments.some((a) => removedAttachmentIds.has(a.id))) return data;
  return { ...data, attachments: data.attachments.filter((a) => !removedAttachmentIds.has(a.id)) };
}

export function useRemoveAttachmentFor(target: AttachmentTarget) {
  const qc = useQueryClient();
  const key = targetQueryKey(target);
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api<void>(`${attachmentsBase(target)}/${attachmentId}`, { method: 'DELETE' }),
    // randul dispare imediat; un fetch aflat pe drum e anulat ca sa nu readuca lista veche
    onMutate: async (attachmentId) => {
      removedAttachmentIds.add(attachmentId);
      await qc.cancelQueries({ queryKey: key, exact: true });
      const previous = qc.getQueryData<RequestDto>(key);
      if (previous) qc.setQueryData<RequestDto>(key, withoutRemoved(previous));
      return { previous };
    },
    onError: (_err, attachmentId, context) => {
      removedAttachmentIds.delete(attachmentId);
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key, exact: true }),
  });
}

// b5 pas 2-3: incarcare pe rand, fiecare fisier cu starea lui; refuzurile (locale si de la server)
// se aduna intr-o lista cu motiv, ca un fisier respins sa nu-l ascunda pe altul.
export interface PendingUpload {
  id: string;
  name: string;
}

export function useAttachmentUploadQueue(target: AttachmentTarget) {
  const upload = useUploadAttachmentFor(target);
  const remove = useRemoveAttachmentFor(target);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [rejected, setRejected] = useState<RejectedUpload[]>([]);

  // onUploaded se cheama dupa fiecare fisier reusit (ex. schita camerei isi adauga id-ul)
  const uploadFiles = async (
    files: readonly File[],
    slotsLeft: number,
    onUploaded?: (attachment: AttachmentDto) => void,
  ): Promise<void> => {
    const { accepted, rejected: local } = splitFiles(files, slotsLeft);
    if (local.length > 0) setRejected((list) => [...list, ...local]);
    const queue = accepted.map((file, i) => ({ file, id: `up-${Date.now()}-${i}-${file.name}` }));
    setPending((list) => [...list, ...queue.map(({ id, file }) => ({ id, name: file.name }))]);
    for (const item of queue) {
      try {
        const attachment = await upload.mutateAsync(item.file);
        onUploaded?.(attachment);
      } catch (err) {
        // fisierul respins la scanare nu mai ramane in lista si nu ocupa un loc
        const blockedId = blockedAttachmentId(err);
        if (blockedId) remove.mutate(blockedId);
        const reason = rejectReasonFromError(err);
        // PENDING: fisierul e salvat si apare in lista cu „se verifică...”, nu e un refuz
        if (reason !== 'PENDING') {
          const failed = rejection(item.file, reason);
          setRejected((list) => [...list, failed]);
        }
      } finally {
        setPending((list) => list.filter((p) => p.id !== item.id));
      }
    }
  };

  // refuzurile aflate deja in zona de incarcare (Dropzone validate)
  const reject = (items: readonly { file: File; reason: UploadRejectReason }[]) =>
    setRejected((list) => [...list, ...items.map(({ file, reason }) => rejection(file, reason))]);

  const dismiss = (id: string) => setRejected((list) => list.filter((r) => r.id !== id));

  // doar pentru erorile de retea (fisierul e pastrat in memorie)
  const retry = (id: string, slotsLeft: number, onUploaded?: (attachment: AttachmentDto) => void) => {
    const item = rejected.find((r) => r.id === id);
    if (!item?.file) return;
    dismiss(id);
    void uploadFiles([item.file], slotsLeft, onUploaded);
  };

  return { uploadFiles, reject, pending, rejected, dismiss, retry };
}

// Lista de atasamente a tintei (draft sau cerere), din query-ul potrivit.
export function useAttachmentsFor(target: AttachmentTarget): AttachmentDto[] {
  const draft = useDraft(target.kind === 'draft' ? target.token : null);
  const request = useRequest(target.kind === 'request' ? target.id : '');
  return (target.kind === 'draft' ? draft.data?.attachments : request.data?.attachments) ?? [];
}

// Aceeasi lista plus starea query-ului: curatarea referintelor la fisiere sterse
// (E-client-2) are voie sa ruleze doar pe o lista incarcata cu succes.
export function useAttachmentsStateFor(target: AttachmentTarget): {
  attachments: AttachmentDto[];
  isSuccess: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
} {
  const draft = useDraft(target.kind === 'draft' ? target.token : null);
  const request = useRequest(target.kind === 'request' ? target.id : '');
  const query = target.kind === 'draft' ? draft : request;
  return {
    attachments: query.data?.attachments ?? [],
    isSuccess: query.isSuccess,
    isFetching: query.isFetching,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

// Estimarea de buget din scorul camerelor (F5, item 18) — cheia de query e
// continutul camerelor: se recalculeaza doar cand raspunsurile chiar se schimba.
type EstimateRoom = { roomType: RoomType; flowVersion: number; answers: AnswerMap; needsDesignHelp?: boolean; approxLengthM?: number };

// b8: bifa de ajutor pe camera calatoreste doar cand e pusa (cheia de query ramane stabila);
// d3: la fel lungimea aproximativa (proiect propriu)
export function budgetEstimatePayload(rooms: EstimateRoom[]) {
  return rooms.map((r) => ({
    roomType: r.roomType,
    flowVersion: r.flowVersion,
    answers: r.answers,
    ...(r.needsDesignHelp ? { needsDesignHelp: true } : {}),
    ...(typeof r.approxLengthM === 'number' ? { approxLengthM: r.approxLengthM } : {}),
  }));
}

export function useBudgetEstimate(rooms: EstimateRoom[]) {
  const payload = budgetEstimatePayload(rooms);
  const key = JSON.stringify(payload);
  return useQuery({
    queryKey: ['requests', 'estimate', key],
    queryFn: () =>
      api<BudgetEstimateDto>('/requests/estimate', {
        method: 'POST',
        body: JSON.stringify({ rooms: payload }),
      }),
    enabled: rooms.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// Î17 — clientul sterge cererea (soft delete + anulare claim-uri + refund).
export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MINE_KEY }),
  });
}

// --- liste client autenticat ---
export function useMyRequests() {
  return useQuery({
    queryKey: MINE_KEY,
    queryFn: () => api<RequestListItemDto[]>('/requests'),
    retry: false,
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: async () => withoutRemoved(await api<RequestDto>(`/requests/${id}`)),
    refetchInterval: (query) => query.state.data?.attachments.some((a) => a.status === 'PENDING_SCAN') ? 2000 : false,
    enabled: !!id,
  });
}

// E-client-9: cardul "Cine vede cererea". Cheia sub ['request', id] → invalidarile existente
// ale cererii (claim, retragere, accept, socket) o reincarca automat.
export function useRequestVisibility(id: string, enabled = true) {
  return useQuery({
    queryKey: ['request', id, 'visibility'],
    queryFn: () => api<RequestVisibilityDto>(`/requests/${id}/visibility`),
    enabled: !!id && enabled,
    staleTime: 30_000,
  });
}

// a6 — Sumar: exista vreo firma in zona adresei ciornei? (COVERED / NONE / UNKNOWN, niciodata un
// numar). Se intreaba doar cand adresa e completa (aceleasi minime ca la publicare); cheia e
// adresa, deci o adresa noua inseamna o intrebare noua. Eroarea / limita de apeluri → fara date.
export function useDraftCoverage(
  token: string | null,
  address: { addressText?: string | null; city?: string | null; county?: string | null; country?: string | null },
) {
  const addressText = address.addressText?.trim() ?? '';
  const city = address.city?.trim() ?? '';
  const county = address.county?.trim() ?? '';
  const country = address.country?.trim() || undefined;
  const complete = addressText.length >= 3 && city.length >= 2 && county.length >= 2;
  return useQuery({
    queryKey: ['requests', 'draft-coverage', token ?? '', addressText, city, county, country ?? ''],
    queryFn: async () =>
      (await api<RequestCoverageDto>(`/requests/drafts/${token}/coverage`, {
        method: 'POST',
        body: JSON.stringify({ addressText, city, county, ...(country ? { country } : {}) }),
      })) ?? null,
    enabled: !!token && complete,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

// Statistici pentru dashboardul clientului.
export function useClientDashboardStats(enabled = true) {
  return useQuery({
    queryKey: ['requests', 'dashboard-stats'],
    queryFn: () => api<ClientDashboardStatsDto>('/requests/dashboard-stats'),
    enabled,
    staleTime: 30_000,
  });
}

// Editare autentificata a cererii proprii (orice device, fara token de draft).
export function useEditRequestById(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: ConfiguratorContentInput) =>
      api<RequestDto>(`/requests/${id}/edit`, {
        method: 'POST',
        body: JSON.stringify(content),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['request', id], data);
      qc.invalidateQueries({ queryKey: MINE_KEY });
      qc.invalidateQueries({ queryKey: ['requests', 'dashboard-stats'] });
    },
  });
}
