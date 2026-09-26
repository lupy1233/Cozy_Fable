# Mediul demo local (fără Docker) — Cozy Home complet pentru capturi

Stack-ul întreg (Postgres + Redis + S3 mock + SMTP sink + geocoding mock + backend NestJS +
frontend Next.js) rulează direct în container, cu seed-ul demo din `docs/06-seed-scenarios.md`.
Scripturile stau în [`demo-env/`](demo-env/); nimic din `apps/` sau `packages/` nu a fost modificat
(singurul fișier creat acolo este `apps/backend/.env`, care e git-ignored).

```bash
cd marketing/videos/demo-env
./start.sh        # pornește tot ce nu rulează deja (idempotent) și afișează starea
./status.sh       # ce e UP/DOWN + răspunsul de la /api/v1/health
./stop.sh         # oprește tot   ·   ./stop.sh app → doar backend + frontend
./ids.sh          # ID-urile utile (cereri, sloturi de preluare, colecții) direct din DB
./reset-db.sh     # readuce baza la starea de după setup (după filmări care au modificat date)
./snapshot.sh     # salvează starea curentă a DB-ului ca nou punct de reset
```

La predare (26.09.2026) totul rulează, iar frontendul e în **modul prod** (build de producție,
vezi §1): http://localhost:3000/ro.

Parola TUTUROR conturilor demo: **`DemoCozy2026!`** (secret local de unică folosință, setat prin
`DEMO_PASSWORD` la seed; nu există parolă implicită în repo).

---

## 1. Ce rulează și unde

| Serviciu | Port | Ce e | Înlocuiește (dev-infra/docker-compose.yml) |
|---|---|---|---|
| PostgreSQL 16 | 5432 | pachet de sistem, cluster `16/main`; rol/DB/parolă `marketplace` | `postgres:16-alpine` |
| Redis 7 | 6379 | `redis-server` (fără persistență; BullMQ + adaptor Socket.IO) | `redis:7-alpine` |
| S3 mock | 9000 | `s3rver` (npm) în `demo-env/s3.mjs`: path-style, cheie `minioadmin`/`minioadmin`, bucket `uploads` creat la pornire, CORS pentru `http://localhost:3000`; fișierele în `demo-env/data/s3/` | MinIO (dl.min.io e blocat) |
| SMTP sink | 1025 | `smtp-server` (npm) în `demo-env/smtp.mjs`: acceptă orice, salvează `.eml` în `demo-env/data/mail/`, scrie destinatarul, subiectul și linkurile în `logs/smtp.log` | Mailpit (fără UI web) |
| Nominatim mock | 8088 | `demo-env/nominatim.mjs`: `GET /search` → coordonatele orașului (reședințe de județ + Ilfov), fallback București | nominatim.openstreetmap.org (blocat) |
| Pini inspirație | 8099 | `demo-env/pins-server.mjs`: servește `demo-env/pins/*.jpg` | CDN-urile Webflow/mobilaunicat.ro (blocate) |
| Backend NestJS | 3001 | `node dist/main.js` (`nest build` făcut automat de `start.sh` dacă sursele sunt mai noi) — API la `http://localhost:3001/api/v1`, health la `/api/v1/health` | — |
| Frontend Next.js | 3000 | `next start` pe build de producție (mod curent) sau `next dev -p 3000` | — |

Loguri: `demo-env/logs/<serviciu>.log` (backend = JSON pino, frontend, s3, smtp, nominatim, pins,
redis, backend-build). PID-uri: `demo-env/data/pids/`. `logs/` și `data/` sunt git-ignored
(`demo-env/.gitignore`).

`apps/backend/.env` = `.env.example` cu trei diferențe: `MESSAGE_ENCRYPTION_KEY` generat
(`openssl rand -hex 32`, chatul se criptează ca în producție), `NOMINATIM_BASE_URL=http://localhost:8088`
și cheile `STRIPE_*` goale comentate (Zod le respinge ca șir gol → Stripe dezactivat, plățile rămân
pe „transfer bancar + confirmare admin”).

### Frontend: prod sau dev

`start.sh` ține minte ultimul mod (`data/frontend-mode`); `FRONTEND_MODE=...` îl schimbă.

- **prod** (modul lăsat pornit): `next build` + `next start`. Rutele răspund în 30–300 ms, fără
  indicatorul de compilare al lui Next în colț. Recomandat pentru filmare. `start.sh` refață build-ul
  singur dacă `apps/frontend/src` sau `public` s-au schimbat de la ultimul build (3–5 min).
- **dev** (`pnpm -F frontend dev` echivalent): `./stop.sh app && FRONTEND_MODE=dev ./start.sh`.
  Hot reload, dar prima deschidere a fiecărei rute compilează 5–20 s; încălzește rutele înainte de
  capturi. Înapoi la prod: `./stop.sh app && FRONTEND_MODE=prod ./start.sh`.

