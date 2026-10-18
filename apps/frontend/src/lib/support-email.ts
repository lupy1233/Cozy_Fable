// Adresa de suport publica (coapta la build). Trebuie sa fie aceeasi cu SUPPORT_EMAIL din
// backend; gol = nicio linie de contact si niciun security.txt publicat.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || '';
