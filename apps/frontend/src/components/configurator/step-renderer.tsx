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
import { BOOLEAN_ILLUSTRATIONS, getIllustration } from './illustrations';
import { KitchenDimensionsDiagram } from './kitchen-dimensions-diagram';
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
        <div className="flex items-center gap-2">
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

export function StepRenderer(props: StepRendererProps) {
  const { step, answers, roomType, onChange, onInfo, error, inline, uploadContext } = props;
  const t = useTranslations('Configurator');
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

  if (step.type === 'single-choice') {
    const options = visibleOptions(step, answers);
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
    return (
      <StepShell step={step} onInfo={onInfo} error={error}>
        {/* schita parametrica: literele corespund campurilor de mai jos */}
        {roomType === 'KITCHEN' && step.id === 'dimensions' && (
          <KitchenDimensionsDiagram answers={answers} />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {slots.map((slot) => (
            <Field key={slot.id} label={t(slot.labelKey)}>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  step={slot.step ?? 0.1}
                  min={slot.min}
                  max={slot.max}
                  value={Number.isFinite(values[slot.id]) ? values[slot.id] : ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = { ...values };
                    if (raw === '') delete next[slot.id];
                    else next[slot.id] = Number(raw);
                    onChange(next);
                  }}
                  className="pr-8"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {slot.unit}
                </span>
              </div>
              {/* intervalul permis, vizibil inainte de a gresi */}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {slot.min}–{slot.max} {slot.unit}
              </p>
            </Field>
          ))}
        </div>
      </StepShell>
    );
  }

  if (step.type === 'number') {
    return (
      <StepShell step={step} onInfo={onInfo} error={error}>
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
      <StepShell step={step} onInfo={onInfo} error={error}>
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