---

## 2. Setup (făcut deja în acest container)

`demo-env/setup.sh` reface totul de la zero, idempotent: rol + DB Postgres, `apps/backend/.env`,
`prisma generate`, `prisma migrate deploy`, seed-urile, rescrierea pozelor de inspirație, colecțiile
demo, snapshot-ul „brut” `data/snapshot-base.dump`, **cosmetizarea datelor** (`tools/polish-data.mjs`,
§10) și snapshot-ul final `data/snapshot.dump`. Echivalentul manual:

```bash
pnpm -F backend prisma:generate
pnpm -F backend exec prisma migrate deploy
pnpm -F backend prisma:seed                                   # DOAR config: scoring, planuri, setări, sărbători
DEMO_PASSWORD='DemoCozy2026!' pnpm -F backend exec tsx prisma/seed-demo.ts   # useri, firme, 15 cereri
pnpm -F backend seed:inspiration                              # 70 de poze + firma „Mobila Unicat”
node marketing/videos/demo-env/tools/rewrite-inspiration.mjs  # poze → http://localhost:8099/...
node marketing/videos/demo-env/tools/seed-boards.mjs          # 4 colecții pentru ana.popescu (backend pornit)
(cd marketing/videos/demo-env && ./snapshot.sh base)          # starea brută (opțional)
node marketing/videos/demo-env/tools/polish-data.mjs          # date cosmetizate (§10)
(cd marketing/videos/demo-env && ./snapshot.sh)               # punctul de reset
```

Atenție: `prisma:seed` (seed.ts) NU înlănțuie seed-ul demo; `seed-demo.ts` se rulează separat și
cere `DEMO_PASSWORD` (≥ 8 caractere). `ALLOW_DEMO_SEED=1` e necesar doar cu `NODE_ENV=production`.

**Reset după filmare**: `./reset-db.sh` oprește backendul, recreează baza din snapshot (ID-urile de
mai jos rămân valabile), **decalează toate coloanele timestamp cu timpul scurs de la snapshot** (datele
arată mereu ca imediat după seed: „preluată acum 5 zile”, SLA-uri, expirări și valabilități tot în
viitor; excepții: `audit_logs`, append-only, și calendarul de sărbători), golește Redis, șterge
sesiunile salvate și repornește backendul. Durează ~10 s. `./reset-db.sh --base` = starea brută de
dinainte de cosmetizare. `./reset-db.sh --reseed` = DB nou + setup complet (ID-urile se schimbă →
rulează `./ids.sh`).

Fără reset, datele „îmbătrânesc”: seed-ul pune SLA-ul preluărilor la +2 zile, expirarea cererilor la
+3 zile și valabilitatea ofertelor la +14 zile față de momentul seed-ului.

Snapshot-ul curent (`data/snapshot.dump`) = seed + pini locali + colecțiile anei + **datele
cosmetizate** (§10). Fiecare vizită în `/ro/requests/new` creează o ciornă anonimă (`DRAFT`, fără
client) — normal; dispar la reset.

---

## 3. Conturi

Toate cu parola `DemoCozy2026!`, email verificat. După login, **toate rolurile ajung pe
`/ro/dashboard`** (sau pe `?redirect=/cale` dacă e dat în URL-ul de login). Emailurile de login au
rămas `…@demo.ro` (se văd în fișa de lucru și în lista echipei — vezi §10).

| Cont | Nume afișat · rol | La ce e bun |
|---|---|---|
| `elena.dumitru@demo.ro` | Elena Dumitru · client (Timișoara) | **comparația cu 3 oferte** + chat cu Atelier Nord; 2 notificări necitite |
| `mihai.ionescu@demo.ro` | Mihai Ionescu · client (Cluj-Napoca) | cerere **finalizată cu recenzie 5★**, negociere cu DesignWood Studio |
| `ana.popescu@demo.ro` | Ana Popescu · client (București) | cererea din fișa de lucru a lui owner.a, bucătărie în execuție (chat), **4 colecții de inspirație** |
| `radu.stanescu@demo.ro` | Radu Stănescu · client (Iași) | expirată, disputată (2★), preluată complet |
| `ioana.marinescu@demo.ro` | Ioana Marinescu · client (Brașov) | doar o ciornă |
| `andreea.stan@demo.ro`, `sorina.matei@demo.ro`, `mihnea.pavel@demo.ro` | clienți noi (Voluntari, București, Chiajna) | autorii cererilor noi din feed-ul lui owner.a |
| `owner.a@demo.ro` | **Andrei Albu** · proprietar **Atelier Nord** (Gold, 200 credite, Str. Fabrica de Glucoză 21, București, rază 50 km) | marketplace cu 5 cereri, **fișa de lucru fără ofertă**, mesaje, portofel, echipa |
| `owner.b@demo.ro` | Florin Barbu · proprietar **DesignWood Studio** (Platinum, rază 100 km) | ofertă în EUR, negociere, livrare |
| `owner.c@demo.ro` | Călin Chirilă · proprietar **CasaMea Mobilier** (Silver, Cluj-Napoca) | ofertă ieftină pe baia Elenei, dispută |
| `mgr.a@demo.ro`, `trusted1.a@demo.ro`, `trusted2.a@demo.ro`, `managed.a@demo.ro` | Bogdan Anghel, Cristina Vlad, Dan Mocanu, Elena Stoica · echipa Atelier Nord | permisiuni pe roluri |
| `mgr.b@demo.ro`, `trusted1..3.b@demo.ro` | Gina Bratu, Sorin Toma, Irina Pop, Victor Neagu · echipa DesignWood Studio | |
| `owner.d@demo.ro` … `owner.h@demo.ro` | Atelier Bucov (în verificare), Lemn & Stil (în verificare, risk flags), FastFurniture (respinsă), MobMaster (suspendată), VintageHaus (abonament expirat) | ecrane de acces blocat |
| `admin@demo.ro` | Administrator · ADMIN | `/ro/admin` |

