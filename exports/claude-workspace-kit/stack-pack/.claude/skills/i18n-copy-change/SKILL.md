---
name: i18n-copy-change
description: Use this skill when adding or changing any user-visible string in a next-intl app with two or more locales - UI labels, page titles and meta descriptions, API error messages, plurals, enum/status labels, email copy, legal or business-rule pages, or a terminology rename ("translation", "copy", "locale", "traducere", "texte", "toate limbile", "diacritice", "terminologie", "cheie i18n", "mesaj de eroare").
---

# i18n and copy changes (next-intl)

Every visible string is a key in every locale file, written in the owner's terminology and tone, and verified by a parity check. Typecheck does not catch missing or wrong keys. Rule IDs point to the kit: WM = 01, SOT = 02, DEL = 03, ENG = 04, QA = 05, SEC = 06, PO = 07, MEM = 08, ENV = 10, STK = STACK-RULES.

## When to use
- A new or changed label, heading, hint, toast, empty state, `aria-label` or `title` in `apps/frontend`.
- Page metadata (titles and descriptions), a new public page, a new error code that the UI can show.
- A new enum value that the UI translates, a plural, a sentence with an inline link, a number or date inside copy.
- Email templates in the backend, legal pages, public pages that explain business rules.
- Renaming a product term across the app.
- Not here: component structure and data fetching (`ui-component`), visual checks in the browser (`ui-browser-verify`).

## Read first
- `<GLOSSARY>`: required, banned and still-under-decision terms (PO-032, PO-033).
- `<COPY_STYLE_GUIDE>`: form of address, tone, quotation marks, diacritics (PO-034).
- `<DECISIONS_LOG>`: terminology and locale decisions are final (SOT-016).
- `<ERROR_CODES_DOC>` and the error-code registry in `<SHARED_PKG>` when the change touches `apiErrors`.
- The existing key tree of the page's namespace in `<MESSAGES_DIR>/<locale>.json` for every locale in `<LOCALES>` (QA-066). Reuse a key before creating one.
- If the project keeps a knowledge vault: the i18n concept note and the "UI text" IMPACT playbook (MEM-019, MEM-020).

## Procedure
1. **Inventory.** List every string to add or change, the page or component that renders it and its namespace. Note which strings are new names you are inventing: they ship as "proposed, awaiting PO OK" (PO-024). A term still under decision stays as it is (PO-033).
2. **Check the files' format.** `git ls-files --eol <MESSAGES_DIR>/*.json` shows the index line endings (`i/crlf` or `i/lf`); the index is authoritative. Note the indent (normally 2 spaces) and whether the file ends with a newline (ENV-015).
3. **Choose keys.** English key names, no dots inside a key (STK-007, STK-083). Put them in the page's existing namespace (STK-082). Shared UI components (`components/ui/*`) use their own namespace (STK-115). Keep the same key tree in every locale.
4. **Write the primary-locale text** (`<PRIMARY_LOCALE>`) first: glossary terms only, one name per concept, the agreed tone and quote style, complete and correct diacritics (PO-032, PO-034). Then write every other locale with the same meaning and tone, in that locale's own orthography (PO-034). Pros, cons and comparisons stay concrete (PO-038).
5. **Use the right message form** (STK-084):
   - Plurals as ICU `{count, plural, ...}` with every category each locale needs (check the CLDR plural rules: some locales need `few` and `many`, not only `one`/`other`). Copy an existing correct plural as the model.
   - Links inside a sentence through `t.rich` with a tag (`<link>...</link>`), never sentence fragments glued in TSX.
   - Dynamically built keys (`t(\`status.${value}\`)`) guarded with `t.has(key)` and a sensible fallback.
   - Numbers that come from settings or business rules arrive as ICU arguments from the server, never typed into the copy (ENG-110, PO-011). Dates use the i18n formatter pinned to `<BUSINESS_TZ>` (ENG-040); money uses `Intl.NumberFormat` with the currency unit from a message (STK-087).
6. **Enum-driven text.** Grep the enum's values and every namespace that translates it; add a key for every value, including new ones (STK-031).
7. **API errors.** Add `apiErrors.<CODE>` in the namespace of every page that can show that error, in every locale (ENG-094). Each key must be a real code from the shared registry (QA-068). The UI shows the mapped message with `t.has` + a generic fallback key, never the raw code and never the server's `message` as primary text (ENG-094, STK-057).
8. **Public pages.** Add per-locale title and description keys and build complete metadata through the shared helper: absolute title, description, canonical, hreflang, full openGraph (STK-045, STK-046).
9. **Root fallbacks.** `app/not-found.tsx` and `app/global-error.tsx` sit outside the provider: edit their hard-coded text by hand in every locale (STK-043, STK-044).
10. **Emails.** Copy lives in the backend templates, not in the frontend messages. Render in the recipient's stored locale, HTML-escape every interpolated value, keep the unsubscribe link on notification emails (STK-022, SEC-043, ENG-057, SEC-117).
11. **Legal and rule pages.** Only with the owner's agreement, plus legal review for material changes (PO-011). No bracketed placeholders, ever; operator identity and numbers come in as allowlisted ICU arguments (SEC-114, QA-069). A material change to terms or privacy bumps the shared terms-version constant `<TERMS_VERSION_CONST>`, which forces re-acceptance; wording fixes that keep the meaning do not (SEC-115). When a business-rule outcome changes, update the page that explains it in the same change (PO-011).
12. **Parallel work.** When several agents touch i18n, each returns a fragment `{ "<locale>": { ... } }` and one integrator deep-merges them into the locale files. Never edit the locale JSON from several worktrees or agents at once (DEL-039, DEL-037).
13. **Write the files** with the original line endings, indent and final newline. A script must emit them explicitly, e.g. Node `JSON.stringify(obj, null, 2).replace(/\n/g, '\r\n') + '\r\n'` for a CRLF file that ends with a newline (ENV-015). Then parse every locale file (QA-066).
14. **Selectors.** If existing copy changed (English labels most of all), grep `<E2E_DIR>` for the old literal and update the Playwright selectors in the same commit (QA-067). New e2e tests read expected strings from the locale JSON (QA-060).
15. **Verify** (see the checklist), and record the key counts per locale in the CHANGELOG entry's "i18n parity count" line (QA-067, DEL-011).

