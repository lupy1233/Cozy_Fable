'use client';

import {
  evalCondition,
  visibleOptions,
  type AnswerMap,
  type AnswerValue,
  type ChoiceOption,
  type InfoContentRef,
  type QuestionStep,
  type RoomType,
  type ItemSystem,
  type Material,
  type RequestItemInput,
  type PieceRowV2,
  FIRM_DECIDES,
  NO_FRONTS,
  PIECE_ROW_DESCRIPTION_MAX,
  PIECE_ROW_DIM_MAX_CM,
  PIECE_ROW_DIM_MIN_CM,
  PIECE_ROW_V2_SYSTEMS,
  pieceRowV2Schema,
} from '@marketplace/shared';
import { Info, Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { formatDecimal } from '@/lib/decimal';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ConfiguratorIcon } from '@/lib/configurator-icons';
import type { AttachmentTarget } from '@/hooks/use-requests';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { BOOLEAN_ILLUSTRATIONS, getIllustration } from './illustrations';
import { getQuestionTargets, QuestionTargetStrip } from './illustrations/question-anchor';
import { getDimensionFigure } from './dimension-figures';
import { Configurator3dStep } from './piece3d/dynamic';
import { CompactChoiceCard, PlayingCard } from './playing-card';
import { RoomSketchUpload } from './room-sketch-upload';
import { ContactInTextHint } from './contact-in-text-hint';
import { useDecimalField } from './use-decimal-field';

interface StepRendererProps {
  step: QuestionStep;
  answers: AnswerMap;
  roomType: RoomType;
  // versiunea flow-ului camerei — etichetele din banda-tinta se iau din
  // definitia originala, nu din versiunea curenta
  flowVersion?: number;
  onChange: (value: AnswerValue) => void;
  onInfo: (info: InfoContentRef) => void;
  error?: string;
  // step secundar pe acelasi ecran (screenGroup): titlu mai mic, UI compact
  inline?: boolean;
  // pur vizual: "1/3" in fata titlului cand ecranul are mai multe intrebari
  counter?: string;
  // context pentru step-urile 'upload' (schita per camera); roomCount
  // dimensioneaza capul global de fisiere al cererii
  uploadContext?: { target: AttachmentTarget; hasOwnProject: boolean; roomCount: number };
  // context pentru step-urile 'configurator-3d': snapshotul PNG al scenei (R4)
  config3dContext?: { onSnapshot: (dataUrl: string | null) => void };
}

