'use client';

import { useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// Plansele hero de pe landing (F6, item 2): trei schite axonometrice care se
// traseaza singure, comutabile din placute de alama (№ 0001–0003). Schimbarea
// plansei remonteaza SVG-ul (key) → animatia plan-draw se reia de la zero.

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;

const ink = 'hsl(var(--foreground))';
const brass = 'hsl(var(--brass))';
const hidden = 'hsl(var(--muted-2))';

/**
 * Axonometrie de dulap (oblica de cabinet: fata dreapta, adancimea la ~30°
 * spre dreapta-sus), cote in alama — se deseneaza la incarcare.
 */
function WardrobeAxonometric({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 440 400" className="plan-draw h-auto w-full" role="img" aria-label={label} fill="none">
      <polygon points="90,110 340,110 384,84 134,84" fill="hsl(var(--foreground) / 0.04)" stroke="none" data-fade style={d(700)} />
      <polygon points="340,110 384,84 384,304 340,330" fill="hsl(var(--foreground) / 0.07)" stroke="none" data-fade style={d(760)} />
      <rect x="90" y="110" width="250" height="220" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(0)} />
      <line x1="90" y1="110" x2="134" y2="84" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(300)} />
      <line x1="340" y1="110" x2="384" y2="84" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(350)} />
      <line x1="134" y1="84" x2="384" y2="84" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(450)} />
      <line x1="384" y1="84" x2="384" y2="304" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(520)} />
      <line x1="340" y1="330" x2="384" y2="304" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(560)} />
      <line x1="90" y1="158" x2="340" y2="158" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(620)} />
      <line x1="215" y1="110" x2="215" y2="158" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(680)} />
      <line x1="215" y1="158" x2="215" y2="330" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(720)} />
      <line x1="207" y1="205" x2="207" y2="227" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(800)} />
      <line x1="223" y1="205" x2="223" y2="227" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(830)} />
      <line x1="196" y1="146" x2="208" y2="146" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(860)} />
      <line x1="222" y1="146" x2="234" y2="146" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(880)} />
      <line x1="102" y1="330" x2="102" y2="342" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(920)} />
      <line x1="328" y1="330" x2="328" y2="342" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(940)} />
      <line x1="102" y1="342" x2="328" y2="342" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(960)} />
      <line x1="98" y1="190" x2="208" y2="190" stroke={hidden} strokeWidth="1" strokeDasharray="5 4" data-fade style={d(1350)} />
      <line x1="98" y1="225" x2="208" y2="225" stroke={hidden} strokeWidth="1" strokeDasharray="5 4" data-fade style={d(1410)} />
      <line x1="98" y1="260" x2="208" y2="260" stroke={hidden} strokeWidth="1" strokeDasharray="5 4" data-fade style={d(1470)} />
      <line x1="222" y1="185" x2="332" y2="185" stroke={hidden} strokeWidth="1" strokeDasharray="5 4" data-fade style={d(1530)} />
      <line x1="90" y1="336" x2="90" y2="360" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="340" y1="336" x2="340" y2="360" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="90" y1="354" x2="340" y2="354" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1060)} />
      <line x1="86" y1="358" x2="94" y2="350" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <line x1="336" y1="358" x2="344" y2="350" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <text x="215" y="376" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} data-fade style={d(1250)}>2500</text>
      <line x1="84" y1="110" x2="58" y2="110" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="84" y1="330" x2="58" y2="330" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="64" y1="110" x2="64" y2="330" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1060)} />
      <line x1="60" y1="114" x2="68" y2="106" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <line x1="60" y1="334" x2="68" y2="326" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <text x="50" y="220" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} transform="rotate(-90 50 220)" data-fade style={d(1250)}>2200</text>
      <line x1="343" y1="335" x2="353" y2="352" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="387" y1="309" x2="397" y2="326" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="350" y1="347" x2="394" y2="321" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1060)} />
      <line x1="346" y1="351" x2="354" y2="343" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <line x1="390" y1="325" x2="398" y2="317" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1130)} />
      <text x="381" y="348" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} transform="rotate(-30.6 381 348)" data-fade style={d(1250)}>600</text>
    </svg>
  );
}