### Parity check (adapt paths and locales)
```js
// node parity.js  ->  key count per locale, keys missing on any side, banned-term hits; exits 1 on any problem
const fs = require('fs');
const L = ['<LOCALE_A>', '<LOCALE_B>'];        // every locale in <LOCALES>
const BANNED = [/* lowercase banned terms from <GLOSSARY> */];
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]);
const read = l => JSON.parse(fs.readFileSync(`<MESSAGES_DIR>/${l}.json`, 'utf8').replace(/^﻿/, ''));
const cat = Object.fromEntries(L.map(l => [l, new Map(flat(read(l)))]));
let bad = 0;
for (const a of L) for (const b of L) if (a !== b)
  for (const k of cat[a].keys()) if (!cat[b].has(k)) { console.log(`missing in ${b}: ${k}`); bad++; }
for (const l of L) {
  const hits = [...cat[l]].filter(([, v]) => BANNED.some(t => v.toLowerCase().includes(t)));
  hits.forEach(([k]) => console.log(`banned term in ${l}: ${k}`));
  bad += hits.length;
  console.log(l, cat[l].size, 'keys');
}
process.exitCode = bad ? 1 : 0;
```
Prefer committing it as `<PARITY_SCRIPT>` or a unit test so CI runs it on every change.

## Rules
- MUST put every UI string behind a next-intl key; no hard-coded TSX text except the root not-found and global-error pages (STK-082).
- MUST add each key to every locale in `<LOCALES>` in the same change, with identical key trees and zero keys missing on any side (STK-082, QA-067).
- MUST apply the glossary, tone, quote style and diacritics to every new string in every locale, emails, metadata and legal text included; mandated terms are hard rules (PO-032, PO-034).
- MUST keep i18n key names when renaming a term; change only the values (PO-032).
- MUST cover every enum value that the UI translates, in every namespace that translates it (STK-031).
- MUST keep `apiErrors` keys identical across locales and limited to real codes in the shared registry (ENG-094, QA-068).
- MUST preserve each locale file's line endings, indent and final newline (ENV-015).
- MUST NOT write business numbers, prices, durations or operator identity into copy; pass them as ICU arguments (ENG-110, PO-011, SEC-114).
- MUST NOT put bracketed placeholders in any locale file, even in development (SEC-114).
- MUST NOT change legal text without the owner's agreement, nor ship a material change without the version bump (PO-011, SEC-115).
- MUST NOT unify or rename a term that the owner is still deciding on (PO-033).
- MUST NOT mix a copy rewrite with a production bugfix in one commit (DEL-018).

## Done checklist
- [ ] Every new string is a key, in the page's namespace, in every locale; no stray literals in the touched TSX.
- [ ] Glossary and style guide applied; banned-term grep is 0; invented names flagged "proposed, awaiting PO OK".
- [ ] Plurals carry every category per locale; inline links via `t.rich`; dynamic keys guarded with `t.has`.
- [ ] Every enum value and every new error code has text in each namespace that can show it.
- [ ] Public pages have per-locale title and description.
- [ ] Emails render in the recipient's locale with escaped values; legal changes approved, placeholder-free, version bumped if material.
- [ ] All locale files parse; line endings and indent unchanged (`git ls-files --eol`).
- [ ] Parity script or test green, key counts recorded.
- [ ] Gates green in order: shared build, typecheck, lint, unit tests (QA-002, STK-004), then e2e for copy used as selectors (QA-067).
- [ ] `git -c core.whitespace=cr-at-eol diff --check` clean.
- [ ] Page looked at in every locale, desktop and mobile, no raw keys and no overflow from longer translations (QA-051); anything not verifiable reported as `UNVERIFIED` with the reason (WM-031).

## Pitfalls
- Typecheck passes with missing or misspelled keys unless next-intl message types are augmented; only the parity check, tests and a look at the page catch them (QA-067).
- A missing key for a dynamic or enum value prints the raw key path on screen (STK-031).
- `apiErrors` is often duplicated per namespace; a new code added to one namespace still falls back to the generic message on other pages (ENG-094).
- A dot inside a message key throws `INVALID_KEY` on every page (STK-083).
- A plural without the locale's `few`/`many` form produces ungrammatical counts that no test flags.
- On CRLF files, plain `git diff --check` flags every changed line as trailing whitespace; use `-c core.whitespace=cr-at-eol`. A diff that rewrites the whole file means the working tree drifted to LF: normalize it back before committing (ENV-015).
- Re-serializing JSON with a script silently converts CRLF to LF and can drop the final newline (ENV-015).
- Shared UI components tested without `NextIntlClientProvider` fail once they read their namespace (STK-115).
- Changing English copy breaks Playwright tests that select by literal label, often only in CI (QA-067).
- `document.body.innerText` omits `title` and `aria-label`; check translated icon buttons with an attribute selector (ENV-057).
- Two agents editing the same locale files guarantee merge conflicts across thousands of lines; use fragments and one integrator (DEL-039).
