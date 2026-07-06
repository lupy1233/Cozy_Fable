import { z } from 'zod';
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
} from './enums';

// Scheme Zod cereri client — frontend (RHF) + reutilizabile in DTO.
// Mesajele de eroare sunt chei i18n (mapate in frontend), nu text.

const dimensionSchema = z.number().positive('dimensionInvalid').max(100);

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
export type RequestRoomInput = z.infer<typeof requestRoomSchema>;

// Telefon RO: mobil (07xxxxxxxx) sau fix ([23]xxxxxxxx), cu sau fara prefixul +40.
export const RO_PHONE_REGEX = /^(\+40|0)(7\d{8}|[23]\d{8})$/;

// Preferinta de contact: doar EMAIL sau PHONE, valoarea validata ca format.
export const contactPreferenceSchema = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('EMAIL'),
    value: z.string().trim().email('contactEmailInvalid').max(200),
  }),
  z.object({
    channel: z.literal('PHONE'),
    value: z.string().trim().regex(RO_PHONE_REGEX, 'contactPhoneInvalid'),
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
  rooms: z.array(requestRoomSchema).min(1, 'needsRoom').max(20),
  contactPreferences: contactPreferencesSchema,
});
export type RequestContentInput = z.infer<typeof requestContentSchema>;

// O camera in payload-ul configuratorului: raspunsuri brute + versiunea flow-ului.
// Validarea semantica a answers (step-uri, sloturi dinamice, conditii) se face cu
// validateRoomAnswers din questionnaire/ — aici doar forma de transport.
export const configuratorRoomSchema = z.object({
  roomType: z.enum(ROOM_TYPES),
  flowVersion: z.number().int().positive(),
  answers: z.record(z.string(), z.unknown()),
});
export type ConfiguratorRoomInput = z.infer<typeof configuratorRoomSchema>;

// Continutul complet al unei cereri create prin configurator (payload publish/edit).
// Backend-ul deriva rooms/items/dims + scoring din answers (nu se trimit derivate).
// Titlul NU se trimite: e generat automat pe server din camere + oras.
export const configuratorContentSchema = requestContentSchema
  .omit({ rooms: true, title: true })
  .extend({
    rooms: z.array(configuratorRoomSchema).min(1, 'needsRoom').max(20),
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
  rooms: z.array(requestRoomSchema).max(20).optional(),
  contactPreferences: z.array(contactPreferenceSchema).max(4).optional(),
  // starea bruta a wizard-ului configurator (backup server al draftului local);
  // opaca pentru backend, cap de marime aplicat in service
  configuratorState: z.unknown().optional(),
});
export type RequestDraftPatchInput = z.infer<typeof requestDraftPatchSchema>;

// Editare post-creare a unei cereri publicate (aceleasi reguli ca publish).
export const requestEditSchema = requestContentSchema;
export type RequestEditInput = z.infer<typeof requestEditSchema>;

// Upload presigned (mock): cerere URL + confirmare.
export const ALLOWED_ATTACHMENT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ATTACHMENTS_PER_REQUEST = 10;

export const presignUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_ATTACHMENT_MIME),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const confirmUploadSchema = z.object({
  attachmentId: z.string().uuid(),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

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
  deadlineBucket: (typeof DEADLINE_BUCKETS)[number] | null;
  includesPaidDesign: boolean;
  hasOwnProject: boolean;
  addressText: string;
  county: string;
  city: string;
  lat: number | null;
  lng: number | null;
  sizing: RequestSizingDto | null;
  preClaimEditsUsed: number;
  postClaimEditsUsed: number;
  publishedAt: string | null;
  expiresAt: string | null;
  repostUsed: boolean;
  createdAt: string;
  rooms: RequestRoomDto[];
  contactPreferences: ContactPreferenceDto[];
  attachments: AttachmentDto[];
  // stare wizard salvata pe draft (resume de pe alt device); null dupa publish
  configuratorState: unknown | null;
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
}

// Raspuns la crearea unui draft anonim (tokenul e secretul de editare).
export interface RequestDraftCreatedDto {
  id: string;
  draftToken: string;
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
}

// Raspuns presign upload.
export interface PresignUploadResultDto {
  attachmentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}
