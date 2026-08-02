import { z } from 'zod';
import type { RequestStudioSceneDto } from './studio.schemas';
import {
  CONSULTATION_INVITE_STATUSES,
  CURRENCIES,
  QUOTE_CHANGE_REQUEST_STATUSES,
  QUOTE_STATUSES,
} from './enums';
import type {
  AttachmentDto,
  ContactPreferenceDto,
  RequestRoomDto,
} from './request.schemas';

// Sprint 6 — ofertare structurata (4.13 / D3 / D4 / D-v6-7 / D-v6-8 / D-v6-11 / D-v6-12).

// Limite business (4.13).
export const MAX_QUOTE_VERSIONS = 3; // v1 + 2 versiuni declansate de change request
export const MAX_VALIDITY_EXTENSIONS = 2; // Buton A: max 2 × N zile
export const MAX_ATTACHMENTS_PER_QUOTE = 5; // invarianta 3.4

// Campurile editabile ale unei oferte = offer field_key (matrice permisiuni 4.13).
const offerFieldsSchema = z.object({
  price: z.number().positive('priceInvalid').max(100_000_000),
  // design_fee apare doar daca cererea are includes_paid_design (D-v6-11); validat in service.
  designFee: z.number().positive('designFeeInvalid').max(100_000_000).optional(),
  deliveryTerm: z.string().trim().max(200).optional().or(z.literal('')),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')
    .optional()
    .or(z.literal('')),
  warranty: z.string().trim().max(500).optional().or(z.literal('')),
  description: z.string().trim().min(1, 'descriptionRequired').max(5000),
  // Defalcarea pe camere (F7, item 22): optionala; daca exista, serviciul cere
  // sa acopere TOATE camerele cererii si suma sa egaleze price.
  roomPrices: z
    .array(
      z.object({
        requestRoomId: z.string().uuid(),
        price: z.number().positive('priceInvalid').max(100_000_000),
      }),
    )
    .max(50)
    .optional(),
});