// Antet pas: titlu + subtitlu + buton Info la nivel de intrebare (optional).
function StepShell({
  step,
  roomType,
  answers,
  flowVersion,
  onInfo,
  error,
  inline,
  counter,
  children,
}: {
  step: QuestionStep;
  roomType: RoomType;
  answers: AnswerMap;
  flowVersion?: number;
  onInfo: (info: InfoContentRef) => void;
  error?: string;
  inline?: boolean;
  counter?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('Configurator');
  // banda-tinta (PO r10/r11): toate corpurile camerei, cu highlight pe cel
  // vizat de intrebarea de material/deschidere
  const targets = inline ? null : getQuestionTargets(roomType, step, answers, flowVersion);
  return (
    <div className="flex flex-col gap-4" data-question-id={step.id} data-room-type={roomType}>
      <div>
        <div className="flex items-center gap-3">
          {/* vizualul piesei la care se refera intrebarea (feedback PO F4) */}
          {!targets && step.icon && !inline && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-walnut-soft text-walnut [&_svg]:h-6 [&_svg]:w-6">
              <ConfiguratorIcon name={step.icon} />
            </span>
          )}
          {/* contorul sta LANGA titlu, nu in el: numele titlului ramane exact intrebarea */}
          {counter && (
            <span aria-hidden className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {counter}
            </span>
          )}
          {inline ? (
            <h3 className="heading-section">{t(step.titleKey)}</h3>
          ) : (
            <h2 className="font-serif text-2xl leading-[1.2] sm:text-3xl">{t(step.titleKey)}</h2>
          )}
          {step.info && (
            <button
              type="button"
              onClick={() => onInfo(step.info!)}
              aria-label={t('info.showInfo')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-walnut-soft hover:text-walnut"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
        {step.subtitleKey && (
          <p className="mt-1 text-sm text-muted-foreground">{t(step.subtitleKey)}</p>
        )}
      </div>
      {targets && <QuestionTargetStrip data={targets} />}
      {children}
      {error && <p className="text-sm text-crimson">{t(error)}</p>}
    </div>
  );
}

// factorii de conversie pentru afisarea dimensiunilor (stocarea ramane in metri)
const UNIT_FACTOR = { m: 1, cm: 100, mm: 1000 } as const;

const cnUnit = (active: boolean) =>
  'rounded-full px-2 py-0.5 uppercase tracking-[0.06em] transition-colors ' +
  (active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground');

// Campul comun de dimensiuni din pasii camerelor (b1): text cu virgula, ciorna
// locala a textului; in raspuns se scrie doar textul care se poate citi.
function DimensionSlotInput({
  id,
  metersVal,
  factor,
  unit,
  outOfRange,
  onMeters,
  hint,
}: {
  id: string;
  metersVal: number | undefined;
  factor: number;
  unit: string;
  outOfRange: boolean;
  onMeters: (meters: number | undefined) => void;
  hint: React.ReactNode;
}) {
  const field = useDecimalField({
    value: metersVal === undefined ? undefined : metersVal * factor,
    commitOn: 'change',
    onValue: (v) => onMeters(v === undefined ? undefined : v / factor),
  });
  const invalid = outOfRange || field.error !== null;
  return (
    <>
      <div className="relative">
        <Input
          id={id}
          {...field.inputProps}
          aria-invalid={invalid || undefined}
          className={invalid ? 'border-crimson pr-10' : 'pr-10'}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
      {field.error ? <p className="mt-1 text-meta text-crimson">{field.error}</p> : hint}
    </>
  );
}

// Tipul de intrebare "numar simplu" (nefolosit azi in fluxuri) — acelasi cititor.
function NumberStepInput({
  value,
  onValue,
}: {
  value: number | undefined;
  onValue: (value: number | undefined) => void;
}) {
  const field = useDecimalField({ value, onValue, commitOn: 'change' });
  return (
    <>
      <Input {...field.inputProps} className={field.error ? 'max-w-40 border-crimson' : 'max-w-40'} />
      {field.error && <p className="mt-1 text-meta text-crimson">{field.error}</p>}
    </>
  );
}

export function StepRenderer(props: StepRendererProps) {
  const inputId = useId();
  const locale = useLocale();
  const {
    step,
    answers,
    roomType,
    flowVersion,
    onChange,
    onInfo,
    error,
    inline,
    counter,
    uploadContext,
    config3dContext,
  } = props;
  const t = useTranslations('Configurator');
  const dimensionUnit = useConfiguratorStore((s) => s.dimensionUnit);
  const setDimensionUnit = useConfiguratorStore((s) => s.setDimensionUnit);
  const value = answers[step.id];

  // Vizualul fetei: ilustratie dedicata → icon lucide mare (fallback)
  const optionVisual = (opt: ChoiceOption) => {
    const Illu = getIllustration(roomType, step.id, opt.value);
    if (Illu) return <Illu />;
    return (
      <span className="grid h-full w-full place-items-center [&_svg]:h-12 [&_svg]:w-12">
        <ConfiguratorIcon name={opt.icon ?? 'package'} />
      </span>
    );
  };

  const optionCard = (opt: ChoiceOption, selected: boolean, multi: boolean, onSelect: () => void) => (
    <PlayingCard
      key={opt.value}
      multi={multi}
      selected={selected}
      onSelect={onSelect}
      title={t(opt.labelKey)}
      sub={opt.descriptionKey ? t(opt.descriptionKey) : undefined}
      visual={optionVisual(opt)}
      info={opt.info}
      recommended={opt.recommendedIf ? evalCondition(opt.recommendedIf, answers) : false}
    />
  );

  // Cartonas compact cu poza pentru step-urile choice secundare ale unui ecran
  // (screenGroup) — design 2026-11: fara pastile. Pastreaza butonul Info per
  // optiune (deschide dialogul de detalii) si eticheta "Recomandat".
  const optionTile = (opt: ChoiceOption, selected: boolean, multi: boolean, onSelect: () => void) => {
    const Illustration = getIllustration(roomType, step.id, opt.value);
    const priceKey = opt.info?.priceHintKey;
    return (
      <CompactChoiceCard
        key={opt.value}
        multi={multi}
        selected={selected}
        onSelect={onSelect}
        title={t(opt.labelKey)}
        visual={
          Illustration ? (
            <Illustration />
          ) : (
            <span className="grid h-12 w-12 place-items-center">
              <ConfiguratorIcon name={opt.icon ?? 'package'} />
            </span>
          )
        }
        recommended={opt.recommendedIf ? evalCondition(opt.recommendedIf, answers) : false}
        price={priceKey && t.has(priceKey) ? t(priceKey) : undefined}
        onInfo={opt.info ? () => onInfo(opt.info!) : undefined}
        infoLabel={t('info.showInfoFor', { option: t(opt.labelKey) })}
      />
    );
  };

  // grila cartonaselor mari (intrebarea principala a ecranului) si a celor compacte
  const cardGrid = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';
  const tileGrid = 'grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]';

  // Conventie: ecranele din screenGroup 'materials' (material per piesa, v2)
  // se randeaza compact si pentru PRIMUL step — randurile sunt echivalente,
  // nu exista o intrebare "principala" cu carduri mari.
  const compactChoice = inline || step.screenGroup === 'materials';

  if (step.type === 'single-choice') {
    const options = visibleOptions(step, answers);
    if (compactChoice) {
      return (
        <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} inline={inline} counter={counter}>
          <div className={tileGrid}>
            {options.map((opt) => optionTile(opt, value === opt.value, false, () => onChange(opt.value)))}
          </div>
        </StepShell>
      );
    }
    return (
      <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} counter={counter}>
        <div className={cardGrid}>
          {options.map((opt) => optionCard(opt, value === opt.value, false, () => onChange(opt.value)))}
        </div>
      </StepShell>
    );
  }

  if (step.type === 'multi-choice') {
    const options = visibleOptions(step, answers);
    const selected = Array.isArray(value) ? (value as string[]) : [];
    // etapa 6: optiunile `exclusive` ("Nu stiu — vreau recomandarea firmei", "Fara usi
    // sau sertare") se aleg singure — bifarea lor goleste restul, bifarea altei optiuni
    // le scoate. Fara optiuni exclusive (versiunile vechi): comportament neschimbat.
    const exclusiveValues = new Set(step.options.filter((o) => o.exclusive).map((o) => o.value));
    const toggle = (v: string) => {
      if (selected.includes(v)) return onChange(selected.filter((x) => x !== v));
      if (exclusiveValues.has(v)) return onChange([v]);
      onChange([...selected.filter((x) => !exclusiveValues.has(x)), v]);
    };
    if (inline) {
      return (
        <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} inline counter={counter}>
          <div className={tileGrid}>
            {options.map((opt) => optionTile(opt, selected.includes(opt.value), true, () => toggle(opt.value)))}
          </div>
        </StepShell>
      );
    }
    return (
      <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} counter={counter}>
        <div className={cardGrid}>
          {options.map((opt) => optionCard(opt, selected.includes(opt.value), true, () => toggle(opt.value)))}
        </div>
      </StepShell>
    );
  }

  if (step.type === 'boolean') {
    // bifa compacta (kitchen v3 "materiale diferite pe zone"): o alegere secundara
    // pe un ecran cu multe carduri nu merita un cartonas mare
    if (step.toggleStyle === 'checkbox') {
      const on = value === true;
      return (
        <label
          data-question-id={step.id}
          data-room-type={roomType}
          className="flex min-h-11 cursor-pointer items-start gap-2.5 py-2.5"
        >
          <input
            type="checkbox"
            checked={on}
            onChange={() => onChange(!on)}
            className="mt-px h-[18px] w-[18px] shrink-0 accent-[hsl(var(--walnut))]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm">{t(step.cardLabelKey ?? step.titleKey)}</span>
            {step.subtitleKey && <span className="text-xs text-muted-foreground">{t(step.subtitleKey)}</span>}
          </span>
        </label>
      );
    }
    // inline (add-on pe acelasi ecran, ex. insula): acelasi card "carte de joc"
    // ca optiunile intrebarii principale, dar cu bifa de checkbox (U1, PO r4) —
    // aliniat in aceeasi grila ca sa citeasca drept "inca un cartonas"
    // M1 (etapa 6): o intrebare da / nu OBLIGATORIE pe un ecran cu alte intrebari (ex.
    // sameFinishAll, bedUpholstered din dormitor v3) e perechea Da / Nu, fara nimic ales
    // (PO c14-2); starea aleasa e anuntata prin aria-pressed, ca la celelalte cartonase.
    // Bifele optionale (insula, LED) raman cartonasul unic de mai jos.
    if (inline && !step.optional) {
      const YesIllu = getIllustration(roomType, step.id, 'YES') ?? BOOLEAN_ILLUSTRATIONS.yes;
      return (
        <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} inline counter={counter}>
          <div role="group" aria-label={t(step.titleKey)} data-boolean-pair className="grid gap-4 sm:grid-cols-2">
            <PlayingCard
              selected={value === true}
              onSelect={() => onChange(true)}
              title={t('common.boolean.yes')}
              visual={<YesIllu />}
            />
            <PlayingCard
              selected={value === false}
              onSelect={() => onChange(false)}
              title={t('common.boolean.no')}
              visual={<BOOLEAN_ILLUSTRATIONS.no />}
            />
          </div>
        </StepShell>
      );
    }
    if (inline) {
      const Illu = getIllustration(roomType, step.id, 'YES');
      const on = value === true;
      return (
        <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} inline counter={counter}>
          <div className={cardGrid}>
            <PlayingCard
              multi
              selected={on}
              onSelect={() => onChange(!on)}
              title={t(step.cardLabelKey ?? 'common.boolean.yes')}
              visual={
                Illu ? (
                  <Illu />
                ) : (
                  <span className="grid h-full w-full place-items-center [&_svg]:h-12 [&_svg]:w-12">
                    <ConfiguratorIcon name={step.icon ?? 'package'} />
                  </span>
                )
              }
              info={step.info}
            />
          </div>
        </StepShell>
      );
    }
    // cardul "Da" arata conceptul intrebarii (ex. banda LED, tablie tapitata)
    // cand exista un desen inregistrat; altfel bifa generica
    const YesIllu = getIllustration(roomType, step.id, 'YES') ?? BOOLEAN_ILLUSTRATIONS.yes;
    const NoIllu = BOOLEAN_ILLUSTRATIONS.no;
    return (
      <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} counter={counter}>
        <div className="grid gap-4 sm:grid-cols-2">
          <PlayingCard
            selected={value === true}
            onSelect={() => onChange(true)}
            title={t('common.boolean.yes')}
            visual={<YesIllu />}
          />
          <PlayingCard
            selected={value === false}
            onSelect={() => onChange(false)}
            title={t('common.boolean.no')}
            visual={<NoIllu />}
          />
        </div>
      </StepShell>
    );
  }

  if (step.type === 'dimension-group') {
    const slots = step.slots(answers);
    const values = (value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {}) as Record<string, number>;
    const factor = UNIT_FACTOR[dimensionUnit];
    // afisare fara artefacte float (0.30000000000000004 → 0.3)
    const fmtNum = (v: number) => Math.round(v * 10000) / 10000;
    // afisare dupa limba: "1,6 m" in romana (b1); ce se salveaza ramane numar
    const fmtShow = (v: number) => formatDecimal(v, locale);
    // plansa cu litere (A/B/C/H...) — valorile completate apar si langa litere
    // pe desen (feedback PO 2026-07-13), pe langa legenda si campuri
    const valueLabels: Record<string, string> = {};
    for (const s of slots) {
      if (Number.isFinite(values[s.id])) {
        valueLabels[s.id] = `${fmtShow(values[s.id] * factor)} ${dimensionUnit}`;
      }
    }
    const figure =
      step.id === 'dimensions' || step.id === 'bedCustomSize'
        ? getDimensionFigure(roomType, answers, slots.map((s) => s.id), valueLabels)
        : null;
    const letterOf = (slotId: string) => figure?.letters[slotId];
    const legend = slots
      .filter((s) => letterOf(s.id) && Number.isFinite(values[s.id]))
      .map((s) => `${letterOf(s.id)} = ${fmtShow(values[s.id] * factor)} ${dimensionUnit}`);
    return (
      <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} counter={counter}>
        {figure && (
          <figure className="rounded-xl border border-border-2 bg-surface-2 p-4">
            {figure.node}
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">
              {legend.length > 0 ? (
                <span className="font-mono tabular-nums">{legend.join(' · ')}</span>
              ) : (
                t('diagram.caption')
              )}
            </figcaption>
          </figure>
        )}
        {/* comutator unitate de masura — valorile raman in metri in answers */}
        <div className="flex justify-end">
          <div className="inline-flex items-center rounded-full border border-border-2 bg-surface-2 p-0.5 font-mono text-meta">
            {(['m', 'cm', 'mm'] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={dimensionUnit === u}
                onClick={() => setDimensionUnit(u)}
                className={cnUnit(dimensionUnit === u)}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {slots.map((slot) => {
            const metersVal = values[slot.id];
            const hasValue = Number.isFinite(metersVal);
            const outOfRange = hasValue && (metersVal < slot.min || metersVal > slot.max);
            const rangeText = `${fmtShow(slot.min * factor)}–${fmtShow(slot.max * factor)} ${dimensionUnit}`;
            const letter = letterOf(slot.id);
            return (
              <Field
                key={slot.id}
                htmlFor={`${inputId}-${slot.id}`}
                label={
                  letter ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="grid h-5 w-5 place-items-center rounded-full border border-brass/60 font-mono text-meta font-bold text-brass">
                        {letter}
                      </span>
                      {t(slot.labelKey)}
                    </span>
                  ) : (
                    t(slot.labelKey)
                  )
                }
              >
                <DimensionSlotInput
                  id={`${inputId}-${slot.id}`}
                  metersVal={hasValue ? metersVal : undefined}
                  factor={factor}
                  unit={dimensionUnit}
                  outOfRange={outOfRange}
                  onMeters={(meters) => {
                    const next = { ...values };
                    if (meters === undefined) delete next[slot.id];
                    else next[slot.id] = fmtNum(meters);
                    onChange(next);
                  }}
                  hint={
                    /* validare imediata per camp, nu doar la Continua */
                    outOfRange ? (
                      <p className="mt-1 text-meta text-crimson">
                        {t('validation.dimensionRange', { range: rangeText })}
                      </p>
                    ) : (
                      <p className="mt-1 text-meta text-muted-foreground">{rangeText}</p>
                    )
                  }
                />
              </Field>
            );
          })}
        </div>
      </StepShell>
    );
  }

  if (step.type === 'number') {
    return (
      <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} inline={inline} counter={counter}>
        <NumberStepInput
          value={typeof value === 'number' ? value : undefined}
          onValue={(v) => onChange(v === undefined ? (undefined as never) : v)}
        />
      </StepShell>
    );
  }

  if (step.type === 'text') {
    const text = typeof value === 'string' ? value : '';
    // c7: contor "x / max" sub campurile cu limita (de ex. materialul scris la "Altul"),
    // ca la randul "Alta piesa"; limita din validare ramane cea din flux
    const textCounterId = `${inputId}-text-counter`;
    const hasMax = typeof step.maxLength === 'number';
    return (
      <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} inline={inline} counter={counter}>
        {step.multiline ? (
          <Textarea
            rows={4}
            maxLength={step.maxLength}
            aria-describedby={hasMax ? textCounterId : undefined}
            value={text}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input
            maxLength={step.maxLength}
            aria-describedby={hasMax ? textCounterId : undefined}
            value={text}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {hasMax && (
          <p id={textCounterId} className="mt-1 text-right text-micro text-muted-foreground">
            {t('pieces.charCounter', { count: text.length, max: step.maxLength })}
          </p>
        )}
        <ContactInTextHint value={text} />
      </StepShell>
    );
  }

  if (step.type === 'configurator-3d') {
    return (
      <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} inline={inline} counter={counter}>
        <Configurator3dStep
          piece={step.piece}
          value={value}
          onChange={(config) => onChange(config)}
          onSnapshot={config3dContext?.onSnapshot}
        />
      </StepShell>
    );
  }

  if (step.type === 'upload') {
    const ids = Array.isArray(value) ? (value as string[]) : [];
    return (
      <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} inline={inline} counter={counter}>
        {uploadContext ? (
          <RoomSketchUpload
            target={uploadContext.target}
            roomCount={uploadContext.roomCount}
            hasOwnProject={uploadContext.hasOwnProject}
            value={ids}
            maxFiles={step.maxFiles}
            onChange={(next) => onChange(next)}
          />
        ) : null}
      </StepShell>
    );
  }

  // pieces — rowVersion 2 (etapa 6, "Alta piesa" v2) are randul nou; v1 ramane neschimbat
  const v2Rows = step.rowVersion === 2 && Array.isArray(value) ? (value as unknown as PieceRowV2[]) : [];
  // m2: la v2, eroarea unui rand se arata langa campul lui; sus ramane doar eroarea
  // pasului care nu tine de un rand (de ex. "adauga cel putin o piesa")
  const rowHasError = Boolean(error) && v2Rows.some((r) => Object.keys(pieceRowV2Errors(r)).length > 0);
  return (
    <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={rowHasError ? undefined : error} counter={counter}>
      {step.rowVersion === 2 ? (
        <PieceRowsV2
          pieces={v2Rows}
          onChange={(next) => onChange(next as unknown as AnswerValue)}
          showErrors={Boolean(error)}
        />
      ) : (
        <PieceRows
          pieces={Array.isArray(value) ? (value as RequestItemInput[]) : []}
          onChange={(next) => onChange(next)}
        />
      )}
    </StepShell>
  );
}

