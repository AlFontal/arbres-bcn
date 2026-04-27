<p align="center">
  <img src="public/logo.png" alt="Arbrat BCN logo" width="180">
</p>

# Arbrat BCN

[![Live site](https://img.shields.io/badge/live-alfontal.github.io%2Farbres--bcn-4d7a5b?style=flat-square)](https://alfontal.github.io/arbres-bcn/)
[![Deploy Pages](https://github.com/AlFontal/arbres-bcn/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/AlFontal/arbres-bcn/actions/workflows/deploy-pages.yml)
[![Source code](https://img.shields.io/badge/github-AlFontal%2Farbres--bcn-24292f?style=flat-square)](https://github.com/AlFontal/arbres-bcn)
[![Data source](https://img.shields.io/badge/data-Open%20Data%20BCN-0b7285?style=flat-square)](https://opendata-ajuntament.barcelona.cat/data/ca/)

Arbrat BCN is a static interactive map for exploring Barcelona's public tree inventory. It brings together the city's official street, zone, and park tree datasets into a fast browser map with filtering, species summaries, district framing, and multilingual UI.

The interface defaults to Catalan and also includes Spanish and English.

## Data sources

The map is built from the official Barcelona Open Data datasets:

- [`arbrat-viari`](https://opendata-ajuntament.barcelona.cat/data/ca/dataset/arbrat-viari)
- [`arbrat-zona`](https://opendata-ajuntament.barcelona.cat/data/ca/dataset/arbrat-zona)
- [`arbrat-parcs`](https://opendata-ajuntament.barcelona.cat/data/ca/dataset/arbrat-parcs)

The data pipeline fetches the latest quarterly CSV ZIP resource from each dataset through the CKAN API, extracts them, merges them, normalizes coordinates to WGS84, and exports a PMTiles archive for static hosting.

As currently verified in this project, the latest snapshots in use are the `2026_1T` resources published on April 1, 2026.

## What the project includes

- A static frontend built with Vite, React, TypeScript, MapLibre GL JS, and deck.gl
- A Python data-preparation pipeline
- A PMTiles build step using Tippecanoe
- A GitHub Pages deployment workflow

## Run locally

Install dependencies:

```bash
npm install
```

Fetch and prepare the official data:

```bash
npm run prepare:data
```

Build the PMTiles archive:

```bash
npm run build:tiles
```

Start the local app:

```bash
npm run dev
```

## Build for production

```bash
npm run build
```

## Generated artifacts

The project intentionally keeps the publishable static data in `public/data/`:

- `public/data/trees.pmtiles`
- `public/data/trees-summary.json`

Raw downloads and intermediate processed files stay out of version control.

## Notes

- The map is designed for static hosting, including GitHub Pages.
- PMTiles requires HTTP range requests from the hosting platform.
- The hosted project currently lives at:
  - <https://alfontal.github.io/arbres-bcn/>
