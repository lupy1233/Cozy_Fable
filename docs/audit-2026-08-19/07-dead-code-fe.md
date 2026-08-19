# Aria: cod mort FE + dependinte + repo

Audit READ-ONLY, 2026-08-19, repo `F:/Cozy Fable` (HEAD afa58e0 + modificari necomise in review-step/requests/[id]/messages).
Metoda: graf de importuri construit cu script propriu (173 fisiere `src/**`, rezolvare alias `@/` + relative + `import()` dinamic),
scanare exporturi (475 simboluri) cu grep pe identificator in toate celelalte fisiere, comparare package.json vs importuri reale,
grep pe assets/public, numarare console/TODO/any/eslint-disable, inspectie configuri + `git ls-files`. Toate cifrele sunt reproductibile
cu scripturile din `scratchpad/audit/graph.js` si `scratchpad/audit/fe/i18n.js`.

## CIFRE
| Metrica | Valoare |
|---|---|
| Fisiere orfane (0 importatori, ne-entry) | **8** (685 linii) |
| Exporturi moarte (0 referinte in afara fisierului) | **26** (+ ~40 simboluri exportate inutil, folosite doar intern — P2) |
| Dependinte nefolosite | FE **0** · BE **2** (`uuid`, `@types/uuid`) · shared 0 · root 0 · var env moarta `NEXT_PUBLIC_SOCKET_URL` |
| Assets orfane in `public/` | **0** din 11 (toate folosite; niciuna >500KB, dar 2,7MB PNG in total) |
| `console.log/warn/error` in src FE | **0** |
| `debugger` / `@ts-ignore` / `@ts-expect-error` | **0** |
| TODO/FIXME/HACK in src FE | **0** |
| `eslint-disable` | **34** (22 `no-img-element`, 9 `exhaustive-deps`, 3 `no-explicit-any`) |
| `any` explicit | **3** (2 in address-autocomplete, 1 in lang-switch) |
| Chei i18n moarte (doar in fisiere orfane) | **41** in `Landing` x 2 limbi; paritate ro/en perfecta (2667/2667) |
| Tailwind/CSS config mort | alias culoare `plan`, `shadow-glow`, bloc `.dark` (44 linii), `container`, `darkMode: class` |

## BINE FACUT
- Zero `console.*`, zero `debugger`, zero `@ts-ignore`, zero TODO/FIXME, zero cod comentat in `apps/frontend/src`. Codul de productie e curat.
- Toate cele 22 dependinte + 10 devDependinte din `apps/frontend/package.json` sunt importate real (inclusiv `tailwindcss-animate` in tailwind.config, `autoprefixer` in postcss). Nicio dependinta fantoma (tot ce se importa e declarat).
- Toate cele 11 PNG-uri din `public/illustrations` sunt referite (`illustrations/photo.tsx` + `demo-state.ts`).
- `ro.json`/`en.json`: 2667 chei fiecare, 0 diferente de structura; toate cele 30 namespace-uri sunt referite cu `useTranslations`.
- `next.config.mjs`: fara `ignoreBuildErrors`, fara `eslint.ignoreDuringBuilds`, fara `reactStrictMode: false`, fara `images.unoptimized`; `output: 'standalone'` + `outputFileTracingRoot` corecte pentru monorepo; modificarea necomisa (`skipTrailingSlashRedirect` + regulile `/socket.io/`) e justificata in comentariu si nu e o optiune „ciudata”.
- `tsconfig.json`: `strict: true`, fara `paths` aiurea. `.gitignore` acopera `.env`, `.env.local`, `*.tsbuildinfo`, `.next`, `dist`. Niciun `.env` real urmarit de git (doar `.env.example`).
- `Dockerfile.app` + `start-combined.sh` sunt ACTIVE (deploy Railway, referite in docs/08 + CHANGELOG) — nu sunt orfane.
- Pagina `/dev/piece-3d` e protejata (`notFound()` in productie); `/landing-v2` e redirect (linkuri vechi raman valide).
- Hook-urile de tip `use-*` sunt toate importate (0 fisiere hooks orfane); `stores/` la fel.

