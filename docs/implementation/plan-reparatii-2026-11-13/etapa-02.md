# Etapa 2 — Ciorna, publicarea și contul

Locurile 9–15, plus problema 18 adusă în față. Ce scrie clientul nu se mai pierde, publicarea nu mai sare la pasul 1, o firmă nu mai poate publica cereri, iar parola nu mai poate ajunge în adresa paginii.

- Mărime: 11 zile de lucru · schimbă baza de date
- Module atinse: backend/auth, backend/companies, backend/requests, frontend/auth, frontend/configurator, frontend/dashboard, frontend/public, frontend/requests, frontend/stores
- Tabele atinse: attachments, companies, company_members, requests, users
- Presupuneri: Problema 18 se face prima, dacă accepți mutarea de la „Înainte de orice”. Firmele demo (nr. 15) sunt date de pe producție, nu cod: pasul se face cu tine, nu printr-o lansare.
- Gata când: Un client nou poate completa, își face cont, confirmă e-mailul și ajunge înapoi la Sumar cu ciorna întreagă. O editare abandonată nu mai apare ca „continuă” pe formularul de cerere nouă. Un cont de firmă primește refuz clar la publicare.

## 18. Editarea unei cereri publicate și schimbarea modului strică ciorna (`b8`, P1)

- Mărime: 5,5 zile · risc mediu · schimbă baza de date
- De ce contează: Editarea folosește aceeași memorie ca cererea nouă: o editare abandonată reapare ca „continuă” pe formularul gol. „Am proiect” e și mod de pornire, și bifă în coș. Trecerea pe „am nevoie de ajutor” publică răspunsuri pe jumătate.
- Cauza: Editarea unei cereri publicate folosește aceeași memorie din browser ca cererea nouă și o suprascrie, iar o editare abandonată reapare ca „continuă” la cererea nouă. Modul de pornire are trei surse care se pot contrazice: cartonașul de la început, bifa „Am deja un proiect” din coș și bifa „Proiectare cu plată” de la Date generale. Serverul nu păstrează modul, deci la editare îl ghicește greșit.
- Ce s-a văzut în cod: Toate cele trei părți se văd în cod. În plus: serverul nu știe modul ales; el relaxează verificarea oricând e bifată „Proiectare cu plată”, deci și în „Știu ce vreau” bifa de la Date generale lasă să treacă răspunsuri pe jumătate. Editarea abandonată strică și avertismentul de la deconectare („ai o ciornă nepublicată”). Butoanele „Editează cererea” care nu răspund la primul clic (SA-26) nu le-am putut confirma din cod.
- Mutată față de ordinea PO: Era pe locul 18. O fac prima în etapa 2, pentru că problemele 9, 10 și 11 lucrează pe aceeași memorie a ciornei; altfel le-aș reface parțial.
- **După răspunsurile PO (2026-11-13):** Ajutorul se poate cere și pentru o singură cameră, nu doar pentru toată cererea. Felul exact îl alegi la întrebarea nouă din „Înainte de orice”; fără ea nu pot începe problema. Provizoriu am socotit varianta recomandată: 2 zile în plus și o coloană nouă în baza de date.
- Risc: Ciornele deja salvate în browserele clienților au memoria veche; mutarea editării pe altă cheie trebuie să nu le piardă și să nu le reînvie pe cele care sunt de fapt editări abandonate.

**Pași**

1. Editarea primește propria memorie, separată de cererea nouă (cheie per cerere editată, ținută doar pe durata tabului), iar ieșirea fără salvare o aruncă; ciorna nouă rămâne neatinsă.
2. Modul ales la pornire devine singura sursă: alegerea lui setează împreună „am proiect” și „proiectare cu plată” (inclusiv golirea bifei de proiectare la „Am deja un proiect”), iar bifele duplicate se scot sau se transformă în „Schimbă modul”, după răspunsul PO.
3. La trecerea pe „Am nevoie de ajutor” după răspunsuri apare un dialog care spune ce se întâmplă cu ele; la publicare, în acest mod, se trimit doar camerele (fără răspunsuri), după răspunsul PO.
4. La editare, modul se citește din cerere, nu se ghicește (fie din bifa de proiectare, dacă ea devine echivalentă cu modul, fie dintr-o coloană nouă, după răspunsul PO).
5. Serverul relaxează verificarea doar pentru modul „Am nevoie de ajutor”, nu pentru orice cerere cu proiectare bifată.
6. Fac clicabile fazele deja trecute din bara de sus, ca drumul înapoi la Pornire să nu ceară 4–6 apăsări pe „Înapoi”.

