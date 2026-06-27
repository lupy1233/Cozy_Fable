# Backend (NestJS + Prisma) — reguli locale

Inainte de a scrie cod aici, citeste `docs/02-technical-invariants.md` (obligatoriu) si sectiunea relevanta din `docs/03-business-rules.md`.

- Claim si orice operatie care schimba nr. de claim_slots active: tranzactie Serializable + SELECT FOR UPDATE pe requests (invarianta 3.1). Timeout 10s.
- POST critice (claim, accept quote, create quote, webhook payment, credits purchase): header Idempotency-Key + tabel idempotency_keys (3.2).
- Datetime: TIMESTAMPTZ UTC in DB; business calendar Europe/Bucharest; SLA materializat in sla_deadline_at, recalculat via worker (3.3). Ceasuri scurte (30min/1h/12h/48h) = ore calendaristice.
- Fisiere: DOAR presigned URLs prin StorageService (MinIO dev / S3 prod). Niciodata servite prin endpoint Nest (3.4).
- Evenimente: DOAR prin EventBusService.publish — controllerele NU emit Socket.IO direct (3.5).
- Erori: format unic { error: { code, message, details, timestamp, traceId } }, coduri UPPER_SNAKE_CASE din packages/shared/ERROR_CODES.
- DTO-uri cu class-validator, ValidationPipe global whitelist+forbidNonWhitelisted. Guards: Auth, Roles, CompanyApproved, SubscriptionActive, TwoFactor(no-op flag off).
- Audit: @Audit('action') pe actiuni critice; audit_logs append-only (trigger DB). Niciodata parole/token-uri/continut mesaje in audit.
- Enum-uri si nume de coloane: VERBATIM din docs/04-data-model.md.
