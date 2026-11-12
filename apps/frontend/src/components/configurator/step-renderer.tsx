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
  ITEM_SYSTEMS,
  MATERIALS,
  type RequestItemInput,
} from '@marketplace/shared';
import { Info, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
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

export function StepRenderer(props: StepRendererProps) {
  const inputId = useId();
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
    const toggle = (v: string) =>
      onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
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
    // plansa cu litere (A/B/C/H...) — valorile completate apar si langa litere
    // pe desen (feedback PO 2026-07-13), pe langa legenda si campuri
    const valueLabels: Record<string, string> = {};
    for (const s of slots) {
      if (Number.isFinite(values[s.id])) {
        valueLabels[s.id] = `${fmtNum(values[s.id] * factor)} ${dimensionUnit}`;
      }
    }
    const figure =
      step.id === 'dimensions' || step.id === 'bedCustomSize'
        ? getDimensionFigure(roomType, answers, slots.map((s) => s.id), valueLabels)
        : null;
    const letterOf = (slotId: string) => figure?.letters[slotId];
    const legend = slots
      .filter((s) => letterOf(s.id) && Number.isFinite(values[s.id]))
      .map((s) => `${letterOf(s.id)} = ${fmtNum(values[s.id] * factor)} ${dimensionUnit}`);
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
            const rangeText = `${fmtNum(slot.min * factor)}–${fmtNum(slot.max * factor)} ${dimensionUnit}`;
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
                <div className="relative">
                  <Input
                    id={`${inputId}-${slot.id}`}
                    type="number"
                    inputMode="decimal"
                    step={fmtNum((slot.step ?? 0.1) * factor)}
                    min={fmtNum(slot.min * factor)}
                    max={fmtNum(slot.max * factor)}
                    value={hasValue ? fmtNum(metersVal * factor) : ''}
                    aria-invalid={outOfRange || undefined}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next = { ...values };
                      if (raw === '') delete next[slot.id];
                      else next[slot.id] = fmtNum(Number(raw) / factor);
                      onChange(next);
                    }}
                    className={outOfRange ? 'border-crimson pr-10' : 'pr-10'}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {dimensionUnit}
                  </span>
                </div>
                {/* validare imediata per camp, nu doar la Continua */}
                {outOfRange ? (
                  <p className="mt-1 text-meta text-crimson">
                    {t('validation.dimensionRange', { range: rangeText })}
                  </p>
                ) : (
                  <p className="mt-1 text-meta text-muted-foreground">{rangeText}</p>
                )}
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
        <Input
          type="number"
          inputMode="decimal"
          step={step.step ?? 1}
          min={step.min}
          max={step.max}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? (undefined as never) : Number(e.target.value))}
          className="max-w-40"
        />
      </StepShell>
    );
  }

  if (step.type === 'text') {
    return (
      <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} inline={inline} counter={counter}>
        {step.multiline ? (
          <Textarea
            rows={4}
            maxLength={step.maxLength}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input
            maxLength={step.maxLength}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <ContactInTextHint value={typeof value === 'string' ? value : ''} />
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

  // pieces
  const pieces = Array.isArray(value) ? (value as RequestItemInput[]) : [];
  const update = (next: RequestItemInput[]) => onChange(next);
  const addPiece = () =>
    update([...pieces, { name: '', material: 'PAL', systems: [], quantity: 1, description: '' }]);
  const setPiece = (i: number, patch: Partial<RequestItemInput>) =>
    update(pieces.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <StepShell roomType={roomType} answers={answers} flowVersion={flowVersion} step={step} onInfo={onInfo} error={error} counter={counter}>
      <div className="flex flex-col gap-3">
        {pieces.map((piece, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border-2 bg-surface-2 p-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label={t('pieces.name')} className="col-span-2">
                <Input value={piece.name} onChange={(e) => setPiece(i, { name: e.target.value })} />
                <ContactInTextHint value={piece.name} />
              </Field>
              <Field label={t('pieces.material')}>
                <Select
                  value={piece.material}
                  onChange={(e) => setPiece(i, { material: e.target.value as RequestItemInput['material'] })}
                >
                  {MATERIALS.map((m) => (
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
            <div className="flex flex-wrap gap-3 text-sm">
              {ITEM_SYSTEMS.map((s) => {
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
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={addPiece} className="self-start">
          <Plus className="mr-1 h-4 w-4" />
          {t('pieces.add')}
        </Button>
      </div>
    </StepShell>
  );
}
