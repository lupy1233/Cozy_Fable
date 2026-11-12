'use client';

import { useId, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { PenaltyRuleDto } from '@marketplace/shared';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAdminPlans } from '@/hooks/use-admin';
import { planDisplayName } from '@/lib/plan-label';
import { cn } from '@/lib/utils';
import { settingDef } from './setting-catalog';
import { FIELD, boolValue, normalizeSetting, textValue, useSettingText, useSettingsDraft } from './settings-drafts';

// Sectiunea unei teme: titlu, explicatie scurta, apoi randurile.
export function SettingsSection({
  id,
  title,
  description,
  flush,
  children,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** corpul nu e o lista de randuri (formular, unelte): primeste spatiere proprie */
  flush?: boolean;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <Card as="section" id={id} padding="none" aria-labelledby={titleId} className="scroll-mt-24">
      <div className="border-b border-border px-6 py-[18px]">
        <h2 id={titleId} className="heading-section">
          {title}
        </h2>
        {description && <p className="mt-1 text-ui text-muted-foreground">{description}</p>}
      </div>
      <div className={flush ? 'flex flex-col gap-4 px-6 py-5' : 'px-6 pb-3 pt-1'}>{children}</div>
    </Card>
  );
}

// Caseta de valoare: camp + unitate. Chenar de chihlimbar = modificat si nesalvat; carmin = invalid.
export function ValueBox({
  id,
  value,
  onChange,
  unit,
  changed,
  invalid,
  disabled,
  describedBy,
  placeholder,
  maxLength,
  ariaLabel,
  inputMode = 'numeric',
  variant = 'number',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  changed?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
  placeholder?: string;
  maxLength?: number;
  ariaLabel?: string;
  inputMode?: 'numeric' | 'decimal' | 'text' | 'email';
  /** number = ingust, aliniat la dreapta, mono; text = lat; fill = cat tot randul (in grila) */
  variant?: 'number' | 'text' | 'fill' | 'fillNumber';
}) {
  const numeric = variant === 'number' || variant === 'fillNumber';
  return (
    <div
      className={cn(
        'flex h-11 items-center rounded-md border bg-surface transition-colors',
        'focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/5',
        invalid
          ? 'border-2 border-crimson bg-crimson-soft/30'
          : changed
            ? 'border-2 border-amber bg-amber-soft/40'
            : 'border-border-2',
        variant === 'text' && 'w-full sm:w-72',
        disabled && 'opacity-60',
      )}
    >
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 min-w-0 bg-transparent px-2.5 text-sm text-foreground outline-none placeholder:text-muted-2 disabled:cursor-not-allowed',
          numeric && 'text-right font-mono',
          variant === 'number' ? 'w-[84px]' : 'flex-1',
        )}
      />
      {unit && <span className="shrink-0 pr-3 text-ui text-muted-foreground">{unit}</span>}
    </div>
  );
}

// Valoarea salvata, taiata, langa cea noua.
export function OldValue({ children }: { children: ReactNode }) {
  const t = useTranslations('Admin.settings');
  return (
    <span className="max-w-[16rem] truncate font-mono text-xs text-muted-foreground">
      <span className="sr-only">{t('savedValue')} </span>
      <span className="line-through">{children}</span>
    </span>
  );
}

// Comutatorul din design (52x30, nuc cand e pornit) peste componenta Switch existenta.
export function BigSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'h-[30px] w-[52px] [&>span]:top-[3px] [&>span]:h-6 [&>span]:w-6',
        checked ? 'bg-walnut [&>span]:left-[25px]' : '[&>span]:left-[3px]',
      )}
    />
  );
}

const ROW = 'flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 border-b border-background py-4 last:border-b-0';
const SELECT_CHANGED = 'border-2 border-amber bg-amber-soft/40';

interface ChoiceOption {
  value: string;
  label: string;
}

