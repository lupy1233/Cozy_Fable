# Verificator V9A — etapa 9: notificări și e-mailuri pe un ciclu complet, clarificări, editare după preluare

Citește întâi `COMUN.md` din același folder. Folderul tău: `…\scratchpad\reparatii\verificare-8-12\v9a\`.

## Conturile tale (doar acestea)
- client: `ana.popescu@demo.ro`
- firma A (GOLD, vede cererile noi după 30 min): `owner.a@demo.ro` (proprietar), `mgr.a@demo.ro` (manager), `trusted1.a@demo.ro` (angajat de încredere)
- NU folosi: admin, firmele B / C / D / H, ceilalți clienți.

## Surse
- CHANGELOG, secțiunea „etapa 9” (rândurile despre notificări, clarificări, „Ce s-a schimbat”).
- Rapoarte: `…\etapa-09\rapoarte\e9-notif.md`, `e9-trace.md` — secțiunile „De verificat de mână”.

## Puncte (în ordine)
1. **Publicarea** — ana publică o cerere nouă scurtă (de exemplu Hol, în București, adresă tastată). Formularul nu are câmp de titlu: pune titlul în corpul `POST …/publish` prin rutare Playwright: `[VERIF V9A] Lemn & Stil "test"`. Așteptat în Mailpit: e-mailul de publicare către ana — subiect cu textul curat (`&` și ghilimelele ca atare, fără `&amp;` / `&quot;`), corpul corect (escapat), legătura spre cerere, data în ora României, limba RO. Verifică și clopoțelul anei (dacă există eveniment pentru ea).
2. **Cerere nouă în zonă** — firma A trebuie să afle de cererea nouă: după întârzierea planului (mută `published_at` cu 31 de minute în urmă în baza locală — permis) clopoțelul lui owner.a primește „cerere nouă în zonă” în ~1–2 minute, o singură dată (nu se repetă la scanările următoare — așteaptă încă 2–3 minute și numără). Notează dacă pleacă și e-mail pe loc sau doar în rezumatul zilnic (ce spune CHANGELOG-ul).
3. **Preluarea** — owner.a preia cererea. Ce primește ana (clopoțel / e-mail), cu textul. Cine a făcut acțiunea NU primește nimic pentru ea.
4. **Mesaje** — firma scrie un mesaj → ana primește e-mail + clopoțel; ana răspunde → e-mailul ajunge doar la responsabilul preluării + proprietar / manageri (owner.a, mgr.a), NU la `trusted1.a` dacă nu e responsabil; cel care scrie nu primește propriul mesaj. Verifică destinatarii în Mailpit (`to:`).
5. **Clarificări** — (dacă fluxul cere întrebarea înainte de preluare, folosește a doua cerere a anei aflată în piață) firma pune o întrebare de clarificare → ana e anunțată (clopoțel + e-mail), răspunde → firma e anunțată; la ana, pe pagina cererii, apare istoricul „Întrebări la care ai răspuns”.
6. **Editare după preluare** — ana editează cererea preluată: apare dialogul aplicației (nu `confirm()` al browserului) cu „Da, salvează” / „Nu acum”; „Nu acum” nu salvează nimic; „Da, salvează” salvează o singură dată. Firma primește anunțul de editare (clopoțel / e-mail — doar preluările deschise), iar pe pagina preluării vede „Ce s-a schimbat” (materialul / camera schimbată; strada și contactele nu apar în diferențe). A doua editare după preluare: ce spune aplicația (limita).
7. **Oferta, acceptarea, finalizarea, recenzia** — firma trimite o ofertă („Data livrării” are trei selecții Zi / Lună / An: încearcă 31 februarie → mesaj; apoi o dată validă); ana acceptă (dialogul de acceptare arată data în română, „26 noiembrie 2026”, nu `11/26/2026`); firma marchează livrarea, ana confirmă primirea; ana lasă o recenzie. La fiecare pas: ce e-mail / clopoțel pleacă, către cine, cu subiect curat; „Acordul vostru” fără „RON” dublat și cu data românească.
8. Pe tot parcursul: niciun e-mail cu chei brute (`Notifications.…`), cu `undefined`, cu oră UTC în loc de ora României sau cu legături spre alt host decât `localhost:3000`.

Scrieri directe permise: doar `published_at` pe cererile tale `[VERIF V9A]`.
