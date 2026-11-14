# Raport V9A — etapa 9: notificări și e-mailuri pe un ciclu complet

## 1. Antet
- Data: 2026-11-14 (începere ~17:20 ora României).
- Stiva: locală, pornită de coordonator (interfața `localhost:3000`, API `localhost:3001/api/v1`, Mailpit `localhost:8025`), ramura `claude/reparatii-etapa-12` (`b4deefb`).
- Browser: headless Edge (`channel: 'msedge'`) cu `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist --enable-webgl`; scripturile sunt în acest folder.
- Conturi folosite: `ana.popescu@demo.ro` (client), `owner.a@demo.ro` (proprietar firma A), `mgr.a@demo.ro` (manager A — logat, sesiune salvată). `trusted1.a@demo.ro` NU se poate loga cu parola demo locală (401) — l-am urmărit doar prin baza de date și Mailpit (ca destinatar), ceea ce e suficient pentru punctele mele.
- Date de test create: cererea `77c29266-d0d2-4ad3-b0a1-78c8162683fd` „[VERIF V9A] Lemn & Stil "test"” (Hol, București, Strada Verificarii 9), preluarea firmei A `90b0f421-e195-4602-885f-66b5c4cd7e22` (responsabil owner.a), firul de chat `35a21067-…`, clarificarea `df6d0a3d-…`.
- De știut: planul GOLD al firmei A are local `marketplace_gating_delay_minutes = 0` (nu 30, cum spunea COMUN.md; CHANGELOG etapa 9, „La lansare” pct. 8, confirmă: întârzierea e 0 la toate planurile).

## 2. Puncte

