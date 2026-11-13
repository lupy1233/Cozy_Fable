# Răspunsurile PO la întrebările planului — 2026-11-13

Citite din baza paginii planului (versiunea , salvată 2026-11-13T16:36:04.492Z). Textele scrise de PO sunt redate întocmai.

## Înainte de orice

- **[g0-1] De unde pornesc cu codul?**
  - **Răspunsul PO:** Unești tu întâi PR #20, apoi lucrez pe câte o ramură pentru fiecare etapă (recomandarea). Ramura principală devine egală cu producția. Fiecare etapă e o cerere de îmbinare mică, ușor de verificat și de dat înapoi.
- **[g0-2] Cum ajunge fiecare etapă pe producție?**
  - **Răspunsul PO:** Îți arăt ce s-a schimbat și lansez când spui tu, etapă cu etapă (recomandarea). Rămâne ca până acum. Fiecare lansare așteaptă un „da” de la tine.
- **[g0-3] Cine verifică pe producție părțile care cer cont?**
  - **Răspunsul PO:** Tu, după fiecare lansare, cu o listă scurtă de pași de la mine (recomandarea). Cinci până la zece minute pe etapă. Știm sigur că merge și pe producție.
- **[g0-4] Mut problema 18 (editarea unei cereri publicate strică ciorna) înaintea problemelor 9, 10 și 11?**
  - **Răspunsul PO:** Da, o fac prima în etapa 2 (recomandarea). Memoria ciornei se desparte o singură dată de cea a editării; restul se construiesc peste ea.
- **[g0-5] Lipesc problema 29 (tabelul de comparare) de problema 19 (refuzul ofertei și variantele)?**
  - **Răspunsul PO:** Da, le fac împreună în etapa 4 (recomandarea). O singură schimbare a bazei de date și un singur formular nou de ofertă pentru firme.
- **[g0-6] În câte runde schimb întrebările formularului?**
  - **Răspunsul PO:** Două runde (recomandarea). Prima, în etapa 6: material, deschidere, ușile dulapului, blat, „decide firma”, mai puține ecrane (51 și 53 urcă lângă 27 și 28). A doua, în etapa 10: ce se măsoară și întrebările care lipsesc (49 și 50, la locul lor). Cam 6 zile cost fix.
- **[g0-7] Salvez planul și rapoartele auditului în proiect?**
  - **Răspunsul PO:** Da, planul și rapoartele, fără capturi de ecran (recomandarea). Câteva fișiere text în `docs/implementation`. Orice sesiune viitoare le găsește acolo.
- **[g0-8] Ajutor doar la o cameră: cum îl cere clientul?**
  - **Răspunsul PO:** O bifă pe fiecare cameră din coș: „La camera asta am nevoie de ajutor” (recomandarea). Camera bifată sare întrebările și pleacă la firme doar cu tipul ei, pozele și mesajul. „Am nevoie de ajutor” de la pornire le bifează pe toate. Bifa „Include proiectare cu plată” de la Date generale dispare: cererea e „cu proiectare” când măcar o cameră are bifa. Cam 2 zile în plus și o coloană nouă în baza de date.
- **[g0-9] Până vine estimarea din aplicația de ofertare, ce fac cu bugetul pe care formularul îl pune singur?**
  - **Răspunsul PO:** Repar acum partea mică: clientul alege o sumă sau „Prefer să nu spun” (recomandarea). Firma nu mai vede o sumă pe care clientul n-a ales-o. Estimarea de azi rămâne doar reper pe glisor, până o înlocuiește cea nouă. Intră și ce ai hotărât deja: glisorul coboară sub estimare cu avertisment, treptele dispar, firmele filtrează cu un glisor.
- **[g0-10] Până atunci, cât valorează în credite cele 7 piese care azi contează zero?**
  - **Răspunsul PO:** Pun acum valorile propuse, ca provizorii (recomandarea). Canapea 3, bufet 2, mobilier de baie 2, mobilier de hol 2, corp suspendat 1, fotoliu 1, taburet 1. Se schimbă oricând din Admin → Mărime proiect, fără lansare. Cererile deja publicate nu se recalculează.
