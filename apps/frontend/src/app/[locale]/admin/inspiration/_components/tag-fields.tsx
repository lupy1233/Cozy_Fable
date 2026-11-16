'use client';

import { useTranslations } from 'next-intl';
import { INSPIRATION_COLORS, type InspirationColor, type ItemSystem, type Material } from '@marketplace/shared';
import { FilterChips } from '@/components/ui/filter-chips';

// Etichetele de filtrare ale unei lucrari (culoare / material / deschidere) — aceleasi liste
// la adaugare si la editare.
export const TAG_MATERIALS: Material[] = ['PAL', 'MDF_INFOLIAT', 'MDF_VOPSIT', 'MDF_FURNIR', 'LEMN_MASIV'];
export const TAG_SYSTEMS: ItemSystem[] = ['MANER', 'PUSH', 'GOLA', 'AVENTOS', 'GLISANTE'];

export interface TagValues {
  colors: InspirationColor[];
  materials: Material[];
  systems: ItemSystem[];
}

export const EMPTY_TAGS: TagValues = { colors: [], materials: [], systems: [] };

const LEGEND = 'mb-2 p-0 text-ui font-medium';

export function TagFields({ value, onChange }: { value: TagValues; onChange: (next: TagValues) => void }) {
  const tc = useTranslations('Configurator');
  const ti = useTranslations('Inspiration');
  return (
    <>
      <fieldset className="m-0 border-0 p-0">
        <legend className={LEGEND}>{ti('filters.material')}</legend>
        <FilterChips<Material>
          multiple
          label={ti('filters.material')}
          value={value.materials}
          onChange={(materials) => onChange({ ...value, materials })}
          options={TAG_MATERIALS.map((m) => ({ value: m, label: tc(`common.materials.${m}.label`) }))}
        />
      </fieldset>
      <fieldset className="m-0 border-0 p-0">
        <legend className={LEGEND}>{ti('filters.color')}</legend>
        <FilterChips<InspirationColor>
          multiple
          label={ti('filters.color')}
          value={value.colors}
          onChange={(colors) => onChange({ ...value, colors })}
          options={INSPIRATION_COLORS.map((c) => ({ value: c, label: ti(`colors.${c}`) }))}
        />
      </fieldset>
      <fieldset className="m-0 border-0 p-0">
        <legend className={LEGEND}>{ti('filters.opening')}</legend>
        <FilterChips<ItemSystem>
          multiple
          label={ti('filters.opening')}
          value={value.systems}
          onChange={(systems) => onChange({ ...value, systems })}
          options={TAG_SYSTEMS.map((s) => ({ value: s, label: tc(`common.systems.${s}.label`) }))}
        />
      </fieldset>
    </>
  );
}
