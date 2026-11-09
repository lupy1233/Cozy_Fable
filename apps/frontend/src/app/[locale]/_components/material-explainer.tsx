'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// "Materialele, explicate simplu" (landing F, 2026-11-08): aceleasi texte si
// preturi ca in formular (Configurator.common.materials) — o singura sursa,
// ca promisiunea de pe landing sa fie identica cu ce vede clientul in cerere.
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

export function MaterialExplainer() {
  const t = useTranslations('LandingV2');
  const tm = useTranslations('Configurator.common.materials');
  const [selected, setSelected] = useState<MaterialKey>('PAL');

  const price = tm(`${selected}.info.price`);
  const range = parseRange(price);
  const left = range ? ((range[0] - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100 : 0;
  const width = range ? Math.max(6, ((range[1] - range[0]) / (SCALE_MAX - SCALE_MIN)) * 100) : 0;

  return (
    <section id="materiale" className="scroll-mt-20 py-12">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="kicker">{t('materialsKicker')}</span>
          <h2 className="serif mt-2 text-3xl sm:text-4xl">{t('materialsTitle')}</h2>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">{t('materialsSub')}</p>
      </div>

      <div role="radiogroup" aria-label={t('materialsTitle')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {MATERIALS.map((m) => {
          const on = m.key === selected;
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSelected(m.key)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border bg-surface p-3 pb-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/50',
                on ? 'border-2 border-walnut bg-walnut-soft/40' : 'border-border hover:border-walnut/40',
              )}
            >
              <Image src={m.img} alt="" width={240} height={240} className="aspect-square w-full object-contain" />
              {tm(`${m.key}.label`)}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-6 rounded-xl border border-border bg-surface p-6 md:grid-cols-[1.3fr_1fr]" aria-live="polite">
        <div className="flex flex-col gap-2.5">
          <h3 className="font-serif text-2xl">{tm(`${selected}.info.title`)}</h3>
          <p className="leading-relaxed text-muted-foreground">{tm(`${selected}.info.body`)}</p>
          <ul className="mt-1 flex flex-col gap-1.5 text-sm">
            <li className="flex gap-2">
              <span className="font-semibold text-sage" aria-hidden>+</span>
              <span>
                <span className="sr-only">{t('materialsPro')}: </span>
                {tm(`${selected}.info.pros1`)}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-crimson" aria-hidden>−</span>
              <span>
                <span className="sr-only">{t('materialsCon')}: </span>
                {tm(`${selected}.info.cons1`)}
              </span>
            </li>
          </ul>
        </div>
        <div className="flex flex-col justify-center gap-2.5">
          <span className="text-sm text-muted-foreground">{t('materialsPrice')}</span>
          <span className="font-mono text-2xl">{price}</span>
          {range && (
            <>
              <div aria-hidden className="relative h-2 overflow-hidden rounded-full bg-surface-3">
                <span
                  className="absolute inset-y-0 rounded-full bg-walnut transition-all duration-300"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <div aria-hidden className="flex justify-between text-xs text-muted-foreground">
                <span>{SCALE_MIN}</span>
                <span>{SCALE_MAX.toLocaleString('ro-RO')}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