- **[g0-11] Proiectarea cu plată: cât construiesc acum din drumul descris de tine?**
  - **Răspunsul PO:** Acum: prețul proiectării și „ce include” devin obligatorii în oferta la cererile cu proiectare (recomandarea). Clientul compară firmele după proiectare, iar textele spun drumul tău. Prețul mobilierului rămâne în aceeași ofertă, ca estimare. Cam o zi în plus, în etapa 4, odată cu formularul nou de ofertă.
- **[g0-12] Cum ajunge la firme o cerere cu montaj în altă țară?**
  - **Răspunsul PO:** Firma bifează în profil țările în care lucrează; cererile de acolo îi apar indiferent de distanță (recomandarea). Clientul din altă țară ajunge doar la firmele care chiar merg acolo. Cam o zi și jumătate și o schimbare mică în baza de date.
- **[g0-13] Câte luni după finalizare poate clientul să apese „Raportează o problemă”?**
  - **Răspunsul PO:** Cât ține garanția scrisă în ofertă, dar cel puțin 24 de luni (recomandarea). Fiecare comandă are termenul ei. 24 de luni e garanția legală de conformitate pentru consumatori.

## Etapa 1 — Opt reparații grave și scurte

- **[a1-1] Până când poate fi preluată o cerere de alte firme după ce a venit prima ofertă?**
  - **Răspunsul PO:** Rămâne deschisă până se ocupă cele 3 locuri (recomandarea). Clientul are șansa la trei oferte; firma care preia târziu riscă să nu apuce să oferteze dacă clientul acceptă repede (primește creditele înapoi). Se schimbă regula tehnică 3.1 și regulile publice. Lucru: o setare + texte, ~2 zile.
- **[a1-2] Spunem firmelor că pe planul lor cererile noi apar cu întârziere?**
  - **Răspunsul PO (altceva):** „vreau sa nu mai existe acest gatekeep de minute, toate tier-urile sa primeasca ofertele imediat cum apar.”
- **[c6-1] Blatul de la bucătărie rămâne obligatoriu?**
  - **Răspunsul PO:** Obligatoriu, cu „Nu știu — decide firma” (recomandarea). Clientul care nu știe are o ieșire; firma primește mereu un răspuns. „Opțional” dispare din text chiar acum.
- **[c6-2] La spălătorie și balcon, blatul primește aceleași opțiuni ca la bucătărie, plus HPL compact?**
  - **Răspunsul PO:** Da, setul de blaturi (recomandarea). PAL postformat, HPL, HPL compact, cuarț, lemn masiv, decide firma; firma primește un blat realist.
- **[h2-1] Ce poate face o firmă cu abonament expirat pe preluările pe care le are deja?**
  - **Răspunsul PO:** Termină tot ce are în curs; doar preluările noi sunt blocate (recomandarea). Vede lista, atribuie, trimite oferte și livrează. Clienții care așteaptă nu sunt afectați de abonamentul firmei.
- **[h2-2] Ce le spunem firmelor despre credite după ce expiră abonamentul?**
  - **Răspunsul PO:** Creditele rămân în cont fără termen; le folosești după reactivare (recomandarea). Așa e codul azi; textul spune adevărul; regula de 3 luni se scoate din regulile de produs.
- **[h2-3] O firmă fără abonament activ poate cumpăra credite?**
  - **Răspunsul PO:** Nu: pachetele sunt dezactivate, cu butonul „Reactivează abonamentul” alături (recomandarea). Fără plăți fără folos și fără cereri de rambursare.
- **[e2-1] Când clientul apasă „Am o problemă” după ce firma a marcat livrarea, se oprește finalizarea automată de la 14 zile?**
  - **Răspunsul PO:** Da, ceasul se oprește până când echipa Cozy Home închide raportul (recomandarea). Completează decizia scrisă despre finalizarea automată; clientul e protejat; adminul trebuie să răspundă la rapoarte.
