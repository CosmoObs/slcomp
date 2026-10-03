# LaStBeRu Dashboard

Interactive dashboard for exploring astronomical lens data.

## Features
* Sky map
* Filtering
* Data & consolidated parameter tables
* Image cutout gallery

## Quick Start
```bash
npm install
npm run dev      # http://localhost:5173
```

## Data Files (place in `public/data/`)
| File | Purpose |
|------|---------|
| `database.json` | Main dataset |
| `consolidated_database.json` | Consolidated dataset |
| `cutouts.json` | Image cutout metadata |
| `dictionary.json` | Reference dictionary |

`npm run dev` and `npm run build` generate `catalog.json` and
`objects/<bucket>.json` from these source files. The compact index carries only
the search/map summary and record/image counts; 256 deterministic shards preserve
all original detail rows and their order. A selected object loads its shard on
demand, with a two-minute inactive cache. The three large source datasets are
omitted from `dist/`; `dictionary.json` remains available for reference filters.
No MinIO credentials or network requests are needed by this export step.

## Theming
Edit `src/theme.ts` (palette, breakpoints, shadows, transitions).


## Scripts
```bash
npm run dev    # Start dev server
npm run build  # Production bundle
npm run lint   # ESLint
npm test       # Export/provenance regression tests
```

## Deployment (GitHub Pages)
When deploying to `https://<user>.github.io/<repo>/` you must build with the correct base path so that static JSON (in `public/data/`) and bundled assets resolve properly.

```bash
# Example for this repository if the dashboard lives at /slcomp/
export BASE_PATH=/slcomp/
npm run build
```

Then publish the contents of `dist/` to the `gh-pages` branch (or use an action). The data loader code uses `import.meta.env.BASE_URL` to construct paths like `<BASE_URL>data/database.json`, avoiding the common `Unexpected token '<'` JSON parse error that happens when a 404 HTML page is fetched instead of the JSON file.

If you see that error after deployment, confirm:
1. The JSON files exist in `dist/data/` (they are copied from `public/data/`).
2. `BASE_PATH` matched the repository subpath and ends with a trailing slash.
3. Browser network panel requests resolve to `200` and not `404`/`301`.


## Sky coverage layers

The map's **Layers** menu groups 28 MOC overlays into imaging surveys,
photometry and spectroscopy, with independent survey toggles. Layers start off
and use bright outlines by default; the menu also offers an area view at 45%
opacity. They do not filter catalog objects, and share the map's pan/zoom transform.
Lossless WebP overlays retain transparency. Only active layers are loaded; decoded
bitmaps are sized to 1024×512, reused while selected, and explicitly released on
deselection/unmount. Selected layers are composited once so each pan/zoom draws
one texture. The pulse uses a small drawing region at at most 30 fps, pauses
outside the viewport or in a hidden tab, and stops if the selected point is off
screen. Canvas pixel ratio is capped at 2.

The versioned files in `public/footprints/` render the executable MOC definitions
from `notebooks/footprints/footprints.ipynb`, including its `.extended()` operations.
Labels follow the actual loaded releases, rather than the notebook's prose.
These are visualizations of catalog/HiPS MOC coverage, not exact survey selection
functions. Display masks at 2048×1024 use disk closing (12 px), a small buffer
(3 px), and Gaussian smoothing (sigma 3 px) to join nearby fragments and round
contours. Smoothing is applied only to the display assets, clipped to the sky
ellipse; source MOCs, their sky fractions and catalog data remain unchanged.
`manifest.json` records source identifiers, input SHA-256, MOC order, sky fraction
generation time and display smoothing parameters. Network services are only needed during regeneration:

```bash
pip install -r requirements-footprints.txt
python prepare_footprints.py
# Reuse all previously downloaded FITS without contacting CDS:
python prepare_footprints.py --offline
```

Raw downloaded FITS remain in the ignored `.cache/footprints/`; local HSC and
DELVE FITS are read from the notebook's directory. A failed source download or
empty rendered mask aborts regeneration; retain the previously published assets.
Regular npm/GitHub Pages builds copy the versioned overlays without running this
script or adding Python dependencies.

## Image loading

Cutout requests begin within 200 px of the viewport. React Query owns blob URLs,
reuses them without refetching while cached, aborts abandoned fetches, and revokes
URLs when inactive queries expire after 60 seconds. The scientific cutouts in
MinIO retain their source format. The observatory photo is a lazy WebP asset;
only its WebP is stored in `.extras/`. The header uses a 352 px lossless
WebP logo rather than decoding the 3839 px original.

See [PERFORMANCE.md](PERFORMANCE.md) for the production review and validation.
