# Plan Sprint 75 (plan 2026-09-28): E-admin-platform-57 — primitive de design si curatenie tokeni (P3)

Data planului: 2026-09-30. Autor: planificator (doar citire). Implementare: Sonnet 5 (UI mecanic), verificare + inchidere: Opus 5.5.
Sursa: `remaining-sprints-75-76.json` (findings UI1-7, UI1-21, UI1-22, UI1-23, UI1-25, LIVE-14). Nicio decizie PO deschisa.
Toate numerele de linie de mai jos sunt din working tree la 2026-09-30 (NU din HEAD). Reciteste fisierul inainte de fiecare editare.

---

## 1. Obiectiv

Ecrane consecvente pentru client, firma si admin prin primitive comune:

1. `components/ui`: `Card` (+ `CardHeader/CardTitle/CardDescription/CardBody/CardFooter/CardSection`), `StatCard`, `EmptyState`, `Skeleton` (+ preseturi), `PageHeader`, `FilterChips`, `QueryState`/`LoadError`, `Popover` si `DropdownMenu` (wrappere Radix).
2. Migrarea paginilor dashboard, portofel (wallet), admin (toate paginile din `/admin`) si marketplace (lista, detaliu, preluari, fisa de lucru, mesaje) pe primitive; „Se încarcă…" / „…" inlocuite cu skeleton + timeout cu „Reîncearcă".
3. Headerul autentificat randat din cookie-ul de sesiune (indiciu de rol), fara saltul „header minimal → meniu complet" dupa `/auth/me`.
4. Meniul de cont (Radix DropdownMenu) arata avatar, nume, email si firma (pentru COMPANY_USER); adminul primeste si el meniul de cont (azi nu are logout in UI).
5. Scala tipografica mica (tokeni `text-micro/meta/ui/lead` + clase `heading-section/heading-card/meta-text/data-mono`), regula ESLint care interzice `text-[..px]` si `bg-card`, h1 pe portofel, alias `plan` sters, comentarii „albastru-plan" corectate, culori tier/avatar ca tokeni.

„Do first" (din pachet): numele, emailul si firma in capul meniului de cont — pasii 1-2 din ordinea de implementare.

---

## 2. Module si tabele afectate

- Frontend: `apps/frontend/src/components/ui/*` (noi + badge/table/tabs/avatar/button/label/stepper), `app/[locale]/_components/*` (app-header, public-header, notification-bell, chat-panel, todo-now-card, nou `account-menu.tsx`), `app/[locale]/layout.tsx`, `app/[locale]/admin/**`, `app/[locale]/dashboard/page.tsx`, `app/[locale]/marketplace/**`, `app/[locale]/requests/page.tsx`, `app/[locale]/inspiration/{page.tsx,_components/save-button.tsx,_components/board-picker.tsx,boards/[id]/page.tsx}`, `components/configurator/inspiration-picker.tsx`, `components/studio/room-viewer.tsx`, `hooks/use-auth.ts`, `hooks/use-company.ts`, `hooks/use-loading-timeout.ts` (nou), `lib/utils.ts`, `lib/session-hint.ts` + `lib/session-hint-context.tsx` (noi), `tailwind.config.ts`, `src/app/globals.css`, `.eslintrc.json`, `package.json` (+ `pnpm-lock.yaml` la radacina), `messages/ro.json` + `messages/en.json`. Plus inlocuirea mecanica a marimilor `text-[..px]` in restul fisierelor din 5.10.
- Backend (mic, doar auth): `apps/backend/src/modules/auth/auth.constants.ts`, `auth.controller.ts`, `auth.service.ts` (`refresh` intoarce si `role`), `auth.controller.spec.ts`.
- Shared: nimic.
- DB: NICIO tabela, NICIO migrare Prisma.
- Docs: `docs/design-tokens.md` (nou), `CHANGELOG.md`, note Codex (dupa Sprint 76, conform HANDOFF).

---

## 3. Presupuneri

1. Indiciul de sesiune e un cookie NOU `mm_session` (httpOnly, `SameSite=Lax`, `path=/`, `secure` in productie, `maxAge` = `REFRESH_TOKEN_TTL_SEC`) cu valoarea = rolul (`CLIENT|COMPANY_USER|ADMIN`). Motiv: `mm_access` are `maxAge` 15 min (browserul il sterge), iar `mm_refresh` are `path=/api/v1/auth`, deci niciunul nu ajunge la cererile de pagina `/ro/...` dupa o pauza. Cookie-ul NU e folosit nicaieri pentru autorizare (doar pentru a alege ce header se randeaza); backendul ramane singura autoritate.
2. Cookie-urile nu sunt izolate pe port: in dev, cookie-ul pus de `localhost:3001` ajunge si la cererile de pagina pe `localhost:3000`; in productie totul e same-origin (Next proxy-eaza `/api/v1` prin `BACKEND_INTERNAL_URL`). Deci `cookies()` din `[locale]/layout.tsx` vede `mm_session` in ambele medii.
3. Varianta respinsa: `GET /auth/me` pe server in layout + `HydrationBoundary`. Motive: +1 cerere backend pe FIECARE randare de pagina (prod are ~150 ms/query cross-region), access cookie-ul poate lipsi (15 min), refresh-ul nu se poate face pe server (cookie limitat la `/api/v1/auth`).
4. TanStack Query ramane sursa de adevar pentru user (`useMe`). Indiciul e un context React (valoare de randare venita din server, nu date API) folosit DOAR cat `useMe` e `pending`. Nu se pune in Zustand. Respecta invarianta 3.6.
5. Numele firmei vine din `useMyCompany()` (`GET /companies/me`, deja folosit de wallet/claims/lifecycle), activat doar pentru `COMPANY_USER` (param nou `enabled`). Nu schimbam `AuthUser` (varianta alternativa, `companyName` in `/auth/me`, ar cere schimbare de tip shared + backend; nu e necesara).
6. O singura raza de card: `rounded-xl` (14px, `tailwind.config.ts:97`). Tile-urile din interiorul unui card raman `rounded-lg` (8px, `--radius`). Controalele `rounded-md`, pastilele `rounded-full`.
7. `Badge`/`TierBadge` raman mono (statusurile sunt „date"; regula ATELIER: „mono doar pentru date (ID, sume, statusuri)"); isi pierd doar marimea arbitrara (`text-[10.5px]` → `text-micro`). `TH` (antete de tabel), `Tabs` si `ui/Label` trec pe stilul `.label` (sans spatiat) — sunt etichete, nu date. Nu e DECIZIE NECESARA (acceptanta nu cere Badge sans); daca PO vrea Badge sans, e o schimbare de 1 linie.
8. `.heading-section` = 20px (nu 22px cum propunea finding-ul) ca sa pastreze exact marimea majoritara de azi (`font-serif text-xl`, 21 aparitii) — zero regresie vizuala pe paginile migrate. `.heading-card` = 18px (`text-lg`).
9. Timeout de incarcare: `LOADING_TIMEOUT_MS = 15_000`. Dupa 15 s de `pending`, skeletonul devine `LoadError` cu „Reîncearcă" (`refetch()`; TanStack anuleaza cererea in zbor si reporneste).
10. Exit-animatiile Radix se omit pe Popover/DropdownMenu (doar `animate-in`): Presence asteapta `animationend`, iar in pane-ul de preview animatiile ingheata (gotcha cunoscut din polish r7); in plus panourile se inchid instant, ca azi.
11. Paginile client `requests/[id]`, `requests/[id]/offers`, `company/*`, `inspiration/boards`, configuratorul, Studio si landing-ul NU se migreaza pe Card/Skeleton in acest sprint (faza 2, 5.9) — exceptii: inlocuirea mecanica a marimilor `text-[..px]` (cerinta regulii de lint) si chips/popover acolo unde finding-ul le numeste explicit.
12. Dependinta `E-admin-platform-30` din pachet nu e in planul aprobat (nu a fost livrata); nimic din acest sprint nu depinde functional de ea.

---

## 4. Impact

- Backend: cookie nou `mm_session` setat la login / refresh / change-password si sters la logout / refresh esuat (`clearAuthCookies`). `GET /auth/me` NU trateaza `mm_session` ca material de sesiune (ramane `{ user: null }` pentru vizitatorul fara `mm_access`/`mm_refresh`/Bearer). `AuthService.refresh` intoarce in plus `role`.
- Frontend: primitive noi, 2 dependinte noi (`@radix-ui/react-popover`, `@radix-ui/react-dropdown-menu`), header din sesiune, meniu de cont nou (si in admin), migrare pagini, scala tipografica + regula lint (inlocuiri mecanice in ~57 fisiere), tokeni noi in `globals.css`.
- DB: niciunul.
- Realtime: niciunul (clopotelul pastreaza `useRealtimeSync()` si se monteaza tot doar cand `me.data` exista).
- Securitate: cookie nou httpOnly fara date sensibile (doar rolul); nu e folosit pentru authz; CSP neschimbat (`style-src 'unsafe-inline'` exista deja in `lib/csp.ts:74`; Radix Popper seteaza stiluri prin CSSOM). Dependintele noi trec prin `pnpm audit --audit-level high` (CI). Security-close la final.
- Audit: niciun eveniment nou.
- i18n: chei noi RO+EN (sectiunea 9); cheile `loading` moarte se sterg doar daca au 0 utilizari.

---

## 5. Inventar si tabel de migrare (fisier → primitiva)

Legenda: C = `Card`/`CardSection`, S = `StatCard`, E = `EmptyState`, K = skeleton (`QueryState` + preset), P = `PageHeader`, F = `FilterChips`, PO = `Popover`, DM = `DropdownMenu`, T = token tipografic/culoare.

Inventar global (grep in `apps/frontend/src`, 2026-09-30): containere card scrise de mana `rounded-(md|lg|xl|2xl) border border-(border|border-2) bg-(surface|card|surface-2)` = ~230 aparitii in 80 de fisiere (cele mai multe: studio-page 14, offer-card 13, dashboard 9, company-dashboard 7, wallet 6, project-case-panel 6); stari de incarcare text = 46 (`t('loading')` sau `…`); 5 popovere scrise de mana; 8 variante de pastile de filtru; 3 functii `Section` locale identice; 134 marimi `text-[..px]` in 57 fisiere; 13 `bg-card`; 14 culori hex in 4 fisiere.

### 5.1 Dashboard — `app/[locale]/dashboard/page.tsx`

| Linie | Azi | Devine |
|---|---|---|
| 39-45 | `me.isPending/isError` → `<p py-20>{t('loading')}</p>` in `AppShell` | `QueryState pending={me.isPending}` cu `SkeletonPage variant="dashboard"` (tot in `AppShell`); la `me.isError` ramane redirectul existent (efectul de la 35-37) |
| 50 | `h1.page-title` | K/P: `PageHeader title={t('dashboardTitle')}` |
| 51-60 | card profil `rounded-xl ... p-6` | `Card padding="lg" className="flex items-center gap-4"` |
| 76-78 | `stats.isPending` → text `Dashboard.loading` | `SkeletonStatGrid count={4}` + `SkeletonCard` (firma) |
| 80 si 205 | `stats.isError` → `return null` (eroare invizibila) | `LoadError onRetry={() => void stats.refetch()}`; `!stats.data` fara eroare (firma neonboardata) ramane `null` |
| 98-108 | 4 KPI inline `font-serif text-2xl` | 4× `StatCard label icon value` in `grid gap-3 sm:grid-cols-2 lg:grid-cols-4` |
| 111-137 | card credite + 4 tile-uri `rounded-lg bg-surface-2 text-2xl` | `CardSection title={t('company.credits')} actions={<Link wallet>}`; tile-urile → `StatCard variant="inline" align="center"` |
| 141-155 | card per membru | `CardSection title icon={Users}` |
| 159-171 | card statusuri preluari (+ gol `noClaims`) | `CardSection`; golul → `EmptyState size="sm" variant="plain" title={t('company.noClaims')}` |
| 172-179 | card penalizari `text-2xl` | `StatCard label={t('company.penalties')} icon={ShieldAlert} value hint={t('company.penaltyPoints')} tone={points > 0 ? 'warning' : 'default'}` |
| 202-204 | `stats.isPending` (client) | `SkeletonStatGrid count={3}` + `SkeletonCard` |
| 219-229 | 3 KPI `text-3xl` | 3× `StatCard` |
| 233-243 | card statusuri | `CardSection` |
| 246-271 | card activitate + gol `noRequests` | `CardSection actions={<Link allRequests>}`; gol → `EmptyState size="sm" variant="plain"` |