- **[e2-2] După finalizare, clientul poate raporta o problemă (de exemplu în garanție)?**
  - **Răspunsul PO:** Da, un buton „Raportează o problemă” timp de un număr de luni după finalizare (altfel decât recomandarea: Nu acum: recenzia sub 3 stele rămâne calea, plus un link „Contactează-ne” spre suport). Regulă nouă de produs și un tip nou de caz pentru admin; +1–2 zile; adminul preia reclamațiile de garanție.
- **[a5-1] Cine devine responsabil de cerere imediat după preluare?**
  - **Răspunsul PO:** Cel care preia, cu opțiunea „Atribui mai târziu” pentru proprietar și manager (recomandarea). Cazul obișnuit merge dintr-un clic; conducerea poate încă prelua pentru echipă, cu regula de o oră.

## Etapa 2 — Ciorna, publicarea și contul

- **[b8-1] „Proiectare cu plată” rămâne o bifă separată în „Știu ce vreau” sau înseamnă doar modul „Am nevoie de ajutor”?**
  - **Răspunsul PO (altceva):** „o sa existe cazuri in care clientul stie in mare ce doreste dar pentru o singura camera are nevoie de ajutor din partea firmelor”
- **[b8-2] Ce facem cu bifa „Am deja un proiect pentru toată locuința” din coș?**
  - **Răspunsul PO:** O scot; în coș rămâne „Mod: … · Schimbă” (recomandarea). Modul se schimbă doar într-un loc; clientul vede mereu ce a ales.
- **[b8-3] Când clientul trece pe „Am nevoie de ajutor” după ce a răspuns la întrebări, răspunsurile pleacă la firme?**
  - **Răspunsul PO:** Nu pleacă; rămân în ciornă dacă revine (recomandarea). Firma primește un brief curat; clientul e avertizat la schimbare și le regăsește dacă se întoarce în „Știu ce vreau”.
- **[k1-1] Ce facem cu firmele demo de pe producție înainte de lansare?**
  - **Răspunsul PO:** Le ascundem acum de pe paginile publice și le ștergem la lansare (recomandarea). Vizitatorii nu le mai văd; verificările cu conturile demo merg în continuare; ștergerea rămâne un pas al lansării.

## Etapa 3 — Bugetul și fișa firmei

- **[b11-1] Ce se întâmplă cu bugetul dacă clientul nu atinge glisorul?**
  - **Răspunsul PO (altceva):** „aici o sa avem in felul urmator, bazat pe dimesniuni si materiale o sa se faca un estimat cu ajutorul aplicatiei de ofertare pe care o sa o implementam ulterior in aplicatie”
- **[b11-2] Poate clientul declara un buget mai mic decât estimarea aplicației?**
  - **Răspunsul PO:** Da, glisorul coboară până la o treime din estimare, cu o notă (recomandarea). Clientul își spune bugetul real; firma vede că e sub estimare. Precizare PO: „bazat pe estimarea realista pe care o sa o facem o sa si anuntam clientul ca sunt sanse mici pentru a ne incadra in bugetul dat de catre client si firmele sun mai probabil sa nu accepte acea cerere”
- **[b11-3] Ce facem cu cele trei trepte de buget (sub 5.000, 5.000–15.000, peste 15.000 lei)?**
  - **Răspunsul PO (altceva):** „nu punem trepte ci lasam firmele sa aleaga dintr-un slider suma”
- **[d1-1] La camerele din „am nevoie de ajutor” fără răspunsuri, firma plătește același cost în credite ca azi?**
  - **Răspunsul PO:** Costul scade (altfel decât recomandarea: Costul rămâne ca azi). Cererile de proiectare devin mai ieftine de preluat; costul reflectă doar ce a spus clientul.

## Etapa 4 — Ofertele: refuz, variante și comparație

