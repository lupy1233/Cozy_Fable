import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';

// E-client-1: selectia versiunii de oferta, comuna cardului de oferta, dialogului de
// acceptare si cardului "Acordul vostru".

// Ultima versiune trimisa (singura care se poate accepta).
export function latestVersion(quote: Pick<QuoteDto, 'versions'>): QuoteVersionDto | undefined {
  if (quote.versions.length === 0) return undefined;
  return quote.versions.reduce((a, b) => (b.version > a.version ? b : a), quote.versions[0]);
}

// Versiunea de afisat: cea acceptata de client daca exista, altfel ultima
// (ofertele acceptate inainte de migrare au acceptedVersionId = null).
export function displayedVersion(
  quote: Pick<QuoteDto, 'versions' | 'acceptedVersionId'>,
): QuoteVersionDto | undefined {
  const accepted = quote.acceptedVersionId
    ? quote.versions.find((v) => v.id === quote.acceptedVersionId)
    : undefined;
  return accepted ?? latestVersion(quote);
}
