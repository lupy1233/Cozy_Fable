# Verificator V9C — etapa 9: ce a rămas neverificat la V9A + reverificarea a două reparații

Citește întâi `COMUN.md` din același folder. Folderul tău: `…\scratchpad\reparatii\verificare-8-12\v9c\`.
Raportul lui V9A (ce a făcut deja, ce date a lăsat): `…\scratchpad\reparatii\verificare-8-12\v9a\raport.md` — citește-l întâi; scripturile lui din `…\v9a\` le poți copia și adapta.

## Conturile tale (doar acestea)
- client: `ana.popescu@demo.ro` (sesiunea ei veche e revocată — te autentifici din nou)
- firma A: `owner.a@demo.ro`, `mgr.a@demo.ro` (`trusted1.a` nu se poate autentifica local — urmărește-l doar ca destinatar, în bază / Mailpit)
- NU folosi: admin, alte firme, alți clienți.

## De știut
- Local, întârzierea planului e 0: firma A vede cererile imediat.
- V9A a lăsat cererea `77c29266-d0d2-4ad3-b0a1-78c8162683fd` („[VERIF V9A] Lemn & Stil "test"”) preluată de firma A (preluarea `90b0f421-e195-4602-885f-66b5c4cd7e22`, fără ofertă, needitată după preluare). Lucrează pe ea.
- Sesiuni: nu închide un script în timp ce pagina își reîmprospătează sesiunea; salvează `storageState` la SFÂRȘITUL fiecărui script și refolosește-l (altfel jetonul rotit se pierde și contul e dat afară).

## Puncte (în ordine)
1. **Reverificare — clopoțelul la preluare** (reparat după V9A): ana publică o cerere nouă scurtă; `owner.a` o preia. Așteptat: `owner.a` NU primește rând `claim.created` în clopoțel pentru propria preluare; ceilalți membri ai firmei și ana îl primesc; ana primește e-mailul „Cererea ta a fost preluată”.
2. **Reverificare — legătura de la clarificare** (reparat după V9A): firma pune o întrebare pe cererea nouă. E-mailul către ana spune „Răspunde din pagina „Oferte și conversații” a cererii” și butonul duce la `/ro/requests/<id>/offers`; clopoțelul anei duce tot acolo; pe pagina aceea se vede întrebarea și câmpul de răspuns.
3. **Editare după preluare** (cererea `77c29266-…`): ana → „Editează”: la salvare apare dialogul aplicației (nu `confirm()` al browserului) cu „Da, salvează” / „Nu acum”; „Nu acum” nu salvează nimic (verifică în bază); „Da, salvează” salvează o singură dată. Schimbă ceva vizibil (un material sau o dimensiune). Firma: clopoțel + e-mail „cererea a fost modificată” doar pentru preluările deschise (e-mail la responsabil + proprietar / manageri); pe pagina preluării apare „Ce s-a schimbat” cu ce ai schimbat (strada și contactele nu apar). A doua editare după preluare: ce spune aplicația (limita).
4. **Oferta**: `owner.a` scrie oferta pe preluare. „Data livrării” are trei selecții (Zi / Lună / An): 31 februarie → mesaj; apoi o dată validă. Trimite oferta. Ana: clopoțel + e-mail „ai primit o ofertă”, cu subiect curat.
5. **Acceptarea**: ana acceptă. Dialogul de acceptare arată data în română („26 noiembrie 2026”, nu `11/26/2026`). Firma: e-mail la responsabil + proprietar / manageri; cine acceptă nu primește nimic pentru propria acțiune. Cardul „Acordul vostru”: preț fără „RON” dublat, data românească.
6. **Finalizarea**: firma marchează livrarea → ana e anunțată; ana confirmă primirea → firma e anunțată.
7. **Recenzia**: ana lasă o recenzie → firma e anunțată (e-mail la responsabil + conducere).
8. Pentru toate e-mailurile de la 1–7: niciunul cu chei brute, `undefined`, oră UTC în loc de ora României, legături spre alt host decât `localhost:3000`, entități HTML în subiect.

Scrieri directe permise: niciuna (în afară de `published_at`, dacă ar fi nevoie — nu ar trebui).