- **[a4-1] Ce se întâmplă cu firma când clientul îi refuză oferta?**
  - **Răspunsul PO:** Refuz definitiv: locul se închide, creditele se consumă, firma e anunțată (recomandarea). La fel ca „clientul a ales altă firmă”; regulă coerentă cu restul. Locul liber poate fi preluat de altă firmă dacă cererea rămâne deschisă (a1).
- **[a4-2] Motivul refuzului e obligatoriu și îl vede firma?**
  - **Răspunsul PO:** Opțional, din listă scurtă (preț, termen, altă firmă, renunț) + text liber; firma îl vede (recomandarea). Clientul refuză dintr-un clic; firmele primesc semnal util când e dat.
- **[a3-1] Cum aflăm dacă prețul unei oferte conține TVA?**
  - **Răspunsul PO:** Rubrică obligatorie cu trei variante: include TVA / nu include TVA / firma nu e plătitoare (recomandarea). Tabelul calculează „Total cu TVA” corect pentru toate; firma mai bifează o rubrică.
- **[a3-2] Termenul și garanția devin obligatorii în ofertă?**
  - **Răspunsul PO:** Ambele obligatorii (recomandarea). Tabelul e mereu complet; firma nu mai poate trimite o ofertă fără termen.
- **[a3-3] Ce costuri separate trebuie să spună firma în ofertă?**
  - **Răspunsul PO:** Doar bifele pentru transport și montaj (recomandarea). Decizia rămâne neschimbată; proiectarea cerută de firmă rămâne în descriere.

## Etapa 5 — Restul problemelor grave de mărime medie

- **[c10-1] La „Altă piesă”, dimensiunile sunt opționale sau obligatorii?**
  - **Răspunsul PO:** Opționale (lățime, înălțime, adâncime în cm) (recomandarea). Clientul completează ce știe; firma vede dimensiunile în descriere.
- **[c10-2] Cardurile din coș spun doar ce se poate alege azi, sau readucem opțiunile promise?**
  - **Răspunsul PO:** Rescriem textele (recomandarea). O zi de lucru; clientul nu mai e dezamăgit.
- **[d3-1] Ce pondere de tip primesc cele 7 piese noi?**
  - **Răspunsul PO (altceva):** „am scris mai sus cum se calculeaza”
- **[d3-2] Cât contează o cameră cu „Am deja un proiect” la care clientul nu a dat dimensiuni?**
  - **Răspunsul PO:** Cerem lungimea aproximativă (altfel decât recomandarea: „2–4 m” implicit). Un câmp opțional „lungime aproximativă” rămâne și cu proiect propriu; dacă e gol, avem tot „sub 2 m”.
- **[d3-3] Costul unei preluări are un minim și un maxim?**
  - **Răspunsul PO:** Rămâne minim 1, fără maxim (altfel decât recomandarea: Între 3 și 25 de credite). Costul urmează doar punctajul. Proiectele foarte mari pot costa mai mult decât vor firmele să plătească.
- **[e1-1] Ce date de contact ale firmei primește clientul după ce acceptă oferta?**
  - **Răspunsul PO:** Datele persoanei responsabile de cerere (recomandarea). Nume, e-mail, telefon dacă l-a completat, plus adresa și CUI-ul firmei. Fără schimbări în baza de date; clientul vorbește cu omul care lucrează la proiect.
- **[e1-2] Vrei etape de execuție după acceptare (măsurători, contract, producție, montaj)?**
  - **Răspunsul PO:** Etape informative pe care firma le bifează, vizibile clientului, fără să blocheze livrarea (altfel decât recomandarea: Nu acum: doar „Ce urmează” la ambele părți și un dialog clar la livrare). Date noi + migrare; clientul vede progresul; +2–3 zile.
- **[e1-3] Când are voie firma să marcheze proiectul ca livrat?**
  - **Răspunsul PO:** Doar după un număr minim de zile de la acceptare (de exemplu 7) (altfel decât recomandarea: Oricând, dar cu un dialog care spune clar ce urmează și termenul de 14 zile). Regulă nouă de produs; o firmă care livrează repede trebuie să aștepte.
