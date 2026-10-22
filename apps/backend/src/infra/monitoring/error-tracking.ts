import type { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { scrubServerEvent } from '../../common/logging/safe-tracker';
import { releaseSha } from './release';

export { releaseSha } from './release';

// E-admin-platform-8: tracker de erori pe protocolul Sentry (Sentry EU sau GlitchTip,
// decizie PO). Dezactivat cat timp SENTRY_DSN lipseste — nimic nu pleaca din platforma.
// Fara tracing, fara auto-instrumentare, fara PII: evenimentul trece prin scrubServerEvent.
let enabled = false;

export function initErrorTracking(config: Pick<ConfigService, 'get'>): void {
  const dsn = config.get<string>('SENTRY_DSN');
  if (!dsn || enabled) return;
  Sentry.init({
    dsn,
    environment: config.get<string>('SENTRY_ENVIRONMENT') ?? config.get<string>('NODE_ENV'),
    release: releaseSha(config),
    // SDK v11: sendDefaultPii e inlocuit de dataCollection — colectarea automata e oprita complet
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    },
    defaultIntegrations: false,
    integrations: [
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
    enableOpenTelemetrySetup: false,
    enableRuntimeChannelInjection: false,
    maxBreadcrumbs: 0,
    beforeSend: (event, hint) => scrubServerEvent(event, hint?.originalException),
    initialScope: {
      tags: {
        slot: config.get<string>('DEPLOYMENT_SLOT') ?? 'unassigned',
        mode: config.get<string>('DEPLOYMENT_MODE') ?? 'active',
      },
    },
  });
  enabled = true;
}

// E-admin-platform-54: `level` separa semnalele operationale (DB ocupat = warning) de bug-urile reale (error).
export function captureServerException(
  err: unknown,
  tags: { traceId: string; route: string },
  level: Sentry.SeverityLevel = 'error',
): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTags(tags);
    scope.setLevel(level);
    Sentry.captureException(err);
  });
}

export async function flushErrorTracking(): Promise<void> {
  if (enabled) await Sentry.flush(2000);
}

// Eroare declansata intentionat din Admin > Setari pentru verificarea trackerului.
export class MonitoringTestError extends Error {
  constructor() {
    super('monitoring test error');
    this.name = 'MonitoringTestError';
  }
}
