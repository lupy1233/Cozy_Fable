import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ERROR_CODES,
  type InspirationBoardDetailDto,
  type InspirationBoardDto,
  type InspirationSaveDto,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { InspirationService } from './inspiration.service';

// Colectiile de salvari ale utilizatorului (item 8, stil Pinterest).
// Orice cont autentificat isi poate face colectii; pozele salvabile sunt cele
// vizibile public (publicate, nesterse) — validate prin assertSelectable.

@Injectable()
export class InspirationBoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inspiration: InspirationService,
  ) {}

  async list(userId: string): Promise<InspirationBoardDto[]> {
    const boards = await this.prisma.inspirationBoard.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: { photo: { include: { company: { select: { id: true, name: true } } } } },
        },
      },
    });
    return Promise.all(
      boards.map(async (b) => {
        const photos = await this.inspiration.photosToDtos(b.items.map((i) => i.photo));
        return {
          id: b.id,
          name: b.name,
          itemsCount: b._count.items,
          coverUrls: photos.map((p) => p.imageUrl).filter((u): u is string => !!u),
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        };
      }),
    );
  }

  async detail(userId: string, boardId: string): Promise<InspirationBoardDetailDto> {
    const board = await this.requireOwned(userId, boardId);
    const items = await this.prisma.inspirationBoardItem.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      include: { photo: { include: { company: { select: { id: true, name: true } } } } },
    });
    const photos = await this.inspiration.photosToDtos(items.map((i) => i.photo));
    return {
      id: board.id,
      name: board.name,
      itemsCount: photos.length,
      coverUrls: photos.slice(0, 3).map((p) => p.imageUrl).filter((u): u is string => !!u),
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
      photos,
    };
  }

  async create(userId: string, name: string): Promise<InspirationBoardDto> {
    try {
      const board = await this.prisma.inspirationBoard.create({ data: { userId, name } });
      return {
        id: board.id,
        name: board.name,
        itemsCount: 0,
        coverUrls: [],
        createdAt: board.createdAt.toISOString(),
        updatedAt: board.updatedAt.toISOString(),
      };
    } catch (e) {
      throw this.mapNameConflict(e);
    }
  }

  async rename(userId: string, boardId: string, name: string): Promise<void> {
    await this.requireOwned(userId, boardId);
    try {
      await this.prisma.inspirationBoard.update({ where: { id: boardId }, data: { name } });
    } catch (e) {
      throw this.mapNameConflict(e);
    }
  }

  async remove(userId: string, boardId: string): Promise<void> {
    await this.requireOwned(userId, boardId);
    await this.prisma.inspirationBoard.delete({ where: { id: boardId } });
  }

  // Salveaza o poza in colectie (idempotent — dublura e ignorata).
  async addItem(userId: string, boardId: string, photoId: string): Promise<void> {
    await this.requireOwned(userId, boardId);
    await this.inspiration.assertSelectable([photoId]);
    await this.prisma.$transaction([
      this.prisma.inspirationBoardItem.upsert({
        where: { boardId_photoId: { boardId, photoId } },
        create: { boardId, photoId },
        update: {},
      }),
      // updatedAt reordoneaza colectia in lista (cea mai activa prima)
      this.prisma.inspirationBoard.update({ where: { id: boardId }, data: { updatedAt: new Date() } }),
    ]);
  }

  async removeItem(userId: string, boardId: string, photoId: string): Promise<void> {
    await this.requireOwned(userId, boardId);
    await this.prisma.inspirationBoardItem.deleteMany({ where: { boardId, photoId } });
  }

  // Toate salvarile utilizatorului — starea "Salvat" pe pin-urile galeriei.
  async savedRefs(userId: string): Promise<InspirationSaveDto[]> {
    const rows = await this.prisma.inspirationBoardItem.findMany({
      where: { board: { userId } },
      select: { photoId: true, boardId: true },
    });
    return rows;
  }

  private async requireOwned(userId: string, boardId: string) {
    const board = await this.prisma.inspirationBoard.findUnique({ where: { id: boardId } });
    if (!board || board.userId !== userId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Board not found' });
    }
    return board;
  }

  private mapNameConflict(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new BadRequestException({
        code: ERROR_CODES.BOARD_NAME_TAKEN,
        message: 'A board with this name already exists',
      });
    }
    return e as Error;
  }
}
