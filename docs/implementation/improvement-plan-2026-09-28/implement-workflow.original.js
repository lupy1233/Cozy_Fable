export const meta = {
  name: 'implement-approved-sprints',
  description: 'Implement the 32 approved improvement packages sprint by sprint: plan -> implement -> verify per package, security-close + CHANGELOG per sprint',
  phases: [
    { title: 'Sprints', detail: 'sequential sprints; parallel only for packages with disjoint files' },
  ],
}
const PLAN = args.planPath
const REPO = 'F:\\Cozy Fable'
const REPO_SH = '/f/Cozy\\ Fable'

// ordinea sprinturilor si grupurile paralele (fiecare grup = array de secvente; o secventa = pachete rulate unul dupa altul)
const SPRINTS = [
  { n: 1, name: 'Sprint 1 - Stop fee-dodging after acceptance (P0)', groups: [[ 'E-company-1', 'E-admin-platform-3' ]] },
  { n: 2, name: 'Sprint 2 - Real email and legal identity (P0)', groups: [[ 'E-admin-platform-1' ], [ 'E-admin-platform-2' ]] },
  { n: 3, name: 'Sprint 3 - Legal invoicing and firm terms', groups: [[ 'E-admin-platform-4' ], [ 'E-company-9' ]] },
  { n: 4, name: 'Sprint 4 - Production safety net', groups: [[ 'E-admin-platform-6' ], [ 'E-admin-platform-8' ]] },
  { n: 5, name: 'Sprint 5 - Offer concurrency and three competing offers', groups: [[ 'E-company-2', 'E-admin-platform-10' ]] },
  { n: 6, name: 'Sprint 6 - Informed accept and guarded firm actions', groups: [[ 'E-client-1' ], [ 'E-company-6' ]] },
  { n: 7, name: 'Sprint 7 - Client publish and repost reliability', groups: [[ 'E-client-2', 'E-client-3' ]] },
  { n: 8, name: 'Sprint 8 - Abuse and fraud hardening', groups: [[ 'E-admin-platform-5' ], [ 'E-company-3' ]] },
  { n: 19, name: 'Sprint 19 - Fair deadlines and pre-loss warnings', groups: [[ 'E-admin-platform-25' ], [ 'E-admin-platform-44', 'E-company-13' ]] },
  { n: 20, name: 'Sprint 20 - Pre-claim privacy', groups: [[ 'E-admin-platform-45', 'E-client-9' ]] },
  { n: 21, name: 'Sprint 21 - Money-path tests and transaction policy', groups: [[ 'E-admin-platform-14' ], [ 'E-admin-platform-54' ]] },
  { n: 22, name: 'Sprint 22 - Settle-once credits and credit rules', groups: [[ 'E-admin-platform-15', 'E-company-21' ]] },
  { n: 23, name: 'Sprint 23 - Invoice and payment correctness', groups: [[ 'E-company-22' ], [ 'E-company-19', 'E-company-24' ]] },
  { n: 73, name: 'Sprint 73 - Pricing data model (P3)', groups: [[ 'E-admin-platform-58' ]] },
  { n: 74, name: 'Sprint 74 - Perimeter and supply chain (P3)', groups: [[ 'E-admin-platform-56' ]] },
  { n: 75, name: 'Sprint 75 - Design primitives and tokens (P3)', groups: [[ 'E-admin-platform-57' ]] },
  { n: 76, name: 'Sprint 76 - Collections into requests (P3)', groups: [[ 'E-client-34' ]] },
]
// modelul de implementare per pachet (planificarea, verificarea si inchiderea = opus)
const SONNET = new Set(['E-admin-platform-2', 'E-company-9', 'E-company-22', 'E-admin-platform-57', 'E-client-34'])
const implModel = id => (SONNET.has(id) ? 'sonnet' : 'opus')

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    modules: { type: 'array', items: { type: 'string' } },
    tables: { type: 'array', items: { type: 'string' } },
    files: { type: 'array', items: { type: 'string' } },
    migration_needed: { type: 'boolean' },
    assumptions: { type: 'array', items: { type: 'string' } },
    decisions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, resolved_by_docs: { type: 'boolean' }, chosen_default: { type: 'string' }, why_safe: { type: 'string' }, needs_po: { type: 'boolean' } }, required: ['question', 'resolved_by_docs', 'chosen_default', 'why_safe', 'needs_po'] } },
    brief: { type: 'string' },
    verification: { type: 'array', items: { type: 'string' } },
    skipped_findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'] } },
  },
  required: ['summary', 'modules', 'tables', 'files', 'migration_needed', 'assumptions', 'decisions', 'brief', 'verification', 'skipped_findings'],
}
const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    changed_files: { type: 'array', items: { type: 'string' } },
    migrations: { type: 'array', items: { type: 'string' } },
    i18n_keys_added: { type: 'number' },
    tests_added: { type: 'array', items: { type: 'string' } },
    what_works_now: { type: 'array', items: { type: 'string' } },
    not_done: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, reason: { type: 'string' } }, required: ['item', 'reason'] } },
    decisions_needed: { type: 'array', items: { type: 'string' } },
  },
  required: ['changed_files', 'migrations', 'i18n_keys_added', 'tests_added', 'what_works_now', 'not_done', 'decisions_needed'],
}
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    typecheck: { type: 'string' }, lint: { type: 'string' }, tests: { type: 'string' },
    done_when: { type: 'array', items: { type: 'object', properties: { check: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail', 'not-testable'] }, how: { type: 'string' } }, required: ['check', 'result', 'how'] } },
    fixes_made: { type: 'array', items: { type: 'string' } },
    remaining_issues: { type: 'array', items: { type: 'string' } },
    changed_files: { type: 'array', items: { type: 'string' } },
  },
  required: ['typecheck', 'lint', 'tests', 'done_when', 'fixes_made', 'remaining_issues', 'changed_files'],
}
const CLOSE_SCHEMA = {
  type: 'object',
  properties: { security_findings: { type: 'array', items: { type: 'string' } }, fixes_made: { type: 'array', items: { type: 'string' } }, changelog_added: { type: 'boolean' }, commit_message: { type: 'string' }, decisions_needed: { type: 'array', items: { type: 'string' } } },
  required: ['security_findings', 'fixes_made', 'changelog_added', 'commit_message', 'decisions_needed'],
}

const COMMON = [
  'Repo: ' + REPO + ' (Git Bash: ' + REPO_SH + '). Monorepo: apps/backend (NestJS + Prisma + Postgres + BullMQ), apps/frontend (Next.js 15 App Router, next-intl 4, messages in apps/frontend/src/messages/ro.json and en.json - keep RO/EN parity, diacritics in RO, product says "firma" never "atelier"), packages/shared (zod, types, ERROR_CODES). Working tree has ~290 uncommitted files: they ARE the product. Branch main.',
  'Local stack is running: Postgres/Redis/MinIO/Mailpit in Docker, backend dev server on http://localhost:3001 (nest --watch), frontend on http://localhost:3000. Demo accounts (local only) with password Cozydemo2026: client ana.popescu@demo.ro, firm owner owner.a@demo.ro (A Mobila Premium, GOLD active), admin admin@demo.ro. Never use these against any non-localhost host.',
  'HARD RULES: never run git commit/push/stash/checkout/reset; never delete or rewrite files you did not need to touch; never edit apps/backend/.env; never touch docs/07-decisions-log.md decisions (FINAL) or reopen them; do not change prices or business numbers unless docs/03 or docs/07 already say so. Migrations: `prisma migrate dev` has no TTY here - create the migration folder manually (apps/backend/prisma/migrations/<timestamp>_<name>/migration.sql, generate SQL with `pnpm -F backend exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <DATABASE_URL>` or write it by hand) then apply with `pnpm -F backend prisma migrate deploy` and run `pnpm -F backend prisma generate`. Build shared before frontend typecheck (`pnpm -F shared build` if the package has a build script). Comments in code: Romanian without diacritics, only where they help.',
  'Sources of truth: docs/02-technical-invariants.md (non-negotiable), docs/03-business-rules.md, docs/04-data-model.md, docs/07-decisions-log.md (FINAL decisions), docs/STATE_CONVENTIONS.md; the technical map in the Obsidian vault E:\\CozyFableObsidian\\CozyFableCodex (Git Bash /e/CozyFableObsidian/CozyFableCodex): read the module notes and the "50 Impact" playbook that match your package BEFORE editing (e.g. "IMPACT schema Prisma", "IMPACT endpoint nou", "IMPACT enum de status", "IMPACT credite", "IMPACT accept si claim", "IMPACT text UI", "IMPACT eveniment nou"). Project skills exist in F:\\Cozy Fable\\.claude\\skills (nestjs-module, prisma-migration, ui-component, bullmq-worker, ro-invoice, security-close): read the SKILL.md of the ones matching your layer before writing code.',
  'The plan file ' + PLAN + ' holds every approved package (id, headline, steps, done_when, decision_needed, findings with description/proposed_fix/evidence). Read it with a read-only command and pick your package by id.',
].join('\n\n')

function planPrompt(id, sprint) {
  return [
    COMMON,
    'ROLE: sprint planner for package ' + id + ' in "' + sprint.name + '". Produce the implementation plan the sprint-delivery contract asks for (modules, tables, files, assumptions, migration?) and a detailed brief for the implementer.',
    'Steps: (1) read the package from the plan file; (2) read the matching Codex notes + IMPACT playbooks + docs sections; (3) read the current code of every file you intend to change; (4) for the package\'s decision_needed and any decision hidden in the findings: search docs/03 and docs/07 - if they already decide it, mark resolved_by_docs=true and follow it; if not, choose the SAFEST default that does not lock in a business policy (a system_settings key with a conservative value, a feature flag, or leaving the rule untouched while fixing the bug) and mark needs_po=true with the exact question. Never invent prices, durations or refund policies that are not in docs. (5) Write the brief: exact files, functions, DTO/zod changes, migration SQL sketch, i18n keys (RO+EN), tests to add, in execution order, with the acceptance checks from done_when translated into concrete verification commands (curl against http://localhost:3001/api/v1 with the demo accounts, jest specs, or reading the DB). List findings you deliberately skip with a reason (only if truly out of scope or blocked by a PO decision).',
  ].join('\n\n')
}
function implPrompt(id, plan) {
  return [
    COMMON,
    'ROLE: implementer for package ' + id + '. Execute the brief below completely: edit the files, add migrations/i18n/tests, keep the code style of neighbouring files, keep RO/EN parity. Run `pnpm typecheck` and `pnpm lint` at the end (and the jest specs you touched with `pnpm -F backend test -- <pattern>`); fix what you broke. Do not stop at the first hard part: finish every step or report it precisely in not_done with the reason. Report changed_files with repo-relative paths.',
    'PLAN:',
    JSON.stringify(plan, null, 1),
  ].join('\n\n')
}
function verifyPrompt(id, pkg, plan, impl) {
  return [
    COMMON,
    'ROLE: verifier for package ' + id + ' (independent from the implementer). (1) Run `pnpm typecheck`, `pnpm lint`, `pnpm -F backend test` (full backend suite; if it is too slow, at least every spec under the touched modules) and `pnpm -F frontend test` if a frontend test script exists. (2) Check every "done when" item below against the running local stack: log in with curl (POST /api/v1/auth/login, cookie jar) as the right demo account and call the endpoints, or read the DB through `docker exec marketplace-mobilier-postgres-1 psql -U <user from apps/backend/.env DATABASE_URL> -d marketplace -c "..."`; the backend restarts automatically on file changes (wait for it). Note: logging in with curl revokes any browser session of the same account - that is expected. (3) Review the diff of the changed files (`git diff -- <files>`; untracked files with `git status`) for bugs, missing RO/EN keys, missing guards, unhandled errors. (4) FIX small problems yourself (typecheck/lint failures, missing keys, obvious bugs) and re-run; report bigger ones in remaining_issues. Never run git commit.',
    'DONE WHEN: ' + JSON.stringify(pkg.done_when),
    'PLAN VERIFICATION STEPS: ' + JSON.stringify(plan.verification),
    'IMPLEMENTER REPORT: ' + JSON.stringify(impl, null, 1),
  ].join('\n\n')
}
function closePrompt(sprint, reports) {
  return [
    COMMON,
    'ROLE: sprint closer for "' + sprint.name + '". Inputs: the package reports below (files changed, what works, not done, decisions).',
    '(1) Run the security-close checklist from F:\\Cozy Fable\\.claude\\skills\\security-close\\SKILL.md over the diff of ALL changed files of this sprint (`git diff -- <files>` plus new untracked files): authz on new endpoints, input validation, idempotency on money mutations, audit on critical ops, no PII in logs, no secrets, soft-delete filters, i18n parity (run a node one-liner diffing keys of ro.json vs en.json). Fix what you find; list what you fixed and what remains. (2) Run `pnpm typecheck` and `pnpm lint` once more. (3) Append a CHANGELOG.md entry at the TOP of the file (below the "# CHANGELOG" heading), in Romanian without diacritics like the existing entries, titled "## Sprint ' + sprint.n + ' (plan 2026-09-28): ' + sprint.name.replace(/^Sprint \d+ - /, '') + ' — ' + (args.today || '2026-09-29') + '": objective, impact (backend/frontend/DB/realtime/securitate/audit), files, manual test plan (3-6 bullets), acceptance checklist (checkbox lines, ticked only for what the verifier passed), DECIZIE NECESARA list, and "Ramas" (not done). (4) Propose (do NOT run) the commit command as commit_message: a conventional summary line plus a short body; end the body with "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>".',
    'PACKAGE REPORTS: ' + JSON.stringify(reports, null, 1),
  ].join('\n\n')
}

const results = []
for (const sprint of SPRINTS) {
  phase(sprint.name)
  log('Starting ' + sprint.name)
  const groupResults = await parallel(sprint.groups.map(seq => async () => {
    const out = []
    for (const id of seq) {
      const plan = await agent(planPrompt(id, sprint), { model: 'opus', label: 'plan:' + id, phase: sprint.name, schema: PLAN_SCHEMA, effort: 'high' })
      if (!plan) { out.push({ id, error: 'planner unavailable' }); continue }
      const impl = await agent(implPrompt(id, plan), { model: implModel(id), label: 'impl:' + id, phase: sprint.name, schema: IMPL_SCHEMA, effort: 'high' })
      if (!impl) { out.push({ id, plan, error: 'implementer unavailable' }); continue }
      const pkgDone = { done_when: (plan.verification || []) }
      const verify = await agent(verifyPrompt(id, pkgDone, plan, impl), { model: 'opus', label: 'verify:' + id, phase: sprint.name, schema: VERIFY_SCHEMA, effort: 'high' })
      out.push({ id, plan: { summary: plan.summary, modules: plan.modules, tables: plan.tables, decisions: plan.decisions, assumptions: plan.assumptions, skipped_findings: plan.skipped_findings }, impl, verify })
      log(id + ': ' + (verify ? ('typecheck ' + verify.typecheck + ' | tests ' + verify.tests + ' | issues ' + verify.remaining_issues.length) : 'verify unavailable'))
    }
    return out
  }))
  const reports = groupResults.filter(Boolean).flat()
  const close = await agent(closePrompt(sprint, reports), { model: 'opus', label: 'close:S' + sprint.n, phase: sprint.name, schema: CLOSE_SCHEMA, effort: 'high' })
  results.push({ sprint: sprint.name, packages: reports, close })
  log('Closed ' + sprint.name)
}
return { sprints: results }
