import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  type MarketplaceDetailDto,
  type MarketplaceItemDto,
} from '@marketplace/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SettingsService } from '../../common/settings/settings.service';
import { CLAIMABLE_STATUSES, OCCUPYING_CLAIM_STATUSES } from '../claims/claims.constants';

// Statusuri ca literal SQL (constante de cod, fara input user).
const CLAIMABLE_SQL = Prisma.sql`(${Prisma.join(CLAIMABLE_STATUSES)})`;
const OCCUPYING_SQL = Prisma.sql`(${Prisma.join(OCCUPYING_CLAIM_STATUSES)})`;

interface MarketRow {
  id: string;
  title: string;
  description: string;
  budget_range: MarketplaceItemDto['budgetRange'];
  city: string;
  county: string;
  project_size: MarketplaceItemDto['size'];
  credit_cost: number | null;
  includes_paid_design: boolean;
  has_own_project: boolean;
  desired_deadline: Date | null;
  published_at: Date;
  distance_km: number;
  active_claims: bigint;
  already_claimed: boolean;
}

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // Listare cereri eligibile pentru firma (4.8/4.10/4.11):
  // - status claimabil (IN_MARKETPLACE/CLAIMED_PARTIAL)
  // - gating plan trecut (published_at + delay <= now)
  // - Haversine <= coverage_radius_km pe cel putin o locatie a firmei
  // - firma neexclusa (request_company_exclusions)
  // - sub max claim-uri active
  async list(companyId: string, gatingMinutes: number): Promise<MarketplaceItemDto[]> {
    const maxClaims = await this.settings.getInt('max_claims_per_request', 3);
    const rows = await this.queryRows(companyId, gatingMinutes, maxClaims, null);
    return rows.map((r) => this.toItem(r));
  }

  async detail(
    companyId: string,
    gatingMinutes: number,
    requestId: string,
  ): Promise<MarketplaceDetailDto> {
    const maxClaims = await this.settings.getInt('max_claims_per_request', 3);
    const rows = await this.queryRows(companyId, gatingMinutes, maxClaims, requestId);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Request not visible to your company',
      });
    }
    const rooms = await this.prisma.requestRoom.findMany({
      where: { requestId },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...this.toItem(row),
      desiredDeadline: row.desired_deadline ? row.desired_deadline.toISOString().slice(0, 10) : null,
      rooms: rooms.map((room) => ({
        id: room.id,
        roomType: room.roomType,
        lengthM: room.lengthM,
        widthM: room.widthM,
        heightM: room.heightM,
        items: room.items.map((it) => ({
          id: it.id,
          name: it.name,
          material: it.material,
          systems: it.systems,
          description: it.description,
          quantity: it.quantity,
        })),
      })),
    };
  }

  private toItem(r: MarketRow): MarketplaceItemDto {
    const publishedAgoMinutes = Math.max(
      0,
      Math.floor((Date.now() - r.published_at.getTime()) / 60000),
    );
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      budgetRange: r.budget_range,
      city: r.city,
      county: r.county,
      size: r.project_size,
      creditCost: r.credit_cost,
      includesPaidDesign: r.includes_paid_design,
      hasOwnProject: r.has_own_project,
      distanceKm: Math.round(r.distance_km * 10) / 10,
      publishedAt: r.published_at.toISOString(),
      publishedAgoMinutes,
      activeClaims: Number(r.active_claims),
      maxClaims: 3,
      alreadyClaimedByMyCompany: r.already_claimed,
    };
  }

  // Haversine in SQL (3.8). distance_km = NULL daca nicio locatie nu acopera cererea.
  private queryRows(
    companyId: string,
    gatingMinutes: number,
    maxClaims: number,
    requestId: string | null,
  ): Promise<MarketRow[]> {
    return this.prisma.$queryRaw<MarketRow[]>`
      SELECT r.id, r.title, r.description, r.budget_range, r.city, r.county,
             r.project_size, r.credit_cost, r.includes_paid_design, r.has_own_project,
             r.desired_deadline, r.published_at, d.distance_km,
             (SELECT count(*) FROM claim_slots cs
                WHERE cs.request_id = r.id AND cs.status IN ${OCCUPYING_SQL}) AS active_claims,
             EXISTS (SELECT 1 FROM claim_slots cs2
                WHERE cs2.request_id = r.id AND cs2.company_id = ${companyId}
                  AND cs2.status IN ${OCCUPYING_SQL}) AS already_claimed
      FROM requests r
      CROSS JOIN LATERAL (
        SELECT MIN(per_loc.dist) AS distance_km FROM (
          SELECT (6371 * acos(LEAST(1, GREATEST(-1,
                   cos(radians(r.lat)) * cos(radians(l.lat)) * cos(radians(l.lng) - radians(r.lng))
                   + sin(radians(r.lat)) * sin(radians(l.lat)))))) AS dist,
                 l.coverage_radius_km AS radius
          FROM company_locations l
          WHERE l.company_id = ${companyId}
        ) per_loc
        WHERE per_loc.dist <= per_loc.radius
      ) d
      WHERE r.status IN ${CLAIMABLE_SQL}
        AND r.lat IS NOT NULL AND r.lng IS NOT NULL
        AND r.published_at IS NOT NULL
        AND r.published_at + make_interval(mins => ${gatingMinutes}::int) <= now()
        AND d.distance_km IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM request_company_exclusions e
              WHERE e.request_id = r.id AND e.company_id = ${companyId})
        AND (SELECT count(*) FROM claim_slots cs3
              WHERE cs3.request_id = r.id AND cs3.status IN ${OCCUPYING_SQL}) < ${maxClaims}::int
        ${requestId ? Prisma.sql`AND r.id = ${requestId}::uuid` : Prisma.empty}
      ORDER BY r.published_at DESC
      LIMIT 200
    `;
  }
}