## DE MODIFICAT — `[P0|P1|P2] cale:linie — problema → recomandare`
- `[P1] apps/frontend/src/lib/mock-partner-meta.ts:9-30` — ratinguri Google (4.6–5.0) si numar de recenzii (38–218) GENERATE din hash-ul id-ului firmei, afisate public pe landing (`partners-carousel.tsx:8`) si pe `/partners` (`partners/page.tsx:6`) → inainte de lansare: fie ascunde ratingul/recenziile, fie inlocuieste cu campuri reale; cifre inventate pe un site live = risc de incredere/legal (vezi INTREBARI PO).
- `[P1] apps/frontend/.env.example:2`, `apps/frontend/Dockerfile:18,22`, `Dockerfile.app:26,30` — `NEXT_PUBLIC_SOCKET_URL` e declarat/expus ca build-arg dar NU e citit nicaieri (`grep -rn NEXT_PUBLIC_SOCKET_URL apps/frontend/src` = 0; `use-socket.ts:9` deriva URL-ul din `NEXT_PUBLIC_API_URL`) → sterge din toate cele 3 locuri ca sa nu induca in eroare la deploy.
- `[P1] .claude/settings.local.json` — fisier PERSONAL de permisiuni Claude Code (10KB, allowlist cu comenzi locale, PID-uri, cai Windows) urmarit de git → `git rm --cached` + adauga in `.gitignore` (`.claude/settings.local.json`); nu apartine repo-ului partajat.
- `[P2] apps/frontend/.eslintrc.json:3` — `"plugins": ["@typescript-eslint"]` declarat fara nicio regula configurata si fara dependinta directa (plugin-ul vine tranzitiv din `eslint-config-next`) → sterge linia (sau adauga regulile dorite + dependinta explicita).
- `[P2] apps/frontend/tailwind.config.ts:67-71` — alias de culoare `plan`/`plan-deep`/`plan-soft` definit „pentru viitor”, 0 utilizari (`walnut-*`: 294) → sterge aliasul sau fa migrarea (altfel ramane a doua denumire pentru acelasi token).
- `[P2] apps/frontend/tailwind.config.ts:107` — `boxShadow.glow` 0 utilizari; `:4` `darkMode: ['class']` + `globals.css:65-108` bloc `.dark` (44 linii) fara niciun toggle de tema si 0 clase `dark:` in src; `:8-12` `theme.container` 0 utilizari (`className="container"` = 0) → sterge sau marcheaza explicit ca „rezervat”.
- `[P2] apps/frontend/src/components/ui/alert.tsx:19-23` — props `icon`, `title`, `action` niciodata pasate (8 utilizari, toate doar `tone` + children); tonurile `sage` si `neutral` nefolosite → simplifica API-ul sau lasa, dar stiut.
- `[P2] apps/frontend/src/components/ui/button.tsx:30` — varianta `link` 0 utilizari; `avatar.tsx:14` prop `tone` niciodata pasata (1 singura utilizare, `dashboard/page.tsx:50`); `table.tsx:20` prop `clickable` pe `TR` 0 utilizari → curatare optionala.
- `[P2] apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:61`, `piece3d/piece-viewer.tsx:22`, `studio/room-viewer.tsx:24` — `hasWebGl()` copiat identic in 3 fisiere; `CameraRig` duplicat in `studio/room-canvas.tsx:670` si `studio/room-viewer.tsx:33`; `configurator3d-step.tsx:147` defineste un `Stepper` local desi exista `ui/stepper.tsx` → extrage in `lib/webgl.ts` / refoloseste (piece3d e aria altui agent, semnalat doar).
- `[P2] apps/frontend/src/app/[locale]/admin/settings/page.tsx:60` + `company/_components/company-dashboard.tsx:90` (`Section`), `admin/inspiration/page.tsx:37` + `inspiration/page.tsx:176` (`toggle<T>`), `_components/offer-builder.tsx:234` (`Field` local, desi exista `ui/field.tsx`) → helperi duplicati, de extras in `lib/` sau `ui/`.
- `[P2] apps/frontend/src/components/ui/choice-card.tsx` vs `components/configurator/playing-card.tsx` — doua componente „card selectabil” cu acelasi rol; `ChoiceCard` are 0 utilizari → sterge `choice-card.tsx` (vezi DE STERS).
- `[P2] apps/frontend/src/app/[locale]/page.tsx:17-18` — comentariul spune ca `hero-sheets`/`process-section` „raman in _components pentru refolosire”; sunt orfane de la 2026-08-01 si tin 41 chei i18n in viata → decizie: sterge (recomandat; git pastreaza istoricul) sau pastreaza explicit.
- `[P2] apps/frontend/public/illustrations/*.png` — 11 PNG-uri RGBA 480px, 195–290KB fiecare, 2,7MB in total, servite cu `<img>` (22 `eslint-disable no-img-element`, `next/image` = 0 utilizari in tot proiectul) → converteste la WebP (estimat 4–6x mai mic) sau trece pe `next/image`; sunt incarcate pe cardurile din configurator, deci conteaza pe mobil.
- `[P2] apps/frontend/src/app/[locale]/layout.tsx:31-35` + `public/` — nu exista favicon (`app/icon.*`, `public/favicon.ico`), `robots.txt`, `sitemap`, `opengraph-image`, `not-found.tsx`/`error.tsx` de nivel `[locale]` → fiecare pagina produce un 404 pe `/favicon.ico`; de adaugat inainte de lansare (aria SEO/ops, semnalat pentru completitudine).
- `[P2] README-SETUP.md:13` — refera `docs/PRODUCT_BIBLE_MASTER_V6.docx` (inexistent; docx-urile sunt in `Design/uploads/`) si descrie un „starter pack” de copiat, nu proiectul → rescrie ca README real al repo-ului sau sterge.
- `[P2] .claude/worktrees/unruffled-bardeen-4fff21/` — worktree git stale pe branch `claude/unruffled-bardeen-4fff21` (= initial commit f6b40e7, deja in main) cu o modificare locala neaplicata in `use-fulfillment.ts` (+3/-1); ignorat DOAR prin `.git/info/exclude` (local, nu prin `.gitignore`) → `git worktree remove` + `git branch -d`; adauga `.claude/worktrees/` in `.gitignore` daca se mai folosesc worktree-uri.
- `[P2] apps/frontend/src/app/[locale]/landing-v2/_components/` — director gol (ramas dupa promovarea landing-ului) → sterge.
- `[P2] dev-infra/docker-compose.prod.yml:70-105` — foloseste `apps/backend/Dockerfile` + `apps/frontend/Dockerfile` (deploy separat), in timp ce prod real ruleaza pe `Dockerfile.app` combinat → 2 cai de deploy de intretinut; confirma cu PO daca compose.prod mai e relevant (vezi INTREBARI).