/** Axonometrie de bucatarie: corpuri de baza cu blat, suspendate si hota. */
function KitchenAxonometric({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 440 400" className="plan-draw h-auto w-full" role="img" aria-label={label} fill="none">
      {/* volum lateral + blat (spalari de ton) */}
      <polygon points="340,208 384,182 384,330 340,356" fill="hsl(var(--foreground) / 0.07)" stroke="none" data-fade style={d(900)} />
      <polygon points="90,208 340,208 384,182 134,182" fill="hsl(var(--foreground) / 0.06)" stroke="none" data-fade style={d(940)} />
      {/* corpurile de baza — fata */}
      <rect x="90" y="208" width="250" height="148" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(0)} />
      {/* blatul: muchia oblica */}
      <line x1="90" y1="208" x2="134" y2="182" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(260)} />
      <line x1="340" y1="208" x2="384" y2="182" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(300)} />
      <line x1="134" y1="182" x2="384" y2="182" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(380)} />
      <line x1="384" y1="182" x2="384" y2="330" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(440)} />
      <line x1="340" y1="356" x2="384" y2="330" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(480)} />
      {/* fronturi jos: doua usi + coloana de sertare */}
      <line x1="173" y1="208" x2="173" y2="356" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(540)} />
      <line x1="256" y1="208" x2="256" y2="356" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(580)} />
      <line x1="256" y1="258" x2="340" y2="258" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(620)} />
      <line x1="256" y1="308" x2="340" y2="308" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(650)} />
      {/* manere jos */}
      <line x1="160" y1="228" x2="168" y2="228" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(700)} />
      <line x1="178" y1="228" x2="186" y2="228" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(720)} />
      <line x1="292" y1="232" x2="304" y2="232" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(740)} />
      <line x1="292" y1="282" x2="304" y2="282" stroke={ink} strokeWidth="2" pathLength={1} data-draw style={d(760)} />
      {/* corpurile suspendate */}
      <rect x="90" y="66" width="105" height="62" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(820)} />
      <line x1="142" y1="66" x2="142" y2="128" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(880)} />
      <rect x="235" y="66" width="105" height="62" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(920)} />
      <line x1="287" y1="66" x2="287" y2="128" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(960)} />
      {/* adancimea suspendatelor */}
      <line x1="90" y1="66" x2="118" y2="50" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1000)} />
      <line x1="340" y1="66" x2="368" y2="50" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1030)} />
      <line x1="118" y1="50" x2="368" y2="50" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1080)} />
      {/* hota intre suspendate */}
      <path d="M200 96h30l4 6h-38z" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1120)} />
      <path d="M196 102h38v18h-38z" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1160)} />
      <line x1="206" y1="96" x2="210" y2="78" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1200)} />
      <line x1="224" y1="96" x2="220" y2="78" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1200)} />
      <line x1="210" y1="78" x2="220" y2="78" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(1230)} />
      {/* cota latime 2900 */}
      <line x1="90" y1="362" x2="90" y2="382" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1300)} />
      <line x1="340" y1="362" x2="340" y2="382" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1300)} />
      <line x1="90" y1="376" x2="340" y2="376" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1360)} />
      <text x="215" y="396" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} data-fade style={d(1450)}>2900</text>
      {/* cota inaltime 2300 */}
      <line x1="84" y1="66" x2="58" y2="66" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1300)} />
      <line x1="84" y1="356" x2="58" y2="356" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1300)} />
      <line x1="64" y1="66" x2="64" y2="356" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1360)} />
      <text x="50" y="211" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} transform="rotate(-90 50 211)" data-fade style={d(1450)}>2300</text>
    </svg>
  );
}

