'use client';

import {
  MAX_ATTACHMENT_BYTES,
  portfolioItemSchema,
  resolveAttachmentMime,
  type CompanyDto,
  type PortfolioItemDto,
} from '@marketplace/shared';
import { AlertTriangle, ImagePlus, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
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
import {
  useAddPortfolioItem,
  useDeletePortfolioItem,
  useSetPortfolioImage,
  useUploadPortfolioImage,
} from '@/hooks/use-company';
import { ApiError } from '@/lib/api';
import { rejectReasonFromError, type UploadRejectReason } from '@/lib/attachment-upload';
import { apiErrorKey } from '@/lib/error-messages';
import { UploadStillPendingError } from '@/lib/upload-scan';
import { ActionConfirmDialog } from '../../_components/action-confirm-dialog';
import { CompanySection } from './company-section';
import { PortfolioImage } from './portfolio-image';

// h1 (etapa 11): o singura poza pe lucrare, incarcata din calculator. Aceleasi tipuri de imagine
// ca la cerere (JPG / PNG / WebP — fara PDF / ZIP) si aceeasi limita de marime.
export const PORTFOLIO_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ACCEPT = PORTFOLIO_IMAGE_MIME.join(',');

export function localImageRejectReason(file: File): UploadRejectReason | null {
  const mime = resolveAttachmentMime(file.name, file.type);
  if (!mime || !(PORTFOLIO_IMAGE_MIME as readonly string[]).includes(mime)) return 'TYPE';
  if (file.size <= 0) return 'EMPTY';
  if (file.size > MAX_ATTACHMENT_BYTES) return 'SIZE';
  return null;
}

// Mesajul pentru o poza respinsa: tipul are text propriu (doar imagini), restul refolosesc
// mesajele pentru fisiere respinse de la formularul de cerere (b5).
function useImageRejectText() {
  const t = useTranslations('Company');
  const tu = useTranslations('Configurator.uploads');
  return (reason: UploadRejectReason) =>
    reason === 'TYPE' ? t('portfolioImageRejectType') : tu(`rejectReason.${reason}`);
}

// Textul unei erori API in limba omului, cu parametrii din details (ex. {max} la plafon).
function useCompanyErrorText() {
  const t = useTranslations('Company');
  return (err: unknown) => {
    const { key } = apiErrorKey(err);
    if (!t.has(key)) return t('apiErrors.INTERNAL_ERROR');
    const details = err instanceof ApiError ? err.details : undefined;
    const params = details && typeof details === 'object' && !Array.isArray(details) ? (details as Record<string, string | number>) : undefined;
    return t(key, params);
  };
}

// Eroarea unei incarcari de poza: verificarea care dureaza (m4) are text propriu, la fel
// starea firmei sau limita de frecventa; restul = motivele de la formularul de cerere (b5).
function useImageErrorText() {
  const t = useTranslations('Company');
  const rejectText = useImageRejectText();
  const errorText = useCompanyErrorText();
  return (err: unknown) => {
    if (err instanceof UploadStillPendingError) return t('portfolioImagePending');
    const reason = rejectReasonFromError(err);
    if (reason === 'NETWORK' && err instanceof ApiError && t.has(`apiErrors.${err.code}`)) return errorText(err);
    return rejectText(reason);
  };
}

// m4: incarcarea reusita a fisierului ales — o reincercare (atasare picata, verificare lunga)
// refoloseste id-ul, fara un nou PUT. NOT_FOUND = incarcarea nu mai exista → se urca din nou.
interface UploadedImage {
  file: File;
  attachmentId: string;
}
const forgetsUpload = (err: unknown) => err instanceof ApiError && err.code === 'NOT_FOUND';

interface ItemForm {
  title: string;
  description: string;
}
const EMPTY_ITEM: ItemForm = { title: '', description: '' };

type ErrorField = 'title' | 'image';
type FieldErrors = Partial<Record<ErrorField, string>>;

// Previzualizarea locala a pozei alese (fara retea); URL-ul se elibereaza la schimbare
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function PortfolioCard({
  item,
  canManage,
  onDelete,
}: {
  item: PortfolioItemDto;
  canManage: boolean;
  onDelete: (item: PortfolioItemDto) => void;
}) {
  const t = useTranslations('Company');
  const rejectText = useImageRejectText();
  const imageErrorText = useImageErrorText();
  const errorText = useCompanyErrorText();
  const upload = useUploadPortfolioImage();
  const setImage = useSetPortfolioImage();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  // m4: fisierul deja urcat, pastrat pentru „Reîncearcă”
  const [retry, setRetry] = useState<UploadedImage | null>(null);
  const pending = upload.isPending || setImage.isPending;

  const run = async (file: File, resumeAttachmentId?: string) => {
    setError(null);
    let attachmentId: string;
    try {
      attachmentId = await upload.mutateAsync({
        file,
        resumeAttachmentId,
        onUploaded: (id) => setRetry({ file, attachmentId: id }),
      });
    } catch (err) {
      if (forgetsUpload(err)) setRetry(null);
      setError(imageErrorText(err));
      return;
    }
    setImage.mutate(
      { id: item.id, attachmentId },
      {
        onSuccess: () => setRetry(null),
        onError: (err) => {
          if (forgetsUpload(err)) setRetry(null);
          setError(errorText(err));
        },
      },
    );
  };

  const replace = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || pending) return;
    const local = localImageRejectReason(file);
    if (local) {
      setError(rejectText(local));
      return;
    }
    setRetry(null);
    void run(file);
  };

  return (
    <Card asChild padding="none" className="overflow-hidden">
      <figure>
        <PortfolioImage src={item.imageUrl} alt={item.title} className="aspect-[4/3] w-full object-cover" />
        <figcaption className="flex flex-col gap-2 px-3.5 py-2.5">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-sm font-medium">{item.title}</span>
              {item.description && (
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.description}</span>
              )}
            </span>
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-crimson hover:bg-crimson-soft hover:text-crimson"
                aria-label={t('deletePortfolioAria', { title: item.title })}
                onClick={() => onDelete(item)}
              >
                <X aria-hidden />
              </Button>
            )}
          </span>
          {canManage && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                data-testid={`portfolio-replace-${item.id}`}
                onChange={replace}
              />
              <Button
                type="button"
                variant="ghost"
                className="h-10 justify-start self-start px-2"
                disabled={pending}
                aria-label={t('replacePortfolioImageAria', { title: item.title })}
                onClick={() => inputRef.current?.click()}
              >
                {pending ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
                {pending ? t('portfolioImageUploading') : item.imageUrl ? t('replacePortfolioImage') : t('addPortfolioImage')}
              </Button>
              {error && (
                <p role="alert" className="text-xs text-crimson">
                  {error}
                </p>
              )}
              {error && retry && !pending && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 justify-start self-start px-2 text-walnut"
                  onClick={() => void run(retry.file, retry.attachmentId)}
                >
                  {t('portfolioImageRetry')}
                </Button>
              )}
            </>
          )}
        </figcaption>
      </figure>
    </Card>
  );
}

