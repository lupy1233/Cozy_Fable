import { BadRequestException } from '@nestjs/common';
import type { Prisma, RoomType } from '@prisma/client';
import { ERROR_CODES } from '@marketplace/shared';
import type { ProcessedRoom } from './configurator.service';
import type { CreateRequestContentDto } from './dto/request.dto';

// E-client-34: selectia de poze de inspiratie a unei cereri (cu notita + camera), pura si
// testabila fara Nest. `roomLocalId` e localId-ul camerei din configurator (la editare =
// id-ul camerei persistate) si se traduce in request_room_id prin harta din writeRooms.

export interface InspirationSelection {
  photoId: string;
  note: string | null;
  roomLocalId: string | null;
}

// undefined = campul lipseste din payload -> randurile existente raman neatinse
export function readInspirationSelection(
  dto: Pick<CreateRequestContentDto, 'inspirationPhotoIds' | 'inspirationPhotos'>,
): InspirationSelection[] | undefined {
  if (dto.inspirationPhotoIds !== undefined && dto.inspirationPhotos !== undefined) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Send either inspirationPhotoIds or inspirationPhotos',
    });
  }
  const seen = new Set<string>();
  const out: InspirationSelection[] = [];
  if (dto.inspirationPhotos !== undefined) {
    for (const p of dto.inspirationPhotos) {
      if (seen.has(p.photoId)) continue;
      seen.add(p.photoId);
      out.push({
        photoId: p.photoId,
        note: p.note?.trim() || null,
        roomLocalId: p.roomLocalId?.trim() || null,
      });
    }
    return out;
  }
  if (dto.inspirationPhotoIds !== undefined) {
    for (const photoId of dto.inspirationPhotoIds) {
      if (seen.has(photoId)) continue;
      seen.add(photoId);
      out.push({ photoId, note: null, roomLocalId: null });
    }
    return out;
  }
  return undefined;
}

// o camera strina (sau stearsa) nu poate fi legata: localId-ul trebuie sa fie al unei camere procesate
export function assertInspirationRooms(
  selection: InspirationSelection[] | undefined,
  rooms: ProcessedRoom[],
): void {
  if (!selection) return;
  const known = new Set(rooms.flatMap((r) => (r.sourceLocalId ? [r.sourceLocalId] : [])));
  const bad = selection.filter((s) => s.roomLocalId !== null && !known.has(s.roomLocalId));
  if (bad.length === 0) return;
  throw new BadRequestException({
    code: ERROR_CODES.VALIDATION_ERROR,
    message: 'Inspiration photo linked to an unknown room',
    details: bad.map((s) => ({
      field: 'inspirationPhotos',
      photoId: s.photoId,
      messageKey: 'validation.inspirationRoomUnknown',
    })),
  });
}

export function inspirationRows(
  requestId: string,
  selection: InspirationSelection[],
  roomIds: Map<string, string>,
): Prisma.RequestInspirationPhotoCreateManyInput[] {
  return selection.map((s) => ({
    requestId,
    photoId: s.photoId,
    note: s.note,
    requestRoomId: s.roomLocalId ? (roomIds.get(s.roomLocalId) ?? null) : null,
  }));
}

// doar notitele nenule, cu tipul camerei legate (pentru randurile de log din screening)
export function inspirationNotesForScreening(
  selection: InspirationSelection[] | undefined,
  rooms: ProcessedRoom[],
): { photoId: string; note: string; roomType: RoomType | null }[] {
  if (!selection) return [];
  const typeByLocal = new Map(rooms.flatMap((r) => (r.sourceLocalId ? [[r.sourceLocalId, r.roomType] as const] : [])));
  return selection.flatMap((s) =>
    s.note === null
      ? []
      : [{ photoId: s.photoId, note: s.note, roomType: s.roomLocalId ? (typeByLocal.get(s.roomLocalId) ?? null) : null }],
  );
}