- **[c3-1] La dulap, ușile se întreabă o singură dată, iar deschiderea doar la uși batante?**
  - **Răspunsul PO:** Da: „Ce uși are dulapul?” + mâner / push doar la batante (recomandarea). Un ecran mai puțin la ușile glisante; costul ține cont de ușile glisante.
- **[f3-1] Un cont poate fi folosit în același timp pe mai multe dispozitive (de exemplu telefon și laptop)?**
  - **Răspunsul PO:** Da, până la 5 dispozitive; al șaselea îl scoate pe cel mai vechi (recomandarea). Telefon și laptop merg împreună; se schimbă o regulă tehnică și o decizie scrisă, amândouă finale; aproximativ încă o zi de lucru.
- **[a6-1] Ce îi spunem clientului despre firmele din zona lui?**
  - **Răspunsul PO:** Doar avertisment când nu e nicio firmă (recomandarea). Clientul nu e mințit; nu dezvăluim cât de puține firme avem în alte zone.
- **[a6-2] Lăsăm clientul să publice cererea când nu există nicio firmă în zonă?**
  - **Răspunsul PO:** Da, cu avertisment, iar echipa Cozy Home e anunțată să caute o firmă (recomandarea). Clientul nu pierde cererea; echipa poate recruta firme acolo unde e cerere.

## Etapa 6 — Formularul, prima versiune nouă: material și deschidere

- **[c2-1] Unde întrebăm deschiderea?**
  - **Răspunsul PO:** Doar la piesele cu uși sau sertare (recomandarea). Dispare la rafturi, cuier, oglindă, blat, măsuță, pat fără sertare; la birou, bancă și „altceva” apare cu „Fără uși sau sertare”.
- **[c2-2] Opțiunile de deschidere devin aceleași peste tot: Mâner / Push / Decide firma, iar ușile glisante se întreabă separat, ca tip de uși?**
  - **Răspunsul PO:** Da, listă unică + glisantele ca tip de uși (recomandarea). Glisantele apar doar la dulap și dressing; la bucătărie rămân în plus Gola și Aventos. Precizare PO: „de precizat ca ezista si usi cu deschidere pe pistoane in sus sau in jos la anumite corpuri”
- **[c2-3] La o piesă, clientul alege un singur fel de deschidere sau mai multe?**
  - **Răspunsul PO:** Mai multe, ca azi (altfel decât recomandarea: Unul singur). Mai flexibil, dar costul ia mereu varianta cea mai scumpă.
- **[c1-1] La corpuri, ce întrebăm despre material?**
  - **Răspunsul PO:** Doar „Material pentru fronturi”; corpul e PAL standard, scris sub întrebare (recomandarea). Zero întrebări în plus; firma vede „Fronturi: MDF vopsit, corp PAL standard”; cine vrea alt corp scrie la „Altul” sau în detalii. Precizare PO: „exista cazuri rare in care de exemplu in bai sau pe balcoane cand se face integral din mdf”
- **[c1-2] La canapea, fotoliu și taburet, ce întrebăm despre material?**
  - **Răspunsul PO:** Nimic: cadrul îl decide firma (recomandarea). Un ecran mai puțin; costul ia punctaj mediu, ca azi la „Altul”.
- **[c1-3] Oglinda, masa și patul primesc opțiuni proprii, fără prețul pe metru liniar?**
  - **Răspunsul PO:** Da, opțiuni proprii fiecărei piese (recomandarea). Oglinda: ramă fără / lemn / MDF vopsit / metal / decide firma. Masa și patul: setul de lemn, fără preț pe metru. Opțiuni potrivite piesei; câteva texte și imagini noi.
- **[c7-1] La ce întrebări punem „Nu știu — vreau recomandarea firmei”?**
  - **Răspunsul PO:** Material, deschidere și blat (recomandarea). Acoperă întrebările tehnice pe care clientul obișnuit nu le știe; restul rămân cum sunt.
