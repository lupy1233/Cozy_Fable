// b12: o singura functie care compune adresa unei cereri pentru afisare (Sumar, pagina
// cererii, firma). Scoate dublurile — orasul deja scris in adresa, judetul egal cu orasul
// ("Bucuresti, Bucuresti") — iar tara apare doar cand nu e Romania.
// Ce primeste aici e deja filtrat dupa drepturi: pentru o firma fara acces la contacte
// addressText / addressDetails vin goale de pe server, deci raman doar orasul si judetul.

export interface DisplayAddressInput {
  addressText?: string | null;
  // "Bloc, scara, apartament" (optional)
  addressDetails?: string | null;
  city?: string | null;
  county?: string | null;
  // ISO2; lipsa = RO
  country?: string | null;
}

export interface DisplayAddressOptions {
  // numele tarii in limba interfetei (ex. Intl.DisplayNames); lipsa → codul ISO2
  countryName?: (iso2: string) => string | undefined;
}

const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

// comparatie fara diacritice / majuscule / punctuatie; prefixele administrative nu conteaza
// ("Județul Ilfov" = "Ilfov", "Municipiul București" = "București")
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(judetul|jud|municipiul|municipiu|orasul|oras|comuna)\s+/, '');
}

// un segment (intre virgule) fara numere: codul postal ("077190 Voluntari") nu conteaza
const segmentKey = (value: string) => normalize(value.replace(/\b\d+\b/g, ' '));

// segmentele strazii comparate intregi (cu numere, ca "ap. 14" ≠ "ap. 4")
function alreadyInStreet(street: string, details: string): boolean {
  const streetSegments = new Set(street.split(',').map(normalize).filter(Boolean));
  const detailSegments = details.split(',').map(normalize).filter(Boolean);
  return detailSegments.length > 0 && detailSegments.every((segment) => streetSegments.has(segment));
}

export function formatDisplayAddress(input: DisplayAddressInput, options: DisplayAddressOptions = {}): string {
  const parts: string[] = [];
  // segmentele deja afisate; orasul / judetul / tara se sar doar cand sunt un segment intreg,
  // nu cand apar in numele strazii ("Strada Cluj 3, Cluj" → orasul ramane)
  const seen = new Set<string>();
  const add = (value: string) => {
    parts.push(value);
    for (const segment of value.split(',')) {
      const key = segmentKey(segment);
      if (key) seen.add(key);
    }
  };
  const isNew = (value: string) => {
    const key = segmentKey(value);
    return key !== '' && !seen.has(key);
  };

  const street = clean(input.addressText);
  if (street) add(street);
  // cererile vechi au uneori blocul scris in strada: nu il repetam, dar DOAR cand fiecare
  // bucata lui (intre virgule) e un segment intreg al strazii — "4" nu dispare in "Str. X 14"
  const details = clean(input.addressDetails);
  if (details && !alreadyInStreet(street, details)) add(details);
  const city = clean(input.city);
  if (city && isNew(city)) add(city);
  const county = clean(input.county);
  if (county && isNew(county)) add(county);
  const iso = clean(input.country).toUpperCase();
  if (iso && iso !== 'RO') {
    const name = clean(options.countryName?.(iso)) || iso;
    if (isNew(name)) add(name);
  }
  return parts.join(', ');
}
