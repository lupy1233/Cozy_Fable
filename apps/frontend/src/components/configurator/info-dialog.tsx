'use client';

import type { InfoContentRef } from '@marketplace/shared';
import { motion } from 'framer-motion';
import { Check, Minus, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Panou Info pentru un card de raspuns: descriere + avantaje + dezavantaje + pret mediu.
// Cheile din InfoContentRef sunt relative la namespace-ul 'Configurator'.
export function InfoDialog({
  info,
  open,
  onOpenChange,
}: {
  info: InfoContentRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Configurator');
  const ct = useTranslations();

  if (!info) return null;

  const has = (key: string) => ct.has(`Configurator.${key}`);
  const pros = (info.prosKeys ?? []).filter(has);
  const cons = (info.consKeys ?? []).filter(has);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <DialogHeader>
            <DialogTitle>{has(info.titleKey) ? t(info.titleKey) : ''}</DialogTitle>
          </DialogHeader>

          {has(info.bodyKey) && (
            <p className="text-sm leading-relaxed text-muted-foreground">{t(info.bodyKey)}</p>
          )}

          {pros.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sage">
                {t('info.pros')}
              </h4>
              <ul className="flex flex-col gap-1">
                {pros.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                    <span>{t(k)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cons.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-crimson">
                {t('info.cons')}
              </h4>
              <ul className="flex flex-col gap-1">
                {cons.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
                    <span>{t(k)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {info.priceHintKey && has(info.priceHintKey) && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border-2 bg-surface-2 px-3 py-2 text-sm">
              <Wallet className="h-4 w-4 text-walnut" />
              <span className="text-muted-foreground">{t('info.avgPrice')}:</span>
              <span className="font-medium">{t(info.priceHintKey)}</span>
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
