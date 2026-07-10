import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InspirationColor,
  InspirationPhoto,
  ItemSystem,
  Material,
  Prisma,
  RoomType,
} from '@prisma/client';
import {
  ERROR_CODES,
  INSPIRATION_COLORS,
  ITEM_SYSTEMS,
  MATERIALS,
  ROOM_TYPES,
  type InspirationPhotoDto,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  CreateInspirationPhotoDto,
  ListInspirationQueryDto,
  PresignInspirationImageDto,
  UpdateInspirationPhotoDto,
} from './dto/inspiration.dto';

// Galeria de inspiratie (F6, item 3). Publicul vede doar pozele publicate,
// nesterse, cu imagine; adminul vede tot. Imaginile uploadate se servesc cu
// presigned GET (invarianta 3.4) — niciodata URL static.

const ENTITY_TYPE = 'inspiration_photo';
// o poza pastreaza cel mult cateva atasamente (inlocuiri); nu e flux de fisiere per cerere
const MAX_IMAGE_ATTACHMENTS = 5;

export type PhotoWithCompany = InspirationPhoto & { company: { id: string; name: string } };

// parseaza un CSV din query si pastreaza doar valorile din enum (whitelist)
function parseCsv<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const set = new Set<string>(allowed);
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is T => set.has(v));
}

@Injectable()
export class InspirationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly uploads: UploadsService,
  ) {}

  // ---- public ----

  async listPublic(query: ListInspirationQueryDto): Promise<InspirationPhotoDto[]> {
    const roomType = parseCsv(query.type, ROOM_TYPES)[0];
    const colors = parseCsv(query.colors, INSPIRATION_COLORS);
    const materials = parseCsv(query.materials, MATERIALS);
    const systems = parseCsv(query.systems, ITEM_SYSTEMS);
    const ids = (query.ids ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 50);

    const where: Prisma.InspirationPhotoWhereInput = {
      published: true,
      deletedAt: null,
      // fara imagine nu are ce afisa publicul
      OR: [{ imageUrl: { not: null } }, { attachmentId: { not: null } }],
      ...(roomType ? { roomType: roomType as RoomType } : {}),
      ...(colors.length ? { colors: { hasSome: colors as InspirationColor[] } } : {}),
      ...(materials.length ? { materials: { hasSome: materials as Material[] } } : {}),
      ...(systems.length ? { systems: { hasSome: systems as ItemSystem[] } } : {}),
      ...(ids.length ? { id: { in: ids } } : {}),
    };

    const photos = await this.prisma.inspirationPhoto.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return this.toDtos(photos);
  }

  // valideaza pozele alese de client pe o cerere (publish/edit)
  async assertSelectable(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const count = await this.prisma.inspirationPhoto.count({
      where: { id: { in: ids }, published: true, deletedAt: null },
    });
    if (count !== new Set(ids).size) {
      throw new BadRequestException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'One or more inspiration photos are unavailable',
      });
    }
  }

  // ---- admin ----

  async listAdmin(): Promise<InspirationPhotoDto[]> {
    const photos = await this.prisma.inspirationPhoto.findMany({
      where: { deletedAt: null },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.toDtos(photos);
  }

  async create(dto: CreateInspirationPhotoDto): Promise<InspirationPhotoDto> {
    await this.assertCompany(dto.companyId);
    const photo = await this.prisma.inspirationPhoto.create({
      data: {
        companyId: dto.companyId,
        title: dto.title,
        roomType: dto.roomType,
        colors: dto.colors ?? [],
        materials: dto.materials ?? [],
        systems: dto.systems ?? [],
        imageUrl: dto.imageUrl || null,
        published: dto.published ?? false,
        featured: dto.featured ?? false,
      },
      include: { company: { select: { id: true, name: true } } },
    });
    return (await this.toDtos([photo]))[0];
  }

  async update(id: string, dto: UpdateInspirationPhotoDto): Promise<InspirationPhotoDto> {
    await this.findAlive(id);
    if (dto.companyId) await this.assertCompany(dto.companyId);
    const photo = await this.prisma.inspirationPhoto.update({
      where: { id },
      data: {
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.roomType !== undefined ? { roomType: dto.roomType } : {}),
        ...(dto.colors !== undefined ? { colors: dto.colors } : {}),
        ...(dto.materials !== undefined ? { materials: dto.materials } : {}),
        ...(dto.systems !== undefined ? { systems: dto.systems } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
        ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
      },
      include: { company: { select: { id: true, name: true } } },
    });
    return (await this.toDtos([photo]))[0];
  }

  // soft delete: pozele pot fi referite de cereri publicate
  async remove(id: string): Promise<{ ok: true }> {
    await this.findAlive(id);
    await this.prisma.inspirationPhoto.update({
      where: { id },
      data: { deletedAt: new Date(), published: false },
    });
    return { ok: true };
  }

  // upload imagine prin fluxul presign standard (invarianta 3.4)
  async presignImage(id: string, dto: PresignInspirationImageDto) {
    await this.findAlive(id);
    return this.uploads.presign(
      ENTITY_TYPE,
      id,
      { filename: dto.filename, mimeType: dto.mimeType, sizeBytes: dto.sizeBytes },
      MAX_IMAGE_ATTACHMENTS,
    );
  }

  async confirmImage(id: string, attachmentId: string): Promise<InspirationPhotoDto> {
    await this.findAlive(id);
    await this.uploads.confirm(ENTITY_TYPE, id, attachmentId);
    const photo = await this.prisma.inspirationPhoto.update({
      where: { id },
      data: { attachmentId },
      include: { company: { select: { id: true, name: true } } },
    });
    return (await this.toDtos([photo]))[0];
  }

  // ---- helpers ----

  private async findAlive(id: string): Promise<InspirationPhoto> {
    const photo = await this.prisma.inspirationPhoto.findFirst({
      where: { id, deletedAt: null },
    });
    if (!photo) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Inspiration photo not found',
      });
    }
    return photo;
  }

  private async assertCompany(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Company not found' });
    }
  }

  // rezolva imaginile in batch: attachment SAFE → presigned GET; altfel imageUrl
  // Reutilizat de colectiile de salvari (boards): aceleasi reguli de servire a
  // imaginilor (presigned GET pentru upload-uri, URL extern altfel).
  async photosToDtos(photos: PhotoWithCompany[]): Promise<InspirationPhotoDto[]> {
    return this.toDtos(photos);
  }

  private async toDtos(photos: PhotoWithCompany[]): Promise<InspirationPhotoDto[]> {
    const attachmentIds = photos.map((p) => p.attachmentId).filter((v): v is string => !!v);
    const attachments = attachmentIds.length
      ? await this.prisma.attachment.findMany({
          where: { id: { in: attachmentIds }, status: 'SAFE' },
        })
      : [];
    const urlByAttachment = new Map<string, string>();
    await Promise.all(
      attachments.map(async (a) => {
        urlByAttachment.set(a.id, await this.storage.getPresignedDownloadUrl(a.storageKey));
      }),
    );

    return photos.map((p) => ({
      id: p.id,
      title: p.title,
      roomType: p.roomType,
      colors: p.colors,
      materials: p.materials,
      systems: p.systems,
      imageUrl: (p.attachmentId ? urlByAttachment.get(p.attachmentId) : undefined) ?? p.imageUrl,
      company: p.company,
      published: p.published,
      featured: p.featured,
      createdAt: p.createdAt.toISOString(),
    }));
  }
}