Meniul după rol (antet): client → Contul meu, Cererile mele (`/ro/requests`), Cerere nouă;
firmă → Contul meu, Firma mea (`/ro/company`, cu **echipa**), Marketplace, Revendicări
(`/ro/marketplace/claims`), Mesaje (`/ro/marketplace/messages`), Portofel (`/ro/marketplace/wallet`);
admin → Admin.

---

## 4. Rute cu date (ID-urile din acest DB)

ID-urile sunt fixe cât timp folosești `./reset-db.sh` (snapshot); după `--reseed` ia-le din `./ids.sh`.

### Client

| Scenariu | Cont | Cerere (titlu afișat) | Rută |
|---|---|---|---|
| **Comparație 3 oferte + chat** | elena | Mobilier baie suspendat · Timișoara | `/ro/requests/1d02bcae-ce2d-4ce6-9793-40f2652b146c/offers` |
| Detaliul aceleiași cereri | elena | idem | `/ro/requests/1d02bcae-ce2d-4ce6-9793-40f2652b146c` |
| Preluată de 3 firme, fără oferte | elena | Bucătărie în U, fronturi mate · Timișoara | `/ro/requests/c2d8ccd7-1061-448c-92db-99520fb91fb3` |
| În marketplace | elena | Birou acasă cu rafturi · Timișoara | `/ro/requests/cd6ae90b-a4b7-4b69-b919-97d90ddda1f9` |
| Livrată (confirmare + recenzie) | elena | Dulap dormitor cu uși glisante · Timișoara | `/ro/requests/c95f9758-bf1c-45e8-af43-6969793c4c44` |
| **Finalizată, recenzie 5★** | mihai | Bucătărie verde salvie · Cluj-Napoca | `/ro/requests/5dcd35ab-79e9-4455-859f-5bbea0ff1981` (oferte + recenzie: `…/offers`) |
| Negociere (cerere de modificare în așteptare) | mihai | Living cu perete TV riflat · Cluj-Napoca | `/ro/requests/80afad85-9640-418b-bf79-0d82e2447f75/offers` |
| În execuție (chat cu Atelier Nord) | ana | Bucătărie albă cu blat de stejar · București | `/ro/requests/ed8f289d-16ed-4546-b1e4-a2339490965e/offers` |
| Expirată (repost) | radu | Dulap hol cu pantofar · Iași | `/ro/requests/c12c33ef-7f0e-4234-8c3d-d28d6b388ce9` |
| Disputată (2★) | radu | Birou cu bibliotecă integrată · Iași | `/ro/requests/f3439556-1298-4e50-8620-e3d616d52549` |
| Wizard cerere nouă (public) | — | — | `/ro/requests/new` |
| Galerie inspirație (70 pini, lightbox) | — | — | `/ro/inspiration` |
| Colecții | ana | Bucătăria noastră / Dormitor matrimonial / Living & bibliotecă / Hol și depozitare | `/ro/inspiration/boards` (ID-uri: `17b7d17a-f192-43f3-9dce-84cd21697fac`, `13acd530-ef98-4dc4-afeb-98325ae9e31f`, `7174862f-b43a-4c29-9dff-87ba1817aac3`, `e35ee847-4d7d-470a-844a-15c0c10b536c`) |
| Studio 3D | — | — | `/ro/studio` („Descopăr singur” închide tutorialul) |
| Firmele partenere (5 firme, câte 3 lucrări) | — | — | `/ro/partners` |

**Cele 3 oferte ale Elenei** (fiecare cu tarif de proiectare și defalcare pe cameră „Baie”):

