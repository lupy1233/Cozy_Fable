'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  INSPIRATION_COLORS,
  ROOM_TYPES,
  type InspirationColor,
  type InspirationPhotoDto,
  type ItemSystem,
  type Material,
  type RoomType,
} from '@marketplace/shared';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useAdminCompanies } from '@/hooks/use-company';
import {
  useAdminInspiration,
  useCreateInspiration,
  useDeleteInspiration,
  useUpdateInspiration,
  useUploadInspirationImage,
} from '@/hooks/use-admin-inspiration';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Administrarea galeriei de inspiratie (F6, item 3): adaugare poze cu
// atribuirea atelierului + etichete de filtrare (culori/materiale/deschidere),
// publicare/featured si stergere (soft). Imaginea: upload sau URL extern.

const TAG_MATERIALS: Material[] = ['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV'];
const TAG_SYSTEMS: ItemSystem[] = ['MANER', 'PUSH', 'GOLA', 'AVENTOS', 'GLISANTE'];

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function TagPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
        active ? 'border-walnut bg-walnut-soft text-walnut' : 'border-border-2 text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function AdminInspirationPage() {
  const t = useTranslations('AdminInspiration');
  const tc = useTranslations('Configurator');
  const ti = useTranslations('Inspiration');
  const router = useRouter();
  const me = useMe();
  const list = useAdminInspiration();
  const companies = useAdminCompanies();
  const create = useCreateInspiration();
  const update = useUpdateInspiration();
  const remove = useDeleteInspiration();
  const upload = useUploadInspirationImage();

  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('KITCHEN');
  const [colors, setColors] = useState<InspirationColor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [systems, setSystems] = useState<ItemSystem[]>([]);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending || me.data?.role !== 'ADMIN') return null;

  const submit = () => {
    if (!title.trim() || !companyId) return;
    create.mutate(
      {
        title: title.trim(),
        companyId,
        roomType,
        colors,
        materials,
        systems,
        imageUrl: imageUrl.trim() || undefined,
        published: true,
      },
      {
        onSuccess: () => {
          setTitle('');
          setImageUrl('');
          setColors([]);
          setMaterials([]);
          setSystems([]);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">{t('title')}</h1>

      {/* adaugare poza */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 font-serif text-lg">{t('addTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fields.title')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          </Field>
          <Field label={t('fields.company')}>
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">—</option>
              {companies.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('fields.roomType')}>
            <Select value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)}>
              {ROOM_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {tc(`rooms.type.${rt}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('fields.imageUrl')} hint={t('fields.imageUrlHint')}>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="label">{ti('filters.color')}</span>
          {INSPIRATION_COLORS.map((c) => (
            <TagPill key={c} active={colors.includes(c)} onClick={() => setColors(toggle(colors, c))}>
              {ti(`colors.${c}`)}
            </TagPill>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="label">{ti('filters.material')}</span>
          {TAG_MATERIALS.map((m) => (
            <TagPill key={m} active={materials.includes(m)} onClick={() => setMaterials(toggle(materials, m))}>
              {tc(`common.materials.${m}.label`)}
            </TagPill>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="label">{ti('filters.opening')}</span>
          {TAG_SYSTEMS.map((s) => (
            <TagPill key={s} active={systems.includes(s)} onClick={() => setSystems(toggle(systems, s))}>
              {tc(`common.systems.${s}.label`)}
            </TagPill>
          ))}
        </div>

        <Button
          type="button"
          variant="walnut"
          className="mt-4"
          disabled={!title.trim() || !companyId || create.isPending}
          onClick={submit}
        >
          {t('addButton')}
        </Button>
      </section>

      {/* lista */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.data?.map((p) => (
          <PhotoCard
            key={p.id}
            photo={p}
            onToggle={(patch) => update.mutate({ id: p.id, patch })}
            onDelete={() => remove.mutate(p.id)}
            onUpload={(file) => upload.mutate({ id: p.id, file })}
            uploading={upload.isPending && upload.variables?.id === p.id}
          />
        ))}
        {list.data?.length === 0 && (
          <p className="col-span-full py-10 text-center text-muted-foreground">{t('empty')}</p>
        )}
      </section>
    </div>
  );
}

function PhotoCard({
  photo,
  onToggle,
  onDelete,
  onUpload,
  uploading,
}: {
  photo: InspirationPhotoDto;
  onToggle: (patch: { published?: boolean; featured?: boolean }) => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const t = useTranslations('AdminInspiration');
  const tc = useTranslations('Configurator');
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {photo.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.imageUrl} alt={photo.title} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="grid aspect-[4/3] w-full place-items-center bg-surface-2 text-xs text-muted-foreground">
          {t('noImage')}
        </div>
      )}
      <div className="flex flex-col gap-2 p-3">
        <div>
          <p className="truncate text-sm font-medium">{photo.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {photo.company.name} · {tc(`rooms.type.${photo.roomType}`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              className="accent-walnut"
              checked={photo.published}
              onChange={(e) => onToggle({ published: e.target.checked })}
            />
            {t('published')}
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              className="accent-walnut"
              checked={photo.featured}
              onChange={(e) => onToggle({ featured: e.target.checked })}
            />
            {t('featured')}
          </label>
          <label className="ml-auto cursor-pointer text-walnut hover:underline">
            {uploading ? '…' : t('uploadImage')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = '';
              }}
            />
          </label>
          <button type="button" onClick={onDelete} className="text-crimson hover:underline">
            {t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
