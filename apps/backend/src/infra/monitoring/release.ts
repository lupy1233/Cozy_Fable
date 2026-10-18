import type { ConfigService } from '@nestjs/config';

// SHA-ul release-ului, comun pentru health si trackerul de erori (E-admin-platform-8).
export function releaseSha(config: Pick<ConfigService, 'get'>): string {
  return config.get<string>('RELEASE_SHA')
    ?? config.get<string>('RAILWAY_GIT_COMMIT_SHA')
    ?? 'unknown';
}
