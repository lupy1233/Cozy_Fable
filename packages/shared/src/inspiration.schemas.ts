import { z } from 'zod';
import { INSPIRATION_COLORS, ITEM_SYSTEMS, MATERIALS, ROOM_TYPES } from './enums';

// Galeria de inspiratie (F6, item 3): fotografii reale de mobilier facut de
// atelierele partenere. Adminul le incarca si le eticheteaza; clientii filtreaza
// dupa tip/culoare/material/deschidere si le pot atasa cererii ca inspiratie.

export const MAX_INSPIRATION_PER_REQUEST = 10;

// Meta unei poze — create/update din admin. Imaginea vine separat: ori upload
// prin fluxul presign (attachment), ori URL extern (seed/demo).
export const inspirationPhotoInputSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().trim().min(3, 'titleTooShort').max(150),
  roomType: z.enum(ROOM_TYPES),
  colors: z.array(z.enum(INSPIRATION_COLORS)).max(INSPIRATION_COLORS.length).default([]),
  materials: z.array(z.enum(MATERIALS)).max(MATERIALS.length).default([]),
  systems: z.array(z.enum(ITEM_SYSTEMS)).max(ITEM_SYSTEMS.length).default([]),
  imageUrl: z.string().trim().url('invalidUrl').max(2000).optional().or(z.literal('')),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
});
export type InspirationPhotoInput = z.infer<typeof inspirationPhotoInputSchema>;

export interface InspirationPhotoDto {
  id: string;
  title: string;
  roomType: (typeof ROOM_TYPES)[number];
  colors: (typeof INSPIRATION_COLORS)[number][];
  materials: (typeof MATERIALS)[number][];
  systems: (typeof ITEM_SYSTEMS)[number][];
  // URL servibil: presigned GET (5 min) pentru upload-uri, altfel URL-ul extern
  imageUrl: string | null;
  company: { id: string; name: string };
  published: boolean;
  featured: boolean;
  createdAt: string;
}

// Filtrele acceptate de GET /inspiration (toate optionale, combinabile).
export interface InspirationFilters {
  roomType?: (typeof ROOM_TYPES)[number];
  colors?: (typeof INSPIRATION_COLORS)[number][];
  materials?: (typeof MATERIALS)[number][];
  systems?: (typeof ITEM_SYSTEMS)[number][];
  ids?: string[];
}

// --- Colectii de salvari (item 8, stil Pinterest) ---

export const MAX_BOARD_NAME_LENGTH = 60;

export const inspirationBoardInputSchema = z.object({
  name: z.string().trim().min(1, 'nameRequired').max(MAX_BOARD_NAME_LENGTH, 'nameTooLong'),
});
export type InspirationBoardInput = z.infer<typeof inspirationBoardInputSchema>;

export interface InspirationBoardDto {
  id: string;
  name: string;
  itemsCount: number;
  // colaj de coperta: pana la 3 imagini servibile din colectie (cea mai noua prima)
  coverUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InspirationBoardDetailDto extends InspirationBoardDto {
  photos: InspirationPhotoDto[];
}

// Toate salvarile utilizatorului (photoId → boardId) — starea "Salvat" pe pin-uri.
export interface InspirationSaveDto {
  photoId: string;
  boardId: string;
}
