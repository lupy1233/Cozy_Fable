<!-- Product Bible Master v6 — Reguli business consolidate. Sursa de adevar. Ierarhie la conflict: invariante (02) > decisions log (07) > reguli business (03). Nu ghici: marcheaza DECIZIE NECESARA si opreste-te. -->

# 4. Reguli business consolidate

*Toate deciziile (refinement v5 + finale v6) sunt INTEGRATE direct în reguli. Rationale-ul fiecărei decizii e în Secțiunea 8.*

## 4.1 Formular cerere

Formular generic structurat pe camere și piese. Câmpuri (derivate din categoriile de scoring, 4.5): pentru fiecare cameră — tip (bucătărie/dressing/living/birou/dormitor/baie) + dimensiuni; pentru fiecare piesă — material (PAL/MDF/lemn masiv), sisteme (push/glisante/buton presiune), descriere, cantitate; plus buget orientativ, termen dorit, atașamente (max 10), localitate + adresă (geocoded). (actualizat 2026-11-13, etapa 3: bugetul e o sumă aleasă de client pe glisor sau „Prefer să nu spun”, fără trepte pe ecrane — vezi actualizarea etapei 3 de mai jos.)

- Opțiunea „Am deja un proiect” — clientul atașează proiectul propriu.

- **Opțiunea „Proiectare contra cost” (D-v6-11, înlocuită parțial la 2026-11-13 de D-E2-1): **din 2026-11-13 nu mai e o bifă separată pe cerere: ajutorul se cere pe cameră, iar requests.includes_paid_design e derivat de server (true dacă măcar o cameră are request_rooms.needs_design_help) — vezi actualizarea etapei 2 de mai jos. Firma include în ofertă o linie separată de preț (quote_versions.design_fee, nullable). NU există flux de plată separat în MVP — design fee face parte din oferta acceptată. Actualizat 2026-11-13, etapa 4 (PO g0-11, D-E4-6): la cererile cu proiectare, pretul proiectarii si „ce include proiectarea” (quote_versions.design_includes) sunt obligatorii in oferta, iar pretul mobilierului ramane in aceeasi oferta, ca estimare (4.13).

- Draft anonim cu token — clientul poate începe fără cont; cererea e nepublicată și recuperabilă.

Actualizare 2026-11-13 (etapa 1, b1 + b5): câmpurile de dimensiuni (pașii camerelor și configuratorul 3D) acceptă virgula și punctul ca separator zecimal („1,6” rămâne 1,6) și afișează valorile cu virgulă în română; ce se salvează e tot număr. Textul care nu e număr arată „Scrie un număr, de ex. 2,5” și nu se scrie în răspuns. În 3D, o valoare în afara intervalului piesei e refuzată cu mesaj lângă câmp și rămâne valoarea anterioară (nu se mai ajustează pe tăcute la limită; alegere măruntă b1, docs/07). Atașamentele: 10 la nivel de cerere + 8 pe cameră (invarianta 3.4); fișierele refuzate (tip, gol, peste 25MB, limită atinsă, scanare, rețea) apar sub zona de încărcare cu numele și motivul, iar pasul general arată câte locuri au mai rămas.

Actualizare 2026-11-13 (etapa 2, b8; PO g0-8, b8-2, b8-3 — docs/07 D-E2-1 … D-E2-3):
- **Ajutorul se cere pe cameră (g0-8).** Fiecare cameră din coș are bifa „La camera asta am nevoie de ajutor”. Cererea e „cu proiectare” (requests.includes_paid_design, derivat de server) când măcar o cameră e bifată; bifa „Include proiectare cu plată” de la Date generale a dispărut. Modul „Am nevoie de ajutor” = toate camerele bifate (camerele adăugate în acest mod pornesc bifate; dacă bifezi toate camerele, cererea trece în „Am nevoie de ajutor”, iar o debifare în acest mod o trece în „Știu ce vreau”). În „Am deja un proiect” bifa nu există; serverul refuză proiect propriu + cameră bifată (400, `validation.designHelpWithOwnProject`).
- **O singură sursă pentru mod (b8-2).** Modul se alege doar la pornire; bifa „Am deja un proiect pentru toată locuința” din coș a dispărut, în locul ei e linia „Mod: … · Schimbă”. Alegerea modului setează împreună „am proiect” și bifele camerelor. La editare modul se citește din cerere (`hasOwnProject` + bifele camerelor), nu se ghicește; nu există coloană `requests.start_mode`.
- **Ce pleacă la firme dintr-o cameră bifată (b8-3).** Camera bifată sare întrebările și pleacă doar cu tipul, schițele ei (pașii de încărcare vizibili) și mesajul cererii; nu pleacă nici imaginea 3D (`snapshot3d`). Răspunsurile date înainte de bifă rămân doar în ciorna clientului și reapar dacă debifează; la trecerea pe ajutor, o cameră cu răspunsuri cere confirmare într-un dialog. Serverul relaxează verificarea doar pentru camerele bifate; camerele nebifate se verifică strict, pe orice drum. Firma vede pe cardul camerei bifate „Clientul cere ajutor la proiectare pentru această cameră”.
- **Piesele din Studio 3D** nu pot fi bifate „am nevoie de ajutor” (sunt deja configurate): în coș au o notă în locul bifei, „Am nevoie de ajutor” nu le bifează, iar o cerere cu astfel de piese nu poate fi în modul „Am nevoie de ajutor”. Serverul refuză piesa din Studio bifată (400, `validation.designHelpWithStudioPiece`). Aleasă de coordonator, de confirmat de PO (D-E2-12).
- **Reprezentarea veche** (alese de coordonator, de confirmat de PO — D-E2-10, D-E2-11): o cerere existentă „cu proiectare” fără nicio cameră bifată își păstrează proiectarea la editare până când clientul bifează o cameră; un formular deschis dinainte de lansare (interfața veche, fără bifa pe cameră) care trimite proiectarea cu plată bifează doar camerele care nu trec validarea strictă, iar camerele complete își păstrează răspunsurile.
- Costul în credite nu s-a schimbat în etapa 2: o cameră bifată contează ca o cameră fără răspunsuri. (actualizat 2026-11-13, etapa 3: camera bifată nu mai primește piese puse din oficiu, deci costă mai puțin — PO d1-1, vezi actualizarea etapei 3 de mai jos și docs/07 D-E3-4.)

Actualizare 2026-11-13 (etapa 2, b2 / b3 / b6 / b4 / f2):
- **Date generale (b2):** ce scrie clientul la Date generale (mesaj, adresă, contacte, termen, buget) se salvează automat în ciornă, fără validare, și rămâne după „Înapoi”, reîncărcare și schimbarea limbii. Validarea strictă rămâne la „Continuă la sumar”.
- **Publicarea (b3):** după „Publică cererea” clientul vede doar „Se publică…”, apoi pagina cererii cu mesajul „Cererea a fost publicată.”; `/requests/new` pornește apoi gol, fără „Continui?”. Când salvarea ciornei pe server eșuează, lângă „Ciornă salvată doar pe acest dispozitiv” apare „Reîncearcă”.
- **Scoaterea unei camere (b6):** o cameră fără răspunsuri se scoate pe loc; o cameră cu răspunsuri sau schițe cere confirmare („Scoți {cameră}?”, cu numărul de răspunsuri și fișiere; „Păstrează” e implicit). „−” scoate întâi o cameră goală; dacă toate au răspunsuri, dialogul spune care se scoate. Schițele camerei scoase se șterg de pe ciornă (la editarea unei cereri publicate, după „Salvează modificările”) și nu mai apar la „Fișierele proiectului”.
- **Întoarcerea la ciornă după confirmarea e-mailului (b4):** clientul care își face cont din Sumar primește în linkul de confirmare întoarcerea la `/requests/new`; după confirmare, „Mergi la autentificare” duce la login și apoi înapoi la formular. Rezerva pe același dispozitiv: dacă browserul are o ciornă nepublicată, pagina de confirmare duce tot acolo, iar Panoul clientului arată cardul „Ai o cerere gata de publicare — Continuă”. Ciorna pe alt dispozitiv rămâne pentru problema 32.
- **Doar clienții publică (f2):** o cerere se publică doar dintr-un cont de client; o firmă sau un admin primește refuz (403 `REQUEST_PUBLISH_CLIENT_ONLY`) și vede, pe `/requests/new` și în Sumar în locul butonului, nota „Cererile se publică dintr-un cont de client.” cu „Ieși din cont”. O ciornă anonimă se leagă doar de un cont de client.

Actualizare 2026-11-13 (etapa 3, b11 + d1; PO b11-1 / b11-2 / b11-3, g0-9, d1-1 — docs/07 D-E3-1 … D-E3-13):
- **Bugetul se alege, nu se pune din oficiu (b11-1 + g0-9).** La Date generale glisorul pornește fără cursor și fără sumă („Alege suma”). „Continuă la sumar” cere o sumă pe glisor sau bifa „Prefer să nu spun” (altfel: „Alege o sumă sau bifează „Prefer să nu spun”.”); debifarea „Prefer să nu spun” readuce starea „neales”. Formularul nu mai pune minimul estimării și nici „Sub 5.000” în modul „Am nevoie de ajutor”. Ciornele vechi cu bugetul pus de formular îl pierd la încărcare și cer alegerea din nou (o ciornă veche ajunsă la Sumar se întoarce la Date generale); la editarea unei cereri publicate, suma rămâne aleasă doar dacă a fost declarată de client (`budget_declared`), altfel se cere din nou („Prefer să nu spun” rămâne).
- **Glisorul coboară sub estimare, cu avertisment (b11-2).** Scara merge de la o treime din estimarea minimă (rotunjit la 500 lei) până la plafonul estimării (de 3 ori minimul), pas 500 lei; estimarea apare ca reper pe scară („Estimare: …”). Sub estimare apare nota: „Suma aleasă e sub estimarea din răspunsurile tale. Sunt șanse mici ca mobilierul să se încadreze în acest buget, iar firmele vor ocoli mai probabil cererea.” Fără estimare (modul „Am nevoie de ajutor”, scor 0) scara e fixă: 1.000–100.000 lei, pas 500 (aleasă de agenți, de confirmat de PO — D-E3-6).
- **Aceeași sumă peste tot, fără trepte pe ecrane (b11-3).** Sumarul, pagina cererii, lista și detaliul din piață și fișa de lucru arată suma în lei („12.000 lei”) sau „Buget nedeclarat” (și pentru „Prefer să nu spun”); rândul „Bugetul tău estimat” din Sumar a dispărut. „lei” și în interfața în engleză („12,000 lei”). Treapta (`budget_range`) rămâne doar internă, pentru punctaj; mărimea proiectului nu scade când clientul declară o sumă sub estimare (treapta = cea a lui max(suma, minimul estimării) — D-E3-13, vezi 4.5); costul în credite nu se schimbă. Serverul refuză o sumă sub 500 lei și „declarat de client” fără sumă (400, `validation.budgetRequired`).
- **Ce vede firma.** Firma primește suma doar dacă e declarată de client (`budget_declared = true`): „Bugetul declarat de client: X lei”. Altfel serverul nu trimite nicio sumă și firma vede „Buget nedeclarat” — la „Prefer să nu spun”, la cererile vechi doar cu treaptă și la toate cererile publicate înainte de etapa 3 (`budget_declared = false`, chiar dacă au sumă salvată; D-E3-8). Pe detaliul din piață, doar lângă o sumă declarată: „Estimare din răspunsuri: X lei” (reper calculat la citire, cu formula clientului și ponderile de azi) și, dacă e cazul, „Sub estimarea din răspunsuri”; estimarea nu apare în listă și nici pe fișa de lucru (D-E3-9). Clientul își vede în continuare suma salvată pe pagina propriei cereri (etichetă neutră „Buget”); adminul nu are azi un afișaj al bugetului.
- **Filtrul de buget minim al firmei.** În piață firma are glisorul „Buget minim” (0–200.000 lei, pas 1.000; „Oricare” la 0), filtrat pe server; cu un minim ales rămân doar cererile cu sumă declarată ≥ minim, iar cererile fără sumă declarată nu mai apar (D-E3-7, de confirmat de PO).
- **Estimarea de azi e doar reper.** Estimarea adevărată (după dimensiuni și materiale) va veni din aplicația de ofertare, integrată ulterior, în afara acestui plan de reparații; până atunci estimarea din punctaj rămâne doar reper pe glisor și la firmă.
- **Camerele cu „am nevoie de ajutor” nu primesc piese din oficiu (d1-1).** O cameră bifată pleacă la firme fără piese, materiale și dimensiuni (zero articole în `request_items`, dimensiuni 0); firma vede semnul de ajutor completat cu „Detaliile se stabilesc cu firma.” și antetul „Dimensiuni nespecificate”. Din punctaj dispar punctele pieselor puse din oficiu (material, sistem, cantitatea de articole); camera păstrează punctele de cameră (tip, mărime, cantitate — D-E3-11, de confirmat de PO). Deci cererile cu camere bifate costă mai puțin de preluat; cererile fără bife nu se schimbă. Exemplu (greutățile din seed, 1 punct = 1 credit; cerere cu bucătărie v3 liniară 3 m, PAL, push + dormitor v2 cu dulap 2,4 m, MDF infoliat, glisant):

  | Cerere | Înainte | După |
  | --- | --- | --- |
  | Ambele camere bifate „am nevoie de ajutor” | 19 credite | 14 credite (−5) |
  | O cameră din două bifată (bucătăria) | 25 credite | 21 credite (−4) |
  | Nicio bifă | 32 credite | 32 credite (neschimbat) |

  Pe cameră: bucătăria bifată costa 13 puncte, acum 9; dormitorul bifat costa 6, acum 5. Previzualizarea costurilor din Admin → Mărime proiect recalculează camerele bifate la fel ca publicarea.
