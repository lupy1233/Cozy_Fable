'use client';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

// Telefon cu prefix de tara (F5, item 20): clientul alege prefixul si scrie
// numarul national; valoarea stocata e una singura, in format international
// (+40722123456), validata de schema partajata (RO sau E.164).

const PHONE_CODES = [
  { code: '+40', country: 'RO' },
  { code: '+373', country: 'MD' },
  { code: '+36', country: 'HU' },
  { code: '+359', country: 'BG' },
  { code: '+49', country: 'DE' },
  { code: '+43', country: 'AT' },
  { code: '+33', country: 'FR' },
  { code: '+39', country: 'IT' },
  { code: '+34', country: 'ES' },
  { code: '+32', country: 'BE' },
  { code: '+31', country: 'NL' },
  { code: '+41', country: 'CH' },
  { code: '+44', country: 'GB' },
  { code: '+353', country: 'IE' },
  { code: '+48', country: 'PL' },
  { code: '+420', country: 'CZ' },
  { code: '+421', country: 'SK' },
  { code: '+30', country: 'GR' },
  { code: '+351', country: 'PT' },
  { code: '+46', country: 'SE' },
  { code: '+45', country: 'DK' },
  { code: '+47', country: 'NO' },
  { code: '+358', country: 'FI' },
] as const;

// desparte valoarea stocata in prefix + numar national (prefixul cel mai lung primeaza)
function split(value: string): { code: string; national: string } {
  const match = [...PHONE_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => value.startsWith(c.code));
  if (match) return { code: match.code, national: value.slice(match.code.length) };
  // numere RO vechi in format national (0722...) → prefix implicit +40
  if (value.startsWith('0')) return { code: '+40', national: value.slice(1) };
  return { code: '+40', national: value.replace(/^\+/, '') };
}

export function PhoneInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { code, national } = split(value);

  const emit = (nextCode: string, nextNational: string) => {
    // doar cifre in numarul national; zeroul initial cade (e inclus in prefix)
    const digits = nextNational.replace(/\D/g, '').replace(/^0+/, '');
    onChange(digits ? `${nextCode}${digits}` : '');
  };

  return (
    <div className="flex gap-2">
      <div className="w-28 shrink-0">
        <Select value={code} onChange={(e) => emit(e.target.value, national)} aria-label="country code">
          {PHONE_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.country} {c.code}
            </option>
          ))}
        </Select>
      </div>
      <Input
        type="tel"
        inputMode="tel"
        placeholder="722 123 456"
        value={national}
        onChange={(e) => emit(code, e.target.value)}
      />
    </div>
  );
}
