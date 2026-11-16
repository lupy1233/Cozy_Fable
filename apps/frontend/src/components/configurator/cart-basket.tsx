'use client';

import { ROOM_KIND, type RoomType } from '@marketplace/shared';
import { motion } from 'framer-motion';
import { ShoppingBasket, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { CartVisual } from './cart-visual';
import { roomScreens } from './room-screens';

// Cosul cererii (pasul "Camere"): ce a adaugat clientul, grupat pe tip.
// Doua infatisari ale acelorasi date:
//  - CartBasket: panoul din coloana dreapta (de la lg), pe locul pe care il ia
//    apoi "Fisa cererii" — asezarea paginii nu sare cand incep intrebarile;
//  - CartBasketStrip: banda compacta de sub taburi, pe ecrane mici.
// Ordinea e cea din store (ROOM_ORDER), adica ordinea in care vin intrebarile.

interface BasketLine {
  roomType: RoomType;
  count: number;
  // cate sectiuni are chestionarul unei instante (0 = flux necunoscut)
  sections: number;
}

function useBasketLines(): { rooms: BasketLine[]; pieces: BasketLine[]; total: number } {
  const instances = useConfiguratorStore((s) => s.roomInstances);
  const hasOwnProject = useConfiguratorStore((s) => s.details.hasOwnProject === true);
  return useMemo(() => {
    const lines = new Map<RoomType, BasketLine>();
    for (const room of instances) {
      const line = lines.get(room.roomType);
      if (line) {
        line.count += 1;
        continue;
      }
      let sections = 0;
      try {
        sections = roomScreens(room, hasOwnProject).length;
      } catch {
        sections = 0;
      }
      lines.set(room.roomType, { roomType: room.roomType, count: 1, sections });
    }
    const all = [...lines.values()];
    return {
      rooms: all.filter((l) => ROOM_KIND[l.roomType] === 'room'),
      pieces: all.filter((l) => ROOM_KIND[l.roomType] === 'piece'),
      total: instances.length,
    };
  }, [instances, hasOwnProject]);
}

// "2 camere · o piesa" — totalul cosului, pe feluri (o piesa nu e o camera)
export function useCartSummary(): string {
  const t = useTranslations('Configurator');
  const { rooms, pieces } = useBasketLines();
  const sum = (lines: BasketLine[]) => lines.reduce((n, l) => n + l.count, 0);
  const roomCount = sum(rooms);
  const pieceCount = sum(pieces);
  const parts = [
    roomCount > 0 ? t('cart.countRooms', { count: roomCount }) : null,
    pieceCount > 0 ? t('cart.countPieces', { count: pieceCount }) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : t('cart.summaryEmpty');
}

const appear = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.16, ease: 'easeOut' as const },
};

export function CartBasket({ className }: { className?: string }) {
  const t = useTranslations('Configurator');
  const { rooms, pieces, total } = useBasketLines();
  const summary = useCartSummary();
  const removeLastOfType = useConfiguratorStore((s) => s.removeLastOfType);
  const designHelp = useConfiguratorStore((s) => s.startMode === 'DESIGN_HELP');

  const groups = [
    { key: 'rooms', label: t('cart.tabRooms'), lines: rooms },
    { key: 'pieces', label: t('cart.tabPieces'), lines: pieces },
  ].filter((g) => g.lines.length > 0);

  return (
    <aside
      aria-label={t('cart.basketTitle')}
      className={cn('flex flex-col gap-4 rounded-xl border border-border-2 bg-surface-2 p-5 sm:p-6', className)}
    >
      <div className="flex flex-col gap-1">
        <h2 className="heading-section">{t('cart.basketTitle')}</h2>
        {total > 0 && <p className="text-ui text-muted-foreground">{summary}</p>}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-muted-2 px-4 py-7 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-walnut">
            <ShoppingBasket aria-hidden className="h-5 w-5" />
          </span>
          <p className="text-sm text-muted-foreground">{t('cart.basketEmpty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <p className="label">{group.label}</p>
              <ul className="flex flex-col gap-2">
                {group.lines.map((line) => {
                  const name = t(`rooms.type.${line.roomType}`);
                  return (
                    <motion.li
                      key={line.roomType}
                      layout="position"
                      {...appear}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface py-1.5 pl-1.5 pr-1"
                    >
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-surface-2">
                        <span className="absolute inset-1">
                          <CartVisual roomType={line.roomType} size="thumb" />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{name}</span>
                        <span className="block truncate text-ui text-muted-foreground">
                          {designHelp
                            ? t('sheet.withDesigner')
                            : line.sections > 0
                              ? t('sheet.sections', { count: line.sections })
                              : t(`rooms.desc.${line.roomType}`)}
                        </span>
                      </span>
                      {line.count > 1 && (
                        <span className="shrink-0 rounded-full bg-walnut-soft px-2 py-0.5 font-mono text-xs tabular-nums text-walnut">
                          ×&thinsp;{line.count}
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={t('cart.basketRemove', { type: name })}
                        onClick={() => removeLastOfType(line.roomType)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-walnut-soft hover:text-walnut focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut"
                      >
                        <X aria-hidden className="h-4 w-4" />
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {total > 0 && !designHelp && (
        <p className="border-t border-dashed border-muted-2 pt-4 text-xs leading-relaxed text-muted-foreground">
          {t('cart.basketNext')}
        </p>
      )}
    </aside>
  );
}

export function CartBasketStrip({ className }: { className?: string }) {
  const t = useTranslations('Configurator');
  const { rooms, pieces, total } = useBasketLines();
  const summary = useCartSummary();
  const removeLastOfType = useConfiguratorStore((s) => s.removeLastOfType);
  const lines = [...rooms, ...pieces];

  return (
    <div className={cn('rounded-xl border border-border-2 bg-surface-2/60 px-4 py-3.5', className)}>
      <div className="mb-2 flex items-center gap-2">
        <ShoppingBasket aria-hidden className="h-4 w-4 text-walnut" />
        <span className="text-sm font-medium">{t('cart.basketTitle')}</span>
        {total > 0 && <span className="ml-auto text-ui text-muted-foreground">{summary}</span>}
      </div>
      {total === 0 ? (
        <p className="flex min-h-9 items-center text-sm text-muted-foreground">{t('cart.basketEmpty')}</p>
      ) : (
        // pe telefon: un singur rand care se deruleaza lateral — banda isi pastreaza
        // inaltimea, deci catalogul de dedesubt nu sare cand adaugi ceva
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {lines.map((line) => {
            const name = t(`rooms.type.${line.roomType}`);
            return (
              <motion.li
                key={line.roomType}
                layout="position"
                {...appear}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-walnut/40 bg-surface py-0.5 pl-0.5 pr-1 text-sm text-walnut"
              >
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-surface-2">
                  <span className="absolute inset-1">
                    <CartVisual roomType={line.roomType} size="thumb" />
                  </span>
                </span>
                {line.count > 1 && <span className="font-mono text-xs tabular-nums">{line.count}&thinsp;×</span>}
                <span>{name}</span>
                <button
                  type="button"
                  aria-label={t('cart.basketRemove', { type: name })}
                  onClick={() => removeLastOfType(line.roomType)}
                  className="grid h-8 w-8 place-items-center rounded-full text-walnut/70 transition-colors hover:bg-walnut/15 hover:text-walnut focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut"
                >
                  <X aria-hidden className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
