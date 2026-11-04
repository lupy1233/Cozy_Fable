---
name: nestjs-module
description: Use this skill when creating or modifying a NestJS module, controller, service, DTO, guard, or BullMQ worker in apps/backend. Encodes the project layering and conventions so code matches the Product Bible without re-reading it.
---

# NestJS module conventions (marketplace-mobilier)

Structura per modul: `apps/backend/src/modules/<name>/` cu: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `dto/`, `guards/` (doar daca specifice), `events/` (payload types), `<name>.errors.ts` (coduri UPPER_SNAKE_CASE, exportate si in packages/shared/ERROR_CODES).

Reguli:
- Controller subtire: validare DTO + apel service. Zero logica business, zero acces Prisma, zero emit Socket.IO.
- Service: logica business; tranzactii prin prisma.$transaction; evenimente prin EventBusService.publish.
- Mutatii pe claim_slots: respecta pattern-ul SELECT FOR UPDATE (invarianta 3.1) — copiaza pattern-ul existent din claims.service, nu reinventa.
- Endpoint nou critic (bani/claim/accept) → adauga suport Idempotency-Key + rate limit throttler.
- Joburi: BullMQ, un queue per domeniu, handler idempotent, vizibil in /admin/jobs.
- Teste: unit pe service (mock Prisma), e2e minimal pe happy path + 1 edge case per endpoint.
- @Audit('domain.action') pe orice mutatie critica.
