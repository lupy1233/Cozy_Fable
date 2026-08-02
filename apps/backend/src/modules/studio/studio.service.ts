import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ERROR_CODES,
  MAX_STUDIO_DRAFT_BYTES,
  STUDIO_MAX_DRAFTS_PER_USER,
  studioDraftDataSchema,
  type StudioDraftData,
  type StudioDraftDetailDto,
  type StudioDraftSummaryDto,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';

// Drafturile Studio 3D ale utilizatorului (mod Sims, cerinta PO 2026-08-02).
// Continutul e JSON validat STRICT cu schema din shared — aceeasi care
// valideaza si configurile pieselor in configurator (pieceConfig3dSchema);
// nimic nevalidat nu intra in studio_drafts.data.

@Injectable()
export class StudioService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<StudioDraftSummaryDto[]> {
    const drafts = await this.prisma.studioDraft.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, updatedAt: true },
    });
    return drafts.map((d) => ({
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async detail(userId: string, draftId: string): Promise<StudioDraftDetailDto> {
    const draft = await this.requireOwned(userId, draftId);
    return {
      id: draft.id,
      name: draft.name,
      updatedAt: draft.updatedAt.toISOString(),
      data: draft.data as unknown as StudioDraftData,
    };
  }

  async create(userId: string, name: string, raw: unknown): Promise<StudioDraftSummaryDto> {
    const data = this.validateData(raw);
    const count = await this.prisma.studioDraft.count({ where: { userId } });
    if (count >= STUDIO_MAX_DRAFTS_PER_USER) {
      throw new BadRequestException({
        code: ERROR_CODES.STUDIO_DRAFT_LIMIT_REACHED,
        message: `At most ${STUDIO_MAX_DRAFTS_PER_USER} studio drafts per account`,
      });
    }
    try {
      const draft = await this.prisma.studioDraft.create({
        data: { userId, name, data: data as unknown as Prisma.InputJsonValue },
      });
      return { id: draft.id, name: draft.name, updatedAt: draft.updatedAt.toISOString() };
    } catch (e) {
      throw this.mapNameConflict(e);
    }
  }

  async update(
    userId: string,
    draftId: string,
    name: string,
    raw: unknown,
  ): Promise<StudioDraftSummaryDto> {
    const data = this.validateData(raw);
    await this.requireOwned(userId, draftId);
    try {
      const draft = await this.prisma.studioDraft.update({
        where: { id: draftId },
        data: { name, data: data as unknown as Prisma.InputJsonValue },
      });
      return { id: draft.id, name: draft.name, updatedAt: draft.updatedAt.toISOString() };
    } catch (e) {
      throw this.mapNameConflict(e);
    }
  }

  async remove(userId: string, draftId: string): Promise<void> {
    await this.requireOwned(userId, draftId);
    await this.prisma.studioDraft.delete({ where: { id: draftId } });
  }

  private validateData(raw: unknown): StudioDraftData {
    // plafon de marime INAINTE de parcurgerea zod (aparare de payload-uri mari)
    if (JSON.stringify(raw ?? null).length > MAX_STUDIO_DRAFT_BYTES) {
      throw new BadRequestException({
        code: ERROR_CODES.STUDIO_DRAFT_TOO_LARGE,
        message: 'Studio draft exceeds the size limit',
      });
    }
    const parsed = studioDraftDataSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ERROR_CODES.STUDIO_DRAFT_INVALID,
        message: 'Studio draft payload failed validation',
      });
    }
    return parsed.data;
  }

  private async requireOwned(userId: string, draftId: string) {
    const draft = await this.prisma.studioDraft.findUnique({ where: { id: draftId } });
    if (!draft || draft.userId !== userId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Draft not found' });
    }
    return draft;
  }

  private mapNameConflict(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new BadRequestException({
        code: ERROR_CODES.STUDIO_DRAFT_NAME_TAKEN,
        message: 'A draft with this name already exists',
      });
    }
    return e as Error;
  }
}
