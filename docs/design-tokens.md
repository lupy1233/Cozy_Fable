# Design tokens si primitive UI (Sprint 75, plan 2026-09-28)

Sursa de adevar pentru limbajul vizual ATELIER din `apps/frontend`. Tokenii sunt variabile CSS in
`apps/frontend/src/app/globals.css`, expuse ca utilitare Tailwind prin `apps/frontend/tailwind.config.ts`.
Produsul se numeste "Cozy Home"; in texte pentru utilizatori se spune "firma", niciodata "atelier".

## 1. Culori

Toate culorile sunt `hsl(var(--x))`; in cod se folosesc numele Tailwind (`bg-surface`, `text-walnut` etc.).

| Token | Folosire |
|---|---|
| `background` / `foreground` | fundalul paginii (ivorie) / textul principal (espresso) |
| `surface` | suprafata cardurilor, panourilor, header-ului. Singurul token pentru "card" in cod (`bg-card` e interzis de lint; `card` exista doar pentru contractul shadcn din `components.json`) |
| `surface-2` | suprafata secundara: tile-uri in interiorul cardurilor, note, fundal de antet de card |
| `surface-3` | placeholder de incarcare (`Skeleton`), hover usor |
| `border` / `border-2` | chenar de card / chenar de control si pastila |
| `ink-2` | text secundar pe fundal deschis (nav admin) |
| `muted` / `muted-foreground` / `muted-2` | text atenuat (descrieri, etichete) / text si icoane foarte discrete |
| `walnut` / `walnut-deep` / `walnut-soft` | accentul de brand (nuc): butoane principale, link-uri, chip activ |
| `sage` / `sage-soft` | succes, "confirmat", rol activ |
| `amber` / `amber-soft` | atentie, "in asteptare", avertizari |
| `brass` / `brass-2` | detalii premium (kicker, stele) |
| `crimson` / `crimson-soft` | eroare, pericol, necitit |
| `info` / `info-soft` | informativ (oferta trimisa, PUBLISHED) |
| `on-walnut` | text pe fundal nuc (initialele din `Avatar`) |
| `tier-platinum-*`, `tier-gold-*`, `tier-silver-*` (`from`, `to`, `fg`) | panglicile `TierBadge` (gradient + text) |

Modul intunecat (`.dark`) nu redefineste `on-walnut` si `tier-*` (aspect identic in ambele moduri).

## 2. Raze

| Element | Clasa |
|---|---|
| card (`Card`, `CardSection`, `StatCard`, `EmptyState` cu chenar) | `rounded-xl` (14px) |
| tile in interiorul unui card | `rounded-lg` (8px, `--radius`) |
| control (buton, input, item de meniu) | `rounded-md` |
| pastila (badge, chip, avatar) | `rounded-full` |

## 3. Scala tipografica

Regula: **mono doar pentru date** (ID, sume, statusuri). Etichetele sunt sans spatiat (`.label`).
Nu se folosesc marimi arbitrare `text-[..px]` (regula ESLint). Numele de clase personalizate nu au
prefix `h-` / `text-` (tailwind-merge le-ar confunda cu height / culoare).

| Rol | Clasa | Marime |
|---|---|---|
| titlu de pagina (display) | `.page-title` | clamp(32px, 3.6vw, 50px), serif |
| titlu de sectiune | `.heading-section` | 20px, serif |
| titlu de card | `.heading-card` | 18px, serif |
| text lead (logo mic, mobile nav) | `text-lead` | 15px / 22px |
| text de baza | `text-sm` | 14px |
| text UI compact (nav, tabel) | `text-ui` | 13px / 18px |
| text secundar | `text-xs` | 12px |
| meta (ore, contoare) | `text-meta` | 11px / 16px |
| micro (badge, antet de tabel, cifra de pas) | `text-micro` | 10px / 15px |
| eticheta (sans, uppercase spatiat) | `.label` | 11px |
| kicker (deasupra titlului) | `.kicker` | 10.5px, alama |
| text meta atenuat | `.meta-text` | 11px, `muted-foreground` |
| date in font mono | `.data-mono` | 12px, cifre tabulare |

