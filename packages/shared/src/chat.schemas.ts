import { z } from 'zod';
import type { AttachmentDto } from './request.schemas';

// Sprint 6 — chat post-claim (4.14). Thread auto-creat la claim; mesajele vin acum.
// Upload in chat conform flow-ului presigned din 3.4 (entity_type='MESSAGE', max 5 fisiere).

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

// Trimitere mesaj. body sau cel putin un atasament (validat in service).
export const sendMessageSchema = z.object({
  body: z.string().trim().max(5000).optional().or(z.literal('')),
  attachmentIds: z.array(z.string().uuid()).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// --- DTO-uri raspuns ---

export interface MessageDto {
  id: string;
  chatThreadId: string;
  senderUserId: string;
  senderName: string;
  isMine: boolean;
  body: string | null;
  attachments: AttachmentDto[];
  createdAt: string;
}

export interface ChatThreadDto {
  id: string;
  claimSlotId: string;
  requestId: string;
  requestTitle: string;
  companyId: string;
  companyName: string;
  // read-only daca: oferta altei firme acceptata (4.14) sau negociere incheiata online (D3).
  readOnly: boolean;
  negotiationEndedByCompany: boolean;
  // starea claim-ului firmei (parcursul cererii per firma — item 4)
  claimStatus: string;
  // ultimul mesaj din conversatie (preview in lista clientului); null = fara mesaje
  lastMessage: {
    body: string | null;
    senderRole: 'CLIENT' | 'COMPANY';
    createdAt: string;
  } | null;
  createdAt: string;
}
