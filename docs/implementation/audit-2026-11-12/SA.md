# Raport SA — scenarii cu cont pe stiva LOCALA (client ana.popescu + firma A)

Agent: SA · 2026-11-12 · `http://localhost:3000` (Next dev) · Playwright Edge headless, WebGL pe
`ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 Direct3D11)` — GPU confirmat.
Capturi: `C:\Users\Wolf\AppData\Local\Temp\claude\826c1772a242ab28\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\audit\shots\SA\<scenariu>\`
Driver: `...\audit\scripts\SA\server.cjs` (browser persistent, comenzi prin HTTP local).

## 1. Scenarii

| ID | Ce face | Rezultat | Pe scurt |
|---|---|---|---|
| SA-01 | Bucatarie in L, drum fericit pana la recenzie | TRECUT (cu defecte) | Cerere `01c31ea5…` publicata → preluata (29 cr) → clarificare → oferta 32.000 RON → acceptata → livrata → confirmata → recenzie 5*. Prima publicare a picat cu 401 (sesiune revocata de un login paralel pe acelasi cont). |
| SA-02 | Dulap 3D, mgr preia + atribuie, EUR, modificare, v2, refuz | PARTIAL | Totul pana la v2 merge; comparatia v1/v2 si „refuza oferta” nu exista in interfata. |
| SA-03 | „Am deja un proiect” + PDF, retragere in 30 min | TRECUT (cu defecte) | Credite inapoi, 0 puncte, cererea revine in piata; PDF invizibil inainte de preluare, clientul nu afla nimic. |
| SA-04 | Editare inainte / dupa preluare | TRECUT (cu defecte) | Contorul scade corect, raspunsurile raman; firma nu e anuntata de editare; buton „Editeaza” capricios. |
| SA-05 | Clientul sterge cererea dupa oferta | TRECUT (cu defecte) | Confirmare = `window.confirm` nativ; firma: „Anulata de client”, credite inapoi, fara e-mail; oferta ei apare „Retrasa”. |
| SA-06 | Firma retrage oferta si trimite alta | TRECUT (cu defecte) | Merge; dialogul contrazice fisa (termen, penalizare); clientul citeste „nu a trimis inca o oferta”. |
| SA-07 | Roluri owner / manager | PARTIAL | Manager ≈ proprietar (preluare, pret, portofel, membri); chat de echipa OK; vederea angajatului nelegat neverificata (fara parola). |

### SA-01 — jurnal
- Ana, mod „Stiu ce vreau” → Bucatarie → L, A=320 / B=240 / H=260 cm, MDF vopsit, Gola (baza), Aventos (sus), cuart, 5 electrocasnice; PNG 3 KB la Fisiere;
  buget slider 39.000 (estimare 29.000–87.000), 1–3 luni, Bd. Unirii 10 (Places).
- Publicare #1: `POST …/drafts/<t>/publish` → **401**; pe ecran doar „A aparut o eroare neasteptata. Incearca din nou.” (captura `18-ana-18-publish-401-error.png`).
  Cauza: alt login pe contul Ana (alt agent / coordonator, 18:55:57 UTC) — `token.service.ts:37 issueNewFamily` revoca TOATE refresh-tokenurile utilizatorului la fiecare login.
  Dupa re-login ciorna era intacta; publicare #2 OK. Intre click si pagina cererii: 2 s pasul 1 „Configureaza-ti proiectul”, apoi banner „Ciorna salvata doar pe acest dispozitiv”, apoi
  `404 PATCH …/drafts/<t>` si abia la ~12 s pagina cererii (M-08 reprodus).
- Cerere: IN_MARKETPLACE, LARGE, 29 credite, `budget_range=OVER_15K`, `budget_estimate_ron=39000`, expira 19 nov 23:59. **Niciun e-mail de confirmare a publicarii** catre Ana.
- owner.a: marketplace o arata imediat (GOLD intarziere 0). Inainte de preluare vede descriere, buget „Peste 15.000 RON”, marime, ≈1 km, raspunsurile; **NU vede fisierul PNG** (M-10 confirmat).
  Portofel inainte: 298 disponibile / 35 rezervate. Dupa preluare: 269 / 64 (corect). Dialogul de preluare e clar (30 min gratuit, 2 puncte dupa).
- Fisa: „Neatribuit … se anuleaza in 59 min” (M-14) → am ales „Andrei A”. Clarificare trimisa → SLA „in pauza”, termen mutat de pe 19 nov 23:59 pe **21 nov 00:00** (regula +1 zi lucratoare — dar termenul depaseste acum expirarea cererii, 19 nov).
- Ana: panoul spune „O firma asteapta raspunsul tau → Raspunde” (bine); pagina cererii spune doar „O firma pregateste oferta” (nu pomeneste intrebarea). **Niciun e-mail** pentru clarificare.
  Dupa raspuns, intrebarea si raspunsul **dispar complet** din pagina clientului (nu apar nici in conversatie). Firma vede raspunsul in fila Clarificari, dar **fara notificare / e-mail**.
- Oferta 32.000 RON, 6 saptamani, 24 luni → trimisa fara confirmare; e-mail „Oferta noua…” la Ana. Formularul spune „Varianta 1 din cel mult 3”, oferta afisata spune „Versiunea 1”.
- Ana: comparator + „Cere modificare” + „Accepta oferta…”. Dialogul de acceptare: „Valabila pana la **11/26/2026**” (format american); recomanda corect sa intrebe de TVA.
- Dupa acceptare: request ACCEPTED, `claim_slots.status` ramane OFFER_SENT, iar antetul fisei firmei arata tot **„OFERTA TRIMISA”** (si dupa livrare); „Acceptata pe 11/12/2026” (format US) la ambele parti.
  Clientul primeste „Ce urmeaza?” in 4 pasi + „Acordul vostru”, dar **nicio data de contact a firmei** (telefon / e-mail / adresa) — doar conversatia. Firma vede numele, e-mailul, adresa Anei.
- Nu exista etape de executie (contract, avans, masuratori, programare montaj): doar „Marcheaza ca livrata” si „Proiectul s-a blocat?”. Firma a putut marca livrarea **la 1 minut dupa acceptare** (termen 6 saptamani), fara nicio limita.
- Dupa „Da, am livrat”: e-mail la Ana „Lucrarea a fost livrata — confirma primirea”; la firma nu apare nicio stare „asteapta confirmarea clientului” (butonul doar dispare).
- Ana: „Confirma livrarea” pe pagina cererii e un link spre /offers; acolo butonul „Confirma livrarea” **finalizeaza direct, fara dialog de confirmare** (firma are dialog „nu se poate anula”). Nu exista „nu am primit / am o problema” langa el.
  Dupa confirmare: COMPLETED; creditele firmei abia acum consumate (CONSUME 29 COMPLETED; 269 / 35).
- Recenzie 5* trimisa; firma primeste notificari `delivery.confirmed` si `review.created` in clopotel, **fara e-mail**; fisa firmei (FINALIZATA) nu arata recenzia.
- E-mailurile de mesaj nou din conversatie pleaca la **toti cei 5 membri** ai firmei A (owner, mgr, trusted1, trusted2, managed), nu doar la responsabil.
- Notificari in DB: clientul primeste si el `quote.created` / `message.created` / `quote.accepted` pentru propriile actiuni (de verificat in clopotel).

### SA-02 — jurnal (cerere `1ea1fddd…`, Dulap 3D)
- Ana: Piese individuale → Dulap → 3D 240×260×60, cu maner, Nuc → PAL → fara fisiere → buget 9.000 (5.000–15.000), Flexibil, Str. Academiei 5 → Publica (din nou 404 PATCH pe ciorna dupa publicare).
- Pagina cererii / marketplace: rand „**Dulap pana in tavan (tip dressing)**” — eticheta pe care clientul nu a ales-o; acelasi card arata „**2.4 × 0.6 × 2.6 m**” (L×A×I) si imediat sub „**240 × 260 × 60 cm**” (L×I×A) — ordine si unitate diferite.
- mgr.a: „Vezi corpul in 3D” merge (GPU, model corect, doar vizualizare). Primul „Da, preiau cererea” → **500** pe `POST /claims` + 500 pe socket.io / notificari (CPU 82%, RAM 1,5 GB liber in acel moment — probabil backend dev repornit; de verificat pe productie); mesaj „A aparut o eroare. Incearca din nou.”. A doua incercare OK, 9 credite.
- Atribuire catre „Elena A” (EMPLOYEE_MANAGED) OK. Oferta v1: 2.100 EUR (≈10.920 RON), 20 zile lucratoare. Valabilitate 10 zile.
- Ana: „Cere modificare” = camp de text in pagina (nu dialog), trimis → „Astepti raspunsul firmei la modificarea ceruta.”; **textul cererii ei nu mai apare nicaieri** la client. Nu exista e-mail catre firma (doar `quote.updated` in clopotel).
  Dupa prima cerere de modificare cererea trece in NEGOTIATION si **dispare din marketplace** („firme noi nu o mai pot vedea”), desi erau 2 locuri libere.
- Firma: vede „Modificare solicitata: …”, formular „Raspunde cu o varianta noua” **gol** (nu precompletat din v1) si **fara camp de moneda** — clientul a cerut lei, firma nu poate trece din EUR. Butoane „Trimite” / „Refuza modificarea”.
- v2 = 1.850 EUR, 4 saptamani → la firma se vede doar „Versiunea 2”, v1 dispare. La client: comparatorul arata doar v2; **nu se pot compara variantele**; **niciun e-mail** pentru v2.
- **Nu exista buton „Refuza oferta”** pentru client (backend-ul nu are nici endpoint: `quotes.controller.ts` — doar accept / changes). Ana a scris refuzul in chat; nimic nu se schimba: cerere NEGOTIATION, slot OFFER_SENT, 9 credite raman rezervate.
  Singurele iesiri pentru client: sa nu faca nimic (expira 19 nov) sau sa stearga cererea. Pas „refuza” = PICAT (functie inexistenta).
- Clopotelul Anei contine `message.created sender=CLIENT` (propriul mesaj) si `quote.accepted` (propria acceptare din SA-01) — notificari despre propriile actiuni.

### SA-03 — jurnal (cerere `1c18db77…`, „Am deja un proiect”, Dormitor + PDF 40 KB)
- Modul „Am deja un proiect” promite „fara intrebarile despre dimensiuni”. Dupa ce aleg piesele (Dulap, Cadru pat, Noptiere) urmeaza **11 pasi, toti obligatorii**
  (usi dulap, saltea, depozitare sub pat, tapitat, cate noptiere, material + „Deschidere” pentru FIECARE piesa, inclusiv „**Deschidere — pat**”). Clientul cu proiect tehnic e obligat
  sa raspunda la tot ce e deja in PDF; lipseste „vezi proiectul atasat / decide firma”.
- Pe pasul Fisiere apare butonul „Nu am proiectul la indemana — completez dimensiunile” (bun). PDF-ul s-a incarcat; in sumar numele e taiat „proiect-….pdf”.
- Publicata: MEDIUM, 13 credite.
- owner.a (sesiunea mea fusese revocata de un login paralel pe owner.a — vezi SA-x01): pagina `/marketplace/<id>` a afisat „**Nicio cerere disponibila momentan.**” cu API-ul raspunzand 401 — fara „sesiunea a expirat, autentifica-te”. Dupa re-login: vede eticheta „Proiect propriu”,
  raspunsurile, dimensiune inventata „0.9 × 0.6 × 2.6 m” (din salteaua 90?), „Pat tapitat — PAL — MANER”, dar **PDF-ul proiectului NU apare inainte de preluare** (exact documentul dupa care ar oferta).
- Preluare 13 credite (240/64 → 227/77). Dupa preluare fisierul apare ca „**attachme….pdf**” (numele original „proiect-dormitor-test.pdf” pierdut la firma; la client apare „proiect-….pdf”).
- Atribuirea „Andrei A” imediat dupa preluare → `409 POST /claims/<id>/assign`, **fara mesaj** pe ecran; selectul revine la „Neatribuit”. (In SA-01 / SA-04 aceeasi actiune a mers.) De verificat cauza 409.
- Retragere: fila arata „Esti in primele 30 de minute: creditele se restituie integral, fara penalizare.”, dialog clar („gratuita pana la 22:00”, „Locul se elibereaza”). Rezultat: WITHDRAWN_VOLUNTARY, REFUND 13 (WITHDRAWAL_VOLUNTARY_GRACE), portofel 240/64, puncte 12 → 12, cererea revine IN_MARKETPLACE. TRECUT.
- Firma A nu mai vede cererea dupa retragere (tot „Nicio cerere disponibila momentan”, fara explicatie ca a renuntat la ea).
- Ana: **nicio notificare si niciun e-mail** ca firma a renuntat; pagina revine la „Asteptam firmele” si „Nume, adresa si date de contact: **Nicio firma inca**” — desi firma A i-a vazut numele, e-mailul si adresa timp de cateva minute.

### SA-04 — jurnal (cerere `07ec6e1b…`, Noptiere 3D)
- Publicata SMALL 5 credite. „Editeaza cererea (3 ramase)” → `/requests/<id>/edit`: tot formularul (pasul 2 Camere), banner „Aceasta este editarea 1 din 3 … Salvarea de acum consuma una.” Raspunsurile si mesajul sunt pastrate.
- Editare 1 (Una → Pereche, mesaj nou) → Salveaza, fara dialog → `pre_claim_edits_used=1`, „Editari folosite: 1/3”, cost 5 → 7 credite, `budget_estimate_ron` 5.000 → 7.000 automat.
  Sumarul editarii spune „**un fisier atasat**” desi cererea nu are fisiere (probabil captura 3D numarata ca fisier — de verificat).
- `/ro/requests/new` dupa editare: ciorna noua goala (nu o copie a cererii publicate) — TRECUT.
- owner.a preia (7 credite), atribuie Andrei A. Ana: butonul „Editeaza cererea (1 ramasa)” **nu a navigat** la 3 click-uri (si inainte de preluare primul click nu a mers); `/edit` deschis direct merge — de verificat.
  Banner: „Aceasta este editarea 1 din 1 … firmele pot renunta la preluare.” Material MDF vopsit → Lemn masiv; Salveaza **fara dialog de confirmare** (ultima editare, cu efect asupra firmelor).
- Firma: **nicio notificare, niciun e-mail**, nimic in fisa care sa spuna ca cererea s-a schimbat sau ce anume (doar continutul nou: LEMN MASIV). „BUGETUL CLIENTULUI” a sarit 7.000 → 8.000 lei fara ca Ana sa-l atinga (e estimarea, nu bugetul clientului).
  Motivul de retragere „Cererea a fost modificata dupa preluare” devine activ; l-am folosit: REFUND 7 (WITHDRAWAL_REQUEST_MODIFIED_POST_CLAIM), fara penalizare. TRECUT.

### SA-06 + SA-05 — jurnal (aceeasi cerere `7484a655…`, Pantofar 3D, 3 credite)
- La reintrarea pe `/requests/new` apare dialogul „Ai o cerere inceputa … Continua de unde am ramas” pentru o ciorna **goala** (doar modul ales, cos gol).
- owner.a preia, atribuie, oferta 1 = 2.400 RON. „Retrage oferta” → dialog: „…trimite o oferta noua pana la **18 nov. 2026, 11:59**, altfel preluarea expira si pierzi 3 credite. **Firma primeste si 3 puncte de penalizare.**”
  Dupa retragere fisa arata termenul „**17 nov. 2026, 23:59**” (contradictie cu dialogul); punctele nu s-au aplicat (12 → 12) — fraza din dialog suna ca si cum retragerea insasi aduce 3 puncte.
- Formularul revine la „Varianta 1 din cel mult 3”; oferta retrasa nu mai apare nicaieri la firma.
- Ana (dupa retragere): „A Mobila Premium **nu a trimis inca o oferta**” — fals, ea primise deja e-mailul „Oferta noua…”. Fara e-mail / notificare de retragere.
- Oferta noua 2.200 RON = quote nou (`fb8bc9c3…`), afisat tot „Versiunea 1”; clientul nu vede ca inlocuieste una retrasa (pretul a scazut 2.400 → 2.200 fara istoric). A doua e-mail „Oferta noua”. Limita de retrageri nu am testat-o.
- SA-05 „Sterge cererea…”: confirmarea e un **`window.confirm()` nativ al browserului** — „Sigur stergi cererea? Preluarile active ale firmelor vor fi anulate.” Nu spune ca e definitiv, ce se intampla cu ofertele primite si conversatiile, nici ca firmele sunt anuntate.
  (Playwright inchide automat confirm-urile native, de aceea primele click-uri pareau sa nu faca nimic.) Dupa OK: redirect la „Cererile mele”, **fara mesaj de succes**.
- DB: request `deleted_at` setat dar `status` ramas **OFFERS_RECEIVED**; slot CANCELLED_BY_CLIENT, REFUND 3 (REQUEST_DELETED_BY_CLIENT) — creditele firmei revin (237/67 → 240/64).
- Firma: fisa „ANULATA DE CLIENT — Clientul a sters aceasta cerere”, dar propria oferta apare „**Versiunea 1 · Retrasa**” (firma nu a retras-o). Notificare de tip `claim.withdrawn` (nu „cerere stearsa”), **niciun e-mail**.
  In „Mesaje”: „Anulata de client · doar citire” (bun).

### SA-07 — jurnal (mgr.a vs owner.a; partial)
- mgr.a are acelasi meniu ca owner.a (Panou, Marketplace, Preluari, Mesaje, Portofel, Firma mea, credite in antet). Poate prelua (SA-02), poate pune pret si moneda (SA-02), vede portofelul cu butoanele „Cumpara” / „Activeaza” planuri.
- „Firma mea” la manager: poate „Schimba rolul” / „Elimina…” orice membru in afara de proprietar si poate adauga **alt Manager**; tabelul „Permisiuni pe campurile ofertei” e doar citire (corect: „Doar proprietarul…”).
  Permisiuni implicite: Pret = doar Proprietar + Manager; angajatul coordonat nu poate edita nimic din oferta.
- Manager deschide preluarea SA-02 atribuita Elenei: vede datele clientului si poate scrie clientului (conform textului „proprietarul, managerii si angajatii cu acces complet”).
- „Echipa firmei” (`/marketplace/messages`): conversatie interna, mesajul trimis apare imediat; nu pleaca e-mail.
- Lista „Mesaje” arata titluri brute din datele demo: „KITCHEN Bucuresti”, „BATHROOM Timisoara”, „KITCHEN Cluj” (enum netradus, fara diacritice).
- Nu am testat cu un cont de angajat (parola demo nu merge la trusted*/managed.a; resetarea ar fi cerut inca un login in limita de 5/min) — **„ce vede un coleg care nu e responsabil” NU e verificat in interfata**.
  Indiciu: e-mailurile „Mesaj nou” si „Oferta ta a fost acceptata” ajung si la angajatul coordonat Elena, care nu era responsabila (fara continutul mesajului, cu link generic `/marketplace/messages`).

## 2. Constatari

**SA-01 · P1 · defect / UX · Un login nou deconecteaza toate celelalte sesiuni ale contului**
Unde: `apps/backend/src/modules/auth/token.service.ts:37` (`issueNewFamily` revoca toate refresh-tokenurile utilizatorului); vizibil la publicare (`POST /requests/drafts/<t>/publish` → 401).
Ce se intampla: in 90 de minute sesiunile mele Ana si owner.a au fost revocate de 3 ori de logari paralele pe acelasi cont (alti agenti). Clientul a apasat „Publica cererea” si a primit doar „A aparut o eroare neasteptata. Incearca din nou.”; firma a vazut „Nicio cerere disponibila momentan.”
Ce ar trebui: mai multe sesiuni concurente pe cont (telefon + laptop, mai multi oameni ai firmei pe contul proprietarului), sau macar mesaj „Te-ai autentificat pe alt dispozitiv — intra din nou” + redirect la login cu revenire.
Dovada: `shots/SA/SA-01/18-ana-18-publish-401-error.png`; tabel `refresh_tokens` (familii noi la 18:55:57, 19:30:27 pentru Ana; 19:29:46, 19:32:02 pentru owner.a) fara rotatii. Propunere: nu revoca la login; limita de N sesiuni; tratarea 401 global → pagina de login.

**SA-02 · P1 · defect · Pe 401 paginile firmei spun „Nicio cerere disponibila momentan”**
Unde: `/ro/marketplace/<id>` cu sesiune expirata (SA-03). Ce se intampla: API 401 „Missing access token”, ecranul pretinde ca nu exista cereri. Ce ar trebui: redirect la login / mesaj de sesiune expirata. Dovada: `shots/SA/SA-03/09-oa-08-preclaim-own-project.png`.

**SA-03 · P1 · lipsa functie · Clientul nu poate refuza o oferta**
Unde: `/ro/requests/<id>/offers`; backend `quotes.controller.ts` nu are endpoint de refuz pentru client. Ce se intampla: doar „Cere modificare” si „Accepta oferta…”. Ana a scris refuzul in chat; cererea ramane NEGOTIATION, slotul OFFER_SENT, 9 credite rezervate pana la expirare (19 nov). Ce ar trebui: „Refuza oferta” cu motiv, firma anuntata, slot eliberat. Dovada: `shots/SA/SA-02/20-ana-19-client-variant2.png`.

**SA-04 · P1 · UX · Variantele ofertei nu se pot compara; v1 dispare**
Unde: SA-02, ambele parti. Ce se intampla: dupa v2 se vede doar „Versiunea 2”, la client si la firma; comparatorul „Ofertele, una langa alta” compara doar firme. Ce ar trebui: istoric v1/v2 cu diferente (pret, termen, descriere). Dovada: `shots/SA/SA-02/18-mga-18-variant2-sent.png`, `20-ana-19-client-variant2.png`.

**SA-05 · P1 · defect · Fisierele (inclusiv PDF-ul „proiectului propriu”) nu apar firmei inainte de preluare**
Unde: `/ro/marketplace/<id>` in SA-01 (PNG) si SA-03 (PDF), desi formularul spune „Fisierele sunt vizibile firmelor verificate din zona ta inainte de preluare”. In modul „Am deja un proiect” e chiar documentul dupa care firma decide. (Confirma M-10.) Dovada: `shots/SA/SA-03/10-oa-10-preclaim-own-project.png`.

**SA-06 · P1 · UX · Dupa acceptare clientul nu primeste nicio data de contact a firmei**
Unde: `/requests/<id>/offers` dupa „Da, accept oferta” (SA-01). Firma vede numele, e-mailul si adresa clientului; clientul vede doar numele firmei si conversatia. „Ce urmeaza?” ii spune sa stabileasca „masuratori, contract, avans” — fara telefon / e-mail / adresa firmei. Dovada: `shots/SA/SA-01/41-ana-41-after-accept.png`.

**SA-07 · P1 · UX · Dupa acceptare nu exista etape de executie; livrarea se poate marca imediat**
Unde: fisa firmei SA-01. Doar „Marcheaza ca livrata” + „Proiectul s-a blocat?”. Firma a marcat livrarea la 1 minut dupa acceptare (termen 6 saptamani), fara avans / contract / programare. Propunere: etape minime (masuratori, contract semnat, in productie, montaj programat) si blocarea „livrata” inainte de o data rezonabila sau cu confirmare suplimentara.

**SA-08 · P2 · defect · „Confirma livrarea” la client finalizeaza fara confirmare si fara alternativa**
Unde: `/requests/<id>/offers` in starea DELIVERED_BY_COMPANY. Un singur click → COMPLETED + creditele firmei consumate. Firma are dialog „nu se poate anula”, clientul nu. Lipseste „Nu am primit / am o problema” langa buton. Dovada: `shots/SA/SA-01/48-ana-48-confirm-dialog.png` (dialog gol), DB `requests.status=COMPLETED`.

**SA-09 · P2 · defect · Antetul fisei firmei ramane „OFERTA TRIMISA” dupa acceptare si dupa livrare**
Unde: `/marketplace/claims/<id>` (SA-01); `claim_slots.status` ramane OFFER_SENT. Abia la COMPLETED devine „FINALIZATA”. Tot acolo ramane „TERMEN PENTRU OFERTA (SLA) — Oferta a fost trimisa” si dupa livrare; nu apare „Livrata — asteapta confirmarea clientului”. Dovada: `42-oa-42-firm-after-accept.png`, `45-oa-45-firm-delivered.png`.

**SA-10 · P2 · UX · Clarificarea: intrebarea si raspunsul dispar la client; nicio notificare la firma; niciun e-mail**
Unde: SA-01. Ana raspunde in „Intrebari de la firme”, apoi blocul dispare (nu intra nici in conversatie). Firma nu primeste nimic cand vine raspunsul (doar il gaseste in fila Clarificari). Clientul nu primeste e-mail cand firma intreaba. Pagina cererii spune doar „O firma pregateste oferta”. Dovada: `34-ana-34-respond-page.png`, `35-ana-35-clarif-answered.png`, `36-oa-36-clarif-answered-firm.png`.

**SA-11 · P2 · defect · Pauza de clarificare muta termenul firmei dupa expirarea cererii**
Unde: SA-01. SLA 19 nov 23:59 → dupa o clarificare de 2 minute → 21 nov 00:00 (regula „+1 zi lucratoare”, docs/03:135), dar cererea expira 19 nov 23:59. De verificat ce se intampla la expirare cu o preluare al carei termen e mai tarziu.

**SA-12 · P2 · UX · Editarea dupa preluare nu anunta firma si nu arata ce s-a schimbat**
Unde: SA-04. Material MDF vopsit → Lemn masiv dupa preluare: zero notificari, zero e-mailuri, nicio evidentiere in fisa. Singurul semn: motivul de retragere „Cererea a fost modificata dupa preluare” devine activ. Salvarea ultimei editari nu cere confirmare. Propunere: notificare + e-mail + „Ce s-a schimbat” in fisa.

**SA-13 · P2 · UX · Firma nu poate schimba moneda la varianta 2; formularul de varianta e gol**
Unde: SA-02, „Raspunde cu o varianta noua”. Clientul a cerut pret in lei; v1 era EUR; formularul v2 nu are campul „Moneda” si nu e precompletat din v1. Dovada: `17-mga-17-firm-sees-change-request.png`.

**SA-14 · P2 · UX · Clientul nu vede propria cerere de modificare; firma nu e anuntata prin e-mail**
Unde: SA-02. Dupa „Trimite cererea de modificare” textul dispare (doar „Astepti raspunsul firmei…”). Firma: doar `quote.updated` in clopotel. Pentru v2 clientul nu primeste e-mail.

**SA-15 · P2 · UX · Dupa o cerere de modificare cererea iese din marketplace**
Unde: SA-02, NEGOTIATION: „Cererea nu mai apare in lista firmelor, deci firme noi nu o mai pot vedea” cu 2 locuri libere din 3. Clientul pierde concurenta pentru ca a negociat cu prima firma. De verificat daca e intentionat (docs/03).

**SA-16 · P2 · text · Retragerea ofertei: dialogul contrazice fisa si sugereaza penalizare imediata**
Unde: SA-06. Dialog: termen nou „18 nov. 2026, 11:59” + „Firma primeste si 3 puncte de penalizare”; fisa: „17 nov. 2026, 23:59”; punctele nu s-au aplicat. Clientul vede „nu a trimis inca o oferta”, oferta noua e tot „Versiunea 1”.

**SA-17 · P2 · UX · Stergerea cererii foloseste `window.confirm()` nativ, fara consecinte explicate; firma vede „Retrasa”**
Unde: `apps/frontend/src/app/[locale]/requests/[id]/page.tsx:341`. Textul nu spune ca e definitiv si ce se intampla cu ofertele si conversatiile; fara mesaj de succes. La firma oferta apare „Versiunea 1 · Retrasa”, notificare `claim.withdrawn`, fara e-mail. In DB `status` ramane OFFERS_RECEIVED cu `deleted_at` (de verificat rapoartele / filtrele care citesc doar `status`).

**SA-18 · P2 · UX · Firma renunta la preluare: clientul nu afla si i se spune „Nicio firma inca”**
Unde: SA-03. Fara notificare sau e-mail; caseta „Nume, adresa si date de contact” revine la „Nicio firma inca — le primeste doar firma care preia cererea”, desi firma A le-a vazut.

**SA-19 · P2 · UX · „Am deja un proiect” cere 11 raspunsuri obligatorii**
Unde: SA-03, Dormitor (Dulap + Pat + Noptiere): usi, saltea, depozitare, tapitat, numar, material si „Deschidere” pentru fiecare piesa (inclusiv „Deschidere — pat”). Contrazice promisiunea modului. Propunere: optionale sau „vezi proiectul atasat”.

**SA-20 · P2 · defect · Atribuire esuata in tacere (409)**
Unde: SA-03, imediat dupa preluare, `POST /claims/<id>/assign` → 409, selectul revine la „Neatribuit” fara mesaj. Ramas asa, preluarea se anuleaza automat in 59 min. De verificat cauza.

**SA-21 · P2 · defect · Clientul primeste notificari despre propriile actiuni**
Unde: clopotelul Anei: `message.created` cu `senderRole=CLIENT` (mesajul ei), `quote.accepted` (acceptarea ei). Dovada: `/api/v1/notifications` in SA-02.

**SA-22 · P2 · text · Dimensiuni gresite / inventate pe cardul camerei**
Unde: pagina cererii + marketplace. Bucatarie L 320+240 → „5.6 × 0.6 × 2.6 m”; Dulap „2.4 × 0.6 × 2.6 m” langa „240 × 260 × 60 cm” (alta ordine si unitate); Dormitor „0.9 × 0.6 × 2.6 m” (din saltea?). Plus randuri inventate: „Dulap pana in tavan (tip dressing)”, „Pat tapitat — PAL — MANER”.

**SA-23 · P2 · text · „Bugetul clientului” la firma = estimarea automata, nu bugetul**
Unde: fisa firmei: SA-01 „39.000 lei” cand clientul a ales treapta „Peste 15.000”; SA-04 sare 7.000 → 8.000 dupa o editare fara ca clientul sa atinga bugetul. In marketplace aceeasi cerere arata doar „Peste 15.000 RON”. Propunere: „Estimare din raspunsuri” separat de bugetul ales.

**SA-24 · P2 · UX · Niciun e-mail la publicare; e-mailurile firmei merg la toti membrii**
Cererea publicata nu genereaza e-mail catre client. „Mesaj nou” si „Oferta ta a fost acceptata” pleaca la toti cei 5 membri ai firmei A, nu la responsabil; link generic `/marketplace/messages`. La finalizare / recenzie firma nu primeste e-mail.

**SA-25 · P2 · defect (de verificat) · 500 pe `POST /claims` sub incarcare**
SA-02: primul „Da, preiau cererea” → 500 + socket.io 500 (CPU 82%, RAM 1,5 GB liber; probabil repornirea backendului dev). Mesajul „A aparut o eroare. Incearca din nou.” a fost corect; a doua incercare a mers.

**SA-26 · P2 · defect (de verificat) · Butoanele „Editeaza cererea” nu au navigat la primul click**
SA-04: dupa preluare, 3 click-uri fara efect; `/edit` direct a mers. Posibil artefact Playwright / hidratare; de verificat de mana.

**SA-27 · P3 · text · Data in format american in romana**
„Valabila pana la 11/26/2026” (dialog de acceptare), „Acceptata pe 11/12/2026” (Acordul vostru, ambele parti), campul `mm/dd/yyyy` in formularul de oferta, desi contextul are `locale=ro-RO`.

**SA-28 · P3 · text · Termeni amestecati**
„Varianta 1 din cel mult 3” vs „Versiunea 1”; „comanda” (dialog livrare, „Comanda livrata”) vs „cerere” vs „lucrarea”; status client „PRELUATA PARTIAL”; subtitlu „Bucatarie — Bucuresti — Bucuresti”; „5.000 – 15.000 RON” pentru doua noptiere de 7.000 estimat.

**SA-29 · P3 · UX · Fisierul la firma pierde numele**
SA-03: „proiect-dormitor-test.pdf” apare la firma ca „attachme….pdf”; la client „proiect-….pdf” (taiat). Captura 3D apare la „Atasamente” si e numarata „un fisier atasat” in sumarul editarii.

**SA-30 · P3 · UX · Recenzia nu apare in fisa firmei si nu e anuntata prin e-mail**
SA-01: dupa COMPLETED fisa firmei arata „Clientul a acceptat oferta.”, fara „Livrare confirmata” si fara recenzie.

## 3. Ce NU am acoperit
- SA-07: vederea unui angajat nelegat de preluare (fara parola pentru trusted* / managed.a); limitarile reale ale managerului la cumparare (n-am apasat „Cumpara”).
- SA-06: cate retrageri / oferte noi sunt permise (am facut una).
- „Proiectul s-a blocat?” (disputa) si expirarea automata dupa 14 zile — neapasate.
- E-mailurile nu le-am deschis pe toate; am verificat corpul pentru „preluata”, „Mesaj nou” si „Oferta acceptata” (linkurile duc la `localhost:3000`, corect local).

## 4. Top 10
1. Sesiuni multiple pe cont + tratarea 401 cu redirect la login (SA-01, SA-02).
2. Fisierele / PDF-ul proiectului vizibile firmelor inainte de preluare, cum promite formularul (SA-05).
3. Buton „Refuza oferta” pentru client, cu eliberarea locului si anuntarea firmei (SA-03).
4. Datele de contact ale firmei catre client dupa acceptare (SA-06).
5. Etape dupa acceptare (masuratori, contract, productie, montaj) + confirmare si „am o problema” la livrare (SA-07, SA-08).
6. Istoric si comparatie a variantelor ofertei; moneda si precompletare la v2 (SA-04, SA-13).
7. Notificari + e-mail la evenimentele lipsa: clarificare ceruta / raspunsa, editare dupa preluare, renuntare la preluare, retragere oferta, stergere cerere, varianta noua (SA-10, SA-12, SA-14, SA-17, SA-18).
8. Stari corecte in fisa firmei (Acceptata / Livrata — asteapta confirmarea) si la client dupa retragerea ofertei (SA-09, SA-16).
9. „Am deja un proiect” fara intrebari obligatorii redundante (SA-19).
10. Dimensiuni si buget afisate corect (ordine L×I×A in cm, fara randuri inventate, „estimare” vs „buget”), date in format romanesc (SA-22, SA-23, SA-27).
