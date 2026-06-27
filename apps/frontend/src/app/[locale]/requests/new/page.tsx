'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BUDGET_RANGES,
  ITEM_SYSTEMS,
  MATERIALS,
  ROOM_TYPES,
  requestContentSchema,
  type RequestContentInput,
} from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import {
  useCreateDraft,
  useDraft,
  usePublishDraft,
  useRemoveAttachment,
  useUploadAttachment,
} from '@/hooks/use-requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';

const DRAFT_TOKEN_KEY = 'mm_draft_token';

const emptyItem = { name: '', material: 'PAL' as const, systems: [], quantity: 1, description: '' };
const emptyRoom = { roomType: 'KITCHEN' as const, lengthM: 1, widthM: 1, heightM: 1, items: [emptyItem] };

// Sectiune de formular cu titlu serif (din prototip).
function FormSection({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function NewRequestPage() {
  const [token, setToken] = useState<string | null>(null);
  const createDraft = useCreateDraft();
  const created = useRef(false);

  // La montare: refoloseste tokenul din localStorage sau creeaza un draft nou.
  useEffect(() => {
    if (created.current) return;
    created.current = true;
    const existing = typeof window !== 'undefined' ? localStorage.getItem(DRAFT_TOKEN_KEY) : null;
    if (existing) {
      setToken(existing);
      return;
    }
    createDraft.mutate(
      {},
      {
        onSuccess: (res) => {
          localStorage.setItem(DRAFT_TOKEN_KEY, res.draftToken);
          setToken(res.draftToken);
        },
      },
    );
  }, [createDraft]);

  const t = useTranslations('Requests');
  if (!token) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }
  return <Wizard token={token} />;
}

function Wizard({ token }: { token: string }) {
  const t = useTranslations('Requests');
  const router = useRouter();
  const draft = useDraft(token);
  const publish = usePublishDraft(token);
  const uploadAttachment = useUploadAttachment(token);
  const removeAttachment = useRemoveAttachment(token);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestContentInput>({
    resolver: zodResolver(requestContentSchema),
    defaultValues: {
      title: '',
      description: '',
      budgetRange: 'UNDER_5K',
      desiredDeadline: '',
      includesPaidDesign: false,
      hasOwnProject: false,
      addressText: '',
      county: '',
      city: '',
      rooms: [emptyRoom],
      contactPreferences: [{ channel: '', value: '', priority: 1 }],
    },
  });

  const rooms = useFieldArray({ control, name: 'rooms' });
  const contacts = useFieldArray({ control, name: 'contactPreferences' });

  const onSubmit = handleSubmit((values) =>
    publish.mutate(values, {
      onSuccess: (req) => {
        // pastreaza tokenul legat de cerere pentru repost/editare ulterioara
        localStorage.setItem(`mm_req_token_${req.id}`, token);
        localStorage.removeItem(DRAFT_TOKEN_KEY);
        router.push(`/requests/${req.id}`);
      },
    }),
  );

  const vmsg = (msg?: string) => (msg ? t(`validation.${msg}`) : undefined);
  const apiErr = publish.error instanceof ApiError ? publish.error.code : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="page-title">{t('newTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('newSubtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        {/* Detalii generale */}
        <FormSection title={t('sectionGeneral')}>
          <Field label={t('field.title')} error={vmsg(errors.title?.message)}>
            <Input {...register('title')} />
          </Field>
          <Field label={t('field.description')} error={vmsg(errors.description?.message)}>
            <Textarea rows={4} {...register('description')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('field.budgetRange')}>
              <Select {...register('budgetRange')}>
                {BUDGET_RANGES.map((b) => (
                  <option key={b} value={b}>
                    {t(`budget.${b}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('field.desiredDeadline')}>
              <Input type="date" {...register('desiredDeadline')} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-walnut" {...register('includesPaidDesign')} />
              {t('field.includesPaidDesign')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-walnut" {...register('hasOwnProject')} />
              {t('field.hasOwnProject')}
            </label>
          </div>
        </FormSection>

        {/* Adresa */}
        <FormSection title={t('sectionAddress')}>
          <Field label={t('field.addressText')} error={vmsg(errors.addressText?.message)}>
            <Input {...register('addressText')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('field.county')} error={vmsg(errors.county?.message)}>
              <Input {...register('county')} />
            </Field>
            <Field label={t('field.city')} error={vmsg(errors.city?.message)}>
              <Input {...register('city')} />
            </Field>
          </div>
        </FormSection>

        {/* Camere */}
        <FormSection
          title={t('sectionRooms')}
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => rooms.append(emptyRoom)}>
              {t('addRoom')}
            </Button>
          }
        >
          {errors.rooms?.message && (
            <span className="text-xs text-crimson">{t(`validation.${errors.rooms.message}`)}</span>
          )}
          {rooms.fields.map((room, ri) => (
            <RoomFields
              key={room.id}
              control={control}
              register={register}
              errors={errors}
              index={ri}
              onRemove={() => rooms.remove(ri)}
              canRemove={rooms.fields.length > 1}
            />
          ))}
        </FormSection>

        {/* Preferinte contact */}
        <FormSection
          title={t('sectionContact')}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => contacts.append({ channel: '', value: '', priority: contacts.fields.length + 1 })}
              disabled={contacts.fields.length >= 5}
            >
              {t('addContact')}
            </Button>
          }
        >
          {contacts.fields.map((c, ci) => (
            <div key={c.id} className="grid grid-cols-[1fr_2fr_auto_auto] items-end gap-3">
              <Field label={t('field.contactChannel')}>
                <Input {...register(`contactPreferences.${ci}.channel` as const)} />
              </Field>
              <Field label={t('field.contactValue')}>
                <Input {...register(`contactPreferences.${ci}.value` as const)} />
              </Field>
              <Field label={t('field.contactPriority')}>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  className="w-16"
                  {...register(`contactPreferences.${ci}.priority` as const, { valueAsNumber: true })}
                />
              </Field>
              {contacts.fields.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => contacts.remove(ci)}>
                  <X className="h-4 w-4 text-crimson" />
                </Button>
              )}
            </div>
          ))}
        </FormSection>

        {/* Atasamente (upload presigned direct in storage) */}
        <FormSection title={t('sectionAttachments')}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAttachment.mutate(file);
              e.target.value = '';
            }}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-border-2 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm"
          />
          {uploadAttachment.isPending && <p className="text-xs text-muted-foreground">{t('uploading')}</p>}
          <ul className="flex flex-col gap-1.5 text-sm">
            {(draft.data?.attachments ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2"
              >
                <span className="text-muted-foreground">
                  {a.filename} · {(a.sizeBytes / 1024).toFixed(0)} KB · {a.status}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment.mutate(a.id)}
                  className="text-crimson"
                  aria-label="remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </FormSection>

        {apiErr && (
          <Alert tone="crimson">
            {t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')}
          </Alert>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" variant="walnut" size="lg" disabled={publish.isPending}>
            {t('publish')}
          </Button>
          <Link href="/requests" className="text-sm text-walnut hover:underline">
            {t('myRequests')}
          </Link>
        </div>
      </form>
    </div>
  );
}

// Subcomponenta camera: campuri + array de iteme.
type WizardControl = ReturnType<typeof useForm<RequestContentInput>>;
function RoomFields({
  control,
  register,
  errors,
  index,
  onRemove,
  canRemove,
}: {
  control: WizardControl['control'];
  register: WizardControl['register'];
  errors: WizardControl['formState']['errors'];
  index: number;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const t = useTranslations('Requests');
  const items = useFieldArray({ control, name: `rooms.${index}.items` as const });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-2 bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          {t('room')} #{index + 1}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-sm text-crimson">
            {t('removeRoom')}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label={t('field.roomType')}>
          <Select {...register(`rooms.${index}.roomType` as const)}>
            {ROOM_TYPES.map((r) => (
              <option key={r} value={r}>
                {t(`roomType.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('field.lengthM')}>
          <Input
            type="number"
            step="any"
            {...register(`rooms.${index}.lengthM` as const, { valueAsNumber: true })}
          />
        </Field>
        <Field label={t('field.widthM')}>
          <Input
            type="number"
            step="any"
            {...register(`rooms.${index}.widthM` as const, { valueAsNumber: true })}
          />
        </Field>
        <Field label={t('field.heightM')}>
          <Input
            type="number"
            step="any"
            {...register(`rooms.${index}.heightM` as const, { valueAsNumber: true })}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          {t('items')}
        </span>
        <Button type="button" variant="secondary" size="sm" onClick={() => items.append(emptyItem)}>
          {t('addItem')}
        </Button>
      </div>
      {items.fields.map((item, ii) => (
        <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label={t('field.itemName')} className="col-span-2">
              <Input {...register(`rooms.${index}.items.${ii}.name` as const)} />
            </Field>
            <Field label={t('field.material')}>
              <Select {...register(`rooms.${index}.items.${ii}.material` as const)}>
                {MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {t(`material.${m}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('field.quantity')}>
              <Input
                type="number"
                min={1}
                {...register(`rooms.${index}.items.${ii}.quantity` as const, { valueAsNumber: true })}
              />
            </Field>
          </div>
          <Controller
            control={control}
            name={`rooms.${index}.items.${ii}.systems` as const}
            render={({ field }) => (
              <div className="flex flex-wrap gap-3 text-sm">
                {ITEM_SYSTEMS.map((s) => {
                  const checked = (field.value ?? []).includes(s);
                  return (
                    <label key={s} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="accent-walnut"
                        checked={checked}
                        onChange={(e) => {
                          const set = new Set(field.value ?? []);
                          if (e.target.checked) set.add(s);
                          else set.delete(s);
                          field.onChange([...set]);
                        }}
                      />
                      {t(`system.${s}`)}
                    </label>
                  );
                })}
              </div>
            )}
          />
          {items.fields.length > 1 && (
            <button
              type="button"
              onClick={() => items.remove(ii)}
              className="self-start text-sm text-crimson"
            >
              {t('removeItem')}
            </button>
          )}
        </div>
      ))}
      {errors.rooms?.[index]?.items?.message && (
        <span className="text-xs text-crimson">{t(`validation.${errors.rooms[index]?.items?.message}`)}</span>
      )}
    </div>
  );
}
