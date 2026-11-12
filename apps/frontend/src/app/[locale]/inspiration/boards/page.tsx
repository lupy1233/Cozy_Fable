'use client';

import { MAX_BOARD_NAME_LENGTH, type InspirationBoardDto } from '@marketplace/shared';
import { AlertTriangle, Bookmark, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { useMe, useSessionRole } from '@/hooks/use-auth';
import { useBoards, useCreateBoard } from '@/hooks/use-inspiration-boards';
import { cn } from '@/lib/utils';
import { PublicShell } from '../../_components/public-shell';

// "Colectiile mele" (item 8; design 2026-11): grila de cartonase — primul e mereu
// formularul punctat "Colectie noua" (crearea nu mai sta ascunsa intr-un buton),
// apoi colectiile cu coperta colaj (o imagine mare + doua mici), nume, numar de
// salvari si linkul spre cererea de oferte.

// auto-fill (nu auto-fit): cu una-doua colectii cartonasele isi pastreaza latimea
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] items-stretch gap-5';

const textLink = 'font-medium text-walnut transition-colors hover:text-walnut-deep hover:underline';

export default function BoardsPage() {
  const t = useTranslations('Inspiration');
  const router = useRouter();
  const me = useMe();
  const { role } = useSessionRole();
  const boards = useBoards();
  const create = useCreateBoard();
  const [name, setName] = useState('');
  const formTitleId = useId();
  const err = create.error instanceof ApiError ? create.error.code : create.isError ? 'UNKNOWN' : null;
  // cererea de oferte o face clientul — firmele/adminul nu primesc linkul
  const canRequest = role === 'CLIENT';

  useEffect(() => {
    if (me.isError) router.replace('/login?redirect=/inspiration/boards');
  }, [me.isError, router]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(trimmed, { onSuccess: () => setName('') });
  };

  return (
    <PublicShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href="/inspiration" className={cn('inline-flex min-h-11 items-center gap-1.5 self-start', textLink)}>
            <span aria-hidden>←</span>
            {t('backToGallery')}
          </Link>
          <h1 className="page-title">{t('myBoards')}</h1>
          <p className="max-w-[620px] text-lead text-muted-foreground">{t('boardsSubtitle')}</p>
        </div>

        {/* eroare pentru lista de colectii (audit 2026-08-19 P1) */}
        {boards.isError && !me.isError && (
          <Alert
            tone="amber"
            icon={<AlertTriangle />}
            title={t('boardsLoadError')}
            className="items-center"
            action={
              <Button variant="outline" size="sm" onClick={() => boards.refetch()}>
                {t('retry')}
              </Button>
            }
          />
        )}

        <div className={GRID}>
          {/* crearea e mereu la vedere: cartonasul punctat, primul din grila */}
          <form
            onSubmit={submit}
            aria-labelledby={formTitleId}
            className="flex flex-col justify-center gap-3 rounded-xl border border-dashed border-muted-2 bg-surface-2 p-5"
          >
            <h2 id={formTitleId} className="heading-section">
              {t('createBoard')}
            </h2>
            <Field
              label={t('boardNameLabel')}
              hint={t('boardNameHint', { max: MAX_BOARD_NAME_LENGTH })}
              error={
                err && <span role="alert">{err === 'BOARD_NAME_TAKEN' ? t('boardNameTaken') : t('boardError')}</span>
              }
            >
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // eroarea tine de numele trimis; la editare dispare
                  if (create.isError) create.reset();
                }}
                placeholder={t('boardNamePlaceholder')}
                maxLength={MAX_BOARD_NAME_LENGTH}
                autoComplete="off"
                className="h-11"
              />
            </Field>
            <Button type="submit" variant="walnut" className="h-11" disabled={create.isPending || !name.trim()}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {t('createBoardCta')}
            </Button>
          </form>

          {/* incarcare: cartonase-schelet in aceeasi grila */}
          {boards.isPending && (
            <LoadingRegion className="contents">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="min-h-60 rounded-xl" />
              ))}
            </LoadingRegion>
          )}

          {boards.isSuccess && boards.data.length === 0 && (
            <EmptyState
              variant="card"
              icon={Bookmark}
              title={t('noBoardsTitle')}
              hint={t('noBoardsHint')}
              className="flex items-center justify-center px-5"
              action={
                <Button asChild variant="outline">
                  <Link href="/inspiration">{t('exploreGallery')}</Link>
                </Button>
              }
            />
          )}

          {boards.data?.map((b) => <BoardCard key={b.id} board={b} canRequest={canRequest} />)}
        </div>
      </div>
    </PublicShell>
  );
}

function BoardCard({ board, canRequest }: { board: InspirationBoardDto; canRequest: boolean }) {
  const t = useTranslations('Inspiration');
  const href = `/inspiration/boards/${board.id}`;
  const hasItems = board.itemsCount > 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {hasItems ? (
        // coperta colaj: 1 mare + 2 mici. Linkul accesibil e numele colectiei de mai jos;
        // coperta ramane doar tinta de click (fara al doilea tab stop spre aceeasi pagina).
        <Link
          href={href}
          aria-hidden
          tabIndex={-1}
          className="grid aspect-[4/3] grid-cols-[minmax(0,2fr)_minmax(0,1fr)] grid-rows-2 gap-0.5 bg-border"
        >
          <CoverCell url={board.coverUrls[0]} className="row-span-2" />
          <CoverCell url={board.coverUrls[1]} placeholder="+" />
          <CoverCell url={board.coverUrls[2]} placeholder={board.coverUrls[1] ? '+' : undefined} />
        </Link>
      ) : (
        // colectie goala: coperta trimite spre galerie, unde se salveaza idei
        <Link
          href="/inspiration"
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-surface-3 px-5 text-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bookmark className="h-6 w-6 text-walnut" aria-hidden />
          <span>{t('emptyBoardCover')}</span>
        </Link>
      )}
      <div className="flex flex-col gap-1.5 px-4 pb-4 pt-3.5">
        <h2 className="heading-card break-words">
          <Link href={href} className="transition-colors hover:text-walnut">
            {board.name}
          </Link>
        </h2>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1.5 text-ui">
          <span className="text-muted-foreground">{t('pinCount', { n: board.itemsCount })}</span>
          {hasItems ? (
            canRequest && (
              <Link href="/requests/new" className={textLink}>
                {t('useInRequest')} <span aria-hidden>→</span>
              </Link>
            )
          ) : (
            <Link href="/inspiration" className={textLink}>
              {t('exploreGallery')} <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function CoverCell({ url, className, placeholder }: { url?: string; className?: string; placeholder?: ReactNode }) {
  if (!url) {
    return (
      <div className={cn('grid min-h-0 place-items-center bg-surface-3 text-xl text-muted-foreground', className)}>
        {placeholder}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className={cn('h-full min-h-0 w-full object-cover', className)} />;
}
