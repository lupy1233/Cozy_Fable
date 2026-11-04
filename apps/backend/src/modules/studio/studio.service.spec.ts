import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudioService } from './studio.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const legacyData = () => ({ version: 2, activeSceneId: 'room', pieces: {}, scenes: [{ id: 'room', name: 'Room', room: { widthM: 4, depthM: 4, wallHeightM: 2.6, wallColor: 'VAR', floorColor: 'STEJAR' }, placements: [], openings: [] }] });
describe('StudioService version compatibility', () => {
  const prisma = { studioDraft: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), count: jest.fn() } };
  let service: StudioService;
  beforeEach(() => { jest.clearAllMocks(); service = new StudioService(prisma as unknown as PrismaService); });
  it('upgrades v2 data on read without overwriting the stored recovery copy', async () => {
    const data = legacyData(); prisma.studioDraft.findUnique.mockResolvedValue({ id: 'draft', userId: 'owner', name: 'Home', updatedAt: new Date(0), data });
    const result = await service.detail('owner', 'draft');
    expect(result.data.version).toBe(3); expect(data.version).toBe(2); expect(prisma.studioDraft.update).not.toHaveBeenCalled();
  });
  it('rejects older client writes before changing a new-format draft', async () => {
    await expect(service.update('owner', 'draft', 'Home', legacyData())).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.studioDraft.update).not.toHaveBeenCalled();
  });
  it('rejects unknown future versions and retains data', async () => {
    prisma.studioDraft.findUnique.mockResolvedValue({ id: 'draft', userId: 'owner', name: 'Home', updatedAt: new Date(), data: { ...legacyData(), version: 99 } });
    await expect(service.detail('owner', 'draft')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.studioDraft.update).not.toHaveBeenCalled();
  });
  it('checks owner before exposing migrated data', async () => {
    prisma.studioDraft.findUnique.mockResolvedValue({ id: 'draft', userId: 'other', data: legacyData() });
    await expect(service.detail('owner', 'draft')).rejects.toBeInstanceOf(NotFoundException);
  });
});