function ChoiceSelect({
  id,
  value,
  options,
  changed,
  disabled,
  describedBy,
  onChange,
}: {
  id: string;
  value: string;
  options: ChoiceOption[];
  changed: boolean;
  disabled: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="w-full sm:w-72">
      <Select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-11', changed && SELECT_CHANGED)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

// Optiunile unei setari cu lista inchisa; valoarea salvata ramane in lista chiar daca nu mai e permisa.
function withSaved(options: ChoiceOption[], server: string, shown: string): ChoiceOption[] {
  return options.some((o) => o.value === server) ? options : [{ value: server, label: shown }, ...options];
}

// „Planul din perioada de proba”: se alege dintre planurile active (serverul accepta doar codul
// unui plan activ). Fara lista planurilor, codul se scrie de mana, ca pana acum.
function PlanCodeControl({
  id,
  value,
  server,
  changed,
  invalid,
  disabled,
  describedBy,
  onChange,
}: {
  id: string;
  value: string;
  server: string;
  changed: boolean;
  invalid: boolean;
  disabled: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  const plans = useAdminPlans();
  const locale = useLocale();
  const text = useSettingText();
  if (!plans.data) {
    return (
      <ValueBox
        id={id}
        value={value}
        onChange={onChange}
        changed={changed}
        invalid={invalid}
        disabled={disabled}
        describedBy={describedBy}
        inputMode="text"
        variant="text"
      />
    );
  }
  const active = plans.data
    .filter((p) => p.isActive)
    .map((p) => {
      const name = planDisplayName(p, locale);
      return { value: p.code, label: name === p.code ? p.code : `${name} (${p.code})` };
    });
  // valoarea salvata si cea de lucru (scrisa de mana inainte sa se incarce lista) raman printre optiuni
  const options = withSaved(withSaved(active, server, text.shown(server)), value, text.shown(value));
  return (
    <ChoiceSelect
      id={id}
      value={value}
      options={options}
      changed={changed}
      disabled={disabled}
      describedBy={describedBy}
      onChange={onChange}
    />
  );
}

// Randul unei setari de sistem: nume omenesc, explicatie, codul tehnic mic si controlul potrivit.
export function SettingRow({ settingKey, server }: { settingKey: string; server: string }) {
  const { drafts, setField, problems, failures, busy } = useSettingsDraft();
  const text = useSettingText();
  const def = settingDef(settingKey);
  const spec = def?.spec;
  const controlId = useId();
  const noteId = useId();

  const field = FIELD.setting(settingKey);
  const raw = textValue(drafts, field, server);
  const changed = normalizeSetting(def, raw) !== server;
  const invalid = !!problems[field];
  const note = problems[field] ?? failures[field];
  const describedBy = note ? noteId : undefined;
  const label = text.label(settingKey);
  const help = text.help(settingKey);
  const set = (value: string) => setField(field, value, server);

  let old: string = text.shown(server);
  let control: ReactNode;

  if (spec?.kind === 'int' || spec?.kind === 'decimal') {
    control = (
      <ValueBox
        id={controlId}
        value={raw}
        onChange={set}
        unit={text.unit(spec.unit)}
        changed={changed}
        invalid={invalid}
        disabled={busy}
        describedBy={describedBy}
        inputMode={spec.kind === 'decimal' ? 'decimal' : 'numeric'}
      />
    );
  } else if (spec?.kind === 'bool') {
    old = text.onOff(server === 'true');
    control = (
      <BigSwitch checked={raw === 'true'} onChange={(v) => set(v ? 'true' : 'false')} label={label} disabled={busy} />
    );
  } else if (spec?.kind === 'enum') {
    const options = withSaved(
      spec.options.map((o) => ({ value: o, label: text.option(settingKey, o) })),
      server,
      text.shown(server),
    );
    old = options.find((o) => o.value === server)?.label ?? old;
    control = (
      <ChoiceSelect
        id={controlId}
        value={raw}
        options={options}
        changed={changed}
        disabled={busy}
        describedBy={describedBy}
        onChange={set}
      />
    );
  } else if (spec?.kind === 'plan') {
    control = (
      <PlanCodeControl
        id={controlId}
        value={raw}
        server={server}
        changed={changed}
        invalid={invalid}
        disabled={busy}
        describedBy={describedBy}
        onChange={set}
      />
    );
  } else {
    control = (
      <ValueBox
        id={controlId}
        value={raw}
        onChange={set}
        changed={changed}
        invalid={invalid}
        disabled={busy}
        describedBy={describedBy}
        inputMode={spec?.kind === 'email' ? 'email' : 'text'}
        variant="text"
      />
    );
  }
  const kind = spec?.kind ?? 'text';

  return (
    <div className={ROW}>
      <div className="min-w-0 flex-[1_1_320px]">
        {kind === 'bool' ? (
          <div className="font-semibold">{label}</div>
        ) : (
          <label htmlFor={controlId} className={cn('font-semibold', !text.hasLabel(settingKey) && 'font-mono text-ui font-medium')}>
            {label}
          </label>
        )}
        {help && <p className="text-ui text-muted-foreground">{help}</p>}
        {text.hasLabel(settingKey) && <div className="font-mono text-meta text-muted-foreground">{settingKey}</div>}
        {note && (
          <p id={noteId} role="alert" className="mt-1 text-xs text-crimson">
            {note}
          </p>
        )}
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2.5">
        {changed && <OldValue>{old}</OldValue>}
        {control}
      </div>
    </div>
  );
}

// Randul unei reguli de penalizare: punctele + daca regula e activa.
export function PenaltyRuleRow({ rule }: { rule: PenaltyRuleDto }) {
  const t = useTranslations('Admin.settings');
  const tp = useTranslations('Penalties');
  const { drafts, setField, problems, failures, busy } = useSettingsDraft();
  const text = useSettingText();
  const controlId = useId();
  const noteId = useId();

  const pointsField = FIELD.rule(rule.id, 'points');
  const activeField = FIELD.rule(rule.id, 'isActive');
  const points = textValue(drafts, pointsField, String(rule.points));
  const active = boolValue(drafts, activeField, rule.isActive);
  const pointsChanged = points.trim() !== String(rule.points);
  const activeChanged = active !== rule.isActive;
  const note = problems[pointsField] ?? failures[`rule.${rule.id}`];
  const known = tp.has(`rule.${rule.ruleKey}`);
  const label = known ? tp(`rule.${rule.ruleKey}`) : rule.ruleKey;

  return (
    <div className={ROW}>
      <div className="min-w-0 flex-[1_1_320px]">
        <label htmlFor={controlId} className={cn('font-semibold', !known && 'font-mono text-ui font-medium')}>
          {label}
        </label>
        {t.has(`rules.${rule.ruleKey}`) && <p className="text-ui text-muted-foreground">{t(`rules.${rule.ruleKey}`)}</p>}
        {known && <div className="font-mono text-meta text-muted-foreground">{rule.ruleKey}</div>}
        {note && (
          <p id={noteId} role="alert" className="mt-1 text-xs text-crimson">
            {note}
          </p>
        )}
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="flex items-center gap-2.5">
          {pointsChanged && <OldValue>{rule.points}</OldValue>}
          <ValueBox
            id={controlId}
            value={points}
            onChange={(v) => setField(pointsField, v, String(rule.points))}
            unit={text.unit('points')}
            changed={pointsChanged}
            invalid={!!problems[pointsField]}
            disabled={busy}
            describedBy={note ? noteId : undefined}
          />
        </div>
        <div className="flex items-center gap-2.5">
          <BigSwitch
            checked={active}
            onChange={(v) => setField(activeField, v, rule.isActive)}
            label={`${t('ruleActive')}: ${label}`}
            disabled={busy}
          />
          <span className={cn('text-ui', activeChanged ? 'font-medium text-amber' : 'text-muted-foreground')}>
            {active ? t('ruleActive') : t('ruleInactive')}
          </span>
        </div>
      </div>
    </div>
  );
}