`_components/todo-now-card.tsx:52` → `Card as="section" aria-labelledby="todo-now-title"` (markup interior neschimbat).

### 5.2 Portofel — `app/[locale]/marketplace/wallet/page.tsx`

| Linie | Azi | Devine |
|---|---|---|
| 151-153 | `me.isPending` → text | `SkeletonPage variant="detail"` (max-w-3xl) |
| 259-262 si 270-273 | link `t('back')` (ambele ramuri: blocat / normal) | `PageHeader back={{ href: '/marketplace', label: t('back') }} title={t('wallet.pageTitle')} subtitle={t('wallet.pageSubtitle')}` = **h1 nou** (azi pagina porneste de la h2, linia 288); si in ramura `blockedErr` |
| 223-252 | `penaltiesSection` (ton crimson cand suspendata) | `Card as="section" tone={suspended ? 'crimson' : 'default'}` + `CardTitle size="section"` |
| 287-307 | card „Portofel de credite" + `wallet.isPending` text | `CardSection titleSize="section" title={t('wallet.title')}`; pending → `SkeletonStatGrid count={3} variant="inline"`; `Metric` → `StatCard variant="inline" align="center" tone={highlight ? 'default' : 'muted'}`; `wallet.none` → `EmptyState size="sm" variant="plain"` |
| 311-427 | card abonament + `subscription.isPending` text | `CardSection id="subscription" className="scroll-mt-24"`; pending → `SkeletonText lines={3}` |
| 430-479 | card „Cumpără credite"; pachetele `rounded-xl border-border-2 bg-surface p-4` | `CardSection`; pachet → `Card tone="muted" padding="sm"`; `packages.isPending` (azi nimic) → `SkeletonStatGrid count={3}`; `noPackages` → `EmptyState size="sm" variant="plain"` |
| 481-570 | panoul transfer bancar (`id="bank-transfer"`, `border-amber/30 bg-amber-soft`) | `CardSection id="bank-transfer" tone="amber" className="scroll-mt-24"` (pastreaza `id` — `scrollIntoView` din `onPurchaseResult` depinde de el) |
| 572-645 | istoric comenzi; `noOrders` | `CardSection`; `orders.isPending` → `SkeletonList rows={3}`; gol → `EmptyState size="sm" variant="plain"` |
| 648-653 | link card „Preluările mele" | `Card asChild interactive padding="sm"` pe `Link` |
| 741 | `PriceBreakdown` `rounded-lg bg-secondary/50` | ramane (tile interior, `rounded-lg` permis) |
| 780-790 | `function Metric` | STERS (inlocuit de `StatCard variant="inline"`) |

### 5.3 Admin — `app/[locale]/admin/**`

| Fisier:linie | Azi | Devine |
|---|---|---|
| `layout.tsx:46,49` | `text-[15px]`, `text-[9.5px]` | `text-lead`, `text-micro` |
| `layout.tsx:56-58` | eticheta hardcodata „Admin" mono `text-[10px]` | `<div className="label px-2.5 pb-1 pt-1.5">{t('navHeading')}</div>` |
| `layout.tsx:66` | `text-[13.5px]` | `text-ui` |
| `layout.tsx:81-83` | text hardcodat „Plan · panou operational" (identitate PLANSA) | `Card tone="muted" padding="sm" className="mt-auto text-xs text-muted-foreground"` cu `{t('sidebarNote')}` |
| `layout.tsx:88-94` | bara de sus: Lang + clopotel (`me.data &&`) | Lang + clopotel/placeholder (7.2) + `<AccountMenu role="ADMIN" />` (NOU: adminul nu avea logout in UI) |
| `page.tsx:20-21` | `kpi.isPending` si `!kpi.data` → text (la eroare = incarcare infinita, bug) | `QueryState pending={kpi.isPending} error={kpi.error} onRetry={() => void kpi.refetch()} skeleton={<><SkeletonStatGrid count={8} /><SkeletonCard /></>}` |
| `page.tsx:26` | h1 | `PageHeader` |
| `page.tsx:27-36, 51-62` | `function Card` KPI (`text-3xl`, highlight amber) | 8× `StatCard tone={highlight ? 'warning' : 'default'}`; functia locala STEARSA |
| `page.tsx:64-78` | `Breakdown` card | `CardSection title` (lista ramane) |
| `companies/page.tsx:40-42` | `me.isPending` → `<p>…</p>` | `SkeletonPage variant="table"` |
| `companies/page.tsx:46` | h1 | `PageHeader` |
| `companies/page.tsx:48-62` | pastile mono `bg-foreground`, fara `aria-pressed`/`type` | `FilterChips label={t('filterLabel')} value={status} onChange options={STATUSES…}` |
| `companies/page.tsx:65` | tabel in card | `Card padding="none"`; `list.isPending` (azi nimic) → `SkeletonTable rows={6} cols={6}`; `list.isError` (azi nimic) → `LoadError` |
| `companies/page.tsx:78-83` | TD gol | `EmptyState size="sm" variant="plain"` in TD |
| `companies/[id]/page.tsx:24-29` | `<p>…</p>` / `t('empty')` | `SkeletonPage variant="detail"` / `EmptyState title={t('empty')} action={<Link /admin/companies>}` |
| `companies/[id]/page.tsx:41,43,67,105` | h1 + 3 carduri | `PageHeader back`; `Card`/`CardSection` |
| `users/page.tsx:33` | h1 | `PageHeader` |
| `users/page.tsx:43-54` | pastile sans `bg-foreground`, fara `aria-pressed` | `FilterChips label={t('roleFilterLabel')}` |
| `users/page.tsx:58-64` | `…` / eroare / gol | `SkeletonTable rows={6} cols={5}` / `LoadError onRetry` / `EmptyState variant="card" size="sm"` |
| `users/page.tsx:67` | tabel card | `Card padding="none" className="overflow-x-auto"` |
| `requests/page.tsx:37,53-61` | h1, loading, eroare, gol, card tabel | `PageHeader`, `SkeletonTable`, `LoadError`, `EmptyState`, `Card padding="none"` |
| `requests/[id]/page.tsx:44-47,60,70,103,132,153,210` | loading, notFound, h1, 5 carduri | `SkeletonPage variant="detail"`, `EmptyState`, `PageHeader back`, `Card`/`CardSection` |
| `disputes/page.tsx:24,28,30,35` | loading, h1, gol, card per disputa; lista fara pending/eroare | `SkeletonPage variant="list"`, `PageHeader`, `EmptyState`, `Card`; `list.isPending` → `SkeletonList`, `list.isError` → `LoadError` |
| `withdrawals/page.tsx:33-35,39,41,46` | idem | idem |
| `payments/page.tsx:99,133,153-156,161,342,505` | loading ×2, h1, gol, card tabel, 2 sectiuni | `SkeletonPage variant="table"`, `PageHeader`, `SkeletonTable`, `EmptyState`, `Card padding="none"`, `CardSection` ×2; 5× `text-[..px]` → tokeni |
| `contact-detections/page.tsx:29,33-36,43` | h1, loading, eroare, gol, card tabel | `PageHeader`, `SkeletonTable`, `LoadError`, `EmptyState`, `Card padding="none"` |
| `audit/page.tsx:19,29` | h1, card tabel; `logs` fara pending/eroare/gol | `PageHeader`, `Card padding="none"`, `SkeletonTable`, `LoadError`, `EmptyState` |
| `jobs/page.tsx:14,16` | h1, gol; fara pending | `PageHeader`, `EmptyState`, `SkeletonList`; cardurile de job → `Card tone="crimson" padding="sm"` |
| `calendar/page.tsx:58-65` | `function Section` local | `CardSection` (functia locala STEARSA) |
| `calendar/page.tsx:79,104-105` | h1, `isLoading` text, eroare `Alert` | `PageHeader`, 2× `SkeletonCard`; eroarea ramane `Alert` |
| `calendar/page.tsx:288` | `'…'` intr-un rand | `<Skeleton className="inline-block h-4 w-40 align-middle" />` |
| `sizing/page.tsx:100,108,112,133,134,198` | h1, loading text, bara sticky, 2 tipuri de sectiune, h2 `font-mono text-sm` | `PageHeader`, 3× `SkeletonCard`, bara ramane (deja `rounded-xl`), `CardSection`; h2 → `CardTitle className="data-mono"` |
| `settings/page.tsx:68,126,278-285` | h1, sectiune fiscal, `function Section` local | `PageHeader`, `CardSection id="fiscal" className="scroll-mt-24"`, functia locala STEARSA → `CardSection`; `settings.isPending` (azi nimic) → `SkeletonText` in sectiune |
| `inspiration/page.tsx:91,122,125,207,239` | `return null` la pending, h1, sectiune, gol, card | `SkeletonPage variant="list"`, `PageHeader`, `CardSection`, `EmptyState`, `Card padding="none"` |

### 5.4 Marketplace — `app/[locale]/marketplace/**`

