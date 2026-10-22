import { z } from 'zod';
import { requestStudioSceneDataSchema, REQUEST_STUDIO_SCENES_MAX, type RequestStudioSceneDto } from './studio.schemas';
import type { DashboardActionItemDto } from './dashboard.schemas';
import { INSPIRATION_NOTE_MAX, MAX_REQUEST_INSPIRATION_PHOTOS } from './inspiration.schemas';
import {
  ATTACHMENT_STATUSES,
  BUDGET_RANGES,
  CONTACT_CHANNELS,
  DEADLINE_BUCKETS,
  ITEM_SYSTEMS,
  MATERIALS,
  PROJECT_SIZES,
  REQUEST_STATUSES,
  ROOM_TYPES,
  type BudgetRange,
} from './enums';

// Scheme Zod cereri client — frontend (RHF) + reutilizabile in DTO.
// Mesajele de eroare sunt chei i18n (mapate in frontend), nu text.

const dimensionSchema = z.number().positive('dimensionInvalid').max(100);

// Plafon tehnic de camere/piese per cerere (protectie payload/scoring),
// nu limita de produs — clientul nu ar trebui sa-l atinga in practica.
export const MAX_REQUEST_ROOMS = 50;

// Estimarea de buget (feedback PO F5, item 18): scorul proiectului × 1000 RON
// e baza sliderului, plafonul = 3× baza. Valoarea aleasa se persista numeric
// (budget_estimate_ron), iar bucket-ul budget_range se deriva din ea — scoringul
// si filtrele existente raman pe bucket-uri.
export const BUDGET_RON_PER_POINT = 1000;
export const BUDGET_RANGE_FACTOR = 3;
export const MAX_BUDGET_RON = 10_000_000;

// Costul cererii in credite (feedback PO r5 V1, 2026-07-13): 1 credit = 1000 RON
// din bugetul MINIM estimat (ex. minim 33.000 lei → 33 credite). Baza e scorul
// camerelor (fara ponderea bucketului de buget si fara design platit — acelea
// raman doar pentru clasificarea S/M/L si SLA).
// E-company-21: valoarea unui credit si intervalul [min, max] vin din system_settings
// (credit_value_ron, claim_cost_min, claim_cost_max; 0 = fara plafon). Implicit =
// comportamentul de dinainte (1000 lei, minim 1 credit, fara plafon).
// DECIZIE NECESARA PO: valori min/max (propunerea 3..25 neaprobata).
export const CREDIT_VALUE_RON = 1000;

export const CLAIM_COST_SETTING_KEYS = {
  creditValueRon: 'credit_value_ron',
  min: 'claim_cost_min',
  max: 'claim_cost_max',
} as const;

export type ClaimCostRules = { creditValueRon: number; min: number; max: number | null };

export const CLAIM_COST_DEFAULTS: ClaimCostRules = { creditValueRon: CREDIT_VALUE_RON, min: 1, max: null };

export const CLAIM_COST_LIMITS = { creditValueRonMax: 1_000_000, minMax: 1000, maxMax: 1000 } as const;

function parseIntInRange(value: string | undefined, lo: number, hi: number): number | null {
  if (value === undefined || !/^-?\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) && n >= lo && n <= hi ? n : null;
}

// raw = cheie -> valoare string din system_settings; cheie lipsa/invalida -> implicit.
export function resolveClaimCostRules(raw: Partial<Record<string, string | undefined>>): ClaimCostRules {
  const creditValueRon =
    parseIntInRange(raw[CLAIM_COST_SETTING_KEYS.creditValueRon], 1, CLAIM_COST_LIMITS.creditValueRonMax) ??
    CLAIM_COST_DEFAULTS.creditValueRon;
  const min = parseIntInRange(raw[CLAIM_COST_SETTING_KEYS.min], 1, CLAIM_COST_LIMITS.minMax) ?? CLAIM_COST_DEFAULTS.min;
  const maxRaw = parseIntInRange(raw[CLAIM_COST_SETTING_KEYS.max], 1, CLAIM_COST_LIMITS.maxMax);
  // plafonul nu coboara niciodata sub minim
  const max = maxRaw === null ? null : Math.max(maxRaw, min);
  return { creditValueRon, min, max };
}