- **[c7-2] Cât costă în credite „decide firma”?**
  - **Răspunsul PO:** Mediu: la material ca „Altul” (2), la deschidere 0 (recomandarea). Nu încurajează trișatul și nu pedepsește firma; nu cere setări noi.
- **[c14-1] Punem materialul și deschiderea aceleiași piese pe un singur ecran?**
  - **Răspunsul PO:** Da, un ecran pe piesă (recomandarea). Jumătate din ecrane; se schimbă decizia din 2026-07-13 și se notează în jurnalul de decizii.
- **[c14-2] Întrebăm „Același material și aceeași deschidere pentru toate piesele?”**
  - **Răspunsul PO:** Da, fără răspuns preselectat (recomandarea). La „Da” un singur ecran pentru toată camera; la „Nu” câte unul pe piesă.
- **[c14-3] În modul „Am deja un proiect”, materialul și deschiderea devin opționale?**
  - **Răspunsul PO:** Nu, rămân obligatorii, cu „decide firma” (altfel decât recomandarea: Da, opționale (proiectul atașat e sursa)). Firma primește mereu un răspuns pe fișă, dar clientul cu proiect repetă ce e deja în proiect.

## Etapa 7 — Probleme medii, mici ca efort

- **[a7-1] Firma vede suma estimată de client înainte să plătească preluarea?**
  - **Răspunsul PO:** Da, suma estimată (nu e dată de contact) (recomandarea). Firma decide mai bine dacă merită creditele; clientul nu pierde nimic personal.
- **[b12-1] Din ce țări poate fi adresa de montaj?**
  - **Răspunsul PO (altceva):** „exista firme care lucreaza cu clienti si din alte tari, si invers clienti care cauta firme romanesti pentru un montaj in afara tarii”
- **[d5-1] Vrei o filă „Ciorne” în „Cererile mele”?**
  - **Răspunsul PO:** Da, cu „Continuă” și „Șterge”, pentru ciornele legate de cont (recomandarea). Clientul își reia ciorna de pe orice dispozitiv; cam o zi de lucru, cu server.
- **[d4-1] Vrei ca imaginea 3D a piesei să apară în Sumar și pe pagina cererii, pentru client?**
  - **Răspunsul PO:** Da, miniatură în Sumar și pe pagina cererii (recomandarea). Clientul vede exact ce primesc firmele; schimbă decizia „invizibilă”.

## Etapa 8 — Formular și texte: afișare, validare, telefon

- **[c4-1] Păstrăm comutatorul m / cm / mm sau trecem totul pe centimetri?**
  - **Răspunsul PO:** Păstrăm comutatorul, iar Sumarul urmează alegerea clientului (altfel decât recomandarea: Doar centimetri, fără comutator). Clientul vede unitatea aleasă peste tot; firma vede tot cm, ca să compare cererile ușor.
- **[i1-1] Cum numim proiectarea pe care clientul o plătește firmei și ce îi spunem despre cost?**
  - **Răspunsul PO (altceva):** „cand un client apasa pe proiectare cu plata atuni fiecare firma o sa vina mai intai cu un raspuns legat de pretul proiectarii si ce include dupa care clientul alege cu ce firma merge mai departe pentru a proiecta impreuna piesele de mobilier”
- **[i1-2] Cum numim locul unde firmele găsesc cererile (azi „marketplace”)?**
  - **Răspunsul PO:** Firmele: „Cereri disponibile”; clientul: „cererea ajunge la firmele din zonă” (recomandarea). Fără englezisme; meniul firmei se schimbă.
- **[i1-3] Cum numim lucrul după ce clientul a acceptat o ofertă?**
  - **Răspunsul PO:** „Comandă” după acceptare, „cerere” înainte (recomandarea). Clar pentru client: a acceptat, deci a comandat; „comandă” la plățile firmei devine „plată”.
