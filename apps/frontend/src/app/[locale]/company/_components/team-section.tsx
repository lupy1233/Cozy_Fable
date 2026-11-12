'use client';

import {
  companyMemberInviteSchema,
  type CompanyDto,
  type CompanyMemberDto,
  type CompanyMemberInviteInput,
} from '@marketplace/shared';
import { AlertTriangle, Check, ChevronDown, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAddMember, useChangeMemberRole, useRemoveMember } from '@/hooks/use-company';
import { apiErrorKey } from '@/lib/error-messages';
import { ActionConfirmDialog } from '../../_components/action-confirm-dialog';
import { CompanySection } from './company-section';

// Tonuri de badge per rol — managerul si angajatii se disting dintr-o privire.
const ROLE_TONE: Record<string, 'walnut' | 'sage' | 'info' | 'muted'> = {
  OWNER: 'walnut',
  MANAGER: 'sage',
  EMPLOYEE_TRUSTED: 'info',
  EMPLOYEE_MANAGED: 'muted',
};

// rolurile pe care le poate primi un membru (proprietarul nu se schimba de aici)
const ASSIGNABLE_ROLES: CompanyMemberInviteInput['role'][] = ['EMPLOYEE_MANAGED', 'EMPLOYEE_TRUSTED', 'MANAGER'];

const EMPTY_INVITE: CompanyMemberInviteInput = { email: '', role: 'EMPLOYEE_MANAGED' };

export function TeamSection({ company, canManage }: { company: CompanyDto; canManage: boolean }) {
  const t = useTranslations('Company');
  const add = useAddMember();
  const remove = useRemoveMember();
  const changeRole = useChangeMemberRole();
  const emailErrorId = useId();
  const [form, setForm] = useState<CompanyMemberInviteInput>(EMPTY_INVITE);
  const [emailInvalid, setEmailInvalid] = useState(false);
  // eliminarea cere confirmare; tinta ramane in stare si dupa inchidere
  const [target, setTarget] = useState<CompanyMemberDto | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const errorText = (err: unknown) => {
    const { key } = apiErrorKey(err);
    return t.has(key) ? t(key) : t('apiErrors.INTERNAL_ERROR');
  };

  const askRemove = (m: CompanyMemberDto) => {
    remove.reset();
    setTarget(m);
    setConfirmOpen(true);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (add.isPending) return;
    const parsed = companyMemberInviteSchema.safeParse({ ...form, email: form.email.trim() });
    if (!parsed.success) {
      setEmailInvalid(true);
      return;
    }
    setEmailInvalid(false);
    add.mutate(parsed.data, { onSuccess: () => setForm(EMPTY_INVITE) });
  };

  return (
    <CompanySection id="team" title={t('team')}>
      {changeRole.error && (
        <Alert tone="crimson" icon={<AlertTriangle />} role="alert">
          {errorText(changeRole.error)}
        </Alert>
      )}
      <Card padding="none" className="overflow-hidden">
        <ul className="divide-y divide-border">
          {company.members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 py-3.5 sm:px-6"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden>
                  <Avatar
                    name={m.name}
                    size={40}
                    className="bg-walnut-soft font-sans font-semibold text-walnut"
                  />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-ui text-muted-foreground [overflow-wrap:anywhere]">{m.email}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge tone={ROLE_TONE[m.role] ?? 'muted'}>{t(`roleValue.${m.role}`)}</Badge>
                {canManage && m.role !== 'OWNER' && (
                  <>
                    {/* schimbare rol: promovare/retrogradare fara stergere (PO overhaul) */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="px-3"
                          disabled={changeRole.isPending}
                          aria-label={t('changeRoleAria', { name: m.name })}
                        >
                          {t('changeRole')}
                          <ChevronDown aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {ASSIGNABLE_ROLES.map((role) => (
                          <DropdownMenuItem
                            key={role}
                            disabled={role === m.role}
                            onSelect={() => changeRole.mutate({ id: m.id, role })}
                          >
                            <span className="flex-1">{t(`roleValue.${role}`)}</span>
                            {role === m.role && <Check aria-hidden />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 px-2.5 text-crimson hover:bg-crimson-soft hover:text-crimson"
                      aria-label={t('removeMemberAria', { name: m.name })}
                      onClick={() => askRemove(m)}
                    >
                      {t('removeMemberAction')}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {canManage && (
          <form
            noValidate
            onSubmit={submit}
            className="flex flex-wrap items-end gap-3.5 border-t border-border bg-surface-2 px-4 py-5 sm:px-6"
          >
            <Field label={t('memberEmail')} className="min-w-0 flex-[2_1_260px]">
              <Input
                className="h-11"
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={254}
                value={form.email}
                aria-invalid={emailInvalid || undefined}
                aria-describedby={emailInvalid ? emailErrorId : undefined}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setEmailInvalid(false);
                }}
              />
            </Field>
            <Field label={t('memberRole')} className="min-w-0 flex-[1_1_200px]">
              <Select
                className="h-11"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as CompanyMemberInviteInput['role'] })}
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`roleValue.${role}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              type="submit"
              variant="outline"
              className="h-11 border-foreground px-[18px]"
              disabled={add.isPending}
            >
              <Plus aria-hidden />
              {t('addMember')}
            </Button>
            {/* erorile stau pe rand propriu, ca butonul sa ramana aliniat cu campurile */}
            {emailInvalid && (
              <p id={emailErrorId} role="alert" className="basis-full text-xs text-crimson">
                {t('validation.invalidEmail')}
              </p>
            )}
            {add.error && (
              <Alert tone="crimson" icon={<AlertTriangle />} role="alert" className="basis-full">
                {errorText(add.error)}
              </Alert>
            )}
          </form>
        )}
      </Card>

      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('removeMemberConfirm.title')}
        confirmLabel={t('removeMemberConfirm.confirm')}
        cancelLabel={t('cancel')}
        pendingLabel={t('removing')}
        pending={remove.isPending}
        error={remove.error ? errorText(remove.error) : null}
        tone="danger"
        onConfirm={() => {
          if (target) remove.mutate(target.id, { onSuccess: () => setConfirmOpen(false) });
        }}
      >
        {target && <p>{t('removeMemberConfirm.body', { name: target.name, email: target.email })}</p>}
      </ActionConfirmDialog>
    </CompanySection>
  );
}
