import { z } from 'zod';
import type { RequestStudioSceneDto } from './studio.schemas';
import type { ProjectCaseDto } from './project-case.schemas';
import {
  CONSULTATION_INVITE_STATUSES,
  CURRENCIES,
  QUOTE_CHANGE_REQUEST_STATUSES,
  QUOTE_DECLINE_REASONS,
  QUOTE_DELIVERY_TERM_UNITS,
  QUOTE_STATUSES,
  QUOTE_VAT_MODES,
  REQUEST_STATUSES,
} from './enums';
import type {
  AttachmentDto,
  ContactPreferenceDto,
  RequestInspirationPhotoDto,
  RequestRoomDto,
} from './request.schemas';

// Sprint 6 — ofertare structurata (4.13 / D3 / D4 / D-v6-7 / D-v6-8 / D-v6-11 / D-v6-12).

// Limite business (4.13).
export const MAX_QUOTE_VERSIONS = 3; // v1 + 2 versiuni declansate de change request
export const MAX_VALIDITY_EXTENSIONS = 2; // Buton A: max 2 × N zile
export const MAX_ATTACHMENTS_PER_QUOTE = 5; // invarianta 3.4
// a3 (2026-11-13): plafoanele rubricilor structurate (validare comuna FE/BE)
export const MAX_DELIVERY_TERM_VALUE = 520; // 10 ani in saptamani / zile lucratoare
export const MAX_WARRANTY_MONTHS = 600;
export const MAX_DESIGN_INCLUDES_LENGTH = 1000;
export const MAX_QUOTE_DECLINE_NOTE_LENGTH = 500;
// a3: termenul adus la zile lucratoare (1 saptamana = 5 zile lucratoare)
export const WORKING_DAYS_PER_WEEK = 5;

