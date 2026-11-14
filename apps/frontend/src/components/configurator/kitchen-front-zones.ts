import type { AnswerMap, QuestionStep, RoomType } from '@marketplace/shared';

// c14 pasul 1 (plan reparatii 2026-11-13, etapa 6): ecranul "Fronturi" al bucatariei v3 / v4
// (pana la 9 intrebari) se arata pe zone — Corpuri de baza / Corpuri suspendate / Insula.
// DOAR asezare vizuala: fluxul, id-urile, ordinea pasilor in ecran, validarea si numarul
// de ecrane din ciorna raman neschimbate. In fiecare zona pasii pastreaza ordinea din flux.

export type KitchenFrontZone = 'base' | 'wall' | 'island';

export interface ScreenSection {
  // undefined = partea comuna (fara titlu de zona)
  zone?: KitchenFrontZone;
  steps: QuestionStep[];
}

const ZONE_OF: Record<string, KitchenFrontZone> = {
  frontMaterialBase: 'base',
  frontMaterialBaseOther: 'base',
  separateFrontMaterials: 'base',
  openingSystemsBase: 'base',
  frontMaterialWall: 'wall',
  frontMaterialWallOther: 'wall',
  openingSystemsWall: 'wall',
  frontMaterialIsland: 'island',
  frontMaterialIslandOther: 'island',
  openingSystemsIsland: 'island',
};

const ZONES: KitchenFrontZone[] = ['base', 'wall', 'island'];

// materialul de baza + bifa "materiale diferite pe zone"
const SHARED_WHEN_SAME = new Set(['frontMaterialBase', 'frontMaterialBaseOther', 'separateFrontMaterials']);

// m3 (revizuire etapa 6): doar ecranul unic "Fronturi" al bucatariei v3 / v4 — singurul care
// are bifa "materiale diferite pe zone" (mereu vizibila acolo). Ecranul separat de deschidere
// al bucatariei v2 (versiune veche) ramane fara titlu de zona, ca inainte.
export function isKitchenFrontsScreen(roomType: RoomType, screen: QuestionStep[]): boolean {
  return (
    roomType === 'KITCHEN' &&
    screen.some((s) => s.id === 'openingSystemsBase') &&
    screen.some((s) => s.id === 'separateFrontMaterials') &&
    screen.every((s) => s.id in ZONE_OF)
  );
}

// Fara "materiale diferite": materialul (comun tuturor zonelor) si bifa stau sus, fara
// titlu, iar zonele contin doar deschiderea. Cu "materiale diferite": materialul de baza
// si bifa intra in zona "Corpuri de baza" (aceeasi pozitie pe ecran, doar cu titlu).
export function screenSections(roomType: RoomType, screen: QuestionStep[], answers: AnswerMap): ScreenSection[] {
  if (!isKitchenFrontsScreen(roomType, screen)) return [{ steps: screen }];
  const separate = answers.separateFrontMaterials === true;
  const sections: ScreenSection[] = [];
  if (!separate) {
    const shared = screen.filter((s) => SHARED_WHEN_SAME.has(s.id));
    if (shared.length > 0) sections.push({ steps: shared });
  }
  for (const zone of ZONES) {
    const steps = screen.filter(
      (s) => ZONE_OF[s.id] === zone && (separate || !SHARED_WHEN_SAME.has(s.id)),
    );
    if (steps.length > 0) sections.push({ zone, steps });
  }
  return sections;
}