export function creditCostFromBaseScore(baseScore: number, rules: ClaimCostRules = CLAIM_COST_DEFAULTS): number {
  const minBudgetRon = Math.max(0, baseScore) * BUDGET_RON_PER_POINT;
  const raw = Math.ceil(minBudgetRon / rules.creditValueRon);
  const floored = Math.max(rules.min, raw);
  return rules.max === null ? floored : Math.min(floored, rules.max);
}

export function budgetRangeFromRon(ron: number): 'UNDER_5K' | 'FROM_5K_TO_15K' | 'OVER_15K' {
  if (ron < 5000) return 'UNDER_5K';
  if (ron <= 15000) return 'FROM_5K_TO_15K';
  return 'OVER_15K';
}

// Bucket-ul de buget e DERIVAT din estimarea RON cand exista (docs/04:
// budget_estimate_ron; bucket-ul ramane pentru filtre/scoring). UNDISCLOSED e
// alegerea explicita a clientului ("Nu doresc sa spun") → fara estimare.
// Aceeasi functie in FE (slider/sumar/payload) si BE (publish/edit).
export function resolveBudgetFields(
  range: BudgetRange,
  ron: number | null | undefined,
): { budgetRange: BudgetRange; budgetEstimateRon: number | null } {
  if (range === 'UNDISCLOSED') return { budgetRange: 'UNDISCLOSED', budgetEstimateRon: null };
  if (typeof ron === 'number') return { budgetRange: budgetRangeFromRon(ron), budgetEstimateRon: ron };
  return { budgetRange: range, budgetEstimateRon: null };
}

// Un item dintr-o camera (corp de mobilier).
export const requestItemSchema = z.object({
  name: z.string().trim().min(2, 'itemNameTooShort').max(150),
  material: z.enum(MATERIALS),
  systems: z.array(z.enum(ITEM_SYSTEMS)).max(ITEM_SYSTEMS.length),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  quantity: z.number().int().min(1, 'quantityTooLow').max(999),
});
export type RequestItemInput = z.infer<typeof requestItemSchema>;

// O camera; lengthM e si lungimea liniara folosita la scoring.
export const requestRoomSchema = z.object({
  roomType: z.enum(ROOM_TYPES),
  lengthM: dimensionSchema,
  widthM: dimensionSchema,
  heightM: dimensionSchema,
  items: z.array(requestItemSchema).min(1, 'roomNeedsItem').max(50),
});

// Telefon RO: mobil (07xxxxxxxx) sau fix ([23]xxxxxxxx), cu sau fara prefixul +40.
export const RO_PHONE_REGEX = /^(\+40|0)(7\d{8}|[23]\d{8})$/;
// Telefon international E.164 (feedback PO F5, item 20 — livram si in afara RO).
export const INTL_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
const PHONE_REGEX = new RegExp(`(${RO_PHONE_REGEX.source})|(${INTL_PHONE_REGEX.source})`);

// Preferinta de contact: doar EMAIL sau PHONE, valoarea validata ca format.
export const contactPreferenceSchema = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('EMAIL'),
    value: z.string().trim().email('contactEmailInvalid').max(200),
  }),
  z.object({
    channel: z.literal('PHONE'),
    value: z.string().trim().regex(PHONE_REGEX, 'contactPhoneInvalid'),
  }),
]);
export type ContactPreferenceInput = z.infer<typeof contactPreferenceSchema>;

// Lista de contacte: 1..4 intrari, maxim 2 per canal (ex. email principal + secundar).
export const contactPreferencesSchema = z
  .array(contactPreferenceSchema)
  .min(1, 'needsContact')
  .max(4, 'tooManyContacts')
  .superRefine((arr, ctx) => {
    for (const channel of CONTACT_CHANNELS) {
      if (arr.filter((c) => c.channel === channel).length > 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tooManyPerChannel' });
      }
    }
  });

// Plafoanele listei de contacte (aceleasi ca in contactPreferencesSchema).
const MAX_CONTACTS = 4;
const MAX_CONTACTS_PER_CHANNEL = 2;