// Campurile editabile ale unei oferte = offer field_key (matrice permisiuni 4.13).
// a3/g0-11 (2026-11-13): TVA, termen (numar + unitate), garantie (luni) si bifele transport /
// montaj sunt OBLIGATORII la orice varianta noua; deliveryTerm / warranty (text) nu se mai trimit
// — serverul le completeaza din rubrici. designFee + designIncludes: obligatorii impreuna DOAR la
// cererile cu proiectare cu plata (verificat in service, care stie cererea), interzise altfel.
const offerFieldsSchema = z.object({
  price: z.number().positive('priceInvalid').max(100_000_000),
  // design_fee apare doar daca cererea are includes_paid_design (D-v6-11); validat in service.
  designFee: z.number().positive('designFeeInvalid').max(100_000_000).optional(),
  designIncludes: z.string().trim().min(1, 'designIncludesRequired').max(MAX_DESIGN_INCLUDES_LENGTH).optional(),
  // a4: moneda VARIANTEI; lipsa = moneda variantei precedente (la v1 = RON)
  currency: z.enum(CURRENCIES).optional(),
  vatMode: z.enum(QUOTE_VAT_MODES, { errorMap: () => ({ message: 'vatModeRequired' }) }),
  deliveryTermValue: z
    .number({ invalid_type_error: 'deliveryTermRequired', required_error: 'deliveryTermRequired' })
    .int('deliveryTermInvalid')
    .min(1, 'deliveryTermInvalid')
    .max(MAX_DELIVERY_TERM_VALUE, 'deliveryTermInvalid'),
  deliveryTermUnit: z.enum(QUOTE_DELIVERY_TERM_UNITS, { errorMap: () => ({ message: 'deliveryTermRequired' }) }),
  warrantyMonths: z
    .number({ invalid_type_error: 'warrantyRequired', required_error: 'warrantyRequired' })
    .int('warrantyInvalid')
    .min(1, 'warrantyInvalid')
    .max(MAX_WARRANTY_MONTHS, 'warrantyInvalid'),
  includesTransport: z.boolean({ required_error: 'includesRequired', invalid_type_error: 'includesRequired' }),
  includesAssembly: z.boolean({ required_error: 'includesRequired', invalid_type_error: 'includesRequired' }),
  // text liber vechi: ignorat la variantele noi (serverul il scrie din rubrici)
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

// E-company-6: firma confirma explicit ca retragerea ofertei dupa termenul SLA + gratie
// expira imediat preluarea (altfel 409 QUOTE_WITHDRAW_SLA_ACK_REQUIRED).
export const withdrawQuoteSchema = z.object({
  acknowledgeSlaBreach: z.boolean().optional(),
});
export type WithdrawQuoteInput = z.infer<typeof withdrawQuoteSchema>;

// Firma incheie negocierea online (chat read-only pentru ambii; D3).
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

// E-client-1: clientul accepta exact versiunea vazuta in dialogul de confirmare;
// daca intre timp firma a trimis alta versiune → 409 QUOTE_VERSION_CHANGED.
export const acceptQuoteSchema = z.object({
  quoteVersionId: z.string().uuid(),
});
export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>;

// a4 (2026-11-13, PO a4-1/a4-2): clientul refuza definitiv o oferta SENT. POST
// /client/quotes/:id/decline cu Idempotency-Key; motiv optional din lista scurta + nota libera
// (firma le vede). Raspuns: QuoteDto adus la zi (aceeasi forma ca la acceptare).
export const declineQuoteSchema = z.object({
  reason: z.enum(QUOTE_DECLINE_REASONS).optional(),
  note: z.string().trim().max(MAX_QUOTE_DECLINE_NOTE_LENGTH, 'declineNoteTooLong').optional().or(z.literal('')),
});
export type DeclineQuoteInput = z.infer<typeof declineQuoteSchema>;

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
  // E-client-1: total = pret + proiectare (docs/03: design fee face parte din oferta acceptata)
  total: number;
  totalRon: number;
  totalEur: number;
  // text: la variantele vechi = ce a scris firma; la cele noi = generat de server din rubrici
  // ("6 săptămâni", "24 de luni"), ca sa ramana lizibil pentru cod vechi, PDF si e-mailuri
  deliveryTerm: string | null;
  deliveryDate: string | null;
  warranty: string | null;
  description: string | null;
  // a3 (2026-11-13) — rubrici structurate; null pe variantele trimise inainte de etapa 4
  vatMode: (typeof QUOTE_VAT_MODES)[number] | null;
  deliveryTermValue: number | null;
  deliveryTermUnit: (typeof QUOTE_DELIVERY_TERM_UNITS)[number] | null;
  warrantyMonths: number | null;
  includesTransport: boolean | null;
  includesAssembly: boolean | null;
  // g0-11: ce include proiectarea (null fara designFee / pe variantele vechi)
  designIncludes: string | null;
  // a3 — calculate de server (tabel, card si PDF arata aceleasi cifre):
  // cota de TVA folosita (system_settings.vat_rate, implicit 21)
  vatRatePercent: number;
  // pretul (price) cu TVA, in moneda variantei: = price la VAT_INCLUDED / NOT_VAT_PAYER,
  // price × (1 + cota) la VAT_EXCLUDED; null cand vatMode lipseste (varianta veche)
  priceWithVat: number | null;
  // aceeasi regula aplicata totalului (pret + proiectare); null cand vatMode lipseste
  totalWithVat: number | null;
  // termenul adus la zile lucratoare (WEEKS × 5); null pe variantele vechi
  deliveryWorkingDays: number | null;
  validUntil: string;
  // E-admin-platform-3: doar ofertele SENT/EXPIRED pot fi "expirate" (ACCEPTED nu)
  isExpired: boolean;
  validityExtensionsUsed: number;
  // E-admin-platform-3: clientul a cerut prelungirea acestei versiuni (oferta EXPIRED)
  extensionRequestedAt: string | null;
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

// a4 (2026-11-13): istoricul cererilor de modificare ramane vizibil dupa raspuns, langa
// varianta la care s-a cerut si varianta care i-a raspuns.
export interface QuoteChangeRequestHistoryDto extends QuoteChangeRequestDto {
  // numarul variantei pe care clientul a cerut modificarea
  requestedOnVersion: number;
  // numarul variantei care a raspuns (FULFILLED); null la PENDING / REJECTED
  answeredByVersion: number | null;
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
  // b11: suma aleasa de client (eticheta "Bugetul declarat de client"); optional pentru un slot vechi
  budgetDeclared?: boolean;
  deadlineBucket: string | null;
  hasOwnProject: boolean;
  addressText: string;
  // b12: "Bloc, scara, apartament" — adresa exacta, goala ca addressText fara acces la contacte;
  // optional pentru un slot vechi
  addressDetails?: string;
  city: string;
  county: string;
  country: string;
  rooms: RequestRoomDto[];
  attachments: AttachmentDto[];
  inspirationPhotoIds: string[];
  // E-client-34: notita bruta doar cu acces la contacte, altfel mascata; goala in REDACTED/TOMBSTONE
  inspirationPhotos: RequestInspirationPhotoDto[];
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
// E-company-3: FULL = fisa de lucru completa; REDACTED = preluare care nu mai ocupa slotul
// (doar titlu, localitate, statusuri, ofertele proprii); TOMBSTONE = cererea a fost stearsa.
export const CLAIM_CONTEXT_VISIBILITIES = ['FULL', 'REDACTED', 'TOMBSTONE'] as const;
export type ClaimContextVisibility = (typeof CLAIM_CONTEXT_VISIBILITIES)[number];
// E-company-3: de ce lipsesc contactele clientului (client = null) pe fisa de lucru.
export const CLAIM_CLIENT_HIDDEN_REASONS = [
  'NOT_OCCUPYING',
  'NOT_ASSIGNED_TO_YOU',
  'REVEAL_PENDING',
  'RETENTION_EXPIRED',
  'REQUEST_DELETED',
] as const;
export type ClaimClientHiddenReason = (typeof CLAIM_CLIENT_HIDDEN_REASONS)[number];
// E-company-3: system_settings.claim_contact_reveal_policy (DECIZIE NECESARA PO; implicit ON_CLAIM = W1).
export const CLAIM_CONTACT_REVEAL_POLICIES = ['ON_CLAIM', 'AFTER_GRACE'] as const;
export type ClaimContactRevealPolicy = (typeof CLAIM_CONTACT_REVEAL_POLICIES)[number];

export interface ClaimQuoteContextDto {
  claimSlotId: string;
  requestId: string;
  requestTitle: string;
  includesPaidDesign: boolean;
  threadId: string | null;
  // status + SLA pe slot (Sprint 7) pentru panoul de SLA/retragere/clarificari.
  claimStatus: string;
  // E-company-1: FE ascunde retragerea/livrarea dupa accept si in afara gratiei de 30 min
  requestStatus: (typeof REQUEST_STATUSES)[number];
  claimedAt: string;
  slaDeadlineAt: string | null;
  slaPaused: boolean;
  // camerele cererii, pentru formularul de pret per camera (F7, item 22)
  rooms: { id: string; roomType: string }[];
  quote: QuoteDto | null;
  detail: ClaimRequestDetailDto;
  // null cand slotul nu mai e ocupant (anulat/retras) SAU cand acest membru nu are voie
  // sa vada contactele (E-company-3) — motivul e in clientHiddenReason
  client: ClaimClientDto | null;
  assignment: ClaimAssignmentDto;
  // E-admin-platform-3: ultimul caz raportat pe proiect (doar pentru firma castigatoare)
  projectCase: ProjectCaseDto | null;
  // E-company-6: date pentru dialogurile de confirmare ale firmei (cost, SLA, fereastra de retragere)
  firmActions: ClaimFirmActionsDto;
  // E-company-3: lipsa (imagine veche) = FULL
  visibility: ClaimContextVisibility;
  clientHiddenReason: ClaimClientHiddenReason | null;
  // doar pentru REVEAL_PENDING: momentul in care contactele devin vizibile
  clientVisibleFrom: string | null;
}

// E-company-6: ce pierde firma la actiunile ireversibile de pe fisa de lucru.
export interface ClaimFirmActionsDto {
  claimCostCredits: number;
  // sla_deadline_at + 12h; null daca SLA e pe pauza sau lipseste
  slaBreachAt: string | null;
  // doar oferta SENT/EXPIRED: ultima versiune trimisa + 1 zi lucratoare
  quoteWithdrawWindowEndsAt: string | null;
  // N zile per prelungire (quote_validity_default_days)
  validityExtensionDays: number;
}

export interface QuoteDto {
  id: string;
  claimSlotId: string;
  requestId: string;
  companyId: string;
  companyName: string;
  // a4: moneda VARIANTEI CURENTE (fiecare varianta isi are moneda ei in versions[].currency)
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
  // E-admin-platform-3: momentul acceptarii (null pana la accept)
  acceptedAt: string | null;
  // E-client-1: versiunea acceptata (null pana la accept si pe ofertele acceptate inainte de migrare)
  acceptedVersionId: string | null;
  // a4 (2026-11-13): refuzul clientului (vizibil clientului si firmei); null daca nu e DECLINED
  declinedAt: string | null;
  declineReason: (typeof QUOTE_DECLINE_REASONS)[number] | null;
  declineNote: string | null;
  // a4: toate cererile de modificare ale ofertei, in ordinea crearii (inclusiv cele cu raspuns)
  changeRequests: QuoteChangeRequestHistoryDto[];
}
