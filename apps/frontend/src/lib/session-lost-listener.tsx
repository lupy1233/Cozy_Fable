'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { AUTH_QUERY_KEY, onSessionLost, sessionLostTarget } from './session-lost';

// f3: ascultatorul global al semnalului „sesiune pierduta” (montat o data, in providers).
// - Doar daca omul chiar avea o sesiune: „cine sunt eu” era in cache, sau /auth/me a primit 401
//   (serverul raspunde 401 acolo doar cu material de sesiune; vizitatorul primeste { user: null }).
// - Goleste datele contului din cache (ca la auth_expired pe socket) si reface „cine sunt eu”.
// - Redirect la /login?redirect=<pagina>&reason=expired doar de pe paginile care cer cont.
export function SessionLostListener() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(
    () =>
      onSessionLost((detail) => {
        const hadSession = Boolean(qc.getQueryData(AUTH_QUERY_KEY)) || detail.path === '/auth/me';
        // ignorat → `false`: fereastra de 5 s nu porneste, un semnal urmator poate duce la login
        if (!hadSession) return false;
        // reset (nu remove): datele se golesc la fel, dar interogarile active se reiau. remove anula
        // TACUT o cerere in zbor (ex. ciorna formularului public), iar pagina ramanea pe „Se pregateste…”
        void qc.resetQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
        // semnalul venit chiar din /auth/me: interogarea aceea pica singura (fara reluare in bucla)
        if (detail.path !== '/auth/me') void qc.resetQueries({ queryKey: ['auth'] });
        const target = sessionLostTarget(pathnameRef.current, window.location.search);
        // pagina publica: doar golire; nici asta nu porneste fereastra (review m4)
        if (!target) return false;
        router.replace(target);
        return true;
      }),
    [qc, router],
  );

  return null;
}