// Emailul contului e mereu primul contact (PO r5). Scoate variantele lui
// (case-insensitive), il pune pe pozitia 0, apoi respecta plafoanele: max 2 per
// canal si max 4 in total — surplusul (ultimele intrari) ajunge in `dropped`,
// ca UI-ul sa-i spuna clientului ce s-a scos. Fara email → lista neschimbata.
export function mergeAccountEmail(
  contacts: ContactPreferenceInput[] | undefined,
  accountEmail: string | null | undefined,
): { contacts: ContactPreferenceInput[]; dropped: ContactPreferenceInput[] } {
  const list = contacts ?? [];
  const email = accountEmail?.trim();
  if (!email) return { contacts: list, dropped: [] };
  const needle = email.toLowerCase();
  const rest = list.filter(
    (c) => !(c.channel === 'EMAIL' && c.value.trim().toLowerCase() === needle),
  );
  const ordered: ContactPreferenceInput[] = [{ channel: 'EMAIL', value: email }, ...rest];
  const kept: ContactPreferenceInput[] = [];
  const dropped: ContactPreferenceInput[] = [];
  const perChannel = new Map<(typeof CONTACT_CHANNELS)[number], number>();
  for (const contact of ordered) {
    const used = perChannel.get(contact.channel) ?? 0;
    if (used >= MAX_CONTACTS_PER_CHANNEL) {
      dropped.push(contact);
      continue;
    }
    perChannel.set(contact.channel, used + 1);
    kept.push(contact);
  }
  dropped.push(...kept.splice(MAX_CONTACTS));
  return { contacts: kept, dropped };
}

// Continutul complet al unei cereri — validat strict la publicare.
// description = mesaj liber optional (fara minim); termenul dorit = interval, nu data.
export const requestContentSchema = z.object({
  title: z.string().trim().min(4, 'titleTooShort').max(200),
  description: z.string().trim().max(5000, 'descriptionTooLong').optional().or(z.literal('')),
  budgetRange: z.enum(BUDGET_RANGES),
  deadlineBucket: z.enum(DEADLINE_BUCKETS).optional(),
  includesPaidDesign: z.boolean(),
  hasOwnProject: z.boolean(),
  addressText: z.string().trim().min(3, 'addressTooShort').max(300),
  county: z.string().trim().min(2, 'countyTooShort').max(100),
  city: z.string().trim().min(2, 'cityTooShort').max(100),
  rooms: z.array(requestRoomSchema).min(1, 'needsRoom').max(MAX_REQUEST_ROOMS),
  contactPreferences: contactPreferencesSchema,
});

// O camera in payload-ul configuratorului: raspunsuri brute + versiunea flow-ului.
// Validarea semantica a answers (step-uri, sloturi dinamice, conditii) se face cu
// validateRoomAnswers din questionnaire/ — aici doar forma de transport.
export const configuratorRoomSchema = z.object({
  sourceLocalId: z.string().min(1).max(60).optional(),
  roomType: z.enum(ROOM_TYPES),
  flowVersion: z.number().int().positive(),
  answers: z.record(z.string(), z.unknown()),
});

// Continutul complet al unei cereri create prin configurator (payload publish/edit).
// Backend-ul deriva rooms/items/dims + scoring din answers (nu se trimit derivate).
// E-client-34: o poza de inspiratie pe cerere, cu notita si camera (localId-ul camerei din
// configurator; la editare = id-ul camerei persistate). Serverul o traduce in request_room_id.
export const requestInspirationPhotoInputSchema = z.object({
  photoId: z.string().uuid(),
  note: z.string().trim().max(INSPIRATION_NOTE_MAX, 'inspirationNoteTooLong').optional(),
  roomLocalId: z.string().min(1).max(60).optional(),
});
export type RequestInspirationPhotoInput = z.infer<typeof requestInspirationPhotoInputSchema>;

// Titlul NU se trimite: e generat automat pe server din camere + oras.
export const configuratorContentSchema = requestContentSchema
  .omit({ rooms: true, title: true })
  .extend({
    rooms: z.array(configuratorRoomSchema).min(1, 'needsRoom').max(MAX_REQUEST_ROOMS),
    studioScenes: z.array(requestStudioSceneDataSchema).max(REQUEST_STUDIO_SCENES_MAX).optional(),
    // bugetul ales pe sliderul estimat (item 18); bucket-ul ramane sursa filtrelor
    budgetEstimateRon: z.number().int().min(0).max(MAX_BUDGET_RON).optional(),
    // tara ISO2 (item 19) — implicit RO pe server; livram si international
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, 'countryInvalid')
      .transform((v) => v.toUpperCase())
      .optional(),
    // pozele din galerie alese ca inspiratie (F6, item 3)
    inspirationPhotoIds: z.array(z.string().uuid()).max(MAX_REQUEST_INSPIRATION_PHOTOS).optional(),
    // E-client-34: varianta cu notita + camera; serverul refuza ambele campuri odata
    inspirationPhotos: z
      .array(requestInspirationPhotoInputSchema)
      .max(MAX_REQUEST_INSPIRATION_PHOTOS)
      .refine((list) => new Set(list.map((p) => p.photoId)).size === list.length, 'inspirationDuplicate')
      .optional(),
  });
