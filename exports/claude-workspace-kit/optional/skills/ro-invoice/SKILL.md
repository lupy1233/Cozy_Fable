---
name: ro-invoice
description: Use this skill when working on invoicing — issuing invoices on confirmed payment, gap-free invoice numbering and series, VAT computation, invoice PDFs, proformas or accounting exports, cancellation or storno (reversal) invoices, or the purchase flow that issues them ("factura", "facturare", "TVA", "storno", "serie factura", "proforma"). Written for Romanian fiscal rules; adapt the legal fields to other jurisdictions.
---

# Invoicing (Romanian fiscal rules)

An issued invoice is a legal document: its number, amounts and parties never change afterwards. This skill covers issuance on confirmed payment, numbering, VAT math, the document, exports and reversal. Rule IDs point to the kit chapters: WM = 01, ENG = 04, QA = 05, SEC = 06, OPS = 09. Mechanism names (Prisma `updateMany`, `Decimal`, PostgreSQL advisory locks) are those of the default NestJS + Prisma + PostgreSQL stack; on another stack keep each rule's intent and map the mechanism.

## When to use
- Adding or changing a purchase flow that ends in an invoice (subscriptions, one-off products or services).
- Touching payment confirmation (admin confirmation, provider webhook) or anything that runs inside it.
- Changing the series, numbering, VAT rate handling, or the seller/customer fiscal data and their admin settings.
- Generating or changing the invoice PDF/HTML, a proforma, or an accounting/e-invoicing export.
- Cancelling, reversing or correcting an issued invoice.
- Anyone asks to connect real e-invoicing or fiscal reporting: run the `decision-gate` skill first (WM-001).
- Not here: general endpoint and schema conventions (`nestjs-module`, `prisma-migration` from the stack pack).

## Read first
- `docs/03-business-rules.md`, sections "Payments and purchases" and "Invoicing" (`<INVOICING_SECTION>`): who the seller and the customer are, what is billed, the series, the cancellation policy. They are the source; this skill only encodes the mechanics.
- `docs/02-technical-invariants.md`: "Money and computed values" plus the transaction-profile and idempotency sections (ENG-003, ENG-063 to ENG-072).
- `docs/04-data-model.md`: the order/invoice entity, its snapshot columns and status enums, used verbatim.
- `docs/07-decisions-log.md`: payment provider vs manual bank transfer (SEC-049), test-mode policy, e-invoicing route. These are final; do not reopen them.
- The existing confirm-payment service and its concurrency integration spec. Extend them; never add a second issuing path (ENG-023, ENG-027).

## Procedure
1. Find the single confirmation method (e.g. `confirm(orderId, source)`) that both the admin action and the signed webhook call, with the source recorded in the audit log (ENG-023). Issuance lives only there.
2. Before the transaction and before any provider call, check that the seller's fiscal identity in admin settings is ready: every field present, none equal to a seed/example value, the tax ID (CUI) passing its control digit, the IBAN passing mod-97. If it is not ready, fail closed with a retryable 503 `<NOT_CONFIGURED_CODE>` and write nothing; the webhook gets the same 503, so the provider retries later. Block new purchases the same way (OPS-027, ENG-010, ENG-021, SEC-049).
3. Still before the transaction, read everything that needs no lock (the customer data to snapshot, the purchased item, event recipients) to keep the transaction short (ENG-012). For an admin confirmation, close any known payable provider session now and refuse if that call fails (ENG-024).
4. Open one transaction through the transaction helper with the write profile (READ COMMITTED), not a SERIALIZABLE one (ENG-003, ENG-069). Inside it, in this order:
   1. `SELECT ... FOR UPDATE` the order row and re-read it. For an admin confirmation, re-check under this lock that no provider attempt is unresolved (ENG-024).
   2. Conditional transition `updateMany({ where: { id, status: <PENDING_STATUS> } })`. `count === 0` means another path already settled it: the admin path returns 409 "already processed", the webhook path is a no-op answered 200, and neither does anything else (ENG-025, ENG-026).
   3. Verify amount, currency and owner against the order, then grant the purchased benefit serialized per customer: lock the customer's entitlement or balance row `FOR UPDATE`, or take a per-customer advisory lock when there is no row (ENG-007, ENG-022).
   4. Take the per-series lock `pg_advisory_xact_lock(hashtextextended('invoice:<series>', 0))`, compute `MAX(number)+1` for that series, and stamp the issue date after the lock, so number order equals date order (ENG-068).
   5. Write series, number, issue date, the seller snapshot, the customer snapshot, the VAT rate and the computed amounts in one update (ENG-067).
   6. Write the outbox row with a deterministic key such as `<PAID_EVENT>:<orderId>` (ENG-050, ENG-051).

   Take the locks in the same order on every path (order row → customer → series) so they never deadlock.
