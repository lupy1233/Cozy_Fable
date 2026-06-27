import { z } from 'zod';
import {
  ATTACHMENT_STATUSES,
  BUDGET_RANGES,
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

// Preferinta de contact ordonata (prioritate 1..5, maxim 5 canale).
export const contactPreferenceSchema = z.object({
  channel: z.string().trim().min(2, 'contactChannelTooShort').max(50),
  value: z.string().trim().min(2, 'contactValueTooShort').max(200),
  priority: z.number().int().min(1).max(5),
});
export type ContactPreferenceInput = z.infer<typeof contactPreferenceSchema>;

// Continutul complet al unei cereri — validat strict la publicare.
export const requestContentSchema = z.object({
  title: z.string().trim().min(4, 'titleTooShort').max(200),
  description: z.string().trim().min(10, 'descriptionTooShort').max(5000),
  budgetRange: z.enum(BUDGET_RANGES),
  desiredDeadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')
    .optional()
    .or(z.literal('')),
  includesPaidDesign: z.boolean(),
  hasOwnProject: z.boolean(),
  addressText: z.string().trim().min(3, 'addressTooShort').max(300),
  county: z.string().trim().min(2, 'countyTooShort').max(100),
  city: z.string().trim().min(2, 'cityTooShort').max(100),
  rooms: z.array(requestRoomSchema).min(1, 'needsRoom').max(20),
  contactPreferences: z.array(contactPreferenceSchema).min(1, 'needsContact').max(5),
});
export type RequestContentInput = z.infer<typeof requestContentSchema>;

// Patch incremental pe draft — toate campurile optionale.
export const requestDraftPatchSchema = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  budgetRange: z.enum(BUDGET_RANGES).optional(),
  desiredDeadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')
    .optional()
    .or(z.literal('')),
  includesPaidDesign: z.boolean().optional(),
  hasOwnProject: z.boolean().optional(),
  addressText: z.string().trim().max(300).optional(),
  county: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  rooms: z.array(requestRoomSchema).max(20).optional(),
  contactPreferences: z.array(contactPreferenceSchema).max(5).optional(),
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
}

export interface ContactPreferenceDto {
  id: string;
  channel: string;
  value: string;
  priority: number;
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
  desiredDeadline: string | null;
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

// Raspuns presign upload.
export interface PresignUploadResultDto {
  attachmentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}