**Unde în cod**

- apps/frontend/src/components/configurator/configurator-wizard.tsx:374 — editarea încarcă cererea publicată în memoria ciornei noi
- apps/frontend/src/stores/configurator-store.ts:573 — o singură cheie de memorie (mm_configurator_v1) pentru creare și editare
- apps/frontend/src/components/configurator/configurator-wizard.tsx:80 — la editare, modul se ghicește din bifa de proiectare și din existența răspunsurilor
- apps/frontend/src/components/configurator/configurator-wizard.tsx:458 — „Am deja un proiect” nu scoate bifa de proiectare cu plată
- apps/frontend/src/components/configurator/room-cart-step.tsx:299 — bifa din coș schimbă „am proiect” fără să schimbe modul (doar uploads-step.tsx:68 le aduce la un loc)
- apps/backend/src/modules/requests/configurator.service.ts:70 — verificarea relaxată pornește după bifa de proiectare (requests.service.ts:291, :382), iar review-step.tsx:225 trimite răspunsurile oricum

**Cum se verifică**

- Test pe pagină: încep o cerere nouă, deschid editarea altei cereri, ies fără salvare — cererea nouă e neschimbată și nu apare „Continui?” cu cererea editată.
- Test: „Am nevoie de ajutor” → „Am deja un proiect” nu mai lasă „Proiectare cu plată” bifată.
- Test pe server: o cerere în „Știu ce vreau” cu răspunsuri pe jumătate e refuzată chiar dacă are proiectare bifată (sau acceptată, după decizie).
- Test: o cerere „Am nevoie de ajutor” se redeschide la editare în același mod, iar „Salvează modificările” nu e blocat.
- Verificare manuală: drumul din audit Standard → Am proiect → Ajutor → Standard.

**Documente de adus la zi**

- 03-business-rules.md §4.1 (D-v6-11) (contrazice): „Proiectare contra cost” e un semn pe cerere, independent de mod; dacă PO alege ca proiectarea cu plată să existe doar în modul „Am nevoie de ajutor”, regula trebuie rescrisă.
- 04-data-model.md requests (contrazice): Doar dacă PO alege să păstreze bifa de proiectare în „Știu ce vreau”: atunci modul trebuie păstrat într-o coloană nouă (requests.start_mode), care nu există azi în modelul de date — migrare + actualizare document.

**Legături**

- nr. 9 (`b2`): salvarea la fiecare tastă de la Date generale ar suprascrie mai des ciorna nouă cât timp editarea folosește aceeași memorie
- nr. 10 (`b3`): aceeași golire a memoriei la publicare și la salvarea editării
- nr. 11 (`b4`): cardul „Ai o cerere gata de publicare” citește ciorna locală, pe care editarea o strică azi
- nr. 47 (`e3`): editarea după preluare folosește același ecran
- nr. 48 (`f6`): editarea cererii expirate trece prin același ecran
- nr. 38 (`b10`): Sumarul arată azi trei rânduri despre mod (am proiect / proiectare / ajutor)

**Întrebări și răspunsuri**

- **[b8-1] „Proiectare cu plată” rămâne o bifă separată în „Știu ce vreau” sau înseamnă doar modul „Am nevoie de ajutor”?**
  - Context: Azi poți alege „Știu ce vreau” și bifa la Date generale „Include proiectare cu plată”, care dublează modul „Am nevoie de ajutor” și lasă să treacă răspunsuri incomplete. Răspunsul hotărăște și dacă modul trebuie păstrat într-un câmp nou pe cerere.
  - Variante: 1) Doar modul „Am nevoie de ajutor” · 2) Bifa rămâne și în „Știu ce vreau”
  - **Răspunsul PO (altceva):** „o sa existe cazuri in care clientul stie in mare ce doreste dar pentru o singura camera are nevoie de ajutor din partea firmelor”
- **[b8-2] Ce facem cu bifa „Am deja un proiect pentru toată locuința” din coș?**
  - Context: Aceeași alegere există și ca mod de pornire, și ca bifă în coș, iar cele două se pot contrazice (în modul „Am deja un proiect” bifa se poate debifa).
  - Variante: 1) O scot; în coș rămâne „Mod: … · Schimbă” · 2) O păstrez, dar schimbă modul
  - **Răspunsul PO:** O scot; în coș rămâne „Mod: … · Schimbă” (recomandarea). Modul se schimbă doar într-un loc; clientul vede mereu ce a ales.
