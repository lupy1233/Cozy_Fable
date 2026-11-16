# Verificator V9B — etapa 9 (portofel, republicare, joburi) + partea de Admin din etapele 10 și 12 + e-mailurile de parolă

Citește întâi `COMUN.md` din același folder. Folderul tău: `…\scratchpad\reparatii\verificare-8-12\v9b\`.

## Conturile tale (doar acestea)
- admin: `admin@demo.ro` (ești SINGURUL verificator care intră ca admin)
- firma B: `owner.b@demo.ro` (portofel)
- firma C (suspendată): `owner.c@demo.ro`
- client: `radu.stanescu@demo.ro` (are cereri expirate)
- conturi noi ale tale: `verif.v9b.<n>@example.test`
- NU folosi: ana, mihai, elena, ioana, firmele A / D / H, `mgr.b`.

## Surse
- CHANGELOG, secțiunile „etapa 9”, „etapa 10” (Admin → Mărime proiect), „etapa 12” (k2 ridicarea suspendării, regulile publice, e-mailul de parolă schimbată).
- Rapoarte: `…\etapa-09\rapoarte\e9-wallet.md`, `e9-drafts.md`, `e9-trace.md`; `…\etapa-10\rapoarte\e10-seed.md`; `…\etapa-12\rapoarte\e12-admin.md`, `e12-misc.md`, `e12-clean.md` — secțiunile „De verificat de mână”.

## Puncte (în ordine)
1. **Portofel — istoric** (owner.b, `/ro/marketplace/wallet`): fila „Istoric credite” cu rânduri, paginată; soldul de la capătul istoricului = soldul afișat al portofelului; totalurile ofertelor pe monede (lei / EUR separat, fără curs).
2. **Portofel — anularea plății**: pornește o cumpărare de credite prin transfer bancar; pe comanda în așteptare apare „Anulează plata” → dialog; „Nu, păstrez plata” nu schimbă nimic; confirmarea anulează (o singură cerere, comanda apare anulată). A doua comandă: apasă „Am plătit” → anularea nu mai e oferită / e refuzată cu mesaj omenesc.
3. **Republicare cu modificări** (radu, o cerere EXPIRATĂ): banda cu „Republică” și „Republică cu modificări”, cu textul nou; „cu modificări” deschide formularul precompletat; schimbă ceva (un material sau o dimensiune) → „Republică cu modificările” → cererea e din nou în piață, cu datele noi; a doua încercare pe aceeași cerere → mesajul că republicarea a fost deja folosită. Pe ALTĂ cerere expirată: „Republică” simplu merge.
4. **`/ro/admin/jobs`**: cozile `draft-cleanup` și `new-requests` apar în listă, cu nume omenești. Curățarea ciornelor: creează ca vizitator două ciorne (deschide `/ro/requests/new`, alege o cameră, lasă-le); pe UNA dintre ele mută `created_at` / `updated_at` cu 8 zile în urmă (scriere directă permisă, doar pe ciorna ta — notează id-ul). Numără ciornele înainte (`status='DRAFT'`), pornește jobul de mână, numără după: ciorna veche a dispărut, cea recentă și ciornele altora (sub prag) au rămas, cererile publicate neatinse. Pragurile din setări: 7 zile vizitator / 90 de zile client.
5. **Rezumatul zilnic „cereri noi”** pornit de mână din `/ro/admin/jobs`: ce e-mailuri apar în Mailpit (către cine, ce cereri); a doua rulare imediat după → nu mai trimite nimic.
6. **`/ro/admin/companies`**: starea se vede doar ca „Suspendată” (codul `SUSPENDED` doar în tooltip / `title`). „Ridică suspendarea” la firma C: butonul din dialog e oprit sub 3 caractere; textul spune ce se întâmplă cu punctele. Scrie motivul: `Verificat de V9B; sunat la 0722 123 456, scris la test@example.test`. Așteptat: mesajul „N puncte de penalizare au fost anulate.” (N = punctele active ale firmei C dinainte — citește-le din bază înainte), firma devine aprobată; în audit (`/ro/admin/audit` sau tabela de audit) motivul apare mascat (`[nr]`, `[email]`); ca `owner.c`: 0 puncte de penalizare, cont funcțional.
7. **Admin → Mărime proiect**: cele 45 de rânduri noi ale formularului v7, cu nume omenești (nu chei), cu „Da” (puncte) doar la canapea. Previzualizarea costului (dacă pagina o are): balcon de 6 m cu un singur raft de 1 m ≈ 4 credite, mai ieftin decât balconul mobilat.
8. **Meniul Admin** are „Cereri”; pagina se deschide.
9. **Regulile publice** `/ro/firm-rules` și `/en/firm-rules`: cu valorile implicite — fără repetiții, pluralul corect. Apoi pune din Admin → Setări punctele pentru retragerea voluntară (VOLUNTARY_WITHDRAWAL) la 0 → pagina publică nu mai spune „0 puncte” nicăieri (RO + EN). **Pune valoarea înapoi imediat** (notează valoarea veche înainte) și verifică revenirea.
10. **E-mailurile de parolă**: înregistrează `verif.v9b.1@example.test`, confirmă e-mailul; „Am uitat parola” → setează o parolă nouă (tot parola demo din `.env` e acceptabilă dacă aplicația o permite; altfel una de test pe care NU o scrii în raport) → în Mailpit: e-mailul cu legătura + e-mailul „parola a fost schimbată” (ora României, reply-to). Schimbarea parolei din cont → încă un e-mail de confirmare. După resetare, pagina de login NU are e-mailul precompletat (decizie notată).
11. **Tabelul de audit** al ridicării suspendării: nu conține alt text liber în afara motivului mascat.

Scrieri directe permise: datele ciornei tale de la punctul 4. Schimbările din Admin (setarea de la punctul 9) se fac prin interfață și se pun înapoi.