`cn()` (din `@/lib/utils`) foloseste `extendTailwindMerge` cu `micro/meta/ui/lead`, altfel
`cn('text-meta', 'text-muted-foreground')` ar sterge tacit marimea (testat in `lib/utils.test.ts`).

## 4. Primitive (`apps/frontend/src/components/ui/`)

| Primitiva | Cand se foloseste |
|---|---|
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardBody`, `CardFooter` | orice container de suprafata; `tone` = default / muted / dashed / amber / crimson / sage / info; `asChild` + `interactive` pentru link-card |
| `CardSection` | card cu titlu (`aria-labelledby`), actiuni in antet si corp in coloana; inlocuieste functiile locale `Section` |
| `StatCard` | cifra-cheie (dashboard, admin, portofel); `variant="inline"` in interiorul altui card |
| `EmptyState` | gol, eroare sau blocaj; `variant` card / dashed / plain, `tone` neutral / warning / error |
| `Skeleton`, `SkeletonText/Card/StatGrid/List/Table/Page`, `LoadingRegion` | incarcare; textul "Se incarca..." exista doar `sr-only` |
| `QueryState`, `LoadError` | skeleton cat timp se incarca; dupa 15 s (`LOADING_TIMEOUT_MS`) sau la eroare -> "Reincearca" |
| `PageHeader` | un singur `h1` per pagina, cu back-link, subtitlu, actiuni si meta |
| `FilterChips` | filtre ca pastile: grup etichetat, `aria-pressed`, single / multiple / `allowDeselect` |
| `Popover`, `DropdownMenu` | panouri ancorate (Radix): Escape, click in afara, focus; fara `animate-out` (vezi mai jos) |

Exit-animatiile Radix sunt omise intentionat: `Presence` asteapta `animationend`, iar in pane-ul de preview
animatiile ingheata; panourile se inchid instant.

Tipar de pagina:

```tsx
if (me.isPending || me.isError)
  return <QueryState pending onRetry={() => void me.refetch()} skeleton={<SkeletonPage variant="table" />} />;
```

## 5. Reguli de lint (`apps/frontend/.eslintrc.json`)

1. `text-[<numar>px]` este interzis (in literale si in template literals) -> foloseste scala de mai sus.
2. `bg-card` este interzis -> foloseste `bg-surface`.

Verificare: `echo "export const x = 'mt-1 text-[11px]';" | pnpm -F frontend exec eslint --stdin --stdin-filename src/probe.tsx`
trebuie sa iasa cu eroare `no-restricted-syntax`.

## 6. Indiciul de sesiune (header fara salt)

Backendul seteaza cookie-ul `mm_session` (httpOnly, `SameSite=Lax`, `path=/`) cu valoarea = rolul, la login /
refresh / schimbare de parola, si il sterge la logout / refresh esuat. `app/[locale]/layout.tsx` il citeste pe
server (`parseSessionHint`) si il da contextului `SessionHintProvider`; `useSessionRole()` il foloseste DOAR cat
`useMe` e pending. Nu este material de sesiune si nu se foloseste pentru autorizare (`GET /auth/me` il ignora).

## 7. Ramas pentru faza 2 (nemigrat in Sprint 75)

`components/studio/studio-page.tsx`, `_components/offer-card.tsx`, `_components/project-case-panel.tsx`,
`configurator3d-step.tsx`, `claim-lifecycle-panel.tsx`, `client-fulfillment.tsx`, `requests/[id]/offers/page.tsx`,
`requests/[id]/page.tsx` (`SectionHeading`), `inspiration/boards/page.tsx`, `partners/page.tsx`, `company/page.tsx`,
`(auth)/change-password/page.tsx`, `configurator-wizard.tsx`, `firm-rules-article.tsx` si restul configuratorului
si al Studio-ului (inclusiv hex-urile din `studio-page.tsx` si `tutorial.tsx`). Se migreaza pagina cu pagina, cu
aceleasi primitive.