## DE STERS — `cale:linie — ce + dovada`
### Fisiere intregi (8 fisiere, 685 linii; dovada: graf importuri = 0 importatori + `grep -rn "<nume-fisier>" src` = 0 in afara comentariului din page.tsx)
- `apps/frontend/src/app/[locale]/_components/hero-sheets.tsx` (211 linii) — `HeroSheets`, vechiul hero; singura mentiune: comentariu `page.tsx:17`. Odata sters, devin moarte si cheile i18n `Landing.heroSheetTitle/heroSheetClient/heroSheetsSwitcher/heroSheets.bookcase/ctaNewRequest/ctaCompanies/heroNote/metric*` (ro+en).
- `apps/frontend/src/app/[locale]/_components/process-section.tsx` (186 linii) — `ProcessSection`, inlocuit de `process-band.tsx`; 0 importatori. Chei i18n asociate moarte: `Landing.howTitle/step1-3*/sizing*/size*/credits*/ctaBand*/inspiration*` (total 41 chei `Landing` x 2 limbi; lista completa in `scratchpad/audit/fe/i18n-dead.json`).
- `apps/frontend/src/components/ui/card.tsx` (50 linii) — `Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter` (shadcn); 0 importatori (`grep -rn "ui/card'" src` = 0); toate cardurile din app sunt scrise inline sau in `playing-card`/`room-spec-card`.
- `apps/frontend/src/components/ui/choice-card.tsx` (95 linii) — `ChoiceCard`; 0 importatori, rol dublat de `configurator/playing-card.tsx`.
- `apps/frontend/src/components/ui/score-gauge.tsx` (50 linii) — `ScoreGauge`; 0 importatori.
- `apps/frontend/src/components/ui/separator.tsx` (21 linii) — `Separator`; 0 importatori (`grep -rnw Separator src` = doar definitia); landing-ul foloseste `SectionRule` local.
- `apps/frontend/src/components/ui/switch.tsx` (40 linii) — `Switch`; 0 importatori (`grep -rn "<Switch" src` = 0).
- `apps/frontend/src/components/ui/timeline.tsx` (32 linii) — `Timeline/TimelineItem`; 0 importatori.

