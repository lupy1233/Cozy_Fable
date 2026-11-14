# Verificator V9D — partea de Admin rămasă neverificată la V9B + reverificarea republicării

Citește întâi `COMUN.md` din același folder. Folderul tău: `…\scratchpad\reparatii\verificare-8-12\v9d\`.
Raportul lui V9B (ce a făcut, ce a lăsat): `…\scratchpad\reparatii\verificare-8-12\v9b\raport.md` — citește-l întâi; scripturile lui din `…\v9b\` le poți copia și adapta (sesiunile salvate pot fi expirate — te autentifici din nou).

## Conturile tale (doar acestea)
- admin: `admin@demo.ro` (ești SINGURUL verificator care intră ca admin)
- firma C (suspendată, 12 puncte): `owner.c@demo.ro` — parola e acum parola demo locală (resetată de V9B)
- client: `radu.stanescu@demo.ro` — parola e acum parola demo locală; are cereri expirate
- un cont nou al tău: `verif.v9d.1@example.test`
- NU folosi: ana, mihai, elena, ioana, firmele A / B / D / H.

## De știut
- PC-ul e încărcat: paginile de admin s-au încărcat greu la V9B (pagina firmelor nu a arătat rândul firmei C în 240 s). Așteaptă răspunsul API-ului (`/api/v1/admin/…`) și măsoară cât durează (din rețea): dacă API-ul răspunde repede, dar pagina nu arată rândul, e defect de interfață; dacă API-ul e lent, notează timpul.
- `/ro/admin/jobs` arată doar joburile eșuate; nu are pornire de mână (știut — nu e de verificat din nou).

## Puncte (în ordine)
1. **Ridicarea suspendării** (`/ro/admin/companies`): starea se vede doar ca „Suspendată” (codul `SUSPENDED` doar în tooltip / `title`). „Ridică suspendarea” la firma „C CasaMea”: butonul din dialog e oprit sub 3 caractere; textul spune ce se întâmplă cu punctele. Scrie motivul: `Verificat de V9D; sunat la 0722 123 456, scris la test@example.test`. Așteptat: mesajul „12 puncte de penalizare au fost anulate.” (citește punctele active din bază înainte), firma devine aprobată; ca `owner.c`: 0 puncte de penalizare, cont funcțional (piața se deschide).
2. **Auditul ridicării** (`/ro/admin/audit` sau tabela de audit): intrarea are motivul mascat („… sunat la [nr], scris la [email]”), fără alt text liber.
3. **Admin → Mărime proiect**: cele 45 de rânduri noi ale formularului nou, cu nume omenești (nu chei), cu puncte doar la canapea („Da”). Dacă pagina are previzualizare de cost: balcon de 6 m cu un singur raft de 1 m ≈ 4 credite.
4. **Meniul Admin** are „Cereri”; pagina se deschide și listează cereri.
5. **Regulile publice** `/ro/firm-rules` și `/en/firm-rules`: cu valorile de acum — fără repetiții, pluralul corect. Apoi pune din Admin → Setări (sau pagina regulilor de penalizare) punctele pentru retragerea voluntară (VOLUNTARY_WITHDRAWAL, acum 2) la 0 → pagina publică nu mai spune „0 puncte” nicăieri (RO + EN). **Pune valoarea înapoi imediat (2)** și verifică revenirea.
6. **E-mailurile de parolă pe un cont nou**: înregistrează `verif.v9d.1@example.test`, confirmă e-mailul; schimbă parola din cont (parola nouă = tot una de test, pe care NU o scrii nicăieri) → e-mail „parola a fost schimbată” (ora României, reply-to). „Am uitat parola” → e-mailul cu legătura + e-mailul de confirmare după resetare. După resetare, pagina de login nu are e-mailul precompletat (decizie notată).
7. **Reverificare — republicarea cu modificări** (reparat după V9B), ca radu, pe o cerere EXPIRATĂ nefolosită: „Republică cu modificări” → schimbi ceva → „Republică cu modificările”: în secundele de „Se republică cererea…” antetul rămâne pe nota de republicare (NU „Aceasta este editarea 1 din 3… Salvarea de acum consumă una”). Fă capturi la 0,5 s interval în acel moment.
8. **Reverificare — „Republică” simplu** (reparat după V9B), pe altă cerere expirată: imediat după republicare, fără reîncărcare, caseta „Cine vede cererea” nu mai spune că cererea a expirat.
9. **Istoricul de credite al firmei C** (după ridicarea suspendării), `/ro/marketplace/wallet` → „Istoric credite”: notează soldul de la capătul istoricului și soldul portofelului (V9B a găsit o diferență pe firma B din cauza datelor locale vechi, fără rândul de sold inițial — spune dacă e la fel la C).

Scrieri directe permise: niciuna. Setarea de la punctul 5 se schimbă prin interfață și se pune înapoi.

## Adăugat după V9C
- Cont în plus pentru punctul 10: `ana.popescu@demo.ro` (client; acum liber). Doar pentru acest punct.
10. **Confirmarea primirii și recenzia** (rămase neverificate la V9C, fiindcă „Marchează ca livrată” e blocat 7 zile după acceptare): ana are deja o comandă livrată de firma A, cererea „[VERIF] Hol pentru oferte” (stare „livrată de firmă”). Ca ana: confirmă primirea → apoi lasă o recenzie (4–5 stele, un text scurt de test). În Mailpit și în baza locală (`notifications`): firma A e anunțată la confirmare și la recenzie — e-mail doar la responsabilul preluării + proprietar / manageri (`owner.a`, `mgr.a`), clopoțel la membrii firmei; ana nu primește nimic pentru propriile acțiuni; subiecte curate, ora României, legături spre `localhost:3000`. Nu te autentifica în conturile firmei A (urmărește-le doar ca destinatari).
