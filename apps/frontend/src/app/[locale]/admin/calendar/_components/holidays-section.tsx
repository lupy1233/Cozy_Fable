'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { CalendarHolidayDto } from '@marketplace/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { toast } from '@/components/ui/toaster';
import { useCreateHoliday, useDeleteHoliday, useUpdateHoliday } from '@/hooks/use-admin';
import { useCalendarError, useCalendarFormat } from './calendar-utils';

// Sarbatorile mobile si puntile anului ales: tabel (tip schimbat pe loc, stergere cu confirmare)
// si formularul de adaugare. Sarbatorile fixe vin automat si nu apar aici.
export function HolidaysSection({ holidays, today }: { holidays: CalendarHolidayDto[]; today: string }) {
  const t = useTranslations('Admin.calendar');
  return (
    <section aria-labelledby="calendar-overrides-title" className="flex flex-col gap-3">
      <h2 id="calendar-overrides-title" className="heading-section">
        {t('overridesTitle')}
      </h2>
      <Card padding="none" className="overflow-hidden">
        {holidays.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <Table className="min-w-[560px]">
            <THead>
              <TR>
                <TH scope="col" className="bg-surface-2">
                  {t('date')}
                </TH>
                <TH scope="col" className="bg-surface-2">
                  {t('name')}
                </TH>
                <TH scope="col" className="bg-surface-2">
                  {t('type')}
                </TH>
                <TH scope="col" className="bg-surface-2">
                  <span className="sr-only">{t('actions')}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {holidays.map((h) => (
                <HolidayRow key={h.id} h={h} />
              ))}
            </TBody>
          </Table>
        )}
        <AddHolidayForm today={today} />
      </Card>
    </section>
  );
}

function HolidayRow({ h }: { h: CalendarHolidayDto }) {
  const t = useTranslations('Admin.calendar');
  const fmt = useCalendarFormat();
  const errorMessage = useCalendarError();
  const update = useUpdateHoliday();
  const remove = useDeleteHoliday();
  const [confirm, setConfirm] = useState(false);

  return (
    <TR>
      <TD className="whitespace-nowrap align-middle font-mono text-xs">{fmt.full(h.date)}</TD>
      <TD className="align-middle font-medium">{h.name}</TD>
      <TD className="align-middle">
        <div className="w-52">
          <Select
            aria-label={t('typeFor', { name: h.name })}
            value={h.isWorkingDay ? 'working' : 'holiday'}
            disabled={update.isPending}
            onChange={(e) =>
              update.mutate(
                { id: h.id, isWorkingDay: e.target.value === 'working' },
                { onSuccess: () => toast.success(t('saved')), onError: (err) => toast.error(errorMessage(err)) },
              )
            }
          >
            <option value="holiday">{t('typeHoliday')}</option>
            <option value="working">{t('typeWorking')}</option>
          </Select>
        </div>
      </TD>
      <TD className="text-right align-middle">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="px-2.5 text-crimson hover:bg-crimson-soft hover:text-crimson"
          onClick={() => setConfirm(true)}
          disabled={remove.isPending}
        >
          {t('removeAction')}
        </Button>
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent className="text-left">
            <DialogHeader>
              <DialogTitle>{t('remove')}</DialogTitle>
              <DialogDescription>{t('confirmRemove', { date: fmt.full(h.date), name: h.name })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(h.id, {
                    onSuccess: () => {
                      setConfirm(false);
                      toast.success(t('removed'));
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  })
                }
              >
                {t('remove')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TD>
    </TR>
  );
}

function AddHolidayForm({ today }: { today: string }) {
  const t = useTranslations('Admin.calendar');
  const errorMessage = useCalendarError();
  const create = useCreateHoliday();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'holiday' | 'working'>('holiday');
  const maxDate = `${Number(today.slice(0, 4)) + 5}-12-31`;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && name.trim().length >= 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    create.mutate(
      { date, name: name.trim(), isWorkingDay: type === 'working' },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          setDate('');
          setName('');
          setType('holiday');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t border-border bg-surface-2 p-4">
      <Field label={t('date')}>
        <Input
          type="date"
          required
          min={today}
          max={maxDate}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 w-auto"
        />
      </Field>
      <Field label={t('name')} className="min-w-0 flex-[1_1_200px]">
        <Input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
      </Field>
      <Field label={t('type')} className="w-52">
        <Select value={type} onChange={(e) => setType(e.target.value as 'holiday' | 'working')} className="h-11">
          <option value="holiday">{t('typeHoliday')}</option>
          <option value="working">{t('typeWorking')}</option>
        </Select>
      </Field>
      <Button type="submit" variant="outline" size="lg" className="h-11 border-foreground" disabled={!valid || create.isPending}>
        {t('add')}
      </Button>
    </form>
  );
}
