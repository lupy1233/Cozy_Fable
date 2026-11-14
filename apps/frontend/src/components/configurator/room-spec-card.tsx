'use client';

import {
  ROOM_KIND,
  summarizeAnswers,
  type AnswerMap,
  type AnswerSummaryEntry,
  type AttachmentDto,
  type RequestItemDto,
  type RequestRoomDto,
} from '@marketplace/shared';
import { Layers, MoveDiagonal, NotebookPen, Paperclip, Rotate3d, Sparkles } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { ConfiguratorIcon } from '@/lib/configurator-icons';
import { ROOM_ICONS } from '@/lib/room-icons';
import { AttachmentThumb } from './attachment-item';
import { config3dChips } from './piece3d/config-chips';
import { PieceViewer3dDialog } from './piece3d/dynamic';

// Prezentarea structurata a unei camere din cerere (feedback PO item 6) —
// inlocuieste lista plata Q→A pe paginile de detaliu (marketplace + client).
// Sectiuni scanabile: configuratie (chips), corpuri & materiale (items derivate),
// dimensiuni, note, fisiere. Randarea Q→A completa ramane in pasul Review.

// intrebarile de material/sisteme sunt deja reprezentate de items-urile derivate
const MATERIAL_STEP = /^(material|frontMaterial|openingSystems|systems)/;

// eticheta slotului de tavan (ceilingHeightSlot din shared) — singura sursa a inaltimii date de client
const CEILING_SLOT_LABEL = 'common.slots.ceilingHeight';

