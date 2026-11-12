'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useAuditLogs } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { Select } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

// Actiunile auditate (codurile din @Audit / AuditService), grupate pentru filtrul „Actiune”.
// Eticheta omeneasca vine din Admin.audit.actions.<COD>; un cod necunoscut se afiseaza ca atare.
const ACTION_GROUPS = [
  {
    group: 'billing',
    actions: [
      'PAYMENT_CONFIRMED',
      'PAYMENT_CANCELLED',
      'PAYMENT_MARKED_PAID',
      'CREDITS_PURCHASE_REQUESTED',
      'SUBSCRIPTION_PURCHASE_REQUESTED',
      'CHECKOUT_REQUESTED',
      'E_INVOICE_STATUS_UPDATED',
      'SUBSCRIPTION_GRANTED',
      'SELLER_DETAILS_UPDATED',
    ],
  },
  {
    group: 'companies',
    actions: [
      'COMPANY_APPROVED',
      'COMPANY_REJECTED',
      'COMPANY_UNSUSPENDED',
      'COMPANY_PROFILE_UPDATED',
      'COMPANY_LOCATION_CREATED',
      'COMPANY_LOCATION_UPDATED',
      'COMPANY_LOCATION_DELETED',
    ],
  },
  {
    group: 'projects',
    actions: [
      'PROJECT_CASE_OPENED',
      'PROJECT_CASE_RESPONDED',
      'PROJECT_CASE_DISMISSED',
      'PROJECT_CLOSED',
      'DELIVERY_MARKED',
      'DELIVERY_CONFIRMED',
      'REVIEW_CREATED',
      'DISPUTE_RESOLVED',
      'REQUEST_REPOSTED',
    ],
  },
  {
    group: 'claims',
    actions: [
      'CLAIM_CREATED',
      'CLAIM_ASSIGNED',
      'CLARIFICATION_REQUESTED',
      'CLARIFICATION_ANSWERED',
      'CLAIM_WITHDRAWAL_REQUESTED',
      'WITHDRAWAL_REVIEWED',
    ],
  },
  {
    group: 'quotes',
    actions: [
      'QUOTE_CREATED',
      'QUOTE_REVISED',
      'QUOTE_EXTRA_VERSION_CREATED',
      'QUOTE_REOFFERED',
      'QUOTE_VALIDITY_EXTENDED',
      'QUOTE_EXTENSION_REQUESTED',
      'QUOTE_CHANGE_REQUESTED',
      'QUOTE_CHANGE_REJECTED',
      'QUOTE_NEGOTIATION_ENDED',
      'QUOTE_WITHDRAWN',
      'QUOTE_ACCEPTED',
      'CONSULTATION_INVITED',
      'CONSULTATION_RESPONDED',
    ],
  },
  {
    group: 'users',
    actions: ['USER_BLOCKED', 'USER_UNBLOCKED', 'LEGAL_ACCEPTED', 'LOGIN_COOLDOWN_STARTED'],
  },
  {
    group: 'settings',
    actions: [
      'SETTING_UPDATED',
      'PENALTY_RULE_UPDATED',
      'PLAN_CREATED',
      'PLAN_UPDATED',
      'CREDIT_PACKAGE_CREATED',
      'CREDIT_PACKAGE_UPDATED',
      'THRESHOLD_UPDATED',
      'SIZING_WEIGHTS_UPDATED',
      'CALENDAR_HOLIDAY_CREATED',
      'CALENDAR_HOLIDAY_UPDATED',
      'CALENDAR_HOLIDAY_DELETED',
      'MAIL_TEST_SENT',
      'JOB_RETRIED',
    ],
  },
  {
    group: 'content',
    actions: [
      'INSPIRATION_PHOTO_CREATED',
      'INSPIRATION_PHOTO_UPDATED',
      'INSPIRATION_PHOTO_IMAGE_SET',
      'INSPIRATION_PHOTO_UPLOAD_COMPLETED',
      'INSPIRATION_PHOTO_DELETED',
    ],
  },
] as const;
const KNOWN_ACTIONS = new Set<string>(ACTION_GROUPS.flatMap((g): string[] => [...g.actions]));

// Rolurile din jurnal; SYSTEM = intrare fara rol (webhook, joburi automate).
const ROLE_FILTERS = ['ADMIN', 'COMPANY_USER', 'CLIENT', 'SYSTEM'] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

// Unde duce „asupra cui”: detaliul exista doar pentru cereri si firme; restul merg la lista lor.
function entityHref(entityType: string | null, entityId: string | null): string | null {
  switch (entityType) {
    case 'request':
      return entityId ? `/admin/requests/${entityId}` : '/admin/requests';
    case 'company':
      return entityId ? `/admin/companies/${entityId}` : '/admin/companies';
    case 'mock_billing_order':
    case 'subscription':
      return '/admin/payments';
    case 'user':
      return '/admin/users';
    case 'review_dispute':
      return '/admin/disputes';
    case 'claim_withdrawal':
      return '/admin/withdrawals';
    case 'system_setting':
    case 'penalty_rule':
    case 'credit_package':
    case 'subscription_plan':
    case 'project_size_threshold':
    case 'mail':
      return '/admin/settings';
    case 'project_sizing_config':
      return '/admin/sizing';
    case 'business_calendar_holiday':
      return '/admin/calendar';
    case 'inspiration_photo':
      return '/admin/inspiration';
    case 'job':
      return '/admin/jobs';
    default:
      return null;
  }
}

