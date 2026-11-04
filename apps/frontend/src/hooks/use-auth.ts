'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, LoginInput, RegisterInput } from '@marketplace/shared';
import { api, ApiError } from '@/lib/api';
import { adoptLocalOwner, clearUserLocalData, forgetLocalOwner } from '@/lib/session-cleanup';
import { useSessionHint, useSetSessionHint } from '@/lib/session-hint-context';

const AUTH_KEY = ['auth', 'me'] as const;

// SEC2-11 (E-admin-platform-5): fara cookie-uri de sesiune serverul raspunde 200 { user: null },
// deci vizitatorul anonim nu mai declanseaza un /auth/refresh esuat. Transformam null intr-un
// ApiError 401 local ca garzile existente (me.isError → /login) sa ramana neschimbate.
export async function fetchMe(): Promise<AuthUser> {
  const { user } = await api<{ user: AuthUser | null }>('/auth/me');
  if (!user) throw new ApiError('UNAUTHORIZED', 401, 'No session');
  return user;
}

export function useMe() {
  return useQuery({
    queryKey: AUTH_KEY,
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });
}

// Rolul pentru randarea headerului: cat useMe e pending, indiciul venit de pe server; dupa
// eroare (401) nu mai exista rol, deci nici navigatie.
export function useSessionRole() {
  const me = useMe();
  const hint = useSessionHint();
  return {
    role: me.data?.role ?? (me.isPending ? hint : null),
    user: me.data ?? null,
    pending: me.isPending,
  };
}

export function useLogin() {
  const qc = useQueryClient();
  const setHint = useSetSessionHint();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api<{ user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    // alt cont logat anterior in acest browser → curatenie INAINTE de setarea noului user
    onSuccess: ({ user }) => {
      void adoptLocalOwner(qc, user.id);
      qc.setQueryData(AUTH_KEY, user);
      setHint(user.role);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api<{ user: AuthUser }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...input, phone: input.phone || undefined }),
      }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const setHint = useSetSessionHint();
  return useMutation({
    mutationFn: () => api<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
    // onSettled: si un logout esuat pe un calculator partajat sterge datele locale.
    // qc.clear acopera si ['auth']; guard-urile redirectioneaza pe me.isError (401).
    onSettled: () => {
      void clearUserLocalData(qc);
      forgetLocalOwner();
      // altfel, dupa qc.clear(), me redevine pending si indiciul vechi ar reaparea o clipa
      setHint(null);
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) =>
      api<{ verified: boolean }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  });
}

// L0-A — retrimitere confirmare / parola uitata / resetare / schimbare parola.
// Serverul raspunde uniform la resend + forgot (anti-enumerare).

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ sent: boolean }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ sent: boolean }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api<{ reset: boolean }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api<{ changed: boolean }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}
