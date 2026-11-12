'use client';

import type { RequestStatus } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { StatusBadge } from '@/components/ui/badge';
import type { CardTone } from '@/components/ui/card';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';

// Starea unei cereri vazuta de client: pastila starii, randul "Ce urmeaza" si drumul
// cererii. Totul se deriva din statusul real (REQUEST_STATUSES) si din cifrele deja
// incarcate (firme cu preluare, oferte, data expirarii).

// Pastila starii cu eticheta tradusa. Tonul ("cine are mutarea") vine din STATUS_TONE
// (ui/badge), care acopera toate starile cererii — fara mapare locala.
export function RequestStatusBadge({
  status,
  label,
  className,
}: {
  status: RequestStatus;
  /** inlocuieste eticheta implicita (ex. „Livrată · 2”) */
  label?: string;
  className?: string;
}) {
  const t = useTranslations('Requests');
  return <StatusBadge status={status} label={label ?? t(`statusValue.${status}`)} className={className} />;
}

// Starile in care urmatoarea mutare e a clientului (alege o oferta / confirma livrarea).
const CLIENT_TURN: ReadonlySet<RequestStatus> = new Set<RequestStatus>([
  'OFFERS_RECEIVED',
  'NEGOTIATION',
  'DELIVERED_BY_COMPANY',
]);

export function isClientTurn(status: RequestStatus): boolean {
  return CLIENT_TURN.has(status);
}

// Tonul benzii „pasul urmator” de pe fisa cererii.
export type NextStepTone = Extract<CardTone, 'amber' | 'info' | 'sage' | 'crimson' | 'muted'>;

export const NEXT_STEP_TONE: Record<RequestStatus, NextStepTone> = {
  DRAFT: 'muted',
  IN_MARKETPLACE: 'info',
  CLAIMED_PARTIAL: 'info',
  CLAIMED_FULL: 'info',
  OFFERS_RECEIVED: 'amber',
  NEGOTIATION: 'amber',
  ACCEPTED: 'sage',
  IN_EXECUTION: 'sage',
  DELIVERED_BY_COMPANY: 'amber',
  COMPLETED: 'sage',
  DISPUTED: 'crimson',
  EXPIRED: 'muted',
  CANCELLED: 'muted',
};

export interface RequestProgressFacts {
  status: RequestStatus;
  /** firme cu preluare activa (cu sau fara oferta trimisa); null = necunoscut */
  claims: number | null;
  /** oferte primite; null = necunoscut */
  offers: number | null;
  expiresAt: string | null;
}

// Textele „Ce urmeaza”: `line` pentru cardurile din lista, `title` + `body` pentru banda
// de pe fisa cererii. Cifrele necunoscute cad pe varianta generala (=0) a mesajului.
export function useRequestNextStep() {
  const t = useTranslations('Requests.next');
  const format = useFormatter();

  const values = (facts: RequestProgressFacts) => {
    const claims = facts.claims ?? 0;
    const offers = facts.offers ?? 0;
    return {
      c: claims,
      n: offers,
      // firme care au preluat cererea si inca nu au trimis oferta
      w: Math.max(claims - offers, 0),
      date: facts.expiresAt
        ? format.dateTime(new Date(facts.expiresAt), { day: 'numeric', month: 'long', timeZone: APP_TIME_ZONE })
        : '',
    };
  };
  // cererea din marketplace are doua formulari: cu si fara data expirarii
  const variant = (facts: RequestProgressFacts) =>
    facts.status === 'IN_MARKETPLACE' && facts.expiresAt ? 'IN_MARKETPLACE_DATED' : facts.status;

  return {
    line: (facts: RequestProgressFacts) => t(`line.${variant(facts)}`, values(facts)),
    title: (facts: RequestProgressFacts) => t(`title.${facts.status}`, values(facts)),
    body: (facts: RequestProgressFacts) => t(`body.${variant(facts)}`, values(facts)),
  };
}

// Drumul cererii: cinci jaloane, fiecare cu corespondent in statusul cererii.
const JOURNEY_STEPS = ['PUBLISHED', 'CLAIMED', 'OFFERS', 'ACCEPTED', 'DELIVERED'] as const;

// reached = cate jaloane a atins cererea; ongoing = ultimul atins e pasul curent
// (false cand drumul s-a incheiat sau s-a oprit: finalizata, expirata, anulata).
const JOURNEY_PROGRESS: Record<RequestStatus, { reached: number; ongoing: boolean }> = {
  DRAFT: { reached: 0, ongoing: false },
  IN_MARKETPLACE: { reached: 1, ongoing: true },
  CLAIMED_PARTIAL: { reached: 2, ongoing: true },
  CLAIMED_FULL: { reached: 2, ongoing: true },
  OFFERS_RECEIVED: { reached: 3, ongoing: true },
  NEGOTIATION: { reached: 3, ongoing: true },
  ACCEPTED: { reached: 4, ongoing: true },
  IN_EXECUTION: { reached: 4, ongoing: true },
  DELIVERED_BY_COMPANY: { reached: 5, ongoing: true },
  COMPLETED: { reached: 5, ongoing: false },
  // disputa apare dupa finalizare (recenzie sub 3 stele)
  DISPUTED: { reached: 5, ongoing: false },
  // expirata fara preluare: a ramas la „Publicata”
  EXPIRED: { reached: 1, ongoing: false },
  // proiect anulat dupa acceptarea unei oferte
  CANCELLED: { reached: 4, ongoing: false },
};

type JourneyState = 'done' | 'current' | 'upcoming';

const JOURNEY_BAR: Record<JourneyState, string> = {
  done: 'bg-sage',
  current: 'bg-walnut',
  upcoming: 'bg-border-2',
};
const JOURNEY_LABEL: Record<JourneyState, string> = {
  done: 'font-medium text-sage',
  current: 'font-semibold text-walnut',
  upcoming: 'text-muted-foreground',
};

export function RequestJourney({ status, className }: { status: RequestStatus; className?: string }) {
  const t = useTranslations('Requests.journey');
  const { reached, ongoing } = JOURNEY_PROGRESS[status] ?? JOURNEY_PROGRESS.DRAFT;

  return (
    <ol aria-label={t('label')} className={cn('grid grid-cols-5 gap-1.5', className)}>
      {JOURNEY_STEPS.map((step, i) => {
        const state: JourneyState = i >= reached ? 'upcoming' : ongoing && i === reached - 1 ? 'current' : 'done';
        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex min-w-0 flex-col gap-2"
          >
            <span aria-hidden className={cn('h-1 rounded-full', JOURNEY_BAR[state])} />
            <span className={cn('break-words text-meta sm:text-ui', JOURNEY_LABEL[state])}>
              {t(`step.${step}`)}
              <span className="sr-only"> ({t(`state.${state}`)})</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