export function RoomSpecCard({
  room,
  index,
  attachments,
  audience = 'company',
}: {
  room: RequestRoomDto;
  // pozitia camerei in cerere (1-based) — folosita si ca ancora de navigare
  index: number;
  attachments?: AttachmentDto[];
  // cine citeste: firma (piata, fisa de lucru) sau clientul (pagina cererii lui)
  audience?: 'company' | 'client';
}) {
  const t = useTranslations('Configurator');
  const tr = useTranslations('Requests');
  const format = useFormatter();
  // viewerul 3D read-only al piesei configurate de client (U4, PO r4)
  const [viewer3d, setViewer3d] = useState(false);

  // b8 (PO g0-8): camera la care clientul cere ajutor vine fara raspunsuri — semnul
  // de ajutor ii ia locul listei; raman doar fisierele ei
  const designHelp = room.needsDesignHelp === true;
  const answers = (room.answers ?? null) as AnswerMap | null;
  const allEntries: AnswerSummaryEntry[] = answers
    ? summarizeAnswers(room.roomType, answers, room.flowVersion ?? 1)
    : [];
  const entries = designHelp ? allEntries.filter((e) => e.kind === 'files') : allEntries;

  const chips = entries.filter(
    (e) => (e.kind === 'choice' || e.kind === 'boolean') && !MATERIAL_STEP.test(e.stepId),
  );
  // piesa configurata 3D (docs/10 R4): chips derivate din config + snapshotul PNG
  const config3d = entries.find(
    (e): e is Extract<AnswerSummaryEntry, { kind: 'config3d' }> => e.kind === 'config3d',
  );
  const snapshotIds = (answers?.snapshot3d ?? []) as string[];
  const snapshot = Array.isArray(snapshotIds)
    ? (attachments ?? []).find((a) => snapshotIds.includes(a.id) && a.downloadUrl)
    : undefined;
  const dims = entries.find((e): e is Extract<AnswerSummaryEntry, { kind: 'dimensions' }> => e.kind === 'dimensions');
  // textele de tip "alt material" sunt deja in description-ul itemelor derivate
  const notes = entries.filter(
    (e): e is Extract<AnswerSummaryEntry, { kind: 'text' }> =>
      e.kind === 'text' && !MATERIAL_STEP.test(e.stepId),
  );
  const fileEntries = entries.filter(
    (e): e is Extract<AnswerSummaryEntry, { kind: 'files' }> => e.kind === 'files',
  );
  const files: AttachmentDto[] = fileEntries.flatMap((e) => {
    const ids = (answers?.[e.stepId] ?? []) as string[];
    const byId = new Map((attachments ?? []).map((a) => [a.id, a]));
    return ids.map((id) => byId.get(id)).filter((a): a is AttachmentDto => !!a);
  });
  const filesCount = fileEntries.reduce((acc, e) => acc + e.count, 0);

  const chipValue = (e: AnswerSummaryEntry): string => {
    if (e.kind === 'choice') return e.optionLabelKeys.map((k) => t(k)).join(', ');
    if (e.kind === 'boolean') return t(e.value ? 'common.boolean.yes' : 'common.boolean.no');
    return '';
  };

  // antetul camerei (d1): metri liniari de mobilier (lengthM, pentru camere = suma fronturilor)
  // si tavanul raspuns de client (slotul ceilingHeight), formatate dupa limba aplicatiei
  const fmtM = (v: number) => format.number(v, { maximumFractionDigits: 2 });
  const isRoom = ROOM_KIND[room.roomType] === 'room';
  const ceiling = dims?.slots.find((s) => s.labelKey === CEILING_SLOT_LABEL)?.value;
  const headerParts: string[] = [];
  if (!designHelp && room.lengthM > 0) headerParts.push(t('roomSpec.furnitureLinear', { m: format.number(room.lengthM, { maximumFractionDigits: 1 }) }));
  if (typeof ceiling === 'number' && ceiling > 0) headerParts.push(t('roomSpec.ceilingHeight', { m: fmtM(ceiling) }));
  // m4: cererile din formularul manual de dinainte de configurator (answers NULL) au
  // lungimea / latimea / inaltimea scrise chiar de client → raman "L × l × H m".
  // O camera din configurator are mereu answers (cea cu ajutor: {} sau doar schitele).
  const legacy = room.answers == null;
  const legacyDims = room.lengthM > 0 && room.widthM > 0 && room.heightM > 0
    ? `${fmtM(room.lengthM)} × ${fmtM(room.widthM)} × ${fmtM(room.heightM)} m`
    : t('roomSpec.dimsUnknown');
  const showHeader = legacy || isRoom;
  const headerText = legacy
    ? legacyDims
    : headerParts.length > 0 ? headerParts.join(' · ') : t('roomSpec.dimsUnknown');

  const itemLine = (it: RequestItemDto) => {
    const systems = it.systems.map((s) => t(`common.systems.${s}.label`)).join(', ');
    return { material: t(`common.materials.${it.material}.label`), systems };
  };

  return (
    <section
      id={`room-${index}`}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      {/* antet: icon camera + nume + gabarit */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-walnut-soft text-walnut [&_svg]:h-5 [&_svg]:w-5">
            <ConfiguratorIcon name={ROOM_ICONS[room.roomType]} />
          </span>
          <h3 className="font-serif text-lg">
            <span className="mr-1.5 font-mono text-xs text-muted-2">{String(index).padStart(2, '0')}</span>
            {t(`rooms.type.${room.roomType}`)}
          </h3>
        </div>
        {/* d1: nu mai aratam "L × l × H" — erau trei numere calculate (metri liniari,
            adancimea standard 0,6 m, tavanul sau 2,6 m implicit), nu dimensiunile camerei.
            La camere: mobilierul in metri liniari, doar cand exista, si tavanul, doar daca
            l-a dat clientul. La piese gabaritul e deja in chips / dimensiunile raspunse.
            Exceptie: camerele legacy (fara answers), unde L × l × H sunt ale clientului. */}
        {showHeader && (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground" data-room-spec-header>
            <MoveDiagonal aria-hidden className="h-3.5 w-3.5" />
            {headerText}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        {designHelp && (
          <p
            data-room-design-help
            className="flex items-start gap-2 rounded-lg border border-brass/40 bg-brass/10 px-3 py-2.5 text-sm font-medium"
          >
            <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brass-2" />
            {/* d1: camera vine fara piese si dimensiuni — nimic pus din oficiu */}
            <span>
              {t(audience === 'client' ? 'roomSpec.designHelpClient' : 'roomSpec.designHelpCompany')}
              <span className="block font-normal text-muted-foreground">{t('roomSpec.designHelpDetails')}</span>
            </span>
          </p>
        )}

        {/* piesa configurata in 3D: snapshotul scenei + chips-urile config-ului
            + viewerul interactiv read-only (U4) */}
        {config3d && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {snapshot && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snapshot.downloadUrl ?? undefined}
                  alt={t('config3d.snapshotAlt')}
                  loading="lazy"
                  // A3: aspect fix → spatiul e rezervat inainte sa se incarce
                  // PNG-ul (fara salturi de layout); contain, nu cover — scena
                  // 3D nu se decupeaza
                  className="aspect-[4/3] w-full max-w-64 shrink-0 rounded-lg border border-border-2 bg-surface-2 object-contain"
                />
              )}
              <div className="flex flex-wrap content-start gap-1.5">
                {config3dChips(t, config3d.config).map((chip, i) => (
                  <span
                    key={i}
                    className="inline-flex items-baseline rounded-full border border-border-2 bg-surface-2 px-2.5 py-1 text-xs font-medium"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewer3d(true)}
              className="inline-flex items-center gap-1.5 self-start rounded-full border border-walnut/40 bg-walnut-soft/60 px-3 py-1.5 text-xs font-medium text-walnut transition-colors hover:border-walnut hover:bg-walnut-soft"
            >
              <Rotate3d className="h-3.5 w-3.5" />
              {t('config3d.viewer.open')}
            </button>
            {viewer3d && (
              <PieceViewer3dDialog
                piece={config3d.piece}
                config={config3d.config}
                onClose={() => setViewer3d(false)}
              />
            )}
          </div>
        )}

        {/* configuratia aleasa — chips intrebare: raspuns */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((e) => (
              <span
                key={e.stepId}
                className="inline-flex max-w-full items-baseline gap-1.5 rounded-full border border-border-2 bg-surface-2 px-2.5 py-1 text-xs"
              >
                <span className="shrink-0 text-muted-2">{t(e.labelKey)}</span>
                <span className="truncate font-medium">{chipValue(e)}</span>
              </span>
            ))}
          </div>
        )}

        {/* corpurile derivate: material + sisteme per corp — esenta pentru oferta */}
        {!designHelp && room.items.length > 0 && (
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 font-mono text-micro uppercase tracking-[0.14em] text-muted-2">
              <Layers className="h-3 w-3" />
              {tr('specItems')}
            </h4>
            <ul className="divide-y divide-border-2 overflow-hidden rounded-lg border border-border-2">
              {room.items.map((it) => {
                const line = itemLine(it);
                return (
                  <li
                    key={it.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-surface-2/50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {it.quantity > 1 && <span className="mr-1 font-mono text-xs text-muted-2">{it.quantity}×</span>}
                      <ContactSafeText text={it.name} />
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="walnut">{line.material}</Badge>
                      {line.systems && <Badge tone="muted">{line.systems}</Badge>}
                    </span>
                    {it.description && (
                      <span className="w-full text-xs text-muted-foreground">
                        <ContactSafeText text={it.description} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* dimensiunile raspunse (sloturile exacte) */}
        {dims && dims.slots.length > 0 && (
          <p className="font-mono text-xs text-muted-foreground">
            {dims.slots.map((s) => `${t(s.labelKey)}: ${fmtM(s.value)} m`).join(' · ')}
          </p>
        )}

        {/* d3 (PO d3-2): lungimea aproximativa data de client cu "Am deja un proiect" */}
        {!designHelp && typeof room.approxLengthM === 'number' && room.approxLengthM > 0 && (
          <p data-room-approx-length className="font-mono text-xs text-muted-foreground">
            {t('roomSpec.approxLength', { m: fmtM(room.approxLengthM) })}
          </p>
        )}

        {/* note text libere (ex. "alt material" e deja in items; raman doar textele reale) */}
        {notes.length > 0 && (
          <div className="flex flex-col gap-1">
            {notes.map((e) => (
              <p key={e.stepId} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-2" />
                <span>
                  <span className="text-muted-2">{t(e.labelKey)}: </span>
                  <span className="whitespace-pre-wrap">
                    <ContactSafeText text={e.value} />
                  </span>
                </span>
              </p>
            ))}
          </div>
        )}

        {/* fisierele camerei: thumbnails cand avem atasamentele, altfel doar numarul */}
        {filesCount > 0 && (
          <div>
            <h4 className="mb-1.5 flex items-center gap-1.5 font-mono text-micro uppercase tracking-[0.14em] text-muted-2">
              <Paperclip className="h-3 w-3" />
              {tr('specFiles')}
            </h4>
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {files.map((a) => (
                  <AttachmentThumb key={a.id} attachment={a} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('summaryFiles.count', { n: filesCount })}</p>
            )}
          </div>
        )}

        {/* fallback legacy (cereri fara answers): doar items-urile */}
        {!answers && !designHelp && room.items.length === 0 && (
          <p className="text-sm text-muted-2">—</p>
        )}
      </div>
    </section>
  );
}

// Bara de navigare intre camere (cand cererea are multe camere): chips-ancora.
export function RoomSpecNav({ rooms }: { rooms: RequestRoomDto[] }) {
  const t = useTranslations('Configurator');
  if (rooms.length < 3) return null;
  return (
    <nav className="sticky top-14 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-lg border border-border bg-surface/90 p-1.5 backdrop-blur">
      {rooms.map((room, i) => (
        <a
          key={room.id}
          href={`#room-${i + 1}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-meta uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-walnut-soft hover:text-walnut"
        >
          <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">
            <ConfiguratorIcon name={ROOM_ICONS[room.roomType]} />
          </span>
          {t(`rooms.type.${room.roomType}`)}
        </a>
      ))}
    </nav>
  );
}