| Firmă | Preț | Versiune | Livrare | Garanție | Proiectare |
|---|---|---|---|---|---|
| Atelier Nord | **9.800 RON** | **Versiunea 2** (v1 = 9.500; Elena a cerut push-to-open, cererea e „onorată”) | 35 zile | 24 luni | 1.200 RON |
| DesignWood Studio | **2.000 EUR ≈ 10.400 RON** (oferta în EUR, dublă afișare) | 1 | 40 zile | 36 luni | 250 EUR |
| CasaMea Mobilier | **9.200 RON** | 1 | 28 zile | 24 luni | 900 RON |

Chatul Elena ↔ Atelier Nord are 5 mesaje (ultimul, necitit de Elena: „Am trimis Versiunea 2 cu
push-to-open…”).

### Firmă — owner.a@demo.ro (Andrei Albu, Atelier Nord)

**Feed-ul `/ro/marketplace`** (5 carduri, sortate după publicare; bugetul din card e intervalul
enum-ului, suma exactă apare în fișa de lucru):

| Cerere | ID | Mărime · credite | Buget (card / estimat) | Distanță | Sloturi | Publicată |
|---|---|---|---|---|---|---|
| Mobilier baie suspendat · București | `336fb0e8-47b5-41d8-97d7-3ba743d4abba` | Mică · 4 | Sub 5.000 / 4.500 lei | 1,7 km | 0/3 | acum 3 ore |
| Bibliotecă living pe tot peretele · Voluntari | `85404327-ab1f-4423-82ac-917f8f86c7d7` | Medie · 12 | 5.000–15.000 / 12.000 lei | 4,9 km | 0/3 | acum o zi |
| Bucătărie în L cu insulă · București | `ce41d9a4-f5fe-4995-b733-c3a812dff6cc` | Mare · 25 | Peste 15.000 / 28.000 lei | 8,8 km | 0/3 | acum 2 zile |
| Dressing walk-in · Chiajna | `67f15705-e84c-4a1c-9af5-758e8e04fe11` | Medie · 18 | Peste 15.000 / 18.000 lei | 11,1 km | **2/3** (DesignWood + CasaMea) | acum 3 zile |
| Dormitor: dulap și noptiere · București | `acb6df7f-372d-4184-ac80-4b564fcd62af` | Medie · 12 | 5.000–15.000 / 12.000 lei | 4,3 km | 1/3 — „Preluată deja de firma ta” | acum 5 zile |

Detaliul unei cereri din feed (buton „Preia”): `/ro/marketplace/<ID>`.

| Ecran | Rută |
|---|---|
| **Fișa de lucru FĂRĂ ofertă** — Dormitor: dulap și noptiere · București (clienta Ana Popescu, `ana.popescu@demo.ro`, 0722 481 305, Str. Ion Câmpineanu 18, ap. 12, Sector 1; buget 12.000 lei, termen 1–3 luni; 2 fișiere: `schita-dormitor.png` + `dulap-referinta.jpg`; chat gol) | `/ro/marketplace/claims/861163e7-6eec-48b3-8616-6f1749840a9b` |
| Ofertă trimisă, Versiunea 2 (Elena) | `/ro/marketplace/claims/6b85f005-8206-436a-9ef9-8f4a5f23c2a1` |
| În execuție (Ana, 1 mesaj necitit) | `/ro/marketplace/claims/34be4ac5-7736-45fa-91e2-8b2a18c4754f` |
| Finalizată, 5★ (Mihai) | `/ro/marketplace/claims/e797deb9-cb48-413c-a09a-bfb7696f1d0a` |
| Preluate fără ofertă (Timișoara / Iași, 3/3) | `/ro/marketplace/claims/92f3a20b-fe15-454d-82d0-3aad7bbda6c3`, `/ro/marketplace/claims/bd177cb7-17c3-4707-af7f-665c623beed3` |
| Lista revendicărilor | `/ro/marketplace/claims` |
| **Mesaje** (3 conversații cu mesaje, una necitită) | `/ro/marketplace/messages` |
| **Portofel** (200 credite, Gold activ, facturi MM 1038 și 1041) | `/ro/marketplace/wallet` |
| **Firma mea + echipa** (profil, locație, 5 membri, portofoliu cu 3 lucrări) | `/ro/company` |
| Panou de control (6 preluări, 3 oferte, 52.300 RON valoare) | `/ro/dashboard` |

DesignWood Studio (`owner.b@demo.ro`): ofertă EUR `/ro/marketplace/claims/772f86ee-59bf-4620-b9d0-75d0da7c0775`,
negociere `/ro/marketplace/claims/72851d93-06bf-4dec-9766-cc9948571581`, livrare
`/ro/marketplace/claims/49d6fac4-2194-48a6-83ef-3770ebd36c11`.

Admin (`admin@demo.ro`): `/ro/admin`, `/ro/admin/companies`, `/ro/admin/disputes`, `/ro/admin/payments`,
`/ro/admin/audit`, `/ro/admin/inspiration`.

