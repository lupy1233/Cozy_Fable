# Claude workspace kit

The rules and skills behind how Claude is set up to work, taken out of a real project and made app-neutral so you can reuse them in any new app. It holds no business logic, entities, names or data from the original app.

- **770 rules** across 11 chapters, each with an ID (e.g. `ENG-004`), a strength tag (`MUST`, `MUST NOT`, `SHOULD`, `AVOID`, `GOTCHA`) and the reason behind it.
- **16 skills**: 10 core, 5 stack-specific, 1 optional.
- **Templates** for a new repo: `CLAUDE.md`, the source-of-truth doc set, `CHANGELOG.md`, `.claude/settings.local.json`, `.claude/launch.json` and `.claudeignore`.
- **User-level setup**: `~/.claude/settings.json` (model, effort, plugins) and the `/founder:*` commands.

## Install

From this folder, in PowerShell:

```powershell
.\install.ps1 -Target "D:\my-new-app"                     # core workspace
.\install.ps1 -Target "D:\my-new-app" -Stack              # + NestJS / Prisma / Next.js pack
.\install.ps1 -Target "D:\my-new-app" -Stack -Optional    # + optional skills (Romanian invoicing)
.\install.ps1 -UserLevel                                  # ~/.claude settings + founder commands (new machine only)
```

