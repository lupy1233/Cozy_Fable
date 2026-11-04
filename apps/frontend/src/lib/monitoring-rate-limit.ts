// Limita de rata a tunelului /monitoring (per proces). Separata de route.ts: un fisier de ruta
// Next poate exporta DOAR handlerele si optiunile de ruta, altfel `next build` pica la tipuri
// (E-admin-platform-56, a blocat build-ul imaginii).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

let windowStart = 0;
let windowCount = 0;

export function allowMonitoringRequest(now: number): boolean {
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount <= MAX_PER_WINDOW;
}

// doar pentru teste
export function resetMonitoringRateLimit(): void {
  windowStart = 0;
  windowCount = 0;
}
