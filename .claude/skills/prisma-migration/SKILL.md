---
name: prisma-migration
description: Use this skill whenever creating or modifying the Prisma schema, generating or editing migrations, adding tables/columns/enums/indexes, or writing Prisma middleware for the marketplace-mobilier project. Schema mistakes are the most expensive class of error in this repo.
---

# Prisma schema & migrations — reguli

Inainte de orice schimbare de schema: citeste docs/04-data-model.md. Numele de tabele, coloane si enum-uri se folosesc VERBATIM (snake_case via @@map/@map).

Reguli dure:
- NU edita o migratie deja aplicata. Schimbare noua = migratie noua. Fiecare migratie are o nota de rollback in mesajul de commit.
- Orice tabel cu PII primeste deleted_at TIMESTAMPTZ nullable + anonymized_at unde e cazul; verifica acoperirea in middleware-ul global de soft delete (WHERE deleted_at IS NULL).
- audit_logs: append-only. Migratia care il creeaza adauga trigger BEFORE UPDATE OR DELETE → RAISE EXCEPTION. Nu adauga niciodata UPDATE/DELETE pe el in cod.
- Snapshot columns (project_size_snapshot, project_score_snapshot, claim_cost_credits_snapshot, seller_snapshot, vat_rate) se scriu O DATA la momentul evenimentului si nu se mai ating.
- Constraint-uri din Bible care NU se omit: UNIQUE partial pe assigned_to_user_id WHERE status='ACTIVE' AND quote_id IS NULL; max 3 claim_slots active enforce in tranzactie (nu doar in cod); praguri project_size_thresholds fara suprapunere (validare la admin endpoint).
- Toate datetime = TIMESTAMPTZ. Bani/credite = NUMERIC sau INT (credite), niciodata FLOAT.
- Index minim pe: FK-uri folosite in filtre, requests(address_lat, address_lng), penalty_events(expires_at), claim_slots(sla_deadline_at), idempotency_keys(key, endpoint).
- Dupa migrare: pnpm -F backend prisma migrate dev, regenereaza clientul si ruleaza typecheck inainte de a continua.