export type ConfiguratorContentInput = z.infer<typeof configuratorContentSchema>;

// Patch incremental pe draft — toate campurile optionale.
export const requestDraftPatchSchema = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  budgetRange: z.enum(BUDGET_RANGES).optional(),
  deadlineBucket: z.enum(DEADLINE_BUCKETS).optional(),
  includesPaidDesign: z.boolean().optional(),
  hasOwnProject: z.boolean().optional(),
  addressText: z.string().trim().max(300).optional(),
  county: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  rooms: z.array(requestRoomSchema).max(MAX_REQUEST_ROOMS).optional(),
  contactPreferences: z.array(contactPreferenceSchema).max(4).optional(),
  // starea bruta a wizard-ului configurator (backup server al draftului local);
  // opaca pentru backend, cap de marime aplicat in service
  configuratorState: z.unknown().optional(),
});
export type RequestDraftPatchInput = z.infer<typeof requestDraftPatchSchema>;

// Editare post-creare a unei cereri publicate (aceleasi reguli ca publish).
// Upload presigned (mock): cerere URL + confirmare.
// ZIP e permis explicit de invarianta 3.4 (untrusted, fara preview) — Windows
// raporteaza adesea 'application/x-zip-compressed' in loc de 'application/zip'.
export const ALLOWED_ATTACHMENT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
] as const;

// Valoarea pentru atributul accept al inputurilor de fisiere (FE).
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_MIME.join(',');

// Clasificare MIME pentru afisare (thumbnail vs iconita de tip).
export function attachmentKind(mimeType: string): 'image' | 'pdf' | 'zip' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return 'zip';
  return 'other';
}
// 25 MB per fisier — aliniat la invarianta 3.4 (D2 aprobat PO, 2026-07-12)
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
// Bufferul de fisiere de la NIVEL DE CERERE (planuri/proiect general).
// Limita reala e per camera (feedback PO 2026-07-13): 7 schite/referinte per
// camera; capul absolut al cererii creste cu camerele adaugate.
export const MAX_ATTACHMENTS_PER_REQUEST = 10;
export const MAX_SKETCH_FILES_PER_ROOM = 7;
// Cap absolut per cerere: buffer + schitele fiecarei camere + snapshotul 3D
// (1 per camera, scris programatic la piesele cu configurator 3D).
// roomCount e plafonat la MAX_REQUEST_ROOMS: pe drafturi vine din
// configuratorState (JSON controlat de client) si nu are voie sa umfle capul.
export function maxAttachmentsForRequest(roomCount: number): number {
  const rooms = Math.min(Math.max(roomCount, 0), MAX_REQUEST_ROOMS);
  return MAX_ATTACHMENTS_PER_REQUEST + (MAX_SKETCH_FILES_PER_ROOM + 1) * rooms;
}

export const presignUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_ATTACHMENT_MIME),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

// DTO-uri de raspuns (server → client)
export interface RequestItemDto {
  id: string;
  name: string;
  material: (typeof MATERIALS)[number];
  systems: (typeof ITEM_SYSTEMS)[number][];
  description: string | null;
  quantity: number;
}

export interface RequestRoomDto {
  id: string;
  roomType: (typeof ROOM_TYPES)[number];
  lengthM: number;
  widthM: number;
  heightM: number;
  items: RequestItemDto[];
  // raspunsuri brute configurator; null = cerere legacy (creata inainte de configurator)
  answers: Record<string, unknown> | null;
  flowVersion: number | null;
}

// E-client-34: poza de inspiratie a cererii cu notita si camera
export interface RequestInspirationPhotoDto {
  photoId: string;
  // text brut pentru proprietar; mascat (CONTACT_MASK_TOKEN) pentru firme fara acces la contacte
  note: string | null;
  // camera cererii (RequestRoomDto.id); null = toata locuinta / nespecificat
  requestRoomId: string | null;
}

