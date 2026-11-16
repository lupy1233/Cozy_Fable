'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Design 2026-11: asezarea comuna a paginilor juridice (Termeni, Confidentialitate, Reguli pentru
// firme): antet, cuprins (lipit la derulare pe desktop; pe mobil sta intre antet si text) si corpul
// articolului, cu cardul „Pe scurt” primul.

export const LEGAL_SUMMARY_ID = 'summary';

export type LegalTocItem = { id: string; label: string };

// o sectiune devine "curenta" cand titlul ei trece de aceasta linie (sub headerul lipit)
const ACTIVE_LINE_PX = 128;

function useActiveSection(ids: readonly string[]) {
  const key = ids.join('|');
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (list.length === 0) return;
    const update = () => {
      let current = list[0];
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= ACTIVE_LINE_PX) current = id;
      }
      // la capatul paginii ultimele sectiuni nu mai ajung pana la linie
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActive(atBottom ? list[list.length - 1] : current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [key]);

  return active;
}

function LegalToc({ items, className }: { items: readonly LegalTocItem[]; className?: string }) {
  const t = useTranslations('Legal');
  const active = useActiveSection(items.map((item) => item.id));

  return (
    <nav
      aria-label={t('toc')}
      className={cn(
        'max-w-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:max-w-none lg:self-start lg:overflow-y-auto',
        className,
      )}
    >
      <p className="label px-3 pb-2">{t('toc')}</p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={item.id === active ? 'location' : undefined}
              className={cn(
                'block rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                item.id === active
                  ? 'bg-walnut-soft font-medium text-walnut-deep'
                  : 'text-ink-2 hover:bg-secondary hover:text-foreground',
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// `toc` null (ex. regulile inca se incarca) → coloana cuprinsului ramane rezervata pe desktop,
// ca textul sa nu sara cand apar sectiunile.
export function LegalLayout({
  header,
  toc,
  children,
}: {
  header: ReactNode;
  toc: readonly LegalTocItem[] | null;
  children: ReactNode;
}) {
  return (
    <article className="grid grid-cols-1 gap-y-8 pt-2 lg:grid-cols-[16rem_minmax(0,760px)] lg:gap-x-16 lg:gap-y-10 lg:pt-6">
      <header className="flex min-w-0 max-w-[760px] flex-col gap-3.5 lg:col-start-2 lg:row-start-1">{header}</header>
      {toc && <LegalToc items={toc} className="lg:col-start-1 lg:row-span-2 lg:row-start-1" />}
      <div className="flex min-w-0 max-w-[760px] flex-col gap-10 lg:col-start-2 lg:row-start-2">{children}</div>
    </article>
  );
}

type Block = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };

const BULLET = '• ';

// Textul ramane cel din i18n, neschimbat: \n\n desparte paragrafele, iar randurile care incep
// cu „• ” se afiseaza ca lista.
function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.split('\n\n')) {
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.join('').trim()) blocks.push({ kind: 'p', text: para.join('\n') });
      if (list.length > 0) blocks.push({ kind: 'list', items: list });
      para = [];
      list = [];
    };
    for (const line of chunk.split('\n')) {
      if (line.startsWith(BULLET)) {
        if (para.length > 0) flush();
        list.push(line.slice(BULLET.length));
      } else {
        if (list.length > 0) flush();
        para.push(line);
      }
    }
    flush();
  }
  return blocks;
}

export function LegalBody({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {toBlocks(text).map((block, i) =>
        block.kind === 'list' ? (
          <ul key={i} className={cn('flex list-disc flex-col gap-2 pl-5', className)}>
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className={cn('whitespace-pre-line', className)}>
            {block.text}
          </p>
        ),
      )}
    </>
  );
}
