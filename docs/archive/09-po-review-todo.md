# Verificare integrala site + TODO pentru acordul PO — 2026-07-11 (feedback r2, item 15)

> **UPDATE 2026-07-12 — PO a aprobat TOT.** Executat in sprinturile Q1–Q6 (vezi
> CHANGELOG): D1 pastrat, D2 (25MB), D3 (jest + 32 teste) si ideile 1–7 sunt
> LIVRATE. D4 ramane post-MVP (conform propunerii aprobate), D5 se ruleaza la
> urmatorul deploy pe Railway, D6 asteapta cheia GCP de la PO, ideea 8 (QA
> vizual pe telefon) ramane la PO. Statusul per item e marcat mai jos.

Toate cele 14 iteme de modificare au fost livrate in sprinturile P1–P7 (vezi CHANGELOG).
Acest document e pasul 15: ce am verificat la final si **lista de idei/decizii care
asteapta acordul tau** — nimic de aici nu e implementat fara OK-ul tau explicit.

## 1. Ce am verificat la final (P8)

- **Typecheck**: verde pe shared + backend + frontend. **Lint**: verde. **Teste**: 45/45 (shared).
- **Build de productie frontend**: compilare reusita + 51/51 pagini generate.
  (Faza finala „standalone symlinks” pica DOAR local pe Windows, fara drepturi de
  symlink — in Docker/Railway trece; nota mai jos.)
- **E2E publicare pe flow v2 nou** (Balcon, prin API, cont demo): draft → publish →
  IN_MARKETPLACE, titlu generat „Balcon — Iasi”, items derivate per piesa
  („Banca cu depozitare — ALTUL — Push — *Material dorit: ratan cu lemn tratat*”,
  „Rafturi balcon — LEMN MASIV”), pagina de detaliu client randeaza spec-card-ul
  complet (chips configuratie + corpuri + dimensiuni exacte).
- **Filtrarea de acoperire functioneaza**: firma din Bucuresti NU vede cererea din Iasi
  („Request not visible to your company”).
- **E2E mesaje + notificari** (P4): mesaj de la owner.b → notificare cu titlu/context/
  link la client → click → navigare + unread 0 server-side.
- **E2E colectii** (P6): creare → salvare → coperta colaj → nume duplicat respins.
- **Admin** (P7): 13 endpoint-uri + 9 pagini verificate; scrierile lasa urme in audit.
- **Item 14 verificat**: `/` cu Accept-Language englez → 307 spre `/ro`.

## 2. DECIZII care asteapta raspunsul tau — **toate aprobate 2026-07-12**

| # | Decizie | Status |
|---|---------|--------|
| D1 | **Numele „Caietul de idei”** | ✅ APROBAT — numele ramane. Zero cod. |
| D2 | **Limita fisiere 10MB vs 25MB** | ✅ LIVRAT (Q5) — `MAX_ATTACHMENT_BYTES` = 25MB + textele i18n; verificat: 20MB acceptat, 26MB respins. |
| D3 | **Teste backend (jest neinstalat)** | ✅ LIVRAT (Q6) — jest instalat, 32 de teste pe credite/claim/upload/calendar/emailuri; `pnpm -F backend test` verde. Bonus: testele au prins si reparat un bug de ~1s in deadline-urile de sfarsit de zi (`BusinessCalendarService.tzOffsetMs`). |
| D4 | **Scan AV real la fisiere** | ⏳ POST-MVP (conform propunerii aprobate) — ClamAV in container sau scanning S3, planificat dupa lansare. |
| D5 | **Re-seed pe Railway** | ⏳ LA URMATORUL DEPLOY — ruleaza `UPDATE notifications SET read_at=now() WHERE payload::text LIKE '%"demo": true%' AND read_at IS NULL;` pe DB-ul Railway (sau re-seed curat). |
| D6 | **Cheia Google Places** | ✅ PRIMITA (2026-07-12) — configurata local in `apps/frontend/.env.local` (gitignorat) si se seteaza ca `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in env-ul frontend pe Railway (build-time). Recomandare: restrictioneaza cheia pe domeniu in consola GCP. |

## 3. IDEI de imbunatatire — **toate aprobate 2026-07-12; 1–7 LIVRATE (Q1–Q5)**

1. ✅ **Necitite in conversatii** (Q2) — tabela `chat_thread_reads` (un rand per
   utilizator per conversatie, mai ieftin decat un rand per mesaj — acelasi rezultat)
   + punct rosu si „N mesaje noi” pe sectiunile necitite din „Oferte si conversatii”
   + badge pe tabelul de revendicari al firmei; conversatia devine citita cand chatul
   e vizibil/atins.
2. ✅ **Filtre pe „Cererile mele”** (Q3) — taburi Toate / Active / In lucru /
   Finalizate / Expirate cu numaratori.
3. ✅ **Lightbox mai Pinterest** (Q1) — buton Salveaza in lightbox, navigare ←/→
   (butoane + tastatura), „Idei asemanatoare” dedesubt (aceeasi camera sau
   materiale/culori comune, din lista filtrata).
4. ✅ **Mutare intre colectii** (Q1) — endpoint atomic `POST …/items/:photoId/move`;
   click pe „Salvat” deschide meniul „Muta in colectia… / Scoate din colectie”;
   buton „Muta” si pe pagina colectiei.
5. ✅ **Emailuri de notificare** (Q4) — email la oferta noua / mesaj nou / cerere
   preluata, in limba contului, doar catre partea cealalta (nu si colegilor
   expeditorului); link de dezabonare semnat HMAC (fara login) + toggle „Primeste
   si pe email” in clopotel; `users.email_notifications_enabled`.
6. ✅ **Paginare in galerie** (Q5) — infinite scroll cu pagini de 40 + buton
   „Mai multe idei” fallback; API cu `limit/offset` si sortare stabila.
7. ✅ **Plansa de dimensiuni si la Hol** (Q3) — vedere frontala compusa: piesele
   selectate una langa alta cu litere A/B/C… legate de campuri + etalon H cand
   exista piesa inalta.
8. ⏳ **QA vizual pe telefonul tau** — ramane la PO: o trecere rapida pe mobil peste
   plansele de dimensiuni (inclusiv Holul nou), ilustratiile din P3, butonul
   Salveaza pe touch si lightbox-ul nou.

**BONUS gasit si reparat la Q1 — bugul raportat de PO „salvarea din Pinterest nu
apare pana la refresh”**: clientul API arunca eroare la orice raspuns cu body gol
(`res.json()` pe 201 fara continut), deci mutatia parea esuata si cache-ul nu se
invalida desi salvarea reusea in DB. Reparat in `lib/api.ts` + optimistic updates
pe salvare/scoatere/mutare (butonul devine „Salvat” instant).

## 4. Note tehnice (nu cer acord — doar de stiut)

- **Build standalone local pe Windows**: `next build` compileaza tot si genereaza
  51/51 pagini; doar copierea „standalone” cere drepturi de symlink pe Windows
  (Developer Mode sau admin). In Dockerfile (Linux) nu exista problema.
- **Bug real gasit si reparat in P2**: tranzitia intre intrebari se bloca definitiv
  daca tab-ul devenea ascuns in timpul animatiei (rAF pauzat + AnimatePresence
  mode="wait"). Exact genul de „ma intorc in aplicatie si nu mai merge” pe mobil.
- **Dupa `git pull` local**: ruleaza `pnpm -F backend prisma migrate dev` (tabelele
  colectiilor) si `pnpm -F @marketplace/shared build` daca rulezi fara watch.
- Parolele demo locale raman `Demo1234!` (env pe Railway).