| # | Punct | Verdict | Ce am văzut | Captură |
|---|---|---|---|---|
| 1 | Publicarea: e-mailul „Cererea ta e publicată” | TRECUT | Cererea publicată prin formular (Hol, București, adresă tastată), titlul pus prin rutare → `201`. În Mailpit, la 14 s: către ana, subiect `Cererea ta e publicată — [VERIF V9A] Lemn & Stil "test"` (în antet `=26` / `=22`, nu `&amp;`). Corpul HTML escapat corect (`Lemn &amp; Stil &quot;test&quot;`), textul curat; legătura `http://localhost:3000/ro/requests/77c29266-…`; „Rămâne disponibilă până pe 20 nov. 2026, 23:59” = `expires_at` 21:59:59Z, adică ora României; limba RO. Clopoțelul anei: nimic nou (în baza de date există un rând `request.published` pentru ea, dar lista din clopoțel și API-ul `/notifications` nu îl arată). | `capturi/p1-date-generale.png`, `p1-pagina-cererii.png`, `p2-clopotel-ana.png`, `out-mail-p1.json` |
| 2 | Cerere nouă în zonă (clopoțel o singură dată) | TRECUT | Planul GOLD are local întârziere 0, deci NU am mutat `published_at` (cu −31 min cererea ar fi ieșit din fereastra scanării de 20 min). La 72 s după publicare (scanarea de la 15:29:00) clopoțelul lui owner.a arată „Cerere nouă în zona ta · A Mobila Premium · [VERIF V9A] Lemn & Stil "test"”. Câte un singur rând pe membru (5 la firma A, 12 în total la 3 firme); verificat din nou la 15:37 și 16:03 — tot 12, niciun duplicat. Nu pleacă e-mail pe loc (corect după CHANGELOG: doar rezumatul de la 08:00, pe care nu l-am putut porni — nu am cont de admin). | `capturi/p2-clopotel-a.png`, `out-p2-bell.json` |
| 3 | Preluarea: ce primește ana; cine acționează nu primește nimic | PICAT | owner.a a preluat din „Cereri disponibile” (dialogul cu termenul în ora României, „18 nov. 2026, 23:59”), responsabil el însuși. Ana: clopoțel „Cerere preluată de o firmă” + e-mail `Cererea ta a fost preluată — [VERIF V9A] Lemn & Stil "test"` („Firma *A Mobila Premium* a preluat cererea ta… și o poate oferta.”, legătură `/ro/requests/<id>/offers`). DAR owner.a, care a făcut preluarea, a primit și el clopoțelul `claim.created` pentru propria acțiune (fără e-mail). | `capturi/p3-dialog-preluare.png`, `p3-fisa-preluare.png`, `out-p3.json`, `out-st-p3.json` |
| 4 | Mesaje: destinatari | TRECUT | Mesajul firmei (owner.a) → ana: e-mail `Mesaj nou — A Mobila Premium` (legătură `/offers`) + clopoțel; owner.a nu primește nimic pentru propriul mesaj. Răspunsul anei → e-mail doar la `owner.a@demo.ro` (responsabil + proprietar) și `mgr.a@demo.ro`, `Mesaj nou — [VERIF V9A] Lemn & Stil "test"`, legătură `/ro/marketplace/claims/90b0f421-…`; NU la trusted1.a / trusted2.a / managed.a (ei au doar clopoțel); ana nu-și primește propriul mesaj. | `capturi/p4-chat-a.png`, `p4-chat-ana.png`, `out-st-p4.json` |
| 5 | Clarificări | TRECUT (cu observație) | owner.a: „Cere clarificare” pe fișă → ana primește clopoțel + e-mail `Firma A Mobila Premium are o întrebare la cererea ta — [VERIF V9A] Lemn & Stil "test"`. Ana răspunde → owner.a + mgr.a primesc e-mail `Clientul a răspuns la întrebare — …` (legătura la fișă), toți membrii primesc clopoțelul, ana nimic. La ana apare „Întrebări la care ai răspuns: A Mobila Premium a întrebat pe 14 noiembrie 2026 · Întrebare: … · Răspunsul tău: … · Ai răspuns pe 14 noiembrie 2026”. OBSERVAȚIE: întrebarea și istoricul sunt pe pagina „Oferte și conversații” (`/requests/<id>/offers`), nu pe pagina cererii; e-mailul spune „Răspunde din pagina cererii” și duce la `/requests/<id>`, unde întrebarea nu apare deloc (vezi Defecte). | `capturi/p5-firma-intrebare.png`, `p5-ana-intrebare.png`, `p5-ana-istoric.png`, `p5-ana-pagina-cererii.png`, `out-p5-answer.json`, `out-st-p5.json` |
| 6 | Editare după preluare (dialogul, „Nu acum” / „Da, salvează”, „Ce s-a schimbat”, a doua editare) | NEVERIFICAT (mediu + timp) | Scriptul era gata (`p6-edit.cjs`), dar sesiunea anei a fost revocată de două ori de rotirea jetonului de refresh, din vina harness-ului meu: un script s-a încheiat chiar când pagina reîmprospăta jetonul, deci jetonul nou nu s-a salvat, iar următorul script a refolosit jetonul vechi → familia de jetoane revocată. Apoi interfața a fost repornită de coordonator (lipsă de RAM) și am trecut de 75 de minute. Cererea NU a fost editată: `post_claim_edits_used` = 0, pagina arată „Editări folosite: 0/3 înainte de preluare · 0/1 după”. Am văzut doar pagina de editare: „Aceasta este editarea 1 din 1” + nota de după preluare. | `capturi/p6-edit-start.png`, `p6-eroare.png` (login: „Te-ai autentificat pe alt dispozitiv sau sesiunea a expirat”) |
| 7 | Oferta (Zi / Lună / An, 31 februarie), acceptarea, livrarea, recenzia | NEVERIFICAT (timp) | Nu am ajuns la el. Pe fișa preluării se vede „Data livrării” cu trei selecții Zi / Lună / An (nu câmpul de dată al browserului). | `capturi/p3-fisa-preluare.png` |
| 8 | Pe tot parcursul: fără chei brute / `undefined` / UTC / alt host | TRECUT (pentru e-mailurile de la pașii 1–5) | 8 e-mailuri, toate pentru cererea mea: niciunul cu `Notifications.…`, `undefined` sau `null`, fără escapare dublă în subiect sau în HTML; toate legăturile pe `http://localhost:3000/ro/…`; singura dată din corp („20 nov. 2026, 23:59”) e în ora României. Neacoperit: e-mailurile de ofertă / acceptare / finalizare / recenzie (pct. 7). | `out-st-final.json` |

## 3. Defecte