- **[b8-3] Când clientul trece pe „Am nevoie de ajutor” după ce a răspuns la întrebări, răspunsurile pleacă la firme?**
  - Context: Azi răspunsurile date înainte rămân și pleacă la firme, chiar dacă sunt pe jumătate, iar la editare cererea se deschide în alt mod și nu mai poate fi salvată.
  - Variante: 1) Nu pleacă; rămân în ciornă dacă revine · 2) Pleacă, marcate „parțial” · 3) Se șterg, cu avertisment
  - **Răspunsul PO:** Nu pleacă; rămân în ciornă dacă revine (recomandarea). Firma primește un brief curat; clientul e avertizat la schimbare și le regăsește dacă se întoarce în „Știu ce vreau”.

## 9. Ce scrii la „Date generale” se pierde la „Înapoi” sau la reîncărcare (`b2`, P1)

- Mărime: 1 zi · risc mic
- De ce contează: Mesajul pentru firme dispare, în timp ce antetul arată „Ciornă salvată”. Din cod, la fel pățesc adresa, contactele, termenul și bugetul.
- Cauza: Tot ce scrie clientul la „Date generale” stă doar pe ecran și ajunge în ciornă abia la „Continuă la sumar”. „Înapoi”, reîncărcarea sau schimbarea limbii pierd textul, iar antetul arată totuși „Ciornă salvată”, pentru că salvează ciorna veche.
- Risc: Salvarea automată poate porni la fiecare tastă și să trimită prea des ciorna la server dacă întârzierea nu e pusă corect.

**Pași**

1. Urmăresc toate valorile formularului și le scriu în ciornă la fiecare modificare, cu o mică întârziere (circa 400 ms), fără validare — ca la întrebările camerelor.
2. La „Înapoi” și la părăsirea pasului scriu imediat valorile curente, ca să nu se piardă ultima tastă.
3. Am grijă ca cele două completări automate (e-mailul contului pe primul rând și bugetul din estimare) să fie și ele salvate, fără să intre în buclă cu salvarea automată.
4. Validarea strictă rămâne doar la „Continuă la sumar”.

**Unde în cod**

- apps/frontend/src/components/configurator/details-step.tsx:173 — valorile ajung în ciornă doar la trimiterea formularului
- apps/frontend/src/components/configurator/details-step.tsx:399 — butonul „Înapoi” apelează doar onBack, fără salvare
- apps/frontend/src/components/configurator/details-step.tsx:92 — formularul pornește din ciornă, deci ce nu s-a salvat dispare la remontare
- apps/frontend/src/components/configurator/configurator-wizard.tsx:185 — DraftStatus arată „salvat” după sincronizarea ciornei, care nu conține ce s-a tastat

**Cum se verifică**

- Test de componentă: scriu mesajul, apăs „Înapoi”, revin — textul e acolo.
- Test: reîncarc pagina pe pasul Date generale — adresa, contactele, termenul și bugetul rămân.
- Verificare manuală: schimbarea limbii pe pasul Date generale.

**Legături**

- nr. 18 (`b8`): cu salvarea la fiecare tastă, o editare de cerere publicată ar scrie și mai des peste ciorna nouă cât timp editarea folosește aceeași memorie
- nr. 16 (`b11`): bugetul e în același formular și are propria completare automată
- nr. 31 (`b12`): adresa e în același formular

## 10. După „Publică cererea” formularul sare la pasul 1, cu avertisment (`b3`, P1)

- Mărime: 0,5 zile · risc mic
- De ce contează: Publicarea reușește, dar înainte să apară pagina cererii formularul arată din nou primul pas și „Ciornă salvată doar pe acest dispozitiv”. Niciun mesaj de reușită. Văzut local; durata pe producție e de verificat.
- Cauza: Imediat după reușită formularul își golește memoria înainte să plece spre pagina cererii, așa că apare din nou primul pas. Golirea pornește și salvarea automată, care încearcă să salveze ciorna deja publicată, primește „nu există” și afișează „salvată doar pe acest dispozitiv”.
- Ce s-a văzut în cod: Ecranul „Se publică…” există deja și ar trebui să rămână până la redirecționare, dar golirea ciornei imediat după reușită îl ascunde și readuce primul pas. Cursa nu ține de viteza din modul de dezvoltare.
- Risc: Dacă golirea ciornei nu mai are loc după navigare, la următoarea cerere nouă ar reapărea cererea deja publicată.

