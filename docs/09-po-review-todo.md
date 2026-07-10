# Verificare integrala site + TODO pentru acordul PO — 2026-07-11 (feedback r2, item 15)

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

## 2. DECIZII care asteapta raspunsul tau

| # | Decizie | Contextul | Propunerea mea |
|---|---------|-----------|----------------|
| D1 | **Numele „Caietul de idei”** (EN „The Idea Book”) | Item 13 cerea un nume memorabil de marketing pentru fosta „Inspiratie”. E o cheie i18n — se schimba in 2 minute. Alternative: „Idei de acasa”, „Galeria de idei”, „Colectia Cozy”. | Pastram „Caietul de idei” — e in limbajul ATELIER al brandului (plansa, caiet, schita). |
| D2 | **Limita fisiere 10MB vs 25MB** | Invarianta 3.4 zice 25MB/fisier; codul are 10MB (`MAX_ATTACHMENT_BYTES`) — divergenta pre-existenta. | Aliniez la 25MB (o constanta + un text i18n). |
| D3 | **Teste backend (jest neinstalat)** | `pnpm -F backend test` pica din prima zi — scriptul exista, jest nu. | Instalez jest + 10–15 teste pe serviciile critice (claim, quotes, uploads). |
| D4 | **Scan AV real la fisiere** | Acum e mock (BLOCKED doar daca numele contine „malware”), conform invariantei pentru MVP. Pentru clienti reali e nevoie de AV adevarat. | Post-MVP: ClamAV in container sau serviciu de scanning S3. |
| D5 | **Re-seed pe Railway** | Notificarile de decor din seed-ul vechi raman necitite pe Railway (cauza „cerculetului” imposibil de curatat). Migratia noua ruleaza automat la deploy. | Dupa deploy: rulez `UPDATE notifications SET read_at=now() WHERE payload::text LIKE '%"demo": true%' AND read_at IS NULL;` (sau re-seed pe DB curat). |
| D6 | **Cheia Google Places** | Ramasa deschisa din overhaul (memorie): fara `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, adresa e input simplu (functional, fara autocomplete). | Cand ai cheia GCP, o punem in env-ul Railway — zero cod. |

## 3. IDEI de imbunatatire gasite la verificare (cer acordul inainte sa le fac)

1. **Necitite in conversatii** — chat-ul nu are read-tracking; conversatiile cu mesaje noi
   nu se disting vizual. As adauga tabela `message_reads` (migratie mica) + bold/punct
   pe conversatiile necitite in pagina „Oferte si conversatii”.
2. **Filtre pe „Cererile mele”** — taburi Active / In lucru / Finalizate / Expirate cand
   lista creste (acum toate cardurile sunt intr-o singura grila).
3. **Lightbox mai Pinterest** — buton „Salveaza” si in lightbox + navigare ←/→ intre
   pin-uri + pin-uri similare dedesubt (dupa aceleasi filtre).
4. **Mutare intre colectii** — acum scoti pin-ul si il salvezi in alta colectie; un mic
   meniu „Muta in…” pe pin-ul salvat ar scurta drumul.
5. **Emailuri de notificare** — notificarile sunt doar in-app; Mailpit/SMTP e deja
   configurat. As trimite email la: oferta noua, mesaj nou, cerere preluata (cu
   preferinte de dezabonare simple).
6. **Paginare in galerie** — cap-ul actual e 200 poze per interogare; infinite scroll
   cand galeria reala creste.
7. **Plansa de dimensiuni si la Hol** — holul are campuri per piesa (pantofar, cuier…),
   fara desen; se poate face o vedere frontala compusa, dar vreau intai parerea ta
   daca ajuta sau aglomereaza.
8. **QA vizual pe telefonul tau** — screenshot-urile in panoul meu de preview au fost
   indisponibile (limita de mediu); am verificat DOM-ul si logica, dar merita o trecere
   vizuala rapida pe mobil peste: plansele de dimensiuni noi, ilustratiile din P3 si
   butonul Salveaza pe touch (hover-ul devine tap — l-am facut vizibil si fara hover
   la pin-ul salvat, dar confirma pe telefon).

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
