# Note coordonator (M) — teste cu cont, pe stiva LOCALA (aceeasi versiune ca prod: c478174 = ef42664 + CHANGELOG)

PO a ales: partea cu cont se testeaza local; pe productie doar vizitator (agentii L1–L7).

## Stare de pornire locala (2026-11-12 ~20:30)
- Referinta setari admin + firme + portofele + abonamente: `scratchpad\audit\baseline\*.json`.
- Firme: A SUSPENDED (12 puncte, pana 2027-05-11), B APPROVED (abonament cu data expirata 2026-09-20 dar status ACTIVE in DB), C SUSPENDED,
  D PENDING, E PENDING, F REJECTED, G SUSPENDED, H APPROVED (abonament expirat ca data), Mobila Unicat APPROVED fara abonament.
- Parola demo locala merge doar la: admin, ana.popescu, mihai.ionescu, owner.a, mgr.a, owner.d (+ legal.test1 neverificat).

## Ce am schimbat local (de readus / de raportat)
1. Admin → Firme → A Mobila Premium: „Ridica suspendarea” (era SUSPENDED pana 2027-05-11; punctele de penalizare au ramas 12).
2. Admin → Firme → D Atelier Bucov: „Aproba firma” (era PENDING_VERIFICATION) → a pornit perioada de proba: GOLD 30 zile + 10 credite (200 → 210).

## Constatari (M-xx)
- M-01 (P3, admin) Lista de firme si pagina firmei arata sub eticheta romaneasca si codul brut al starii („ÎN AȘTEPTARE” + `PENDING_VERIFICATION`, „APROBATĂ” + `APPROVED`).
- M-02 (P2, admin) „Ridica suspendarea” nu cere motiv (respingerea cere motiv de min. 3 caractere). Punctele de penalizare raman 12 = pragul de suspendare → de verificat daca jobul o resuspenda.
- M-03 (P2, date) Abonamentele cu data expirata raman cu status ACTIVE in DB (B: GOLD pana 2026-09-20; H, C, G la fel); tabloul de bord numara corect „Abonamente active 1” dupa data. De verificat ce vede firma B.
- M-04 (P3, text) Meniul admin spune „Proiecte” pentru `/admin/requests`, restul aplicatiei spune „cereri”.
- M-05 (P3, admin) Pagina de verificare a firmei nu arata niciun document (certificat, act); decizia se ia doar pe CUI + J + adresa + portofoliu. De discutat.
- M-06 (info) Login: dupa 5 incercari / minut apare „Prea multe încercări una după alta. Așteaptă un minut și încearcă din nou.” — clar. Limita e pe IP (5/min): un birou cu acelasi IP o poate atinge.
- M-07 (P3, local/dev) Dupa login reusit (200) pagina a ramas ~6 s pe /login fara niciun semn de incarcare (compilare dev); de verificat pe prod daca butonul arata stare de asteptare.

## Ce am mai schimbat local
3. Admin → Setari → Planuri de abonament → GOLD „Intarziere la cererile noi”: 30 → 0 minute (TEMPORAR; de readus la 30).

## Scenariul S01 (facut de mana in panoul de browser, local) — 2026-11-12 20:40–20:50
Ana (client) → mod „Nu stiu exact ce vreau — am nevoie de ajutor” → Bucatarie + Living → 1 fisier PNG → buget „Peste 15.000”, termen 1–3 luni,
adresa Bd. Unirii 10 (Google Places) → Publica. Cerere `96461e98…` IN_MARKETPLACE, MEDIUM, 20 credite, expira in 7 zile.
Firma A (owner.a) → Marketplace → „Vezi si preia” → „Preia cererea…” → confirmare → fisa de lucru → oferta (14.500 + 6.200 + proiectare 1.200 = 21.900 RON,
6 saptamani, garantie 24 luni) → 2 mesaje in conversatie (al doilea cu telefon + e-mail de test).

## Constatari (continuare)
- M-08 (P1, defect, confirmat) Dupa „Publica cererea”, ~5 s formularul sare inapoi la pasul 1 „Cum pornim cererea?” cu avertismentul galben
  „Ciorna salvata doar pe acest dispozitiv”; un PATCH pe ciorna tocmai publicata primeste 404. Abia apoi vine pagina cererii. Niciun mesaj „Cererea a fost publicata”.
  Clientul poate crede ca a esuat si o ia de la capat. (Local/dev intarzierea e mai mare din cauza compilarii; cursa PATCH-dupa-publish e reala.)