- **Textele pieselor pentru firmă (d1).** Numele și descrierile generate sunt în română cu diacritice, cu „×” la dimensiuni, fără coduri interne (de ex. „6 locuri”, „TV pe perete”, „Interior: bare de agățat, rafturi…”, „polițe deschise (fără uși)” vs „culoare deschisă”); piesele poartă numele din chestionar („Insulă”, „Bancă cu ladă”, „Corp cu cuvă”, „Dulap de hol” — D-E3-12). Textele rămân în română și în interfața în engleză (D-E3-5). Antetul camerei nu mai arată „L × l × H”: „Mobilier: ~5,6 m liniari” doar când există și „Tavan: 2,65 m” doar dacă l-a dat clientul, altfel „Dimensiuni nespecificate”; piesele individuale nu mai au antet de dimensiuni. Excepție: camerele foarte vechi, din formularul manual (`answers` NULL), păstrează antetul „L × l × H m” cu dimensiunile scrise de client, cu virgulă în română („4,5 × 3,2 × 2,6 m”; „Dimensiuni nespecificate” dacă una e 0). În Sumar („Toate răspunsurile”) dimensiunile apar cu virgulă în română („2,5 m”). Textele se scriu la publicare, deci cererile deja publicate își păstrează textul vechi.

Actualizare 2026-11-14 (etapa 5, c10 + c3 + b7 + d3; PO c10-1, c10-2, c3-1, d3-2 — docs/07 D-E5-1, D-E5-2, D-E5-4, D-E5-9, D-E5-20 … D-E5-22):
- **„Altă piesă” (c10, partea fără versiune nouă).** Fiecare rând are „Detalii (opțional)” = descrierea piesei (max 2000, cu contor; firma o vede în descrierea piesei); numele arată limita de 150. Lista de material: PAL, MDF infoliat, MDF vopsit, MDF furniruit, Lemn masiv, Altul (la „Altul” clientul scrie materialul în „Detalii”); deschiderea: Mâner / Push / Uși glisante. Valorile vechi deja salvate rămân afișate, dar odată schimbate nu mai pot fi alese; validarea acceptă tot enum-ul. Dimensiunile (opționale, c10-1) vin în etapa 6. Cardurile din coș (comodă TV, bibliotecă, birou, pantofar) și subtitlul 3D al pantofarului spun doar ce se poate alege azi (c10-2).
- **„Glisante” (c3, partea fără versiune nouă).** Opțiunea comună de deschidere se numește „Uși glisante (culisante)” („Sliding doors” în engleză), fără sertare în descriere. Întrebarea unică despre uși (c3-1: „Ce uși are dulapul?” + mâner / push doar la batante) vine în etapa 6.
- **Pasul 3D (b7).** Regulile geometrice nu mai șterg alegerile clientului: ce nu încape (bare de haine, sertare, polițe, casetiere, uși glisante, coloane) se scoate doar din configurația salvată și revine când regula nu mai e încălcată, în aceeași sesiune a pasului (la reîncărcare se pornește de la ce e salvat). Ce s-a scos are motivul scris (bara → adâncime / înălțime, sertare → peste 160 cm, polițe → minim 10 cm între ele, casetiere → lățime, uși glisante → doar 2–3 coloane), la fel opțiunile ascunse și butoanele „−” / „+” dezactivate. Câmpurile de dimensiune (lățime, înălțime, adâncime, lățime coloană, înălțime rând) corectează valoarea din afara limitelor la limită, cu mesaj („Minimul e 60 cm — am pus 60”); câmpul golit păstrează valoarea veche („Am păstrat valoarea anterioară”); o valoare sub 10 scrisă cu virgulă sau punct se citește în metri („1,2” → 120 cm, „Am înțeles 120 cm”) doar când rezultatul intră în limitele câmpului („8,5” la înălțimea rândului rămâne 8,5 cm și e corectat la minim). Numerele de bare / polițe / sertare micșorate de geometrie au și ele explicație („Am lăsat 2 sertare: …”), iar pragurile din mesaje vin din regulile reale. Asta înlocuiește, pentru câmpurile de dimensiune, refuzul din actualizarea etapei 1 de mai sus (D-E1-11 → D-E5-21); numărul de sertare / polițe rămâne refuzat cu mesaj.
- **Lungime aproximativă cu proiect propriu (d3-2).** Cu „Am deja un proiect”, o cameră al cărei pas de dimensiuni e sărit are pe ultimul ecran câmpul opțional „Lungime aproximativă (m)” (0,1–50 m, cel mult două zecimale — „2,345” arată mesaj, fără rotunjire); valoarea intră la mărimea camerei doar când dimensiunile lipsesc (4.5); gol = „sub 2 m”. Regula `approxLengthApplies` (după revizuire, D-E5-22): lungimea aproximativă contează doar cât camera are, cu răspunsurile de acum, un pas de dimensiuni în metri liniari și lungimea din dimensiuni e 0; altfel câmpul dispare, valoarea se golește, nu se trimite, nu se salvează și nu intră în cost. Ieșirea din modul „Am deja un proiect” o șterge; serverul o refuză fără proiect propriu (400, `validation.approxLengthWithoutOwnProject`). Firma vede „Lungime aproximativă: X m” pe cardul camerei.

Actualizare 2026-11-14 (etapa 6, c2 + c1 + c7 + c14 + a doua parte din c6 / c10 / c3; PO c2-1 … c2-3, c1-1 … c1-3, c7-1, c7-2, c14-1 … c14-3, c6-1, c6-2, c10-1, c3-1 — docs/07 D-E6-1 … D-E6-46; versiunile noi sunt cele curente din valul 3). Se aplică doar camerelor pe versiunile noi ale fluxurilor (toate cele 28 au versiune nouă; camerele adăugate după lansare). Cererile publicate și ciornele începute înainte rămân pe versiunea lor, cu regulile de mai sus (D-E6-15). Rândul „pentru fiecare piesă — material (PAL/MDF/lemn masiv), sisteme (push/glisante/buton presiune)” din primul paragraf se citește, pe versiunile noi, astfel:
- **Materialul = materialul fronturilor.** La corpuri (bucătărie, dressing, dulapuri, comode, birou, noptiere, biblioteci, baie, spălătorie, balcon, piesele ghidate cu 3D, bufet, corp suspendat, mobilier de hol / baie din catalog) întrebarea e „Material pentru fronturi (uși și sertare)”: PAL, MDF înfoliat, MDF vopsit, MDF furniruit, Lemn masiv, Altul, Nu știu — vreau recomandarea firmei. Corpul e PAL standard, scris sub întrebare; firma vede în descrierea piesei „Corp: PAL standard” (nu la „Integral din MDF”, „decide firma”, „Altă piesă”, la piesele alese „Fără uși sau sertare” și la piesele 3D fără fronturi — D-E6-38, D-E6-41). La piesele cu „Integral din MDF” subtitlul spune „De obicei corpul se face din PAL standard; dacă vrei și corpul din MDF, alege «Integral din MDF»”. Cine vrea alt corp scrie la „Altul” sau în detalii.
- **„Integral din MDF (corp și fronturi)”** există doar la piesele din baie, la banca și dulapul de balcon și la mobilierul de baie din catalog; se salvează ca MDF, cu nota „Corp și fronturi din MDF”.
- **Seturi proprii, fără preț pe metru liniar**: masa și patul — setul de lemn (Lemn masiv / Furnir de lemn natural / PAL cu decor lemn / Nu știu…, fără „Altul”); oglinda — rama (Fără ramă / Ramă din lemn / Ramă din MDF vopsit / Ramă metalică / Nu știu…); blatul de la spălătorie și balcon — setul de blaturi (PAL postformat / HPL / HPL compact / Cuarț / Lemn masiv / Nu știu…, fără „Recomandat”, fără deschidere). Rafturile, cuierul, rafturile de perete, banca ghidată și rafturile debaralei au lista de plăci (ca la corpuri, fără „Integral din MDF” și fără nota de corp), cu preț pe metru liniar.
- **Tapițatele** (canapea, fotoliu, taburet) nu au întrebare de material: cadrul îl alege firma (piesa: „Altul” + „Cadru: îl alege firma”).
- **Blatul bucătăriei** rămâne obligatoriu și primește „Nu știu — vreau recomandarea firmei”.
- **Deschiderea doar la piesele cu uși sau sertare.** Nu se întreabă la rafturi, cuier, rafturi de perete, măsuță, oglindă, blat, pat fără sertare (patul din dormitor are deschidere doar la depozitare cu sertare; patul din 3D niciodată), dressing fără uși. La birou, bibliotecă, masa de toaletă, banca de hol, banca de balcon, „altă piesă” din living și „Altă piesă” se întreabă cu opțiunea „Fără uși sau sertare”. Baia o întreabă acum pe fiecare piesă; dressingul doar la uși batante, pe ecranul materialului.
- **Listă unică**: Mâner / Push (fără mâner) / Nu știu — vreau recomandarea firmei; la bucătărie în plus Gola, iar la corpurile suspendate Aventos și „Rabatabilă, pe pistoane (în sus sau în jos)”; „pe pistoane” și la comoda TV din living și dormitor. Clientul poate bifa mai multe; „Fără uși sau sertare” și „Nu știu…” se aleg singure. „Pe pistoane” se salvează ca Aventos + notă (D-E6-16).
- **Ușile glisante sunt tip de uși, nu deschidere.** Dulapul din dormitor și cel din hol întreabă întâi „Ce uși are dulapul?”: la glisante piesa primește direct GLISANTE (intră în cost), la batante urmează deschiderea. La dressing la fel (`doorType`).
- **Piesele ghidate cu 3D**: deschiderea vine doar din 3D (o singură sursă, fără ecran separat); comoda TV ghidată, bufetul și corpul suspendat au pe ecranul materialului bifa „Unele uși se deschid în sus sau în jos, pe pistoane” (→ Aventos). O piesă 3D fără fronturi (toate zonele deschise) nu primește nici mâner / push, nici pistoane (D-E6-39).
- **„Nu știu — vreau recomandarea firmei”** la material, deschidere și blat, fără text obligatoriu. Firma vede nota în descriere („Material: clientul vrea recomandarea firmei”, „Deschidere: …”, „Ramă: …”, „Blat: …”) și, pe fișă, insigna „Recomandarea firmei” în locul lui „Altul” / „Deschidere: recomandarea firmei”.
- **Materialul și deschiderea pe un ecran.** Fiecare piesă are un singur ecran (cu întrebarea care o precede: tipul ușilor, depozitarea patului, câte noptiere), cel mult 3 întrebări (câmpul „Altul” nu se numără). Înlocuiește hotărârea PO din 2026-07-13 cu ecrane separate (D-E6-9). Bucătăria păstrează ecranul „Fronturi”, împărțit vizual pe zone (Corpuri de bază / Corpuri suspendate / Insulă).
- **Întrebarea comună.** În camerele cu cel puțin două corpuri cu fronturi bifate (nu la bucătărie, care are bifa „materiale diferite pe zone”, și nu la debara), pe ecranul listei de piese: „Același material și aceeași deschidere pentru toate piesele?”, cu două cartonașe Da / Nu, fără răspuns preselectat (la fel „Pat tapițat?” din dormitor — D-E6-42). „Da” = un ecran comun la final, copiat pe fiecare corp; „Nu” = câte un ecran pe piesă. Patul, măsuța, oglinda, rafturile și blatul au ecranul lor.
- **„Am deja un proiect”**: materialul și deschiderea rămân obligatorii (cu „decide firma”); doar dimensiunile și schițele se sar (regula din 2026-07-31 rămâne).
- **„Altă piesă”**: fiecare rând are Lățime / Înălțime / Adâncime opționale (cm, întregi 1–600), care ajung în descrierea piesei; materialul are „Nu știu…”; deschiderea e obligatorie: Mâner / Push / Nu știu… / Fără uși sau sertare (fără „Uși glisante”); „Detalii” max 1800. O dimensiune cu zecimale sau litere („12,5”) arată „Scrie un număr întreg de centimetri.” și blochează pasul; erorile apar lângă câmpul greșit (D-E6-43, D-E6-44).
- Fără versiune nouă (pe toate versiunile): subtitlurile de material / deschidere spun la ce parte se referă, „lei pe metru liniar” în loc de „lei/ml”, contor „x / 120” la „Altul”.

