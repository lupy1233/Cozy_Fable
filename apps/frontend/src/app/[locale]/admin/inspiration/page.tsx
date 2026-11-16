'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InspirationPhotoDto } from '@marketplace/shared';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import {
  useAdminInspiration,
  useDeleteInspiration,
  useUpdateInspiration,
  useUploadInspirationImage,
} from '@/hooks/use-admin-inspiration';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonList, SkeletonPage } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { AddPhotoForm } from './_components/add-photo-form';
import { EditTagsDialog } from './_components/edit-tags-dialog';
import { PhotoCard } from './_components/photo-card';

// Administrarea galeriei de inspiratie (F6, item 3): adaugare poze cu atribuirea firmei +
// etichete de filtrare (culori/materiale/deschidere), publicare/featured si stergere (soft).
// Imaginea: upload sau URL extern. Lista se filtreaza si se cauta pe client.

type ListFilter = 'all' | 'published' | 'featured' | 'noImage';

const MATCH: Record<ListFilter, (p: InspirationPhotoDto) => boolean> = {
  all: () => true,
  published: (p) => p.published,
  featured: (p) => p.featured,
  noImage: (p) => !p.imageUrl,
};

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-4';

// cautare fara diacritice si fara majuscule
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function AdminInspirationPage() {
  const t = useTranslations('AdminInspiration');
  const router = useRouter();
  const me = useMe();
  const list = useAdminInspiration();
  const update = useUpdateInspiration();
  const remove = useDeleteInspiration();
  const upload = useUploadInspirationImage();

  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending || me.data?.role !== 'ADMIN') return <SkeletonPage variant="list" />;

  const photos = list.data ?? [];
  const count = (f: ListFilter) => photos.filter(MATCH[f]).length;
  const q = norm(query.trim());
  const visible = photos.filter((p) => MATCH[filter](p) && (!q || norm(`${p.title} ${p.company.name}`).includes(q)));
  const editing = photos.find((p) => p.id === editingId) ?? null;
  const fail = () => toast.error(t('actionError'));

  return (
    <div className="flex max-w-[1180px] flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
            <FilterChips<ListFilter>
              label={t('filterLabel')}
              value={filter}
              onChange={(v) => setFilter(v ?? 'all')}
              options={[
                { value: 'all', label: t('filter.all'), count: count('all') },
                { value: 'published', label: t('filter.published'), count: count('published') },
                { value: 'featured', label: t('filter.featured'), count: count('featured') },
                { value: 'noImage', label: t('filter.noImage'), count: count('noImage') },
              ]}
            />
            <label className="flex h-10 min-w-0 flex-[1_1_200px] items-center gap-2 rounded-md border border-border-2 bg-surface px-3 transition-colors focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/5 sm:max-w-[280px]">
              <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">{t('search')}</span>
              <input
                type="search"
                value={query}
                placeholder={t('search')}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-2"
              />
            </label>
          </div>

          {list.isPending && <SkeletonList rows={6} variant="cards" className={GRID} />}
          {list.isError && <LoadError onRetry={() => void list.refetch()} />}

          {visible.length > 0 && (
            <div className={GRID}>
              {visible.map((p) => (
                <PhotoCard
                  key={p.id}
                  photo={p}
                  onToggle={(patch) => update.mutate({ id: p.id, patch }, { onError: fail })}
                  onDelete={() => remove.mutate(p.id, { onError: fail })}
                  onUpload={(file) => upload.mutate({ id: p.id, file }, { onError: () => toast.error(t('uploadError')) })}
                  onEdit={() => setEditingId(p.id)}
                  uploading={upload.isPending && upload.variables?.id === p.id}
                />
              ))}
            </div>
          )}

          {list.data && photos.length === 0 && <EmptyState variant="card" size="sm" title={t('empty')} />}
          {photos.length > 0 && visible.length === 0 && (
            <EmptyState
              variant="dashed"
              size="sm"
              title={t('emptyFiltered')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilter('all');
                    setQuery('');
                  }}
                >
                  {t('showAll')}
                </Button>
              }
            />
          )}
        </div>

        <AddPhotoForm />
      </div>

      {editing && <EditTagsDialog key={editing.id} photo={editing} onClose={() => setEditingId(null)} />}
    </div>
  );
}