### D1 — Cine preia cererea primește clopoțelul pentru propria preluare (PICAT, pct. 3)
- Pași: owner.a preia cererea `77c29266-…` din „Cereri disponibile” → „Preia cererea…” → „Da, preiau cererea” (responsabil el însuși).
- Ce am văzut: în `notifications`, la 15:31:15, un rând `claim.created` pentru owner.a (ffd08e2c-…), împreună cu ceilalți membri și cu ana. Fără e-mail către el.
- Ce trebuia: fișa V9A, pct. 3: „Cine a făcut acțiunea NU primește nimic pentru ea”. CHANGELOG etapa 9 (`g1`): „cine face actiunea nu mai primeste clopotel sau e-mail”, scos prin `withoutActor`. Lista de evenimente din CHANGELOG (mesaj, acceptare, refuz, cerere de modificare, finalizare, recenzie, evenimentele noi) NU pomenește preluarea, deci se poate să fie doar un caz scăpat, nu o regresie.
- Cauza, sigură din cod: `apps/backend/src/modules/claims/claims.service.ts:270` — `outbox.record(tx, 'claim.created:…', 'claim.created', { claimSlotId, requestId, companyId, clientUserId }, targets)` nu pune `actorUserId` în payload, iar țintele sunt toți membrii firmei + clientul. Prin urmare `withoutActor` (`notifications.processor.ts:30`) nu are pe cine scoate.
- Cât de sigur: mare că se întâmplă (baza + codul). E de decis dacă intră în regulă (PO / coordonatorul).
- Captură / date: `out-st-p3.json`.

### O1 — E-mailul de clarificare trimite clientul la o pagină unde întrebarea nu apare (OBSERVAȚIE, pct. 5)
- Pași: firma pune o întrebare → ana primește e-mailul „Firma A Mobila Premium are o întrebare la cererea ta — …”. Textul spune „Răspunde din pagina cererii…”, iar butonul „Răspunde la întrebare” duce la `http://localhost:3000/ro/requests/<id>`.
- Ce am văzut: pe `/ro/requests/<id>` nu există nimic despre întrebare: nici caseta „Întrebări de la firme”, nici câmp de răspuns, nici istoricul „Întrebări la care ai răspuns” (textul paginii e în `out-p5-ana-pagina-cererii.txt`). Întrebarea, câmpul de răspuns și istoricul sunt doar pe `/ro/requests/<id>/offers` („Oferte și conversații”), la care se ajunge din butonul „Vezi ofertele și conversațiile”.
- Ce trebuia: e-mailul ar trebui să ducă direct la locul unde se răspunde (cum face e-mailul de mesaj, care duce la `/offers`). Fișa cerea și istoricul „pe pagina cererii”; el există, dar pe pagina de oferte.
- Cât de sigur: mare că se întâmplă; e un defect de UX (clientul ajunge pe o pagină fără întrebare), nu de date. Fișierul bănuit: `apps/backend/src/modules/notifications/notification-emails.service.ts` (legătura pentru `clarification.asked`). Legătura din clopoțel nu am verificat-o.
- Captură: `capturi/p5-ana-pagina-cererii.png`, `p5-ana-oferte.png`, `p5-ana-istoric.png`.

### Note de mediu (nu sunt defecte de produs)
- `trusted1.a@demo.ro` nu se loghează cu parola demo locală (401). Nu am schimbat nimic.
- Interfața a răspuns foarte greu (CPU 98–100 %, RAM liber 0,3–1,5 GB); a fost repornită de coordonator în timpul verificării.
- Prima încercare de răspuns la clarificare: textul introdus înainte de hidratare nu a activat butonul „Trimite răspunsul”. După încărcarea completă a mers din prima. Nu e defect.
- Rezumatul zilnic (`digest.new-requests`) nu l-am putut porni: nu am cont de admin.

## 4. Scrieri directe în baza locală
- Niciuna. (Mutarea lui `published_at` nu a fost nevoie: întârzierea planului e 0.) Toate citirile s-au făcut cu `q.cjs` / `st.cjs`, doar SELECT.

## 5. Date rămase în baza locală
- Cererea `77c29266-d0d2-4ad3-b0a1-78c8162683fd` „[VERIF V9A] Lemn & Stil "test"” a anei, IN_MARKETPLACE / preluată parțial, needitată.
- Preluarea `90b0f421-e195-4602-885f-66b5c4cd7e22` a firmei A, ACTIVE, fără ofertă, cu 14 credite rezervate. Termenul de răspuns e 18 nov. 2026, iar clarificarea a fost deja rezolvată. Dacă nu se închide, peste câteva zile preluarea expiră și firma A primește puncte de penalizare.
- Două mesaje în firul `35a21067-…`, clarificarea `df6d0a3d-…` (cu răspuns), notificările și cele 8 e-mailuri de mai sus, rândurile `domain_event_outbox`.
- Ana a rămas cu sesiunea revocată (rotirea jetonului); se reloghează normal.
