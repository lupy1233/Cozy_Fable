# Sarcina `e9-trace` — problema 47 (`e3`): urmele clarificării și ale editării după preluare

Citește secțiunea „## 47.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-09.md` și contractul etapei, mai ales „Adaos — Evenimente noi” (numele și câmpurile evenimentelor tale sunt fixate acolo; e-mailul și clopoțelul lor le scrie `e9-notif`, nu tu).

## Ce ai de făcut — server
1. `clarifications.service.ts`: la întrebarea firmei emite `clarification.asked` (țintă: clientul); la răspunsul clientului emite `clarification.answered` (ținte: toți membrii firmei). Prin outbox, în aceeași tranzacție cu salvarea (modelul: `request.company_withdrew` din `withdrawals.service.ts`).
2. `requests.service.ts` (fișierul e al lui `e9-drafts`: doar Edit punctual, recitind înainte): la editarea după preluare emite `request.edited_after_claim`, câte un eveniment pentru fiecare preluare ACTIVĂ (nu pentru cele retrase / anulate / expirate).
3. Endpoint pentru client care întoarce TOATE clarificările cererii lui (și cele cu răspuns), sau lărgește-l pe cel existent — alege schimbarea mai mică.
4. „Ce s-a schimbat”: funcție pură care compară ultimele două copii salvate ale cererii (`request_versions`) și întoarce o listă scurtă: câmpurile generale schimbate (buget, termen, mesaj, adresă la nivel de localitate…) și camerele adăugate / scoase / modificate. Expusă firmei pe fișa preluării (endpoint nou sau câmp nou în răspunsul existent al fișei).

## Ce ai de făcut — interfață
5. `client-clarifications.tsx`: clientul vede și istoricul „Întrebare / Răspunsul tău” (cu firma și data), nu doar întrebările în așteptare.
6. Fișa firmei (`marketplace/claims/[claimSlotId]/page.tsx`): caseta „Cererea a fost modificată pe … — ce s-a schimbat”, componentă nouă, afișată doar dacă există o editare după preluare.
7. Salvarea editării după preluare cere confirmare într-un dialog din aplicație (nu `window.confirm`), cu textul despre efectul asupra firmelor care au preluat. Dialogul = fișier NOU al tău; montarea = un singur Edit punctual în locul salvării (vezi contractul, „Formularul în mod editare”).
8. Texte RO / EN în fragmentul `e9-trace` (doar interfața ta; nu e-mailuri, nu clopoțel).

## Reguli stricte
- Confidențialitate: „ce s-a schimbat” arată firmei doar ce are voie să vadă pe fișa preluării (aceeași mascare ca fișa: fără date de contact dacă firma nu are dreptul la ele). Compari doar câmpurile pe care fișa le arată deja.
- Diferențe false: dacă cele două copii sunt pe versiuni de flux diferite sau formatul nu se poate compara sigur la o cameră, arată „Camera X a fost modificată”, fără detalii inventate.
- Nu schimbi regulile de editare (câte editări, când e voie), termenele sau pauza de clarificare. Eticheta „Expiră” a fost rezolvată în altă etapă.
- Migrarea rezervată (`20261114180000_clarification_edit_traces`) doar dacă chiar ai nevoie; scrisă de mână, NEaplicată.

## Teste
- Backend: întrebarea și răspunsul scriu câte un eveniment cu țintele și câmpurile corecte; editarea după preluare anunță doar firmele cu preluare activă.
- Unit: „ce s-a schimbat” pe două copii cu material diferit, cu o cameră adăugată, una scoasă, buget schimbat; copii identice → listă goală.
- Frontend: istoricul clientului (în așteptare + cu răspuns), caseta firmei, dialogul de confirmare (anulare = nu se salvează).

## Fișierele tale
`apps/backend/src/modules/claims/clarifications.service.ts` (+ controller / spec), fișierul nou cu comparația de copii (în `modules/requests/` sau `modules/claims/`), `apps/frontend/src/app/[locale]/_components/client-clarifications.tsx`, `apps/frontend/src/app/[locale]/marketplace/claims/[claimSlotId]/page.tsx` + componenta nouă, dialogul nou; Edit punctual în `requests.service.ts` și în locul salvării editării.
