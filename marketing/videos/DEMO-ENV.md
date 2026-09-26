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
demo și un snapshot `data/snapshot.dump` (prin `snapshot.sh`). Echivalentul manual:

```bash
pnpm -F backend prisma:generate
pnpm -F backend exec prisma migrate deploy
pnpm -F backend prisma:seed                                   # DOAR config: scoring, planuri, setări, sărbători
DEMO_PASSWORD='DemoCozy2026!' pnpm -F backend exec tsx prisma/seed-demo.ts   # useri, firme, 15 cereri
pnpm -F backend seed:inspiration                              # 70 de poze + firma „Mobila Unicat”
node marketing/videos/demo-env/tools/rewrite-inspiration.mjs  # poze → http://localhost:8099/...
node marketing/videos/demo-env/tools/seed-boards.mjs          # 4 colecții pentru ana.popescu (backend pornit)
```

Atenție: `prisma:seed` (seed.ts) NU înlănțuie seed-ul demo; `seed-demo.ts` se rulează separat și
cere `DEMO_PASSWORD` (≥ 8 caractere). `ALLOW_DEMO_SEED=1` e necesar doar cu `NODE_ENV=production`.

**Reset după filmare**: `./reset-db.sh` oprește backendul, recreează baza din snapshot (ID-urile de
mai jos rămân valabile), **decalează toate coloanele timestamp cu timpul scurs de la snapshot** (datele
arată mereu ca imediat după seed: „preluată acum 5 zile”, SLA-uri, expirări și valabilități tot în
viitor; excepții: `audit_logs`, append-only, și calendarul de sărbători), golește Redis, șterge
sesiunile salvate și repornește backendul. Durează ~10 s. `./reset-db.sh --reseed` = DB nou + seed
complet (ID-urile se schimbă → rulează `./ids.sh`).

Fără reset, datele „îmbătrânesc”: seed-ul pune SLA-ul preluărilor la +2 zile, expirarea cererilor la
+3 zile și valabilitatea ofertelor la +14 zile față de momentul seed-ului.

Snapshot-ul curent (26.09.2026 22:28) conține: seed config + demo + inspirație, pozele rescrise spre
`:8099`, cele 4 colecții ale anei și nimic altceva (cererile de test au fost șterse). Fiecare vizită
în `/ro/requests/new` creează o ciornă anonimă (`DRAFT`, fără client) — normal; dispar la reset.

---

## 3. Conturi

Toate cu parola `DemoCozy2026!`, email verificat. După login, **toate rolurile ajung pe
`/ro/dashboard`** (sau pe `?redirect=/cale` dacă e dat în URL-ul de login).

| Cont | Rol | La ce e bun |
|---|---|---|
| `elena.dumitru@demo.ro` | client (Timișoara) | **comparația cu 3 oferte** (baie, proiectare contra cost, o ofertă în EUR), + o cerere CLAIMED_FULL, una DELIVERED_BY_COMPANY, una IN_MARKETPLACE |
| `mihai.ionescu@demo.ro` | client (Cluj) | cerere **COMPLETED cu review 5★**, cerere în NEGOTIATION (cerere de modificare în așteptare), una CLAIMED_PARTIAL |
| `ana.popescu@demo.ro` | client (București) | cerere IN_EXECUTION, una CLAIMED_PARTIAL, una IN_MARKETPLACE; **are 4 colecții de inspirație** |
| `radu.stanescu@demo.ro` | client (Iași) | EXPIRED (repost permis), DISPUTED (review 2★), CLAIMED_FULL, IN_MARKETPLACE |
| `ioana.marinescu@demo.ro` | client (Brașov) | doar un DRAFT |
| `owner.a@demo.ro` | owner „A Mobila Premium” (APPROVED, **Gold**, 200 credite, București, rază 50 km) | marketplace, **fișe de lucru** (6 sloturi: 3 fără ofertă, 1 ofertă trimisă, 1 acceptată, 1 finalizată), portofel, echipă de 5 |
| `owner.b@demo.ro` | owner „B DesignWood” (APPROVED, **Platinum**, 200 credite, rază 100 km) | firma „model”: ofertă EUR, negociere, livrare |
| `owner.c@demo.ro` | owner „C CasaMea” (Silver, Cluj, 3 puncte penalizare) | slot în dispută |
| `mgr.a@demo.ro`, `trusted1.a@demo.ro`, `trusted2.a@demo.ro`, `managed.a@demo.ro` | echipa firmei A | permisiuni pe roluri (managed nu editează prețul etc.) |
| `mgr.b@demo.ro`, `trusted1..3.b@demo.ro` | echipa firmei B | |
| `owner.d@demo.ro` … `owner.h@demo.ro` | firme PENDING / REJECTED / SUSPENDED / abonament expirat | ecrane de acces blocat |
| `admin@demo.ro` | ADMIN | `/ro/admin` (firme, plăți, dispute, audit, inspirație, joburi) |

