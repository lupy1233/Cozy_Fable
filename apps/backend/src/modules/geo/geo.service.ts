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
const CACHE_TTL_DAYS = 90;

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
  private cacheKey(addressText: string, city: string, county: string): string {
    return [addressText, city, county, 'Romania']
      .map((s) => s.trim().toLowerCase().replace(/\s+/g, ' '))
      .join('|');
  }

  async geocode(addressText: string, city: string, county: string): Promise<GeoResult> {
    const queryKey = this.cacheKey(addressText, city, county);

    const cached = await this.prisma.geocodingCache.findUnique({ where: { queryKey } });
    if (cached && cached.expiresAt > new Date()) {
      return { lat: cached.lat, lng: cached.lng, displayName: cached.displayName };
    }

    const result = await this.callNominatim(`${addressText}, ${city}, ${county}, Romania`);

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

  private async callNominatim(q: string): Promise<GeoResult> {
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'ro');

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
      this.logger.warn(`geocoding failed for "${q}": ${(err as Error).message}`);
      throw new HttpException(
        { code: ERROR_CODES.GEOCODING_FAILED, message: 'Geocoding failed' },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
