'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminKpiDto,
  AuditLogPageDto,
  JobDto,
  PenaltyRuleDto,
  SettingDto,
} from '@marketplace/shared';
import { api } from '@/lib/api';

export interface AdminPlan {
  id: string; tier: string; priceRon: number; includedCredits: number; marketplaceGatingDelayMin: number; isActive: boolean;
}
export interface AdminCreditPackage { id: string; credits: number; priceRon: number; isActive: boolean }
export interface AdminThreshold { id: string; size: string; minScore: number; maxScore: number | null; creditCost: number }

export function useKpi() {
  return useQuery({ queryKey: ['admin', 'kpi'], queryFn: () => api<AdminKpiDto>('/admin/kpi'), retry: false });
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
  return useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api<AdminPlan[]>('/admin/plans'), retry: false });
}
// L0-B: `id` merge DOAR in URL — in body ar pica pe forbidNonWhitelisted (400 VALIDATION_ERROR).
export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Omit<AdminPlan, 'id'>>) =>
      api<AdminPlan>(`/admin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}

export function useAdminPackages() {
  return useQuery({ queryKey: ['admin', 'packages'], queryFn: () => api<AdminCreditPackage[]>('/admin/credit-packages'), retry: false });
}
export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Omit<AdminCreditPackage, 'id'>>) =>
      api<AdminCreditPackage>(`/admin/credit-packages/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'packages'] }),
  });
}

export function useAdminThresholds() {
  return useQuery({ queryKey: ['admin', 'thresholds'], queryFn: () => api<AdminThreshold[]>('/admin/thresholds'), retry: false });
}
export function useUpdateThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Omit<AdminThreshold, 'id'>>) =>
      api<AdminThreshold>(`/admin/thresholds/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
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
