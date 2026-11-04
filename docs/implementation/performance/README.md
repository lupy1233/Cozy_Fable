# Showroom performance evidence

## 2026-09-16 refined furniture — final measured tier

`showroom-overview-final.json` is the final follow-up run using the same host/browser/software-renderer method and the same named fixtures, now containing 56 / 582 derived furniture panels. It ran serially, without other browser verification running alongside it. These are still development/SwiftShader measurements, not physical-device or production FPS claims.

| Fixture / mode | Active rAF p50 / p95 | Draws/frame p95 | First house draw | Approx. JS heap |
|---|---:|---:|---:|---:|
| Small desktop | 16.7 / 33.3 ms | 31 | 1.78 s | 116 MB |
| Large desktop | 66.7 / 83.4 ms | 255 | 1.60 s | 148 MB |
| Small mobile emulation | 16.7 / 33.4 ms | 31 | 1.26 s | 116 MB |
| Large mobile emulation | 66.7 / 83.3 ms | 255 | 2.27 s | 139 MB |

All four samples pass the existing software-render budgets below; zero page errors. Draw calls improve from 60/553 to 31/255, but frame-time p95 is higher than the first implementation (16.8/66.7 ms desktop). More detailed geometry has a cost; this is **not** an across-the-board speedup claim. Large scenes are close to the software timing budget, and physical-device acceptance remains required.

Quality tiers are explicit: close-up piece editing keeps full bevel/cushion tessellation, procedural grain/weave, satin/textile materials, locally generated studio reflections and owned contact shadows. Room/house/firm overviews retain every bounded furniture part, with coarser roundover/cushion tessellation and matte lighting without microscopic texture/reflections. Static material batching preserves selection boundaries. Opening the piece editor/viewer reveals the detailed version.

The initial all-detailed trial failed (small p95 ~100 ms). Furniture-only reflections reduced that to 66.8 ms; removing close-up effects from house overview reduced small p95 to 33.4 ms but full tessellation still produced large p95 166.7 ms. The rejected/partial reports are retained as `showroom-refined.json`, `showroom-local-lighting.json`, `showroom-overview.json`, and `showroom-refined-final.json`; only `showroom-overview-final.json` is the final accepted four-sample run.

Closing each house context explicitly deleted every tracked geometry buffer, reaching zero live buffer bytes. Large overview geometry used about 15.7 MB in tracked buffers before close versus about 5 MB in the first implementation; batching plus local-coordinate attributes trades memory for fewer draw calls. The context released its shadow texture; four renderer-owned fallback textures remained until context loss. The separate detailed-editor edit/close/reopen probe records stable resource counts in `../screenshots/rendering-regression/results.json`.

---

## Original implementation checkpoint — 2026-09-15

Measured 2026-09-15 against the local Next **development** server on port 3100 with Chromium 153. The GPU renderer identified itself as **ANGLE / SwiftShader software rendering**. Desktop: 1440 × 1000, DPR 1. Mobile: Playwright Pixel 7 viewport/touch/DPR emulation. No CPU throttling. This is **not** physical-phone or production-build evidence. Other development processes were present on the host; frame timings are indicative rather than a hardware guarantee.

`measurements.json` is the implemented showroom before the shadow-cache optimization. `optimized.json` is after it. No original-app pre-change performance capture exists, so this is **not** an original-versus-redesign comparison.

## Named fixtures and results

Small: `../house-demo-fixture.json`, two connected rooms, five placed units (bed, table, bench, two nightstands), 50 furniture panels. Large: `large-house-fixture.json`, twelve rooms and fifty placed units, 510 furniture panels. Both are validated against the current shared schema before measuring. These exercise the capacity limit, not the maximum possible panel count for every cabinet configuration.

| Fixture / browser mode | Active rAF p50 / p95 after | p95 before cache | Draw calls/frame before → after | First whole-house draw after | JS heap after |
|---|---:|---:|---:|---:|---:|
| Small desktop | 16.7 / 16.8 ms | 33.4 ms | 118 → 60 | 1.38 s | 116 MB |
| Large desktop | 50.0 / 66.7 ms | 83.4 ms | 1094 → 553 | 1.74 s | 139 MB |
| Small mobile emulation | 16.7 / 33.4 ms | 33.4 ms | 118 → 60 | 1.61 s | 116 MB |
| Large mobile emulation | 66.6 / 66.8 ms | 83.4 ms | 1094 → 553 | 1.45 s | 131 MB |

The observer samples animation-frame intervals only when WebGL draw submission occurred during scripted camera orbit. This measures main-thread/render submission cadence, **not GPU timestamps**, exact FPS, or input-to-photon latency. First draw measures click-to-first-submitted-draw, not visual-complete paint. Heap is Chromium's approximate `performance.memory.usedJSHeapSize`, not retained heap after garbage collection.

Development resources were approximately 7.16 MB transferred / 31.35 MB decoded for desktop and 7.15 MB / 31.34 MB for mobile emulation, independent of fixture size. They include development modules; do not present them as production bundle size. Furniture materials are procedural and load no extra texture images.

## Resource lifecycle / bounded rendering

- All four optimized samples had zero page errors.
- Closing the small house canvas deleted all 194 tracked graphics buffers, returning that context to zero live buffer bytes; large deleted all 1750, also zero bytes. The remaining single-room canvas stayed mounted as intended. Context loss on teardown was observed.
- Whole-house buffer allocation was 496,208 bytes small / 4,956,696 bytes large. This counts WebGL vertex/index buffer allocations, **not** shadow textures, driver overhead or total GPU memory.
- Rounded-panel geometry uses one bevel segment; legs/rods use twelve radial segments; round tops use forty. Custom rounded geometries explicitly dispose on unmount/dimension replacement; ordinary declarative geometry/material cleanup belongs to React Three Fiber.
- Both canvases render on demand, and the whole-house DPR is capped at 1.5. Whole-house shadow maps are now cached during orbit and regenerated when room transforms, scene geometry, pieces or cutaway state change. This halves repeat draw submission without dropping shadows.

## Acceptance budgets

For these **named software-render regression fixtures**, use: zero page errors; zero live buffers for the closed house context; small p95 ≤ 40 ms and ≤ 70 draws/frame; large p95 ≤ 85 ms and ≤ 600 draws/frame; click-to-first-draw ≤ 3 seconds after the development route is warm; approximate heap ≤ 180 MB. All optimized samples pass. These limits are based on observed software rendering with modest timing headroom and must not be advertised as client-device quality targets.

Before release, separately run a production build on a representative real phone and desktop hardware: target active camera p95 ≤ 33.4 ms (30 FPS floor), verify touch latency and thermal behavior, inspect production resource transfer, and repeat open/close/edit cycles with a heap profiler. The large software-render fixture does **not** meet that physical-device target; hardware acceptance remains unverified, not waived. If real-device results fail, further candidates are geometry/material instancing and distance-based detail reduction.

Reproduce from repo root with bundled Node on PATH and the dev server running:

```powershell
$env:PERF_REPORT = 'rerun'
node tools/measure-studio-performance.mjs
```

The tool creates isolated guest browser contexts, uses only local fixture storage and intercepted guest API responses, writes a report after every completed sample, and does not publish any request.