// Trimiterea ofertei initiale (v1) pentru un claim slot. POST /quotes (Idempotency-Key, 3.2).
export const createQuoteSchema = offerFieldsSchema.extend({
  claimSlotId: z.string().uuid(),
  currency: z.enum(CURRENCIES).optional(),
  // Firma poate seta explicit valabilitatea; altfel default quote_validity_default_days (14).
  validityDays: z.number().int().positive().max(365).optional(),
  attachmentIds: z.array(z.string().uuid()).max(MAX_ATTACHMENTS_PER_QUOTE).optional(),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

// Versiune noua ca raspuns la o cerere de modificare (4.13). Consuma slot (v2/v3).
export const reviseQuoteSchema = offerFieldsSchema.extend({
  changeRequestId: z.string().uuid(),
  validityDays: z.number().int().positive().max(365).optional(),
  attachmentIds: z.array(z.string().uuid()).max(MAX_ATTACHMENTS_PER_QUOTE).optional(),
});
export type ReviseQuoteInput = z.infer<typeof reviseQuoteSchema>;

// A 4-a varianta voluntara, peste limita de 3 (block UI, optiunea a) — extra_versions_count++.
export const extraQuoteVersionSchema = offerFieldsSchema.extend({
  validityDays: z.number().int().positive().max(365).optional(),
  attachmentIds: z.array(z.string().uuid()).max(MAX_ATTACHMENTS_PER_QUOTE).optional(),
});
export type ExtraQuoteVersionInput = z.infer<typeof extraQuoteVersionSchema>;

// Clientul cere o modificare pe o versiune de oferta (declanseaza eventual v2/v3).
export const requestQuoteChangeSchema = z.object({
  quoteVersionId: z.string().uuid(),
  requestedText: z.string().trim().min(3, 'changeTextTooShort').max(2000),
});
export type RequestQuoteChangeInput = z.infer<typeof requestQuoteChangeSchema>;

// Firma refuza modificarea (nu consuma slot; clientul nu mai poate cere aceeasi).
export const rejectQuoteChangeSchema = z.object({
  changeRequestId: z.string().uuid(),
});
export type RejectQuoteChangeInput = z.infer<typeof rejectQuoteChangeSchema>;

// Buton A reofertare: extinde valabilitatea (nu versiune noua, nu consuma slot; max 2 × N zile).
// Backend-ul extinde ultima versiune a ofertei; quoteVersionId e optional (informativ).
export const extendValiditySchema = z.object({
  quoteVersionId: z.string().uuid().optional(),
  days: z.number().int().positive().max(60).optional(),
});
export type ExtendValidityInput = z.infer<typeof extendValiditySchema>;

// Firma incheie negocierea online (chat read-only pentru ambii; D3).
export const endNegotiationSchema = z.object({});
export type EndNegotiationInput = z.infer<typeof endNegotiationSchema>;

// Invitatie la sediu pentru consultanta fizica (block dupa v3; D-v6-8).
export const createConsultationInviteSchema = z.object({
  locationAddress: z.string().trim().min(3, 'addressTooShort').max(300),
  proposedDatetime: z.string().datetime({ message: 'invalidDatetime' }),
  alternativeDatetimes: z.array(z.string().datetime()).max(5).optional(),
});
export type CreateConsultationInviteInput = z.infer<typeof createConsultationInviteSchema>;

// Raspuns client la invitatia de consultanta.
export const respondConsultationInviteSchema = z.object({
  accept: z.boolean(),
  clientResponseText: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type RespondConsultationInviteInput = z.infer<typeof respondConsultationInviteSchema>;

// --- DTO-uri raspuns (server → client) ---

export interface QuoteVersionDto {
  id: string;
  version: number;
  isExtra: boolean;
  // Suma contractuala in moneda aleasa de firma + conversie informativa (D-v6-12).
  price: number;
  designFee: number | null;
  currency: (typeof CURRENCIES)[number];
  priceRon: number;
  priceEur: number;
  designFeeRon: number | null;
  designFeeEur: number | null;
  deliveryTerm: string | null;
  deliveryDate: string | null;
  warranty: string | null;
  description: string | null;
  validUntil: string;
  isExpired: boolean;
  validityExtensionsUsed: number;
  createdByUserId: string;
  sentAt: string;
  changeRequest: QuoteChangeRequestDto | null;
  attachments: QuoteAttachmentRef[];
  // defalcarea pe camere (F7); gol la ofertele fara breakdown
  roomPrices: QuoteRoomPriceDto[];
}

export interface QuoteAttachmentRef {
  id: string;
  filename: string;
  mimeType: string;
  downloadUrl: string | null;
}

// Defalcarea pe camere a unei versiuni (F7): roomType inclus pentru afisare
// fara fetch suplimentar pe pagina de oferte a clientului.
export interface QuoteRoomPriceDto {
  requestRoomId: string;
  roomType: string;
  price: number;
}

export interface QuoteChangeRequestDto {
  id: string;
  quoteVersionId: string;
  requestedText: string;
  status: (typeof QUOTE_CHANGE_REQUEST_STATUSES)[number];
  createdAt: string;
  respondedAt: string | null;
}

export interface ConsultationInviteDto {
  id: string;
  quoteId: string;
  companyId: string;
  locationAddress: string;
  proposedDatetime: string;
  alternativeDatetimes: string[] | null;
  status: (typeof CONSULTATION_INVITE_STATUSES)[number];
  clientResponseText: string | null;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
}

// Detaliul complet al cererii pentru firma cu claim (PO r6): continutul
// proiectului (camere cu answers pentru spec-carduri + viewer 3D, atasamente
// presigned inclusiv snapshotul PNG al pieselor 3D, adresa completa).
export interface ClaimRequestDetailDto {
  description: string;
  budgetRange: string;
  budgetEstimateRon: number | null;
  deadlineBucket: string | null;
  hasOwnProject: boolean;
  addressText: string;
  city: string;
  county: string;
  country: string;
  rooms: RequestRoomDto[];
  attachments: AttachmentDto[];
  inspirationPhotoIds: string[];
  // camerele 3D din Studio atasate la publish (feedback PO r3) — read-only
  studioScenes?: RequestStudioSceneDto[];
}

// Datele de contact ale clientului, vizibile firmei DUPA claim (decizie PO r6:
// numele + caile de comunicare alese in cerere; inlocuieste gatingul granular 4.2).
export interface ClaimClientDto {
  name: string;
  contacts: ContactPreferenceDto[];
}

// Cine a preluat / cine lucreaza (4.9) + termenul de atribuire (1h).
export interface ClaimAssignmentDto {
  claimedBy: { userId: string; name: string } | null;
  assignedTo: { userId: string; name: string } | null;
  assignDeadlineAt: string | null;
}

// Context pentru pagina firmei pe un claim: oferta curenta (daca exista) + date necesare
// formularului de oferta (includes_paid_design) + thread-ul de chat.
// PO r6: workspace-ul post-claim primeste TOT contextul dintr-un singur apel —
// detaliul cererii, contactul clientului si atribuirea.
export interface ClaimQuoteContextDto {
  claimSlotId: string;
  requestId: string;
  requestTitle: string;
  includesPaidDesign: boolean;
  threadId: string | null;
  // status + SLA pe slot (Sprint 7) pentru panoul de SLA/retragere/clarificari.
  claimStatus: string;
  slaDeadlineAt: string | null;
  slaPaused: boolean;
  // camerele cererii, pentru formularul de pret per camera (F7, item 22)
  rooms: { id: string; roomType: string }[];
  quote: QuoteDto | null;
  detail: ClaimRequestDetailDto;
  // null cand slotul nu mai e ocupant (anulat/retras) — contactul nu se mai arata
  client: ClaimClientDto | null;
  assignment: ClaimAssignmentDto;
}

export interface QuoteDto {
  id: string;
  claimSlotId: string;
  requestId: string;
  companyId: string;
  companyName: string;
  currency: (typeof CURRENCIES)[number];
  status: (typeof QUOTE_STATUSES)[number];
  extraVersionsCount: number;
  // versionsUsed = nr. de versiuni "in limita" (max 3); folosit de block-ul dupa v3.
  versionsUsed: number;
  versionLimitReached: boolean;
  eurRonRate: number;
  versions: QuoteVersionDto[];
  consultationInvites: ConsultationInviteDto[];
  createdAt: string;
}
