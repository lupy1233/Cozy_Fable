// b12: "Bloc, scara, apartament" — valoarea scrisa in requests.address_details.
// undefined = campul n-a venit (patch de ciorna: nu atingem coloana);
// text gol / doar spatii = NULL (clientul l-a golit); altfel textul fara spatii in plus.
export function addressDetailsValue(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  const value = (raw ?? '').replace(/\s+/g, ' ').trim();
  return value === '' ? null : value;
}
