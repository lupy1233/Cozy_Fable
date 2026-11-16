# Sarcina `e9-notif` — problema 45 (`g1`): evenimente fără e-mail sau notificare

Citește secțiunea „## 45.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-09.md` (răspunsurile PO g1-1 și g1-2 sunt finale) și contractul etapei, mai ales „Adaos — Evenimente noi”. Ești proprietarul modulului de notificări: scrii e-mailul și clopoțelul pentru TOATE cele cinci evenimente noi, inclusiv cele trei emise de `e9-trace`.

## Ce ai de făcut
1. **Cel care a făcut acțiunea nu primește** (clopoțel + e-mail): `actorUserId` în payload la mesaj (`chat.service.ts`), acceptare (`quotes.service.ts`), finalizare (`fulfillment.service.ts`) și la evenimentele noi; scos din destinatari într-un singur loc.
2. **Cine din firmă primește e-mail** (g1-1) pentru evenimentele unei preluări — mesaj nou de la client, ofertă acceptată, cerere de modificare a ofertei, refuzul ofertei, `clarification.answered`, `request.edited_after_claim`, finalizare, recenzie: responsabilul preluării (membrul atribuit pe `claim_slots`; vezi cum e ținut azi) + proprietarul și managerii. Ceilalți membri rămân doar cu clopoțelul. Un singur ajutător, testat. Dacă preluarea nu are responsabil: proprietarul + managerii.
3. **`request.published`** → e-mail către client: „Cererea ta e publicată”, cu legătura spre cerere și data expirării (formatată în limba omului, ora României). Fără clopoțel (clientul a făcut chiar el acțiunea). Emis prin outbox în `requests.service.ts`, la publicare și la republicare (fișierul e al lui `e9-drafts`: doar Edit punctual, recitind înainte).
4. **`request.new_in_area`** (g1-2): clopoțel pentru membrii firmelor din zonă, trimis abia când cererea le devine vizibilă după planul lor (întârzierea 0 / 30 / 60 de minute — găsește regula existentă de vizibilitate din marketplace și refolosește-o; nu o rescrie) și doar firmelor care chiar ar vedea cererea (rază, stare activă, abonament — aceleași filtre ca lista din marketplace). Plus **rezumatul zilnic pe e-mail**: un job BullMQ repetat (skill `bullmq-worker`; ora României, ca joburile existente) care trimite fiecărei firme un singur e-mail cu cererile noi din zona ei din ultimele 24 h (către proprietar + manageri; nimic dacă nu sunt cereri; respectă dezabonarea existentă). O firmă nu primește de două ori aceeași cerere.
5. **Finalizarea și recenzia** către firmă primesc și e-mail (după regula de la 2). Legăturile din e-mailuri duc la conversația / fișa exactă (`/marketplace/claims/<claimSlotId>`, `/requests/<id>`…), nu la pagina generală de mesaje.
6. E-mail + clopoțel pentru `clarification.asked` (către client: „Firma X are o întrebare la cererea ta”, legătură spre cerere) și `clarification.answered`, `request.edited_after_claim` (către firmă, legătură spre fișa preluării).
7. Texte RO / EN: e-mailurile sunt în `notification-emails.service.ts` (stilul existent, totul prin `esc()`); titlurile din clopoțel prin fragmentul i18n `e9-notif`.

## Reguli stricte
- Confidențialitate: anunțul „cerere nouă în zonă” și rezumatul NU conțin date de contact, adresă exactă sau numele clientului — doar ce vede firma în lista din marketplace înainte de preluare.
- Nicio rafală: dacă un pas ar trimite e-mail pentru fiecare cerere nouă, e greșit (PO a ales rezumat zilnic).
- Eșecul unui e-mail nu reia jobul de notificări (regula existentă din fișier).
- Migrarea rezervată (`20261114190000_notification_events`) o folosești doar dacă ai nevoie de stare în baza de date (de ex. „până unde a mers rezumatul”); scrisă de mână, NEaplicată.
- Fișierele `chat.service.ts`, `fulfillment.service.ts`, `quotes.service.ts`: doar adaugi `actorUserId` / câmpurile de legătură la evenimentele existente; nu schimbi regulile de produs din ele.

## Teste
- Calculul destinatarilor: cine scrie / acceptă nu primește; la firmă e-mail doar responsabilul + proprietar / manageri; fără responsabil → proprietar + manageri.
- `request.new_in_area`: nu pleacă înainte de întârzierea planului; nu ajunge la firme în afara razei; rezumatul nu repetă cereri și nu pleacă gol.
- E-mailul de publicare: conținut + legătură + data.
- Testele vechi din `notification-emails.service.spec.ts` aduse la zi.

## Fișierele tale
`apps/backend/src/modules/notifications/**`, jobul nou de rezumat (în modulul de notificări), `apps/frontend/src/app/[locale]/_components/notification-bell.tsx`, `apps/frontend/src/hooks/use-socket.ts`; Edit punctual în `chat.service.ts`, `fulfillment.service.ts`, `quotes.service.ts`, `requests.service.ts`, `reviews` (dacă recenzia are nevoie de câmpuri în payload).
