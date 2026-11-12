'use client';

import {
  portfolioItemSchema,
  type CompanyDto,
  type PortfolioItemDto,
  type PortfolioItemInput,
} from '@marketplace/shared';
import { AlertTriangle, ImageOff, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAddPortfolioItem, useDeletePortfolioItem } from '@/hooks/use-company';
import { apiErrorKey } from '@/lib/error-messages';
import { ActionConfirmDialog } from '../../_components/action-confirm-dialog';
import { CompanySection } from './company-section';

const EMPTY_ITEM: PortfolioItemInput = { title: '', description: '', imageUrl: '' };

type ErrorField = 'title' | 'imageUrl';
type FieldErrors = Partial<Record<ErrorField, string>>;

export function PortfolioSection({ company, canManage }: { company: CompanyDto; canManage: boolean }) {
  const t = useTranslations('Company');
  const add = useAddPortfolioItem();
  const del = useDeletePortfolioItem();
  // formularul de adaugare sta intr-un dialog deschis din placa punctata
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<PortfolioItemInput>(EMPTY_ITEM);
  const [errors, setErrors] = useState<FieldErrors>({});
  // stergerea cere confirmare; tinta ramane in stare si dupa inchidere
  const [target, setTarget] = useState<PortfolioItemDto | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const errorText = (err: unknown) => {
    const { key } = apiErrorKey(err);
    return t.has(key) ? t(key) : t('apiErrors.INTERNAL_ERROR');
  };

  const openAdd = () => {
    add.reset();
    setErrors({});
    setAddOpen(true);
  };

  const clearError = (field: ErrorField) =>
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const askDelete = (item: PortfolioItemDto) => {
    del.reset();
    setTarget(item);
    setConfirmOpen(true);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (add.isPending) return;
    const parsed = portfolioItemSchema.safeParse(form);
    if (!parsed.success) {
      // doar titlul (prea scurt) si linkul (invalid) pot pica: descrierea e limitata din camp
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'title') next.title = t('validation.titleTooShort');
        else if (field === 'imageUrl') next.imageUrl = t('validation.invalidUrl');
      }
      setErrors(next);
      return;
    }
    setErrors({});
    add.mutate(parsed.data, {
      onSuccess: () => {
        setForm(EMPTY_ITEM);
        setAddOpen(false);
      },
    });
  };

  return (
    <CompanySection id="portfolio" title={t('portfolio')} aside={t('portfolioHint')}>
      {company.portfolio.length === 0 && <p className="text-sm text-muted-foreground">{t('noPortfolio')}</p>}

      {(company.portfolio.length > 0 || canManage) && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-4">
          {company.portfolio.map((p) => (
            <Card key={p.id} asChild padding="none" className="overflow-hidden">
              <figure>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div aria-hidden className="grid aspect-[4/3] w-full place-items-center bg-surface-3 text-muted-2">
                    <ImageOff className="size-6" />
                  </div>
                )}
                <figcaption className="flex items-start justify-between gap-2 px-3.5 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.title}</span>
                    {p.description && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {p.description}
                      </span>
                    )}
                  </span>
                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-crimson hover:bg-crimson-soft hover:text-crimson"
                      aria-label={t('deletePortfolioAria', { title: p.title })}
                      onClick={() => askDelete(p)}
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </figcaption>
              </figure>
            </Card>
          ))}

          {canManage && (
            <button
              type="button"
              onClick={openAdd}
              className="flex min-h-[190px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-muted-2 bg-surface-2 p-4 text-center transition-colors hover:border-walnut hover:bg-walnut-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut focus-visible:ring-offset-2"
            >
              <Plus aria-hidden className="size-6 text-walnut" />
              <span className="text-sm font-semibold">{t('addPortfolioItem')}</span>
              <span className="text-xs text-muted-foreground">{t('addPortfolioHint')}</span>
            </button>
          )}
        </div>
      )}

      {canManage && (
        <Dialog open={addOpen} onOpenChange={(open) => !add.isPending && setAddOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addPortfolioTitle')}</DialogTitle>
              <DialogDescription>{t('portfolioHint')}</DialogDescription>
            </DialogHeader>
            <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
              <Field label={t('portfolioTitle')} error={errors.title}>
                <Input
                  className="h-11"
                  maxLength={150}
                  value={form.title}
                  aria-invalid={errors.title ? true : undefined}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    clearError('title');
                  }}
                />
              </Field>
              <Field label={t('portfolioDescription')}>
                <Textarea
                  rows={3}
                  maxLength={2000}
                  value={form.description ?? ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <Field label={t('portfolioImageUrl')} hint={t('portfolioImageUrlHint')} error={errors.imageUrl}>
                <Input
                  className="h-11"
                  type="url"
                  inputMode="url"
                  maxLength={2000}
                  value={form.imageUrl ?? ''}
                  aria-invalid={errors.imageUrl ? true : undefined}
                  onChange={(e) => {
                    setForm({ ...form, imageUrl: e.target.value });
                    clearError('imageUrl');
                  }}
                />
              </Field>
              {add.error && (
                <Alert tone="crimson" icon={<AlertTriangle />} role="alert">
                  {errorText(add.error)}
                </Alert>
              )}
              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={add.isPending}
                  onClick={() => setAddOpen(false)}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" size="lg" disabled={add.isPending}>
                  {t('addPortfolioItem')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('deletePortfolioConfirm.title')}
        confirmLabel={t('deletePortfolioConfirm.confirm')}
        cancelLabel={t('cancel')}
        pendingLabel={t('deleting')}
        pending={del.isPending}
        error={del.error ? errorText(del.error) : null}
        tone="danger"
        onConfirm={() => {
          if (target) del.mutate(target.id, { onSuccess: () => setConfirmOpen(false) });
        }}
      >
        {target && <p>{t('deletePortfolioConfirm.body', { title: target.title })}</p>}
      </ActionConfirmDialog>
    </CompanySection>
  );
}
