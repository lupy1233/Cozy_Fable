'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminCalendarDto,
  AdminContactDetectionPageDto,
  AdminCreditPackageDto,
  AdminKpiDto,
  AdminPlanDto,
  AdminThresholdDto,
  CalendarCheckDto,
  CreatePlanInput,
  CalendarHolidayDto,
  CreateCalendarHolidayInput,
  SizingPreviewDto,
  SizingWeightChangesInput,
  SizingWeightDto,
  SizingWeightsUpdateResultDto,
  UpdateCalendarHolidayInput,
  AdminMailTestResultDto,
  AdminRequestDetailDto,
  AdminRequestFilter,
  AdminRequestListPageDto,
  AdminUserItemDto,
  CloseProjectInput,
  DismissProjectCaseInput,
  ProjectCaseDto,
  AuditLogPageDto,
  JobDto,
  PenaltyRuleDto,
  SettingDto,
  UpdatePlanInput,
  UpdateThresholdInput,
  UpsertCreditPackageInput,
} from '@marketplace/shared';
import { api } from '@/lib/api';

// E-admin-platform-58: tipurile vin din shared (AdminPlanDto / AdminCreditPackageDto / AdminThresholdDto)
export type AdminPlan = AdminPlanDto;
export type AdminCreditPackage = AdminCreditPackageDto;
export type AdminThreshold = AdminThresholdDto;

export function useKpi() {
  return useQuery({ queryKey: ['admin', 'kpi'], queryFn: () => api<AdminKpiDto>('/admin/kpi'), retry: false });
}

// --- utilizatori (pasul 6, D-L1-2) ---
export function useAdminUsers(q: string, role?: string) {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set('q', q.trim());
  if (role) qs.set('role', role);
  return useQuery({
    queryKey: ['admin', 'users', q.trim(), role ?? 'ALL'],
    queryFn: () => api<AdminUserItemDto[]>(`/admin/users${qs.size ? `?${qs.toString()}` : ''}`),
    retry: false,
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; block: boolean }) =>
      api<AdminUserItemDto>(`/admin/users/${input.id}/${input.block ? 'block' : 'unblock'}`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useAuditLogs(page: number, filters: { action?: string; entityType?: string } = {}) {
  const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (filters.action) qs.set('action', filters.action);
  if (filters.entityType) qs.set('entityType', filters.entityType);
  return useQuery({
    queryKey: ['admin', 'audit', page, filters],
    queryFn: () => api<AuditLogPageDto>(`/admin/audit-logs?${qs.toString()}`),
    retry: false,
  });
}

// E-admin-platform-45: date de contact detectate in texte libere (lista read-only)
export function useContactDetections(page: number) {
  const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
  return useQuery({
    queryKey: ['admin', 'contact-detections', page],
    queryFn: () => api<AdminContactDetectionPageDto>(`/admin/contact-detections?${qs.toString()}`),
    retry: false,
  });
}

export function useSettings() {
  return useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<SettingDto[]>('/admin/settings'), retry: false });
}
export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { key: string; value: string }) =>
      api<SettingDto>(`/admin/settings/${v.key}`, { method: 'PUT', body: JSON.stringify({ value: v.value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}

export function usePenaltyRules() {
  return useQuery({ queryKey: ['admin', 'penalty-rules'], queryFn: () => api<PenaltyRuleDto[]>('/admin/penalty-rules'), retry: false });
}
export function useUpdatePenaltyRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; points?: number; isActive?: boolean }) =>
      api<PenaltyRuleDto>(`/admin/penalty-rules/${v.id}`, { method: 'PATCH', body: JSON.stringify({ points: v.points, isActive: v.isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'penalty-rules'] }),
  });
}

export function useAdminPlans() {
  return useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api<AdminPlanDto[]>('/admin/plans'), retry: false });
}
// E-admin-platform-58: plan nou (cod unic → 409 PLAN_CODE_TAKEN)
export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePlanInput) =>
      api<AdminPlanDto>('/admin/plans', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}
// L0-B: `id` merge DOAR in URL — in body ar pica pe forbidNonWhitelisted (400 VALIDATION_ERROR).
export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdatePlanInput) =>
      api<AdminPlanDto>(`/admin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}

export function useAdminPackages() {
  return useQuery({ queryKey: ['admin', 'packages'], queryFn: () => api<AdminCreditPackageDto[]>('/admin/credit-packages'), retry: false });
}
export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<UpsertCreditPackageInput>) =>
      api<AdminCreditPackageDto>(`/admin/credit-packages/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'packages'] }),
  });
}

