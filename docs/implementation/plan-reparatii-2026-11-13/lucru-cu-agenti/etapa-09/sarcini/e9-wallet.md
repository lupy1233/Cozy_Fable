# Sarcina `e9-wallet` — problema 46 (`h3`): portofelul

Citește secțiunea „## 46.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-09.md` și contractul etapei. Skill-uri: `nestjs-module`, `ui-component`, `ro-invoice` (pentru comenzi).

## Ce ai de făcut
1. **Istoric**: endpoint nou pentru firmă cu mișcările de credite din registrul existent (`credit_transactions`), paginate, cele mai noi primele: data, ce s-a întâmplat (preluare, decontare, restituire, cumpărare, bonus de probă… — tradus din tipul / motivul existent; ce nu se poate traduce apare ca „Altă mișcare”), cererea legată (titlu + legătură spre fișa preluării, dacă există), suma cu semn și soldul după mișcare. Doar mișcările firmei proprii; rolurile care văd azi soldul.
2. Fila / secțiunea „Istoric” în pagina portofelului (`marketplace/wallet`), cu „Vezi mai multe”. Date și numere formatate după limba aplicației, ora României.
3. **Datele demo** (`apps/backend/prisma/seed.ts`, Edit punctual): scriu și mișcarea pentru soldul inițial, ca suma istoricului să ajungă la sold. Dacă portofelele existente pe producție au sold fără mișcare inițială, NU scrie migrare de date: descrie în raport ce ar trebui (decide PO).
4. **„Anulează comanda”** pentru proprietar / manager, cât comanda e în așteptare și nemarcată „Am plătit”, cu dialog de confirmare în aplicație; refolosește anularea existentă (cea folosită de admin / anularea automată), cu aceleași efecte. Altă stare → cod de eroare existent sau unul nou (cu text RO + EN).
5. Lângă suma comenzii în așteptare: până când e valabilă (din setarea de anulare automată, doar dacă e pornită).
6. **Panoul firmei**: valoarea ofertelor pe monede, „X lei + Y EUR”, fără conversie (`companies.service.ts` + componenta de pe panou care o afișează).
7. Texte RO / EN în fragmentul `e9-wallet`.

## Reguli stricte
- Nu schimbi cum se rezervă, se consumă sau se restituie creditele și nu scrii în registru din endpointul de istoric (doar citire).
- Anularea de către firmă nu are voie să anuleze o comandă deja plătită sau marcată „Am plătit” (verifică sub aceeași blocare ca anularea existentă; două apeluri simultane nu dublează nimic).
- Migrarea rezervată (`20261114160000_wallet_history_order_cancel`) doar dacă chiar ai nevoie (de ex. un index pentru istoric sau cine a anulat); scrisă de mână, NEaplicată.

## Teste
- Backend: istoricul arată doar mișcările firmei proprii; soldul calculat la capăt egalează soldul portofelului pe datele demo (scrie-l ca test de integrare `*.integration.spec.ts`, pe care NU îl rulezi, plus un test unit pe transformare).
- Backend: firma poate anula doar comanda proprie, în așteptare și nemarcată „Am plătit”; alt rol / altă firmă → refuz.
- Unit: totalurile pe monede.
- Frontend: fila de istoric (gol, cu rânduri, „Vezi mai multe”), dialogul de anulare.

## Fișierele tale
`apps/backend/src/modules/billing/**`, `apps/backend/src/modules/companies/companies.service.ts` (+ spec), `apps/frontend/src/app/[locale]/marketplace/wallet/**`, componenta de panou cu valoarea ofertelor, hook-urile de portofel; Edit punctual în `seed.ts`.