Add `-WhatIf` to preview. Existing files are never lost: they are moved to `<target>\.claude\kit-backup-<timestamp>\` first.

Then, in the new repo:
1. Fill the `<PLACEHOLDERS>` in `CLAUDE.md` and `docs\*.md` (search for `<`). Or ask Claude to run the **workspace-bootstrap** skill, which walks you through it.
2. `Copy-Item CLAUDE.md AGENTS.md -Force`. AGENTS.md must stay a byte-identical mirror for non-Claude agents.
3. Delete anything that does not fit the new app, such as rules for features it won't have (realtime, uploads, payments, 3D). The chapters are references; `CLAUDE.md` is what Claude loads every session.

## What gets installed where

| Kit path | Goes to (in the new repo) | What it is |
|---|---|---|
| `project-template/CLAUDE.md` | `CLAUDE.md` + `AGENTS.md` | Global rules, loaded every session (~70 lines) |
| `project-template/docs/*` | `docs/` | Skeletons of the source-of-truth set: 01 vision & stack, 02 technical invariants (with generic defaults), 03 business rules, 04 data model, 05 master prompt & sprints, 06 seed scenarios, 07 decisions log, 08 deployment, ERROR_CODES, STATE_CONVENTIONS |
| `project-template/CHANGELOG.md` | `CHANGELOG.md` | Entry templates (plan sprint, feedback round) |
| `project-template/.claude/*` | `.claude/` | Core skills, permission allowlist, preview-pane launch config |
| `rules/*.md` | `docs/workspace-rules/` | The full rulebook (see below) |
| `stack-pack/*` (`-Stack`) | `.claude/skills/`, `apps/backend/CLAUDE.md`, `apps/frontend/CLAUDE.md`, `docs/STACK-RULES.md` | Conventions for NestJS + Prisma + BullMQ + Next.js App Router + TanStack Query + next-intl + shadcn/ui + R3F |
| `optional/skills/*` (`-Optional`) | `.claude/skills/` | Romanian fiscal invoicing (VAT, numbering, credit notes) |
| `user-level/*` (`-UserLevel`) | `~/.claude/` | Model and effort preferences, enabled plugins, `/founder:*` commands |

## Rulebook

| Chapter | IDs | Rules | Covers |
|---|---|---|---|
| 01 Working method | WM | 30 | No guessing, the `DECISION NEEDED` gate, read only what is relevant, subagents for research, faithful reporting, no commit/push/deploy without approval, what to keep on compaction |
| 02 Sources of truth & precedence | SOT | 46 | The doc set, precedence (invariants > decisions log > business rules), final decisions, enums used verbatim, docs-first rule changes |
| 03 Sprint & delivery protocol | DEL | 37 | Sprint 0 design review, declaring scope before work, the output contract, the CHANGELOG + acceptance checklist after work, the "Remaining" list, checkpoint commits, large programs |
| 04 Engineering patterns | ENG | 126 | Locking for limited-capacity operations, idempotency keys, UTC + business calendar, deadline jobs, presigned storage, outbox/events, state machines, integer money, the error envelope, soft delete, append-only audit |
| 05 Quality gates & verification | QA | 84 | Gate order, real-DB tests behind a guard, CI, browser verification, acceptance evidence, seed data as test scripts |
| 06 Security baseline | SEC | 109 | Auth cookies, guards and ownership, rate limits, secrets, uploads, CSP, audit hygiene, the security-close checklist, no fabricated public claims |
| 07 Working with the product owner | PO | 44 | Feedback rounds turned into sprint docs, dated decisions, a terminology glossary, copy rules, status-report format |
| 08 Memory & knowledge vault | MEM | 27 | Claude memory conventions, an external knowledge vault (module notes, concepts, IMPACT playbooks) read before changes and updated after |
| 09 Release & operations | OPS | 99 | Containers, migrations at boot, blue/green promotion and rollback, prod data ops without secrets in chat, backups and restore rehearsal, uptime monitoring |
| 10 Environment & tooling gotchas | ENV | 52 | Windows + PowerShell 5.1 + Git Bash, pnpm, Prisma CLI without a TTY, CRLF, the Claude preview pane quirks, Docker |
| STACK-RULES (stack pack) | STK | 116 | NestJS / Prisma / BullMQ / Next.js / TanStack / Zustand / RHF + Zod / next-intl / Tailwind + shadcn / R3F |

IDs are stable but not contiguous: gaps are rules that were merged or removed during review. Rules cite each other by ID, and every reference resolves.

## Skills

**Core** (any stack), in `project-template/.claude/skills/`:

| Skill | Use when |
|---|---|
| `sprint-delivery` | Planning, implementing or closing a sprint ("sprint", "implementeaza", "inchide sprintul") |
| `decision-gate` | A requirement is missing, ambiguous or conflicts with an invariant or decision ("DECIZIE NECESARA", "am decis") |
| `security-close` | Closing a sprint, before a commit or deploy, on a security review request |
| `seed-scenarios` | Seed scripts, demo data, fixtures, one-off data scripts |
| `po-feedback-round` | The owner sends a batch of feedback or change requests to turn into work |
| `ui-browser-verify` | Before reporting any UI/copy change done ("verifica in browser", "pe mobil") |
| `knowledge-vault` | Impact check before changing a module; vault update after a sprint |
| `audit-to-plan` | Full audit / launch readiness → verified findings → prioritized plan → owner approval → execution |
| `release-rollout` | Deploy, promote, roll back, change prod config (only on explicit request) |
| `workspace-bootstrap` | Starting a new project with this kit |

**Stack pack**, in `stack-pack/.claude/skills/`: `nestjs-module`, `prisma-migration`, `bullmq-worker`, `ui-component`, `i18n-copy-change`.

**Optional**, in `optional/skills/`: `ro-invoice`.

Skill bodies are in English. The trigger descriptions also contain the Romanian phrases you usually type, so the skills activate on either language.

## Notes

- The kit was distilled by a multi-agent pass over the original workspace: its CLAUDE.md files, 8 project skills, Claude memory, process docs, audits, the changelog, the code and the knowledge-vault playbooks. App-specific rules were either generalized into the pattern behind them or dropped. Every chapter and skill then got an adversarial review against its sources and for app leakage, and a final grep sweep.
- Some rules are tuned to this user's setup: Windows + PowerShell, the Claude desktop preview pane, and Railway as an example host. Drop the ones that don't apply.
- `user-level/settings.json` enables these plugins: code-review, claude-code-setup, frontend-design, karpathy-skills and i-have-adhd. Plugins install on the next Claude Code start.
- `project-template/.claude/settings.local.json` still pre-allows two broad entries, `docker compose:*` and `PowerShell(pnpm *)`. Narrow them if you want tighter permissions.