Întârzierea pe abonament (`marketplace_gating_delay_min`): o cerere publicată acum apare imediat la
Platinum (DesignWood Studio), după 30 min la Gold (Atelier Nord) și după 60 min la Silver.

---

## 5. Login în Playwright

Formularul `/ro/login`: etichetele „Email” / „Parolă” NU sunt legate de input (`getByLabel` nu
merge) → selectează după `name`. Butonul: „Intră în cont”. Tokenii sunt cookie-uri httpOnly
(`mm_access` 15 min, path `/`; `mm_refresh` 7 zile, path `/api/v1/auth`) setate de
`localhost:3001` și trimise și paginii de pe `:3000` (cookie-urile nu țin cont de port).

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'ro-RO' });
const page = await ctx.newPage();

await page.goto('http://localhost:3000/ro/login', { waitUntil: 'networkidle' });
await page.locator('input[name="email"]').fill('elena.dumitru@demo.ro');
await page.locator('input[name="password"]').fill('DemoCozy2026!');
await Promise.all([
  page.waitForURL((u) => !u.pathname.endsWith('/login')),   // → /ro/dashboard
  page.getByRole('button', { name: 'Intră în cont' }).click(),
]);
await page.waitForLoadState('networkidle');
await ctx.storageState({ path: 'demo-env/data/auth/elena.json' }); // refolosește sesiunea

await page.goto('http://localhost:3000/ro/requests/1d02bcae-ce2d-4ce6-9793-40f2652b146c/offers',
  { waitUntil: 'networkidle' });
