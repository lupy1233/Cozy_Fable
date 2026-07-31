'use client';

// Banda-tinta pentru intrebarile de material / sistem de deschidere (PO r10,
// marita in r11): sub titlul intrebarii apar TOATE corpurile relevante ale
// camerei, cu highlight pe cel la care se refera intrebarea — cititorul vede
// tinta fara sa parcurga textul.
// Rezolvare: flow-urile per-piesa prin screenGroup 'piece:<VALUE>' (toate
// piesele selectate, activa cea din grup); bucataria pe zone (baza/suspendate/
// insula); debaraua pe stilul de depozitare; altfel registrul cu un singur
// corp; altfel null (ramane iconul lucide).
import {
  getFlow,
  type AnswerMap,
  type QuestionStep,
  type RoomType,
} from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { getIllustration, type Illustration } from './index';
import { IlluVanityUnit } from './bathroom';
import { IlluBaseUnits, IlluIslandUnits, IlluWallUnits } from './kitchen';
import {
  IlluApplianceHousing,
  IlluBed,
  IlluBench,
  IlluBookshelf,
  IlluClosedCabinets,
  IlluDesk,
  IlluDresser,
  IlluNightstand,
  IlluOpenShelves,
  IlluShoeCabinet,
  IlluTvUnit,
  IlluWardrobe,
} from './room-pieces';
import { IlluBenchStorage, IlluTableDining } from './piece-configs';

export interface TargetItem {
  key: string;
  Illu: Illustration;
  labelKey?: string;
}

export interface TargetStrip {
  items: TargetItem[];
  active: string;
}

// tinta unica pentru intrebarile cu id-uri fixe (dressing, flow-uri legacy cu
// material/sisteme comune pe camera, piesele ghidate PIECE_*)
const SINGLE_TARGET: Partial<Record<RoomType, Record<string, Illustration>>> = {
  KITCHEN: { frontMaterial: IlluBaseUnits, openingSystems: IlluBaseUnits },
  PANTRY: { material: IlluClosedCabinets },
  DRESSING: { material: IlluWardrobe },
  BEDROOM: { material: IlluWardrobe, openingSystems: IlluWardrobe },
  LIVING: { material: IlluTvUnit, openingSystems: IlluTvUnit },
  BATHROOM: { material: IlluVanityUnit },
  LAUNDRY: { material: IlluApplianceHousing },
  BALCONY: { material: IlluBenchStorage },
  HALLWAY: { material: IlluShoeCabinet },
  OFFICE: { material: IlluDesk, openingSystems: IlluDesk },
  PIECE_WARDROBE: { material: IlluWardrobe, openingSystems: IlluWardrobe },
  PIECE_TV_UNIT: { material: IlluTvUnit, openingSystems: IlluTvUnit },
  PIECE_BOOKCASE: { material: IlluBookshelf, openingSystems: IlluBookshelf },
  PIECE_DESK: { material: IlluDesk, openingSystems: IlluDesk },
  PIECE_BED: { material: IlluBed, openingSystems: IlluBed },
  PIECE_DRESSER: { material: IlluDresser, openingSystems: IlluDresser },
  PIECE_TABLE: { material: IlluTableDining, openingSystems: IlluTableDining },
  PIECE_SHOE_CABINET: { material: IlluShoeCabinet, openingSystems: IlluShoeCabinet },
  PIECE_NIGHTSTAND: { material: IlluNightstand, openingSystems: IlluNightstand },
  PIECE_BENCH: { material: IlluBench, openingSystems: IlluBench },
};

// eticheta unei optiuni dintr-un step al flow-ului (relativa la 'Configurator')
function optionLabelKey(
  roomType: RoomType,
  flowVersion: number | undefined,
  stepId: string,
  value: string,
): string | undefined {
  try {
    const flow = getFlow(roomType, flowVersion);
    const step = flow.steps.find((s) => s.id === stepId);
    if (step && (step.type === 'single-choice' || step.type === 'multi-choice')) {
      return step.options.find((o) => o.value === value)?.labelKey;
    }
  } catch {
    // versiune neinregistrata → fara eticheta
  }
  return undefined;
}

// zona de bucatarie vizata de fiecare intrebare din kitchen v2
const KITCHEN_ZONE_BY_STEP: Record<string, string> = {
  frontMaterialBase: 'BASE_UNITS',
  openingSystemsBase: 'BASE_UNITS',
  frontMaterialWall: 'WALL_UNITS',
  openingSystemsWall: 'WALL_UNITS',
  frontMaterialIsland: 'ISLAND_UNITS',
  openingSystemsIsland: 'ISLAND_UNITS',
};

