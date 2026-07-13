import { ERROR_CODES } from '@marketplace/shared';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface GeoResult {
  lat: number;
  lng: number;
  displayName: string | null;
}

// Invarianta 3.8: geocoding la scriere via Nominatim, rezultatul cache-uit
// 90 zile in geocoding_cache. Esec → GEOCODING_FAILED (clientul reincearca).
//
// PO r5 (2026-07-13): Nominatim esua pe adrese RO complete ("bl. A3, sc. 2,
// ap. 15") sau pe judete scrise "Judetul X" → clientul primea "Adresa nu a
// putut fi localizata" desi orasul/judetul erau corecte. Acum:
//  - adresa e curatata de detaliile de bloc/scara/apartament/etaj;
//  - judetul pierde prefixul "Judetul"/"jud.";
//  - cautarea cade in trepte: adresa+oras+judet → oras+judet → oras;
//  - tara vine din cerere (ISO2, implicit RO) — nu mai e hardcodata Romania.
// GEOCODING_FAILED se arunca DOAR daca toate treptele esueaza.
const CACHE_TTL_DAYS = 90;
// Nominatim public cere max 1 req/s — pauza intre treptele de fallback.
const RETRY_DELAY_MS = 1100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.baseUrl = config.getOrThrow<string>('NOMINATIM_BASE_URL');
    this.userAgent = config.getOrThrow<string>('NOMINATIM_USER_AGENT');
  }

  // Normalizeaza adresa pentru cheia de cache (case/spatii insensibile).
  private cacheKey(addressText: string, city: string, county: string, country: string): string {
    return [addressText, city, county, country]
      .map((s) => s.trim().toLowerCase().replace(/\s+/g, ' '))
      .join('|');
  }

  // "Judetul Ilfov" / "jud. Ilfov" → "Ilfov" (Nominatim nu recunoaste prefixul).
  private normalizeCounty(county: string): string {
    return county.replace(/^\s*(jude[tț]ul|jud\.?)\s+/i, '').trim();
  }

  // Scoate detaliile care nu exista in harta si strica free-form search-ul:
  // bloc, scara, apartament, etaj, interfon (ex. "bl. A3, sc. 2, ap. 15, et. 4").
  private stripAddressNoise(addressText: string): string {
    return addressText
      .replace(/,?\s*\b(bl|bloc|sc|scara|ap|apt|apartament|et|etaj|interfon)\.?\s*[\w/-]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/(\s*,\s*)+/g, ', ')
      .replace(/^[,\s]+|[,\s]+$/g, '');
  }

  async geocode(
    addressText: string,
    city: string,
    county: string,
    country = 'RO',
  ): Promise<GeoResult> {
    const cc = (country || 'RO').trim().toLowerCase();
    const queryKey = this.cacheKey(addressText, city, county, cc);

    const cached = await this.prisma.geocodingCache.findUnique({ where: { queryKey } });
    if (cached && cached.expiresAt > new Date()) {
      return { lat: cached.lat, lng: cached.lng, displayName: cached.displayName };
    }

    const cleanCounty = this.normalizeCounty(county);
    const cleanAddress = this.stripAddressNoise(addressText);
    // trepte de la specific la general; dublurile/golurile se elimina
    const attempts = [...new Set(
      [
        [cleanAddress, city, cleanCounty],
        [city, cleanCounty],
        [city],
      ].map((parts) => parts.filter((p) => p && p.trim()).join(', ')),
    )].filter((q) => q.length > 0);

    let result: GeoResult | null = null;
    for (let i = 0; i < attempts.length && !result; i++) {
      if (i > 0) await sleep(RETRY_DELAY_MS);
      result = await this.tryNominatim(attempts[i], cc);
    }
    if (!result) {
      throw new HttpException(
        { code: ERROR_CODES.GEOCODING_FAILED, message: 'Geocoding failed' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.geocodingCache.upsert({
      where: { queryKey },
      update: { lat: result.lat, lng: result.lng, displayName: result.displayName, expiresAt },
      create: {
        queryKey,
        lat: result.lat,
        lng: result.lng,
        displayName: result.displayName,
        expiresAt,
      },
    });

    return result;
  }

  private async tryNominatim(q: string, countryCode: string): Promise<GeoResult | null> {
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', countryCode);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'ro' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      const body = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
      const hit = body[0];
      if (!hit) throw new Error('no result');
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('invalid coords');
      return { lat, lng, displayName: hit.display_name ?? null };
    } catch (err) {
      this.logger.warn(`geocoding attempt failed for "${q}" [${countryCode}]: ${(err as Error).message}`);
      return null;
    }
  }
}