// c10: listele de pe randul "Alta piesa" arata doar ce se ofera azi — aceleasi seturi ca
// OFFERED_MATERIALS / GENERAL_SYSTEMS din flows/common.ts (shared nu le exporta).
// Validarea (requestItemSchema) accepta in continuare toate valorile din enum, iar o valoare
// veche deja aleasa (MDF simplu, BUTON_PRESIUNE, GOLA, AVENTOS) ramane afisata si selectata.
export const PIECE_ROW_MATERIALS: readonly Material[] = [
  'PAL',
  'MDF_INFOLIAT',
  'MDF_VOPSIT',
  'MDF_FURNIR',
  'LEMN_MASIV',
  'ALTUL',
];
export const PIECE_ROW_SYSTEMS: readonly ItemSystem[] = ['MANER', 'PUSH', 'GLISANTE'];
// limitele din requestItemSchema (name max 150, description max 2000)
export const PIECE_NAME_MAX = 150;
export const PIECE_DETAILS_MAX = 2000;

function PieceRows({
  pieces,
  onChange,
}: {
  pieces: RequestItemInput[];
  onChange: (next: RequestItemInput[]) => void;
}) {
  const t = useTranslations('Configurator');
  const uid = useId();
  const update = onChange;
  const addPiece = () =>
    update([...pieces, { name: '', material: 'PAL', systems: [], quantity: 1, description: '' }]);
  const setPiece = (i: number, patch: Partial<RequestItemInput>) =>
    update(pieces.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
      <div className="flex flex-col gap-3">
        {pieces.map((piece, i) => {
          const materials = PIECE_ROW_MATERIALS.includes(piece.material)
            ? PIECE_ROW_MATERIALS
            : [piece.material, ...PIECE_ROW_MATERIALS];
          const systems = [
            ...PIECE_ROW_SYSTEMS,
            ...piece.systems.filter((s) => !PIECE_ROW_SYSTEMS.includes(s)),
          ];
          const details = piece.description ?? '';
          const nameCounterId = `${uid}-${i}-name-counter`;
          const detailsCounterId = `${uid}-${i}-details-counter`;
          // m8: indemnul de la "Altul" e legat de campul Detalii (cititoare de ecran)
          const otherHintId = `${uid}-${i}-other-material-hint`;
          const otherMaterial = piece.material === 'ALTUL';
          return (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border-2 bg-surface-2 p-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label={t('pieces.name')} className="col-span-2">
                <Input
                  value={piece.name}
                  maxLength={PIECE_NAME_MAX}
                  aria-describedby={nameCounterId}
                  onChange={(e) => setPiece(i, { name: e.target.value })}
                />
                <p id={nameCounterId} className="self-end text-micro text-muted-foreground">
                  {t('pieces.charCounter', { count: piece.name.length, max: PIECE_NAME_MAX })}
                </p>
                <ContactInTextHint value={piece.name} />
              </Field>
              <Field label={t('pieces.material')}>
                <Select
                  value={piece.material}
                  onChange={(e) => setPiece(i, { material: e.target.value as RequestItemInput['material'] })}
                >
                  {materials.map((m) => (
                    <option key={m} value={m}>
                      {t(`common.materials.${m}.label`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('pieces.quantity')}>
                <Input
                  type="number"
                  min={1}
                  value={piece.quantity}
                  onChange={(e) => setPiece(i, { quantity: Number(e.target.value) || 1 })}
                />
              </Field>
            </div>
            <Field label={t('pieces.details')}>
              <Textarea
                rows={2}
                value={details}
                maxLength={PIECE_DETAILS_MAX}
                placeholder={t('pieces.detailsPlaceholder')}
                aria-describedby={otherMaterial ? `${otherHintId} ${detailsCounterId}` : detailsCounterId}
                onChange={(e) => setPiece(i, { description: e.target.value })}
              />
              {otherMaterial && (
                <p id={otherHintId} className="text-xs text-muted-foreground">
                  {t('pieces.otherMaterialHint')}
                </p>
              )}
              <p id={detailsCounterId} className="self-end text-micro text-muted-foreground">
                {t('pieces.charCounter', { count: details.length, max: PIECE_DETAILS_MAX })}
              </p>
              <ContactInTextHint value={details} />
            </Field>
            <div className="flex flex-wrap gap-3 text-sm">
              {systems.map((s) => {
                const checked = piece.systems.includes(s);
                return (
                  <label key={s} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="accent-walnut"
                      checked={checked}
                      onChange={(e) => {
                        const set = new Set(piece.systems);
                        if (e.target.checked) set.add(s);
                        else set.delete(s);
                        setPiece(i, { systems: [...set] });
                      }}
                    />
                    {t(`common.systems.${s}.label`)}
                  </label>
                );
              })}
              <button
                type="button"
                onClick={() => update(pieces.filter((_, idx) => idx !== i))}
                className="ml-auto flex items-center gap-1 text-crimson"
              >
                <X className="h-4 w-4" />
                {t('pieces.remove')}
              </button>
            </div>
          </div>
          );
        })}
        <Button type="button" variant="secondary" size="sm" onClick={addPiece} className="self-start">
          <Plus className="mr-1 h-4 w-4" />
          {t('pieces.add')}
        </Button>
      </div>
  );
}

// Etapa 6 (c10, DESIGN §5.11): randul "Alta piesa" v2 — dimensiuni optionale in cm,
// "Nu stiu — vreau recomandarea firmei" la material (salvat ca ALTUL + materialChoice) si
// deschiderea obligatorie cu iesirile exclusive "Decide firma" / "Fara usi sau sertare"
// (openingChoice, fara sisteme). Validarea = pieceRowV2Schema din shared.
type PieceRowDimKey = 'widthCm' | 'heightCm' | 'depthCm';
type PieceRowOptionalKey = PieceRowDimKey | 'materialChoice' | 'openingChoice';
const PIECE_ROW_DIMS: { key: PieceRowDimKey; labelKey: string }[] = [
  { key: 'widthCm', labelKey: 'pieces.width' },
  { key: 'heightCm', labelKey: 'pieces.height' },
  { key: 'depthCm', labelKey: 'pieces.depth' },
];
const PIECE_ROW_OPENING_EXITS = [FIRM_DECIDES, NO_FRONTS] as const;

// m2 (revizuire): erorile fiecarui rand, dupa camp — din aceeasi schema ca pe server.
// Cheile fara prefixul `validation.` (itemNameTooShort, quantityTooLow) primesc textul campului.
export type PieceRowField = 'name' | 'material' | 'quantity' | 'description' | 'systems' | PieceRowDimKey;
export function pieceRowV2Errors(row: unknown): Partial<Record<PieceRowField, string>> {
  const parsed = pieceRowV2Schema.safeParse(row);
  if (parsed.success) return {};
  const out: Partial<Record<PieceRowField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    const key: PieceRowField =
      typeof field === 'string' && ['name', 'material', 'quantity', 'description', 'widthCm', 'heightCm', 'depthCm'].includes(field)
        ? (field as PieceRowField)
        : 'systems';
    if (out[key]) continue;
    if (key === 'name') out.name = 'pieces.errors.name';
    else if (key === 'systems') out.systems = issue.message === 'validation.exclusiveOption' ? issue.message : 'pieces.errors.opening';
    else if (key === 'widthCm' || key === 'heightCm' || key === 'depthCm')
      out[key] = typeof (row as Record<string, unknown> | null)?.[key] === 'string' ? 'pieces.errors.wholeCm' : 'validation.dimensionOutOfRange';
    else out[key] = issue.message.startsWith('validation.') ? issue.message : 'validation.answerInvalid';
  }
  return out;
}

// m1 (revizuire + hotararea coordonatorului): ce vede omul e ce sta in raspuns. Un intreg se
// salveaza ca numar; un text nevalid ("12,5", "60.5", litere) se salveaza ca TEXT — marcaj pe
// care pieceRowV2Schema il respinge (validation.dimensionOutOfRange), deci "Continua" e blocat
// si randul nu se poate publica; eroarea apare pe camp. Gol → cheia scoasa (dimensiune optionala).
export function pieceDimFromText(raw: string): number | string | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : raw;
}

function PieceDimInput({
  id,
  value,
  describedBy,
  onValue,
}: {
  id: string;
  // number = valoarea salvata; string = textul nevalid pastrat ca marcaj
  value: unknown;
  describedBy: string;
  onValue: (v: number | string | undefined) => void;
}) {
  const t = useTranslations('Configurator');
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  const notWhole = typeof value === 'string';
  const invalidRange = typeof value === 'number' && (value < PIECE_ROW_DIM_MIN_CM || value > PIECE_ROW_DIM_MAX_CM);
  const invalid = notWhole || invalidRange;
  const errorId = `${id}-error`;
  return (
    <>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          maxLength={6}
          value={text}
          aria-describedby={invalid ? `${errorId} ${describedBy}` : describedBy}
          aria-invalid={invalid || undefined}
          className={invalid ? 'border-crimson pr-10' : 'pr-10'}
          onChange={(e) => onValue(pieceDimFromText(e.target.value))}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          cm
        </span>
      </div>
      {invalid && (
        <p id={errorId} className="mt-1 text-meta text-crimson">
          {notWhole
            ? t('pieces.errors.wholeCm')
            : `${t('validation.dimensionOutOfRange')} (${PIECE_ROW_DIM_MIN_CM}–${PIECE_ROW_DIM_MAX_CM} cm)`}
        </p>
      )}
    </>
  );
}

function PieceRowsV2({
  pieces,
  onChange,
  showErrors,
}: {
  pieces: PieceRowV2[];
  onChange: (next: PieceRowV2[]) => void;
  // dupa un "Continua" respins: erorile fiecarui rand, langa campul cu problema
  showErrors: boolean;
}) {
  const t = useTranslations('Configurator');
  const uid = useId();
  const addPiece = () =>
    onChange([...pieces, { name: '', material: 'PAL', systems: [], quantity: 1, description: '' }]);
  // patch + chei scoase de tot (schema e .strict(): campurile renuntate nu raman in raspuns)
  const setPiece = (i: number, patch: Partial<PieceRowV2>, remove: PieceRowOptionalKey[] = []) =>
    onChange(
      pieces.map((p, idx) => {
        if (idx !== i) return p;
        const next: PieceRowV2 = { ...p, ...patch };
        for (const k of remove) delete next[k];
        return next;
      }),
    );
  const checkLabel = 'flex min-h-11 cursor-pointer items-center gap-2 pr-1';

  return (
    <div className="flex flex-col gap-3">
      {pieces.map((piece, i) => {
        const firmMaterial = piece.materialChoice === FIRM_DECIDES;
        const materialValue = firmMaterial ? FIRM_DECIDES : piece.material;
        const materials: string[] = PIECE_ROW_MATERIALS.includes(piece.material) || firmMaterial
          ? [...PIECE_ROW_MATERIALS]
          : [piece.material, ...PIECE_ROW_MATERIALS];
        const systems: string[] = [
          ...PIECE_ROW_V2_SYSTEMS,
          ...piece.systems.filter((s) => !(PIECE_ROW_V2_SYSTEMS as readonly string[]).includes(s)),
        ];
        const details = piece.description ?? '';
        const nameCounterId = `${uid}-${i}-name-counter`;
        const nameErrorId = `${uid}-${i}-name-error`;
        const detailsCounterId = `${uid}-${i}-details-counter`;
        const otherHintId = `${uid}-${i}-other-material-hint`;
        const dimsHintId = `${uid}-${i}-dims-hint`;
        const openingErrorId = `${uid}-${i}-opening-error`;
        const otherMaterial = piece.material === 'ALTUL' && !firmMaterial;
        const errors = showErrors ? pieceRowV2Errors(piece) : {};
        const fieldError = (key: 'material' | 'quantity' | 'description') =>
          errors[key] ? <p className="text-meta text-crimson">{t(errors[key]!)}</p> : null;
        return (
          <div
            key={i}
            data-piece-row-version="2"
            data-row-invalid={Object.keys(errors).length > 0 || undefined}
            className={`flex flex-col gap-2 rounded-lg border bg-surface-2 p-3 ${
              Object.keys(errors).length > 0 ? 'border-crimson' : 'border-border-2'
            }`}
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label={t('pieces.name')} className="col-span-2">
                <Input
                  value={piece.name}
                  maxLength={PIECE_NAME_MAX}
                  aria-describedby={errors.name ? `${nameErrorId} ${nameCounterId}` : nameCounterId}
                  aria-invalid={errors.name ? true : undefined}
                  className={errors.name ? 'border-crimson' : undefined}
                  onChange={(e) => setPiece(i, { name: e.target.value })}
                />
                {errors.name && (
                  <p id={nameErrorId} className="text-meta text-crimson">
                    {t(errors.name)}
                  </p>
                )}
                <p id={nameCounterId} className="self-end text-micro text-muted-foreground">
                  {t('pieces.charCounter', { count: piece.name.length, max: PIECE_NAME_MAX })}
                </p>
                <ContactInTextHint value={piece.name} />
              </Field>
              <Field label={t('pieces.material')}>
                <Select
                  value={materialValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === FIRM_DECIDES) setPiece(i, { material: 'ALTUL', materialChoice: FIRM_DECIDES });
                    else setPiece(i, { material: v as Material }, ['materialChoice']);
                  }}
                >
                  {materials.map((m) => (
                    <option key={m} value={m}>
                      {t(`common.materials.${m}.label`)}
                    </option>
                  ))}
                  {/* eticheta scurta incape in lista (cea lunga se taia); textul lung = descrierea de sub lista */}
                  <option value={FIRM_DECIDES} title={t('pieces.firmDecides')}>
                    {t('pieces.firmDecidesShort')}
                  </option>
                </Select>
                {firmMaterial && (
                  <p data-firm-decides-hint className="text-xs text-muted-foreground">
                    {t('pieces.firmDecides')}
                  </p>
                )}
                {fieldError('material')}
              </Field>
              <Field label={t('pieces.quantity')}>
                <Input
                  type="number"
                  min={1}
                  value={piece.quantity}
                  onChange={(e) => setPiece(i, { quantity: Number(e.target.value) || 1 })}
                />
                {fieldError('quantity')}
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {PIECE_ROW_DIMS.map(({ key, labelKey }) => {
                const v = piece[key];
                const id = `${uid}-${i}-${key}`;
                return (
                  <Field key={key} label={t(labelKey)} htmlFor={id}>
                    <PieceDimInput
                      id={id}
                      value={v}
                      describedBy={dimsHintId}
                      onValue={(next) => {
                        if (next === undefined) setPiece(i, {}, [key]);
                        else {
                          // textul nevalid ramane in raspuns ca marcaj respins de schema
                          setPiece(i, { [key]: next } as unknown as Partial<PieceRowV2>);
                        }
                      }}
                    />
                  </Field>
                );
              })}
              <p id={dimsHintId} className="col-span-3 text-meta text-muted-foreground">
                {t('pieces.dimensionsHint')}
              </p>
            </div>
            <Field label={t('pieces.details')}>
              <Textarea
                rows={2}
                value={details}
                maxLength={PIECE_ROW_DESCRIPTION_MAX}
                placeholder={t('pieces.detailsPlaceholder')}
                aria-describedby={otherMaterial ? `${otherHintId} ${detailsCounterId}` : detailsCounterId}
                onChange={(e) => setPiece(i, { description: e.target.value })}
              />
              {otherMaterial && (
                <p id={otherHintId} className="text-xs text-muted-foreground">
                  {t('pieces.otherMaterialHint')}
                </p>
              )}
              {fieldError('description')}
              <p id={detailsCounterId} className="self-end text-micro text-muted-foreground">
                {t('pieces.charCounter', { count: details.length, max: PIECE_ROW_DESCRIPTION_MAX })}
              </p>
              <ContactInTextHint value={details} />
            </Field>
            <fieldset
              className="flex flex-wrap items-center gap-x-4 text-sm"
              aria-describedby={errors.systems ? openingErrorId : undefined}
              aria-invalid={errors.systems ? true : undefined}
            >
              <legend className="mb-1 w-full text-xs font-medium text-muted-foreground">
                {t('pieces.openingTitle')}
              </legend>
              {systems.map((s) => (
                <label key={s} className={checkLabel}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-walnut"
                    checked={!piece.openingChoice && piece.systems.includes(s as ItemSystem)}
                    onChange={(e) => {
                      const set = new Set(piece.systems);
                      if (e.target.checked) set.add(s as ItemSystem);
                      else set.delete(s as ItemSystem);
                      // o deschidere reala scoate iesirea exclusiva
                      setPiece(i, { systems: [...set] }, ['openingChoice']);
                    }}
                  />
                  {t(`common.systems.${s}.label`)}
                </label>
              ))}
              {PIECE_ROW_OPENING_EXITS.map((exit) => (
                <label key={exit} className={checkLabel}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-walnut"
                    checked={piece.openingChoice === exit}
                    onChange={(e) => {
                      if (e.target.checked) setPiece(i, { systems: [], openingChoice: exit });
                      else setPiece(i, {}, ['openingChoice']);
                    }}
                  />
                  {t(exit === FIRM_DECIDES ? 'pieces.firmDecides' : 'pieces.noFronts')}
                </label>
              ))}
              {errors.systems && (
                <p id={openingErrorId} className="w-full text-meta text-crimson">
                  {t(errors.systems)}
                </p>
              )}
            </fieldset>
            {/* m6: "Sterge" tine de rand, nu de grupul "Cum se deschide" */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onChange(pieces.filter((_, idx) => idx !== i))}
                className="flex min-h-11 items-center gap-1 px-2 text-sm text-crimson"
              >
                <X className="h-4 w-4" />
                {t('pieces.remove')}
              </button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="secondary" size="sm" onClick={addPiece} className="self-start">
        <Plus className="mr-1 h-4 w-4" />
        {t('pieces.add')}
      </Button>
    </div>
  );
}
