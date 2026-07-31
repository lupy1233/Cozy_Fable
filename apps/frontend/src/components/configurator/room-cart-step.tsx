'use client';

import {
  compareRoomTypes,
  MAX_REQUEST_ROOMS,
  ROOM_KIND,
  ROOM_TYPES,
  type RoomType,
} from '@marketplace/shared';
import { motion } from 'framer-motion';
import { Minus, Plus, ShoppingBasket, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { ConfiguratorIcon } from '@/lib/configurator-icons';
import { ROOM_ICONS } from '@/lib/room-icons';
import { useConfiguratorStore } from '@/stores/configurator-store';

// Grilele vin din ROOM_KIND (room-meta): camerele in tab-ul principal, piesele
// ghidate in tab-ul "Piese individuale". PIECES (formular liber) e cardul
// separat "Alta piesa", mereu ultimul, cap 1 instanta.
const GRID_ROOM_TYPES = ROOM_TYPES.filter((rt) => ROOM_KIND[rt] === 'room').sort(compareRoomTypes);
const GRID_PIECE_TYPES = ROOM_TYPES.filter(
  (rt) => ROOM_KIND[rt] === 'piece' && rt !== 'PIECES',
).sort(compareRoomTypes);

// plafonul tehnic vine din schema partajata (aceeasi validare ca backend-ul)
const MAX_ROOMS = MAX_REQUEST_ROOMS;

function CartTile({
  roomType,
  count,
  disableAdd,
  onAdd,
  onRemove,
}: {
  roomType: RoomType;
  count: number;
  disableAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('Configurator');
  return (
    <div
      className={
        'flex items-center gap-3 rounded-xl border p-4 transition-colors ' +
        (count > 0 ? 'border-walnut bg-walnut-soft' : 'border-border-2 bg-surface')
      }
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-walnut [&_svg]:size-5">
        <ConfiguratorIcon name={ROOM_ICONS[roomType]} />
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium">{t(`rooms.type.${roomType}`)}</div>
        <div className="text-xs text-muted-foreground">{t(`rooms.desc.${roomType}`)}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={count === 0}
          onClick={onRemove}
          aria-label={t('cart.removeOne', { type: t(`rooms.type.${roomType}`) })}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <motion.span
          key={count}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 24 }}
          className="w-5 text-center font-mono text-sm"
        >
          {count}
        </motion.span>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={disableAdd}
          onClick={onAdd}
          aria-label={t('cart.addOne', { type: t(`rooms.type.${roomType}`) })}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function RoomCartStep({ onContinue }: { onContinue: () => void }) {
  const t = useTranslations('Configurator');
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const addRoom = useConfiguratorStore((s) => s.addRoom);
  const removeLastOfType = useConfiguratorStore((s) => s.removeLastOfType);
  const hasOwnProject = useConfiguratorStore((s) => s.details.hasOwnProject === true);
  const setDetails = useConfiguratorStore((s) => s.setDetails);

  const startMode = useConfiguratorStore((s) => s.startMode);
  const designHelp = startMode === 'DESIGN_HELP';

  const [tab, setTab] = useState<'rooms' | 'pieces'>('rooms');

  const countOf = (rt: RoomType) => rooms.filter((r) => r.roomType === rt).length;
  const total = rooms.length;
  const piecesAdded = countOf('PIECES') > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl tracking-[-0.01em]">{t('cart.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {designHelp ? t('cart.designHelpSubtitle') : t('cart.subtitle')}
        </p>
      </div>

      <Tabs
        className="mb-0"
        current={tab}
        onChange={(v) => setTab(v as 'rooms' | 'pieces')}
        tabs={[
          { value: 'rooms', label: t('cart.tabRooms') },
          { value: 'pieces', label: t('cart.tabPieces') },
        ]}
      />

      {/* cosul cererii: vizibil pe ambele taburi — pe tabul de piese vezi si
          camerele deja adaugate (feedback PO 2026-07-31) */}
      <div className="rounded-xl border border-border-2 bg-surface-2/60 px-4 py-3.5">
        <div className="mb-2 flex items-center gap-2">
          <ShoppingBasket className="h-4 w-4 text-walnut" />
          <span className="text-sm font-medium">{t('cart.basketTitle')}</span>
          <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
            {t('cart.totalRooms', { count: total })}
          </span>
        </div>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">{t('cart.basketEmpty')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {[...rooms.reduce((acc, r) => acc.set(r.roomType, (acc.get(r.roomType) ?? 0) + 1), new Map<RoomType, number>())].map(
              ([rt, n]) => (
                <motion.li
                  key={rt}
                  layout
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1.5 rounded-full border border-walnut/40 bg-walnut-soft py-1 pl-3 pr-1.5 text-sm text-walnut"
                >
                  {n > 1 && <span className="font-mono text-xs tabular-nums">{n}&thinsp;×</span>}
                  {t(`rooms.type.${rt}`)}
                  <button
                    type="button"
                    aria-label={t('cart.removeOne', { type: t(`rooms.type.${rt}`) })}
                    onClick={() => removeLastOfType(rt)}
                    className="grid h-5 w-5 place-items-center rounded-full text-walnut/70 transition-colors hover:bg-walnut/15 hover:text-walnut"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.li>
              ),
            )}
          </ul>
        )}
      </div>

      {tab === 'rooms' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {GRID_ROOM_TYPES.map((rt) => (
            <CartTile
              key={rt}
              roomType={rt}
              count={countOf(rt)}
              disableAdd={total >= MAX_ROOMS}
              onAdd={() => addRoom(rt)}
              onRemove={() => removeLastOfType(rt)}
            />
          ))}
        </div>
      )}

      {tab === 'pieces' && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {GRID_PIECE_TYPES.map((rt) => (
              <CartTile
                key={rt}
                roomType={rt}
                count={countOf(rt)}
                disableAdd={total >= MAX_ROOMS}
                onAdd={() => addRoom(rt)}
                onRemove={() => removeLastOfType(rt)}
              />
            ))}
          </div>

          {/* fallback formular liber — cap 1 instanta, mereu ultimul in flow */}
          <div
            className={
              'flex items-center gap-3 rounded-xl border border-dashed p-4 transition-colors ' +
              (piecesAdded ? 'border-walnut bg-walnut-soft' : 'border-border-2 bg-surface')
            }
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-walnut [&_svg]:size-5">
              <ConfiguratorIcon name={ROOM_ICONS.PIECES} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium">{t('rooms.type.PIECES')}</div>
              <div className="text-xs text-muted-foreground">{t('rooms.desc.PIECES')}</div>
            </div>
            {piecesAdded ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => removeLastOfType('PIECES')}
              >
                <Minus className="mr-1 h-4 w-4" />
                {t('cart.removePieces')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={total >= MAX_ROOMS}
                onClick={() => addRoom('PIECES')}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t('cart.addPieces')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* proiect pentru toata locuinta → pasii de dimensiuni/schita se sar;
          irelevant pe fluxul "am nevoie de ajutor" (proiectarea o face atelierul) */}
      {!designHelp && (
        <label className="flex items-start gap-2 rounded-lg border border-border-2 bg-surface-2 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-walnut"
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

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('cart.totalRooms', { count: total })}
        </span>
        <Button type="button" variant="walnut" size="xl" disabled={total === 0} onClick={onContinue}>
          {designHelp ? t('nav.continue') : t('nav.startQuestions')}
        </Button>
      </div>
    </div>
  );
}