**Pași**

1. La pornirea publicării opresc salvarea automată (un semn „se publică” care blochează trimiterea ciornei) și anulez salvarea programată.
2. După reușită navighez întâi la pagina cererii și golesc ciorna abia după plecare, ca formularul să nu mai arate primul pas.
3. Arăt pe pagina cererii un mesaj scurt „Cererea a fost publicată” (sistemul de mesaje existent din toaster.tsx).
4. Pentru eroarea întâmplătoare 502 la salvarea ciornei adaug un „Reîncearcă” lângă mesajul „salvată doar pe acest dispozitiv”; cauza de pe server se verifică separat în jurnalele de producție.

**Unde în cod**

- apps/frontend/src/components/configurator/configurator-wizard.tsx:562 — onPublished: șterge tokenul, golește memoria (reset) și abia apoi navighează
- apps/frontend/src/stores/configurator-store.ts:563 — reset readuce pasul de pornire și schimbă updatedAt
- apps/frontend/src/components/configurator/configurator-wizard.tsx:421 — salvarea automată pornește la orice schimbare a updatedAt, cu tokenul vechi încă ținut în pagină
- apps/frontend/src/components/configurator/review-step.tsx:310 — ecranul „Se publică…” gândit să rămână după reușită, dar dispare odată cu pasul Sumar
- apps/frontend/src/components/configurator/configurator-wizard.tsx:526 — DraftStatus arată eroarea de salvare a ciornei moarte

**Cum se verifică**

- Test de componentă: după publicare nu se mai trimite nicio salvare a ciornei și nu apare primul pas.
- Test: după publicare, /requests/new pornește gol, fără dialogul „Continui?”.
- Verificare manuală pe producție: între clic și pagina cererii se vede doar „Se publică…”.

**Legături**

- nr. 18 (`b8`): aceeași golire a memoriei la publicare și la ieșirea din editare

## 11. Clientul nou nu e dus înapoi la ciorna lui după confirmarea e-mailului (`b4`, P1)

- Mărime: 1,5 zile · risc mic
- De ce contează: Vizitatorul completează tot formularul, își face cont, confirmă e-mailul și ajunge pe un panou care spune „nu ai nicio cerere”. Dacă deschide e-mailul pe alt dispozitiv, ciorna nu e acolo.
- Cauza: Adresa de întoarcere la Sumar se păstrează de la Sumar până la înregistrare, dar nu ajunge în linkul din e-mail, iar pagina de confirmare trimite la autentificare fără ea, deci clientul ajunge pe Panou. Panoul nu știe de ciornele nepublicate, iar ciorna se poate deschide numai din browserul în care a fost începută.
- Ce s-a văzut în cod: Pe același dispozitiv ciorna nu se pierde: după autentificare, ciorna anonimă se leagă de cont la prima salvare și dialogul de reluare apare pe /requests/new. Doar drumul de întoarcere lipsește. Pe alt dispozitiv nu există azi niciun mijloc de a deschide ciorna, pentru că cheia ei stă numai în browserul inițial, iar serverul ține doar o amprentă a ei. Dacă ciorna trebuie găsită și pe alt dispozitiv se hotărăște la nr. 32 (fila „Ciorne”).
- Risc: Adresa de întoarcere pusă în link poate fi folosită pentru redirecționări spre alte site-uri dacă nu e filtrată strict.

**Pași**

