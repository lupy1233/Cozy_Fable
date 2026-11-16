# Sarcina `e11-place` — problema 52 (`h1`), pașii 3 și 4: locații și portofoliu

Citește secțiunea „## 52.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-11.md` și contractul etapei (mai ales „Securitate”). Skill-uri: `ui-component`, `nestjs-module`.

## Locații (pasul 3)
1. Buton „Modifică” pe fiecare locație, care folosește modificarea EXISTENTĂ de pe server (`companies.controller.ts`, ruta de update a locației): adresa și raza (selector cu valorile permise — ia limitele din regulile existente: raza minimă, plafonul de schimbări; nu le schimba).
2. Adresa (la adăugare și la modificare) folosește componenta de sugestii Google din formularul de cerere (`address-autocomplete.tsx` — refolosește-o, nu o copia) și completează singură coordonatele; câmpurile de latitudine / longitudine scrise de mână dispar din interfață. Fără cheie Google (local), componenta are deja o cale de rezervă: verifică cum se comportă și păstreaz-o.
3. Mesajele serverului (rază sub minim, plafon de schimbări atins) apar pe câmp, în limba omului.

## Portofoliu (pasul 4)
4. Încărcare de poză din calculator prin legături presemnate, după modelul fișierelor cererii (`uploads.service.ts`: presign → PUT → confirm, cu verificarea tipului și a conținutului și cu `image-sanitizer`). O singură poză pe lucrare. Doar imagini (JPEG / PNG / WebP — aceleași tipuri de imagine acceptate la cerere), cu aceeași limită de mărime.
5. Lucrarea ține minte cheia din storage, nu o adresă publică scrisă de om; lucrările vechi cu adresă de imagine rămân valabile și se afișează ca azi. Dacă schema nu are unde ține cheia fără coloană nouă, folosește migrarea rezervată din contract (doar adăugare) și spune în raport.
6. Mesajul serverului (fișier respins, prea mare) pe câmp — refolosește mesajele pentru fișiere respinse de la formularul de cerere. Imagine de rezervă când poza nu se încarcă (în lista firmei și pe pagina publică a firmei, dacă portofoliul apare acolo).
7. Ștergerea / înlocuirea unei lucrări șterge și fișierul ei din storage (fără fișiere orfane).

## Teste
- Backend: modificarea locației respectă raza minimă și plafonul de schimbări; alt membru / altă firmă → refuz.
- Backend: încărcarea refuză fișierele care nu sunt imagini (după conținut, nu după extensie), fișierele prea mari și încercarea de a confirma o cheie din afara spațiului firmei.
- Frontend: „Modifică” precompletat; alegerea unei sugestii completează coordonatele; încărcarea cu succes / respinsă; imaginea de rezervă.

## Fișierele tale
Rândul `e11-place` din contract (+ pagina publică a firmei doar pentru imaginea de rezervă, Edit punctual). Texte: fragmentul `e11-place`.