5. The webhook verifies the signature and live/test mode (SEC-046), dedupes on the provider event ID, and marks the event processed only after the transaction commits; it returns 500 on a processing error so the provider retries (ENG-021). Together with step 4.2 this makes issuance idempotent on the payment (ENG-070).
6. Compute amounts in one shared pure helper on `Decimal`: base rounded to 2 decimals half-up, VAT = base × rate / 100 rounded half-up, total = base + VAT. Price lists, checkout, proforma and invoice all call it, so the shown and invoiced totals cannot diverge (ENG-063 to ENG-066).
7. Read the VAT rate and the series from the settings store (`<VAT_RATE_SETTING>`, `<INVOICE_SERIES_SETTING>`), never hardcode them; the issued record keeps its own copy (ENG-110, ENG-067).
8. A test-mode payment is not a confirmed real payment: it consumes no fiscal number and puts no customer on a fiscal document. Flag it as test mode and show the banner (ENG-070, SEC-047).
9. Render the document from the snapshots only, never from current settings or the live customer record. Fields: `<INVOICE_REQUIRED_FIELDS>`; for Romania at minimum series and number, issue date, full supplier identity (name, tax ID, trade-register number, registered office, IBAN), customer name and tax ID, service description, taxable base, VAT rate, VAT and total (ENG-132). Use the recipient's language preference. HTML-escape every interpolated value (SEC-043).
10. An unpaid order settled by bank transfer gets payment instructions with the VAT-inclusive total and a payment reference (SEC-049). If they are rendered as a proforma, label it non-fiscal and give it no fiscal number: numbers are allocated only on confirmed payment (ENG-070).
11. Read issued invoices and their customer through the soft-delete bypass helper, with a dedicated reason from its closed union (e.g. `<ISSUED_DOCUMENT_REASON>`), so a deleted customer's invoices stay readable. Await the query inside the bypass context (ENG-076, ENG-077).
12. Accounting export (e.g. a monthly CSV register for manual e-invoice upload): select by the stored UTC confirmation timestamp, with month boundaries computed in `<BUSINESS_TZ>` by the business calendar service (ENG-034, ENG-035); exclude test-mode rows (SEC-047); escape for CSV as SEC-043 does for HTML, prefixing cells that start with `=`, `+`, `-`, `@`, TAB or CR with `'`; add a UTF-8 BOM so spreadsheet apps keep diacritics; log no customer data (SEC-057).
13. Cancellation deletes nothing. Issue a storno invoice (negative amounts, the next number in the series, a reference to the original), or, where the business rules allow only that, mark the invoice cancelled and keep its number consumed. Any refund goes through the single settlement function, exactly once (ENG-071, ENG-026, ENG-027).
14. Real e-invoicing, fiscal reporting or a tax treatment the docs do not decide (reverse charge, exemptions, foreign customers): write DECISION NEEDED with the options through `decision-gate` and stop that part (WM-001, WM-002).
15. Update the error-code registry and `<ERROR_CODES_DOC>`, the Invoicing section if behaviour changed, the CHANGELOG, and the launch-blocker list for every mock or placeholder (ENG-115).

