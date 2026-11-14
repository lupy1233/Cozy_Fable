import {
  configHasFronts,
  isFurnitureKind,
  pieceConfigTotals,
  type Piece3dKind,
  type PieceConfig3d,
} from '@marketplace/shared';

// Etapa 8 (d2, PO d2-3): deschiderea fronturilor se SCRIE in configuratia salvata cand piesa
// are fronturi ("Push" daca clientul n-a ales altceva), ca ce vede clientul ales sa ajunga la
// firma (si sa se puncteze); piesa fara fronturi nu mai trimite nicio deschidere. Intentia
// clientului (starea pasului 3D) pastreaza alegerea, ca sa revina cand fronturile revin.
// Piesele de mobilier (pat, masa, canapea, lavoar, hol) nu au deschiderea din 3D: neatinse.
export function withFrontStyleRule(
  kind: Piece3dKind,
  cleaned: PieceConfig3d,
  intent?: PieceConfig3d | null,
): PieceConfig3d {
  if (isFurnitureKind(kind)) return cleaned;
  if (configHasFronts(kind, cleaned)) {
    const style = cleaned.frontStyle ?? intent?.frontStyle ?? 'PUSH';
    return cleaned.frontStyle === style ? cleaned : { ...cleaned, frontStyle: style };
  }
  if (cleaned.frontStyle === undefined) return cleaned;
  const next = { ...cleaned };
  delete next.frontStyle;
  return next;
}

// Piesa are cel putin o usa (batanta sau glisanta)? "Batante" apare ales doar atunci (D4b).
export function configHasDoors(config: PieceConfig3d): boolean {
  return (
    pieceConfigTotals(config).doors > 0 ||
    config.columns.some((c) => c.zones.some((z) => z.type === 'DOOR'))
  );
}

// "Batante" apasat pe un dulap fara nicio usa: zonele deschise primesc usi batante, cu
// acelasi interior (ca la pornirea dulapului, PO d2-2); altfel butonul n-ar face nimic.
export function withHingedDoors(config: PieceConfig3d): PieceConfig3d {
  const next: PieceConfig3d = { ...config };
  delete next.doorMode;
  if (next.columns.some((c) => c.zones.some((z) => z.type === 'DOOR'))) return next;
  next.columns = next.columns.map((column) => ({
    ...column,
    zones: column.zones.map((zone) => (zone.type === 'OPEN' ? { ...zone, type: 'DOOR' as const } : zone)),
  }));
  return next;
}
