// Referinta scurta a comenzii (primele 8 caractere din id), afisata in lista, pe proforma si la transfer.
export function shortRef(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
