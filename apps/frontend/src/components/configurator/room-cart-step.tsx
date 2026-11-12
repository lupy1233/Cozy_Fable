'use client';

import {
  compareRoomTypes,
  MAX_REQUEST_ROOMS,
  ROOM_KIND,
  ROOM_TYPES,
  type RoomType,
} from '@marketplace/shared';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { CartBasketStrip, useCartSummary } from './cart-basket';
import { CartVisual } from './cart-visual';

// Grilele vin din ROOM_KIND (room-meta): camerele in tab-ul principal, piesele
// ghidate in tab-ul "Piese individuale". PIECES (formular liber) e cartonasul
// separat "Alta piesa", mereu ultimul, cap 1 instanta.
const GRID_ROOM_TYPES = ROOM_TYPES.filter((rt) => ROOM_KIND[rt] === 'room').sort(compareRoomTypes);
const GRID_PIECE_TYPES = ROOM_TYPES.filter(
  (rt) => ROOM_KIND[rt] === 'piece' && rt !== 'PIECES',
).sort(compareRoomTypes);

// plafonul tehnic vine din schema partajata (aceeasi validare ca backend-ul)
const MAX_ROOMS = MAX_REQUEST_ROOMS;

const stepButton =
  'grid h-9 w-10 shrink-0 place-items-center rounded-md text-walnut transition-colors hover:bg-walnut-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut disabled:pointer-events-none disabled:opacity-40';

// Cartonasul unei camere / piese: redarea 3D sus, numele si ce cuprinde, apoi
// actiunea. Neadaugat: tot cartonasul e tinta de click (butonul "Adauga" ramane
// singurul buton cu numele "Adauga {tip}", pentru tastatura si cititoare de ecran).
// Adaugat: contur nuc, numarul pe poza si pasul −/+ in locul butonului.
function CartTile({
  roomType,
  count,
  disableAdd,
  onAdd,
  onRemove,
  single,
}: {
  roomType: RoomType;
  count: number;
  disableAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
  // "Alta piesa": o singura instanta — fara pas −/+, doar "Elimina"
  single?: boolean;
}) {
  const t = useTranslations('Configurator');
  const name = t(`rooms.type.${roomType}`);
  const selected = count > 0;
  const cardAdds = !selected && !disableAdd;

  return (
    <div
      data-cart-tile={roomType}
      data-selected={selected ? '' : undefined}
      onClick={cardAdds ? onAdd : undefined}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-surface transition-[border-color,box-shadow,transform] duration-150',
        selected
          ? 'border-walnut shadow-[0_0_0_1px_hsl(var(--walnut))]'
          : single
            ? 'border-dashed border-muted-2'
            : 'border-border',
        cardAdds &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-border-2 hover:shadow-md motion-reduce:hover:translate-y-0',
      )}
    >
      <div
        className={cn(
          'relative h-28 transition-colors duration-150 sm:h-32 xl:h-36',
          selected ? 'bg-walnut-soft' : 'bg-surface-2',
        )}
      >
        <span className="absolute inset-x-4 inset-y-2.5">
          <CartVisual roomType={roomType} size="tile" />
        </span>
        {selected && !single && (
          <motion.span
            key={count}
            aria-hidden
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            className="absolute right-2.5 top-2.5 grid h-7 min-w-7 place-items-center rounded-full bg-walnut px-1.5 font-mono text-xs font-medium tabular-nums text-on-walnut shadow-sm"
          >
            {count}
          </motion.span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-snug">{name}</div>
          <div className="mt-0.5 line-clamp-3 text-xs leading-snug text-muted-foreground sm:line-clamp-2">
            {t(`rooms.desc.${roomType}`)}
          </div>
        </div>

        {single ? (
          selected ? (
            <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onRemove}>
              <Minus aria-hidden />
              {t('cart.removePieces')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={disableAdd}
              onClick={(e) => {
                // cartonasul adauga si el la click: fara asta s-ar adauga de doua ori
                e.stopPropagation();
                onAdd();
              }}
            >
              <Plus aria-hidden />
              {t('cart.addPieces')}
            </Button>
          )
        ) : selected ? (
          // aceeasi inaltime ca butonul "Adauga" (h-10): randul nu sare cand se schimba starea
          <div className="flex h-10 items-center justify-between rounded-md border border-walnut/30 bg-surface px-0.5">
            <button
              type="button"
              onClick={onRemove}
              aria-label={t('cart.removeOne', { type: name })}
              className={stepButton}
            >
              <Minus aria-hidden className="h-4 w-4" />
            </button>
            <span className="font-mono text-sm tabular-nums">{count}</span>
            <button
              type="button"
              disabled={disableAdd}
              onClick={onAdd}
              aria-label={t('cart.addOne', { type: name })}
              className={stepButton}
            >
              <Plus aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            disabled={disableAdd}
            aria-label={t('cart.addOne', { type: name })}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Plus aria-hidden />
            {t('cart.add')}
          </Button>
        )}
      </div>
    </div>
  );
}

