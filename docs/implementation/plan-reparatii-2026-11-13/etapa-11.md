# Etapa 11 — Pornirea firmei noi

Locul 52. Firma nou aprobată află ce are de făcut, își poate invita colegii pe e-mail și își poate seta raza și locațiile fără coordonate scrise de mână.

- Mărime: 6 zile de lucru
- Module atinse: backend/companies, backend/notifications, backend/prisma-seed, backend/quotes, backend/uploads, frontend/company, frontend/dashboard
- Tabele atinse: company_locations, company_members, company_offer_field_permissions, company_portfolio_items, subscriptions, users
- Gata când: O firmă nou aprobată ajunge de la panou la prima preluare fără ajutor din afară.

## 52. Firma nouă nu e ajutată să pornească (`h1`, P2)

- Mărime: 6 zile · risc mediu
- De ce contează: Panoul spune „Nimic urgent acum”. Un coleg nu poate fi invitat pe e-mail. Raza de acoperire nu se poate schimba din interfață, o locație nouă cere coordonate scrise de mână, iar portofoliul primește doar adresa unei poze. Firmele demo aprobate ulterior nu pot oferta.
- Cauza: Aplicația presupune că firma știe deja ce are de configurat: echipa se adaugă doar cu conturi existente, locația cere coordonate scrise de mână, portofoliul cere un link public la poză, iar panoul nu arată pași. Datele demo creează permisiunile ofertei doar pentru firmele aprobate la încărcare, iar serverul refuză orice câmp fără permisiune scrisă.
- Ce s-a văzut în cod: Toate cinci confirmate: invitarea merge doar pentru un cont de firmă deja creat; panoul nu are pași de pornire; locația nu se poate modifica din interfață (există doar ștergerea, deși serverul permite modificarea); portofoliul primește doar adresa unei poze. Permisiunile lipsă sunt de date demo (firmele aprobate ulterior din seed), dar și serverul nu are nicio valoare implicită, iar regula scrisă lasă proprietarul să-și scoată singur drepturile.
- Risc: Matricea implicită la lipsă de rânduri poate da prea multe drepturi unui angajat dacă o firmă și-a șters intenționat rândurile; încărcarea pozelor adaugă o cale nouă de fișiere publice.

**Pași**

1. Permisiuni: dacă firma nu are niciun rând, se aplică matricea implicită (aceeași ca la înscriere), iar regula pentru proprietar urmează decizia PO; datele demo creează permisiunile pentru toate firmele.
2. Echipă: mesaj clar când persoana nu are cont de firmă („Roag-o să se înregistreze ca Firmă cu acest e-mail, apoi adaug-o aici”) și e-mail + clopoțel către membrul adăugat; invitația cu link doar dacă o alege PO.
3. Locații: buton „Modifică” care folosește modificarea existentă pe server (rază cu selector), iar adresa folosește sugestiile Google din formularul de cerere și completează coordonatele singure.
4. Portofoliu: încărcare de poză prin legături presemnate (ca la fișierele cererii), mesajul serverului afișat pe câmp și o imagine de rezervă când poza nu se încarcă.
5. Panou: card „Pregătește-ți firma” cu pașii (portofoliu, locații și rază, echipă, e-mail de facturare, permisiuni) și progres; o frază clară despre proba gratuită: până când ține și ce se întâmplă după (fără reînnoire automată).
6. Texte RO/EN pentru toate cele de mai sus.

**Unde în cod**

- apps/backend/src/modules/companies/companies.service.ts:524 — adăugarea în echipă caută doar un cont de firmă existent; altfel „nu am găsit”
- apps/frontend/src/hooks/use-company.ts:83 — pentru locații interfața are doar ștergere; modificarea există pe server (apps/backend/src/modules/companies/companies.controller.ts:68)
- apps/frontend/src/app/[locale]/company/_components/portfolio-section.tsx:31 — lucrarea din portofoliu are titlu, descriere și adresă de imagine, fără încărcare
- apps/frontend/src/messages/ro.json:621 — „Nimic urgent acum” e tot ce vede o firmă nouă
- apps/backend/src/modules/quotes/quotes.service.ts:1523 — fără rânduri de permisiuni orice câmp e refuzat, inclusiv la proprietar
- apps/backend/prisma/seed-demo.ts:117 — permisiunile se creează doar pentru firmele demo deja aprobate (firmele reale le primesc la înscriere, companies.service.ts:331)

**Cum se verifică**

- Test backend: firmă fără rânduri de permisiuni poate trimite oferta ca proprietar; angajatul cu rol limitat tot nu poate schimba prețul.
- Test backend: modificarea locației respectă raza minimă și plafonul de schimbări; încărcarea pozei refuză fișierele care nu sunt imagini.
- Verific pe local o firmă nouă de la zero: panou, echipă, locație, portofoliu.

**Documente de adus la zi**

- 03-business-rules.md §4.13 (Permisiuni câmpuri ofertă) (contrazice): Regula spune că proprietarul ajustează matricea (deci își poate scoate drepturile); „proprietarul are mereu tot” ar schimba-o.

**Legături**

- nr. 15 (`k1`): Ambele ating datele demo ale firmelor.
- nr. 5 (`h2`): Textul despre sfârșitul probei folosește același mesaj de abonament unificat la h2.
- nr. 31 (`b12`): Componenta de adresă refolosită pentru locații e reparată la b12.
- nr. 2 (`b5`): Mesajele pentru fișiere respinse se refolosesc la încărcarea pozelor de portofoliu.

**Alegeri mărunte făcute fără PO (se pot schimba)**

- O lucrare din portofoliu poate avea mai multe poze? → O singură poză pe lucrare, încărcată din calculator. Fără date noi; inclus în estimare.

**Întrebări și răspunsuri**

- **[h1-1] Cum intră un coleg nou în firmă?**
  - Context: Azi colegul trebuie să-și facă singur cont de tip Firmă, apoi proprietarul îl adaugă după e-mail; colegul nu primește niciun mesaj.
  - Variante: 1) Rămâne așa, dar cu explicație clară în formular și e-mail către colegul adăugat · 2) Invitație pe e-mail, cu link
  - **Răspunsul PO:** Rămâne așa, dar cu explicație clară în formular și e-mail către colegul adăugat (recomandarea). Fără date noi; inclus în cele 6 zile.
- **[h1-2] Proprietarul firmei poate edita mereu toate câmpurile ofertei, indiferent de bifele din permisiuni?**
  - Context: Regula scrisă lasă proprietarul să ajusteze matricea, deci și să-și scoată singur drepturile; atunci nici el nu mai poate trimite oferte.
  - Variante: 1) Da, proprietarul are mereu toate drepturile; coloana lui devine needitabilă · 2) Nu, regula rămâne; doar firmele fără niciun rând primesc matricea implicită
  - **Răspunsul PO:** Da, proprietarul are mereu toate drepturile; coloana lui devine needitabilă (recomandarea). Schimbă o regulă de produs scrisă; nimeni nu se mai poate bloca singur.

