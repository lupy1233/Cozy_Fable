# Linux production-container verification

Scope: local build and isolated smoke testing of `Dockerfile.app`; no deployment, no credentials loaded from local `.env` files, no changes to existing development containers.

## Configuration review

- Combined app image pins Node 22 Bookworm by digest in both stages, uses pnpm 9.12.3 with the frozen lockfile, generates Prisma's Linux/OpenSSL client, and builds shared/backend/Next standalone artifacts.
- Runtime declares the non-root `node` user. Startup applies migrations, starts the backend on 3001 and frontend on the public port, and forwards termination signals.
- `.dockerignore` excluded the currently present backend `.env` and frontend `.env.local`; expanded it to exclude all `.env.*` variants except `.env.example` to cover future test/staging secret files too.
- CI runs serial verification, real-infrastructure tests, browser tests, Docker build and standalone artifact existence checks. Runtime HTTP checks below are additional local evidence, not a claim that CI itself was executed remotely.
- `docker compose -f dev-infra/docker-compose.prod.yml config --quiet` with all required secrets removed: **exit 1**, explicit required-variable rejection. With synthetic 64-character values supplied in the child process only: **exit 0**. The production compose stack was never started.
- MinIO initialization now reads credentials from quoted runtime environment variables instead of interpolating their contents into shell code. Database passwords may be URL-safe (for example random hex) with the default connection string; special-character passwords require an explicit `DATABASE_URL` override with a percent-encoded password, while `POSTGRES_PASSWORD` remains the raw database credential.

## Build and smoke evidence

Initial Linux application compilation succeeded, including shared TypeScript, Prisma generation, Nest build, Next lint/typecheck and all 75 prerendered routes. Next reported `/[locale]/studio` first-load JavaScript 244 kB and `/[locale]/requests/new` 442 kB. These compiler estimates are separate from measured HTTP payloads.

Initial image runtime smoke **passed** on 2026-09-15. The final frozen source, including the Studio login-return fix, also passed Linux compilation, lint/typecheck and all 75 prerendered routes. Its image export was stopped at the agreed **2 GiB free-space safety cutoff** (observed C: 1.94 GiB), after runtime packaging but before a completed final image load. Only the verified task build process was stopped. The existing tag still resolves to the intermediate second image `sha256:c9d76147ce58dce408fc95a5a6edcb5dc19bde52a497de81e2b5cd9df25c94e9`; it must not be represented as the certified final-source runtime image.

The final production-browser hydration and real PDF-generation probes are implemented but **not yet run against the final image**. They must pass after image export/load can finish with adequate disk headroom. Initial evidence is preserved as `container-smoke-initial-results.json`; `container-smoke-results.json` currently contains that same initial passing runtime result.

Cleanup was limited to exact, verified superseded cache records created by this implementation: first-build scratch (783.6 MB), first-image workspace copy (2.47 GB), and its 13 KB final-copy leaf. No broad Docker pruning, other-project cache removal, existing development-container shutdown, or personal-file deletion occurred. This reclaimed internal Docker capacity but did not restore Windows C: free space, which remained approximately 1.9 GiB. Further runtime mutations were stopped; the user was asked to free **8–10 GB on C:** before resuming final image export/load and smoke verification.

The reproducible harness is `tools/smoke-production-container.mjs` with `docs/implementation/container-smoke.compose.yml`. It refuses to reuse an existing smoke project, generates ephemeral secrets in memory, isolates PostgreSQL/Redis/MinIO/Mailpit on a new network, exposes only `127.0.0.1:3210`, checks pages/static assets/API/database persistence, and removes only its own containers/network/anonymous test volumes afterward.

The runtime report is `container-smoke-results.json`. It contains no secret values, access tokens or personal data.

- Image: `sha256:a402a2731a2b0fa3998fcb4dbccfb0dc11a1cb2cef591b88a703f79927e1f61c`, Linux/amd64, Docker-inspected size 853,497,118 bytes.
- Runtime: Node 22.23.2, Linux x64, UID 1000; Chromium 152.0.7977.82 available. Backend dist, Next standalone server/static folder present. Backend `.env` and frontend `.env.local` absent.
- Startup applied all **38 migrations** to a fresh isolated database. `/api/v1/health` returned HTTP 200 with database, Redis and storage all `up`.
- Anonymous draft creation returned **201**, and direct SQL confirmed **one persisted request**. This is stronger than an empty-schema health check alone.
- `/en`, `/ro`, `/en/studio`, `/en/requests/new`, all 24 referenced studio static assets, and all three new showroom atlases returned **200**.
- Smoke containers, dedicated network and anonymous test volumes were removed afterward. Existing development containers were not stopped or changed.