export interface ContactPreferenceDto {
  id: string;
  channel: (typeof CONTACT_CHANNELS)[number];
  value: string;
}

export interface AttachmentDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: (typeof ATTACHMENT_STATUSES)[number];
  downloadUrl: string | null;
  createdAt: string;
}

export interface RequestSizingDto {
  score: number;
  size: (typeof PROJECT_SIZES)[number];
  creditCost: number;
}

export interface RequestDto {
  id: string;
  status: (typeof REQUEST_STATUSES)[number];
  title: string;
  description: string;
  budgetRange: (typeof BUDGET_RANGES)[number];
  // bugetul ales pe sliderul estimat din scor (F5); null la cererile vechi
  budgetEstimateRon: number | null;
  deadlineBucket: (typeof DEADLINE_BUCKETS)[number] | null;
  includesPaidDesign: boolean;
  hasOwnProject: boolean;
  addressText: string;
  county: string;
  city: string;
  // ISO2, implicit RO (F5)
  country: string;
  lat: number | null;
  lng: number | null;
  sizing: RequestSizingDto | null;
  preClaimEditsUsed: number;
  postClaimEditsUsed: number;
  publishedAt: string | null;
  expiresAt: string | null;
  // E-admin-platform-3: proiect anulat de echipa Cozy Home (status CANCELLED)
  cancelledAt?: string | null;
  repostUsed: boolean;
  createdAt: string;
  rooms: RequestRoomDto[];
  contactPreferences: ContactPreferenceDto[];
  attachments: AttachmentDto[];
  // pozele din galerie alese ca inspiratie (F6); detaliile se iau din GET /inspiration?ids=
  inspirationPhotoIds: string[];
  inspirationPhotos: RequestInspirationPhotoDto[];
  // stare wizard salvata pe draft (resume de pe alt device); null dupa publish
  configuratorState: unknown | null;
  // camerele 3D din Studio atasate la publish (feedback PO r3) — read-only
  studioScenes?: RequestStudioSceneDto[];
}

export interface RequestListItemDto {
  id: string;
  status: (typeof REQUEST_STATUSES)[number];
  title: string;
  budgetRange: (typeof BUDGET_RANGES)[number];
  city: string;
  county: string;
  size: (typeof PROJECT_SIZES)[number] | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  // continut pentru cardurile "Cererile mele" (item 12): camerele cererii,
  // firmele active pe ea si ofertele primite
  roomTypes: (typeof ROOM_TYPES)[number][];
  activeClaims: number;
  quotesCount: number;
}

// E-client-9 — cardul "Cine vede cererea" (GET /requests/:id/visibility, doar clientul).
// contactHolders = firmele cu slot ocupant (ACTIVE, OFFER_SENT, COMPLETED);
// contactsVisibleFrom null = datele de contact sunt deja vizibile firmei.
export interface RequestVisibilityContactHolderDto {
  claimSlotId: string;
  companyName: string;
  claimStatus: 'ACTIVE' | 'OFFER_SENT' | 'COMPLETED';
  claimedAt: string;
  contactsVisibleFrom: string | null;
}

export interface RequestVisibilityDto {
  requestId: string;
  projectVisibleInMarketplace: boolean;
  contactHolders: RequestVisibilityContactHolderDto[];
}

// Raspuns la crearea unui draft anonim (tokenul e secretul de editare).
export interface RequestDraftCreatedDto {
  id: string;
  draftToken: string;
}

// Raspunsul POST /requests/estimate (F5, item 18).
export interface BudgetEstimateDto {
  score: number;
  minRon: number;
  maxRon: number;
}

// Statistici pentru dashboardul clientului (agregate server-side).
export interface ClientDashboardStatsDto {
  totalRequests: number;
  byStatus: Partial<Record<(typeof REQUEST_STATUSES)[number], number>>;
  // oferte primite pe cererile mele (quotes SENT/ACCEPTED)
  offersReceived: number;
  // claim-uri active ale firmelor pe cererile mele
  activeClaims: number;
  recent: {
    id: string;
    title: string;
    status: (typeof REQUEST_STATUSES)[number];
    updatedAt: string;
  }[];
  // E-admin-platform-44 — "De facut acum" (oferte, livrare, clarificari, cerere pe cale sa expire)
  actions: DashboardActionItemDto[];
}

// Raspuns presign upload.
export interface PresignUploadResultDto {
  attachmentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}