```

Direct la o pagină protejată: `/ro/login?redirect=/marketplace/wallet` (fără prefixul de limbă).

**Limită: `POST /auth/login` = 5 cereri/minut per IP** (throttler în memorie; se resetează la
repornirea backendului). Nu te loga la fiecare captură — folosește helper-ele de mai jos, care
salvează sesiunea în `demo-env/data/auth/<email>.json` și o refolosesc (refresh automat):

```js
import { contextAs, saveState } from './demo-env/tools/login.mjs';
const ctx = await contextAs(browser, 'owner.a@demo.ro', { viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
// ... capturi ...
await saveState(ctx, 'owner.a@demo.ro');   // păstrează tokenul rotit de frontend
```

Nu folosi același cont în paralel din două procese: refresh token-ul se rotește (grație 30 s),
iar reutilizarea unui token vechi revocă sesiunea (următorul `contextAs` se re-loghează singur).

Echivalentul CLI al lui `capture.mjs`, cu login opțional și imaginile CDN redirecționate local:

```bash
cd marketing/videos
node demo-env/tools/shot-as.mjs --as owner.a@demo.ro --url /ro/marketplace --out assets/shots/x.png \
     [--w 430 --h 932 --scale 2 --full --wait 1500 --click "text=..." --scroll 600 --dark]
node demo-env/tools/shot-as.mjs --url /ro --out assets/shots/landing.png      # fără --as = pagină publică
```

**Imagini hardcodate pe CDN.** Secțiunea „Caietul de idei” de pe landing (`/ro`) ia 9 poze direct
din `apps/frontend/src/lib/inspiration.ts` (URL-uri `cdn.prod.website-files.com`, blocate) — nu din
DB. `capture.mjs` le arată rupte; `shot-as.mjs` le înlocuiește din mers cu pinii locali. În scripturile
proprii adaugă o linie după crearea contextului:

```js
import { routeCdnToPins } from './demo-env/tools/cdn-pins.mjs';
await routeCdnToPins(ctx);   // https://cdn.prod.website-files.com/.../<fișier> → http://localhost:8099/<slug>.jpg
```

---

## 6. Ce funcționează și ce nu

| Funcție | Stare |
|---|---|
| Health `/api/v1/health` | OK: `{"status":"ok","checks":{"db":"up","redis":"up","storage":"up"}}` |
| Wizard `/ro/requests/new` | OK: draftul se creează (`POST /requests/drafts`), faza 1 „Cum pornim cererea?” se afișează (nu mai rămâne pe „Se pregătește…”) |
| Publicare cerere (geocodare) | OK prin mock (verificat: draft publicat prin API cu „Str. Lalelelor nr. 5, bl. A3, sc. 2, ap. 15 / Cluj-Napoca / Judetul Cluj” → IN_MARKETPLACE, lat/lng Cluj; cererea de test a fost ștearsă). Backendul cheamă `NOMINATIM_BASE_URL=http://localhost:8088`. Nominatim real e blocat (CONNECT respins de proxy); fără mock publicarea ar da `GEOCODING_FAILED` (502) după cele 3 trepte de fallback (adresă+oraș+județ → oraș+județ → oraș). Rezultatele se cache-uiesc 90 zile în `geocoding_cache`. Publicarea cere cont logat („fill as guest, login to publish”) |
| Upload-uri (schițe, poze, atașamente ofertă/chat) | OK la nivel de protocol: presign → PUT direct în s3rver → confirm → `SAFE` + `downloadUrl` presemnat (verificat pe `POST /requests/drafts/:token/attachments`); CORS permite `http://localhost:3000`. Numele care conțin „malware” sunt respinse (scan mock) |
| Email | OK: mesajele (verificare cont, resetare parolă, notificări) ajung în sink; linkul apare în `logs/smtp.log`, mesajul complet în `data/mail/*.eml`. Nu există UI tip Mailpit |
| PDF ofertă („Descarcă PDF”) | OK (puppeteer are Chrome local); prima generare durează ~15 s |
| Chat / notificări realtime | handshake Socket.IO pe `:3001` OK (adaptor Redis); mesajele se stochează criptat (AES-256-GCM). Schimbul live de mesaje între două sesiuni nu a fost filmat/testat aici |
| Galerie + lightbox + colecții | OK: 70 de pini, 0 imagini rupte, lightbox cu „Idei asemănătoare” și autorul (ex. „de Atelier Stejar”), 4 colecții pentru ana |
| Plăți Stripe | dezactivate (fără chei) — portofelul arată doar transfer bancar + confirmare admin |
| Google Maps Places | fără cheie → adresa din wizard e formată din inputuri text simple |
| Linkuri externe (`mobilaunicat.ro` din „Vezi proiectul”, CDN-ul de poze) | blocate de proxy; landing-ul are 9 poze hardcodate pe CDN → folosește `shot-as.mjs` / `routeCdnToPins` (§5) |
| Portofoliul firmelor | 3 lucrări pentru fiecare firmă aprobată (imagini = pini locali), vizibile în `/ro/partners` și `/ro/company` |

---

## 7. Galeria de inspirație: imaginile înlocuitoare

Seed-ul (`apps/backend/prisma/seed-inspiration.ts`) pune 70 de poze reale Mobila Unicat cu URL-uri
de pe `cdn.prod.website-files.com` — blocat aici, deci galeria ar fi plină de imagini rupte.
Seed-ul din repo NU e atins; doar coloana `image_url` din DB-ul local e rescrisă:

1. `tools/make-pins.mjs` deschide Studio 3D (`/ro/studio` → „Descopăr singur” → „Piesă nouă”) și
   randează în WebGL headless **câte o piesă pentru fiecare poză**, derivată din atributele ei:
   camera/titlul → tipul de corp (dulap, bibliotecă, comodă TV, comodă, noptieră, pantofar, birou),
   prima culoare → finisaj (Alb, Crem, Stejar, Nuc, Gri, Negru, Verde salvie, Albastru, Teracotă),
   `MANER` → „Cu mâner”, `GLISANTE` → uși glisante; dimensiuni și unghi variate.
2. `tools/crop-pins.py` (Pillow) decupează pe fundalul ivoire al scenei în formate variate
   (3:4, 2:3, 4:5, 1:1, 4:3, 3:2) → `demo-env/pins/<slug>.jpg`. 11 poze folosesc în loc ilustrațiile
   de finisaj/mecanism din `apps/frontend/public/illustrations/` (gola, aventos, mâner, push,
   glisante, lemn masiv, MDF furnir/infoliat/vopsit, PAL, „altul”), alese după sistemul/materialul
   pozei. Copiile originale sunt și în `pins/illustrations/` (git-ignored, recreate de `crop-pins.py`).
3. `tools/rewrite-inspiration.mjs` setează `image_url = http://localhost:8099/<slug>.jpg`
   (backup al URL-urilor originale în `data/inspiration-urls-backup.json`; `--revert` le pune la loc).

Titlurile, camerele, culorile, materialele și sistemele rămân cele din seed, deci filtrele dau
rezultate coerente (ex. „Negru” → piese negre). Galeria folosește `<img>` simplu (nu `next/image`),
deci `localhost:8099` nu are nevoie de `images.remotePatterns`.

Regenerare (frontend pornit, din `demo-env/`): `node tools/make-pins.mjs && python3 tools/crop-pins.py
&& node tools/rewrite-inspiration.mjs` (~20 s/piesă, ~25 min pentru toate 70; `--only <slug>` sau
`--limit N` pentru probe). Finisajele Alb/Crem primesc o ridicare de gamma la decupare (sub lumina
scenei ieșeau gri). Dacă rulezi din nou `seed:inspiration`, el recreează pozele cu URL de CDN;
`rewrite-inspiration.mjs` le șterge ca duplicate. Pillow e instalat în Python-ul de sistem
(`pip install pillow`).

---

## 8. Fișiere

```
marketing/videos/
  DEMO-ENV.md                 ← acest document
  demo-env/
    start.sh stop.sh status.sh    pornire/oprire/stare (idempotente)
    setup.sh reset-db.sh ids.sh   setup complet, reset din snapshot, listare ID-uri
    snapshot.sh                   salvează DB-ul curent ca punct de reset (`snapshot.sh base` = starea brută)
    lib.sh                        funcții comune
    s3.mjs smtp.mjs nominatim.mjs pins-server.mjs   serviciile mock
    cors.xml                      CORS pentru bucketul uploads
    tools/login.mjs               login() + contextAs() + saveState() pentru Playwright
    tools/shot-as.mjs             captură (ca capture.mjs + --as opțional + pini în loc de CDN)
    tools/cdn-pins.mjs            routeCdnToPins(): CDN partener → pini locali, în browser
    tools/seed-boards.mjs         colecții demo prin API
    tools/polish-data.mjs         date cosmetizate (§10)
    tools/make-fixtures.py        schița atașată la cererea din fișa de lucru
    fixtures/                     schita-dormitor.png, dulap-referinta.jpg
    tools/make-pins.mjs crop-pins.py rewrite-inspiration.mjs   imaginile galeriei
    pins/                         imaginile servite pe :8099 (70 × <slug>.jpg, ~4 MB; pins/illustrations/ e git-ignored)
    package.json                  s3rver + smtp-server (node_modules git-ignored)
    logs/ data/                   git-ignored (loguri, PID-uri, S3, mail, sesiuni, snapshot*.dump)
```

---

## 9. Capturi de probă verificate (26.09.2026, pe datele cosmetizate)

În `assets/shots/_probe/` (git-ignored):

| Fișier | Ce arată |
|---|---|
| `wizard.png` | `/ro/requests/new`, faza 1 din 6 „Cum pornim cererea?” (draft creat pe server) |
| `client-offers.png`, `p-elena-offers.png` (pagina întreagă) | Elena: Atelier Nord Versiunea 2 9.800 RON, DesignWood Studio 2.000 EUR ≈ 10.400 RON, CasaMea Mobilier 9.200 RON, chatul cu Andrei Albu |
| `p-elena-requests.png` | „Cererile mele” ale Elenei (4 cereri cu titluri reale) |
| `company-marketplace.png`, `p-owner-marketplace.png` | feed-ul lui owner.a: 5 cereri (Mică 4 / Medie 12 / Mare 25 / Medie 18 cu 2/3 / preluată de firma ta) |
| `p-owner-claim.png` | fișa de lucru 861163e7: clienta cu telefon și adresă, 2 fișiere, formularul „Trimite oferta” gol |
| `p-owner-messages.png` | Mesaje: 3 conversații cu Ana/Elena/Mihai, una necitită |
| `p-mihai-completed.png` | cererea finalizată a lui Mihai |
| `p-partners.png` | 5 firme partenere cu câte 3 lucrări |
| `p-lightbox.png` | lightbox „Bucătărie antracit cu stejar · de Atelier Stejar” |
| `company-claim-sheet.png`, `company-wallet.png`, `company-team.png` | owner.a (telefon): fișa de lucru, portofelul (200 credite, Gold), „Firma mea” cu echipa Andrei Albu / Bogdan Anghel / Cristina Vlad… |
| `inspiration.png`, `inspiration-mobile.png`, `boards.png`, `landing-ideas.png` | galeria cu titluri cu diacritice, colecțiile Anei, landing-ul cu pinii (prin `shot-as.mjs`) |

---

## 10. Date cosmetizate

Aplicate DOAR în DB-ul local, de `demo-env/tools/polish-data.mjs` (idempotent, ID-uri fixe), apoi
salvate în `data/snapshot.dump`. Seed-urile din repo sunt neatinse. Pentru a reface:
`./reset-db.sh --base && node tools/polish-data.mjs && ./snapshot.sh`.

- **Firme**: A Mobila Premium → **Atelier Nord**, B DesignWood → **DesignWood Studio**, C CasaMea →
  **CasaMea Mobilier**, D/E/F/G/H → Atelier Bucov, Lemn & Stil, FastFurniture, MobMaster, VintageHaus;
  „Mobila Unicat” (sursa galeriei) → **Atelier Stejar** (Otopeni). Adrese, CUI, nr. Reg. Com. și
  „partener din” plauzibile; orașe cu diacritice (București, Cluj-Napoca, Timișoara, Iași, Brașov).
- **Oameni**: Andrei Albu, Bogdan Anghel, Cristina Vlad, Dan Mocanu, Elena Stoica (Atelier Nord);
  Florin Barbu, Gina Bratu, Sorin Toma, Irina Pop, Victor Neagu (DesignWood Studio); Călin Chirilă,
  Doru Dinu, Emil Enache, Fănel Florea, Gelu Georgescu, Horia Hodoș; Radu Stănescu; admin =
  „Administrator”. Clienții au telefon (ex. Ana 0722 481 305).
- **Galerie**: cele 70 de titluri cu diacritice; autorul fiecărui proiect-sursă e una dintre cele 5
  firme aprobate; linkul extern „Vezi proiectul” (mobilaunicat.ro) e șters. Filtrele (cameră,
  culoare, material, sistem) sunt neschimbate.
- **Cereri**: toate cele 15 au titlu „Ce · Oraș”, descriere naturală, adresă, buget estimat, termen
  dorit, corpuri reale (ex. „Dulap cu uși glisante, 240 × 260 cm”) și contact email + telefon;
  mărimea/creditele sunt coerente (1 credit = 1.000 lei din buget). Plus 3 cereri noi lângă București.
- **Oferte**: cele 3 ale Elenei (tabelul din §4), plus oferte diferite pe celelalte cereri (12.600,
  13.400, 16.200, 18.600, 23.900 RON), fiecare cu descriere și defalcare pe cameră. Negocierea lui
  Mihai are o cerere de modificare naturală.
- **Chat** (criptat AES-256-GCM, exact ca în producție): Elena ↔ Atelier Nord (5 mesaje), Ana ↔ Atelier
  Nord (4, ultimul necitit de firmă), Mihai ↔ Atelier Nord (2).
- **Recenzii**: 5★ la Mihai („Bucătăria a ieșit exact ca în randare…”), 2★ la Radu (text natural).
- **Notificări**: cele 30 de „decor” înlocuite cu notificări cu context (firmă · cerere, deep-link);
  necitite: Elena 2 (ofertă actualizată + mesaj), owner.a 1 (mesaj de la Ana).
- **Fișiere**: `schita-dormitor.png` (plan cotat desenat „de mână”) și `dulap-referinta.jpg` pe cererea
  din fișa de lucru (în S3 mock; sursele în `demo-env/fixtures/`, `tools/make-fixtures.py`).
- **Portofolii** (3 lucrări × 5 firme) și **facturi** numerotate MM 1038–1042 (abonamente Gold/Platinum
  + pachete de credite).

### Ce NU s-a putut cosmetiza

- Emailurile de login rămân `…@demo.ro` și se văd în fișa de lucru („ana.popescu@demo.ro”), în lista
  echipei și în „Contul meu”. Nu le-am schimbat ca să nu stric conturile folosite deja de agenți.
- Jurnalul de audit (admin → Audit) are 52 de intrări seed cu `entityType = demo`: tabela e
  append-only (trigger), deci nu se poate edita fără a dezactiva triggerul.
- Termenul SLA din fișa de lucru afișează „chiar acum” lângă o dată viitoare (formatarea relativă a
  frontendului); ora mesajelor din chat apare fără dată.
- Cererile acceptate/finalizate afișează „Expiră <dată trecută>” (câmpul `expires_at` rămâne, ca în
  fluxul real).
- Bugetul din cardurile marketplace e doar intervalul enum („5.000 – 15.000 RON”, „Peste 15.000 RON”);
  suma exactă (ex. 12.000 lei) apare doar în fișa de lucru.
- DesignWood Studio: oferta e **2.000 EUR ≈ 10.400 RON** (nu 10.400 RON în lei), ca să rămână un caz de
  dublă afișare RON/EUR cerut de seed; se poate trece pe RON cu un update pe `quotes.currency` +
  preț 10.400 dacă se preferă.
- Seed-ul `seed:inspiration` din repo, rulat din nou, ar recrea firma „Mobila Unicat” (caută după
  nume) — nu îl rula peste DB-ul cosmetizat.

### Nu faceți (agenții video)

- **Nu rulați `./reset-db.sh` cât timp alt agent capturează**: oprește backendul ~10 s și șterge
  sesiunile salvate din `data/auth/`. Resetați doar între sesiuni, coordonat.
- **Agentul „client”** publică cereri noi doar cu oraș **Cluj-Napoca sau Iași** (nu București/Ilfov),
  ca feed-ul lui owner.a din București să rămână exact cel din §4.
- **Agentul „firmă”** trimite oferte doar pe claim-ul **`861163e7-6eec-48b3-8616-6f1749840a9b`**
  (Dormitor: dulap și noptiere · București). Nu faceți „Preia” pe cererile din feed decât dacă
  resetați după aceea (preluarea consumă credite și schimbă sloturile).
- Nu acceptați oferte ale Elenei și nu trimiteți mesaje în chatul ei decât dacă filmați exact acel
  pas (mutarea schimbă starea cererii pentru toți agenții).
- Nu rulați `seed:inspiration`, `seed-demo.ts` sau `rewrite-inspiration.mjs --revert` pe DB-ul curent.
- Nu vă logați în buclă (limită 5 login-uri/minut/IP): folosiți `contextAs()` / `shot-as.mjs`.
