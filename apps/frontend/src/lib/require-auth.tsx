'use client';

import type { AuthUser } from '@marketplace/shared';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useLogout, useMe } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type { SessionRole } from './session-hint';
import { loginTarget } from './session-lost';
import { currentAppLocation, useLoginRedirect } from './use-login-redirect';

// f4: garda comuna a paginilor cu cont.
// - fara sesiune → /login?redirect=<pagina curenta>[&reason=expired] (useLoginRedirect);
// - rol gresit → status 'wrongRole': pagina arata <RoleOnlyScreen>, nu mai sare tacut pe Panou
//   (ex. linkul „Vezi oferta” deschis cu contul firmei);
// - 'loading' cat „cine sunt eu” se incarca SAU a esuat (pana pleaca redirectul): pagina arata
//   scheletul si NU monteaza componentele care cer cont (D1: ele reporneau cererile in bucla).
export type RequireAuthStatus = 'loading' | 'ok' | 'wrongRole';

export function useRequireAuth(role?: SessionRole) {
  const me = useMe();
  const toLogin = useLoginRedirect();
  useEffect(() => {
    if (me.isError) toLogin();
  }, [me.isError, toLogin]);

  const user: AuthUser | null = me.data ?? null;
  const status: RequireAuthStatus =
    me.isPending || me.isError || !user ? 'loading' : role && user.role !== role ? 'wrongRole' : 'ok';
  return { status, user, me };
}

// „Pagina e doar pentru firme / clienti / administratori” + Panou + intrare cu alt cont
// (contul potrivit pentru link; dupa login revine exact aici).
export function RoleOnlyScreen({ role }: { role: SessionRole }) {
  const t = useTranslations('Access');
  const router = useRouter();
  const logout = useLogout();
  const switchAccount = () => {
    const { pathname, search } = currentAppLocation();
    const target = loginTarget(pathname, search);
    logout.mutate(undefined, { onSettled: () => router.replace(target) });
  };
  return (
    <EmptyState
      variant="card"
      className="mx-auto max-w-lg"
      tone="warning"
      role="alert"
      icon={Lock}
      title={t(`onlyFor.${role}`)}
      hint={t('wrongAccountHint')}
      action={
        <>
          <Button asChild variant="walnut">
            <Link href="/dashboard">{t('toDashboard')}</Link>
          </Button>
          <Button type="button" variant="outline" disabled={logout.isPending} onClick={switchAccount}>
            {t('switchAccount')}
          </Button>
        </>
      }
    />
  );
}
