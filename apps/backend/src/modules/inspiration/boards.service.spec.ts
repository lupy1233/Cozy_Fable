/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InspirationBoardsService } from './boards.service';

// E-client-34: meta per salvare (notita + camera) pe colectii. Prisma mock-uit.
type Any = any;

function build(opts: { ownerId?: string; items?: Any[]; updateCount?: number; source?: Any } = {}) {
  const prisma: Any = {
    inspirationBoard: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'b1',
        userId: opts.ownerId ?? 'u1',
        name: 'Bucatarie',
        createdAt: new Date('2026-09-01T10:00:00Z'),
        updatedAt: new Date('2026-09-02T10:00:00Z'),
      }),
      update: jest.fn().mockReturnValue('board-update'),
    },
    inspirationBoardItem: {
      findMany: jest.fn().mockResolvedValue(opts.items ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: opts.updateCount ?? 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ photoId: 'p1', note: 'n', roomType: 'KITCHEN' }),
      findUnique: jest.fn().mockResolvedValue(opts.source ?? null),
      deleteMany: jest.fn().mockReturnValue('delete'),
      upsert: jest.fn().mockReturnValue('upsert'),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const inspiration: Any = { photosToDtos: jest.fn(async (ps: Any[]) => ps.map((p) => ({ id: p.id, imageUrl: null }))) };
  const service = new InspirationBoardsService(prisma, inspiration);
  return { service, prisma };
}

describe('InspirationBoardsService (E-client-34)', () => {
  it('detail returns note and roomType per saved item', async () => {
    const { service } = build({
      items: [
        { photoId: 'p1', note: 'fronturi mate', roomType: 'KITCHEN', photo: { id: 'p1' } },
        { photoId: 'p2', note: null, roomType: null, photo: { id: 'p2' } },
      ],
    });
    const d = await service.detail('u1', 'b1');
    expect(d.items).toEqual([
      { photoId: 'p1', note: 'fronturi mate', roomType: 'KITCHEN' },
      { photoId: 'p2', note: null, roomType: null },
    ]);
    expect(d.photos).toHaveLength(2);
  });

  describe('updateItem', () => {
    it('another user board is 404 and nothing is written', async () => {
      const { service, prisma } = build({ ownerId: 'other' });
      await expect(service.updateItem('u1', 'b1', 'p1', { note: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.inspirationBoardItem.updateMany).not.toHaveBeenCalled();
    });

    it('a missing item is 404', async () => {
      const { service } = build({ updateCount: 0 });
      await expect(service.updateItem('u1', 'b1', 'p1', { note: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('a blank note becomes null', async () => {
      const { service, prisma } = build();
      await service.updateItem('u1', 'b1', 'p1', { note: '   ' });
      expect(prisma.inspirationBoardItem.updateMany).toHaveBeenCalledWith({
        where: { boardId: 'b1', photoId: 'p1' },
        data: { note: null },
      });
    });

    it('trims the note and sets the room; null clears the room', async () => {
      const { service, prisma } = build();
      await service.updateItem('u1', 'b1', 'p1', { note: '  mate  ', roomType: 'KITCHEN' });
      expect(prisma.inspirationBoardItem.updateMany).toHaveBeenLastCalledWith({
        where: { boardId: 'b1', photoId: 'p1' },
        data: { note: 'mate', roomType: 'KITCHEN' },
      });
      await service.updateItem('u1', 'b1', 'p1', { roomType: null });
      expect(prisma.inspirationBoardItem.updateMany).toHaveBeenLastCalledWith({
        where: { boardId: 'b1', photoId: 'p1' },
        data: { roomType: null },
      });
    });

    it('an empty patch is a 400', async () => {
      const { service } = build();
      await expect(service.updateItem('u1', 'b1', 'p1', {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('moveItem', () => {
    it('creates the destination with the source note and room, never overwriting an existing one', async () => {
      const { service, prisma } = build({ source: { note: 'pastrez', roomType: 'LIVING' } });
      await service.moveItem('u1', 'b1', 'p1', 'b2');
      expect(prisma.inspirationBoardItem.upsert).toHaveBeenCalledWith({
        where: { boardId_photoId: { boardId: 'b2', photoId: 'p1' } },
        create: { boardId: 'b2', photoId: 'p1', note: 'pastrez', roomType: 'LIVING' },
        update: {},
      });
    });

    it('a source without meta creates the destination with nulls', async () => {
      const { service, prisma } = build();
      await service.moveItem('u1', 'b1', 'p1', 'b2');
      expect(prisma.inspirationBoardItem.upsert.mock.calls[0][0].create).toEqual({
        boardId: 'b2',
        photoId: 'p1',
        note: null,
        roomType: null,
      });
    });
  });
});
