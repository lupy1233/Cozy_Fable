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
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ConfiguratorIcon } from '@/lib/configurator-icons';
import type { AttachmentTarget } from '@/hooks/use-requests';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { BOOLEAN_ILLUSTRATIONS, getIllustration } from './illustrations';
import { KitchenDimensionsDiagram } from './kitchen-dimensions-diagram';
import { WallRunsDiagram } from './wall-runs-diagram';
import { PlayingCard } from './playing-card';
import { RoomSketchUpload } from './room-sketch-upload';

interface StepRendererProps {
  step: QuestionStep;
  answers: AnswerMap;
  roomType: RoomType;
  onChange: (value: AnswerValue) => void;
  onInfo: (info: InfoContentRef) => void;
  error?: string;
  // step secundar pe acelasi ecran (screenGroup): titlu mai mic, UI compact
  inline?: boolean;
  // context pentru step-urile 'upload' (schita per camera)
  uploadContext?: { target: AttachmentTarget; hasOwnProject: boolean };
}

// Antet pas: titlu + subtitlu + buton Info la nivel de intrebare (optional).
function StepShell({
  step,
  onInfo,
  error,
  inline,
  children,
}: {
  step: QuestionStep;
  onInfo: (info: InfoContentRef) => void;
  error?: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('Configurator');
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          {/* vizualul piesei la care se refera intrebarea (feedback PO F4) */}
          {step.icon && !inline && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-walnut-soft text-walnut [&_svg]:h-6 [&_svg]:w-6">
              <ConfiguratorIcon name={step.icon} />
            </span>
          )}
          {inline ? (
            <h3 className="font-serif text-lg tracking-[-0.01em]">{t(step.titleKey)}</h3>
          ) : (
            <h2 className="font-serif text-[26px] leading-[1.15] tracking-[-0.02em] sm:text-3xl">
              {t(step.titleKey)}
            </h2>
          )}
          {step.info && (
            <button
              type="button"
              onClick={() => onInfo(step.info!)}
              aria-label="info"
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-walnut-soft hover:text-walnut"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
        {step.subtitleKey && (
          <p className="mt-1 text-sm text-muted-foreground">{t(step.subtitleKey)}</p>
        )}
      </div>
      {children}
      {error && <p className="text-sm text-crimson">{t(error)}</p>}
    </div>
  );
}

// factorii de conversie pentru afisarea dimensiunilor (stocarea ramane in metri)
const UNIT_FACTOR = { m: 1, cm: 100, mm: 1000 } as const;

// cate laturi (A/B/C) coteaza schita generica, in functie de layout
const DRESSING_RUN_COUNT: Record<string, number> = {
  LINEAR: 1,
  L_SHAPE: 2,
  U_SHAPE: 3,
  WALK_IN: 2,
};
const PANTRY_RUN_COUNT: Record<string, number> = {
  ONE_WALL: 1,
  L_SHAPE: 2,
  U_SHAPE: 3,
};

const cnUnit = (active: boolean) =>
  'rounded-full px-2 py-0.5 uppercase tracking-[0.06em] transition-colors ' +
  (active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground');

export function StepRenderer(props: StepRendererProps) {
  const { step, answers, roomType, onChange, onInfo, error, inline, uploadContext } = props;
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

  // Rand compact de pill-uri pentru step-urile choice inline (screenGroup):
  // folosit de ecranele "material per piesa" din flow-urile v2 si de intrebarile
  // secundare ale pieselor ghidate. Pastreaza butonul Info per optiune.
  const optionPill = (opt: ChoiceOption, selected: boolean, onSelect: () => void) => {
    const recommended = opt.recommendedIf ? evalCondition(opt.recommendedIf, answers) : false;
    return (
      <div
        key={opt.value}
        className={
          'inline-flex items-center overflow-hidden rounded-full border text-sm transition-colors ' +
          (selected
            ? 'border-walnut bg-walnut-soft text-walnut shadow-[0_0_0_2px_hsl(var(--walnut)/0.12)]'
            : 'border-border-2 bg-surface hover:border-muted-2')
        }
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex items-center gap-1.5 py-1.5 pl-3 font-medium last:pr-3 [&:not(:last-child)]:pr-2"
        >
          {opt.icon && (
            <span className="text-current [&_svg]:h-4 [&_svg]:w-4">
              <ConfiguratorIcon name={opt.icon} />
            </span>
          )}
          {t(opt.labelKey)}
          {recommended && (
            <span className="rounded-full bg-sage/15 px-1.5 py-0.5 text-[10px] font-semibold text-sage">
              {t('info.recommended')}
            </span>
          )}
        </button>
        {opt.info && (
          <button
            type="button"
            onClick={() => onInfo(opt.info!)}
            aria-label={`info ${t(opt.labelKey)}`}
            className="self-stretch border-l border-border-2/60 px-2 text-muted-foreground transition-colors hover:text-walnut"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  // Conventie: ecranele din screenGroup 'materials' (material per piesa, v2)
  // se randeaza compact si pentru PRIMUL step — randurile sunt echivalente,
  // nu exista o intrebare "principala" cu carduri mari.
  const compactChoice = inline || step.screenGroup === 'materials';

  if (step.type === 'single-choice') {
    const options = visibleOptions(step, answers);
    if (compactChoice) {
      return (
        <StepShell step={step} onInfo={onInfo} error={error} inline={inline}>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => optionPill(opt, value === opt.value, () => onChange(opt.value)))}
          </div>
        </StepShell>
      );
    }
    return (
      <StepShell step={step} onInfo={onInfo} error={error}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <StepShell step={step} onInfo={onInfo} error={error} inline>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => optionPill(opt, selected.includes(opt.value), () => toggle(opt.value)))}
          </div>
        </StepShell>
      );
    }
    return (
      <StepShell step={step} onInfo={onInfo} error={error}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((opt) => optionCard(opt, selected.includes(opt.value), true, () => toggle(opt.value)))}
        </div>
      </StepShell>
    );
  }

  if (step.type === 'boolean') {
    // inline (add-on pe acelasi ecran, ex. insula): un singur card-comutator
    if (inline) {
      const Illu = getIllustration(roomType, step.id, 'YES');
      const on = value === true;
      return (
        <StepShell step={step} onInfo={onInfo} error={error} inline>
          <button
            type="button"
            onClick={() => onChange(!on)}
            aria-pressed={on}
            className={
              'flex w-full items-center gap-4 rounded-xl border p-3.5 text-left shadow-sm transition-colors ' +
              (on
                ? 'border-walnut bg-walnut-soft shadow-[0_0_0_3px_hsl(var(--walnut)/0.14)]'
                : 'border-border-2 bg-surface hover:border-muted-2')
            }
          >
            {Illu && (
              <span className={'h-14 w-20 shrink-0 ' + (on ? 'text-walnut' : 'text-muted-foreground')}>
                <Illu className="h-full w-full" />
              </span>
            )}
            <span className="flex-1 text-sm font-medium">
              {t(on ? 'common.boolean.yes' : 'common.boolean.no')}
            </span>
            <span
              className={
                'relative h-6 w-11 shrink-0 rounded-full transition-colors ' +
                (on ? 'bg-walnut' : 'bg-border-2')
              }
            >
              <span
                className={
                  'absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all ' +
                  (on ? 'left-[22px]' : 'left-0.5')
                }
              />
            </span>
          </button>
        </StepShell>
      );
    }
    const YesIllu = BOOLEAN_ILLUSTRATIONS.yes;
    const NoIllu = BOOLEAN_ILLUSTRATIONS.no;
    return (
      <StepShell step={step} onInfo={onInfo} error={error}>
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
    return (
      <StepShell step={step} onInfo={onInfo} error={error}>
        {/* schita parametrica: literele corespund campurilor de mai jos */}
        {roomType === 'KITCHEN' && step.id === 'dimensions' && (
          <KitchenDimensionsDiagram answers={answers} />
        )}
        {roomType === 'DRESSING' && step.id === 'dimensions' && (
          <WallRunsDiagram
            answers={answers}
            runs={DRESSING_RUN_COUNT[String(answers.layout)] ?? 1}
            heightSlotId="wardrobeHeight"
          />
        )}
        {roomType === 'PANTRY' && step.id === 'dimensions' && (
          <WallRunsDiagram
            answers={answers}
            runs={PANTRY_RUN_COUNT[String(answers.wallsUsed)] ?? 1}
            heightSlotId="ceilingHeight"
          />
        )}
        {/* comutator unitate de masura — valorile raman in metri in answers */}
        <div className="flex justify-end">
          <div className="inline-flex items-center rounded-full border border-border-2 bg-surface-2 p-0.5 font-mono text-[11px]">
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
            return (
              <Field key={slot.id} label={t(slot.labelKey)}>
                <div className="relative">
                  <Input
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
                  <p className="mt-1 text-[11px] text-crimson">
                    {t('validation.dimensionRange', { range: rangeText })}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground">{rangeText}</p>
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
      <StepShell step={step} onInfo={onInfo} error={error} inline={inline}>
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
      <StepShell step={step} onInfo={onInfo} error={error} inline={inline}>
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
      </StepShell>
    );
  }

  if (step.type === 'upload') {
    const ids = Array.isArray(value) ? (value as string[]) : [];
    return (
      <StepShell step={step} onInfo={onInfo} error={error} inline={inline}>
        {uploadContext ? (
          <RoomSketchUpload
            target={uploadContext.target}
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
    <StepShell step={step} onInfo={onInfo} error={error}>
      <div className="flex flex-col gap-3">
        {pieces.map((piece, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border-2 bg-surface-2 p-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label={t('pieces.name')} className="col-span-2">
                <Input value={piece.name} onChange={(e) => setPiece(i, { name: e.target.value })} />
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
