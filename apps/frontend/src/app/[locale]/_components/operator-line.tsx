'use client';

import { useTranslations } from 'next-intl';
import { isPublishedOperator, useLegalOperator } from '@/hooks/use-legal';

// E-admin-platform-2: identitatea operatorului in footer. Fara date publicate → nimic
// (niciodata valorile demo/goale).
export function OperatorLine() {
  const tl = useTranslations('Legal');
  const { data } = useLegalOperator();
  if (!isPublishedOperator(data)) return null;

  return (
    <p className="label">
      {tl('footer.identity', {
        name: data.name,
        cui: data.cui,
        regCom: data.regCom,
        address: data.address,
      })}
      {' · '}
      {tl.rich('footer.contact', {
        email: data.contactEmail,
        mail: (chunks) => (
          <a href={`mailto:${data.contactEmail}`} className="normal-case underline transition-colors hover:text-foreground">
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}
