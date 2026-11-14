# Sarcina `e11-team` — problema 52 (`h1`), pașii 1 și 2: permisiuni și echipă

Citește secțiunea „## 52.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-11.md` și contractul etapei. Citește și `docs/03-business-rules.md` §4.13 (permisiunile pe câmpurile ofertei) — hotărârea h1-2 o schimbă; documentele le aduce la zi coordonatorul, tu scrii în raport textul nou propus.

## Permisiuni (pasul 1)
1. Proprietarul firmei are MEREU toate drepturile pe câmpurile ofertei, indiferent de rândurile din `company_offer_field_permissions` (verificarea din `quotes.service.ts`, în jurul regulii „fără rând de permisiune = refuz”).
2. Firma fără NICIUN rând de permisiuni: se aplică matricea implicită — exact aceeași pe care o primește o firmă la înscriere (găsește-o în `companies.service.ts` și scoate-o într-o singură sursă, folosită și la înscriere, și ca rezervă, și în datele demo). O firmă care ARE rânduri rămâne pe rândurile ei (un rând lipsă pentru un rol ≠ proprietar înseamnă în continuare „nu are voie”).
3. Interfața (`offer-permissions-section.tsx`): coloana proprietarului e bifată peste tot și needitabilă, cu o explicație scurtă. Serverul ignoră / refuză încercarea de a schimba drepturile proprietarului.
4. Datele demo (`seed-demo.ts`): permisiunile se creează pentru TOATE firmele demo, nu doar pentru cele aprobate la încărcare.

## Echipă (pasul 2, h1-1)
5. Când e-mailul introdus nu are cont de tip Firmă: mesaj clar pe câmp — „Persoana nu are încă un cont de firmă. Roag-o să se înregistreze ca Firmă cu acest e-mail, apoi adaug-o aici.” (cod de eroare existent sau unul nou, cu text RO + EN). Nu dezvălui mai mult decât azi despre conturile altora (dacă azi răspunsul e același pentru „nu există” și „e client”, păstrează asta).
6. Formularul de adăugare explică pașii înainte de orice eroare (două rânduri de text ajutător).
7. Colegul adăugat primește clopoțel + e-mail: evenimentul `company.member_added` (vezi contractul), prin outbox; e-mailul în `notification-emails.service.ts`, în stilul existent (`esc()` pe tot ce e interpolat).

## Teste
- Backend: firmă fără rânduri de permisiuni poate trimite oferta ca proprietar; angajatul cu rol limitat tot nu poate schimba prețul (cu matricea implicită ȘI cu rânduri proprii); proprietarul trece chiar dacă rândurile lui sunt debifate; încercarea de a debifa proprietarul nu are efect.
- Backend: adăugarea unui coleg scrie evenimentul cu ținta corectă; e-mail inexistent / cont de client → mesajul nou.
- Frontend: coloana proprietarului needitabilă; mesajul de pe câmp la echipă.
- Testele vechi care fixau „fără rând = refuz și la proprietar” se aduc la zi.

## Fișierele tale
Rândul `e11-team` din contract. Texte: fragmentul `e11-team`.
