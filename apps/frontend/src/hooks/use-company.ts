'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminCompanyListItemDto,
  CompanyDashboardStatsDto,
  CompanyDto,
  PartnerDto,
  CompanyLocationInput,
  CompanyMemberInviteInput,
  CompanyMemberRoleInput,
  CompanyOnboardingInput,
  CompanyProfileUpdateInput,
  OfferFieldPermissionsUpdateInput,
  AttachmentDto,
  PresignUploadResultDto,
} from '@marketplace/shared';
import { resolveAttachmentMime } from '@marketplace/shared';
import { api } from '@/lib/api';
import { waitForSafeUpload } from '@/lib/upload-scan';

// h1 (etapa 11): coordonatele locatiei le completeaza serverul din adresa (invarianta 3.8),
// deci interfata nu le mai trimite.
export type CompanyLocationWriteInput = Omit<CompanyLocationInput, 'lat' | 'lng'>;
// h1 (revizuire m6): raspunsul la adaugarea / modificarea locatiei — CITY = adresa exacta nu
// s-a gasit, s-a folosit centrul orasului (nota neblocanta in interfata)
export type LocationWriteResult = CompanyDto & { geocodePrecision?: 'CITY' };
// h1: poza lucrarii = o incarcare a firmei (attachmentId), nu o adresa scrisa de om
export interface PortfolioItemWriteInput {
  title: string;
  description?: string;
  attachmentId?: string;
}

const MY_COMPANY_KEY = ['company', 'me'] as const;
const ADMIN_LIST_KEY = ['admin', 'companies'] as const;
const DASHBOARD_STATS_KEY = ['company', 'dashboard-stats'] as const;

// --- Firma proprie ---
export function useMyCompany(enabled = true) {
  return useQuery({
    queryKey: MY_COMPANY_KEY,
    queryFn: () => api<CompanyDto>('/companies/me'),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

// Lista publica de parteneri (landing /partners; fara autentificare).
export function usePartners() {
  return useQuery({
    queryKey: ['companies', 'partners'],
    queryFn: () => api<PartnerDto[]>('/companies/partners'),
    staleTime: 60_000,
    // h1 (revizuire m10): legaturile presemnate ale pozelor expira la 5 minute → datele se
    // reimprospateaza la 4, ca pozele incarcate tarziu (lazy) sa nu cada pe rezerva
    refetchInterval: 4 * 60_000,
  });
}

// Statistici pentru dashboardul firmei.
export function useCompanyDashboardStats(enabled = true) {
  return useQuery({
    queryKey: ['company', 'dashboard-stats'],
    queryFn: () => api<CompanyDashboardStatsDto>('/companies/me/dashboard-stats'),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

// Mutatie generica ce returneaza CompanyDto si actualizeaza cache-ul firmei
function useCompanyMutation<TInput, TResult extends CompanyDto = CompanyDto>(fn: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (company) => {
      qc.setQueryData(MY_COMPANY_KEY, company);
      // h1: cardul „Pregătește-ți firma” de pe panou (dashboard-stats.setup) se actualizeaza pe loc
      qc.invalidateQueries({ queryKey: DASHBOARD_STATS_KEY });
    },
  });
}

export function useOnboardCompany() {
  return useCompanyMutation((input: CompanyOnboardingInput) =>
    api<CompanyDto>('/companies', { method: 'POST', body: JSON.stringify(input) }),
  );
}

// PATCH /companies/me (OWNER/MANAGER) — E-company-24: si emailul de facturare
export function useUpdateCompanyProfile() {
  return useCompanyMutation((input: CompanyProfileUpdateInput) =>
    api<CompanyDto>('/companies/me', { method: 'PATCH', body: JSON.stringify(input) }),
  );
}

export function useAddLocation() {
  return useCompanyMutation((input: CompanyLocationWriteInput) =>
    api<LocationWriteResult>('/companies/me/locations', { method: 'POST', body: JSON.stringify(input) }),
  );
}

// h1: modificarea existenta de pe server (PUT) — adresa si raza
export function useUpdateLocation() {
  return useCompanyMutation(({ id, ...input }: CompanyLocationWriteInput & { id: string }) =>
    api<LocationWriteResult>(`/companies/me/locations/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  );
}

export function useDeleteLocation() {
  return useCompanyMutation((id: string) =>
    api<CompanyDto>(`/companies/me/locations/${id}`, { method: 'DELETE' }),
  );
}

export function useAddMember() {
  return useCompanyMutation((input: CompanyMemberInviteInput) =>
    api<CompanyDto>('/companies/me/members', { method: 'POST', body: JSON.stringify(input) }),
  );
}

export function useChangeMemberRole() {
  return useCompanyMutation((input: CompanyMemberRoleInput & { id: string }) =>
    api<CompanyDto>(`/companies/me/members/${input.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: input.role }),
    }),
  );
}

export function useRemoveMember() {
  return useCompanyMutation((id: string) =>
    api<CompanyDto>(`/companies/me/members/${id}`, { method: 'DELETE' }),
  );
}

export function useAddPortfolioItem() {
  return useCompanyMutation((input: PortfolioItemWriteInput) =>
    api<CompanyDto>('/companies/me/portfolio', { method: 'POST', body: JSON.stringify(input) }),
  );
}

// h1: poza lucrarii — presign → PUT direct in storage → confirm pana la SAFE (invarianta 3.4).
// Intoarce id-ul incarcarii, care se ataseaza apoi lucrarii (adaugare sau inlocuire).
// h1 (revizuire m4): `resumeAttachmentId` = fisierul e deja urcat (reincercare dupa o verificare
// care a durat prea mult sau dupa o atasare picata) → doar se reconfirma, fara un nou PUT.
// `onUploaded` primeste id-ul imediat dupa PUT, ca apelantul sa-l pastreze pentru reincercare.
export interface PortfolioImageUploadInput {
  file: File;
  resumeAttachmentId?: string;
  onUploaded?: (attachmentId: string) => void;
}

export function useUploadPortfolioImage() {
  return useMutation({
    mutationFn: async ({ file, resumeAttachmentId, onUploaded }: PortfolioImageUploadInput): Promise<string> => {
      let attachmentId = resumeAttachmentId;
      if (!attachmentId) {
        // acelasi MIME la presign si la PUT (b5: fisierele fara tip iau MIME-ul din extensie)
        const mimeType = resolveAttachmentMime(file.name, file.type) ?? file.type;
        const presign = await api<PresignUploadResultDto>('/companies/me/portfolio/images', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, mimeType, sizeBytes: file.size }),
        });
        const put = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType },
          body: file,
        });
        if (!put.ok) throw new Error('upload failed');
        attachmentId = presign.attachmentId;
        onUploaded?.(attachmentId);
      }
      const id = attachmentId;
      await waitForSafeUpload(() =>
        api<AttachmentDto>(`/companies/me/portfolio/images/${id}/confirm`, { method: 'POST' }),
      );
      return id;
    },
  });
}

