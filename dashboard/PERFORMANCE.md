# Dashboard performance review

Checked on 2026-10-03 with production Vite builds, local HTTP and headless
Chromium at 1440×1100. The baseline was the staged dashboard before the
performance changes, using the same input catalogs. These measurements describe
this local run, not mobile hardware or the public zrok connection.

| Initial load | Before | After |
| --- | ---: | ---: |
| JSON bytes before HTTP compression | 125.55 MB | 5.68 MB |
| JavaScript heap after explicit GC | 85.52 MiB | 12.27 MiB |
| Largest observed startup main-thread task | 251 ms | 111 ms |

The remaining startup task includes React/MUI initialization and catalog indexing.
The measurements do not include native bitmap/GPU memory, and do not imply zero
browser overhead. Initial data now consists of the compact catalog index and
reference dictionary. Selecting an object loads one detail shard (256 shards,
about 0.48 MB each on average) instead of all three source datasets.

The map module/worker, footprint manifest, overlays and observatory photo stay
unloaded until used. Results remain virtualized and detail tables paginated.
Cutout fetching is gated by intersection with a 200 px viewport margin. Blob
URLs belong to the query cache, with cancellation and revocation after 60 seconds
inactive; detail shards expire after two minutes inactive.

Active footprint bitmaps are resized to 1024×512 (2 MiB RGBA per layer, versus
8 MiB at source resolution), reused across selection changes and explicitly
closed when deselected/unmounted. One composite texture is drawn during pan/zoom.
Pointer moves are batched into animation frames; native `Path2D` point geometry
is reused while panning. The selected-object pulse draws
only its small bounding region, at most 30 fps, and pauses when its point, map or
tab is not visible. Device pixel ratio is capped at 2.

WebP preserves footprint pixels and alpha losslessly. The observatory JPEG is
3.09 MB; its quality-85 WebP is 547 KB. The logo is displayed from a 352 px
lossless WebP (7.7 KB), avoiding the full 3839 px source decode. MinIO scientific
cutouts retain their source formats.

Validation included:

- Complete row/value/order comparisons against 44,951 literature records,
  31,527 consolidated records and 295,977 cutout metadata rows.
- All 31,569 unique summaries and record/image counts; source coordinate
  selection and filter domains remain unchanged.
- Lossless alpha and visible-pixel comparison for all 56 converted overlays.
- Production browser checks on desktop/mobile: all 28 layers, outline/area
  toggles, map ratio/projection, zoom/reset, hidden point and lazy photo.
- Production image tests with intercepted image responses: viewport loading,
  cached remounts, blob revocation, bitmap reuse and cleanup. Network performance
  of the external MinIO/zrok service was not inferred from those tests.
- Real-time animation checks: 30 frames/s for a visible map, 0 frames/s for a
  fully offscreen map.
- At the time of the original performance review: `npm test`, TypeScript/Vite
  build and lint (no errors; 8 existing `any` warnings).

The exporter regression tests run with `npm test`; `npm run build` regenerates
browser data from the local source JSON automatically. Deployment still obtains
those sources through `prepare_data.py` before building.

## Build modernization verification

Also checked on 2026-10-03 after upgrading React 19, Material UI 9, Vite 8,
ESLint 10 and TypeScript 6 on Node 24. A clean `npm ci` succeeds and
`npm run check` now reports zero lint warnings. The production bundle built
in 1.89 seconds in one local run; this is a build observation, not a browser
performance benchmark. Its entry chunk is 462 KB (141 KB gzip); map, tables,
cutouts and observatory dialog remain separate lazy chunks.

Repeated production browser checks passed for desktop/mobile layers, the hidden
photo, image cache/URL cleanup and bitmap reuse. Keyboard slider changes,
filter reset, search and Enter selection were also exercised. The visible pulse remains at
30 frames/s and stops fully offscreen. The isolated CI fixture build also passed
Pages path, 256-shard, WebP and source-dataset omission checks. The earlier heap
and main-thread measurements above were not remeasured for this dependency
upgrade. The Python 3.14/pandas 3 exporter passes its CSV/Parquet integration test
without MinIO access.
