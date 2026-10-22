---
name: ro-invoice
description: Use this skill when working on billing, invoices, mock_billing_orders, PDF invoice generation, VAT, or credit/subscription purchase flows in the marketplace-mobilier project.
---

# Facturare RO (mock) — reguli

Sursa: docs/03-business-rules.md sectiunea 4.17. Seller = platforma; clientul facturii = firma (abonamente + pachete credite).

- Numerotare: SERIE-NUMAR secvential, continuu, fara goluri — secventa dedicata per serie in DB (nu MAX()+1 in cod; foloseste secventa Postgres in tranzactia de emitere).
- Snapshot la emitere, imutabil dupa: seller_snapshot (denumire, CUI/CIF, J Reg.Com., sediu, IBAN din Admin Settings), vat_rate (21% din system_settings), datele clientului. Modificari ulterioare in settings NU ating facturile emise.
- Calcul: baza impozabila + TVA + total, moneda RON, rotunjire la 2 zecimale half-up; TVA calculat pe baza, nu extras din total.
- Continut PDF minim: serie+numar, data emiterii, furnizor complet, client (denumire+CUI), descriere serviciu (plan/pachet credite), baza, TVA, total. Limba dupa users.language_preference.
- Factura se emite DOAR la plata confirmata (PaymentsService.confirm, source admin sau webhook), in aceeasi tranzactie logica; emiterea e idempotenta pe paymentId.
- Storno/anulare: nu se sterge nimic — post-MVP se emite factura storno; in MVP marcheaza CANCELLED fara refolosirea numarului.