/** Axonometrie de biblioteca: rafturi deschise cu carti sugerate. */
function BookcaseAxonometric({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 440 400" className="plan-draw h-auto w-full" role="img" aria-label={label} fill="none">
      <polygon points="120,80 320,80 358,58 158,58" fill="hsl(var(--foreground) / 0.04)" stroke="none" data-fade style={d(700)} />
      <polygon points="320,80 358,58 358,320 320,342" fill="hsl(var(--foreground) / 0.07)" stroke="none" data-fade style={d(760)} />
      {/* corpul */}
      <rect x="120" y="80" width="200" height="262" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(0)} />
      <line x1="120" y1="80" x2="158" y2="58" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(280)} />
      <line x1="320" y1="80" x2="358" y2="58" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(320)} />
      <line x1="158" y1="58" x2="358" y2="58" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(400)} />
      <line x1="358" y1="58" x2="358" y2="320" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(460)} />
      <line x1="320" y1="342" x2="358" y2="320" stroke={ink} strokeWidth="1.5" pathLength={1} data-draw style={d(500)} />
      {/* rafturi */}
      {[132, 184, 236, 288].map((y, i) => (
        <line key={y} x1="120" y1={y} x2="320" y2={y} stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(560 + i * 60)} />
      ))}
      {/* montant vertical */}
      <line x1="220" y1="80" x2="220" y2="342" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(820)} />
      {/* carti sugerate (grupuri de linii) */}
      <path d="M132 132v-34M140 132v-28M148 132v-31M162 132v-26M170 132v-30" stroke={hidden} strokeWidth="2" data-fade style={d(1050)} />
      <path d="M236 184v-30M244 184v-26M252 184v-32M268 184v-27" stroke={hidden} strokeWidth="2" data-fade style={d(1120)} />
      <path d="M134 236v-28M144 236v-32M158 236v-25M280 288v-28M290 288v-24" stroke={hidden} strokeWidth="2" data-fade style={d(1190)} />
      {/* soclu */}
      <line x1="130" y1="342" x2="130" y2="352" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(900)} />
      <line x1="310" y1="342" x2="310" y2="352" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(920)} />
      <line x1="130" y1="352" x2="310" y2="352" stroke={ink} strokeWidth="1" pathLength={1} data-draw style={d(940)} />
      {/* cote */}
      <line x1="120" y1="348" x2="120" y2="372" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1250)} />
      <line x1="320" y1="348" x2="320" y2="372" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1250)} />
      <line x1="120" y1="366" x2="320" y2="366" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1310)} />
      <text x="220" y="388" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} data-fade style={d(1400)}>1800</text>
      <line x1="114" y1="80" x2="88" y2="80" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1250)} />
      <line x1="114" y1="342" x2="88" y2="342" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1250)} />
      <line x1="94" y1="80" x2="94" y2="342" stroke={brass} strokeWidth="1" pathLength={1} data-draw style={d(1310)} />
      <text x="80" y="211" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill={brass} transform="rotate(-90 80 211)" data-fade style={d(1400)}>2400</text>
    </svg>
  );
}

const SHEETS = [
  { key: 'wardrobe', no: '№ 0001', Drawing: WardrobeAxonometric },
  { key: 'kitchen', no: '№ 0002', Drawing: KitchenAxonometric },
  { key: 'bookcase', no: '№ 0003', Drawing: BookcaseAxonometric },
] as const;

function BrassDot() {
  return <span aria-hidden className="h-1 w-1 rotate-45 bg-brass/70" />;
}

export function HeroSheets() {
  const t = useTranslations('Landing');
  const [index, setIndex] = useState(0);
  const sheet = SHEETS[index];
  const title = t(`heroSheets.${sheet.key}`);

  return (
    <div className="rounded-md border border-border bg-card p-3 shadow-lg">
      <div className="border border-brass/40 px-4 pb-1 pt-3">
        {/* remount pe schimbare → animatia plan-draw se reia */}
        <sheet.Drawing key={sheet.key} label={title} />
        <div className="mt-1 flex items-center justify-center gap-3 border-t border-brass/30 py-3">
          <span className="label">{title}</span>
          <BrassDot />
          <span className="label">{sheet.no}</span>
        </div>
      </div>
      {/* comutatorul planselor: placute de alama */}
      <div className="mt-2 flex items-center justify-center gap-2" role="tablist" aria-label={t('heroSheetsSwitcher')}>
        {SHEETS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              'rounded-[3px] border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
              i === index
                ? 'border-brass/70 bg-brass/10 text-foreground'
                : 'border-border-2 text-muted-foreground hover:border-brass/40 hover:text-foreground',
            )}
          >
            {t(`heroSheets.${s.key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
