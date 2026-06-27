'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminCompanyListItemDto,
  CompanyDto,
  CompanyLocationInput,
  CompanyMemberInviteInput,
  CompanyMemberRoleInput,
  CompanyOnboardingInput,
  CompanyProfileUpdateInput,
  OfferFieldPermissionsUpdateInput,
  PortfolioItemInput,
} from '@marketplace/shared';
import { api } from '@/lib/api';

const MY_COMPANY_KEY = ['company', 'me'] as const;
const ADMIN_LIST_KEY = ['admin', 'companies'] as const;

// --- Firma proprie ---
export function useMyCompany() {
  return useQuery({
    queryKey: MY_COMPANY_KEY,
    queryFn: () => api<CompanyDto>('/companies/me'),
    retry: false,
    staleTime: 30_000,
  });
}

// Mutatie generica ce returneaza CompanyDto si actualizeaza cache-ul firmei
function useCompanyMutation<TInput>(fn: (input: TInput) => Promise<CompanyDto>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (company) => qc.setQueryData(MY_COMPANY_KEY, company),
  });
}

export function useOnboardCompany() {
  return useCompanyMutation((input: CompanyOnboardingInput) =>
    api<CompanyDto>('/companies', { method: 'POST', body: JSON.stringify(input) }),
  );
}

export function useUpdateCompany() {
  return useCompanyMutation((input: CompanyProfileUpdateInput) =>
    api<CompanyDto>('/companies/me', { method: 'PATCH', body: JSON.stringify(input) }),
  );
}

export function useAddLocation() {
  return useCompanyMutation((input: CompanyLocationInput) =>
    api<CompanyDto>('/companies/me/locations', { method: 'POST', body: JSON.stringify(input) }),
  );
}

export function useUpdateLocation() {
  return useCompanyMutation((input: CompanyLocationInput & { id: string }) =>
    api<CompanyDto>(`/companies/me/locations/${input.id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
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
  return useCompanyMutation((input: PortfolioItemInput) =>
    api<CompanyDto>('/companies/me/portfolio', { method: 'POST', body: JSON.stringify(input) }),
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
