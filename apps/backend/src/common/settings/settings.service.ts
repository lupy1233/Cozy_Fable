import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

// Citire tipata a cheilor din system_settings (docs 5.4). Fara cache in MVP.
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getString(key: string, fallback: string): Promise<string> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row?.value ?? fallback;
  }

  async getInt(key: string, fallback: number): Promise<number> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    const n = row ? Number.parseInt(row.value, 10) : NaN;
    return Number.isFinite(n) ? n : fallback;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    const n = row ? Number(row.value) : NaN;
    return Number.isFinite(n) ? n : fallback;
  }

  async getBool(key: string, fallback: boolean): Promise<boolean> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row ? row.value === 'true' : fallback;
  }
}
