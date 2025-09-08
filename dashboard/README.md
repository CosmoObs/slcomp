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
