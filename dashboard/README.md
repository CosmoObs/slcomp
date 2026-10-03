# LaStBeRu Dashboard

Interactive dashboard for exploring astronomical lens data.

## Features
* Sky map
* Filtering
* Data & consolidated parameter tables
* Image cutout gallery

## Requirements

The dashboard uses Node 24 LTS/npm 11, React 19, Material UI 9 and Vite 8.
The MinIO exporter uses Python 3.14, pandas 3 and PyArrow. TypeScript stays
on version 6 because the ESLint integration currently supports versions below
6.1; see [typescript-eslint compatibility](https://typescript-eslint.io/users/dependency-versions/).

## Quick Start
```bash
nvm use          # Node 24 LTS, npm 11
npm ci
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
npm run lint   # ESLint, including scripts/configuration; zero warnings
npm run typecheck # TypeScript source and Vite configuration
npm run check  # Lint, typecheck and export regression tests
npm test       # Export/provenance regression tests
```

## Deployment (GitHub Pages)
When deploying to `https://<user>.github.io/<repo>/` you must build with the correct base path so that static JSON (in `public/data/`) and bundled assets resolve properly.

```bash
# Example for this repository if the dashboard lives at /slcomp/
export BASE_PATH=/slcomp/
npm run build
```

`.github/workflows/dashboard-ci.yml` checks pull requests with deterministic
example data, without MinIO credentials. It runs the Python export test, lint, type checking, JavaScript regression
tests, the production build and artifact checks (Pages paths, all 256 detail
shards, WebP assets and omission of redundant source catalogs).

`.github/workflows/deploy.yml` exports real data from MinIO and publishes the
Pages artifact after a push to `main` or `streamlit`, or a manual run on either
branch. Both workflows use Ubuntu 24.04, Node 24, dependency caches and Actions
pinned to release commit hashes. Deployment permissions belong to the deploy
job. Dependabot checks npm dependencies and Actions monthly.

Install the reproducible exporter environment with:

```bash
python3.14 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-deploy.txt
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
# Export real data with MINIO_ENDPOINT_URL, MINIO_ACCESS_KEY and MINIO_SECRET_KEY:
.venv/bin/python prepare_data.py
```

To refresh the Python lock after editing `requirements-deploy.in`, from the
repository root:

```bash
uv pip compile dashboard/requirements-deploy.in --python-version 3.14 \
  --generate-hashes -o dashboard/requirements-deploy.txt
```

The fixture generator (`node scripts/prepare-ci-data.mjs`) overwrites
`public/data/` and is intended for a disposable checkout. Keep real local data
when building outside CI. After a Pages build, run
`node scripts/check-build.mjs` to validate the artifact. The browser loads
`<BASE_URL>data/catalog.json` and object shards; ensure `BASE_PATH` includes the
repository subpath and trailing slash when publishing.


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