## Measured production payload (initial passing image)

| Resource | Decoded body | Encoded HTTP body |
|---|---:|---:|
| `/en/studio` HTML | 202,689 B | 58,668 B gzip |
| 23 JS assets referenced by its HTML | 1,015,755 B | 291,984 B combined |
| 24 referenced assets including CSS | 1,082,051 B | 305,300 B combined |
| `/en/requests/new` HTML | 181,228 B | 54,497 B gzip |

Asset enumeration includes shared scripts and the legacy no-module polyfill; a modern browser may not fetch every listed script. Conversely, this is **not** the full interactive 3D payload: lazy canvas chunks are not present in the initial HTML. Encoded counts cover response bodies, not HTTP headers. The report records every asset path, encoding and byte count for comparison.

Compact catalog serialization is **150,131 bytes English / 160,126 bytes Romanian** (source files 202,636 / 212,631 bytes). The full catalog is currently passed through the locale layout. Its size is material relative to initial HTML, so namespace reduction is a reasonable targeted follow-up; no routing/i18n refactor was performed from theory alone during this verification.

## Scoped runtime packaging change — 2026-09-16 (awaiting final build)

After the image-export disk cutoff, the approved packaging change replaces the complete `/app` runtime copy with explicit backend `dist`/package/migration artifacts, shared `dist`/package artifacts, and the existing backend/shared/root `node_modules` directories at their original paths. Next's standalone folder remains isolated under `/app/web`. Backend/shared source and the duplicate frontend build/cache tree no longer belong in the final runtime filesystem.

This is deliberately **not** dependency pruning. The exact installed pnpm store, Linux-generated Prisma client and Prisma migration CLI are preserved. Prisma is currently a development dependency but is required by `start-combined.sh`; blindly switching to `pnpm deploy --prod` would remove it. A future dependency-only slim image needs separate manifest/dependency-graph validation.

Static checks confirmed the local backend shared-package junction points to `packages/shared`, backend Prisma points into root `node_modules/.pnpm`, and shared Zod points into that same store. The Docker COPY layout preserves those relative runtime locations. Backend/shared source inspection found no filesystem asset reads requiring their original `src` folders. The final image now includes a non-root, network-free build assertion that resolves shared/Prisma/CLI and checks the generated outbox model. The smoke harness additionally checks that source/duplicate frontend folders are absent, resolves real dependency paths, runs Prisma CLI version, applies migrations, launches Chromium/PDF output and exercises HTTP/browser paths.

At inspection, the existing intermediate image's complete-workspace COPY layer was approximately **2.03 GB uncompressed**, plus another **190 MB** standalone copy. These are prior-image observations, not measured savings from the new Dockerfile. Windows C: had approximately **2.38 GiB** free and F: **412 GiB** free. A Docker archive exported directly to a task-specific location on F: may avoid loading another final image into C:, but does **not** relocate BuildKit scratch/cache or guarantee sufficient C: headroom. Preserve the **2 GiB C: cutoff** throughout any approved build/export. No Docker data-root move, broad prune or unrelated-service shutdown is authorized by this packaging change.

The revised packaging has not yet been built or runtime-smoked. Previous image results above remain explicitly intermediate evidence. Final build/export/load and smoke require the main coordinator's source-freeze approval and enough measured disk headroom.

## Current blocker — 2026-09-16 final handoff

Latest read-only diagnostics found about 7.9 GiB free on C:, but Docker/WSL is unavailable. Docker's host log records an externally initiated move from `C:\Users\Wolf\AppData\Local\Docker\wsl` to `E:\DockerDesktopWSL` failing because `docker_data.vhdx` was locked; the old setting was restored and a Settings not applied dialog was shown. Subsequent recovery reported `WSL_E_DISTRO_NOT_FOUND`. Docker version/WSL listing timed out; Docker API returned 500, MinIO/Mailpit health timed out and backend port 3001 refused connections.

No restart/reset, WSL unregister, storage move, image/volume cleanup or settings change was performed in this follow-up. User was asked whether the move is still in progress; otherwise dismiss the error and restart Docker Desktop, then confirm the engine is running. Do not factory-reset or delete its virtual disk. After recovery, verify engine/dependencies and available disk, then build the frozen refined sources once and run the isolated final browser/PDF/runtime smoke. The narrower COPY layout is unverified until that succeeds.