1. La înregistrare trimit și adresa de întoarcere (acceptată doar dacă e o cale internă din lista permisă, de ex. /requests/new) și o pun în linkul de confirmare ca parametru.
2. Pagina de confirmare citește parametrul și duce butonul „Mergi la autentificare” la /login cu aceeași întoarcere; ca rezervă, pe același dispozitiv, citesc și semnul „ai o ciornă nepublicată” deja existent în browser.
3. Pe Panou adaug un card „Ai o cerere gata de publicare — Continuă” când browserul are o ciornă nepublicată (funcția hasUnpublishedLocalDraft există deja).
4. Repar și verificarea adresei de întoarcere la login, care azi acceptă orice cale ce începe cu „/” (inclusiv „//alt-site”).
5. Pentru alt dispozitiv: după răspunsul PO, adaug o listă „Ciornele mele” pentru contul logat, cu deschidere printr-o cheie nouă emisă de server (cea veche nu se poate recupera).

**Unde în cod**

- apps/frontend/src/app/[locale]/(auth)/verify-email/page.tsx:33 — „Mergi la autentificare” e /login fără adresa de întoarcere (la fel :50)
- apps/frontend/src/app/[locale]/(auth)/register/page.tsx:43 — adresa de întoarcere e citită doar pentru linkul spre login, nu se trimite la înregistrare
- apps/backend/src/modules/auth/auth.service.ts:153 — linkul de confirmare conține doar tokenul
- apps/frontend/src/components/configurator/review-step.tsx:483 — Sumarul trimite la /login?redirect=/requests/new
- apps/backend/src/modules/requests/requests.service.ts:503 — lista cererilor clientului exclude ciornele
- apps/frontend/src/app/[locale]/dashboard/page.tsx:236 — Panoul arată „Încă nu ai nicio cerere”

**Cum se verifică**

- Test pe server: linkul de confirmare conține întoarcerea doar pentru căi permise.
- Test de pagină: confirmarea duce la /login?redirect=/requests/new, iar login-ul la Sumar.
- Test: o cale de tip „//exemplu.com” e refuzată la login.
- Verificare manuală cap-coadă pe local: vizitator → cont → e-mail în Mailpit → Sumar.

**Legături**

- nr. 35 (`f4`): aceleași linkuri din e-mail deschise fără sesiune
- nr. 48 (`f6`): o listă de ciorne pe cont cere și regula de ștergere a ciornelor vechi
- nr. 18 (`b8`): cardul de pe Panou citește ciorna locală, pe care editarea unei cereri publicate o strică azi

## 12. Un cont de firmă poate publica o cerere și o poate prelua singur (`f2`, P1)

- Mărime: 0,5 zile · risc mic
- De ce contează: Serverul nu verifică rolul la publicare. Cererea apare în piața aceleiași firme cu „Preia cererea…”, iar „Cererile mele” îi dă eroare.
- Cauza: Serverul verifică doar că cineva e autentificat când publică o cerere, nu și că e client. Formularul arată butonul „Publică cererea” oricui e logat, inclusiv unei firme sau unui administrator.
- Risc: Un admin care folosea contul lui ca să testeze publicarea nu mai poate; testele trebuie făcute cu un cont de client.

**Pași**

1. La publicare, serverul refuză orice rol în afară de CLIENT cu 403 și un cod nou în ERROR_CODES (ex. REQUEST_PUBLISH_CLIENT_ONLY), mesaj în ro/en.
2. Ciorna anonimă nu se mai atașează unui cont care nu e client (patchDraft, :251).
3. În Sumar, pentru firmă sau admin, în locul butonului apare o notă: „Cererile se publică dintr-un cont de client.”, cu link spre ieșire din cont.
4. La intrarea pe /requests/new, un cont de firmă vede aceeași notă sus, ca să nu completeze degeaba.
5. Interogare pe productie (doar citire) pentru cereri publicate de conturi care nu sunt client; dacă există, le arăt PO pentru decizie.

**Unde în cod**

- apps/backend/src/modules/requests/requests.controller.ts:79 — ruta de publicare e @Public(), fără @Roles(CLIENT)
- apps/backend/src/modules/requests/requests.service.ts:271 — publicarea verifică doar că există un utilizator
- apps/backend/src/modules/requests/requests.service.ts:251 — o ciornă anonimă salvată de orice cont logat devine a lui (și a unei firme)
- apps/frontend/src/components/configurator/review-step.tsx:464 — butonul de publicare apare pentru orice cont logat (authed = !!me.data)

**Cum se verifică**

- Test e2e backend: publicare cu COMPANY_USER și ADMIN → 403 cu codul nou; cu CLIENT → 201.
- Test de componentă pe Sumar: firma logată vede nota, nu butonul.

**Legături**

- nr. 35 (`f4`): mesajele „pagina e doar pentru clienți / firme” folosesc același text și același loc

## 13. Scoaterea unei camere din coș șterge răspunsurile fără confirmare (`b6`, P1)

- Mărime: 1 zi · risc mic
- De ce contează: O cameră deja completată dispare la un clic; adăugată înapoi, pornește goală.
- Cauza: Scoaterea camerei din coș se face pe loc, fără întrebare și fără „Anulează”, iar răspunsurile ei se pierd. Butonul scoate mereu ultima cameră de acel tip și lasă în urmă schițele ei, care trec apoi drept fișiere ale proiectului.
- Ce s-a văzut în cod: Mai grav decât în audit: butoanele „−” și „×” scot mereu ultima cameră de acel tip, nu pe cea aleasă, deci la două băi se poate pierde chiar cea completată. Schițele camerei scoase rămân pe ciornă, apar apoi la „Fișierele proiectului” și pleacă la firme odată cu cererea. Poza 3D salvată în memorie nu se șterge pe acest drum.
- Risc: Ștergerea schițelor cu camera e definitivă; dacă dialogul nu spune clar asta, clientul poate pierde fișiere pe care le voia.

**Pași**

1. Când o cameră are măcar un răspuns, scoaterea deschide un dialog: „Scoți Baie 2? Se pierd N răspunsuri și M schițe.” cu „Păstrează” (implicit) și „Scoate”.
2. La „−” pe un tip cu mai multe camere scot întâi una fără răspunsuri; dacă toate au răspunsuri, dialogul spune care dintre ele se scoate.
3. Camerele fără răspunsuri se scot pe loc, fără dialog, ca azi.
4. La confirmare șterg de pe ciornă și schițele camerei și golesc poza 3D salvată, ca să nu ajungă la firme drept fișiere ale proiectului.
5. Adaug textele dialogului în ro.json și en.json.

**Unde în cod**

- apps/frontend/src/stores/configurator-store.ts:430 — scoaterea ultimei camere de un tip, fără să golească poza 3D (spre deosebire de :445)
- apps/frontend/src/components/configurator/cart-basket.tsx:142 — „×” din coș scoate direct (la fel :204 pe telefon)
- apps/frontend/src/components/configurator/room-cart-step.tsx:135 — „−” pe cartonaș (și „Elimină” la „Altă piesă”, :109) scoate direct
- apps/frontend/src/components/configurator/uploads-step.tsx:46 — fișierele care nu mai aparțin niciunei camere sunt considerate fișiere ale proiectului

**Cum se verifică**

- Test pe memoria ciornei: la două băi, „−” scoate întâi baia fără răspunsuri.
- Test de componentă: „×” pe o cameră cu răspunsuri deschide dialogul; „Păstrează” nu schimbă nimic.
- Test: după scoatere, schițele camerei nu mai apar la „Fișierele proiectului”.

**Legături**

- nr. 20 (`c10`): „Altă piesă” are propriul buton „Elimină” în același coș
- nr. 18 (`b8`): la editarea unei cereri publicate, schițele unei camere scoase sunt fișiere ale cererii, nu ale ciornei

## 14. Parola poate ajunge în adresa paginii la login (`f1`, P1)

- Mărime: 0,5 zile · risc mic
- De ce contează: Formularul nu are metodă de trimitere. Apăsat înainte ca pagina să se încarce complet, trimite e-mailul și parola în URL, de unde pot ajunge în istoric și în jurnalele serverului.
- Cauza: Formularele de cont nu spun browserului să trimită datele ascuns, așa că, dacă cineva apasă butonul înainte ca pagina să fie gata, browserul pune e-mailul și parola în adresa paginii. În plus, adresa de întoarcere de după login nu e verificată destul și poate trimite omul pe alt site.
- Ce s-a văzut în cod: Confirmat și redirecționarea deschisă: după login se acceptă orice adresă care începe cu „/”, deci și „//alt-site”. Aceeași lipsă a metodei e pe toate cele cinci formulare de cont (login, înregistrare, parolă uitată, resetare, schimbare parolă).
- Risc: Un redirect intern legitim cu caractere neobișnuite ar putea fi respins și omul ar ajunge pe Panou.

**Pași**

1. Pun method="post" pe cele cinci formulare de cont, ca un trimis înainte de încărcare să nu pună niciodată câmpurile în adresă.
2. Țin butonul de trimitere dezactivat până la încărcarea paginii (un mic hook „montat” comun în (auth)/_components).
3. Scriu o funcție comună safeRedirect în lib: acceptă doar căi interne care încep cu un singur „/” (resping „//”, „/\”, scheme și adrese absolute), altfel /dashboard.
4. Folosesc safeRedirect la login și oriunde se citește parametrul redirect (înregistrare, linkul de confirmare a e-mailului, f4).
5. Adaug teste: formularele au method post, safeRedirect respinge „//evil.com”, „/\evil.com”, „https://…” și păstrează „/requests/abc?x=1”.

**Unde în cod**

- apps/frontend/src/app/[locale]/(auth)/login/page.tsx:63 — <form> fără method; butonul de la :123 e activ înainte de încărcare
- apps/frontend/src/app/[locale]/(auth)/login/page.tsx:42 — redirect.startsWith('/') acceptă și „//alt-site.ro” (redirect deschis)
- apps/frontend/src/app/[locale]/(auth)/register/page.tsx:85 — același <form> fără method
- apps/frontend/src/app/[locale]/(auth)/forgot-password/page.tsx:78 — același <form> fără method
- apps/frontend/src/app/[locale]/(auth)/reset-password/page.tsx:90 — același <form> fără method (parola nouă)
- apps/frontend/src/app/[locale]/(auth)/change-password/page.tsx:70 — același <form> fără method (parola veche și nouă)

**Cum se verifică**

- Test unitar pentru safeRedirect cu cazurile bune și rele.
- Test de componentă: formularele de login/înregistrare/resetare au method=post și butonul dezactivat la primul render.
- Manual: login cu ?redirect=//example.com duce pe /dashboard.

**Legături**

- nr. 35 (`f4`): aceeași funcție de întoarcere după login, folosită de toate paginile cu cont
- nr. 25 (`f3`): tot pe pagina de login: mesajul „sesiunea a expirat” vine prin aceeași întoarcere

## 15. Firmele demo apar public, pe producție, ca „firme verificate” (`k1`, P1)

- Mărime: 0,5 zile · risc mic
- De ce contează: Pagina „Firme partenere” listează cinci firme demo lângă una reală. Un vizitator le ia drept firme adevărate.
- Cauza: Pagina „Firme partenere” arată toate firmele aprobate, iar firmele demo sunt aprobate pe producție. Nu există niciun semn în baza de date care să deosebească o firmă demo de una reală, în afară de adresa de e-mail a membrilor (@demo.ro).
- Ce s-a văzut în cod: Codul face ce trebuie (listează firmele aprobate); problema e de date pe producție. Decizia D-L0-4 (2026-08-19) spune deja că datele demo se șterg de pe producție, iar scriptul există, dar nu a fost rulat; conturile demo sunt încă folosite pentru verificări pe producție.
- Risc: Ascunderea după e-mail ar putea ascunde și o firmă reală care are, din greșeală, un membru @demo.ro.

**Pași**

1. Varianta „ascunde acum”: lista publică exclude firmele care au membri cu e-mail @demo.ro (aceeași regulă ca scriptul), fără schimbare de schemă.
2. Aplic aceeași excludere oriunde se arată firme public (carusel pe landing, dacă folosește aceeași sursă).
3. Varianta „șterge”: rulezi întâi scriptul în mod de probă (doar numără), apoi cu confirmare și copie de rezervă, apoi ștergi obiectele din storage din lista generată.
4. După ștergere, verific pagina publică și că firma reală a rămas.

**Unde în cod**

- apps/backend/src/modules/companies/companies.service.ts:102 — lista publică: toate firmele APPROVED, nesterse
- apps/backend/prisma/schema.prisma:433 — firma nu are niciun câmp care s-o marcheze ca demo
- apps/backend/prisma/cleanup-demo.ts:1 — scriptul de curățare: șterge conturile @demo.ro și firmele lor, păstrează „Mobila Unicat”
- docs/07-decisions-log.md:395 — D-L0-4: datele demo se șterg de pe producție

**Cum se verifică**

- Test backend: listPartners nu întoarce firmele cu membri @demo.ro.
- După rulare pe producție: /ro/partners arată doar firma reală.

**Întrebări și răspunsuri**

- **[k1-1] Ce facem cu firmele demo de pe producție înainte de lansare?**
  - Context: Decizia din august spune să fie șterse, dar conturile demo sunt încă folosite pentru verificări pe producție, iar azi apar ca „firme verificate”.
  - Variante: 1) Le ascundem acum de pe paginile publice și le ștergem la lansare · 2) Le ștergem acum cu scriptul existent · 3) Le lăsăm așa până la lansare
  - **Răspunsul PO:** Le ascundem acum de pe paginile publice și le ștergem la lansare (recomandarea). Vizitatorii nu le mai văd; verificările cu conturile demo merg în continuare; ștergerea rămâne un pas al lansării.

