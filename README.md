# Barcelona Trees MVP

Minimal static web map for exploring the latest official Barcelona tree datasets from Open Data BCN.

## Stack

- Python for data preparation
- Tippecanoe to build vector tiles
- PMTiles for static tile serving
- MapLibre GL JS for the basemap
- deck.gl for point rendering and interaction
- Vite + React + TypeScript for the frontend

## Official source datasets

The app fetches the current quarterly CSV snapshots from the official Open Data BCN dataset pages:

- `arbrat-viari`: <https://opendata-ajuntament.barcelona.cat/data/ca/dataset/arbrat-viari>
- `arbrat-zona`: <https://opendata-ajuntament.barcelona.cat/data/ca/dataset/arbrat-zona>
- `arbrat-parcs`: <https://opendata-ajuntament.barcelona.cat/data/ca/dataset/arbrat-parcs>

The current pipeline fetches the latest CSV ZIP resource for each package through the CKAN API, extracts the CSVs into `data/raw/`, merges them, and produces a single web-optimized GeoJSON sequence plus PMTiles archive.

As verified from the official CKAN metadata on April 27, 2026, the latest quarterly resources for all three datasets are the `2026_1T` snapshots created on April 1, 2026.

## Dataset schema

The merged dataset currently contains **222,106 rows**. The most relevant fields for this MVP are:

- `codi`: tree identifier
- `x_etrs89`, `y_etrs89`: projected coordinates in ETRS89 / UTM zone 31N
- `latitud`, `longitud`: geographic coordinates already close to WGS84
- `tipus_element`: tree or palm type
- `cat_nom_cientific`, `cat_nom_castella`, `cat_nom_catala`: species names
- `categoria_arbrat`: tree category
- `espai_verd`, `adreca`: green space / street address
- `nom_barri`, `nom_districte`: neighborhood and district
- `data_plantacio`, `tipus_aigua`, `tipus_reg`, `catalogacio`: planting and maintenance metadata

The preprocessing step keeps only public-facing fields that are useful for display, ensures WGS84 lon/lat, adds the dataset source slug, and exports point features as GeoJSON sequence.

## Install

1. Install Node.js 20+ and Python 3.11+.
2. Install frontend dependencies:

```bash
npm install
```

3. Install Tippecanoe.

On macOS:

```bash
brew install tippecanoe
```

## Prepare the data

Fetch the latest official CSV snapshots and prepare the merged web dataset:

```bash
npm run prepare:data
```

This generates:

- `data/raw/arbrat-viari.csv`
- `data/raw/arbrat-zona.csv`
- `data/raw/arbrat-parcs.csv`
- `data/raw/sources.json`
- `data/processed/trees.geojsonseq`
- `public/data/trees-summary.json`

## Build the PMTiles archive

Once the processed GeoJSON sequence exists:

```bash
npm run build:tiles
```

This generates:

- `public/data/trees.pmtiles`

The Tippecanoe command uses `-P` for GeoJSON sequence input and builds a single PMTiles archive that can be served from static hosting.

## Run locally

After data preparation and tile generation:

```bash
npm run dev
```

Open the local Vite URL, usually `http://localhost:5173`.

## Production build

Build the frontend:

```bash
npm run build
```

Preview the production bundle locally:

```bash
npm run preview
```

## Notes

- No backend is required.
- The UI defaults to Catalan and includes built-in switches for Spanish and English.
- The map uses raster basemaps and deck.gl for the tree overlay.
- `public/data/trees.pmtiles` relies on HTTP range requests, so the static host must support byte-range responses.
- Generated raw and derived geodata artifacts are ignored in `.gitignore` to keep large files out of version control.
