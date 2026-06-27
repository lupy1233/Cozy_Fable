'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttachmentDto,
  ChatThreadDto,
  MessageDto,
  PresignUploadInput,
  PresignUploadResultDto,
  SendMessageInput,
} from '@marketplace/shared';
import { api } from '@/lib/api';

export type ChatMode = 'client' | 'company';

// Client → /chat/*, firma → /company/chat/* (acelasi serviciu, guard diferit).
const prefix = (mode: ChatMode) => (mode === 'client' ? '/chat' : '/company/chat');
const THREADS_KEY = (mode: ChatMode) => ['chat', 'threads', mode] as const;
const MESSAGES_KEY = (threadId: string) => ['chat', 'messages', threadId] as const;

export function useThreads(mode: ChatMode) {
  return useQuery({
    queryKey: THREADS_KEY(mode),
    queryFn: () => api<ChatThreadDto[]>(`${prefix(mode)}/threads`),
    retry: false,
  });
}

export function useMessages(threadId: string, mode: ChatMode) {
  return useQuery({
    queryKey: MESSAGES_KEY(threadId),
    queryFn: () => api<MessageDto[]>(`${prefix(mode)}/threads/${threadId}/messages`),
    enabled: !!threadId,
    retry: false,
  });
}

export function useSendMessage(threadId: string, mode: ChatMode) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessageInput) =>
      api<MessageDto>(`${prefix(mode)}/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MESSAGES_KEY(threadId) }),
  });
}

// Upload in chat: presign → PUT direct in storage → confirm (3.4). Returneaza attachmentId.
export function useUploadChatAttachment(threadId: string, mode: ChatMode) {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const input: PresignUploadInput = {
        filename: file.name,
        mimeType: file.type as PresignUploadInput['mimeType'],
        sizeBytes: file.size,
      };
      const presign = await api<PresignUploadResultDto>(
        `${prefix(mode)}/threads/${threadId}/attachments`,
        { method: 'POST', body: JSON.stringify(input) },
      );
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('upload failed');
      await api<AttachmentDto>(
        `${prefix(mode)}/threads/${threadId}/attachments/${presign.attachmentId}/confirm`,
        { method: 'POST' },
      );
      return presign.attachmentId;
    },
  });
}
