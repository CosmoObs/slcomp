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

## Theming
Edit `src/theme.ts` (palette, breakpoints, shadows, transitions).


## Scripts
```bash
npm run dev    # Start dev server
npm run build  # Production bundle
npm run lint   # ESLint
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

