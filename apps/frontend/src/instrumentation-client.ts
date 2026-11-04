import * as Sentry from '@sentry/browser';
import { RELEASE, SENTRY_DSN, scrubClientEvent } from '@/lib/monitoring';

// E-admin-platform-8: Next 15.5 ruleaza fisierul inainte de hidratare. Fara DSN nu se
// initializeaza nimic. Evenimentele pleaca prin tunelul same-origin /monitoring (fara CORS,
// fara adblock), fara tracing, sesiuni sau breadcrumbs; scrubClientEvent le curata.
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: RELEASE,
    environment: process.env.NODE_ENV,
    tunnel: '/monitoring',
    // SDK v11: sendDefaultPii e inlocuit de dataCollection — colectarea automata e oprita
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    tracesSampleRate: 0,
    integrations: (defaults) =>
      defaults.filter((integration) => !['Breadcrumbs', 'BrowserSession', 'BrowserTracing'].includes(integration.name)),
    beforeBreadcrumb: () => null,
    beforeSend: (event) => scrubClientEvent(event),
  });
}