- M-09 (P1, defect, confirmat) In modul „am nevoie de ajutor” clientul NU raspunde la nicio intrebare, dar pagina cererii (client) si piata (firma) arata
  „Bucatarie: Corpuri baza — PAL, Corpuri suspendate — PAL; Living: Mobilier living — PAL”. Sunt valori implicite inventate, prezentate ca alegerea clientului
  (si fara diacritice). Firma citeste „PAL” acolo unde clientul n-a ales nimic.
- M-10 (P1, confirmat CS-03) Fisierul incarcat la pasul Fisiere NU apare firmei inainte de preluare (pagina `/marketplace/<id>` nu are sectiune de atasamente),
  desi formularul spune „Fisierele sunt vizibile firmelor verificate din zona ta inainte de preluare”.
- M-11 (P1, confirmat CS-04) Mesajul scris la „Date generale” se pierde la „Inapoi” → „Continua” (campul revine gol), in timp ce antetul arata „Ciorna salvata la HH:MM”.
- M-12 (P2, confirmat CS-05) Un fisier de tip nepermis (.txt) tras in zona de incarcare dispare fara niciun mesaj; serverul raspunde 400, interfata tace.
  In plus `…/attachments/<id>/confirm` e apelat de 3 ori pentru acelasi fisier.
- M-13 (P1, UX) Firma pe GOLD nu vede cererea 30 de minute dupa publicare (SILVER 60, PLATINUM 0), iar pagina goala spune doar „Nicio cerere disponibila momentan”.
  Nicaieri nu scrie ca pe planul ei cererile apar cu intarziere. (Clientului i se spune „Cererea e vizibila firmelor verificate din zona ta”.)
- M-14 (P1, UX) Dupa ce PROPRIETARUL preia cererea, fisa de lucru arata „Se ocupa: Neatribuit — Fara responsabil — preluarea se anuleaza automat in 59 de min”.
  Cel care preia nu devine automat responsabil; dialogul de preluare nu avertizeaza. Dupa trimiterea ofertei ramane tot „Neatribuit”.
- M-15 (P2, UX) Termenul de raspuns (aici 5 zile, pana 17 nov. 23:59) se afla abia DUPA preluare; panoul si dialogul de preluare spun doar „in termenul de raspuns”.
- M-16 (P3, text) Jargon in interfata firmei: „Sloturi 0/3”, „Termen pentru oferta (SLA)”, „termenul SLA”, „Termen SLA depasit”, „Anulata (neatribuita)”.
  In alte locuri acelasi lucru e „Termen de raspuns depasit”.
- M-17 (P3) Dupa preluare, sub titlu ramane „datele clientului si adresa exacta apar dupa preluare”. Nici la preluare, nici la trimiterea ofertei nu apare o confirmare (toast).
- M-18 (P2, text) Aceeasi rubrica are alt nume in formular si in sumar / pagina cererii: „Mesaj pentru firme” → „Detaliile proiectului”; „Adresa” → „Locul montajului”;
  „Preferinte de contact” → „Canale de contact”; „Proiectare cu plata inclusa” → „Include proiectare cu plata” + „Ajutor pentru planificarea mobilierului” (doua randuri pentru acelasi lucru).
  Antetul formularului: „COMANDA NOUA” / „Configureaza-ti proiectul” / „Cum pornim cererea?” — trei cuvinte pentru acelasi lucru.
- M-19 (P3) Adresa in sumar: „Bulevardul Unirii 10, București, București, RO” (oras + judet repetat + cod de tara).
- M-20 (P2) Lista de tari la adresa are 23 de tari (Germania, Spania, Finlanda…), desi firmele sunt in Romania si raza lor e in km.
- M-21 (P2) Buget: 3 trepte (sub 5.000 / 5.000–15.000 / peste 15.000 RON), implicit pe prima. In modul „am nevoie de ajutor” ramane „Sub 5.000 RON” daca clientul nu atinge sliderul,
  iar bugetul intra in costul in credite. Treapta de sus („Peste 15.000”) e prea joasa pentru o bucatarie + living.
- M-22 (P3) „Fisa cererii” arata „FISIERE — optional” si dupa ce am incarcat un fisier.
- M-23 (P2) Formularul de oferta: TVA-ul nu e rubrica (doar indemn in descriere); exista si „Termen de livrare” si „Data livrarii” (se pot contrazice); campul de data arata `mm/dd/yyyy` in browser cu limba engleza.
- M-24 (P3) Panoul firmei: „12 puncte active din 12” dar lista arata 3 evenimente (9 puncte); firma e la prag si totusi „Firma aprobata” dupa ridicarea suspendarii.