export function PortfolioSection({ company, canManage }: { company: CompanyDto; canManage: boolean }) {
  const t = useTranslations('Company');
  const rejectText = useImageRejectText();
  const add = useAddPortfolioItem();
  const upload = useUploadPortfolioImage();
  const del = useDeletePortfolioItem();
  const fileId = useId();
  // formularul de adaugare sta intr-un dialog deschis din placa punctata
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<ItemForm>(EMPTY_ITEM);
  const [file, setFile] = useState<File | null>(null);
  const preview = useObjectUrl(file);
  const [errors, setErrors] = useState<FieldErrors>({});
  // stergerea cere confirmare; tinta ramane in stare si dupa inchidere
  const [target, setTarget] = useState<PortfolioItemDto | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = add.isPending || upload.isPending;
  const errorText = useCompanyErrorText();
  const imageErrorText = useImageErrorText();
  // m4: id-ul fisierului ales, dupa ce a fost urcat (refolosit la reincercare)
  const [uploaded, setUploaded] = useState<UploadedImage | null>(null);

  const openAdd = () => {
    add.reset();
    upload.reset();
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

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!picked) return;
    const reason = localImageRejectReason(picked);
    if (reason) {
      // ce vede omul e ce se trimite: o poza respinsa nu ramane aleasa
      setFile(null);
      setErrors((prev) => ({ ...prev, image: rejectText(reason) }));
      return;
    }
    clearError('image');
    upload.reset();
    setUploaded(null);
    setFile(picked);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const parsed = portfolioItemSchema.safeParse({ title: form.title, description: form.description });
    if (!parsed.success) {
      // doar titlul (prea scurt) poate pica: descrierea e limitata din camp
      if (parsed.error.issues.some((i) => i.path[0] === 'title')) {
        setErrors((prev) => ({ ...prev, title: t('validation.titleTooShort') }));
      }
      return;
    }
    let attachmentId: string | undefined;
    if (file) {
      const chosen = file;
      try {
        attachmentId = await upload.mutateAsync({
          file: chosen,
          // m4: fisierul ales a fost deja urcat → doar reconfirmarea, fara un nou PUT
          resumeAttachmentId: uploaded?.file === chosen ? uploaded.attachmentId : undefined,
          onUploaded: (id) => setUploaded({ file: chosen, attachmentId: id }),
        });
      } catch (err) {
        if (forgetsUpload(err)) setUploaded(null);
        setErrors((prev) => ({ ...prev, image: imageErrorText(err) }));
        return;
      }
    }
    add.mutate(
      { title: parsed.data.title, description: parsed.data.description || undefined, attachmentId },
      {
        onSuccess: () => {
          setForm(EMPTY_ITEM);
          setFile(null);
          setUploaded(null);
          setErrors({});
          setAddOpen(false);
        },
        onError: (err) => {
          if (forgetsUpload(err)) setUploaded(null);
        },
      },
    );
  };

  return (
    <CompanySection id="portfolio" title={t('portfolio')} aside={t('portfolioHint')}>
      {company.portfolio.length === 0 && <p className="text-sm text-muted-foreground">{t('noPortfolio')}</p>}

      {(company.portfolio.length > 0 || canManage) && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-4">
          {company.portfolio.map((p) => (
            <PortfolioCard key={p.id} item={p} canManage={canManage} onDelete={askDelete} />
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
        <Dialog open={addOpen} onOpenChange={(open) => !busy && setAddOpen(open)}>
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
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <Field label={t('portfolioImage')} htmlFor={fileId} hint={t('portfolioImageHint')} error={errors.image}>
                <div className="flex flex-wrap items-center gap-3">
                  {preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="size-16 rounded-md border border-border object-cover" />
                  )}
                  <label
                    htmlFor={fileId}
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-border-2 bg-surface px-3.5 text-sm font-medium transition-colors hover:border-foreground focus-within:ring-2 focus-within:ring-walnut"
                  >
                    <ImagePlus aria-hidden className="size-4" />
                    {file ? t('portfolioImageChange') : t('portfolioImagePick')}
                    <input
                      id={fileId}
                      type="file"
                      accept={ACCEPT}
                      className="sr-only"
                      aria-invalid={errors.image ? true : undefined}
                      onChange={pickFile}
                    />
                  </label>
                  {file && <span className="min-w-0 truncate text-xs text-muted-foreground">{file.name}</span>}
                </div>
              </Field>
              {add.error && (
                <Alert tone="crimson" icon={<AlertTriangle />} role="alert">
                  {errorText(add.error)}
                </Alert>
              )}
              <DialogFooter className="mt-2">
                <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => setAddOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" size="lg" disabled={busy}>
                  {upload.isPending && <Loader2 aria-hidden className="animate-spin" />}
                  {upload.isPending ? t('portfolioImageUploading') : t('addPortfolioItem')}
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
