import { useSyncExternalStore } from 'react';
import { isDimensionUnit, type DimensionUnit } from './dimension-format';

// Unitatea aleasa de client, tinuta separat de store (D1, etapa 8): store-ul
// configuratorului se goleste la publicare, dar pagina cererii clientului trebuie
// sa arate dimensiunile in unitatea aleasa in formular. Doar in acest browser;
// pe alt dispozitiv clientul vede cm. Firma nu foloseste preferinta (mereu cm).

export const DIMENSION_UNIT_STORAGE_KEY = 'cozy.dimensionUnit';
const DEFAULT_UNIT: DimensionUnit = 'cm';

const listeners = new Set<() => void>();

export function readDimensionUnit(): DimensionUnit {
  if (typeof window === 'undefined') return DEFAULT_UNIT;
  try {
    const stored = window.localStorage.getItem(DIMENSION_UNIT_STORAGE_KEY);
    return isDimensionUnit(stored) ? stored : DEFAULT_UNIT;
  } catch {
    return DEFAULT_UNIT;
  }
}

// apelat de comutatorul m / cm / mm din formular, langa setDimensionUnit din store
export function rememberDimensionUnit(unit: DimensionUnit): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, unit);
  } catch {
    // stocare blocata (mod privat): preferinta nu se pastreaza, afisarea ramane in cm
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // alt tab al aceluiasi browser a schimbat unitatea
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DIMENSION_UNIT_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const serverSnapshot = (): DimensionUnit => DEFAULT_UNIT;

// pe server si la hidratare: 'cm'; apoi valoarea din localStorage
export function useDimensionUnitPreference(): DimensionUnit {
  return useSyncExternalStore(subscribe, readDimensionUnit, serverSnapshot);
}