export function useAdminThresholds() {
  return useQuery({ queryKey: ['admin', 'thresholds'], queryFn: () => api<AdminThresholdDto[]>('/admin/thresholds'), retry: false });
}
export function useUpdateThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateThresholdInput) =>
      api<AdminThresholdDto>(`/admin/thresholds/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'thresholds'] }),
  });
}

export function useAdminJobs() {
  return useQuery({ queryKey: ['admin', 'jobs'], queryFn: () => api<JobDto[]>('/admin/jobs'), retry: false });
}
export function useRetryJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { queue: string; id: string }) =>
      api<{ ok: true }>(`/admin/jobs/${v.queue}/${v.id}/retry`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'jobs'] }),
  });
}

// --- E-admin-platform-3: proiecte acceptate (/admin/requests) ---
export function useAdminRequests(filter: AdminRequestFilter, page: number) {
  return useQuery({
    queryKey: ['admin', 'requests', filter, page],
    queryFn: () => api<AdminRequestListPageDto>(`/admin/requests?filter=${filter}&page=${page}`),
    retry: false,
  });
}

export function useAdminRequest(id: string) {
  return useQuery({
    queryKey: ['admin', 'requests', 'detail', id],
    queryFn: () => api<AdminRequestDetailDto>(`/admin/requests/${id}`),
    enabled: !!id,
    retry: false,
  });
}

export function useCloseProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CloseProjectInput) =>
      api<AdminRequestDetailDto>(`/admin/requests/${id}/close`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'requests'] }),
  });
}

export function useDismissProjectCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & DismissProjectCaseInput) =>
      api<ProjectCaseDto>(`/admin/project-cases/${id}/dismiss`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'requests'] }),
  });
}

// --- email tranzactional (E-admin-platform-1): test catre adresa adminului curent ---
export function useSendTestEmail() {
  return useMutation({
    mutationFn: () => api<AdminMailTestResultDto>('/admin/mail/test', { method: 'POST' }),
  });
}

// --- tracker de erori (E-admin-platform-8): 500 intentionat, capturat de tracker ---
// GET fara efecte (merge si pe slotul standby); raspunsul asteptat e INTOTDEAUNA o eroare.
export function useMonitoringTestError() {
  return useMutation({
    mutationFn: () => api<never>('/admin/monitoring/test-error'),
  });
}

// --- E-admin-platform-25: calendarul de lucru (sarbatori mobile + punti) ---
export function useAdminCalendar(year: number) {
  return useQuery({
    queryKey: ['admin', 'calendar', year],
    queryFn: () => api<AdminCalendarDto>(`/admin/calendar?year=${year}`),
    retry: false,
  });
}

export function useCalendarCheck(from: string, workingDays: number) {
  return useQuery({
    queryKey: ['admin', 'calendar', 'check', from, workingDays],
    queryFn: () =>
      api<CalendarCheckDto>(`/admin/calendar/check?${new URLSearchParams({ from, workingDays: String(workingDays) }).toString()}`),
    enabled: !!from,
    retry: false,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCalendarHolidayInput) =>
      api<CalendarHolidayDto>('/admin/calendar', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'calendar'] }),
  });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateCalendarHolidayInput) =>
      api<CalendarHolidayDto>(`/admin/calendar/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'calendar'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ id: string; ok: true }>(`/admin/calendar/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'calendar'] }),
  });
}

// --- E-admin-platform-25: punctele optiunilor (Marime proiect) ---
export function useSizingWeights() {
  return useQuery({
    queryKey: ['admin', 'sizing', 'weights'],
    queryFn: () => api<SizingWeightDto[]>('/admin/sizing/weights'),
    retry: false,
  });
}

export function usePreviewSizing() {
  return useMutation({
    mutationFn: (input: SizingWeightChangesInput) =>
      api<SizingPreviewDto>('/admin/sizing/preview', { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function useUpdateSizingWeights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SizingWeightChangesInput) =>
      api<SizingWeightsUpdateResultDto>('/admin/sizing/weights', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sizing'] }),
  });
}