### Exporturi moarte (26; dovada: `grep -rnw <simbol> apps/frontend/src --include=*.ts --include=*.tsx` = 1 rezultat = definitia)
- `apps/frontend/src/components/configurator/illustrations/common.tsx:26,37,47,61,72,83` — `IlluPal`, `IlluMdf`, `IlluLemnMasiv`, `IlluPush`, `IlluGlisante`, `IlluButonPresiune` (line-art inlocuite de `Photo*` din `photo.tsx`, PO 2026-07-31); `:114` re-exportul `illustrationStrokeProps` (0 importatori; `IllustrationSvg` din acelasi `export {}` ramane folosit).
- `apps/frontend/src/components/configurator/illustrations/materials-systems.tsx:9,22,35,48,63,77,93` — `IlluMdfInfoliat`, `IlluMdfVopsit`, `IlluMdfFurnir`, `IlluAltMaterial`, `IlluManer`, `IlluGola`, `IlluAventos` (acelasi motiv; din fisier ramane vie doar `IlluCountertopHpl:111`, importata in `illustrations/index.tsx:49`) → fisierul se reduce la ~15 linii sau `IlluCountertopHpl` se muta in `kitchen.tsx`.
- `apps/frontend/src/components/ui/dialog.tsx:8-9` — `DialogTrigger`, `DialogClose` (0 utilizari; dialogurile se deschid controlat prin `open`).
- `apps/frontend/src/hooks/use-company.ts:67` `useUpdateCompany`, `:79` `useUpdateLocation` — 0 utilizari (niciun UI de editare profil/locatie; endpoint-urile PATCH `/companies/me` si PUT `/companies/me/locations/:id` nu sunt apelate din FE).
- `apps/frontend/src/hooks/use-quotes.ts:27` `useCompanyQuotes` — 0 utilizari (`/quotes/mine` neapelat din FE).
- `apps/frontend/src/hooks/use-requests.ts:96` `useEditRequest` (ruta `/requests/drafts/:token/edit` neapelata; editarea reala foloseste `:242` `/requests/:id/edit`), `:169` `useUploadAttachment`, `:173` `useRemoveAttachment` („wrappers compat” peste `*For`, 0 utilizari).
- `apps/frontend/src/lib/inspiration.ts:8` `FURNITURE_TYPES` — 0 utilizari (tipul `FurnitureType` ramane folosit intern).
- `apps/frontend/src/app/[locale]/_components/hero-sheets.tsx:172` `HeroSheets`, `process-section.tsx:75` `ProcessSection` — vezi fisiere intregi.
- P2, doar cuvantul `export` e inutil (simbol folosit DOAR in fisierul propriu; ~40 cazuri, nu se sterge codul): `ui/button.tsx:45 ButtonProps, :61 buttonVariants`; `ui/badge.tsx:25 BadgeProps, :42 STATUS_TONE`; `ui/alert.tsx:19 AlertProps`; `configurator/dimension-figures.tsx:17,204,241,268,302,507,839,874,914` (FigureValues, KitchenPlanFigure, WallsPlanFigure, BalconyPlanFigure, FrontFigure, FrontRowFigure, DeskTopFigure, TableTopFigure, DimensionFigure — doar `getDimensionFigure` e importat, `step-renderer.tsx:28`); `configurator/address-autocomplete.tsx:39 AddressParts`; `configurator/attachment-item.tsx:13 AttachmentKindIcon`; `configurator/illustrations/question-anchor.tsx:38,44 TargetItem, TargetStrip`; `configurator/review-rail.tsx:11,13 RailState, RailNode`; `studio/palette.ts:4 RoomSwatch`; `studio/tutorial.tsx:48,84 TutorialTarget, TUTORIAL_STEPS`; `stores/configurator-store.ts:29,39,80 RoomInstance, ContactPreferenceValue, DimensionUnit`; `stores/studio-store.ts:36,57,84,100 STUDIO_WALLS, STUDIO_SNAP, clampToRoom, snapToGrid`; `hooks/use-inspiration.ts:36 INSPIRATION_PAGE_SIZE`; `lib/mock-partner-meta.ts:9 PartnerMeta`; `_components/mobile-nav.tsx:16 MobileNavLink`; `_components/public-header.tsx:24 PUBLIC_LINKS`.