## Rules
- MUST issue an invoice only on confirmed payment, inside the confirmation transaction, from the single confirm method (ENG-070, ENG-023).
- MUST allocate numbers gap-free per series under a per-series lock inside the issuing transaction, at READ COMMITTED; MUST NOT use an unserialized `MAX()+1` or a native Postgres `SEQUENCE` (ENG-068, ENG-069).
- MUST snapshot seller identity, customer data and VAT rate at issue; MUST NOT rewrite them after a settings or customer change (ENG-067).
- MUST store money as `NUMERIC`/`Decimal` or integer minor units, never FLOAT, and compute VAT on the server from the base with half-up rounding; the client only displays backend totals (ENG-063, ENG-064, ENG-065).
- MUST settle exactly once when the webhook, an admin confirmation and a retry race (ENG-026, QA-032).
- MUST HTML-escape every value in invoice and proforma templates (SEC-043).
- MUST NOT delete or renumber an issued invoice, and MUST NOT reuse a cancelled number (ENG-071).
- MUST NOT issue invoices with missing, placeholder or invalid seller data (OPS-027, SEC-049).
- MUST NOT let mock payments, mock document labels or example seller values reach production; label every mock in code and UI (SEC-049, ENG-115).
- MUST NOT put financial foreign keys on `Cascade`; use `Restrict` (ENG-072).
- MUST NOT log customer names, tax IDs, addresses or provider error text (SEC-057).

## Done checklist
- [ ] Issuance happens only in the confirm method, after the conditional pending → paid transition; a webhook that loses the race is a no-op 200.
- [ ] Per-series lock + `MAX()+1` at READ COMMITTED; issue date stamped after the lock; same lock order on every path.
- [ ] Seller, customer and VAT rate snapshotted; the document renders from snapshots only.
- [ ] One shared Decimal helper for base/VAT/total; half-up; base + VAT = total.
- [ ] Readiness check returns 503 before any provider call when seller data is missing, placeholder or invalid.
- [ ] Test-mode payments consume no number; proformas carry no fiscal number.
- [ ] Every template value escaped, CSV cells formula-guarded; language follows the recipient.
- [ ] Storno or cancel path deletes nothing and keeps the number.
- [ ] Integration tests on real PostgreSQL: concurrent confirmations (admin vs webhook vs duplicate webhook) give one invoice and one grant; parallel confirmations give contiguous, unique numbers; a rollback after numbering leaves no gap; rounding edge cases; readiness 503 (QA-015, QA-032, QA-033).
- [ ] Before live payments: checkout resume, late provider responses and signed webhooks verified in the provider's test mode, and seller settings confirmed real (OPS-060).
- [ ] Error codes, Invoicing section, CHANGELOG and launch-blocker list updated; open fiscal questions marked DECISION NEEDED.

## Pitfalls
- A native Postgres `SEQUENCE` leaves gaps: `nextval` is not rolled back when the transaction aborts (ENG-068).
- `MAX()+1` under SERIALIZABLE reads a snapshot taken before the lock was acquired, which yields duplicates or serialization failures (ENG-069).
- `pg_advisory_xact_lock` is held until commit, not released after the numbering query. Take it as the last lock, right before the final write, or every customer's confirmation queues behind slow work (ENG-068, ENG-012).
- Extracting VAT from a total (total / (1 + rate)) is off by a cent on some amounts; always compute it from the base (ENG-065).
- Reading the seller from settings at render time silently changes old invoices after an admin edit (ENG-067).
- A readiness 503 raised after closing the provider session cancels the customer's checkout; check readiness first (ENG-010).
- Marking a webhook event processed before the transaction commits loses the invoice when the commit fails (ENG-021).
- Answering a webhook that lost the race with 409 or 500 makes the provider keep retrying an event that is already settled (ENG-021, ENG-025).
- Stamping the issue date before taking the series lock lets number order and date order diverge.
- Emitting the "paid" event from a path whose conditional update returned 0 sends duplicate emails (ENG-026).
- Example seller values from the seed look valid; compare against them explicitly in the readiness check (OPS-027).