- **[d2-1] Ce facem când clientul trece de pasul 3D fără să schimbe nimic?**
  - **Răspunsul PO:** Marcăm „orientativ” la firmă (recomandarea). Clientul nu are pas în plus. Firma vede „Dimensiuni orientative — clientul nu le-a modificat”.
- **[d2-2] Cum pornesc dulapul și comoda TV în ce privește ușile și fronturile?**
  - **Răspunsul PO:** Cu uși / sertare implicit (recomandarea). Dulapul pornește cu uși batante pe toate zonele, comoda TV cu un rând de sertare. Ce vede clientul corespunde cu ce ajunge la firmă.
- **[d2-3] Deschiderea „Push” lăsată pe implicit intră și în costul în credite?**
  - **Răspunsul PO:** Da, se punctează (recomandarea). Ce vede firma și ce plătește se potrivesc; piesele cu fronturi devin cu 1–2 credite mai scumpe.

## Etapa 9 — 3D, notificări, portofel și ciorne vechi

- **[l1-1] Ce înălțime maximă are un front de sertar și ce facem când zona e mai mare?**
  - **Răspunsul PO (altceva):** „maxim 50 de cm zona se strange”
- **[l1-2] Strângem limitele discutabile din configurator?**
  - **Răspunsul PO:** Bibliotecă 80 cm, comodă TV min. 35 cm (recomandarea). Clientul nu mai poate cere piese greu de făcut; ciornele în afara limitelor se ajustează cu mesaj.
- **[l1-3] La masă, „extensibilă” devine o opțiune separată de formă (da/nu)?**
  - **Răspunsul PO:** Da, separat, doar la dreptunghiulară (recomandarea). Extensibil devine opțiune pentru masa dreptunghiulară de dining, iar formele rămân două. Cererile vechi rămân valide.
- **[g1-1] Cine din firmă primește e-mail pentru o cerere preluată (mesaj nou, ofertă acceptată etc.)?**
  - **Răspunsul PO:** Responsabilul cererii + proprietarul și managerii (recomandarea). Mai puține e-mailuri inutile; conducerea vede tot.
- **[g1-2] Cum află firmele că a apărut o cerere nouă în zona lor?**
  - **Răspunsul PO:** Clopoțel imediat ce cererea le devine vizibilă, plus rezumatul zilnic pe e-mail (recomandarea). Reacție rapidă în aplicație fără să inunde e-mailul; puțin mai mult de lucru (+0,5 zile).
- **[f6-1] Cât timp păstrăm o ciornă la care nimeni n-a mai lucrat?**
  - **Răspunsul PO:** 7 zile pentru vizitatori, 90 de zile pentru clienții cu cont (altfel decât recomandarea: 30 de zile). Mai puține date străine păstrate, mai mult timp pentru clienții reali; puțin mai multă muncă.
- **[f6-2] Când clientul republică o cerere expirată cu modificări, asta se socotește ca una dintre cele 3 editări permise?**
  - **Răspunsul PO:** Nu, republicarea cu modificări e un pas separat (recomandarea). Clientul poate ajusta liber bugetul, termenul și mesajul o dată, apoi are tot 3 editări.
- **[f6-3] Ștergem acum de pe producție cele aproximativ 70 de ciorne de test lăsate de audit (cu „[TEST AUDIT]” în mesaj)?**
  - **Răspunsul PO:** Da, acum, cu copie de rezervă înainte (altfel decât recomandarea: Nu acum, le lasă jobul să le șteargă la termen). Un script care ia doar ciornele DRAFT cu „[TEST AUDIT]”, le listează întâi și apoi le șterge cu fișierele lor; îl rulezi tu sau mă lași să-l rulez.

## Etapa 10 — Formularul, a doua versiune nouă: măsuri și întrebări lipsă

- **[c9-1] Ce grupe de întrebări noi intră în formular?**
  - **Răspunsul PO:** Doar cele care schimbă prețul (recomandarea). Bucătărie (fără corpuri sus, chiuvetă, frigider), dormitor (stofa patului, interiorul dulapului, mărimi de saltea), baie (lavoar), spălătorie (încărcare), canapea (extensibilă, ladă), pat (altă mărime), masă (extensibilă); aprox. 8 zile.
