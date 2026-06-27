'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, LoginInput, RegisterInput } from '@marketplace/shared';
import { api } from '@/lib/api';

const AUTH_KEY = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({
    queryKey: AUTH_KEY,
    queryFn: () => api<{ user: AuthUser }>('/auth/me').then((r) => r.user),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api<{ user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: ({ user }) => qc.setQueryData(AUTH_KEY, user),
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
  return useMutation({
    mutationFn: () => api<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.removeQueries({ queryKey: ['auth'] }),
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