export default function AdminAuditPage() {
  const t = useTranslations('Admin');
  const tu = useTranslations('AdminUsers');
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  // API-ul filtreaza doar dupa actiune → rolul se filtreaza pe client, peste pagina incarcata
  const [role, setRole] = useState<RoleFilter | ''>('');
  const logs = useAuditLogs(page, action ? { action } : {});
  const totalPages = logs.data ? Math.max(1, Math.ceil(logs.data.total / logs.data.pageSize)) : 1;
  const items = logs.data?.items;
  const rows = useMemo(
    () => (items ?? []).filter((a) => !role || (a.role ?? 'SYSTEM') === role),
    [items, role],
  );
  // coduri pe care lista de mai sus nu le stie inca (actiuni noi) raman filtrabile
  const extraActions = useMemo(() => {
    const seen = new Set<string>();
    if (action && !KNOWN_ACTIONS.has(action)) seen.add(action);
    for (const a of items ?? []) if (!KNOWN_ACTIONS.has(a.action)) seen.add(a.action);
    return [...seen].sort();
  }, [items, action]);

  const actionLabel = (code: string) => (t.has(`audit.actions.${code}`) ? t(`audit.actions.${code}`) : code);
  const entityLabel = (type: string) => (t.has(`audit.entities.${type}`) ? t(`audit.entities.${type}`) : type);
  const roleLabel = (r: string | null) =>
    r === null || r === 'SYSTEM' ? t('audit.system') : tu.has(`role.${r}`) ? tu(`role.${r}`) : r;

  return (
    <div className="flex w-full max-w-[1180px] flex-col gap-6">
      <PageHeader
        title={t('nav.audit')}
        subtitle={<span className="block max-w-3xl text-lead">{t('audit.subtitle')}</span>}
      />

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <Field label={t('audit.action')} className="w-full sm:w-72">
          <Select
            className="h-11"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('audit.allActions')}</option>
            {ACTION_GROUPS.map((g) => (
              <optgroup key={g.group} label={t(`audit.groups.${g.group}`)}>
                {g.actions.map((code) => (
                  <option key={code} value={code}>
                    {actionLabel(code)}
                  </option>
                ))}
              </optgroup>
            ))}
            {extraActions.length > 0 && (
              <optgroup label={t('audit.groups.other')}>
                {extraActions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>
        <Field label={t('audit.role')} className="w-full sm:w-44">
          <Select className="h-11" value={role} onChange={(e) => setRole(e.target.value as RoleFilter | '')}>
            <option value="">{t('audit.allRoles')}</option>
            {ROLE_FILTERS.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </Select>
        </Field>
        {logs.data && (
          <span className="inline-flex h-11 items-center font-mono text-xs text-muted-foreground sm:ml-auto">
            {t('audit.total', { n: logs.data.total })}
          </span>
        )}
      </div>
      {role !== '' && items && items.length > 0 && (
        <p className="-mt-3 text-xs text-muted-foreground">
          {t('audit.rolePageNote', { shown: rows.length, loaded: items.length })}
        </p>
      )}

      {logs.isPending && <SkeletonTable rows={6} cols={4} />}
      {logs.isError && <LoadError onRetry={() => void logs.refetch()} />}
      {logs.isSuccess && logs.data.items.length === 0 && (
        <EmptyState variant="card" size="sm" title={action ? t('audit.emptyFiltered') : t('audit.empty')} />
      )}
      {logs.isSuccess && logs.data.items.length > 0 && rows.length === 0 && (
        <EmptyState
          variant="card"
          size="sm"
          title={t('audit.emptyRole')}
          action={
            <Button variant="outline" size="sm" onClick={() => setRole('')}>
              {t('audit.allRoles')}
            </Button>
          }
        />
      )}

      {rows.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <Table className="min-w-[760px] [&_th]:bg-surface-2">
            <THead>
              <TR>
                <TH scope="col">{t('audit.date')}</TH>
                <TH scope="col">{t('audit.who')}</TH>
                <TH scope="col">{t('audit.what')}</TH>
                <TH scope="col">{t('audit.target')}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((a) => {
                const href = entityHref(a.entityType, a.entityId);
                return (
                  <TR key={a.id}>
                    <TD className="whitespace-nowrap font-mono text-xs">
                      {format.dateTime(new Date(a.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                    </TD>
                    <TD>
                      <span className="block font-medium">{roleLabel(a.role)}</span>
                      <span className="block font-mono text-meta text-muted-foreground">
                        {a.userId ? `#${a.userId.slice(0, 8)}` : t('audit.automatic')}
                      </span>
                    </TD>
                    <TD>
                      <span className="block">{actionLabel(a.action)}</span>
                      <span className="block font-mono text-meta text-muted-foreground">{a.action}</span>
                    </TD>
                    <TD>
                      {a.entityType ? (
                        <>
                          {href ? (
                            <Link href={href} className="font-medium text-walnut underline-offset-4 hover:underline">
                              {entityLabel(a.entityType)}
                            </Link>
                          ) : (
                            <span className="font-medium">{entityLabel(a.entityType)}</span>
                          )}
                          <span className="block font-mono text-meta text-muted-foreground">
                            {a.entityType}
                            {a.entityId && ` · #${a.entityId.slice(0, 8)}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      {logs.data && (totalPages > 1 || page > 1) && (
        <nav aria-label={t('list.pagination')} className="flex flex-wrap items-center justify-end gap-3">
          <span className="data-mono text-muted-foreground" aria-live="polite">
            {t('requests.pageOf', { page, pages: totalPages })}
          </span>
          <Button variant="outline" size="lg" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            {t('list.prev')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            {t('list.next')}
          </Button>
        </nav>
      )}
    </div>
  );
}
