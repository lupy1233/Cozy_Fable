import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ERROR_CODES,
  MARKETPLACE_DISTANCE_DISPLAY_MODES,
  SETTING_MARKETPLACE_DISTANCE_DISPLAY,
  marketplaceDistanceBand,
  type MarketplaceDetailDto,
  type MarketplaceDistanceDisplayMode,
  type MarketplaceItemDto,
  type RequestStudioSceneData,
  sortByRoomOrder,
} from '@marketplace/shared';
import { Prisma, type RequestStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SettingsService } from '../../common/settings/settings.service';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import { UploadsService } from '../uploads/uploads.service';
import { maskFreeText, maskRoomForFirm, maskSceneData, maskSceneName } from '../../common/privacy/contact-masking';
import { PRIVACY_GRID_LAT_DEG, PRIVACY_GRID_LNG_DEG, wholeKm } from '../../common/privacy/location-privacy';
import {
  OCCUPYING_CLAIM_STATUSES,
  SETTING_CLAIMS_OPEN_AFTER_FIRST_OFFER,
  claimableStatuses,
} from '../claims/claims.constants';

// Statusuri ca literal SQL (constante de cod, fara input user).
const OCCUPYING_SQL = Prisma.sql`(${Prisma.join(OCCUPYING_CLAIM_STATUSES)})`;
// Pasii grilei de confidentialitate ca literali SQL (constante de cod) — aceeasi formula ca
// snapToPrivacyGrid din TS (E-client-9).
const GRID_LAT_SQL = Prisma.raw(`${PRIVACY_GRID_LAT_DEG}::float8`);
const GRID_LNG_SQL = Prisma.raw(`${PRIVACY_GRID_LNG_DEG}::float8`);

