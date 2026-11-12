'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// "Materialele, explicate simplu" (landing F, 2026-11-08; asezare dupa canvasul de design
// 2026-11-12): aceleasi texte si preturi ca in formular (Configurator.common.materials) —
// o singura sursa, ca promisiunea de pe landing sa fie identica cu ce vede clientul in cerere.
// Laws of UX: Hick (5 optiuni, una deschisa), Aesthetic-Usability (pozele PO).
const MATERIALS = [
  { key: 'PAL', img: '/illustrations/pal.png' },
  { key: 'MDF_INFOLIAT', img: '/illustrations/mdf-infoliat.png' },
  { key: 'MDF_VOPSIT', img: '/illustrations/mdf-vopsit.png' },
  { key: 'MDF_FURNIR', img: '/illustrations/mdf-furnir.png' },
  { key: 'LEMN_MASIV', img: '/illustrations/lemn-masiv.png' },
] as const;

type MaterialKey = (typeof MATERIALS)[number]['key'];

// capetele scalei = cel mai ieftin si cel mai scump material din lista
const SCALE_MIN = 250;
const SCALE_MAX = 1800;

// "250–450 lei/ml" → [250, 450]; null daca textul nu are doua numere
function parseRange(price: string): [number, number] | null {
  const nums = price.match(/\d[\d.]*/g)?.map((n) => Number(n.replace(/\./g, '')));
  if (!nums || nums.length < 2 || nums.some(Number.isNaN)) return null;
  return [nums[0], nums[1]];
}

// `className` = containerul si ritmul vertical al sectiunii, date de pagina
export function MaterialExplainer({ className }: { className?: string }) {
  const t = useTranslations('LandingV2');
  const tm = useTranslations('Configurator.common.materials');
  const format = useFormatter();
  const [selected, setSelected] = useState<MaterialKey>('PAL');

  const price = tm(`${selected}.info.price`);
  const range = parseRange(price);
  const left = range ? ((range[0] - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100 : 0;
  const width = range ? Math.max(6, ((range[1] - range[0]) / (SCALE_MAX - SCALE_MIN)) * 100) : 0;

  return (
    <section id="materiale" className={cn('flex scroll-mt-20 flex-col gap-8', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex flex-col gap-3">
          <span className="kicker">{t('materialsKicker')}</span>
          <h2 className="font-serif text-3xl leading-[1.15] sm:text-4xl sm:leading-[1.15]">{t('materialsTitle')}</h2>
        </div>
        <p className="max-w-xs text-muted-foreground">{t('materialsSub')}</p>
      </div>

      {/* butoane cu aria-pressed intr-un grup etichetat: o singura optiune apasata odata */}
      <div
        role="group"
        aria-label={t('materialsPick')}
        className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] sm:gap-4"
      >
        {MATERIALS.map((m) => {
          const on = m.key === selected;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={on}
              onClick={() => setSelected(m.key)}
              className={cn(
                'flex flex-col items-center gap-2.5 rounded-xl border bg-surface px-3 pb-3.5 pt-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/50',
                // inelul de 1px peste chenar = contur de 2px fara sa mute continutul
                on
                  ? 'border-walnut font-semibold shadow ring-1 ring-walnut'
                  : 'border-border font-medium hover:border-walnut/40',
              )}
            >
              <Image src={m.img} alt="" width={240} height={240} className="h-[120px] w-full object-contain" />
              {tm(`${m.key}.label`)}
            </button>
          );
        })}
      </div>

      <div
        aria-live="polite"
        className="flex flex-wrap overflow-hidden rounded-xl border border-border bg-surface"
      >
        <div className="flex min-w-0 flex-[3_1_420px] flex-col gap-3.5 p-6 sm:p-7">
          <h3 className="font-serif text-2xl leading-tight">{tm(`${selected}.info.title`)}</h3>
          <p className="max-w-[560px] text-muted-foreground">{tm(`${selected}.info.body`)}</p>
          <ul className="mt-1 flex flex-col gap-2.5">
            <li className="flex gap-2.5">
              <span
                aria-hidden
                className="grid size-5 flex-none place-items-center rounded-full bg-sage-soft font-semibold leading-none text-sage"
              >
                +
              </span>
              <span>
                <span className="font-medium">{t('materialsPro')}:</span> {tm(`${selected}.info.pros1`)}
              </span>
            </li>
            <li className="flex gap-2.5">
              <span
                aria-hidden
                className="grid size-5 flex-none place-items-center rounded-full bg-amber-soft font-semibold leading-none text-amber"
              >
                −
              </span>
              <span>
                <span className="font-medium">{t('materialsCon')}:</span> {tm(`${selected}.info.cons1`)}
              </span>
            </li>
          </ul>
        </div>
        <div className="flex min-w-0 flex-[2_1_300px] flex-col justify-center gap-3 bg-surface-2 p-6 sm:p-7">
          <span className="label">{t('materialsPrice')}</span>
          <span className="font-mono text-2xl font-medium">{price}</span>
          {range && (
            <>
              <div
                role="img"
                aria-label={t('materialsScaleAria', {
                  material: tm(`${selected}.label`),
                  price,
                  min: format.number(SCALE_MIN),
                  max: format.number(SCALE_MAX),
                })}
                className="relative h-2 overflow-hidden rounded-full bg-border"
              >
                <span
                  className="absolute inset-y-0 rounded-full bg-walnut transition-all duration-300"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <div aria-hidden className="flex justify-between font-mono text-xs text-muted-foreground">
                <span>{format.number(SCALE_MIN)}</span>
                <span>{t('materialsScaleMax', { max: format.number(SCALE_MAX) })}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
