// d5 (revizie m3 / m4): "Continua" din fila "Ciorne" deschide formularul pe ciorna aleasa.
// Intrebarea despre ciorna din acest browser s-a pus deja in lista (o singura intrebare), deci
// formularul sare peste dialogul "Continui sau incepi din nou?" o data, la sosire.
const CONTINUE_FLAG_KEY = 'mm_draft_continue';

export function markDraftContinue(): void {
  try {
    sessionStorage.setItem(CONTINUE_FLAG_KEY, '1');
  } catch {
    // storage indisponibil: formularul pune intrebarea obisnuita
  }
}

// Citeste si sterge semnul (o singura folosire).
export function takeDraftContinue(): boolean {
  try {
    const set = sessionStorage.getItem(CONTINUE_FLAG_KEY) === '1';
    sessionStorage.removeItem(CONTINUE_FLAG_KEY);
    return set;
  } catch {
    return false;
  }
}