Actualizare 2026-11-14 (etapa 8, b10 + b9 + j1 + c4 + i1 + d2; PO c4-1, i1-1 … i1-3, d2-1 … d2-3 — docs/07 D-E8-1 … D-E8-40). Etapa schimbă cum ARATĂ formularul, Sumarul și fișa firmei; fluxurile versionate și textele generate pentru firme sunt neschimbate, pe toate versiunile, iar cererile vechi se afișează în noul format fără migrare. Excepțiile voite sunt la piesele 3D (mai jos).
- **Dimensiunile (c4-1, D-E8-1, D-E8-9, D-E8-10).** Se salvează ca până acum, în metri. Clientul le vede în unitatea aleasă la comutatorul m / cm / mm (implicit cm) în formular, în Fișa cererii, în Sumar și pe pagina cererii (aici unitatea vine din preferința ținută în browser; pe alt dispozitiv = cm). Firma le vede MEREU în centimetri (sloturi, tavan, antetul vechi „L × l × H”). Scrierea e aceeași peste tot: virgulă în română, punct în engleză, „×” între valori, fără zecimale inutile, cu aceeași precizie ca în câmp — până la 4 zecimale („245,5 cm”, „45,55 cm”, „120 × 80 × 40 cm”, interval „80–600 cm”; D-E8-35). Unitatea aleasă în formular e ținută minte și pentru pagina cererii (D-E8-36). Rămân în metri: metrii liniari de mobilier, lungimea aproximativă și prețurile „lei pe metru liniar”. Pasul 3D rămâne în cm. Salteaua: „90 × 200 cm”, „160 × 200 cm” (doar textul opțiunilor).
- **Fișa cererii și Sumarul (b10, D-E8-20, D-E8-29).** Etichete scurte de rezumat („Formă”, „Material fronturi — bază”), cu titlul întrebării ca rezervă; „Altul” + textul clientului pe un singur rând; rândurile fără denumire din „Altă piesă” nu apar; „Fișiere” = numărul fișierelor încărcate. O dimensiune în afara intervalului apare în Fișă cu roșu și „de corectat” (și pe schiță). Sumarul arată scurt piesele, materialele, deschiderile, configurația 3D, dimensiunile și primul ecran; „Vezi toate răspunsurile” adaugă doar restul. Numărătoarea: sus „Ecranul 3 din 12” (totalul doar când nu se mai poate schimba — D-E8-26), în Fișă „6 din 19 răspunsuri obligatorii”.
- **Mesajele de validare (b9, D-E8-28, D-E8-19).** La dimensiuni, fiecare câmp gol are „Completează câmpul „{câmp}”.” sub el, o valoare greșită are mesajul de interval, iar jos apare un rezumat („2 câmpuri necompletate.”). Răspunsul lipsă depinde de tipul întrebării („Alege o opțiune.”, „Alege cel puțin o opțiune”, „Adaugă cel puțin o piesă”, „Completează câmpul.”). „Altă piesă”: eroarea spune rândul („Piesa 2: …”); plafoane afișate: cantitate ≤ 999, cel mult 10 piese. Date generale: câmp gol → „Completează adresa / județul / orașul / emailul sau telefonul.”; „Mesaj pentru firme” ≤ 5.000 de caractere, cu contor. Sesiunea expirată la publicare: „Sesiunea a expirat — intră din nou în cont; cererea rămâne salvată.” + „Intră în cont”, cu întoarcere pe Sumar. Regulile de validare (schema comună) nu s-au schimbat; doar mesajele (pe server, slotul de dimensiune lipsă dă `validation.dimensionRequired` — docs/ERROR_CODES.md).
- **Telefonul (j1, D-E8-8, D-E8-23).** Sub `lg`, butoanele principale (Înapoi / Continuă, „Începe” în coș, „Publică cererea” în Sumar) stau într-o bară lipită jos; cardurile de opțiuni stau două pe rând; Fișa cererii e pliată; compararea ofertelor sub 640 px e pe carduri pe rubrică; scena 3D stă sus. Pe desktop nimic schimbat.
- **Piesele 3D — singura schimbare în ce se salvează (d2-2, d2-3, D-E8-6, D-E8-7, D-E8-13).** Piesele NOI (și „De la capăt”) pornesc cu ce se vede: dulapul cu uși batante pe toate zonele, comoda TV cu un sertar pe fiecare coloană; ciornele existente își păstrează configurația. O piesă cu fronturi (uși sau sertare) pentru care clientul n-a ales deschiderea salvează „Push”; firma vede „deschidere push” și sistemul PUSH, care se punctează (piesa costă cu 1–2 credite mai mult la preluare, 4.5 / 4.8). „Push” se scrie automat (la deschiderea pasului 3D) DOAR pe ciorne, inclusiv pe ciornele vechi redeschise; la editarea unei cereri publicate se scrie doar dacă omul schimbă ceva la piesă, deci o editare care nu atinge piesa nu schimbă nici costul, nici descrierea (D-E8-34). Cererile deja publicate NU se recalculează (la ele doar afișarea arată „Push”; descrierea salvată și costul lor nu îl includ). O piesă fără fronturi nu salvează nicio deschidere, iar selectorul „Deschidere fronturi” nu apare; „Batante” apare ales doar când piesa are uși. Mobilierul 3D (pat, masă, canapea, lavoar, hol) nu primește regula. Studio 3D pornește încă piesele din configurația veche (dulap fără uși — D-E8-40, de confirmat de PO).
- **Ce vede firma la piesa 3D (d2-1, D-E8-5, D-E8-11).** Rândul „Configurația piesei”: „Deschidere: Push / cu mâner” doar la corpurile cu fronturi, „Bază: soclu / picioare”, „Saltea: …”, „Depozitare: …”, „Persoane: …”, culoarea ca nume aproximativ + mostră (nu cod hex). Când lățimea, înălțimea și adâncimea sunt exact cele de pornire: insigna „Dimensiuni orientative — clientul nu le-a modificat” (calculată la afișare, fără coloană nouă).
- **Cuvintele (i1).** Textele urmează glosarul `docs/glosar.md` (vezi 4.20).

**CONFIRMAT (D-v6-2): **câmpurile exacte ale formularului se finalizează de către agent în Sprint 0, împreună cu seed-ul de scoring, și se prezintă utilizatorului pentru revizuire. Structura de mai sus e baza obligatorie.

## 4.2 Partajare date contact (W1, 2026-07-15)

