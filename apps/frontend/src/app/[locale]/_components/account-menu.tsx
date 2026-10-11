'use client';

import { Building2, CircleUserRound, KeyRound, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { useLogout, useMe } from '@/hooks/use-auth';
import { useMyCompany } from '@/hooks/use-company';
import { hasUnpublishedLocalDraft } from '@/lib/session-cleanup';
import type { SessionRole } from '@/lib/session-hint';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

// Meniul de cont (Radix DropdownMenu): avatar, nume, email, firma (doar COMPANY_USER) si rol,
// apoi schimbarea parolei si deconectarea. Folosit in header si in bara de sus din admin.
export function AccountMenu({ role }: { role: SessionRole }) {
  const t = useTranslations('Nav');
  const ta = useTranslations('Auth');
  const tc = useTranslations('Common');
  const router = useRouter();
  const me = useMe();
  const company = useMyCompany(role === 'COMPANY_USER');
  const logout = useLogout();

  // eticheta rolului din i18n (Auth.role.*); rol necunoscut → codul brut
  const roleLabel = ta.has(`role.${role}`) ? ta(`role.${role}`) : role;
  const user = me.data;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('accountMenu')} className="px-2 xl:px-3">
          <CircleUserRound className="size-4" />
          <span className="hidden xl:inline">{roleLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel className="flex gap-3 font-normal">
          {user ? (
            <Avatar name={user.name} size={36} />
          ) : (
            <Skeleton className="size-9 shrink-0 rounded-full" />
          )}
          <div className="min-w-0 flex-1">
            <p className="meta-text">{t('signedInAs')}</p>
            {user ? (
              <>
                <p className="truncate font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </>
            ) : (
              <div className="mt-1 flex flex-col gap-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            )}
            {role === 'COMPANY_USER' && company.data && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs">
                <Building2 className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">{t('accountCompany')}: </span>
                <span className="truncate">{company.data.name}</span>
              </p>
            )}
            <p className="label mt-1.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              {roleLabel}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/change-password">
            <KeyRound />
            {t('changePassword')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          tone="danger"
          disabled={logout.isPending}
          onSelect={() => {
            // logout sterge cererea nepublicata din browser: confirmare explicita
            if (hasUnpublishedLocalDraft() && !confirm(tc('logoutDiscardsLocalDraft'))) return;
            logout.mutate(undefined, { onSuccess: () => router.replace('/login') });
          }}
        >
          <LogOut />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
