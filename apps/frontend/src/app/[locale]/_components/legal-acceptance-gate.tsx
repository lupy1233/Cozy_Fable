'use client';

import { useTranslations } from 'next-intl';
import { useMe, useLogout } from '@/hooks/use-auth';
import { useAcceptLegal } from '@/hooks/use-legal';
import { ApiError } from '@/lib/api';
import { hasUnpublishedLocalDraft } from '@/lib/session-cleanup';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// E-admin-platform-2: dialog blocant de re-acceptare cand versiunea Termenilor/Politicii s-a schimbat
// (users.terms_version diferit de cea curenta). Doar UI: backendul expune needsLegalAcceptance si
// inregistreaza acceptarea. Paginile /terms si /privacy raman citibile; iesirea = Deconectare.
// Hotfix 2026-10-04: backendul raspunde true doar cu system_settings legal_reaccept_existing_users='true'.
export function LegalAcceptanceGate() {
  const t = useTranslations('LegalAcceptance');
  const tc = useTranslations('Common');
  const { data: user } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const accept = useAcceptLegal();
  const logout = useLogout();

  const onLegalPage = pathname.startsWith('/terms') || pathname.startsWith('/privacy');
  if (!user?.needsLegalAcceptance || onLegalPage) return null;

  const code = accept.error instanceof ApiError ? accept.error.code : accept.error ? 'INTERNAL_ERROR' : null;
  const errorText = code ? (t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR')) : null;

  return (
    <Dialog open>
      <DialogContent
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t.rich('body', {
              terms: (chunks) => (
                <Link href="/terms" target="_blank" className="text-walnut underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" target="_blank" className="text-walnut underline">
                  {chunks}
                </Link>
              ),
            })}
          </DialogDescription>
        </DialogHeader>
        {errorText && <Alert tone="crimson">{errorText}</Alert>}
        <DialogFooter className="flex-wrap">
          <Button
            variant="outline"
            disabled={logout.isPending}
            onClick={() => {
              // logout sterge cererea nepublicata din browser: confirmare explicita
              if (hasUnpublishedLocalDraft() && !confirm(tc('logoutDiscardsLocalDraft'))) return;
              logout.mutate(undefined, { onSuccess: () => router.replace('/login') });
            }}
          >
            {t('logout')}
          </Button>
          {code === 'LEGAL_VERSION_MISMATCH' && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              {t('reload')}
            </Button>
          )}
          <Button disabled={accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? t('accepting') : t('accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
