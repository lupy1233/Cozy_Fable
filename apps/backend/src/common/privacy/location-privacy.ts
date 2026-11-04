// E-client-9 (C7-2, docs/03 4.8): inainte de claim, distanta si acoperirea se calculeaza din
// punctul cererii APROXIMAT pe o grila fixa (~2 km), nu din punctul exact de geocodare.
// Asa o firma nu poate trilatera adresa clientului mutandu-si locatiile/raza.
//
// Formula e IDENTICA in SQL (marketplace.service queryRows) si in TS (claims.service
// assertCoverage): centrul celulei cu floor(), nu round() — regulile de rotunjire la egalitate
// difera intre JS si Postgres, floor() + 0.5 da acelasi rezultat IEEE in ambele.
// Se aproximeaza DOAR punctul cererii; locatiile firmei raman exacte (datele firmei).

// ~2,0 km pe latitudine; ~1,9–2,1 km pe longitudine in Romania (lat 43,6–48,3)
export const PRIVACY_GRID_LAT_DEG = 0.018;
export const PRIVACY_GRID_LNG_DEG = 0.026;

export function snapToPrivacyGrid(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: (Math.floor(lat / PRIVACY_GRID_LAT_DEG) + 0.5) * PRIVACY_GRID_LAT_DEG,
    lng: (Math.floor(lng / PRIVACY_GRID_LNG_DEG) + 0.5) * PRIVACY_GRID_LNG_DEG,
  };
}

// Distanta afisata firmelor: km intregi, minim 1 (nu "0 km" = "vecinul tau").
export function wholeKm(distanceKm: number): number {
  return Math.max(1, Math.round(distanceKm));
}
