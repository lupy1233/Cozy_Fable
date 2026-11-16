'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { useSlaDateFormat } from '@/lib/sla-deadline';

// a5 (PO 2026-11-13): responsabilul ales in dialogul de preluare. Un id de membru sau LATER
// ("Atribui mai tarziu" — doar proprietarul si managerul; ceasul de o ora porneste).
export const ASSIGN_LATER = 'LATER' as const;
export type AssigneeChoice = string;

export function defaultAssignee(opts: { canAssign: boolean; meId: string | null; selfBusy: boolean }): AssigneeChoice {
  // conducerea ocupata deja cu o preluare fara oferta → "Atribui mai tarziu" in loc de o eroare dupa
  if (opts.canAssign && (opts.selfBusy || !opts.meId)) return ASSIGN_LATER;
  return opts.meId ?? ASSIGN_LATER;
}

// assignToUserId trimis la POST /claims (lipsa = fara responsabil)
export function assigneeToPayload(choice: AssigneeChoice): string | undefined {
  return choice === ASSIGN_LATER ? undefined : choice;
}

// Corpul dialogului de preluare: termenul de raspuns estimat, cine devine responsabil si riscul
// preluarii tarzii (cererea ramane deschisa dupa prima oferta, a1).
export function ClaimDialogDetails({
  deadlineIso,
  canAssign,
  meId,
  members,
  selfBusy,
  value,
  onChange,
  assignMinutesLabel,
  disabled = false,
}: {
  deadlineIso: string | null | undefined;
  canAssign: boolean;
  meId: string | null;
  members: { userId: string; name: string }[];
  selfBusy: boolean;
  value: AssigneeChoice;
  onChange: (next: AssigneeChoice) => void;
  // "60 de minute" — din regulile in vigoare
  assignMinutesLabel: string;
  disabled?: boolean;
}) {
  const t = useTranslations('Marketplace.claimDialog');
  const fmt = useSlaDateFormat();
  const selectId = useId();
  const me = members.find((m) => m.userId === meId);
  const colleagues = members.filter((m) => m.userId !== meId);

  return (
    <>
      {deadlineIso && <p>{t('deadline', { date: fmt(deadlineIso) })}</p>}

      {canAssign ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="font-medium">
            {t('assigneeLabel')}
          </label>
          <Select id={selectId} className="h-11" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
            {meId && (
              <option value={meId} disabled={selfBusy}>
                {t('assigneeMe', { name: me?.name ?? '' })}
              </option>
            )}
            {colleagues.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
            <option value={ASSIGN_LATER}>{t('assignLater')}</option>
          </Select>
          {selfBusy && (
            <Alert tone="amber" className="p-3">
              {t('selfBusyLead')}
            </Alert>
          )}
          {value === ASSIGN_LATER && (
            <p className="text-xs text-muted-foreground">{t('assignLaterHint', { minutes: assignMinutesLabel })}</p>
          )}
        </div>
      ) : selfBusy ? (
        <Alert tone="crimson" role="alert" className="p-3">
          {t('selfBusy')}
        </Alert>
      ) : (
        <p>{t('assigneeSelf')}</p>
      )}

      <p className="text-xs text-muted-foreground">{t('lateRisk')}</p>
    </>
  );
}