### Dependinte
- `apps/backend/package.json:51` `"uuid": "^10.0.0"` + `:65` `"@types/uuid"` — 0 importuri (`grep -rn "from 'uuid'" apps/backend/src apps/backend/prisma` = 0; ID-urile vin din `crypto`/Prisma) → `pnpm -F backend remove uuid @types/uuid`.
- `apps/backend/package.json:42` `reflect-metadata` nu e importat explicit, dar e cerut de NestJS (importat de `@nestjs/core`) → PASTREAZA (semnalat ca sa nu fie sters din greseala). `pino-http` idem (peer al `nestjs-pino`, configurat in `app.module.ts:38`).
- Frontend / `packages/shared` / root: nimic de sters.
- Var env: `NEXT_PUBLIC_SOCKET_URL` (vezi DE MODIFICAT).

### Assets
- `apps/frontend/public/`: 0 orfane. Fisiere >500KB: niciunul individual; semnal optimizare: 11 PNG = 2,7MB (cel mai mare `lemn-masiv.png` 291KB) → WebP.
- `Design/uploads/` (urmarit in git): `product_bible.docx`, `Product_Bible_Master (1).docx`, `Product_Bible_Master (1)-8c1a2301.docx` sunt IDENTICE ca dimensiune (36.932 B) — 3 copii; `Continuitate_Refinement_V4_V5.docx` si `-fee4ec19.docx` identice (18.672 B) — 2 copii → pastreaza cate una (sau muta toate in `docs/`), ~110KB in istoric degeaba. `Design/.thumbnail` (WebP 320x221, 7,7KB) — artefact de export al tool-ului de prototipare, fara referinta → sterge.
- `Design/*.jsx|*.css|Plan Marketplace.html` (14 fisiere, ~340KB) — prototipul sursa al design-system-ului (referit in CHANGELOG:459 ca „sursa design”); NU e importat de nimic. Pastrare = decizie PO (arhiva utila) — daca se pastreaza, mutare in `docs/design-prototype/` ar fi mai clar.

### console.log
- Niciunul in `apps/frontend/src` (grep `console\.(log|warn|error|debug|info)` = 0).

## INTREBARI PENTRU PO
1. `mock-partner-meta.ts` — ratinguri Google si numar recenzii INVENTATE (deterministe din id) apar pe landing si `/partners`. La lansare publica: le ascundem pana avem date reale, sau acceptati afisarea lor cu eticheta „demo”? (risc de incredere/legal daca raman fara mentiune)
2. `hero-sheets.tsx` + `process-section.tsx` (vechiul landing, 397 linii + 41 chei i18n x2): confirmati stergerea? Comentariul din `page.tsx:17` le declara „pastrate pentru refolosire”, dar sunt orfane din 2026-08-01.
3. `Design/` (prototipul JSX/CSS + 5 docx, 492KB, urmarit in git): il pastram in repo ca arhiva (mutat in `docs/design-prototype/`, fara duplicatele docx) sau il scoatem din git?
4. `dev-infra/docker-compose.prod.yml` + `apps/frontend/Dockerfile` + `apps/backend/Dockerfile` (deploy pe servicii separate) mai sunt o cale suportata, sau ramane doar `Dockerfile.app` (Railway)? Daca nu, le marcam deprecated/stergem ca sa nu existe 2 pipeline-uri.
5. Hook-urile `useUpdateCompany`/`useUpdateLocation`/`useCompanyQuotes` nu au UI: exista in plan ecrane de editare profil firma / lista oferte proprii (atunci le pastram), sau le stergem impreuna cu endpoint-urile neapelate?
6. Optimizare imagini: acceptati conversia celor 11 PNG la WebP (sau trecerea pe `next/image`) inainte de lansare? 2,7MB de ilustratii pe cardurile de materiale conteaza pe mobil.
7. Dark mode: blocul `.dark` din `globals.css` + `darkMode: 'class'` exista fara toggle. Il scoatem (simplificare) sau e planificat?