function buildItems(
  roomType: RoomType,
  flowVersion: number | undefined,
  sourceStepId: string,
  values: string[],
): TargetItem[] {
  return values
    .map((v) => {
      const Illu = getIllustration(roomType, sourceStepId, v);
      if (!Illu) return null;
      const labelKey = optionLabelKey(roomType, flowVersion, sourceStepId, v);
      return { key: v, Illu, ...(labelKey ? { labelKey } : {}) };
    })
    .filter((x): x is TargetItem => x !== null);
}

export function getQuestionTargets(
  roomType: RoomType,
  step: QuestionStep,
  answers: AnswerMap,
  flowVersion?: number,
): TargetStrip | null {
  // doar intrebarile de material / sisteme de deschidere au banda-tinta
  if (!/material|system/i.test(step.id)) return null;

  // flow-urile per-piesa: toate piesele selectate, activa cea din screenGroup
  const piece = step.screenGroup?.match(/^piece:([A-Z0-9_]+)/)?.[1];
  if (piece) {
    const selected = Array.isArray(answers.piecesNeeded)
      ? (answers.piecesNeeded as string[])
      : [];
    const values = selected.includes(piece) ? selected : [...selected, piece];
    const items = buildItems(roomType, flowVersion, 'piecesNeeded', values);
    if (items.length > 0) return { items, active: piece };
  }

  // bucataria v2: zonele de corpuri — baza si suspendatele se intreaba mereu,
  // insula doar daca exista (v2 nu are pasul cabinetZones, deci etichetele vin
  // din cheile dedicate anchors.kitchenZones, nu din optiuni)
  const zone = roomType === 'KITCHEN' ? KITCHEN_ZONE_BY_STEP[step.id] : undefined;
  if (zone) {
    const shown = ['BASE_UNITS', 'WALL_UNITS'];
    if (zone === 'ISLAND_UNITS' || answers.hasIsland === true) shown.push('ISLAND_UNITS');
    const items = buildItems(roomType, flowVersion, 'cabinetZones', shown).map((it) => ({
      ...it,
      labelKey: it.labelKey ?? `anchors.kitchenZones.${it.key}`,
    }));
    if (items.length > 0) return { items, active: zone };
  }

  // debaraua v2: rafturi deschise vs dulapuri inchise, dupa stilul ales
  if (roomType === 'PANTRY' && /^(materialShelves|materialCabinets|systemsCabinets)$/.test(step.id)) {
    const active = step.id === 'materialShelves' ? 'OPEN_SHELVES' : 'CLOSED_CABINETS';
    const style = answers.storageStyle;
    const shown =
      style === 'MIXED' ? ['OPEN_SHELVES', 'CLOSED_CABINETS'] : [active];
    const items = buildItems(roomType, flowVersion, 'storageStyle', shown);
    if (items.length > 0) return { items, active };
  }

  const single = SINGLE_TARGET[roomType]?.[step.id];
  if (single) return { items: [{ key: 'main', Illu: single }], active: 'main' };
  return null;
}

// Banda propriu-zisa: corpurile camerei, cel vizat colorat si etichetat.
export function QuestionTargetStrip({ data }: { data: TargetStrip }) {
  const t = useTranslations('Configurator');
  const single = data.items.length === 1;
  return (
    <div
      className={cn(
        'flex flex-wrap items-stretch gap-2 rounded-xl border border-border-2 bg-surface-2/50 p-2.5',
        single && 'w-fit',
      )}
    >
      {data.items.map(({ key, Illu, labelKey }) => {
        const active = key === data.active;
        return (
          <div
            key={key}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border px-2.5 pb-1.5 pt-2 transition-colors',
              single ? 'w-36' : 'w-[104px] sm:w-28',
              active
                ? 'border-walnut bg-walnut-soft text-walnut shadow-[0_0_0_2px_hsl(var(--walnut)/0.14)]'
                : 'border-transparent text-muted-2 opacity-55',
            )}
          >
            <span className={cn('w-full [&_svg]:h-full [&_svg]:w-full', single ? 'h-20' : 'h-14 sm:h-16')}>
              <Illu />
            </span>
            {labelKey && (
              <span
                className={cn(
                  'text-center text-[11px] leading-tight',
                  active ? 'font-medium' : 'text-muted-foreground',
                )}
              >
                {t(labelKey)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