Meniul după rol (antet): client → Dashboard, Cererile mele (`/ro/requests`), Cerere nouă;
firmă → Dashboard, Firma mea (`/ro/company`, cu **echipa**), Marketplace, Preluări
(`/ro/marketplace/claims`), Mesaje (`/ro/marketplace/messages`), Portofel (`/ro/marketplace/wallet`);
admin → Admin.

---

## 4. Rute cu date seed (ID-urile din acest DB)

ID-urile sunt UUID-uri generate la seed: valabile cât timp folosești `./reset-db.sh` (snapshot);
după un reseed complet le iei din `./ids.sh`.

### Client

| Ecran | Cont | Rută |
|---|---|---|
| **Comparație 3 oferte** (A RON, B EUR, C RON; toate cu tarif de proiectare) | elena | `/ro/requests/1d02bcae-ce2d-4ce6-9793-40f2652b146c/offers` |
| Detaliu cerere cu oferte | elena | `/ro/requests/1d02bcae-ce2d-4ce6-9793-40f2652b146c` |
| Cerere CLAIMED_FULL (3 firme, fără oferte încă) | elena | `/ro/requests/c2d8ccd7-1061-448c-92db-99520fb91fb3` |
| Livrată de firmă (confirmare + review) | elena | `/ro/requests/c95f9758-bf1c-45e8-af43-6969793c4c44` |
| **COMPLETED cu review 5★** | mihai | `/ro/requests/5dcd35ab-79e9-4455-859f-5bbea0ff1981` |
| Negociere (change request pending) | mihai | `/ro/requests/80afad85-9640-418b-bf79-0d82e2447f75/offers` |
| În execuție | ana | `/ro/requests/ed8f289d-16ed-4546-b1e4-a2339490965e` |
| Expirată (repost) | radu | `/ro/requests/c12c33ef-7f0e-4234-8c3d-d28d6b388ce9` |
| Disputată (review 2★) | radu | `/ro/requests/f3439556-1298-4e50-8620-e3d616d52549` |
| Lista cererilor | oricare client | `/ro/requests` |
| **Wizard cerere nouă** (public, draft creat pe server) | — | `/ro/requests/new` |
| **Galerie inspirație** (70 pini, filtre, lightbox) | — | `/ro/inspiration` |
| **Colecții** | ana | `/ro/inspiration/boards` → „Bucătăria noastră” `/ro/inspiration/boards/17b7d17a-f192-43f3-9dce-84cd21697fac`, „Dormitor matrimonial” `…/13acd530-ef98-4dc4-afeb-98325ae9e31f`, „Living & bibliotecă” `…/7174862f-b43a-4c29-9dff-87ba1817aac3`, „Hol și depozitare” `…/e35ee847-4d7d-470a-844a-15c0c10b536c` |
| Studio 3D | — | `/ro/studio` (tutorialul se închide cu „Descopăr singur”) |

### Firmă (owner.a@demo.ro — „A Mobila Premium”)

| Ecran | Rută |
|---|---|
| **Marketplace** (2 cereri în raza de 50 km: BEDROOM București deja preluat de A, KITCHEN București 0/3 sloturi) | `/ro/marketplace` |
| Detaliu cerere din marketplace (poți face „Preia” live pe KITCHEN București) | `/ro/marketplace/ce41d9a4-f5fe-4995-b733-c3a812dff6cc` |
| Lista preluărilor | `/ro/marketplace/claims` |
| **Fișă de lucru — slot activ, fără ofertă** (BEDROOM București, client ana) | `/ro/marketplace/claims/861163e7-6eec-48b3-8616-6f1749840a9b` |
| Fișă de lucru — slot activ (KITCHEN Timișoara, elena, 3/3) | `/ro/marketplace/claims/92f3a20b-fe15-454d-82d0-3aad7bbda6c3` |
| Fișă de lucru — slot activ (DRESSING Iași, radu, 3/3) | `/ro/marketplace/claims/bd177cb7-17c3-4707-af7f-665c623beed3` |
| **Ofertă trimisă** (BATHROOM Timișoara, elena — una din cele 3 comparate) | `/ro/marketplace/claims/6b85f005-8206-436a-9ef9-8f4a5f23c2a1` |
| Ofertă acceptată / în execuție (KITCHEN București, ana) | `/ro/marketplace/claims/34be4ac5-7736-45fa-91e2-8b2a18c4754f` |
| Finalizată cu review 5★ (KITCHEN Cluj, mihai) | `/ro/marketplace/claims/e797deb9-cb48-413c-a09a-bfb7696f1d0a` |
| Mesaje | `/ro/marketplace/messages` |
| **Portofel** (200 credite, abonament Gold, factură demo) | `/ro/marketplace/wallet` |
| **Firma mea + echipa** (owner, manager, 2 trusted, 1 managed) | `/ro/company` |

