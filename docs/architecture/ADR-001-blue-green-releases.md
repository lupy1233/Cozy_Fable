# ADR-001: Blue/green releases on Railway

**Status:** Implemented; first production promotion completed 2026-09-16  
**Date:** 2026-09-16  
**Decider:** Product owner

## Context

The application currently runs Next.js, NestJS and every BullMQ processor in one Railway service. That service shares PostgreSQL, Redis and MinIO and runs Prisma migrations at startup. The production project currently has five services, which is the recorded free-plan limit.

Starting a second copy of the current container against production would immediately run migrations, register schedules and consume the same queues. Some releases also change durable outbox, payment and saved-project semantics, so arbitrary old/new workers cannot run together and an older binary is not automatically safe after the new version has accepted writes.

The desired workflow is one public stable release, one independently testable candidate, an explicit promotion, and a quick return to the prior release when compatibility allows it.

## Decision

Use one Railway production environment with shared PostgreSQL, Redis and MinIO, two application services named `app-blue` and `app-green`, and one small Caddy gateway that owns the public domain.

Only one application slot may be `DEPLOYMENT_MODE=active`. The inactive slot must use `DEPLOYMENT_MODE=standby` and `RUN_MIGRATIONS=false`. Standby serves previews and health checks, rejects HTTP mutations, registers no BullMQ processors or recurring schedulers, and cannot run migrations at container startup.

The gateway uses `ACTIVE_UPSTREAM` to route HTTP and WebSocket traffic to one private Railway service. Exact Blue/Green preview origins are allowlisted separately; wildcard CORS is forbidden. Promotion changes the old slot to standby, activates the candidate, verifies its release identity, then changes the gateway upstream. This creates a short write-only maintenance interval while reads remain available. It prevents incompatible worker generations from overlapping.

Database migrations are an explicit serialized release step. Rollback retains additive schema, outbox rows and payment checkpoints. A release is rollbackable only when the previous application can read every schema and persisted payload the candidate may have written.

Blue and Green are deployment slots, not separate codebases. Releases use one repository and immutable Git SHA/tag identities.

## Options considered

### Railway single-service deploy and deployment rollback

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | Lowest |
| Recovery | Fast while Railway retains the old image |
| Fit | Does not keep two independently testable production slots |

This remains a useful emergency mechanism, but image retention is plan-dependent and it does not solve candidate isolation or mixed workers.

### Two application slots plus stable gateway

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Requires more than the current five services |
| Recovery | Fast, explicit reverse handoff |
| Fit | Meets the requested stable/candidate workflow |

This is the selected design.

### Two complete Railway projects

| Dimension | Assessment |
|---|---|
| Complexity | High |
| Data safety | Poor for production switching |
| Isolation | Strong |

Independent databases diverge as soon as users write data. Cross-project access to one production database also loses private-network isolation. This remains suitable for staging, not as alternating production systems.

## Consequences

- A paid Railway plan or other capacity increase is required for `app-green` and the gateway.
- The public hostname, cookies, Stripe webhook and callback URLs remain stable at the gateway.
- Candidate previews cannot mutate production or consume production jobs.
- Promotions briefly reject writes while worker ownership moves between slots.
- UI-only and backward-compatible releases can roll back quickly. Schema, queue, auth or saved-format changes require an explicit compatibility gate and may require fixing forward.
- The database is never automatically restored during application rollback because external email/payment effects and newer user data cannot be undone safely that way.

## Action items

- [x] Add active/standby runtime validation and mutation guard.
- [x] Remove processors and recurring schedulers from standby registration.
- [x] Separate startup migration control from standby startup.
- [x] Expose slot, mode and SHA in health responses.
- [x] Add application and gateway Railway configuration.
- [x] Add read-only slot verification tooling and release runbook.
- [x] Upgrade Railway capacity and provision both application slots plus the gateway.
- [x] Preserve the existing public hostname on the gateway and verify the production promotion with isolated synthetic test records.
- [ ] Rehearse a full public reverse switch to the compatible standby and back.

Implementation update: Hobby capacity and both application slots are provisioned. To preserve the existing Railway public hostname without relying on domain transfer, the original `backend` service became the authoritative gateway. No custom domain was required. Production is Green active / compatible Blue standby; migration restore, worker handoff and backward reading were verified. Exact state and remaining reverse-switch rehearsal limit: [production promotion](../implementation/production-promotion-20260916.md).
