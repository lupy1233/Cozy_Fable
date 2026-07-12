'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationDto, UnreadCountDto } from '@marketplace/shared';
import { api } from '@/lib/api';

const KEY = ['notifications'] as const;

export function useNotifications() {
  return useQuery({ queryKey: [...KEY, 'list'], queryFn: () => api<NotificationDto[]>('/notifications'), retry: false });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: [...KEY, 'unread'],
    queryFn: () => api<UnreadCountDto>('/notifications/unread-count'),
    retry: false,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// Preferinta de emailuri de notificare (Q4, idee 5) — opt-out global.
export function useEmailPreference(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'email-preference'],
    queryFn: () => api<{ enabled: boolean }>('/notifications/email-preference'),
    enabled,
    retry: false,
  });
}

export function useSetEmailPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api<{ enabled: boolean }>('/notifications/email-preference', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: (data) => qc.setQueryData([...KEY, 'email-preference'], data),
  });
}