- **[c9-2] Întrebările noi sunt obligatorii sau opționale?**
  - **Răspunsul PO:** Opționale, cu „Nu știu — decide firma” (recomandarea). Formularul nu blochează pe nimeni; firma vede ce a ales clientul sau că așteaptă recomandarea ei.
- **[c9-3] Răspunsurile noi schimbă costul în credite?**
  - **Răspunsul PO:** Doar „fără corpuri suspendate” (scade) și canapeaua extensibilă (crește); restul 0 puncte (recomandarea). Costul se schimbă doar unde munca se schimbă clar; adminul poate regla restul mai târziu.
- **[c5-1] Când cerem înălțimea tavanului?**
  - **Răspunsul PO:** Doar când există o piesă înaltă (recomandarea). Mai puține câmpuri pentru client; firma primește tavanul exact unde contează (dulap, bibliotecă, coloană).
- **[c5-2] Ce măsuri cerem pe fiecare piesă?**
  - **Răspunsul PO:** Lățime obligatorie, înălțime opțională la piesele înalte (recomandarea). Aceeași regulă peste tot; clientul care nu știe înălțimea o lasă goală și o stabilește cu firma.
- **[c5-3] La balcon, spălătorie și debară cerem lățimea fiecărei piese, pe lângă lungimea peretelui?**
  - **Răspunsul PO:** Da, lățimea pieselor dă mărimea, peretele rămâne informativ (recomandarea). Un raft mic pe un balcon lung nu mai costă cât un balcon mobilat; un ecran puțin mai lung.

## Etapa 11 — Pornirea firmei noi

- **[h1-1] Cum intră un coleg nou în firmă?**
  - **Răspunsul PO:** Rămâne așa, dar cu explicație clară în formular și e-mail către colegul adăugat (recomandarea). Fără date noi; inclus în cele 6 zile.
- **[h1-2] Proprietarul firmei poate edita mereu toate câmpurile ofertei, indiferent de bifele din permisiuni?**
  - **Răspunsul PO:** Da, proprietarul are mereu toate drepturile; coloana lui devine needitabilă (recomandarea). Schimbă o regulă de produs scrisă; nimeni nu se mai poate bloca singur.

## Etapa 12 — Mărunțișuri: texte, formate, curățenie

- **[c12-1] Cum arătăm prețul materialelor, care azi e „pe metru liniar”?**
  - **Răspunsul PO:** „lei / m liniar” scris întreg, cu o frază în detalii (recomandarea). Clientul vede cifre reale și află ce înseamnă metrul liniar; rămâne doar la corpuri (după c1).
- **[k2-1] Când administratorul ridică o suspendare, ce se întâmplă cu punctele de penalizare ale firmei?**
  - **Răspunsul PO:** Punctele active se anulează (firma o ia de la zero) (recomandarea). Ridicarea e un nou început; istoricul rămâne în audit.
- **[i3-1] Ce adresă de e-mail publică folosim pentru contact pe site?**
  - **Răspunsul PO:** O adresă pe domeniul firmei (ex. contact@ sau suport@) (recomandarea). Arată serios; trebuie creată căsuța și pusă în setări și în e-mailurile de cont.
- **[c11-1] Cum numim biroul ca piesă, ca să nu se confunde cu camera „Birou”?**
  - **Răspunsul PO:** Camera „Birou”, piesa „Birou de lucru” (recomandarea). Titlul devine „Birou + Birou de lucru — Oraș”; numele camerei rămâne cel cunoscut.
- **[c13-1] La balcon deschis, ce facem cu materialele de interior (PAL, MDF)?**
  - **Răspunsul PO:** Doar avertisment, fără materiale noi (recomandarea). Se poate face imediat; firma propune materialul de exterior în ofertă.