interface MarketSettings {
  maxClaims: number;
  claimable: RequestStatus[];
  distanceDisplay: MarketplaceDistanceDisplayMode;
}

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
  desired_deadline_bucket: MarketplaceDetailDto['deadlineBucket'];
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
    private readonly uploads: UploadsService,
  ) {}

  // Setarile care decid eligibilitatea — citite in paralel, fara cache (in oglinda cu claim-ul).
  private async readMarketSettings(): Promise<MarketSettings> {
    const [maxClaims, openAfterFirstOffer, display] = await Promise.all([
      this.settings.getInt('max_claims_per_request', SETTING_DEFAULTS.max_claims_per_request),
      this.settings.getBool(
        SETTING_CLAIMS_OPEN_AFTER_FIRST_OFFER,
        SETTING_DEFAULTS.claims_open_after_first_offer,
      ),
      // E-client-9: km intregi (KM) sau doar banda (BAND); valoare necunoscuta → KM
      this.settings.getString(SETTING_MARKETPLACE_DISTANCE_DISPLAY, SETTING_DEFAULTS.marketplace_distance_display),
    ]);
    const distanceDisplay = (MARKETPLACE_DISTANCE_DISPLAY_MODES as readonly string[]).includes(display)
      ? (display as MarketplaceDistanceDisplayMode)
      : 'KM';
    return { maxClaims, claimable: claimableStatuses(openAfterFirstOffer), distanceDisplay };
  }

  // Listare cereri eligibile pentru firma (4.8/4.10/4.11):
  // - status claimabil (3.1; + OFFERS_RECEIVED/NEGOTIATION doar cu claims_open_after_first_offer=true)
  //   si nestearsa (deleted_at IS NULL, 3.12)
  // - gating plan trecut (published_at + delay <= now)
  // - Haversine <= coverage_radius_km pe cel putin o locatie a firmei
  // - firma neexclusa (request_company_exclusions)
  // - sub max claim-uri active
  async list(companyId: string, gatingMinutes: number): Promise<MarketplaceItemDto[]> {
    const { maxClaims, claimable, distanceDisplay } = await this.readMarketSettings();
    const rows = await this.queryRows(companyId, gatingMinutes, maxClaims, claimable, null);
    return rows.map((r) => this.toItem(r, maxClaims, distanceDisplay));
  }

  async detail(
    companyId: string,
    gatingMinutes: number,
    requestId: string,
  ): Promise<MarketplaceDetailDto> {
    const { maxClaims, claimable, distanceDisplay } = await this.readMarketSettings();
    const rows = await this.queryRows(companyId, gatingMinutes, maxClaims, claimable, requestId);
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
    const [inspiration, attachments, studioScenes] = await Promise.all([
      this.prisma.requestInspirationPhoto.findMany({
        where: { requestId },
        select: { photoId: true, note: true, requestRoomId: true },
      }),
      // atasamentele cererii (PO r6): schitele per camera + snapshotul PNG al
      // pieselor 3D — continut de proiect (nu date de contact), presigned (3.4).
      // E-client-9: nume neutre (attachment-N.ext) — numele original poate contine
      // numele/adresa clientului; imaginile sunt deja curatate de EXIF la scan.
      this.uploads.listForEntity('REQUEST', requestId, undefined, { neutralNames: true }),
      // camerele 3D din Studio (feedback PO r3): firma vede amplasarea read-only
      this.prisma.requestStudioScene.findMany({
        where: { requestId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      ...this.toItem(row, maxClaims, distanceDisplay),
      deadlineBucket: row.desired_deadline_bucket,
      inspirationPhotoIds: inspiration.map((p) => p.photoId),
      // E-client-34: textele libere se mascheaza mereu in marketplace (E-admin-platform-45),
      // inclusiv notitele pozelor; varianta mai restrictiva = note: null
      inspirationPhotos: inspiration.map((p) => ({
        photoId: p.photoId,
        note: p.note == null ? null : maskFreeText(p.note),
        requestRoomId: p.requestRoomId,
      })),
      attachments,
      // E-admin-platform-45: textele libere se mascheaza mereu in marketplace (si pentru
      // firma care a preluat deja — ea citeste textul brut pe fisa de lucru, by-claim)
      studioScenes: studioScenes.map((s) => ({
        id: s.id,
        name: maskSceneName(s.name),
        data: maskSceneData(s.data as unknown as RequestStudioSceneData),
      })),
      // createdAt identic in tranzactia de publish → ordinea canonica = ROOM_ORDER
      rooms: sortByRoomOrder(rooms).map((room) => maskRoomForFirm({
        id: room.id,
        roomType: room.roomType,
        lengthM: room.lengthM,
        widthM: room.widthM,
        heightM: room.heightM,
        answers: (room.answers ?? null) as Record<string, unknown> | null,
        flowVersion: room.flowVersion,
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

  private toItem(r: MarketRow, maxClaims: number, display: MarketplaceDistanceDisplayMode): MarketplaceItemDto {
    const publishedAgoMinutes = Math.max(
      0,
      Math.floor((Date.now() - r.published_at.getTime()) / 60000),
    );
    return {
      id: r.id,
      title: maskFreeText(r.title),
      description: maskFreeText(r.description),
      budgetRange: r.budget_range,
      city: r.city,
      county: r.county,
      size: r.project_size,
      creditCost: r.credit_cost,
      includesPaidDesign: r.includes_paid_design,
      hasOwnProject: r.has_own_project,
      // E-client-9: din punctul aproximat (grila ~2 km); km intregi sau doar banda
      distanceKm: display === 'BAND' ? null : wholeKm(r.distance_km),
      distanceBand: marketplaceDistanceBand(r.distance_km),
      publishedAt: r.published_at.toISOString(),
      publishedAgoMinutes,
      activeClaims: Number(r.active_claims),
      maxClaims,
      alreadyClaimedByMyCompany: r.already_claimed,
    };
  }

  // Haversine in SQL (3.8). distance_km = NULL daca nicio locatie nu acopera cererea.
  // E-client-9: distanta si acoperirea se masoara din punctul cererii aproximat pe grila
  // (rp = centrul celulei, floor + 0.5) — identic cu assertCoverage din claims.service.
  private queryRows(
    companyId: string,
    gatingMinutes: number,
    maxClaims: number,
    claimable: RequestStatus[],
    requestId: string | null,
  ): Promise<MarketRow[]> {
    // literali din constantele de cod (claimableStatuses), fara input user
    const claimableSql = Prisma.sql`(${Prisma.join(claimable)})`;
    return this.prisma.$queryRaw<MarketRow[]>`
      SELECT r.id, r.title, r.description, r.budget_range, r.city, r.county,
             r.project_size, r.credit_cost, r.includes_paid_design, r.has_own_project,
             r.desired_deadline_bucket, r.published_at, d.distance_km,
             (SELECT count(*) FROM claim_slots cs
                WHERE cs.request_id = r.id AND cs.status::text IN ${OCCUPYING_SQL}) AS active_claims,
             EXISTS (SELECT 1 FROM claim_slots cs2
                WHERE cs2.request_id = r.id AND cs2.company_id = ${companyId}
                  AND cs2.status::text IN ${OCCUPYING_SQL}) AS already_claimed
      FROM requests r
      CROSS JOIN LATERAL (
        SELECT (floor(r.lat / ${GRID_LAT_SQL}) + 0.5) * ${GRID_LAT_SQL} AS lat,
               (floor(r.lng / ${GRID_LNG_SQL}) + 0.5) * ${GRID_LNG_SQL} AS lng
      ) rp
      CROSS JOIN LATERAL (
        SELECT MIN(per_loc.dist) AS distance_km FROM (
          SELECT (6371 * acos(LEAST(1, GREATEST(-1,
                   cos(radians(rp.lat)) * cos(radians(l.lat)) * cos(radians(l.lng) - radians(rp.lng))
                   + sin(radians(rp.lat)) * sin(radians(l.lat)))))) AS dist,
                 l.coverage_radius_km AS radius
          FROM company_locations l
          WHERE l.company_id = ${companyId}
        ) per_loc
        WHERE per_loc.dist <= per_loc.radius
      ) d
      WHERE r.status::text IN ${claimableSql}
        AND r.deleted_at IS NULL
        AND r.lat IS NOT NULL AND r.lng IS NOT NULL
        AND r.published_at IS NOT NULL
        AND r.published_at + make_interval(mins => ${gatingMinutes}::int) <= now()
        AND d.distance_km IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM request_company_exclusions e
              WHERE e.request_id = r.id AND e.company_id = ${companyId})
        AND (SELECT count(*) FROM claim_slots cs3
              WHERE cs3.request_id = r.id AND cs3.status::text IN ${OCCUPYING_SQL}) < ${maxClaims}::int
        ${requestId ? Prisma.sql`AND r.id = ${requestId}` : Prisma.empty}
      ORDER BY r.published_at DESC
      LIMIT 200
    `;
  }
}
