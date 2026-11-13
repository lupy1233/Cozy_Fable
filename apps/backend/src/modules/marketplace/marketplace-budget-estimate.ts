import { BUDGET_RON_PER_POINT } from '@marketplace/shared';
import { Injectable } from '@nestjs/common';
import type { RoomType } from '@prisma/client';
import { ConfiguratorService } from '../requests/configurator.service';
import { SizingService } from '../sizing/sizing.service';

export interface StoredRoomForEstimate {
  roomType: RoomType;
  flowVersion: number | null;
  answers: unknown;
  needsDesignHelp: boolean;
}

// b11 (PO 2026-11-13): firma vede daca bugetul declarat e sub estimarea din raspunsuri.
// Estimarea se calculeaza ca la client (POST /requests/estimate): scorul de BAZA al camerelor
// (fara treapta de buget si fara proiectare) × 1.000 lei, validare partiala, camerele cu ajutor
// fara raspunsuri. Ponderile sunt cele de acum (Admin -> Marime proiect). Doar citire: nu
// schimba nimic pe cerere (punctajul si costul in credite raman cele de la publicare).
// null = nu se poate calcula (camere din formularul vechi, flux necunoscut, scor 0).
@Injectable()
export class MarketplaceBudgetEstimator {
  constructor(
    private readonly configurator: ConfiguratorService,
    private readonly sizing: SizingService,
  ) {}

  async estimateMinRon(rooms: StoredRoomForEstimate[]): Promise<number | null> {
    if (rooms.length === 0) return null;
    const legacy = rooms.some(
      (r) => r.flowVersion == null || (!r.needsDesignHelp && (r.answers == null || typeof r.answers !== 'object')),
    );
    if (legacy) return null;
    try {
      const processed = this.configurator.processRooms(
        rooms.map((r) => ({
          roomType: r.roomType,
          flowVersion: r.flowVersion as number,
          answers: (r.answers && typeof r.answers === 'object' ? r.answers : {}) as Record<string, unknown>,
          needsDesignHelp: r.needsDesignHelp,
        })),
        { designBrief: true },
      );
      const sizing = await this.sizing.compute({
        scoreEntries: processed.scoreEntries,
        budgetRange: 'UNDISCLOSED',
        includesPaidDesign: false,
      });
      const minRon = sizing.baseScore * BUDGET_RON_PER_POINT;
      return minRon > 0 ? minRon : null;
    } catch {
      // raspunsuri care nu mai trec validarea de azi: fara reper, nu o eroare pe pagina firmei
      return null;
    }
  }
}