Admin (`admin@demo.ro`): `/ro/admin` (tablou de bord: 14 preluări active, 1 dispută, 1.331 RON
facturat), `/ro/admin/companies`, `/ro/admin/disputes`, `/ro/admin/payments`, `/ro/admin/audit`,
`/ro/admin/inspiration`.

Firma B (`owner.b@demo.ro`): ofertă EUR `/ro/marketplace/claims/772f86ee-59bf-4620-b9d0-75d0da7c0775`,
negociere `/ro/marketplace/claims/72851d93-06bf-4dec-9766-cc9948571581`, livrare
`/ro/marketplace/claims/49d6fac4-2194-48a6-83ef-3770ebd36c11`.

Observații despre date: titlurile cererilor seed sunt tehnice („KITCHEN Bucuresti”, descriere
„Proiect kitchen demo.”) și toate ofertele au aceleași valori (8.500 RON, 30 zile, 24 luni).
Marketplace-ul unei firme arată doar cererile IN_MARKETPLACE/CLAIMED_PARTIAL din raza ei (A și B
văd doar cele 2 din București). Pentru un feed mai bogat publică cereri noi din wizard cu oraș
București (geocodarea mock le pune în rază). Atenție la întârzierea pe abonament
(`marketplace_gating_delay_min`): o cerere nouă apare imediat la Platinum (`owner.b`), după 30 min
la Gold (`owner.a`) și după 60 min la Silver.

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
| Galerie + lightbox + colecții | OK: 70 de pini, 0 imagini rupte, lightbox cu „Idei asemănătoare”, 4 colecții pentru ana |
| Plăți Stripe | dezactivate (fără chei) — portofelul arată doar transfer bancar + confirmare admin |
| Google Maps Places | fără cheie → adresa din wizard e formată din inputuri text simple |
| Linkuri externe (`mobilaunicat.ro` din „Vezi proiectul”, CDN-ul de poze) | blocate de proxy; landing-ul are 9 poze hardcodate pe CDN → folosește `shot-as.mjs` / `routeCdnToPins` (§5) |
| Portofoliul firmelor | gol în seed (secțiunea „Portofoliu” din `/ro/company` invită la adăugare); dacă vrei date, adaugă din UI cu „URL imagine” = un pin `http://localhost:8099/<slug>.jpg` |

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
    snapshot.sh                   salvează DB-ul curent ca punct de reset
    lib.sh                        funcții comune
    s3.mjs smtp.mjs nominatim.mjs pins-server.mjs   serviciile mock
    cors.xml                      CORS pentru bucketul uploads
    tools/login.mjs               login() + contextAs() + saveState() pentru Playwright
    tools/shot-as.mjs             captură (ca capture.mjs + --as opțional + pini în loc de CDN)
    tools/cdn-pins.mjs            routeCdnToPins(): CDN partener → pini locali, în browser
    tools/seed-boards.mjs         colecții demo prin API
    tools/make-pins.mjs crop-pins.py rewrite-inspiration.mjs   imaginile galeriei
    pins/                         imaginile servite pe :8099 (70 × <slug>.jpg, ~4 MB; pins/illustrations/ e git-ignored)
    package.json                  s3rver + smtp-server (node_modules git-ignored)
    logs/ data/                   git-ignored (loguri, PID-uri, S3, mail, sesiuni, snapshot)
```

---

## 9. Capturi de probă verificate (26.09.2026)

În `assets/shots/_probe/` (git-ignored):

| Fișier | Ce arată |
|---|---|
| `wizard.png` | `/ro/requests/new`, faza 1 din 6 „Cum pornim cererea?” (draft creat pe server) |
| `client-offers.png` | elena, `/ro/requests/1d02…146c/offers`: A Mobila Premium 8.500 RON ≈ 1.634,62 EUR, tarif proiectare 1.200 RON, „Acceptă oferta”, chat |
| `company-marketplace.png` | owner.a, `/ro/marketplace`: 200 credite, BEDROOM București (preluată deja de firma ta, 1/3), KITCHEN București (0/3) |
| `company-claim-sheet.png` | owner.a, fișa de lucru BEDROOM București: „Se ocupă”, SLA, bugetul, clienta Ana Popescu, formularul „Trimite oferta” |
| `company-wallet.png` | owner.a, portofel 200/0/200, abonament Gold activ, planurile Silver/Gold/Platinum |
| `company-team.png` | owner.a, `/ro/company`: profil, locație, echipa de 5, permisiuni pe câmpurile ofertei |
| `inspiration.png`, `inspiration-mobile.png` | galeria cu pinii randați (desktop 1440 px + telefon) |
| `inspiration-lightbox.png` | lightbox „Biblioteca alba pe tot peretele” + „Idei asemănătoare” |
| `boards.png` | ana, „Colecțiile mele” cu cele 4 colecții |
| `landing-ideas.png` | landing complet, secțiunea „Caietul de idei” cu pinii (prin `shot-as.mjs`) |