// numarul din coltul tabului: cate camere / piese sunt deja in cos. Decorativ
// (aria-hidden) — numele tabului ramane curat, iar totalul il spune cosul.
function TabCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-hidden
      className="ml-2 inline-grid h-5 min-w-5 place-items-center rounded-full bg-walnut px-1.5 font-mono text-micro font-medium tabular-nums text-on-walnut"
    >
      {count}
    </span>
  );
}

export function RoomCartStep({
  onBack,
  onContinue,
}: {
  // inapoi la pasul "Cum pornim?" (PO r9)
  onBack: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations('Configurator');
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const addRoom = useConfiguratorStore((s) => s.addRoom);
  const removeLastOfType = useConfiguratorStore((s) => s.removeLastOfType);
  const hasOwnProject = useConfiguratorStore((s) => s.details.hasOwnProject === true);
  const setDetails = useConfiguratorStore((s) => s.setDetails);

  const startMode = useConfiguratorStore((s) => s.startMode);
  const designHelp = startMode === 'DESIGN_HELP';

  const [tab, setTab] = useState<'rooms' | 'pieces'>('rooms');
  const summary = useCartSummary();

  const countOf = (rt: RoomType) => rooms.filter((r) => r.roomType === rt).length;
  const total = rooms.length;
  const roomCount = rooms.filter((r) => ROOM_KIND[r.roomType] === 'room').length;
  const full = total >= MAX_ROOMS;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl leading-[1.2] sm:text-3xl">{t('cart.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {designHelp ? t('cart.designHelpSubtitle') : t('cart.subtitle')}
        </p>
      </div>

      <Tabs
        panelId="request-cart-options"
        label={t('cart.title')}
        className="mb-0"
        current={tab}
        onChange={(v) => setTab(v as 'rooms' | 'pieces')}
        tabs={[
          {
            value: 'rooms',
            label: (
              <>
                {t('cart.tabRooms')}
                <TabCount count={roomCount} />
              </>
            ),
          },
          {
            value: 'pieces',
            label: (
              <>
                {t('cart.tabPieces')}
                <TabCount count={total - roomCount} />
              </>
            ),
          },
        ]}
      />

      {/* cosul cererii: vizibil pe ambele taburi (feedback PO 2026-07-31). De la lg
          sta in coloana din dreapta (CartBasket, randat de wizard); aici e banda
          compacta pentru ecranele mici */}
      <CartBasketStrip className="lg:hidden" />

      <div
        id="request-cart-options"
        role="tabpanel"
        aria-labelledby={`request-cart-options-tab-${tab}`}
        tabIndex={0}
        className="grid grid-cols-2 gap-3 md:grid-cols-3"
      >
        {(tab === 'rooms' ? GRID_ROOM_TYPES : GRID_PIECE_TYPES).map((rt) => (
          <CartTile
            key={rt}
            roomType={rt}
            count={countOf(rt)}
            disableAdd={full}
            onAdd={() => addRoom(rt)}
            onRemove={() => removeLastOfType(rt)}
          />
        ))}
        {/* formular liber — o singura instanta, mereu ultima in flux */}
        {tab === 'pieces' && (
          <CartTile
            roomType="PIECES"
            single
            count={countOf('PIECES')}
            disableAdd={full}
            onAdd={() => addRoom('PIECES')}
            onRemove={() => removeLastOfType('PIECES')}
          />
        )}
      </div>

      {/* proiect pentru toata locuinta → pasii de dimensiuni/schita se sar;
          irelevant pe fluxul "am nevoie de ajutor" (proiectarea o face firma) */}
      {!designHelp && (
        <label
          className={cn(
            'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-sm transition-colors',
            hasOwnProject ? 'border-walnut/50 bg-walnut-soft/60' : 'border-border bg-surface-2/60 hover:border-border-2',
          )}
        >
          <input
            type="checkbox"
            className="mt-px h-[18px] w-[18px] shrink-0 accent-walnut"
            checked={hasOwnProject}
            onChange={(e) => setDetails({ hasOwnProject: e.target.checked })}
          />
          <span>
            <span className="font-medium">{t('cart.hasOwnProject')}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('cart.hasOwnProjectHint')}
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <Button type="button" variant="outline" size="xl" className="px-4 text-sm" onClick={onBack}>
          <ArrowLeft aria-hidden />
          {t('nav.back')}
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <span className="text-ui text-muted-foreground">{summary}</span>
          <Button type="button" variant="walnut" size="xl" disabled={total === 0} onClick={onContinue}>
            {designHelp ? t('nav.continue') : t('nav.startQuestions')}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
