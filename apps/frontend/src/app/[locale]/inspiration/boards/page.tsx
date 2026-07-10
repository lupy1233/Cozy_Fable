'use client';

import { FolderHeart, Plus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-auth';
import { useBoards, useCreateBoard } from '@/hooks/use-inspiration-boards';
import { PublicShell } from '../../_components/public-shell';

// "Colectiile mele" (item 8): grila de colectii in stil Pinterest — coperta
// colaj (o imagine mare + doua mici), nume, numar de salvari.

export default function BoardsPage() {
  const t = useTranslations('Inspiration');
  const router = useRouter();
  const me = useMe();
  const boards = useBoards();
  const create = useCreateBoard();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const err = create.error instanceof ApiError ? create.error.code : null;

  useEffect(() => {
    if (me.isError) router.replace('/login?redirect=/inspiration/boards');
  }, [me.isError, router]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, {
      onSuccess: () => {
        setName('');
        setCreating(false);
      },
    });
  };

  return (
    <PublicShell>
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/inspiration" className="text-sm text-walnut hover:underline">
              ← {t('backToGallery')}
            </Link>
            <h1 className="page-title mt-2">{t('myBoards')}</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">{t('boardsSubtitle')}</p>
          </div>
          <Button variant="walnut" onClick={() => setCreating((o) => !o)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('createBoard')}
          </Button>
        </div>

        {creating && (
          <div className="flex max-w-md items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={t('newBoardPlaceholder')}
              maxLength={60}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border-2 bg-card px-3 text-sm outline-none focus:border-walnut"
            />
            <Button variant="walnut" onClick={submit} disabled={create.isPending || !name.trim()}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('createBoardCta')}
            </Button>
          </div>
        )}
        {err && (
          <p className="text-sm text-crimson">
            {err === 'BOARD_NAME_TAKEN' ? t('boardNameTaken') : t('boardError')}
          </p>
        )}

        {boards.isSuccess && boards.data.length === 0 && !creating && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-2 bg-card px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-walnut-soft text-walnut">
              <FolderHeart className="h-6 w-6" />
            </span>
            <p className="font-serif text-xl">{t('noBoardsTitle')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('noBoardsHint')}</p>
            <Button asChild variant="walnut" className="mt-2">
              <Link href="/inspiration">{t('exploreGallery')}</Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {boards.data?.map((b) => (
            <Link key={b.id} href={`/inspiration/boards/${b.id}`} className="group flex flex-col gap-2">
              {/* coperta colaj: 1 mare + 2 mici, ca pe Pinterest */}
              <div className="grid aspect-[4/3] grid-cols-3 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl border border-border bg-surface-2">
                <CoverCell url={b.coverUrls[0]} className="col-span-2 row-span-2" />
                <CoverCell url={b.coverUrls[1]} />
                <CoverCell url={b.coverUrls[2]} />
              </div>
              <div>
                <p className="font-serif text-lg leading-tight transition-colors group-hover:text-walnut">
                  {b.name}
                </p>
                <p className="text-xs text-muted-foreground">{t('pinCount', { n: b.itemsCount })}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}

function CoverCell({ url, className }: { url?: string; className?: string }) {
  if (!url) return <div className={`bg-surface-2 ${className ?? ''}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`h-full w-full object-cover ${className ?? ''}`} />;
}