## S01 — partea clientului (20:55–21:00)
Ana → pagina cererii („OFERTE PRIMITE — E randul tau: ai o oferta de analizat”) → „Vezi ofertele si conversatiile” → tabelul „Ofertele, una langa alta” (o singura coloana)
→ mesaj in conversatie → „Cere modificare” (text liber) → pe oferta apare „Modificare solicitata: …” + „Astepti raspunsul firmei la modificarea ceruta”.

- M-25 (P1, PRODUS — cel mai important din sesiune) Dupa PRIMA oferta primita, cererea iese din marketplace: clientului i se spune „Cererea nu mai apare in lista firmelor,
  deci firme noi nu o mai pot vedea”. Cauza: setarea de admin `claims_open_after_first_offer` = false, care e valoarea IMPLICITA in cod (seed.ts:167,
  setting-defaults.ts:11, migrarea 20260930120000). Efect: daca prima firma oferteaza repede (aici in 2 minute), a doua si a treia firma nu mai pot prelua →
  clientul primeste O oferta, nu trei. Promisiunea de pe prima pagina („Trei firme. Trei oferte. Una langa alta.”) nu se poate tine, iar prima firma are interesul
  sa trimita rapid orice oferta ca sa-si inchida concurenta. Tabelul de comparare apare cu o singura coloana. De verificat valoarea setarii pe productie.
- M-26 (P2) Tabelul de comparare: rubricile sunt Total / Termen / Garantie / Valabilitate; pagina de start promite Pret / Termen / Garantie (confirmat CS-12).
  Subtitlul paginii repeta orasul: „Bucatarie + Living — București — București”.
- M-27 (P3) Butonul „Trimite” din conversatie, cu campul gol, nu face nimic si nu spune nimic (nici dezactivat, nici mesaj).
- M-28 (P2) Clientul vede in conversatie telefonul si e-mailul scrise de firma (dupa preluare e permis), dar nicaieri nu i se spune ca firma ii vede deja
  datele de contact; pagina cererii arata doar „A Mobila Premium — preluata pe 12 nov., 20:48” la „Nume, adresa si date de contact”.
- M-29 (P3) „Cere modificare” e doar un text liber atasat ofertei; nu e legat de rubrici (pret / termen / material) si nu apare si in conversatie.

## Productie — pagini publice citite ca vizitator (21:05)
- M-30 (P1, PRODUS, confirmat pe productie) `/ro/firm-rules` de pe productie spune negru pe alb: „Din momentul in care una dintre firmele care au preluat cererea
  trimite prima oferta, cererea nu mai poate fi preluata de alte firme, chiar daca nu s-au ocupat toate cele 3 locuri.” Deci M-25 e si pe productie.
  Combinat cu intarzierea pe plan (PLATINUM vede cererea imediat, GOLD dupa 30 min, SILVER dupa 60 min — local; pe productie de verificat in Setari),
  o firma PLATINUM poate prelua si oferta inainte ca firmele GOLD / SILVER sa vada macar cererea. Pagina de reguli NU pomeneste intarzierea pe plan.
- M-31 (P1, productie) `/ro/partners` de pe productie afiseaza public firmele DEMO ca „FIRMA VERIFICATA — Partener din iulie 2026”: A Mobila Premium, B DesignWood,
  C CasaMea, G MobMaster, H VintageHaus (+ Mobila Unicat, reala). Un vizitator le ia drept firme reale verificate.
- M-32 (P3, text, productie) Regulile spun „…creditele rezervate se consuma si firma primeste 0 puncte de penalizare” (propozitia ar trebui sa dispara cand valoarea e 0),
  iar „3 zile lucratoare pentru proiectele mici, 3 zile lucratoare pentru cele medii si 5 pentru cele mari” repeta aceeasi valoare. Dialogul de preluare (vazut local)
  spune totusi „…creditele se consuma si firma primeste puncte de penalizare”.
- M-33 (P3, productie) Adresa publica de contact din subsol si din reguli e o adresa personala de Yahoo.
- M-34 (info, productie) Termenii si Politica de confidentialitate sunt complete (fara locuri goale), pagina 404 e prietenoasa, identitatea operatorului apare in subsol.
- M-35 (P1, confirmat local CP-03) In baza locala, `project_sizing_config` are pondere ROOM_TYPE pentru 21 de tipuri, dar NU pentru cele 7 piese de catalog
  (bufet, corp suspendat, masca de baie, mobilier hol, canapea, fotoliu, taburet) → pondere 0 → cost in credite prea mic. De verificat pe productie in Admin → Marime proiect.