Regula actuala aprobata in [feedback PO r6, W1](archive/16-feedback-po-r6-sprints.md#w1--context-post-claim-complet-backend) inlocuieste cele cinci optiuni istorice D-v6-1. Contactele furnizate in cerere sunt vizibile numai firmei cu un claim ocupant (`ACTIVE`, `OFFER_SENT`, `COMPLETED`). Retragerea sau anularea elimina accesul. Verificarea se face in API, nu doar prin ascunderea UI.

Clientul alege canalele furnizate (email/telefon); materialele si scenele 3D de proiect nu sunt date de contact si urmeaza autorizarea detaliului de proiect.

Actualizare 2026-09-30 (E-company-3): in interiorul firmei, un membru `EMPLOYEE_MANAGED` vede contactele si adresa completa doar pe preluarile luate de el sau atribuite lui (OWNER/MANAGER/EMPLOYEE_TRUSTED le vad pe orice claim ocupant). O firma al carei claim nu mai e ocupant vede doar un rezumat (titlu, localitate, statusuri, ofertele proprii), fara materiale, raspunsuri, scene 3D, chat sau contacte; dupa ce clientul sterge cererea ramane doar o „piatra funerara" (titlu, statusuri, oferta proprie). Doua comutatoare in `system_settings`, ambele DECIZIE NECESARA PO: `claim_contact_reveal_policy` (implicit `ON_CLAIM` = regula W1 de mai sus; `AFTER_GRACE` ascunde contactele in primele 30 min de gratie) si `completed_claim_contact_retention_days` (implicit 0 = fara prag; N > 0 = la N zile dupa livrare, contactele proiectelor finalizate raman doar la OWNER/MANAGER).

Nota de implementare 2026-10-01 (E-admin-platform-45, F2-16): regula se aplica si datelor de contact scrise de client in texte libere (titlu, "Mesaj pentru firme", raspunsurile text, numele/descrierea pieselor, numele scenelor din Studio). Textul ramane salvat exact cum l-a scris clientul; firmele fara acces la contacte (marketplace, inclusiv firma care a preluat deja; pe fisa de lucru membrii cu `clientVisible = false`) vad `⟦contact⟧` in locul telefonului/emailului/linkului/contului. Un titlu manual cu contact e inlocuit cu titlul automat (titlul ajunge in notificari). DECIZIE NECESARA PO: `system_settings.pre_claim_contact_text_policy` — `MASK` (implicit: publicarea trece, contactele sunt ascunse) sau `BLOCK` (publicarea/editarea e refuzata cu `REQUEST_CONTACT_INFO_IN_TEXT` pana cand clientul scoate contactele). Fiecare detectare se logheaza cu fragment partial ascuns (Admin -> Contacte detectate).

Nota de implementare 2026-10-01 (E-client-9, C7-3/C7-16): inainte de preluare firmele verificate din zona vad proiectul (titlu, descriere, camere, fisiere, scena 3D, oras, judet, distanta aproximativa), NU numele, adresa sau contactele. Fotografiile (JPEG/PNG/WEBP) sunt re-encodate la scanare, fara EXIF/GPS; PDF/ZIP raman neatinse (clientul e avertizat la pasul Fisiere). Firmele primesc fisierele cererii cu nume neutre (`attachment-N.ext`, si in Content-Disposition), iar cheile de storage nu mai contin numele original. Clientul vede pe pagina cererii cardul "Cine vede cererea": daca proiectul e in lista firmelor si ce firme detin numele/adresa/contactele (sloturi ACTIVE/OFFER_SENT/COMPLETED, cu "din {ora}" cand `claim_contact_reveal_policy = AFTER_GRACE`) — `GET /requests/:id/visibility`, calculat cu aceeasi functie ca fisa de lucru.

Actualizare 2026-11-14 (etapa 5, a6; PO a6-1, a6-2 — docs/07 D-E5-11, D-E5-12, D-E5-18, D-E5-19): cardul "Cine vede cererea" primeste acoperirea zonei, `coverage`: `COVERED` (exista macar o firma care acopera punctul aproximat al cererii), `NONE` (niciuna), `UNKNOWN` (cererea nu are coordonate). "Firma care acopera" = firma nestearsa, aprobata (sau cu suspendarea expirata), cu abonament activ neexpirat al carui plan are `MARKETPLACE_ACCESS`, cu cel putin o locatie a carei raza acopera punctul aproximat — aceeasi grila si aceeasi formula ca piata (4.8), fara excluderi pe cerere si fara intarzierea planului. Clientul NU vede niciodata numarul de firme (a6-1): la `NONE`, cat cererea e in piata, cardul arata un avertisment ("Momentan nu avem firme partenere care lucreaza in zona ta…", echipa a fost anuntata). In Sumar, inaintea butonului "Publica cererea", acelasi avertisment ("echipa va fi anuntata"), din `POST /requests/drafts/:token/coverage` (geocodare pe server; cel mult 10 verificari pe minut pe ciorna, peste ele `UNKNOWN`; la esec `UNKNOWN`, fara avertisment; doar la creare, cu adresa completa). Publicarea merge si fara acoperire (a6-2) si nu poate pica din cauza verificarii zonei; la publicare se scrie evenimentul `request.no_coverage` catre administratorii activi (clopotel + e-mail cu orasul si legatura spre cerere in Admin), o singura data pe cerere — nu si la republicare sau la schimbarea adresei.

Actualizare 2026-11-14 (etapa 7, b12, d5, e4, d4; PO b12-1, d5-1, d4-1 — docs/07 D-E7-2 … D-E7-4, D-E7-9 … D-E7-14):
- **Adresa exacta** = `address_text` (strada si numarul) + `address_details` („Bloc, scara, apartament”, optional, max 100, camp separat sub adresa, care nu se pierde la alegerea unei sugestii). Pentru firme se aplica aceeasi regula ca la strada: blocul / apartamentul se vad doar cu acces la contacte (`clientVisible` pe fisa de lucru); goale in rezumatul unei preluari inchise (REDACTED) si dupa stergerea cererii (TOMBSTONE); in piata, inainte de preluare, adresa nu se trimite deloc. Campul nu intra la geocodare si nu intra in audit. Adresa se afiseaza peste tot (Sumar, pagina cererii, firma) cu aceeasi functie (`formatDisplayAddress`), fara dubluri (oras = judet, oras deja in adresa ca segment intreg), cu tara doar cand nu e Romania. Orasul gol sau doar din spatii e refuzat („Completeaza orasul.”). Lista de tari ramane de 23 (PO b12-1); cum ajunge la firme o cerere din alta tara — intrebarea g0-12, deschisa.
- **Cardul „Cine vede cererea”** spune, pentru fiecare firma cu loc ocupat, „X iti vede numele, contactele alese si adresa completa”. Firmele care au avut contactele si nu le mai au (preluare inchisa: firma a renuntat, termen depasit, alta oferta aleasa…) apar ca istoric, fara numele firmei: „O firma a avut acces la datele tale pana pe …” (`pastContactAccess`), in locul lui „Nicio firma inca”. O preluare inchisa conteaza daca, in clipa inchiderii, fisa de lucru i-ar fi aratat contactele (aceeasi functie ca fisa, cu politica de dezvaluire de azi).
- **Pagina cererii (clientul)** reia randurile din Sumar, fara butonul de editare: suma aleasa, termen, adresa, „Canale de contact” (contactele trimise firmelor), un singur rand „Cum ai pornit cererea” (proiect propriu / proiectare cu plata / ajutor la planificare) si miniatura 3D a fiecarei piese configurate (PO d4-1).
- **„Cererile mele”**: numarul de firme socoteste si firma castigatoare dupa finalizare. Fila „Ciorne” (PO d5-1) arata doar ciornele legate de cont si cu macar o camera, cu „Continua” (de pe orice dispozitiv: se emite un acces nou la ciorna, cel vechi din alt browser nu o mai deschide) si „Sterge”. Ciornele anonime se leaga de cont la prima salvare dupa autentificare. Dupa revizuire (D-E7-25, D-E7-26): lista arata cel mult 20 de ciorne (cele mai recente); daca browserul are deja o cerere inceputa, „Continua” intreaba inainte s-o inlocuiasca, iar formularul nu mai intreaba din nou „Continui sau incepi din nou?”; celalalt dispozitiv afla ca ciorna a fost continuata in alta parte („Ciorna a fost continuata pe alt dispozitiv…”), nu mai salveaza si nu porneste alta ciorna.
- **Data din istoric** (dupa revizuire): „pana pe …” = momentul retragerii (`claim_slots.withdrawn_at`, altfel `updated_at`). Limitare cunoscuta, de confirmat de PO: accesul se evalueaza cu regula de dezvaluire de azi (`claim_contact_reveal_policy`), deci poate fi inexact daca regula s-a schimbat intre timp (D-E7-13).
- **Afisarea blocului** (dupa revizuire, D-E7-20): „Bloc, scara, apartament” se ascunde doar cand fiecare bucata a lui (intre virgule) e deja, ca segment intreg, in strada; altfel se afiseaza (si o adresa veche cu blocul lipit in strada fara virgula il poate arata de doua ori).

## 4.3 Editare cerere

- Maximum 3 edit-uri pre-claim.

- Maximum 1 edit post-claim, dar înainte de primirea ofertei.

- La edit post-claim: scoringul se recalculează (4.5), dar consumul de credite al fiecărui claim rămâne pe snapshot-ul original; firma afectată primește notificare și poate cere refund/anulare (motiv auto-aprobat REQUEST_MODIFIED_POST_CLAIM, 4.15).

- requests.last_edit_at se actualizează la fiecare edit (folosit de validările de anulare).

## 4.4 Expirare și repost

- O cerere publicată fără claim expiră după 5 zile lucrătoare (calendar Europe/Bucharest, 3.3).

- Reminder la clientul cererii la 3 zile lucrătoare.
  - _Implementare (E-admin-platform-44): reminder la 09:00 București în prima din ultimele 2 zile lucrătoare înainte de expires_at, doar cât cererea e IN_MARKETPLACE; eveniment request.expiry_reminder (clopoțel + email)._

- Repost permis o singură dată (manual, de către client).

- **Re-publicare după ratare SLA în masă (D-v6-13): **cererea revenită IN_MARKETPLACE primește un NOU ceas de expirare de 5 zile lucrătoare de la re-publicare și NU consumă repost-ul manual al clientului.

## 4.5 Mărimea proiectului — scoring configurabil

Sistemul calculează automat mărimea (SMALL/MEDIUM/LARGE) din alegerile clientului. Fiecare opțiune are puncte; suma cade într-un prag care determină categoria.

- ProjectSizingService.calculate(requestData) → {score, size}, rulat la submit și la fiecare edit pre-claim; salvat pe request (project_score, project_size).

- La claim: snapshot înghețat pe claim_slot (project_score_snapshot, project_size_snapshot, claim_cost_credits_snapshot). Firmele care au dat claim înainte de un edit nu sunt afectate de recategorisire.

- Praguri + cost claim în credite per mărime: project_size_thresholds (configurabil din Admin, fără deploy).

**Seed cost claim (D-v6-5): **SMALL = 1 credit, MEDIUM = 2 credite, LARGE = 4 credite. Valorile sunt seed inițial în project_size_thresholds.claim_cost_credits, ajustabile din Admin.

**Sprint 0: **Agentul propune un seed inițial de categorii + puncte (camera × dimensiune, material PAL/MDF/lemn masiv, sisteme push/glisante/buton presiune etc.), pe care utilizatorul îl revizuiește. Punctele se ajustează ulterior din Admin Settings.

Nota de implementare 2026-10-01 (E-company-21): costul unei preluari NU mai vine din praguri. Este regula PO r5 V1 (docs/archive/15): `ceil(bugetul minim estimat / credit_value_ron)`, limitat la [`claim_cost_min`, `claim_cost_max`] (0 = fara plafon), cu valorile din `system_settings` (implicit 1000 / 1 / 0 = comportamentul de dinainte), editabile din Admin → Setari fara deploy; formula unica in shared (`creditCostFromBaseScore` + `resolveClaimCostRules`), folosita de SizingService si de previzualizarea din /admin/sizing. Seed-ul 1/2/4 pe praguri (D-v6-5) e legacy: coloana `project_size_thresholds.credit_cost` nu mai e citita. O schimbare a setarilor se aplica doar cererilor publicate sau editate dupa; `claim_cost_credits_snapshot` ramane inghetat. ~~DECIZIE NECESARA PO: valorile min/max (propunerea 3..25 neaprobata).~~ Hotarat 2026-11-13 (PO d3-3, docs/07 D-E5-5): minim 1 credit, fara maxim (`claim_cost_min = 1`, `claim_cost_max = 0`); costul urmeaza doar punctajul.

Actualizare 2026-11-14 (etapa 5, d3; PO d3-1 + g0-10, d3-2, d3-3 — docs/07 D-E5-3 … D-E5-5, D-E5-22):
- **Costul unei preluari** = scorul de baza (1 punct = 1.000 lei din bugetul minim estimat = 1 credit), minim 1 credit, fara maxim. Propunerea 3..25 nu se aplica; proiectele foarte mari pot costa mult (risc acceptat de PO).
- **Cele 7 piese noi au pondere de tip (`ROOM_TYPE`), provizorie (g0-10):** canapea `PIECE_SOFA` 3, bufet `PIECE_SIDEBOARD` 2, mobilier de baie `PIECE_BATHROOM_VANITY` 2, mobilier de hol `PIECE_ENTRYWAY` 2, corp suspendat `PIECE_WALL_CABINET` 1, fotoliu `PIECE_ARMCHAIR` 1, taburet `PIECE_OTTOMAN` 1 (inainte valorau 0: canapeaua de 3 locuri iesea 4 credite, acum 7; perechea de noptiere ramane 5). Se inlocuiesc cu estimarea din aplicatia de ofertare cand va fi integrata; pana atunci se schimba din Admin → Marime proiect. Punctele pe configuratia canapelei (locuri, sezlong, tesatura) vin in etapa 10.
- **Camera cu „Am deja un proiect” fara dimensiuni:** treapta `ROOM_SIZE` se ia din „lungimea aproximativa” data de client (`request_rooms.approx_length_m`, optionala, 0,1–50 m, cel mult 2 zecimale) doar cand se aplica regula `approxLengthApplies` (camera are pas de dimensiuni in metri liniari si lungimea derivata din dimensiuni e 0; altfel valoarea e ignorata si nu se salveaza); gol = „sub 2 m”, ca inainte. Cu dimensiuni date, lungimea aproximativa nu conteaza. Previzualizarea din Admin → Marime proiect si estimarea din piata aplica aceeasi regula.
- Cererile deja publicate si locurile deja preluate NU se recalculeaza (costul e inghetat la preluare; ponderile noi se aplica doar cererilor publicate sau editate dupa lansare). Marimea la spalatorie / balcon / camara (ce se masoara diferit) ramane la problema 50.

Actualizare 2026-11-14 (etapa 6; PO c7-2, c6-1, c1-2, c2-3 — docs/07 D-E6-8, D-E6-12, D-E6-16, D-E6-19, D-E6-34): pe versiunile noi ale fluxurilor (doar cererile noi; cererile publicate si preluarile facute raman cu costul lor, deci doua cereri asemanatoare pot costa diferit o vreme) raspunsurile noi intra in punctaj prin valorile de enum existente, fara ponderi noi la material / sistem:
- **„Decide firma”**: la material = `ALTUL` (2 puncte, ca „Altul”); la deschidere = fara sistem (0); la blatul bucatariei = randul nou `KITCHEN_COUNTERTOP:FIRM_DECIDES` (0, ca toate blaturile).
- **„Fara usi sau sertare”** si piesele fara pas de deschidere (rafturi, cuier, oglinda, masuta, blat, pat fara sertare): fara sistem (0). Inainte aveau un sistem obligatoriu (fals).
- **„Pe pistoane”** = `AVENTOS` (3); **usile glisante** ale dulapului / dressingului = `GLISANTE` (3), fara intrebare de deschidere.
- **„Integral din MDF”** = `MDF` (2). **Oglinda**: fara rama / rama metalica / decide firma = `ALTUL` (2), rama din lemn = `LEMN_MASIV` (4), rama din MDF vopsit = `MDF_VOPSIT` (3). **Blatul de la spalatorie / balcon**: PAL postformat = `PAL` (1), lemn masiv = `LEMN_MASIV` (4), HPL / HPL compact / cuart / decide firma = `ALTUL` (2). **Setul de lemn**: lemn masiv 4, furnir 3, PAL cu decor lemn 1.
- **Tapitatele** (canapea, fotoliu, taburet) = `ALTUL` (2), fara intrebare: +1 fata de PAL.
- **Piesele ghidate cu 3D**: o singura sursa de deschidere (alegerea din 3D); bifa de pistoane adauga `AVENTOS`; o piesa 3D fara fronturi nu primeste niciun sistem (nici din `frontStyle`, nici din bifa). Costul ia in continuare sistemul cel mai scump dintre cele bifate.
- Exemple (ponderile din seed, fara buget / proiectare; confirmate de `apps/backend/src/modules/sizing/score-v6.spec.ts`): hol cu cuier + oglinda 10 → 9; dormitor cu dulap glisant 2,4 m MDF vopsit 11 → 13; dormitor cu pat fara depozitare + noptiere 17 → 15; comoda TV ghidata cu fronturi in 3D 6 → 5 (cu comoda TV deschisa, implicita, 4); canapea de catalog 7 → 8 (detalii in CHANGELOG, etapa 6).
- Ramas asa (D-E6-46): pe ecranul comun o banca nu poate fi „Fara usi sau sertare” cand e bifat si un corp care are sigur usi; primeste deschiderea celorlalte (de ex. Maner, +1 punct).

Actualizare 2026-11-13 (etapa 3, b11 + d1-1): treapta de buget (`budget_range`) intra in punctaj ca pana acum, dar nu se mai arata pe niciun ecran; `budget_declared` nu intra in calcul (acelasi punctaj si acelasi cost cu sau fara el). Marimea proiectului nu scade cand clientul declara o suma sub estimare: treapta folosita la marime (si salvata in `budget_range`) = treapta lui max(suma declarata, minimul estimarii din raspunsuri = scorul de baza × 1.000 lei); „Prefer sa nu spun” ramane UNDISCLOSED; suma clientului ramane in `budget_estimate_ron`; costul in credite neschimbat (scorul de baza). Regula aleasa de coordonator, de confirmat de PO (D-E3-13). O camera cu `needs_design_help` nu mai aduce punctele pieselor puse din oficiu (material, sistem, cantitatea de articole); pastreaza intrarile de camera (tip, marime, cantitate). Costul cererilor cu camere bifate scade (exemplu in 4.1, actualizarea etapei 3); la cererile fara bife punctajul e neschimbat (verificat pe 336 de combinatii flux × versiune × raspunsuri). Previzualizarea din /admin/sizing aplica aceeasi regula.

## 4.6 Verificare firmă și risk flags

- La onboarding firma completează profilul (date firmă: denumire, CUI, J Reg.Com., adresă, portofoliu).

- Risk flags calculate automat: rating sub prag, număr mic de reviews, lipsă portofoliu. Adminul vede flag-urile dar poate aproba manual oricum.

- Status firmă: PENDING_VERIFICATION → APPROVED / REJECTED. Firmele neverificate (ne-APPROVED) NU văd cereri.

- La REJECTED: blocaj 3 luni pe CUI și email înainte de reaplicare.

- Firmă APPROVED poate fi SUSPENDED automat la atingerea pragului de penalizare (4.12).

- Firmele demo (actualizare 2026-11-13, etapa 2, k1; PO k1-1 — docs/07 D-E2-6): până la lansare, firmele demo (care au măcar un membru cu e-mail @demo.ro, cu excepția „Mobila Unicat”) sunt ascunse din lista publică de parteneri (`/companies/partners`: pagina „Firme partenere” și caruselul de pe prima pagină). Altfel funcționează normal (login, piață, preluări). La lansare se șterg cu `prisma/cleanup-demo.ts` (D-L0-4). Galeria publică de inspirație nu se filtrează (pe producție are doar poze ale firmei reale).

## 4.7 Echipă și roluri

- company_members leagă useri de firmă cu rol: OWNER, MANAGER, EMPLOYEE_TRUSTED, EMPLOYEE_MANAGED.

- EMPLOYEE_MANAGED NU face claim direct. Owner/manager/trusted dă claim și opțional îl atribuie unui managed.
  - _Actualizare 2026-11-14 (etapa 7, a7 — D-E7-6): angajatul fără acces complet (EMPLOYEE_MANAGED, fără `CLAIMS_CREATE`) vede butonul de preluare dezactivat, cu „Preluarea o face proprietarul, un manager sau un angajat cu acces complet”; o cerere trimisă totuși e refuzată cu 403 `CLAIM_ROLE_NOT_ALLOWED` (nu `FORBIDDEN`)._

- Claim-ul e tehnic al firmei (creditele aparțin firmei); atribuirea e o relație separată, reasignabilă: claim_slots.claimed_by_user_id (cine a apăsat) + assigned_to_user_id (cine lucrează acum, nullable).

## 4.8 Claim, credite și arie de acoperire

- Maximum 3 firme pot da claim unei cereri (enforce cu lock-ul din 3.1).

  Actualizare 2026-11-13 (PO, a1-1; invarianta 3.1 amendata): cererea ramane deschisa pentru preluare si dupa prima oferta (si dupa o cerere de modificare, NEGOTIATION), pana se ocupa cele 3 locuri sau clientul accepta o oferta. Firma care preia tarziu si nu a ofertat cand clientul accepta primeste creditele inapoi (D-L0-3); riscul e spus in dialogul de preluare si in regulile publice pentru firme. Comutatorul din Admin `claims_open_after_first_offer` (implicit `true`) poate reveni la regula veche. Firma care acopera cererea pe raza si deschide o cerere care nu mai poate fi preluata vede motivul (locuri ocupate / clientul a ales / expirata / regula primei oferte daca adminul o reporneste) prin 409 `REQUEST_NO_LONGER_CLAIMABLE`, in loc de „Nicio cerere”; clientul vede acelasi motiv pe cardul „Cine vede cererea”.

- La claim se rezervă credite (credit_transaction RESERVE), cost = claim_cost_credits per mărimea proiectului (snapshot, 4.5; seed 1/2/4).

  Actualizare 2026-11-14 (etapa 7, a7; PO a7-1 — D-E7-1): inainte de preluare firma vede suma estimata de client (nu e data de contact; livrata la b11), iar panoul de preluare spune „Costul vine din bugetul minim estimat de client (X lei; 1 credit = Y lei)” (Y = `credit_value_ron`, trimis in regulile firmei ca `claimCost.creditValueRon`). Dupa preluare, fisa de lucru arata o data confirmarea „Ai preluat cererea…”.

  Nota 2026-10-01 (E-company-21): costul efectiv = `credit_cost` al cererii, calculat la publicare/editare dupa regula PO r5 V1 (1 credit = `credit_value_ron` lei din bugetul minim estimat, rotunjit in sus), limitat la [`claim_cost_min`, `claim_cost_max`] din `system_settings` (0 = fara plafon); vezi nota din 4.5. ~~DECIZIE NECESARA PO: valorile min/max (propunerea 3..25 neaprobata).~~ Hotarat 2026-11-13 (PO d3-3, D-E5-5): minim 1 credit, fara maxim.

- Refund la editare cerere post-claim sau la anulări valide (4.15). Creditele se consumă definitiv conform regulilor de anulare/finalizare.

  Actualizat 2026-11-13, etapa 4 (PO a4-1): refuzul ofertei de catre client (4.13) CONSUMA creditele rezervate ale firmei refuzate, ca la „clientul a ales alta firma” (pay-to-play, D-L0-3): o singura miscare `CONSUME` in registru, motiv `OFFER_DECLINED`, prin aceeasi decontare unica a locului (`ClaimSettlementService`), si la doua cereri simultane (refuz ‖ acceptare / refuz dublu). Locul firmei trece in `OFFER_DECLINED` (terminal; nu mai ocupa loc).

- Eligibilitate la claim: firmă APPROVED + abonament activ (SubscriptionActiveGuard) + credite suficiente + arie de acoperire îndeplinită + gating-ul planului (4.10) deja deschis + firma NU e în request_company_exclusions pentru cererea respectivă.

  Nota de implementare 2026-10-01 (E-admin-platform-58): „abonament activ” = `status = ACTIVE` si `expires_at > now` (predicatul unic `activeSubscriptionWhere`, folosit de garda, SubscriptionsService, workerul de expirare si KPI-ul admin) SI planul abonamentului include functia `MARKETPLACE_ACCESS` (`subscription_plan_features`). Fara abonament → 403 `SUBSCRIPTION_INACTIVE` (neschimbat); abonament pe un plan fara acces → 403 `PLAN_FEATURE_REQUIRED`. Cele 3 planuri existente au accesul activ (backfill) — comportament identic cu cel de dinainte.

**Arie de acoperire (D-v6-10): **fiecare company_location are coverage_radius_km (NUMERIC, default seed 50). O cerere este eligibilă pentru firmă dacă distanța Haversine dintre adresa cererii și cel puțin O locație a firmei ≤ coverage_radius_km al acelei locații. Filtrul rulează în SQL (3.8).

Nota de implementare 2026-10-01 (E-client-9, C7-2): distanta si acoperirea se masoara de la locatia firmei pana la punctul cererii APROXIMAT pe o grila fixa de ~2 km (centrul celulei: 0,018° lat × 0,026° lng, `floor` + 0,5 — aceeasi formula in SQL-ul marketplace si in tranzactia de claim, deci o cerere vizibila ramane claimabila). Doar punctul cererii se aproximeaza; locatiile firmei raman exacte. Firmele vad distanta in km intregi (minim 1) sau doar banda (sub 5 / 5–15 / 15–30 / peste 30 km), dupa `system_settings.marketplace_distance_display` (`KM` implicit | `BAND`). Raza minima a unei locatii = 2 km (`MIN_COVERAGE_RADIUS_KM`, doar la creare/editare; randurile existente nu se rescriu). Plafon de locatii per firma `company_locations_max` (implicit 10 → 409 `COMPANY_LOCATION_LIMIT_REACHED`) si de schimbari de locatii pe 24h `company_location_changes_per_day` (implicit 20, numarate din `audit_logs` COMPANY_LOCATION_* → 429 `COMPANY_LOCATION_CHANGE_LIMIT`). DECIZIE NECESARA PO: KM vs benzi, raza minima (2 vs 5 km), valorile plafoanelor (globale, nu per plan).

## 4.9 Regula „1 claim activ fără ofertă” + manager

- Regula se aplică pe assigned_to_user_id dacă există, altfel pe claimed_by_user_id: o persoană nu poate avea simultan 2 claim-uri active fără ofertă trimisă. Constraint UNIQUE WHERE status='ACTIVE' AND quote_id IS NULL pe assigned_to_user_id.

- **Cap manager: **managerul poate avea claim-uri neatribuite simultan ≤ numărul de angajați liberi. Validare: count(activeUnassignedClaimsByManager) + 1 ≤ count(workersWithoutActiveUnofferedClaim). Managerul se numără și el ca worker disponibil.

- **Atribuire în 1h (oră calendaristică, 3.3): **BullMQ delayed job la +1h; dacă assigned_to = NULL → auto-cancel (status CANCELLED_UNASSIGNED) + refund + notificare. Warning la +30 min.
  - _Warning la +30 min implementat (E-admin-platform-44): claim.assign_warning către OWNER/MANAGER + cine a preluat._

- **Atribuire eșuată: **dacă angajatul țintă are deja claim activ fără ofertă → eroare ASSIGNED_USER_HAS_ACTIVE_CLAIM.

- **Self-assign manager: **managerul poate face claim pentru el însuși; devine assigned_to și consumă slotul lui personal (1 claim activ fără ofertă, ca orice angajat). Un claim self-assigned e imediat assigned, deci nu consumă bugetul de claim-uri neatribuite.

- **Responsabil implicit (actualizare 2026-11-13, PO a5-1): **cel care preia devine responsabil implicit (assigned_to = el, fara ceasul de 1h). Proprietarul si managerul pot alege in dialogul de preluare un coleg sau „Atribui mai tarziu” (atunci se aplica regula de atribuire in 1h de mai sus). Angajatul cu acces complet (EMPLOYEE_TRUSTED) preia mereu pentru el (impus si in backend; permisiunea `CLAIMS_CREATE`, fara `CLAIMS_ASSIGN`). Regula „1 claim activ fara oferta” ramane; dialogul o semnaleaza inainte de confirmare (conducerii ii propune „Atribui mai tarziu”, angajatului ii blocheaza confirmarea). Dialogul si panoul de preluare arata termenul de raspuns estimat (aceeasi functie de zile lucratoare ca la claim). O atribuire esuata pe fisa de lucru apare ca alerta vizibila cu motivul.

## 4.10 Gating per plan abonament

- La publicarea cererii, vizibilitatea per firmă = published_at + delay-ul planului: Platinum +0 min, Gold +30 min, Silver +60 min. Stocat configurabil în subscription_plans.marketplace_gating_delay_minutes.

- Transparență: firma vede DOAR timpul scurs de la publicare („publicată acum X”), fără mențiuni despre alte planuri. CTA-ul de upgrade stă pe dashboard/pagina de prețuri, nu pe cardul cererii.

  Nota de implementare 2026-10-01 (E-admin-platform-58): planurile sunt date editabile din Admin → Setari (cod unic imuabil, nume RO/EN optionale, pret >= 0, credite incluse, intarziere de gating, activ, acces la marketplace). Planurile noi pornesc FARA acces la marketplace pana cand adminul il bifeaza explicit. Nu s-a schimbat niciun pret, numar de credite sau intarziere.

  Actualizare 2026-11-13 (PO, a1-2): fara intarziere pe plan — toate planurile vad cererile imediat ce apar. Intarzierea e 0 la toate planurile (seed; pe productie se pune din Admin la lansarea etapei 1); coloana `marketplace_gating_delay_minutes` si setarea din Admin raman, daca se vrea vreodata inapoi. Valorile Platinum/Gold/Silver de mai sus si fraza despre transparenta nu mai au obiect cat timp intarzierea e 0 (Î2 inlocuita, Î3 fara obiect — docs/07).

## 4.11 SLA (mapare CONFIRMATĂ, D-v6-4)

- **Durată SLA: **SMALL = 3 zile lucrătoare; MEDIUM = 3 zile lucrătoare; LARGE = 5 zile lucrătoare. Materializat în claim_slots.sla_deadline_at la momentul claim-ului.

- Grace period 12h (calendaristice) peste deadline înainte de penalizare.
  - _Implementare (E-admin-platform-44): sla.expiring_soon cu 24h înainte de sla_deadline_at (fără pauză), către responsabil + OWNER/MANAGER (clopoțel + email)._
  - _E-company-13: al doilea reminder la începutul grației (la sla_deadline_at), același eveniment sla.expiring_soon cu phase=GRACE, aceleași ținte; re-armat de sweep._

- O clarificare cerută firmei (clarification_requests) pune SLA pe pauză și adaugă +1 zi lucrătoare (sla_paused_at + recalcul via worker).

- **Ratare SLA individuală: **oferta/claim-ul expiră, firma primește penalizare (4.12).

- **Toate cele 3 firme ratează SLA: **claim-urile expiră, fiecare firmă primește 3 puncte penalizare, cererea revine IN_MARKETPLACE pentru alte firme cu un nou ceas de expirare de 5 zile lucrătoare (D-v6-13), clientul e notificat. Cele 3 firme care au ratat sunt EXCLUSE de la re-claim pe această cerere (request_company_exclusions). Re-publicarea NU consumă repost-ul clientului.

## 4.12 Penalizări (praguri CONFIRMATE, D-v6-6)

- Puncte de penalizare se aplică atât per angajat (scope EMPLOYEE), cât și per firmă (scope COMPANY).

- Fiecare penalty_event expiră INDIVIDUAL la 180 zile de la applied_at (fereastră rolling). Pragurile se evaluează ca SUM(points) cu expires_at > now().

| **Abatere** | **Puncte** |
| --- | --- |
| Ofertă expirată / SLA ratat individual | 3 |
| Toate cele 3 firme ratează SLA | 3 (fiecare firmă) |
| Retragere claim voluntară fără motiv (după grația de 30 min) | 2 |

**MVP conține DOAR cele 3 abateri de mai sus. **Alte tipuri de abateri se adaugă post-MVP exclusiv din Admin Settings (tabel penalty_rules configurabil: rule_key, points, is_active), fără deploy.

- **Prag firmă: **12 puncte active (scope COMPANY) → firma devine SUSPENDED 6 luni. Configurabil în system_settings (company_penalty_threshold=12, company_suspension_months=6).

- **Prag angajat (NOU): **9 puncte active (scope EMPLOYEE) → angajatul e BLOCAT 3 luni de la claim și de la atribuire (nu poate fi assigned_to). Firma rămâne funcțională. Configurabil în system_settings (employee_penalty_threshold=9, employee_block_months=3). Eroare la atribuire către angajat blocat: ASSIGNED_USER_PENALTY_BLOCKED.

## 4.13 Ofertă și versiuni

- Hard limit 3 versiuni înlănțuite: v1 = ofertă inițială; v2 = răspuns la modificarea #1; v3 = răspuns la modificarea #2. O modificare consumă slot DOAR dacă firma răspunde cu versiune nouă.

- Dacă firma refuză modificarea (quote_change_requests REJECTED), slotul nu se consumă, dar clientul nu poate cere aceeași modificare din nou.

- Retragerea unei oferte: permisă în 1 zi (lucrătoare).

- **Valabilitate ofertă (D-v6-7): **fiecare quote_version are valid_until = trimitere + 14 zile calendaristice (default, configurabil în system_settings: quote_validity_default_days=14). Firma poate seta explicit o valoare diferită la trimitere, în limitele permise de Admin.

- **Moneda ofertei (D-v6-12): **firma alege moneda ofertei: RON sau EUR (quotes.currency ENUM, default RON). Clientul vede AMBELE valori, conversia folosind cursul fix configurabil (1 EUR = 5.2 RON). Suma contractuală rămâne cea în moneda aleasă de firmă; conversia e doar informativă în UI și PDF.

  Actualizat 2026-11-13, etapa 4 (a4, D-E4-8): moneda e a VARIANTEI (`quote_versions.currency`), nu a ofertei intregi: firma o alege la fiecare varianta (v2 poate fi in EUR dupa v1 in RON); lipsa la trimitere = moneda variantei precedente (la v1 = RON). `quotes.currency` ramane = moneda ultimei variante. Cursul ramane setarea `eur_ron_rate` din Admin (fara data, fara istoric); conversia ramane informativa.

**După v3 (block UI cu 3 opțiuni): **(a) a 4-a variantă voluntară, peste limită (tracking quotes.extra_versions_count); (b) invitație la sediu pentru consultanță fizică (physical_consultation_invites); (c) „închei negocierea online”.

- **Expirare invitație consultanță (D-v6-8): **dacă clientul nu răspunde în 7 zile calendaristice de la creare → status EXPIRED (physical_consultation_invites.expires_at = created_at + 7d; BullMQ job; configurabil: consultation_invite_expiry_days=7). Firma e notificată la expirare și poate retrimite o invitație nouă.

**„Închei negocierea online”: **chat read-only pentru firmă ȘI client (chat_threads.negotiation_ended_by_company=TRUE). Clientul poate totuși accepta o ofertă existentă sau cere invitație la sediu (revine un buton).

**Mesaj client la limită: **„Firma a trimis deja 3 variante. Nu are obligația să-ți mai trimită alte variante online. Poți accepta una din variantele existente sau o invitație la sediul firmei pentru consultanță fizică.”

**Reofertare la expirare — 2 butoane: **Buton A „Păstrez aceleași date” extinde valid_until cu N zile (default 14, configurabil), NU e versiune nouă, NU consumă slot, audit în quote_validity_extensions; max 2 extensii × 14 zile = +28 zile maxim. Buton B „Modifică” = versiune nouă, consumă slot; dacă sunt deja 3 → block-ul de mai sus.

**Permisiuni câmpuri ofertă: **matrice configurabilă per firmă (company_offer_field_permissions: company_id, role, field_key, can_edit). Câmpuri: PRICE, DELIVERY_TERM, DELIVERY_DATE, WARRANTY, DESCRIPTION. Default seed la onboarding firmă: owner/manager pot orice; trusted poate orice mai puțin PRICE; managed read-only. Owner-ul ajustează matricea.

  Actualizat 2026-11-13, etapa 4 (a3): fara chei noi — rubricile noi intra sub cheile existente: TVA (`vatMode`), bifele transport / montaj, moneda variantei, pretul proiectarii si „ce include” → PRICE; termenul structurat (numar + unitate) → DELIVERY_TERM; garantia in luni → WARRANTY. Fiindca termenul si garantia sunt obligatorii, orice varianta noua cere acum PRICE, DESCRIPTION, DELIVERY_TERM si WARRANTY (pana acum PRICE + DESCRIPTION): un rol fara DELIVERY_TERM sau WARRANTY in matrice nu mai poate trimite oferte.

  Actualizat 2026-11-14, etapa 4 dupa revizuire (D-E4-22): la o varianta noua (revizie, varianta peste limita, reofertare), un camp retrimis neschimbat fata de varianta precedenta nu cere permisiunea lui (DELIVERY_DATE / DELIVERY_TERM / WARRANTY); PRICE si DESCRIPTION raman mereu cerute. La v1 nimic nu se schimba: un rol fara DELIVERY_TERM sau WARRANTY nu poate trimite prima varianta. Eroarea `OFFER_FIELD_NOT_EDITABLE` numeste campurile (`details.fields`).

**Rubricile ofertei (actualizat 2026-11-13, etapa 4 — PO a3-1, a3-2, a3-3, g0-11): **la orice varianta noua (v1, revizie, varianta peste limita, reofertare) sunt obligatorii:
- TVA, cu trei variante: pretul include TVA / nu include TVA / firma nu e platitoare de TVA (a3-1);
- termenul, ca numar + unitate (saptamani sau zile lucratoare), si garantia, in luni (a3-2);
- bifele „Inclus in pret: transport” si „Inclus in pret: montaj”, trimise explicit da / nu (a3-3: doar bife, fara sume separate; in formular pornesc nebifate — D-E4-15). Proiectarea ceruta de firma la o cerere fara proiectare cu plata ramane in descriere.
- La cererile cu proiectare cu plata (`includes_paid_design`), pretul proiectarii SI „ce include proiectarea” (text, max 1000) sunt obligatorii; pretul mobilierului ramane in aceeasi oferta, ca estimare („Pret mobilier (estimare)”). La celelalte cereri ambele sunt interzise (g0-11, completeaza D-v6-11).
- Textele libere vechi (termen, garantie) nu se mai trimit: serverul le scrie din rubrici („6 săptămâni”, „30 de zile lucrătoare”, „24 de luni”), ca PDF-ul, e-mailurile si codul vechi sa ramana lizibile. O varianta fara rubrici (formular vechi) e refuzata cu 400 `VALIDATION_ERROR`.
- Cota de TVA folosita la calcul se ingheata pe varianta la trimitere (`quote_versions.vat_rate_percent`, din `vat_rate`); o schimbare ulterioara a cotei din Admin nu muta ofertele deja trimise; variantele dinainte folosesc cota curenta (actualizat 2026-11-14, D-E4-20). TVA-ul din rubrica se aplica si tarifului de proiectare in totalul cu TVA (de confirmat de PO).
- La schimbarea monedei intr-o varianta noua, sumele nu se convertesc singure: formularul avertizeaza si nu trimite daca pretul, preturile pe camere sau tariful de proiectare au ramas aceleasi numere ca in varianta precedenta (actualizat 2026-11-14).
- Ofertele / variantele trimise inainte de etapa 4 raman cu textul lor liber (variantele sunt imuabile; nimic nu se rescrie); pe ecrane apar cu textul, iar la calcule cu „—”.
- Varianta noua porneste precompletata din ultima varianta (data livrarii doar daca nu a trecut); dintr-o varianta veche, termenul si garantia nu se ghicesc din textul liber — raman goale si trebuie completate (D-E4-16).

**Variantele si cererile de modificare (actualizat 2026-11-13, etapa 4 — a4): **clientul si firma vad toate variantele ofertei (v1, v2…), fiecare in moneda ei, cu diferentele fata de varianta precedenta (pret, termen, descriere…). Fiecare cerere de modificare ramane vizibila si dupa raspuns, langa varianta pe care s-a cerut si langa varianta care i-a raspuns. Cererea de modificare apare si ca mesaj de sistem in conversatia cu firma, iar firma primeste e-mail; la o varianta noua clientul primeste e-mail. Firma vede textele libere ale clientului din oferta (cereri de modificare, nota de refuz) cu contactele mascate, pe toate ecranele ei (actualizat 2026-11-14, D-E4-23). O cerere de modificare ramasa fara raspuns pe o oferta inchisa apare „Fara raspuns — oferta s-a inchis.” (in date ramane PENDING).

**Refuzul ofertei de catre client (actualizat 2026-11-13, etapa 4 — PO a4-1, a4-2): **
- Clientul poate refuza o oferta trimisa (`SENT`) a cererii lui, cat cererea e in OFFERS_RECEIVED / NEGOTIATION, din butonul „Refuz oferta” (dialog cu consecintele: refuzul e definitiv, firma e anuntata, conversatia ramane doar de citit; refuzul pleaca doar la „Da, refuz oferta”). Butonul nu apare pe ofertele EXPIRED.
- Motivul e optional, din lista scurta (pret / termen / alta firma / renunt), plus un text optional de cel mult 500 de caractere; firma le vede (textul ajunge la firma cu datele de contact mascate, ca la celelalte texte libere pentru firme fara acces).
- Refuzul e definitiv: oferta devine `DECLINED`, locul firmei se inchide (`OFFER_DECLINED`), creditele rezervate se consuma (ca la „clientul a ales alta firma”, 4.8), conversatia cu firma devine doar-citire si primeste un mesaj de sistem cu refuzul, firma primeste clopotel + e-mail cu motivul. Pe o oferta refuzata firma nu mai poate revizui / reoferta / prelungi / retrage / invita, iar clientul nu mai poate cere modificare, prelungire sau accepta (409).
- Firma refuzata nu mai poate prelua aceeasi cerere (excludere `QUOTE_DECLINED`, 403 `COMPANY_EXCLUDED_FROM_REQUEST`; cererea nu-i mai apare in piata) — aleasa de agenti, de confirmat de PO (D-E4-9).
- Locul eliberat poate fi preluat de alta firma cat cererea e deschisa (D-E1-1). Statusul cererii se recalculeaza: daca nu mai ramane niciun loc ocupat, cererea revine IN_MARKETPLACE cu ceas nou de expirare de 5 zile lucratoare (ca la D-v6-13); daca raman locuri ocupate fara nicio oferta vie, coboara la CLAIMED_PARTIAL / CLAIMED_FULL; altfel ramane in OFFERS_RECEIVED / NEGOTIATION.
- Refuzul se poate face doar pe o oferta in valabilitate: dupa `valid_until` → 409 `QUOTE_EXPIRED`, ca la acceptare, fara credite (actualizat 2026-11-14, D-E4-21). La refuz, invitatiile la consultanta deschise se inchid (EXPIRED) si butoanele lor dispar (D-E4-24). O retragere a firmei aflata la admin ramane in coada; aprobarea ulterioara da 409.
- O a doua cerere de refuz, refuzul unei oferte acceptate / retrase / expirate / inlocuite sau pe un loc deja inchis → 409 `QUOTE_NOT_DECLINABLE`. Oferta refuzata ramane vizibila clientului („Ai refuzat aceasta oferta pe …”) si firmei („Clientul a refuzat oferta pe …”, cu motivul sau „Clientul nu a spus motivul”), fara actiuni.

**Tabelul de comparare a ofertelor (actualizat 2026-11-13, etapa 4 — a3): **
- Rubricile, in ordine: Pret (in moneda variantei, cu „≈ … lei” sub sumele in euro), TVA, Total in lei cu TVA, Proiectare (doar cand o oferta are pret de proiectare), Termen (unitatea firmei + „adica N zile lucratoare” + data, daca exista), Garantie, Transport, Montaj, Valabilitate. Exemplul de pe prima pagina are aceleasi rubrici, in aceeasi ordine, fara Proiectare.
- „Total in lei, cu TVA” = totalul variantei (pret + proiectare) cu TVA, calculat de server (`totalWithVat`: neschimbat la „include TVA” / „neplatitor”, × (1 + cota inghetata a variantei) la „nu include TVA”), adus in lei cu cursul `eur_ron_rate` pentru EUR. Sub tabel apare cursul folosit, doar cand exista o oferta in euro (fara data: cursul e o setare fara istoric — D-E4-12). Tabelul arata lei intregi; cardul ofertei arata sumele cu bani (unificarea — problema 54, D-E4-17).
- Insignele se dau doar intre ofertele care mai pot fi alese (SENT in valabilitate si ACCEPTED; actualizat 2026-11-14: o oferta SENT cu valabilitatea trecuta ramane in tabel, fara insigne), cu cel putin doua oferte si un minim unic; ofertele retrase / expirate / inlocuite / refuzate raman coloane cu starea lor, fara insigne.
- „Cel mai mic” pe totalul in lei cu TVA, rotunjit la lei intregi cum se afiseaza (doua sume care arata la fel = egalitate, fara insigna). Fara curs valid, oferta in euro arata „—” la total, fara „≈ lei”, si iese din comparatie. O oferta veche (fara rubrica de TVA) nu primeste insigna si o blocheaza pe a celorlalte, daca nu se poate dovedi ca e mai scumpa: castigatorul trebuie sa fie strict sub totalul ei scris, adus in lei (regula prudenta, aleasa de agenti — D-E4-13).
- „Cel mai rapid” pe termenul in zile lucratoare (o saptamana = 5 zile); fara insigna la egalitate (de ex. 6 saptamani = 30 de zile lucratoare) sau cand o oferta vie are doar termen scris liber (aleasa de agenti — D-E4-14).

**Audit preț: **modificarea prețului e o versiune nouă cu audit log standard, FĂRĂ workflow suplimentar de aprobare (prețul e deja protejat la nivel de rol prin matrice).

## 4.14 Chat și upload

- Chat-ul există DOAR după claim (thread auto-creat la claim).

- După acceptarea unei oferte: chat-ul cu firma câștigătoare rămâne ACTIVE pentru execuție; chat-urile cu firmele nealese devin read-only IMEDIAT.

- Upload în chat conform flow-ului din 3.4 (presigned, scan, limite).

- _Actualizare 2026-11-14 (etapa 7, g3 — D-E7-15): un mesaj are cel mult 5.000 de caractere (numărate fără spațiile de la capete, ca pe server) și cel mult 5 fișiere. Contorul „n / 5.000” apare de la 4.000 de caractere și devine roșu peste limită; „Trimite” e inactiv peste limită și cât mesajul e gol fără fișier. Selectorul arată doar tipurile permise, iar fișierul e verificat local înainte de încărcare. Când trimiterea sau încărcarea nu reușește, sub câmp apare motivul (prea lung, conversație închisă, prea multe fișiere, fișier respins — aceleași motive ca în formularul de cerere —, fișier încă în verificare, eroare generală), iar textul și fișierele rămân. La `THREAD_READ_ONLY` câmpul e înlocuit de nota „doar citire” și conversația se reîncarcă; textul netrimis rămâne vizibil sub notă (doar citire, selectabil), cu motivul (după revizuire)._

## 4.15 Anulare și retragere claim

Anularea cu refund se auto-aprobă dacă motivul e în lista predefinită (cu validare automată). Motive custom → aprobare admin (SLA 48h calendaristice, fără auto-decizie). Tabel: claim_withdrawals. Toate ceasurile de mai jos sunt ore calendaristice (3.3).

| **reason_type** | **Validare automată / efect** |
| --- | --- |
| CLIENT_UNRESPONSIVE_48H | ultimul mesaj al firmei in chat sau ultima clarificare ceruta de firma are ≥ 48h si clientul nu a mai scris / nu a raspuns dupa el → AUTO_APPROVED + refund (E-company-3: fara mesaj al firmei motivul nu se aplica). Actualizat 2026-11-14 (etapa 4): cererea de modificare a ofertei conteaza ca activitate a clientului (`chat_threads.last_client_message_at`). |
| REQUEST_MODIFIED_POST_CLAIM | requests.last_edit_at > claim_slots.created_at si firma nu a trimis nicio versiune de oferta dupa last_edit_at → AUTO_APPROVED + refund (E-company-3). |
| CLIENT_CONTACT_INVALID | log bounce email automat sau upload dovadă → AUTO_APPROVED + refund. |
| CLIENT_REQUESTED_CANCELLATION | confirmare client în chat (quick reply) → AUTO_APPROVED + refund. |
| VOLUNTARY_NO_REASON | < 30 min de la claim: refund integral + 0 penalizare; ≥ 30 min: fără refund + slot eliberat + 2 puncte. |
| CUSTOM | PENDING_ADMIN_REVIEW; slot rămâne ocupat; reminder la 48h; ADMIN_APPROVED (refund) / ADMIN_REJECTED. |

**Client șterge cererea în timpul claim-ului: **soft delete cerere (deleted_at); claim-urile → CANCELLED_BY_CLIENT; refund automat la firme; eveniment + notificare.

_Actualizare 2026-11-14 (etapa 7, e4 — D-E7-5, D-E7-13):_
- _Ștergerea se confirmă într-un dialog din aplicație (definitivă; ofertele primite se anulează; conversațiile rămân doar de citit; firmele își primesc creditele înapoi; buton roșu „Șterge definitiv”), apoi lista arată „Cererea a fost ștearsă.”. La firmă, oferta unei cereri șterse apare „Cererea a fost ștearsă de client”, nu „Retrasă” (doar textul; starea `WITHDRAWN` rămâne)._
- _Când o firmă renunță la preluare (voluntar, motiv validat automat sau retragere aprobată de admin), clientul primește clopoțel + e-mail „O firmă a renunțat; cererea e din nou disponibilă pentru alte firme” (`request.company_withdrew`) — o singură dată pe preluare, fără numele firmei. Închiderile automate (termen depășit, neatribuire în 1h) NU trimit acest mesaj (fără mesaje în rafală). Cardul „Cine vede cererea” arată apoi istoricul „O firmă a avut acces la datele tale până pe …” (4.2)._
- _Dialogul de retragere a ofertei (firma, D-E7-18): arată termenul de pe fișă (`slaDeadlineAt` al preluării, fără grație; orele de grație = momentul ratării minus termen, ambele de la server), grația de 12h pe un rând separat („mai ai 12 ore de grație”), iar pierderea preluării și penalizarea la condițional („dacă nu trimiți o ofertă nouă până atunci”)._

## 4.16 Abonamente, credite, trial

- Planuri Silver / Gold / Platinum. Seed configurabil: Silver 149 RON / 15 credite; Gold 399 RON / 50 credite; Platinum 899 RON / 120 credite. Stocat în subscription_plans (price_ron, included_credits).

- Top-up credite: credit_packages — 10 credite = 100 RON, 50 = 400 RON, 100 = 700 RON (discount progresiv). POST /credits/purchase cu Idempotency-Key.

- ~~Creditele rămân valabile 3 luni după expirarea abonamentului.~~ Scoasă 2026-11-13 (PO, h2-2): creditele rămân în cont fără termen — vezi actualizarea de mai jos.

  Nota 2026-10-01 (E-company-21): regula de valabilitate 3 luni NU e implementata (creditele nu expira in cod; se pot folosi doar cu abonament activ - SubscriptionActiveGuard; portofelul afiseaza aceasta nota firmelor fara abonament activ). DECIZIE NECESARA PO: pastrare (EXPIRE + job + avertizari 30/7 zile + clauza in Termeni) / post-MVP / renuntare.

  Actualizare 2026-11-13 (PO, h2-1 / h2-2 / h2-3) — inlocuieste regula „3 luni” de mai sus si inchide DECIZIA NECESARA: creditele raman in cont fara termen; fara abonament activ nu se pot folosi la o preluare noua si nu se pot cumpara pachete noi (403 `CREDITS_REQUIRE_ACTIVE_SUBSCRIPTION`, si la „Continua plata” pe o comanda de credite; abonamentul se poate cumpara oricand; comenzile prin transfer deja plasate se pot confirma de admin). Se folosesc din nou dupa reactivare. Firma fara abonament activ isi termina preluarile in curs: vede lista, atribuie, trimite oferte, scrie in conversatie, livreaza; doar preluarea unei cereri noi (si lista/detaliul cererilor din marketplace) cere abonament activ. Un singur mesaj de stare (Panou, Marketplace, Preluari, Portofel, Firma mea, fisa de lucru, pagina cererii din piata) spune planul, data expirarii, soldul si ca preluarile in curs se pot termina, cu butonul „Reactiveaza abonamentul”.

- Trial firme noi: 1 lună Gold gratuit + 10 credite, activat la admin approve, toggleable din Admin (subscriptions.is_trial + trial_ends_at; system_settings: trial_enabled, trial_plan, trial_duration_days, trial_bonus_credits).

  Nota de implementare 2026-10-01 (E-admin-platform-58): `trial_plan` = codul unui plan ACTIV (validat la salvare; implicit ramane `GOLD`). Un plan de 0 lei este permis ca DATE, dar nu se cumpara online (409 `PLAN_NOT_PURCHASABLE`, fara comanda si fara factura): firma il primeste doar prin acordarea adminului (`POST /admin/subscriptions/grant`) sau daca adminul il pune in `trial_plan`. Plata ramane Stripe Checkout `mode: 'payment'` + prelungire cu 30 de zile (D-L0-1 / D-L0-2). Preturile listate (planuri si pachete) vin cu TVA calculat in backend, cu aceeasi formula ca pe comanda.

  DECIZIE NECESARA PO (E-admin-platform-58): (1) grila de preturi „runda 4” (Start 0 / Ofertare 299 / Prioritate 599, cost claim 3..25 credite) NU este inregistrata in docs/07; daca devine finala, PO trebuie sa inlocuiasca explicit Î7, Î8, D-v6-5 si D-L0-2 (docs/07 nu a fost modificat); (2) facturare recurenta Stripe (subscription / anual) in locul platii unice + 30 de zile — contrazice D-L0-1/D-L0-2, nerealizata; (3) cum ajunge o firma pe planul gratuit: automat la aprobare (in locul trialului Gold), automat cand nu are abonament (plan implicit) sau doar prin acordarea adminului (azi: doar admin / `trial_plan`); (4) ce functii de unealta (Ofertare Rapida, citiri AI pe luna) intra in fiecare plan — registrul contine azi doar `MARKETPLACE_ACCESS`, coloana `limit_value` e pregatita pentru cote.

## 4.17 Facturare (mock, conformă RO)

Factura mock generată local (PDF), cu structură conformă Codului Fiscal RO. Seller-ul este platforma (facturezi firmele pentru abonamente/credite).

- Date furnizor (seller) configurabile în Admin: denumire, CUI/CIF, J Reg.Com., sediu, IBAN (snapshot pe mock_billing_orders.seller_snapshot).

- Numerotare secvențială SERIE-NUMĂR (serie continuă, obligatoriu legal): mock_billing_orders.invoice_series + invoice_number, prin secvență dedicată per serie.

- TVA standard RO = 21% (din 1 aug 2025), stocat configurabil în system_settings (snapshot vat_rate pe factură). Câmpuri: bază impozabilă + valoare TVA + total, monedă RON.

- Conținut: serie+număr, dată, furnizor, client, descriere serviciu, baza+TVA+total.

_Implementare (E-company-24, 2026-09-30): când Stripe e oprit (D-L0-1), plata prin transfer bancar primește o **factură proformă** (PDF atașat emailului „Datele pentru plata prin transfer” și descărcabil din portofel) — document fără valoare fiscală, identificat prin referința comenzii „Comanda {REF}”, care NU consumă număr din seria facturilor (numărul se alocă doar la plata confirmată). Factura fiscală se atașează emailului „Plata a fost confirmată”. Firma poate apăsa „Am plătit” (marcaj + notificare către admini; fără dovadă atașată). Emailurile și notificările de facturare ajung doar la OWNER/MANAGER, plus o copie a documentelor la emailul de facturare opțional al firmei (contabil). Reminderul și anularea automată a comenzilor neplătite sunt controlate de `bank_transfer_reminder_days` / `bank_transfer_expiry_days` (zile calendaristice de la plasarea comenzii; 0 = oprit, implicit) — DECIZIE NECESARĂ PO: numărul de zile și ce se întâmplă cu un transfer sosit după anularea automată (azi: confirmarea unei comenzi anulate = 409, rezolvare manuală). Comenzile marcate „Am plătit” nu se anulează automat._

_Actualizare 2026-11-14 (etapa 7, g4 — D-E7-16, D-E7-17): documentele PDF (oferta, proforma, factura) se descarcă prin aplicație; dacă nu se pot genera, clientul / firma vede „Nu am putut genera PDF-ul acum…” (503 `DOCUMENT_RENDER_FAILED`), nu un fișier stricat, iar adminii activi primesc un clopoțel `documents.pdf_failed` o dată pe zi (fără e-mail) și jurnalul are un avertisment clar. E-mailul de transfer pleacă și fără proformă atașată (randare eșuată, comandă de test, date fiscale neconfigurate); comanda ține minte când proforma a plecat chiar atașată către proprietar sau manager (`mock_billing_orders.proforma_emailed_at`; copia pentru contabil nu contează — D-E7-23), iar portofelul spune „ți-am trimis proforma” doar atunci, altfel „Factura proformă o poți descărca oricând de aici.” (fără a pomeni e-mailul, deci corect și la comenzile vechi). PDF-ul ofertei se salvează ca `oferta-<firma>-v<versiune>.pdf` (D-E7-24)._

_Imaginea 3D a piesei (etapa 7, d4; PO d4-1 — D-E7-4, D-E7-14; înlocuiește partea „invizibilă pentru client” din D-3D-4): clientul o vede ca miniatură în Sumar („Așa văd firmele piesa configurată.”) și pe pagina cererii. Urcă pe ciornă imediat după ecranul 3D (și din nou la ~2,5 s după o schimbare), nu abia la publicare, deci rezistă la reîncărcare și pe alt dispozitiv; fișierul vechi se șterge la înlocuire. Când lipsește sau e mai veche decât configurația (și după „Câmpuri clasice”), Sumarul o desenează ascuns; dacă nu se poate, spune asta, iar publicarea nu se blochează. Pleacă la firme doar dacă arată configurația de acum; „Publică” / „Salvează” așteaptă desenarea în curs (cel mult 15 s). La editarea unei cereri publicate nu urcă nimic înainte de „Salvează”, iar cererea rămâne cu cel mult o imagine pe piesă (fișierele în plus de la o salvare eșuată sau o editare abandonată se șterg — D-E7-22)._

## 4.18 Review și dispute

- Review-ul e posibil DOAR după livrare confirmată de client (COMPLETED).

- Review sub 3 stele → automat DISPUTED (review_disputes), gestionat de admin.

- Tranziția spre COMPLETED: firma marchează DELIVERED_BY_COMPANY → clientul confirmă → COMPLETED → review activ.

Actualizare 2026-11-13 (etapa 1, e2; PO e2-1, e2-2, g0-13):
- Nota recenziei pornește goală; trimiterea cere alegerea stelelor și o confirmare („Trimiți nota X din 5 — nu se mai poate schimba”). „Confirmă livrarea” cere un dialog, cu varianta „Am o problemă”.
- **Problemă în starea DELIVERED_BY_COMPANY: **clientul (doar el, nu firma) poate deschide raportul de proiect și după ce firma a marcat livrarea. Cât timp proiectul are un caz OPEN, finalizarea automată de la 14 zile (D-L1-1) nu rulează; după ce adminul închide cazul, termenul de 14 zile repornește de la momentul închiderii (`resolved_at`). Clientul poate confirma oricând manual livrarea, și cu raport deschis (cazul rămâne la admin). Cât e un raport deschis, panoul clientului nu mai arată termenul „livrare de confirmat”.
- **Problemă după finalizare (garanție): **în COMPLETED (și DISPUTED) clientul poate raporta o problemă cât ține garanția scrisă în oferta acceptată, dar cel puțin 24 de luni de la finalizare (dacă garanția nu se poate citi ca durată: 24 de luni). Raportul devine caz de proiect cu motivul `WARRANTY_CLAIM`, la admin; nu schimbă starea proiectului și nici creditele; firma primește notificare (clopoțel + e-mail cu text propriu). Un singur caz deschis pe proiect. În afara ferestrei → 409 `WARRANTY_REPORT_WINDOW_CLOSED`. Adminul închide reclamația cu acțiunea existentă „Închide cazul fără anulare”.
- Fișa firmei câștigătoare arată, după finalizare, „Livrare confirmată”, data finalizării, recenzia primită și raportul deschis al clientului.

Actualizare 2026-11-14 (etapa 5, e1; PO e1-1, e1-2, e1-3 — docs/07 D-E5-6 … D-E5-8, D-E5-13 … D-E5-15, D-E5-23, D-E5-24):
- **Contactele firmei către client (e1-1).** Regula din 4.2 merge acum și în celălalt sens, dar îngust: după acceptare, doar clientul cererii primește, doar pentru firma cu oferta acceptată, numele, e-mailul și telefonul (dacă există) persoanei responsabile, plus numele, CUI-ul și adresa (adresă, oraș, județ) firmei. Persoana = cea atribuită preluării câștigătoare → cel care a preluat → proprietarul firmei, primul cont activ (nesters, neblocat, neanonimizat) și încă membru al firmei. Verificarea e în API (`GET /requests/:id/fulfillment`): înainte de acceptare nu pleacă nimic din datele firmei. Actualizat după revizuirea de cod (2026-11-14, D-E5-14): contactul și datele firmei sunt vizibile clientului de la acceptare până după finalizare, inclusiv în dispută (ACCEPTED / IN_EXECUTION / DELIVERED_BY_COMPANY / COMPLETED / DISPUTED, perioada de garanție); după anulare (CANCELLED) nu se mai trimit. Panoul „Ce urmează” le arată ori de câte ori serverul le trimite.
- **Etape informative (e1-2).** Firma câștigătoare bifează / debifează Măsurători, Contract, Producție, Montaj cât cererea e ACCEPTED / IN_EXECUTION / DELIVERED_BY_COMPANY (altfel 409 `EXECUTION_STAGE_NOT_EDITABLE`). Etapele NU blochează livrarea și NU schimbă starea cererii. Clientul le vede (cu data bifării) și e anunțat prin clopoțel doar la prima bifare a unei etape (fără e-mail; debifarea și re-bifarea nu anunță — D-E5-26). Cine poate bifa: regula fișei de lucru, aceeași pe server și în interfață (OWNER / MANAGER / EMPLOYEE_TRUSTED; EMPLOYEE_MANAGED doar pe preluarea luată de el sau atribuită lui — D-E5-13, de confirmat de PO). Fiecare bifare / debifare intră în jurnalul de audit.
- **Pragul până la „livrat” (e1-3).** „Marchează ca livrată” merge doar după `delivery_min_days_after_accept` zile de la acceptarea ofertei (`quotes.accepted_at`; implicit 7, 0 = oricând, din Admin → Setări). Înainte → 409 `DELIVERY_TOO_EARLY` cu data minimă; în interfață butonul e dezactivat cu „Poți marca livrarea începând cu <data și ora>” (ora României), iar dialogul spune când se finalizează automat (14 zile, D-L1-1). Ofertele acceptate fără `accepted_at` (date vechi) nu au prag.
- **Stările afișate.** Pe fișa firmei câștigătoare insigna și celula de termen arată starea proiectului (Acceptată / Livrată — așteaptă confirmarea clientului, cu data finalizării automate / Finalizată), nu „Ofertă trimisă”. Pe pagina clientului „Expiră” apare doar cât cererea e IN_MARKETPLACE; după acceptare apare „Acceptată pe <data>”. Starea IN_EXECUTION rămâne nefolosită (etapele nu o setează).

## 4.19 Admin

- Un singur rol ADMIN (fără sub-roluri în MVP).

- Adminul intră în chat DOAR în dispute (nu în chat-urile normale client-firmă).

- Gestionează: firme, verificări (approve/reject + risk flags), cereri, claim-uri, credite, abonamente, penalizări (inclusiv penalty_rules), dispute, audit log viewer, settings, jobs.

## 4.20 Limbă și i18n

- RO + EN complet: switcher în UI, string-uri key-based prin next-intl (ambele locale populate: ro.json + en.json).

- Emails și PDF urmează users.language_preference (ENUM RO/EN, default RO).

- Errors: coduri mapate la mesaje în ambele locale; UI nu folosește message direct decât ca fallback.

- **Glosarul (actualizare 2026-11-14, etapa 8, i1; PO i1-1 … i1-3 — docs/07 D-E8-2 … D-E8-4, D-E8-14 … D-E8-18, D-E8-22).** Orice text nou (ecran, buton, mesaj, e-mail, notificare), în RO și EN, folosește termenii din `docs/glosar.md`; testul `apps/frontend/src/messages/glossary.test.ts` caută termenii interziși. Pe scurt: „cerere” până la acceptare, „comandă” după acceptare, „plată” la plățile firmei; ecranul firmei = „Cereri disponibile”; „Termen de răspuns” (nu „SLA”); „Locuri ocupate {active} din {max}” (nu „sloturi”); „lei” (și în engleză); „Proiectare cu plată” (un singur nume, și în dialoguri, validări și bifa din coș; excepție: titlul cartonașului de pornire „…am nevoie de ajutor” — D-E8-39); în Date generale titlul „Adresa montajului”, câmpul „Stradă și număr” (D-E8-37); la editare ultimul pas „Verifică și salvează” (D-E8-38); niciodată „atelier”.
- **Stările se redenumesc doar la afișare.** Eticheta se schimbă, valoarea din date rămâne: `IN_MARKETPLACE` → „Disponibilă firmelor” / „Open to companies”; `CANCELLED` (cerere, doar după acceptare) → „Comandă anulată”; preluarea anulată la neatribuire → „Anulată: nu a fost atribuită la timp”. Cheile JSON, codurile (`SLA_*`, `IN_MARKETPLACE`) și adresele (`/marketplace`) rămân.
- **Excepții:** ecranele de administrare (`Admin*`) și textele juridice `Legal.*` (versionate și acceptate de utilizatori; se schimbă doar cu o versiune nouă — hotărârea PO) rămân cu vocabularul vechi; referința de plată „Comanda {ref}” din datele de transfer rămâne; „la comandă” = făcut pe măsură.

## 4.21 GDPR și audit

- Soft delete pe PII (3.12), anonimizare via UserAnonymizationService.

- Audit log append-only enforced prin trigger DB pe audit_logs (3.9); restul entităților application-level.