export function useSetPortfolioImage() {
  return useCompanyMutation(({ id, attachmentId }: { id: string; attachmentId: string }) =>
    api<CompanyDto>(`/companies/me/portfolio/${id}/image`, {
      method: 'PUT',
      body: JSON.stringify({ attachmentId }),
    }),
  );
}

export function useDeletePortfolioItem() {
  return useCompanyMutation((id: string) =>
    api<CompanyDto>(`/companies/me/portfolio/${id}`, { method: 'DELETE' }),
  );
}

export function useUpdateOfferPermissions() {
  return useCompanyMutation((input: OfferFieldPermissionsUpdateInput) =>
    api<CompanyDto>('/companies/me/offer-permissions', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  );
}

// --- Admin ---
export function useAdminCompanies(status?: string) {
  return useQuery({
    queryKey: [...ADMIN_LIST_KEY, status ?? 'ALL'],
    queryFn: () =>
      api<AdminCompanyListItemDto[]>(
        `/admin/companies${status ? `?status=${status}` : ''}`,
      ),
  });
}

export function useAdminCompany(id: string) {
  return useQuery({
    queryKey: ['admin', 'companies', 'detail', id],
    queryFn: () => api<CompanyDto & { riskFlags: string[] }>(`/admin/companies/${id}`),
    enabled: !!id,
  });
}

export function useApproveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ id: string; status: string }>(`/admin/companies/${id}/approve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_LIST_KEY }),
  });
}

export function useRejectCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      api<{ id: string; status: string }>(`/admin/companies/${input.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: input.reason }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_LIST_KEY }),
  });
}

// Pasul 5 (audit 2026-08-23, F2): ridicarea suspendarii de catre admin.
export function useUnsuspendCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ id: string; status: string }>(`/admin/companies/${id}/unsuspend`, { method: 'POST' }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ADMIN_LIST_KEY });
      qc.invalidateQueries({ queryKey: ['admin', 'companies', 'detail', id] });
    },
  });
}