| Fisier:linie | Azi | Devine |
|---|---|---|
| `page.tsx:31-33` | `me.isPending` text | `SkeletonPage variant="list"` |
| `page.tsx:37-49` | h1 + subtitlu + link portofel | `PageHeader title subtitle actions={<Link wallet>}` |
| `page.tsx:51` | `list.isPending` text | `SkeletonList variant="cards" rows={4} className="lg:grid-cols-2"` |
| `page.tsx:55-57` | gol | `EmptyState variant="card" icon={Inbox} title={t('empty')}` |
| `page.tsx:65` | link-card `rounded-2xl` + hover | `Card asChild interactive className="grid grid-cols-[1fr_auto] gap-4"` pe `Link` (raza devine `rounded-xl`) |
| `page.tsx:68,71,99,102` | h2 `font-serif text-xl tracking-[-0.01em]`, `text-[13px]`, `text-[11px]` ×2 | `heading-section`, `text-ui`, `text-meta` |
| `[id]/page.tsx:30-35` | loading text; eroare = `t('empty')` | `SkeletonPage variant="detail"`; eroare → `EmptyState tone="error" title={t('empty')} action={<Link back>}` |
| `[id]/page.tsx:41-46, 45, 136` | back link + h1 in card, 2 carduri | `PageHeader back` (in afara cardului) + `Card` ×2 (titlul poate ramane in card prin `PageHeader className`) |
| `claims/page.tsx:43-45,49-57,59,62,68` | loading, header, loading lista, gol, card tabel | `SkeletonPage variant="table"`, `PageHeader back`, `SkeletonTable`, `EmptyState variant="card"`, `Card padding="none"` |
| `claims/[claimSlotId]/page.tsx:65-70` | loading/notFound text | `SkeletonPage variant="detail"` / `EmptyState action={<Link /marketplace/claims>}` |
| `claims/[claimSlotId]/page.tsx:84-94 si ~188-196` | back + badge + h1 (fisa + `ClosedClaimSummary`) | `PageHeader back meta={<StatusBadge …/>}` |
| `claims/[claimSlotId]/page.tsx:205,404` | nota `rounded-xl bg-surface-2` | `Card tone="muted" padding="sm"` |
| `claims/[claimSlotId]/page.tsx:415,466` | `ClientCard` / `ProjectCard` | `Card as="section" padding="none"` / `Card as="section" padding="sm"` |
| `claims/[claimSlotId]/page.tsx:421-423, 467` | micro-etichete `font-mono text-[10px] uppercase tracking-[0.14em]` (una e `<h2>`) | clasa `.label` (h2-ul ramane h2, stilul devine `.label`) — rezolva „h2 de 10px mono" din UI1-21 |
| `messages/page.tsx:42-44` | loading | `SkeletonPage variant="list"` |
| `messages/page.tsx:59-62` | h1 + subtitlu | `PageHeader` |
| `messages/page.tsx:64-73, 153-175` | `TabButton` local (walnut-soft) | `FilterChips label={t('tabsLabel')}` cu `indicator={<UnreadDot/>}` si `icon={<Users/>}` pe „Echipa"; `TabButton` STERS |
| `messages/page.tsx:84` | loading echipa | `SkeletonCard lines={4}` |
| `messages/page.tsx:88,96,143` | gol, lista, „alege o conversatie" dashed | `EmptyState variant="card"`, `Card padding="none"`, `EmptyState variant="dashed" size="sm"` |
| `messages/page.tsx:200,217,229` | `text-[10px]`, `text-[11px]` ×2 | `text-micro`, `text-meta` |
| `_components/access-blocked.tsx:25-49` | card blocaj propriu `rounded-2xl` | reimplementat peste `EmptyState` (`tone="warning"` cand codul e cunoscut, `"error"` altfel) cu `action`; API-ul `AccessBlocked({ error, onRetry })` NESCHIMBAT |
| `../_components/chat-panel.tsx:80` | `messages.isPending` → `Chat.loading` („Se încarcă…" vizibil in fisa de lucru si in mesaje) | `SkeletonList rows={3} variant="bubbles"` |

### 5.5 Cereri client (doar ce cere finding-ul) — `app/[locale]/requests/page.tsx`

| Linie | Azi | Devine |
|---|---|---|
| 67-69 | loading text | `SkeletonPage variant="list"` |
| 73-83 | h1 + subtitlu + buton | `PageHeader title subtitle actions={<Button asChild variant="walnut">…}` |
| 86-109 | pastile walnut + `aria-pressed` + count | `FilterChips label={t('tabsLabel')} options={TABS.map((tb) => ({ value: tb, label: t(\`tabs.${tb}\`), count: countFor(tb), dimmed: countFor(tb) === 0 }))}` |
| 112-116 | gol pe tab (dashed) | `EmptyState variant="dashed" size="sm"` |
| 118-129 | gol total (icon + titlu + CTA, `rounded-2xl`) | `EmptyState variant="dashed" icon={Plus} title={t('emptyTitle')} hint={t('emptyHint')} action={…}` |

### 5.6 Popovere si dropdown-uri (5 instante, UI1-23)

| Fisier:linie | Azi | Devine |
|---|---|---|
| `_components/app-header.tsx:69-86, 121-169` | meniu cont: `useState` + `mousedown` + Escape, `role="menu"` fara sageti/focus, antet = doar rolul | `<AccountMenu role=… />` (fisier nou `_components/account-menu.tsx`) pe `DropdownMenu`; antet: `Avatar` + nume + email + firma + rol |
| `_components/notification-bell.tsx:173-192, 197-302` | `rootRef` + `mousedown` + Escape, panou `absolute w-[22rem]` | `Popover open={open} onOpenChange={setOpen}` + `PopoverTrigger asChild` (butonul existent) + `PopoverContent width="lg" align="end" className="p-0"`; efectul si `rootRef` STERSE; `useEmailPreference(open)` pastrat |
| `inspiration/_components/save-button.tsx:29-48, 79-109` | `mousedown` fara Escape; `BoardPicker` cu panou absolut propriu | `Popover` controlat (pastreaza `onOpenChange` spre pin), `PopoverContent width="md" onEscapeKeyDown={(e) => e.stopPropagation()}` (Escape nu mai inchide si lightbox-ul) |
| `inspiration/_components/board-picker.tsx:45` | `div absolute right-0 z-20 mt-2 w-64 rounded-xl …` | doar CONTINUTUL (fara pozitionare/panou): wrapper `text-left`; panoul vine din `PopoverContent`; `text-[10px]` → `text-micro` |
| `inspiration/boards/[id]/page.tsx:39-48, 67-82` | `mousedown`, fara Escape; pickerul e taiat de `overflow-hidden` pe `figure` | `Popover` controlat (`moveOpen` pastrat pentru opacitatea actiunilor); Portal = nu mai e taiat |
| `inspiration/page.tsx:86-139` (`FilterGroup`, 3 utilizari la ~321-389) | buton + backdrop `fixed inset-0` + panou absolut, fara Escape | `Popover open={open} onOpenChange={(o) => (o ? onToggle() : onClose())}` + `PopoverTrigger asChild` + `PopoverContent align="start" width="auto" className="p-2.5 max-w-[min(21rem,calc(100vw-2.5rem))]"`; backdrop-ul STERS |
| `_components/mobile-nav.tsx` | panou hamburger (disclosure, Escape deja) | NESCHIMBAT (navigatie, nu popover) |

### 5.7 Filter chips (UI1-22)

| Fisier:linie | Varianta azi | Devine |
|---|---|---|
| `requests/page.tsx:86-109` | walnut plin, `aria-pressed`, count | `FilterChips` (5.5) |
| `inspiration/page.tsx:190-213, 310-316` | `FilterPill` local (copie a celor de la requests) | `FilterChips allowDeselect label={t('roomFilterLabel')}` cu primul chip „Toate" (`value: 'ALL'`, activ cand `type === null`) — comportamentul de azi pastrat: click pe camera activa revine la „Toate"; `FilterPill` STERS |
| `marketplace/messages/page.tsx` | `TabButton` walnut-soft | `FilterChips` (5.4) |
| `admin/companies/page.tsx:48-62` | mono uppercase `bg-foreground`, fara `aria-pressed`/`type` | `FilterChips` |
| `admin/users/page.tsx:43-54` | sans `bg-foreground`, fara `aria-pressed` | `FilterChips` |
| `components/configurator/inspiration-picker.tsx:215-238` | walnut-soft `py-1`, fara `aria-pressed` | `FilterChips size="sm" label={ti('roomFilterLabel')}` (acelasi tipar „Toate" ca pe /inspiration) |
| `components/configurator/inspiration-picker.tsx:187-209` | comutator galerie/colectii (schimba VEDEREA) | vizual NESCHIMBAT; adauga `aria-pressed={tab === tb}` (vedere, nu filtru; `ui/Tabs` ar cere tabpanel — faza 2) |
| `components/studio/room-viewer.tsx:158-166` | walnut `text-xs py-1`, fara `aria-pressed` | `FilterChips size="sm" label={studio('sceneChipsLabel')}` (optiuni = scenele, `label = <ContactSafeText text={s.name} />`, valoarea = `s.id`; `onChange` seteaza indexul + `setWholeHouse(false)`) |
| NU se migreaza | segmented `configurator3d-step.tsx:1005-1030`, scenele din `studio-page.tsx:1638-1693`, pastila status `company-dashboard.tsx:61`, `claim-lifecycle-panel.tsx:93` | comutatoare de vedere / statusuri, nu filtre |

Semantica „Toate": `FilterChips` e generic pe valori string; pentru „Toate" se foloseste o valoare sentinel (`'ALL'` la users, `''` la companies — exact ca azi); pe inspiratie/picker se adauga optiunea `{ value: 'ALL', label: ti('all') }` si se mapeaza `'ALL'` ↔ `null` in pagina. `ui/Tabs` ramane pentru comutare de vederi (azi: `admin/payments`, `configurator/room-cart-step`).

### 5.8 Helper-e locale duplicate (UI1-7)

| Fisier:linie | Devine |
|---|---|
| `admin/settings/page.tsx:278` `function Section` | `CardSection` (STERS) |
| `admin/calendar/page.tsx:58` `function Section` | `CardSection` (STERS) |
| `company/_components/company-dashboard.tsx:148` `function Section` (text-xl, gap-3) | `CardSection titleSize="section"` (STERS) — singura atingere a paginii firmei (inlocuire 1:1) |
| `admin/page.tsx:51` `function Card` | `StatCard` (STERS) |
| `marketplace/wallet/page.tsx:780` `function Metric` | `StatCard variant="inline"` (STERS) |
| `requests/[id]/page.tsx:173` `SectionHeading` | faza 2 |

### 5.9 Faza 2 (inventariat, NU in Sprint 75)

Carduri/empty/loading ramase: `components/studio/studio-page.tsx` (14 containere), `_components/offer-card.tsx` (13), `company/_components/company-dashboard.tsx` (7, in afara de `Section`), `_components/project-case-panel.tsx` (6), `configurator3d-step.tsx` (5), `claim-lifecycle-panel.tsx` (5), `client-fulfillment.tsx` (4), `requests/[id]/offers/page.tsx` (3 + loading 81 + gol 113), `requests/[id]/page.tsx` (loading 25, gol 28, `SectionHeading` 173), `inspiration/boards/page.tsx` (3 + gol 101), `inspiration/boards/[id]/page.tsx` (loading 129, notFound 136), `partners/page.tsx` (loading 29, gol 45), `company/page.tsx` (loading 32, 41), `(auth)/change-password/page.tsx:45`, `configurator-wizard.tsx:304-314`, `inspiration-picker.tsx:241,251,302` (`…`), `firm-rules-article.tsx:39`, restul configuratorului si Studio. Se migreaza pagina cu pagina in sprinturi viitoare, cu aceleasi primitive.

### 5.10 Marimi arbitrare `text-[..px]` (UI1-21) — inlocuire mecanica in TOT `apps/frontend/src` (cerinta regulii de lint)

Totaluri azi: 134 aparitii in 57 fisiere: `[11px]`×56, `[10px]`×31, `[13px]`×11, `[15px]`×10, `[10.5px]`×10, `[12.5px]`×4, `[13.5px]`×3, `[9px]`×2, `[19px]`×2, `[12px]`×2, `[9.5px]`×1, `[26px]`×1, `[21px]`×1.

Maparea (unica, deterministica):

| Azi | Token | Nota |
|---|---|---|
| `text-[9px]`, `text-[9.5px]`, `text-[10px]`, `text-[10.5px]` | `text-micro` (10px / 15px) | Badge, TH, contoare, micro-etichete |
| `text-[11px]` | `text-meta` (11px / 16px) | |
| `text-[12px]`, `text-[12.5px]` | `text-xs` (12px / 16px, Tailwind) | |
| `text-[13px]`, `text-[13.5px]` | `text-ui` (13px / 18px) | nav header, admin sidebar, `ui/table` |
| `text-[15px]` | `text-lead` (15px / 22px) | logo mic, mobile nav |
| `text-[19px]` | `text-xl` (20px) | logo `lg` (`components/brand/logo.tsx:63`), `process-band.tsx:386` h3 |
| `text-[21px]` | `heading-section` (20px) | `sketch-guide/page.tsx:213` (scoate si `font-serif`, e inclus in clasa) |
| `text-[26px]` | `text-2xl` (24px) | `configurator/step-renderer.tsx:91` (pastreaza `sm:text-3xl`) |

Fisiere (aparitii): `_components/process-band.tsx` 9; `components/configurator/step-renderer.tsx` 6; `[locale]/page.tsx` 6; `_components/hero-demo.tsx` 6; `configurator/attachment-item.tsx` 5; `marketplace/claims/[claimSlotId]/page.tsx` 5; `admin/payments/page.tsx` 5; `studio/studio-page.tsx` 4; `configurator/playing-card.tsx` 4; `sketch-guide/page.tsx` 4; `admin/layout.tsx` 4; `studio/tutorial.tsx` 3; `configurator/start-mode-step.tsx` 3; `configurator/room-spec-card.tsx` 3; `piece3d/configurator3d-step.tsx` 3; `requests/[id]/offers/page.tsx` 3; `marketplace/page.tsx` 3; `marketplace/messages/page.tsx` 3; cate 2 in: `ui/table.tsx`, `ui/badge.tsx`, `configurator/sketch-guide.tsx`, `configurator/room-flow-runner.tsx`, `configurator/review-step.tsx`, `configurator/request-inspiration-strip.tsx`, `configurator/inspiration-picker.tsx`, `configurator/budget-slider.tsx`, `brand/logo.tsx`, `inspiration/page.tsx`, `inspiration/boards/[id]/page.tsx`, `inspiration/_components/inspiration-pin.tsx`, `inspiration/_components/board-picker.tsx`, `_components/public-header.tsx`, `_components/offer-builder.tsx`, `_components/notification-bell.tsx`, `_components/app-header.tsx`; cate 1 in: `ui/tabs.tsx`, `ui/stepper.tsx`, `ui/label.tsx`, `configurator/uploads-step.tsx`, `configurator/room-cart-step.tsx`, `configurator/review-rail.tsx`, `configurator/illustrations/question-anchor.tsx`, `configurator/configurator-wizard.tsx`, `marketplace/claims/page.tsx`, `[locale]/error.tsx`, `dev/piece-3d/page.tsx`, `company/page.tsx`, `company/_components/company-dashboard.tsx`, `admin/contact-detections/page.tsx`, `admin/companies/page.tsx`, `_components/mobile-nav.tsx`, `_components/lang-switch.tsx`, `_components/client-fulfillment.tsx`, `_components/claim-lifecycle-panel.tsx`, `_components/chat-panel.tsx`, `(auth)/register/page.tsx`.

`text-[0.85em]` (relativ, 1 aparitie) si `leading-[1.15]` raman (regula vizeaza doar `px`). Valorile arbitrare de `tracking-[…]` raman (nu sunt in acceptanta).

### 5.11 Tokeni de culoare (UI1-25)

| Fisier:linie | Azi | Devine |
|---|---|---|
| `tailwind.config.ts:56-63` | alias `plan` (0 utilizari) + comentariu „PLANSA / albastru-plan / ~40 fisiere vechi" | alias STERS; comentariu: „paleta de brand ATELIER: nuc (walnut), salvie, chihlimbar, alama, carmin, info" |
| `tailwind.config.ts:21-22` si 52-55 | `surface: 'hsl(var(--card))'` duplicat cu `card` | `surface` (270 utilizari) = tokenul pentru cod; `card` ramane DOAR pentru contractul shadcn (`components.json`), cu comentariu „nu folosi `bg-card` in cod"; lint interzice `bg-card` |
| `tailwind.config.ts:95-101` | comentariul razei | documenteaza: card = `rounded-xl`, tile interior = `rounded-lg`, control = `rounded-md`, pastila = `rounded-full` |
| `globals.css:6,13` | „Plan — Marketplace Mobilier", „NOTA: aliasul tailwind plan" | „Cozy Home — design tokens ATELIER"; nota STEARSA |
| `globals.css:51` | `/* nuc #855232 (alias: plan) */` | `/* nuc #855232 */` |
| `components/ui/button.tsx:12` | „acum albastru-plan" | „accentul de brand (nuc)" |
| `components/ui/avatar.tsx:30` | `text-[#FBF6EC]` | `text-on-walnut` (token `--on-walnut: 40 65% 95%`) |
| `components/ui/badge.tsx:77-81` | 9 hex in `TIER_CLASS` | `bg-gradient-to-br from-tier-platinum-from to-tier-platinum-to text-tier-platinum-fg` (si gold/silver) |
| `bg-card` ×13: `_components/partners-carousel.tsx` (2), `inspiration/boards/[id]/page.tsx` (2), `inspiration/boards/page.tsx` (2), `inspiration/page.tsx` (4), `requests/page.tsx` (1), `sketch-guide/page.tsx` (1) | | `bg-surface` (acelasi var, zero diferenta vizuala) |
| `studio/studio-page.tsx:1395,1880`, `studio/tutorial.tsx:357,440` (hex Studio) | | NU in acest sprint (nu e in acceptanta; canvas Studio) |

---

## 6. API-ul primitivelor noi (`apps/frontend/src/components/ui/`)

Reguli comune: `cn()` din `@/lib/utils`; `forwardRef` unde elementul poate primi ref; fara texte hardcodate (textele vin prin props; singurele texte proprii = `Common.loadState.*`); fara `'use client'` unde nu e nevoie (`card`, `stat-card`, `empty-state`, `page-header` sunt server-safe; `skeleton`, `query-state`, `filter-chips`, `popover`, `dropdown-menu` sunt client). Comentarii in romana fara diacritice.

### 6.1 `card.tsx`

```ts
type CardTone = 'default' | 'muted' | 'dashed' | 'amber' | 'crimson' | 'sage' | 'info';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';           // '' | p-4 | p-5 (implicit) | p-6

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li' | 'aside';      // implicit 'div'
  asChild?: boolean;                                         // Slot (@radix-ui/react-slot) — ex. <Link> card
  tone?: CardTone;                                           // implicit 'default'
  padding?: CardPadding;
  interactive?: boolean;                                     // hover lift (lista marketplace, link-uri card)
}
export const Card: React.ForwardRefExoticComponent<CardProps & React.RefAttributes<HTMLElement>>;
export const cardVariants: (opts?: { tone?: CardTone; padding?: CardPadding; interactive?: boolean }) => string;

export function CardHeader(p: React.HTMLAttributes<HTMLDivElement>): JSX.Element;   // 'mb-3 flex items-start justify-between gap-3'
export function CardTitle(p: {
  as?: 'h2' | 'h3'; size?: 'section' | 'card'; icon?: LucideIcon; id?: string; className?: string; children: React.ReactNode;
}): JSX.Element; // size 'card' (implicit) = .heading-card (18px); 'section' = .heading-section (20px); icon = size-4 text-walnut, flex gap-2
export function CardDescription(p: React.HTMLAttributes<HTMLParagraphElement>): JSX.Element; // 'mt-1 text-sm text-muted-foreground'
export function CardBody(p: React.HTMLAttributes<HTMLDivElement>): JSX.Element;      // 'flex flex-col gap-2'
export function CardFooter(p: React.HTMLAttributes<HTMLDivElement>): JSX.Element;    // 'mt-4 flex flex-wrap items-center gap-2'

// inlocuieste Section-urile locale (admin/settings, admin/calendar, company-dashboard) si Breakdown (admin)
export function CardSection(p: {
  title: React.ReactNode; titleAs?: 'h2' | 'h3'; titleSize?: 'section' | 'card';
  icon?: LucideIcon; description?: React.ReactNode; actions?: React.ReactNode;
  tone?: CardTone; padding?: CardPadding; id?: string; className?: string; children?: React.ReactNode;
}): JSX.Element; // <Card as="section" aria-labelledby={useId()}> + CardHeader(CardTitle + actions) + CardDescription + CardBody
```

cva: baza `rounded-xl border`; tonuri: `default` = `border-border bg-surface shadow-sm`; `muted` = `border-border bg-surface-2`; `dashed` = `border-dashed border-border-2 bg-surface`; `amber` = `border-amber/30 bg-amber-soft`; `crimson` = `border-crimson/30 bg-crimson-soft`; `sage` = `border-sage/30 bg-sage-soft`; `info` = `border-info/30 bg-info-soft`; `interactive` = `transition-all duration-200 ease-ease hover:-translate-y-0.5 hover:border-border-2 hover:shadow`. Nota: `CardSection` foloseste `useId` → e hook React fara stare de client; functioneaza si in server components (React 19).

### 6.2 `stat-card.tsx`

```ts
interface StatCardProps {
  label: string;
  value: React.ReactNode;                 // numar sau suma deja formatata (useMoney)
  icon?: LucideIcon;                      // dreapta sus, text-walnut
  hint?: React.ReactNode;                 // sub valoare, text-xs text-muted-foreground
  tone?: 'default' | 'warning' | 'danger' | 'muted';   // warning = Card amber (fostul highlight admin); danger = crimson; muted = valoare text-muted-foreground
  href?: string;                          // intreaga placa devine <Link> (i18n) interactiva
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };  // optional, fara consumator azi (ArrowUp/ArrowDown/Minus + label)
  variant?: 'card' | 'inline';            // card = Card cu border; inline = fara border (in interiorul altui card: portofel, credite)
  align?: 'start' | 'center';             // implicit 'start'; portofel/credite = 'center'
  className?: string;
}
export function StatCard(p: StatCardProps): JSX.Element;
```

Layout unic: `card` → rand sus `.label` + icon, valoare `mt-2 font-serif text-3xl tracking-[-0.02em]`, apoi `hint`; `inline` → valoare `font-serif text-2xl tracking-[-0.02em]`, apoi `.label mt-1`. Rezolva drift-ul `text-2xl` vs `text-3xl` (acelasi tipar = aceeasi marime).

### 6.3 `empty-state.tsx`

```ts
interface EmptyStateProps {
  title: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;                          // in cerc: h-12 w-12 (md) / h-9 w-9 (sm)
  action?: React.ReactNode;                   // Button / Link
  tone?: 'neutral' | 'warning' | 'error';     // cerc: walnut-soft/walnut | amber-soft/amber | crimson-soft/crimson
  variant?: 'card' | 'dashed' | 'plain';      // card = Card; dashed = Card tone dashed; plain = fara chenar (in TD / in alt card)
  size?: 'sm' | 'md';                          // sm: titlu text-sm text-muted-foreground, py-6; md: titlu heading-section, py-12, hint max-w-sm
  role?: 'status' | 'alert';                  // alert pentru erori
  className?: string;
}
export function EmptyState(p: EmptyStateProps): JSX.Element; // 'flex flex-col items-center gap-3 text-center'
```

### 6.4 `skeleton.tsx` (`'use client'`, foloseste `Common.loadState.loading`)

```ts
export function Skeleton(p: React.HTMLAttributes<HTMLDivElement>): JSX.Element; // 'animate-pulse rounded-md bg-surface-3' + aria-hidden
export function LoadingRegion(p: { label?: string; className?: string; children: React.ReactNode }): JSX.Element;
// role="status" aria-live="polite" aria-busy="true" + <span className="sr-only">{label ?? t('loading')}</span>
export function SkeletonText(p: { lines?: number; className?: string }): JSX.Element;            // ultima linie w-2/3
export function SkeletonCard(p: { lines?: number; withHeader?: boolean; className?: string }): JSX.Element;
export function SkeletonStatGrid(p: { count?: number; variant?: 'card' | 'inline'; className?: string }): JSX.Element; // aceeasi geometrie ca StatCard; grid-ul implicit sm:grid-cols-2 lg:grid-cols-4, suprascris prin className
export function SkeletonList(p: { rows?: number; variant?: 'rows' | 'cards' | 'bubbles'; withAvatar?: boolean; className?: string }): JSX.Element;
export function SkeletonTable(p: { rows?: number; cols?: number; className?: string }): JSX.Element;
export function SkeletonPage(p: { variant: 'dashboard' | 'list' | 'detail' | 'table'; withHeader?: boolean; className?: string }): JSX.Element;
```

Toate preseturile se invelesc singure in `LoadingRegion` (un singur anunt), cu exceptia `Skeleton` simplu. Sub `prefers-reduced-motion` regula globala (`globals.css:346`) opreste pulsul — acceptabil (placeholder static). Textul „Se încarcă…" exista DOAR `sr-only` (done-when-ul cere sa nu fie vizibil).

### 6.5 `query-state.tsx` + `hooks/use-loading-timeout.ts`

```ts
// hooks/use-loading-timeout.ts ('use client')
export const LOADING_TIMEOUT_MS = 15_000;
export function useLoadingTimeout(active: boolean, ms?: number): { timedOut: boolean; restart: () => void };
// setTimeout cand active devine true; reset cand active devine false; restart() = reset manual (dupa Reincearca)

// components/ui/query-state.tsx ('use client')
interface QueryStateProps {
  pending: boolean;                  // ex. me.isPending || list.isPending
  error?: unknown;                   // truthy → errorFallback ?? <LoadError/>
  onRetry: () => void;               // ex. () => void list.refetch()
  skeleton: React.ReactNode;
  errorFallback?: React.ReactNode;   // ex. <AccessBlocked error={list.error} onRetry={…} />
  timeoutMs?: number;
  children?: React.ReactNode;        // randat cand nu e pending si nu e eroare
}
export function QueryState(p: QueryStateProps): JSX.Element;

export function LoadError(p: { onRetry: () => void; title?: string; hint?: string; slow?: boolean; className?: string }): JSX.Element;
// EmptyState tone="error" role="alert" icon={AlertTriangle}; slow → Common.loadState.slowTitle/slowHint, altfel errorTitle/errorHint;
// action = <Button variant="outline" onClick>{<RefreshCw/>} {t('retry')}</Button>
```

Tipar in pagina (garda timpurie; efectele de redirect existente raman neschimbate):

```tsx
if (me.isPending || me.isError)
  return <QueryState pending={me.isPending} onRetry={() => void me.refetch()} skeleton={<SkeletonPage variant="table" />} />;
```

Regula: in garda de `me` se paseaza `pending` (adevarat si pe `me.isError`, ca skeletonul sa ramana pana cand efectul existent face `router.replace('/login')`), iar `children` lipseste. Pentru listele din pagina se foloseste forma cu `error` + `children`.

### 6.6 `page-header.tsx`

```ts
interface PageHeaderProps {
  title: React.ReactNode;                           // <h1 className="page-title">
  subtitle?: React.ReactNode;                       // 'mt-2 text-sm text-muted-foreground'
  kicker?: React.ReactNode;                         // .kicker deasupra titlului
  back?: { href: string; label: string };           // i18n <Link> '← label' text-sm text-walnut hover:underline
  actions?: React.ReactNode;                        // dreapta, aliniat jos
  meta?: React.ReactNode;                           // in randul back-link-ului, dreapta (ex. StatusBadge in fisa de lucru)
  className?: string;
  titleClassName?: string;
}
export function PageHeader(p: PageHeaderProps): JSX.Element;
```

Structura: `<header className="flex flex-col gap-3">` [rand `flex flex-wrap items-center justify-between gap-3`: back + meta, doar daca exista] [rand `flex flex-wrap items-end justify-between gap-4`: (kicker, h1, subtitle) + actions]. Un singur h1 per pagina (AppShell nu are h1).

### 6.7 `filter-chips.tsx` (`'use client'`)

```ts
interface FilterChipOption<V extends string> {
  value: V;
  label: React.ReactNode;
  count?: number;               // '<span className="ml-1.5 font-mono text-xs opacity-75">'
  icon?: React.ReactNode;       // inainte de label
  indicator?: React.ReactNode;  // dupa label (ex. UnreadDot)
  dimmed?: boolean;             // opacity-50 cand neselectat (azi pe /requests la count 0)
  disabled?: boolean;
}
type SingleProps<V extends string> = {
  multiple?: false; value: V | null; onChange: (value: V | null) => void;
  allowDeselect?: boolean;      // click pe cel activ → onChange(null)
};
type MultiProps<V extends string> = { multiple: true; value: V[]; onChange: (value: V[]) => void };
export type FilterChipsProps<V extends string> = (SingleProps<V> | MultiProps<V>) & {
  options: readonly FilterChipOption<V>[];
  label: string;                // aria-label pe role="group" (cheie i18n a paginii)
  size?: 'sm' | 'md';           // sm: 'px-3 py-1 text-xs'; md (implicit): 'px-3.5 py-1.5 text-sm'
  className?: string;
};
export function FilterChips<V extends string>(p: FilterChipsProps<V>): JSX.Element;
```

Semantica: container `role="group" aria-label={label}` `flex flex-wrap gap-2`; fiecare chip `<button type="button" aria-pressed={selected}>` (cititorul de ecran anunta „apăsat/neapăsat" la schimbare). Stil activ UNIC: `border-walnut bg-walnut text-primary-foreground`; inactiv `border-border-2 bg-surface text-muted-foreground hover:border-muted-2 hover:text-foreground`; baza `inline-flex items-center gap-1.5 rounded-full border transition-colors disabled:opacity-50`; focus = `:focus-visible` global.

### 6.8 `popover.tsx` si `dropdown-menu.tsx` (`'use client'`, Radix)

```ts
// popover.tsx
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverContent: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & { width?: 'sm' | 'md' | 'lg' | 'auto' }
>; // in Portal; implicit align='end', sideOffset=8, collisionPadding=12, width='md'
export const panelClass: string;
// 'z-50 overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-lg outline-none
//  data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'   (FARA animate-out)
// width: sm 'w-56' | md 'w-64' | lg 'w-[22rem] max-w-[calc(100vw-1.5rem)]' | auto ''

// dropdown-menu.tsx
export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuContent: React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof Menu.Content>>;
// Portal + panelClass + 'min-w-56 p-1', implicit align 'end', sideOffset 8
export const DropdownMenuItem: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof Menu.Item> & { tone?: 'default' | 'danger' }
>; // 'flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none
   //  data-[highlighted]:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-50
   //  [&_svg]:size-4 [&_svg]:text-muted-foreground'; danger: 'text-crimson'
export const DropdownMenuLabel: React.ForwardRefExoticComponent<…>;      // 'px-2.5 py-2'
export const DropdownMenuSeparator: React.ForwardRefExoticComponent<…>;  // '-mx-1 my-1 h-px bg-border'
```

Radix aduce: Escape, click in afara, focus in panou + revenire pe trigger, sageti/Home/End/typeahead in meniu, `aria-expanded`/`aria-controls`/`role="menu"`.

---

## 7. Header randat din sesiune + meniul de cont

### 7.1 Backend (`apps/backend/src/modules/auth/`)

- `auth.constants.ts`: `export const SESSION_HINT_COOKIE = 'mm_session';` + comentariu: „indiciu de UI (rolul) pentru headerul randat pe server; NU e material de sesiune si NU se foloseste pentru autorizare".
- `auth.service.ts:364-381` `refresh()` → tip `Promise<{ accessToken: string; refreshToken: string; role: User['role'] }>`; intoarce `role: user.role`.
- `auth.controller.ts`:
  - `setAuthCookies(res, accessToken, refreshToken, role)` (linia 51) — dupa cele 2 cookie-uri existente: `res.cookie(SESSION_HINT_COOKIE, role, { httpOnly: true, secure: this.isProd, sameSite: 'lax', maxAge: REFRESH_TOKEN_TTL_SEC * 1000, path: '/' })`.
  - `clearAuthCookies(res)` (linia 68): + `res.clearCookie(SESSION_HINT_COOKIE, { path: '/' })`.
  - apeluri: `changePassword` (~136) cu `user.role` (din `@CurrentUser()`); `login` (~155) cu `user.role`; `refresh` (~181) cu `role` din service. `logout` si ramura de esec din `refresh` folosesc deja `clearAuthCookies`.
  - `me()` (~205-218): NESCHIMBAT — `hasSession` verifica doar `ACCESS_COOKIE`/`REFRESH_COOKIE`/`authorization` (test nou: `mm_session` singur → `{ user: null }`).

### 7.2 Frontend

- `lib/session-hint.ts` (pur, fara `'use client'`):
  ```ts
  export const SESSION_HINT_COOKIE = 'mm_session';
  export type SessionRole = 'CLIENT' | 'COMPANY_USER' | 'ADMIN';
  export function parseSessionHint(raw: string | undefined | null): SessionRole | null; // whitelist exacta, altfel null
  ```
- `lib/session-hint-context.tsx` (`'use client'`): `SessionHintProvider({ initialRole, children })` tine `useState(initialRole)`; `useSessionHint(): SessionRole | null`; `useSetSessionHint(): (r: SessionRole | null) => void`. Fara provider (teste) → `null` si setter no-op.
- `app/[locale]/layout.tsx` (server): `import { cookies } from 'next/headers'`; `const hint = parseSessionHint((await cookies()).get(SESSION_HINT_COOKIE)?.value);`; `<Providers><SessionHintProvider initialRole={hint}>{children}<LegalAcceptanceGate /></SessionHintProvider></Providers>`. PASTREAZA `await headers()` (CSP nonce, Sprint 74). Layout-ul e deja dinamic — nimic nou la caching.
- `hooks/use-auth.ts`:
  - nou `useSessionRole()`: `const me = useMe(); const hint = useSessionHint(); return { role: me.data?.role ?? (me.isPending ? hint : null), user: me.data ?? null, pending: me.isPending };`
  - `useLogin` `onSuccess`: + `setHint(user.role)`; `useLogout` `onSettled`: + `setHint(null)` (altfel, dupa `qc.clear()`, `me` redevine pending si indiciul vechi ar reaparea o clipa).
- `_components/app-header.tsx`: `const { role, user } = useSessionRole();` → `links = role ? (NAV_BY_ROLE[role] ?? []) : []`, `homeHref` din `role`; clopotel: `user ? <NotificationBell /> : role ? <BellPlaceholder /> : null` (`BellPlaceholder` = acelasi `h-8 w-8 rounded-md border border-border-2 bg-surface-2` cu iconita `Bell`, `aria-hidden`, fara interactiune); `role && <AccountMenu role={role} />`; `MobileNav` neschimbat. HTML-ul SSR al paginii contine deja nav-ul complet pentru rol → dispare trecerea minimal → complet. Butonul de cont pastreaza iconita `CircleUserRound` (nu avatar) ca latimea sa nu se schimbe dupa `me`.
- `_components/public-header.tsx:44-46, 86-118`: `useSessionRole()`: `signedIn = role !== null`, `showCta = !role || role === 'CLIENT'` → landing-ul nu mai sare Login/Register → „Contul meu".
- `admin/layout.tsx:37, 92, 97`: `useSessionRole()` pentru clopotel/placeholder; `<AccountMenu role="ADMIN" />`; `BillingReadinessBanner` ramane pe `me.data?.role === 'ADMIN'` (date reale, nu indiciu).

### 7.3 `_components/account-menu.tsx` (nou, `'use client'`)

```ts
export function AccountMenu({ role }: { role: SessionRole }): JSX.Element;
```
- `useMe()`, `useMyCompany(role === 'COMPANY_USER')` (param nou `enabled` in `hooks/use-company.ts:23`, implicit `true` — apelurile existente nu se schimba), `useLogout()`, `useRouter()`, `useTranslations('Nav' | 'Auth' | 'Common')`.
- Trigger: `<DropdownMenuTrigger asChild><Button variant="outline" size="sm" aria-label={t('accountMenu')} className="px-2 xl:px-3"><CircleUserRound className="size-4" /><span className="hidden xl:inline">{roleLabel}</span></Button></DropdownMenuTrigger>` (`roleLabel` = `ta.has(\`role.${role}\`) ? ta(\`role.${role}\`) : role`, ca azi).
- Continut (`DropdownMenuContent className="w-64"`): `DropdownMenuLabel` = `flex gap-3`: `Avatar name={user.name} size={36}` + coloana: `<p className="meta-text">{t('signedInAs')}</p>`, `<p className="truncate font-medium">{user.name}</p>`, `<p className="truncate text-xs text-muted-foreground">{user.email}</p>`, (COMPANY_USER si `company.data`) `<p className="flex items-center gap-1.5 truncate text-xs"><Building2 aria-hidden /><span className="sr-only">{t('accountCompany')}: </span>{company.data.name}</p>`, rand `.label` cu punct `bg-sage` + `roleLabel`. Cat `me` e pending: 3× `Skeleton` in locul textelor. Firma lipsa (404 la onboarding) → randul nu apare.
- `DropdownMenuSeparator`; `DropdownMenuItem asChild` → `<Link href="/change-password"><KeyRound />{t('changePassword')}</Link>`; `DropdownMenuItem tone="danger" disabled={logout.isPending} onSelect={…}` → aceeasi logica ca azi (`hasUnpublishedLocalDraft() && !confirm(tc('logoutDiscardsLocalDraft'))` → return; `logout.mutate(undefined, { onSuccess: () => router.replace('/login') })`).
- Inchidere la schimbarea rutei: Radix inchide la click pe item; efectul `useEffect(() => setMenuOpen(false), [pathname])` de azi nu mai e necesar.

---

## 8. Scala tipografica + regula de lint + curatenie tokeni

### 8.1 `tailwind.config.ts`

```ts
extend: {
  fontSize: {
    micro: ['10px', { lineHeight: '15px' }],
    meta: ['11px', { lineHeight: '16px' }],
    ui: ['13px', { lineHeight: '18px' }],
    lead: ['15px', { lineHeight: '22px' }],
  },
  colors: {
    // … (aliasul `plan` STERS)
    'on-walnut': 'hsl(var(--on-walnut))',
    tier: {
      'platinum-from': 'hsl(var(--tier-platinum-from))', 'platinum-to': 'hsl(var(--tier-platinum-to))', 'platinum-fg': 'hsl(var(--tier-platinum-fg))',
      'gold-from': 'hsl(var(--tier-gold-from))', 'gold-to': 'hsl(var(--tier-gold-to))', 'gold-fg': 'hsl(var(--tier-gold-fg))',
      'silver-from': 'hsl(var(--tier-silver-from))', 'silver-to': 'hsl(var(--tier-silver-to))', 'silver-fg': 'hsl(var(--tier-silver-fg))',
    },
  },
}
```
(xs 12, sm 14, base 16, lg 18, xl 20, 2xl 24, 3xl 30 raman cele din Tailwind.)

### 8.2 `lib/utils.ts` — OBLIGATORIU

`tailwind-merge@3.6` trateaza `text-<valoare necunoscuta>` drept CULOARE: `cn('text-meta', 'text-muted-foreground')` ar sterge `text-meta` fara eroare. Se inlocuieste `twMerge` cu:
```ts
import { extendTailwindMerge } from 'tailwind-merge';
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['micro', 'meta', 'ui', 'lead'] }] } },
});
```
(+ test unitar, 11.1.2). Culorile noi `on-walnut`/`tier-*` sunt culori → comportamentul implicit e corect.

### 8.3 `src/app/globals.css`

- `:root` (dupa paleta de brand): `--on-walnut: 40 65% 95%;` `--tier-platinum-from: 36 12% 16%; --tier-platinum-to: 30 11% 33%; --tier-platinum-fg: 39 39% 93%; --tier-gold-from: 40 71% 40%; --tier-gold-to: 40 62% 55%; --tier-gold-fg: 43 100% 95%; --tier-silver-from: 37 7% 51%; --tier-silver-to: 40 12% 65%; --tier-silver-fg: 39 39% 93%;` (conversia exacta a hex-urilor de azi; `.dark` nu le redefineste — aspect identic, ca azi).
- `@layer components` (langa `.label/.kicker/.page-title`):
  - `.heading-section { font-family: var(--font-serif), Georgia, serif; font-weight: 400; font-size: 20px; line-height: 1.25; letter-spacing: 0.005em; }`
  - `.heading-card { font-family: var(--font-serif), Georgia, serif; font-weight: 400; font-size: 18px; line-height: 1.3; letter-spacing: 0.005em; }`
  - `.meta-text { font-family: var(--font-sans), system-ui, sans-serif; font-size: 11px; line-height: 16px; letter-spacing: 0.02em; color: hsl(var(--muted-foreground)); }`
  - `.data-mono { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; font-variant-numeric: tabular-nums; }`
  - Nume fara prefix `h-`/`text-` (tailwind-merge le-ar confunda cu height/culoare si le-ar sterge).
- Comentarii: linia 6 „Cozy Home — design tokens ATELIER"; nota de la linia 13 STEARSA; linia 51 fara „(alias: plan)".

### 8.4 Componente UI existente

- `ui/badge.tsx:7,88`: `font-mono text-[10.5px]` → `font-mono text-micro` (ramane mono, presupunerea 7); `TIER_CLASS` pe tokeni (5.11).
- `ui/table.tsx:8,38`: `text-[13.5px]` → `text-ui`; TH → `text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground` (sans, fara `font-mono`).
- `ui/tabs.tsx:56`: `font-mono text-[11px] uppercase tracking-[0.04em]` → `text-meta font-medium uppercase tracking-[0.08em]` (sans = stilul `.label`).
- `ui/label.tsx:12`: `font-mono text-[11px] uppercase tracking-[0.06em]` → `text-meta font-medium uppercase tracking-[0.08em]` (sans; verifica vizual formularele care il folosesc).
- `ui/stepper.tsx:26`: `text-[10px]` → `text-micro` (ramane mono, e cifra de pas).
- `ui/avatar.tsx:30`: `text-on-walnut`.
- `ui/button.tsx:12`: comentariul.

### 8.5 `apps/frontend/.eslintrc.json` — regula

```json
{
  "extends": "next/core-web-vitals",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Literal[value=/text-\\[[0-9.]+px\\]/]",
        "message": "Scala tipografica: foloseste text-micro/meta/xs/ui/sm/lead/base/lg/xl sau heading-section/heading-card (docs/design-tokens.md), nu text-[..px]."
      },
      {
        "selector": "TemplateElement[value.raw=/text-\\[[0-9.]+px\\]/]",
        "message": "Scala tipografica: foloseste tokenii din docs/design-tokens.md, nu text-[..px]."
      },
      {
        "selector": "Literal[value=/\\bbg-card\\b/]",
        "message": "Foloseste bg-surface (tokenul unic pentru suprafete), nu bg-card."
      }
    ]
  }
}
```
Fara dependinta noua (nu `eslint-plugin-tailwindcss`: `no-arbitrary-value` ar lovi toate valorile arbitrare legitime, ex. `grid-cols-[…]`). Lint-ul frontend ruleaza cu `--max-warnings 0`, deci inlocuirea din 5.10 trebuie completa INAINTE de a activa regula. Verificare ca regula prinde (fara fisier nou in repo): `echo "export const x = 'mt-1 text-[11px]';" | pnpm -F frontend exec eslint --stdin --stdin-filename src/probe.tsx` → trebuie sa iasa cu eroare `no-restricted-syntax`; la fel pentru un template literal si pentru `bg-card`. Daca esquery nu accepta regex-ul (versiuni vechi), alternativa: `[0-9.]` → `\\d` si `\\.`, testat cu aceeasi proba.

### 8.6 Inlocuirea mecanica (5.10)

Script Node temporar in scratchpad (NU in repo): parcurge `apps/frontend/src/**/*.{ts,tsx}`, aplica maparea din 5.10 cu regex pe granita de clasa, de ex. `/(^|[\s'"`{(])text-\[(?:9|9\.5|10|10\.5)px\](?=[\s'"`)}]|$)/g` → `$1text-micro` (si analog pentru celelalte), scrie fisierele pastrand EOL-ul existent (LF). Cazurile speciale (`[19px]` ×2, `[21px]`, `[26px]`) se fac manual. Apoi `grep -rnE "text-\[[0-9.]+px\]" apps/frontend/src` = 0 rezultate.

### 8.7 `docs/design-tokens.md` (nou)

Tabele: culori (background/foreground/surface/surface-2/surface-3/border/border-2/ink-2/muted/muted-2, walnut/-deep/-soft, sage, amber, brass, crimson, info, on-walnut, tier-*) si la ce se folosesc; raze (card/tile/control/pastila); scala tipografica (display `.page-title`, `heading-section`, `heading-card`, `text-lead/sm/ui/xs/meta/micro`, `.label`, `.kicker`, `meta-text`, `data-mono`) cu regula „mono doar pentru date (ID, sume, statusuri)"; primitivele din 6 si cand se folosesc; cele 2 reguli de lint; ce ramane pentru faza 2 (5.9).

---

## 9. Chei i18n de adaugat (RO + EN, `apps/frontend/src/messages/ro.json` + `en.json`)

Fisierele sunt LF (nu CRLF, cum spune o nota Codex veche), 2 spatii. Editeaza cu `Edit` sau un singur script node care pastreaza formatarea.

| Cheie | RO | EN |
|---|---|---|
| `Common.loadState.loading` | Se încarcă… | Loading… |
| `Common.loadState.slowTitle` | Încărcarea durează mai mult decât de obicei | This is taking longer than usual |
| `Common.loadState.slowHint` | Verifică conexiunea la internet și încearcă din nou. | Check your internet connection and try again. |
| `Common.loadState.errorTitle` | Nu am putut încărca datele | We couldn't load this |
| `Common.loadState.errorHint` | Încearcă din nou peste câteva momente. | Please try again in a moment. |
| `Common.loadState.retry` | Reîncearcă | Try again |
| `Nav.signedInAs` | Conectat ca | Signed in as |
| `Nav.accountCompany` | Firma | Company |
| `Marketplace.wallet.pageTitle` | Portofel și abonament | Wallet and subscription |
| `Marketplace.wallet.pageSubtitle` | Creditele, abonamentul, comenzile și penalizările firmei tale. | Your company's credits, subscription, orders and penalties. |
| `Admin.navHeading` | Administrare | Administration |
| `Admin.sidebarNote` | Cozy Home · panou operațional | Cozy Home · operations console |
| `AdminCompanies.filterLabel` | Filtrează firmele după status | Filter companies by status |
| `AdminUsers.roleFilterLabel` | Filtrează utilizatorii după rol | Filter users by role |
| `Requests.tabsLabel` | Filtrează cererile după stadiu | Filter requests by stage |
| `Messages.tabsLabel` | Tipul conversațiilor | Conversation type |
| `Inspiration.roomFilterLabel` | Filtrează după cameră | Filter by room |
| `Studio.sceneChipsLabel` | Alege camera | Choose a room |

Inainte de adaugare: verifica sa nu existe deja chei echivalente (flatten node pe ambele json-uri). Terminologie: „firmă", nu „atelier"; ton „tu"; RO cu diacritice. `Inspiration.all` (eticheta „Toate") exista deja — verifica numele exact inainte de folosire.

Chei posibil moarte dupa migrare (se sterg DOAR daca nu mai au nicio utilizare, din AMBELE json-uri): `Dashboard.loading`, `Admin.loading`, `Admin.contactDetections.loading`, `Admin.requests.loading`, `AdminWithdrawals.loading`, `AdminPayments.loading`, `AdminDisputes.loading`, `Marketplace.loading`, `Messages.loading`, `Chat.loading`. Raman sigur: `Auth.loading` (change-password), `Company.loading`, `Requests.loading` (requests/[id]), `Quotes.loading` (verifica `requests/[id]/offers` si fisa de lucru), `Partners.loading`, `Legal.firmRules.loading`.

Paritate dupa editare: script node care aplatizeaza ambele fisiere si compara seturile de chei (nota Codex: 2.953 = 2.953 la 2026-09-28; recalculeaza pe arborele curent, apoi +18 minus cheile moarte, egal in ambele). Nicio eticheta EN folosita de Playwright nu se schimba (grep in `apps/frontend/e2e/`: doar „Save as new draft", neatins).

---

## 10. Lista exacta de fisiere

### Noi
1. `apps/frontend/src/components/ui/card.tsx` — 6.1
2. `apps/frontend/src/components/ui/stat-card.tsx` — 6.2
3. `apps/frontend/src/components/ui/empty-state.tsx` — 6.3
4. `apps/frontend/src/components/ui/skeleton.tsx` — 6.4
5. `apps/frontend/src/components/ui/query-state.tsx` — 6.5
6. `apps/frontend/src/components/ui/page-header.tsx` — 6.6
7. `apps/frontend/src/components/ui/filter-chips.tsx` — 6.7
8. `apps/frontend/src/components/ui/popover.tsx` — 6.8
9. `apps/frontend/src/components/ui/dropdown-menu.tsx` — 6.8
10. `apps/frontend/src/hooks/use-loading-timeout.ts` — 6.5
11. `apps/frontend/src/lib/session-hint.ts` — 7.2
12. `apps/frontend/src/lib/session-hint-context.tsx` — 7.2
13. `apps/frontend/src/app/[locale]/_components/account-menu.tsx` — 7.3
14. Teste: `components/ui/primitives.test.tsx`, `components/ui/filter-chips.test.tsx`, `components/ui/query-state.test.tsx`, `components/ui/menus.test.tsx`, `app/[locale]/_components/account-menu.test.tsx`, `app/[locale]/_components/app-header.test.tsx`, `lib/session-hint.test.ts`, `lib/utils.test.ts` (sectiunea 11)
15. `docs/design-tokens.md` — 8.7

### Modificate — backend
16. `apps/backend/src/modules/auth/auth.constants.ts` — `SESSION_HINT_COOKIE`
17. `apps/backend/src/modules/auth/auth.service.ts` — `refresh()` intoarce `role`
18. `apps/backend/src/modules/auth/auth.controller.ts` — `setAuthCookies(…, role)`, `clearAuthCookies`, 3 apeluri
19. `apps/backend/src/modules/auth/auth.controller.spec.ts` — teste 11.2
20. `apps/backend/src/modules/auth/auth.service.spec.ts` — doar daca un test verifica forma exacta a rezultatului `refresh()` (adauga `role`)

### Modificate — frontend (infrastructura)
21. `apps/frontend/package.json` + `pnpm-lock.yaml` (radacina) — `@radix-ui/react-popover`, `@radix-ui/react-dropdown-menu`
22. `apps/frontend/.eslintrc.json` — 8.5
23. `apps/frontend/tailwind.config.ts` — 8.1 + 5.11
24. `apps/frontend/src/app/globals.css` — 8.3
25. `apps/frontend/src/lib/utils.ts` — 8.2
26. `apps/frontend/src/app/[locale]/layout.tsx` — `cookies()` + `SessionHintProvider`
27. `apps/frontend/src/hooks/use-auth.ts` — `useSessionRole`, `setHint` in login/logout
28. `apps/frontend/src/hooks/use-company.ts` — `useMyCompany(enabled = true)`
29. `apps/frontend/src/messages/ro.json`, `en.json` — sectiunea 9
30. `apps/frontend/src/components/ui/{badge,table,tabs,label,stepper,avatar,button}.tsx` — 8.4
31. `apps/frontend/src/test/setup.ts` — doar daca testele Radix cer stub-uri (11.1.6)

### Modificate — frontend (header, meniuri, chips)
32. `app/[locale]/_components/app-header.tsx` — 7.2 (meniul local STERS, `useSessionRole`, `AccountMenu`, `BellPlaceholder`)
33. `app/[locale]/_components/public-header.tsx` — 7.2
34. `app/[locale]/_components/notification-bell.tsx` — Popover (5.6) + `text-[..px]`
35. `app/[locale]/admin/layout.tsx` — 5.3 + 7.2
36. `app/[locale]/inspiration/_components/save-button.tsx`, `inspiration/_components/board-picker.tsx`, `inspiration/boards/[id]/page.tsx`, `inspiration/page.tsx` — 5.6/5.7 (+ `bg-card`, `text-[..px]`)
37. `components/configurator/inspiration-picker.tsx`, `components/studio/room-viewer.tsx` — 5.7

### Modificate — frontend (pagini migrate)
38. `app/[locale]/dashboard/page.tsx`, `_components/todo-now-card.tsx` — 5.1
39. `app/[locale]/marketplace/wallet/page.tsx` — 5.2
40. `app/[locale]/admin/{page,companies/page,companies/[id]/page,users/page,requests/page,requests/[id]/page,disputes/page,withdrawals/page,payments/page,contact-detections/page,audit/page,jobs/page,calendar/page,sizing/page,settings/page,inspiration/page}.tsx` — 5.3
41. `app/[locale]/marketplace/{page,[id]/page,claims/page,claims/[claimSlotId]/page,messages/page}.tsx`, `marketplace/_components/access-blocked.tsx`, `app/[locale]/_components/chat-panel.tsx` — 5.4
42. `app/[locale]/requests/page.tsx` — 5.5
43. `app/[locale]/company/_components/company-dashboard.tsx` — doar `Section` → `CardSection` + `text-[11px]`
44. Restul celor 57 de fisiere din 5.10 — DOAR inlocuirea claselor `text-[..px]`
45. Fisierele cu `bg-card` din 5.11
46. `CHANGELOG.md` — intrarea sprintului

---

## 11. Teste de adaugat

### 11.1 Frontend (Vitest + Testing Library; `NextIntlClientProvider` cu `ro.json`; `vi.mock('@/i18n/routing')` cu `Link` → `<a>` ca in `todo-now-card.test.tsx`)

1. `lib/session-hint.test.ts`: `parseSessionHint` accepta cele 3 roluri; respinge `undefined`, `''`, `'admin'`, `'CLIENT;x'`, `'<script>'`.
2. `lib/utils.test.ts`: `cn('text-meta', 'text-muted-foreground')` pastreaza ambele; `cn('text-micro', 'text-meta')` → doar `text-meta`; `cn('text-sm', 'text-ui')` → `text-ui`.
3. `components/ui/primitives.test.tsx`: `Card as="section"` randeaza `<section>` cu `rounded-xl`; `CardSection` leaga `aria-labelledby` de titlu; `StatCard href` randeaza link cu label + valoare; `EmptyState` cu `action`; `PageHeader` randeaza UN `h1` + back link; `SkeletonPage` are `role="status"` + textul sr-only „Se încarcă…" si nu are text vizibil in afara lui.
4. `components/ui/query-state.test.tsx` (`vi.useFakeTimers()`): pending → skeleton; dupa 15 s → „Încărcarea durează mai mult decât de obicei" + buton „Reîncearcă"; click → `onRetry` apelat si skeletonul revine; `error` → `LoadError` (sau `errorFallback` cand e dat); nepending → `children`.
5. `components/ui/filter-chips.test.tsx`: `role="group"` cu nume; `aria-pressed` corect; click schimba valoarea; `allowDeselect` → `onChange(null)`; `multiple` → toggle in array; `count` afisat; `type="button"` pe fiecare.
6. `components/ui/menus.test.tsx`: Popover se deschide din trigger, Escape inchide si focusul revine pe trigger; DropdownMenu: focus pe trigger + `{Enter}` deschide, `{ArrowDown}` muta focusul pe item, `{Escape}` inchide. Daca jsdom cere: stub-uri `Element.prototype.hasPointerCapture/releasePointerCapture/scrollIntoView` in `src/test/setup.ts`.
7. `app/[locale]/_components/account-menu.test.tsx` (mock `@/hooks/use-auth`, `@/hooks/use-company`): la deschidere se vad numele, emailul, firma (COMPANY_USER) si „Utilizator firmă"; pentru CLIENT `useMyCompany` e apelat cu `false` si randul de firma lipseste; item-ul „Deconectare" apeleaza `logout.mutate`.
8. `app/[locale]/_components/app-header.test.tsx`: cu `SessionHintProvider initialRole="COMPANY_USER"` si `useMe` pending (mock) se randeaza linkurile „Marketplace" si „Portofel" + placeholder-ul clopotelului; fara indiciu si pending → fara linkuri; `useMe` eroare → fara linkuri chiar cu indiciu.
9. Regresie: `legal-acceptance-gate.test.tsx`, `todo-now-card.test.tsx`, `accessibility.test.tsx` (Tabs) trebuie sa treaca neschimbate (hook-urile noi au fallback fara provider).

### 11.2 Backend (Jest, `auth.controller.spec.ts`)

1. `login` seteaza `mm_session` cu `user.role` si `{ httpOnly: true, sameSite: 'lax', path: '/', maxAge: REFRESH_TOKEN_TTL_SEC * 1000 }` (mock `auth.login` → `user: { id: 'u1', role: 'COMPANY_USER' }`).
2. `refresh` reusit seteaza `mm_session` cu `role` din service; `refresh` esuat apeleaza `clearCookie('mm_session', { path: '/' })` si rearunca.
3. `logout` sterge `mm_session`.
4. `changePassword` seteaza `mm_session` cu `user.role` din payload.
5. `me()` cu DOAR `cookies: { mm_session: 'ADMIN' }` → `{ user: null }` (indiciul nu e material de sesiune).
6. Testul existent LOGIN_COOLDOWN (`response.cookie` neapelat) ramane verde.

---

## 12. Ordinea pasilor de implementare (fiecare pas marginit; dupa fiecare: `pnpm -F frontend typecheck`)

1. **Dependinte + wrappere Radix.** `pnpm -F frontend add @radix-ui/react-popover@^1.1 @radix-ui/react-dropdown-menu@^2.1` (verifica peer React 19; lockfile-ul de la radacina se actualizeaza). Creeaza `ui/popover.tsx`, `ui/dropdown-menu.tsx` + `menus.test.tsx`.
2. **Meniul de cont (do first).** `hooks/use-company.ts` (`enabled`), `_components/account-menu.tsx`, cheile `Nav.signedInAs/accountCompany`; in `app-header.tsx` inlocuieste meniul scris de mana cu `<AccountMenu role={me.data.role} />` (inca pe `me.data`); `account-menu.test.tsx`. Verificare in browser: nume, email, firma.
3. **Indiciul de sesiune — backend.** `auth.constants.ts`, `auth.service.ts` (`refresh` + `role`), `auth.controller.ts`, teste 11.2; `pnpm -F backend test -- auth`.
4. **Indiciul de sesiune — frontend.** `lib/session-hint.ts`, `lib/session-hint-context.tsx`, `[locale]/layout.tsx`, `useSessionRole` + `setHint` in `use-auth.ts`; `app-header.tsx` (rol din indiciu, `BellPlaceholder`), `public-header.tsx`, `admin/layout.tsx` (+ `AccountMenu`, `navHeading`, `sidebarNote`); teste 11.1.1 si 11.1.8.
5. **Tokeni + scala (fara inlocuirea in masa).** `tailwind.config.ts` (fontSize, on-walnut, tier, alias `plan` STERS, comentarii), `globals.css` (vars + clase + comentarii), `lib/utils.ts` (`extendTailwindMerge`) + `utils.test.ts`, `ui/avatar.tsx`, `ui/badge.tsx` (tier), `ui/button.tsx` (comentariu).
6. **Primitive de layout.** `card.tsx`, `stat-card.tsx`, `empty-state.tsx`, `skeleton.tsx`, `use-loading-timeout.ts`, `query-state.tsx`, `page-header.tsx`, cheile `Common.loadState.*`; `primitives.test.tsx`, `query-state.test.tsx`.
7. **FilterChips.** `filter-chips.tsx` + test; migreaza in ordine: `requests/page.tsx`, `admin/companies`, `admin/users`, `marketplace/messages` (`TabButton` STERS), `inspiration/page.tsx` (`FilterPill` STERS), `inspiration-picker.tsx` (+ `aria-pressed` pe comutatorul de vedere), `room-viewer.tsx`; cheile `*.filterLabel/tabsLabel/roomFilterLabel/sceneChipsLabel`.
8. **Popovere ramase.** `notification-bell.tsx`, `board-picker.tsx` (doar continut), `save-button.tsx`, `inspiration/boards/[id]/page.tsx`, `FilterGroup` din `inspiration/page.tsx`. Test manual: Escape, click in afara, lightbox-ul nu se inchide la Escape in picker.
9. **Dashboard.** 5.1 + `todo-now-card.tsx`. Verificare vizuala client + firma.
10. **Portofel.** 5.2 (h1 prin `PageHeader`, `Metric` STERS, cheile `wallet.pageTitle/pageSubtitle`).
11. **Admin (partea 1).** `admin/page.tsx`, `companies`, `companies/[id]`, `users`, `requests`, `requests/[id]`.
12. **Admin (partea 2).** `disputes`, `withdrawals`, `payments`, `contact-detections`, `audit`, `jobs`, `calendar` (`Section` STERS), `sizing`, `settings` (`Section` STERS), `inspiration`.
13. **Marketplace.** `page.tsx`, `[id]`, `claims`, `claims/[claimSlotId]`, `messages`, `access-blocked.tsx` (peste EmptyState), `chat-panel.tsx`; `company-dashboard.tsx` (`Section` → `CardSection`).
14. **Inlocuirea in masa `text-[..px]` + `bg-card`.** Scriptul din 8.6 + cele 4 cazuri manuale; `ui/table.tsx` TH, `ui/tabs.tsx`, `ui/label.tsx`, `ui/stepper.tsx` (8.4); `bg-card` → `bg-surface`. `grep` = 0.
15. **Regula de lint.** `.eslintrc.json` (8.5); proba `--stdin`; `pnpm -F frontend lint` = exit 0.
16. **Curatenie i18n.** Sterge cheile `loading` fara utilizari (sectiunea 9); script de paritate.
17. **Documentatie.** `docs/design-tokens.md`.
18. **Verificare completa.** `pnpm build:shared`, `pnpm typecheck`, `pnpm lint`, `pnpm -F frontend test`, `pnpm -F backend test`, test manual (13); apoi security-close + `CHANGELOG.md` + mesaj de commit propus (fara commit).

---

## 13. Plan de test manual (localhost; backend :3001, frontend :3000; conturile demo din HANDOFF, parola din `apps/backend/.env` `DEMO_PASSWORD`)

1. **Cookie.** Login ca `owner.a@demo.ro` → DevTools > Application > Cookies `localhost`: exista `mm_session=COMPANY_USER` (HttpOnly, Path=/, ~7 zile). Logout → `mm_session` dispare.
2. **SSR header.** `curl -s -H "Cookie: mm_session=COMPANY_USER" http://localhost:3000/ro/marketplace | grep -c 'href="/ro/marketplace/wallet"'` ≥ 1 (nav-ul complet e in HTML-ul de server). Fara cookie → 0.
3. **Fara salt.** DevTools > Network „Slow 3G", hard reload pe `/ro/marketplace`, `/ro/marketplace/wallet`, `/ro/requests` (ca `ana.popescu@demo.ro`), `/ro/admin` (ca `admin@demo.ro`): headerul apare DE LA PRIMUL PAINT cu linkurile rolului; nicio trecere logo+RO/EN → meniu complet. Landing `/ro` logat: „Contul meu" de la primul paint.
4. **Access expirat.** Sterge manual `mm_access` (pastreaza `mm_refresh` + `mm_session`), reload: header complet imediat, apoi datele se incarca (refresh transparent).
5. **Sesiune revocata.** Login cu acelasi cont in alt browser → in primul, reload: headerul porneste din indiciu, `/auth/me` → 401 → refresh esuat → redirect `/login`; `mm_session` sters de raspunsul la refresh.
6. **Meniu de cont.** Firma: avatar, „Conectat ca", nume, email, numele firmei, „Utilizator firmă"; tastatura: Tab pe buton, Enter, sageti, Escape (focus revine pe buton). Client: fara rand de firma. Admin: meniul exista in bara de sus, logout functioneaza.
7. **Skeleton + timeout.** Network „Offline" dupa incarcarea shell-ului, navigheaza (client-side) la `/ro/marketplace/wallet`: skeleton, fara text vizibil „Se încarcă…"; dupa 15 s → „Încărcarea durează mai mult decât de obicei" + „Reîncearcă"; revino online, apasa → datele apar. Repeta pe `/ro/dashboard`, `/ro/admin`, `/ro/admin/companies`, `/ro/marketplace`, `/ro/marketplace/claims`, `/ro/marketplace/messages`.
8. **Admin KPI eroare.** Opreste backendul pe `/ro/admin` si reincarca: `LoadError` cu „Reîncearcă" (azi: incarcare infinita).
9. **Filter chips.** `/ro/requests`, `/ro/admin/companies`, `/ro/admin/users`, `/ro/marketplace/messages`, `/ro/inspiration`, pickerul de inspiratie din configurator, vizualizatorul 3D al camerelor: stil walnut unic; arborele de accesibilitate (DevTools) arata grupul cu nume si starea „pressed".
10. **Popovere.** Clopotel (Escape, click afara, click pe notificare navigheaza si inchide, bifa de email), „Salvează" pe pin + in lightbox (Escape inchide doar pickerul), „Mută" pe `/ro/inspiration/boards/<id>` (nu mai e taiat de card), cele 3 filtre de pe `/ro/inspiration` (unul singur deschis odata).
11. **Portofel h1.** `/ro/marketplace/wallet`: `document.querySelectorAll('h1').length === 1`, textul „Portofel și abonament".
12. **Tipografie / tokeni.** Comparatie vizuala (desktop 1280 + mobil 375) pe landing, `/ro/inspiration`, configurator (titlul de pas 26px → 24px), Studio, sidebar admin, badge-urile tier pe portofel si `/ro/admin/payments` — aceleasi culori; RO/EN comutat pe fiecare pagina migrata (nicio cheie lipsa in consola).
13. **Header la 1024px.** Firma pe RO la 1024 px latime: 6 linkuri + lang + clopotel + cont pe un singur rand (ca azi).

---

## 14. Checklist de acceptare (legat de „done when" / acceptance)

- [ ] DW1 „Wallet, dashboard, admin si marketplace arata skeleton la incarcare, nu «Se încarcă…»": `grep -rnE "t\('loading'\)|>…<" apps/frontend/src/app/[locale]/{dashboard,marketplace,admin}` = 0; `chat-panel.tsx` fara `t('loading')`; test manual 7-8.
- [ ] DW2 „Meniul de cont arata numele, emailul si firma": test 11.1.7 + manual 6 (inclusiv admin).
- [ ] DW3 „Headerul nu mai trece de la minimal la meniul complet dupa incarcare": test 11.1.8 + manual 2-3.
- [ ] A1 `ui/card`, `stat-card`, `empty-state`, `skeleton`, `page-header`, `filter-chips`, `popover`, `dropdown-menu` exista, iar dashboard, wallet, admin si marketplace le importa (grep importuri in cele 4 zone).
- [ ] A2 meniul de cont: nume, email, firma.
- [ ] A3 scala tipografica inlocuieste `text-[..px]`: `grep -rnE "text-\[[0-9.]+px\]" apps/frontend/src` = 0; regula `no-restricted-syntax` activa (proba `--stdin` pica); `pnpm lint` = exit 0.
- [ ] A4 aliasul `plan` si comentariile „albastru-plan"/„PLANSA"/„alias: plan" sterse (`grep -rn "albastru-plan\|alias: plan\|plan = albastru" apps/frontend` = 0); `grep -rnE "\[#[0-9A-Fa-f]{3,8}\]" apps/frontend/src/components/ui` = 0; `bg-card` = 0 in `apps/frontend/src`.
- [ ] Portofelul are exact un h1 (manual 11).
- [ ] O singura raza de card (`rounded-xl`) in paginile migrate; functiile locale `Card`/`Metric`/`Section`×3/`TabButton`/`FilterPill` sterse.
- [ ] Filter chips cu `aria-pressed` + grup etichetat pe requests, messages, inspiration, admin companies/users, picker, room-viewer.
- [ ] Cele 5 popovere pe Radix; `grep -rn "addEventListener('mousedown'" apps/frontend/src/app` = 0; backdrop-ul `fixed inset-0` din `inspiration/page.tsx` sters.
- [ ] i18n: paritate RO/EN, cele 18 chei noi prezente in ambele, cheile moarte sterse doar cu 0 utilizari.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm -F frontend test`, `pnpm -F backend test` verzi; `pnpm audit --audit-level high` fara HIGH nou.
- [ ] `docs/design-tokens.md` scris; `CHANGELOG.md` actualizat; security-close rulat.

---

## 15. Riscuri si fisiere atinse deja de sprinturile anterioare

### Riscuri
1. **Regresii vizuale pe multe pagini** — migrare pagina cu pagina (pasii 9-13), verificare vizuala dupa fiecare; inlocuirea tipografica e deterministica (5.10); valorile care se schimba efectiv: 9→10, 9.5→10, 10.5→10, 12.5→12, 13.5→13, 19→20, 21→20, 26→24 px.
2. **tailwind-merge** sterge tokenii noi de font daca nu se configureaza `extendTailwindMerge` (8.2) — pas obligatoriu, cu test.
3. **Radix in jsdom** (pointer capture, scrollIntoView) — deschidere prin tastatura in teste; stub-uri in `setup.ts` doar la nevoie.
4. **Exit-animatii Radix** inghetate in pane-ul de preview → fara `animate-out` (presupunerea 10).
5. **Popover in lightbox** — Escape oprit in `PopoverContent` (`onEscapeKeyDown={(e) => e.stopPropagation()}`), altfel listener-ul `keydown` de pe `document` al lightbox-ului (`inspiration-lightbox.tsx:60-66`) il inchide si pe el (Radix asculta in faza de capture, deci `stopPropagation` il opreste — de verificat manual); click-urile din portal fac bubbling React prin cardul lightbox-ului, care are deja `stopPropagation` (`inspiration-lightbox.tsx` ~170).
6. **Indiciu vechi** — dupa logout in alt tab / sesiune revocata, headerul poate arata < 1 s nav-ul rolului pana la 401 + redirect; nu expune date (toate datele vin prin API cu authz).
7. **Latimea headerului** la 1024 px — butonul de cont pastreaza iconita (nu avatar); logo 15px neschimbat (`text-lead`).
8. **Lockfile** — `pnpm install --frozen-lockfile` (CI + `Dockerfile.app`) cere lockfile-ul actualizat in acelasi commit.
9. **Sprint 76** rescrie `save-button.tsx` (bife pe mai multe colectii), `inspiration-picker.tsx` („Adaugă toată colecția") si `request-inspiration-strip.tsx` — Sprint 75 le atinge minimal (Popover, FilterChips, clase); Sprint 76 construieste peste primitive (Popover, FilterChips, Card, EmptyState).
10. **Cookie nou** — httpOnly, fara date personale, fara efect pe authz; `me()` nu il considera sesiune (test 11.2.5); socket-ul si refresh-ul nu il citesc.
11. **`useMyCompany` in header** — +1 cerere `GET /companies/me` la prima pagina a unei sesiuni de firma (cache 30 s, deduplicata cu wallet/claims). Acceptabil; alternativa (`companyName` in `/auth/me`) ramane pentru mai tarziu.

### Fisiere atinse deja (din `sprint-reports.json`) — de RECITIT inainte de editare, nu presupune varianta din HEAD
- `app/[locale]/_components/app-header.tsx` — Sprint 7 (E-client-3: confirmare logout cu draft local)
- `app/[locale]/_components/notification-bell.tsx` — Sprinturile 1, 19, 22, 23 (E-admin-platform-3/-44/-15, E-company-13/-24: rute noi pe tipuri de notificari)
- `app/[locale]/admin/layout.tsx` — 1, 3, 19, 20 (NAV nou, `BillingReadinessBanner`)
- `app/[locale]/admin/page.tsx` — 23, 73 (`activeSubscriptionsByPlan`)
- `app/[locale]/admin/settings/page.tsx` — 1, 2, 3, 4, 5, 8, 19, 20, 22, 23, 73 (cel mai atins; sectiuni fiscale/mail/monitorizare)
- `app/[locale]/admin/payments/page.tsx` — 3, 21, 23, 73
- `app/[locale]/admin/{requests,jobs,withdrawals,companies,calendar,sizing,contact-detections,inspiration}` — 1, 4, 7, 19, 20, 21, 22, 23, 73
- `app/[locale]/marketplace/wallet/page.tsx` — 3, 22, 23 (×3 pachete), 73
- `app/[locale]/marketplace/claims/[claimSlotId]/page.tsx` — 14 pachete (sprinturile 1, 5, 6, 8, 19, 20, 21, 22, 23, 73)
- `app/[locale]/marketplace/{page,[id]/page,claims/page}.tsx` — 3, 6, 19, 20, 23
- `app/[locale]/dashboard/page.tsx` — 19 (TodoNowCard), 23
- `app/[locale]/requests/page.tsx` — 1
- `app/[locale]/inspiration/page.tsx`, `components/configurator/inspiration-picker.tsx` — 7 (E-client-2)
- `components/studio/room-viewer.tsx` — 20
- `components/ui/badge.tsx` — 73 (TierBadge pe planuri-date)
- `hooks/use-company.ts` — 1, 23
- `app/[locale]/layout.tsx` — 1, 2, 3, 19, 20, 74 (CSP nonce: `await headers()` trebuie pastrat)
- `lib/providers.tsx` — multiple (NU se modifica; providerul nou sta in layout)
- `apps/backend/src/modules/auth/auth.controller.ts` — 8 (me anonim, lockout), 74 (perimetru); `auth.service.ts` — 2, 8; `auth.constants.ts` — 8
- `.eslintrc*` / lint — 74 (supply chain); `messages/ro.json`/`en.json` — practic toate sprinturile (un singur editor la un moment dat, nu din mai multe worktree-uri)

---

## 16. DECIZIE NECESARA

Niciuna blocanta. Alegeri facute in plan (reversibile, de mentionat PO la inchidere):
- Badge/TierBadge raman mono (statusuri = date, regula ATELIER); TH/Tabs/Label trec pe sans `.label`.
- `.heading-section` = 20px (nu 22px) ca sa nu schimbe paginile existente.
- Cookie-ul indiciu `mm_session` (doar rolul) in loc de fetch `/auth/me` pe server.
- Hex-urile din Studio (`studio-page.tsx`, `tutorial.tsx`) raman pentru faza 2.

---

## 17. Dupa sprint (inchidere)

- security-close pe diff (cookie nou, dependinte noi, CSP neschimbat, fara `dangerouslySetInnerHTML`).
- `CHANGELOG.md`: „## Sprint 75 (plan 2026-09-28): Design primitives and tokens (P3) — <data>" cu fisiere, ce merge, ce ramane (faza 2 din 5.9, hex Studio) + checklist-ul din 14.
- Mesaj de commit propus (fara commit), cu linia de co-autor ceruta de sesiune.
- Codex (dupa Sprint 76, conform HANDOFF): `20 Frontend/FE auth.md` (indiciu `mm_session`, `useSessionRole`, AccountMenu si in admin), `FE admin.md`, `FE marketplace firma.md`, `FE client cereri si oferte.md`, `50 Impact/IMPACT text UI.md` (chei `Common.loadState.*`, regula `text-[..px]`, json-urile sunt LF, nu CRLF), sectiune noua „Design system / primitive UI".
