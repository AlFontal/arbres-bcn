#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd
from pyproj import Transformer

DEFAULT_RAW_DIR = Path("data/raw")
DEFAULT_SOURCES_MANIFEST = DEFAULT_RAW_DIR / "sources.json"
DEFAULT_OUTPUT = Path("data/processed/trees.geojsonseq")
DEFAULT_SUMMARY = Path("public/data/trees-summary.json")
SOURCE_CRS = "EPSG:25831"
TARGET_CRS = "EPSG:4326"

KEEP_COLUMNS = {
    "codi": "id",
    "tipus_element": "kind",
    "cat_especie_id": "species_id",
    "cat_nom_cientific": "scientific_name",
    "cat_nom_castella": "common_name_es",
    "cat_nom_catala": "common_name_ca",
    "categoria_arbrat": "tree_category",
    "espai_verd": "green_space",
    "adreca": "address",
    "nom_barri": "neighborhood",
    "nom_districte": "district",
    "data_plantacio": "planting_date",
    "tipus_aigua": "water_type",
    "tipus_reg": "irrigation_type",
    "catalogacio": "heritage_status",
    "source": "source",
}


@dataclass(frozen=True)
class Bounds:
    west: float
    south: float
    east: float
    north: float

    @property
    def center(self) -> list[float]:
        return [
            round((self.west + self.east) / 2, 6),
            round((self.south + self.north) / 2, 6),
        ]

    def as_list(self) -> list[float]:
        return [
            round(self.west, 6),
            round(self.south, 6),
            round(self.east, 6),
            round(self.north, 6),
        ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare Barcelona trees data.")
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_DIR)
    parser.add_argument("--sources-manifest", type=Path, default=DEFAULT_SOURCES_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--summary", type=Path, default=DEFAULT_SUMMARY)
    return parser.parse_args()


def clean_text(value: Any) -> Any:
    if value is None:
        return None
    if pd.isna(value):
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value or value == "-":
            return None
        return value
    return value


def choose_coordinates(df: pd.DataFrame) -> tuple[pd.Series, pd.Series, int]:
    transformer = Transformer.from_crs(SOURCE_CRS, TARGET_CRS, always_xy=True)
    projected_lon, projected_lat = transformer.transform(
        df["x_etrs89"].to_numpy(), df["y_etrs89"].to_numpy()
    )

    lon_from_xy = pd.Series(projected_lon, index=df.index, dtype="float64")
    lat_from_xy = pd.Series(projected_lat, index=df.index, dtype="float64")

    raw_lon = pd.to_numeric(df["longitud"], errors="coerce")
    raw_lat = pd.to_numeric(df["latitud"], errors="coerce")

    valid_raw = raw_lon.between(-180, 180) & raw_lat.between(-90, 90)
    delta = (raw_lon - lon_from_xy).abs().fillna(0) + (raw_lat - lat_from_xy).abs().fillna(0)
    use_projected = (~valid_raw) | (delta > 1e-4)

    lon = raw_lon.where(~use_projected, lon_from_xy)
    lat = raw_lat.where(~use_projected, lat_from_xy)

    fallback_count = int(use_projected.sum())
    return lon.round(6), lat.round(6), fallback_count


def build_feature(properties: dict[str, Any], lon: float, lat: float) -> dict[str, Any]:
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": properties,
    }


def compute_bounds(df: pd.DataFrame) -> Bounds:
    return Bounds(
        west=float(df["lon"].min()),
        south=float(df["lat"].min()),
        east=float(df["lon"].max()),
        north=float(df["lat"].max()),
    )


def species_summary(df: pd.DataFrame) -> list[dict[str, Any]]:
    grouped = (
        df.groupby("scientific_name", dropna=False)
        .agg(
            common_name_es=("common_name_es", "first"),
            common_name_ca=("common_name_ca", "first"),
            count=("scientific_name", "size"),
        )
        .reset_index()
        .sort_values(["count", "scientific_name"], ascending=[False, True])
    )
    return [
        {
            "scientific_name": clean_text(row.scientific_name),
            "common_name_es": clean_text(row.common_name_es),
            "common_name_ca": clean_text(row.common_name_ca),
            "count": int(row.count),
        }
        for row in grouped.itertuples(index=False)
    ]


def species_counts(df: pd.DataFrame) -> list[dict[str, Any]]:
    grouped = (
        df.groupby(
            ["scientific_name", "common_name_es", "common_name_ca", "kind", "district"],
            dropna=False,
        )
        .size()
        .reset_index(name="count")
        .sort_values(["count", "scientific_name"], ascending=[False, True])
    )
    return [
        {
            "scientific_name": clean_text(row.scientific_name),
            "common_name_es": clean_text(row.common_name_es),
            "common_name_ca": clean_text(row.common_name_ca),
            "kind": clean_text(row.kind),
            "district": clean_text(row.district),
            "count": int(row.count),
        }
        for row in grouped.itertuples(index=False)
        if clean_text(row.scientific_name) and clean_text(row.kind) and clean_text(row.district)
    ]


def type_summary(df: pd.DataFrame) -> list[dict[str, Any]]:
    grouped = (
        df.groupby("kind", dropna=False)
        .size()
        .reset_index(name="count")
        .sort_values(["count", "kind"], ascending=[False, True])
    )
    return [
        {"value": clean_text(row.kind), "count": int(row.count)}
        for row in grouped.itertuples(index=False)
        if clean_text(row.kind)
    ]


def district_bounds(df: pd.DataFrame) -> list[dict[str, Any]]:
    grouped = (
        df.groupby("district", dropna=False)
        .agg(
            west=("lon", "min"),
            south=("lat", "min"),
            east=("lon", "max"),
            north=("lat", "max"),
        )
        .reset_index()
        .sort_values("district")
    )
    results: list[dict[str, Any]] = []
    for row in grouped.itertuples(index=False):
        district = clean_text(row.district)
        if not district:
            continue
        bounds = Bounds(
            west=float(row.west),
            south=float(row.south),
            east=float(row.east),
            north=float(row.north),
        )
        results.append(
            {
                "district": district,
                "bounds": bounds.as_list(),
                "center": bounds.center,
            }
        )
    return results


def write_geojsonseq(df: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        for row in df.itertuples(index=False):
            properties = {key: clean_text(getattr(row, key)) for key in KEEP_COLUMNS.values()}
            feature = build_feature(properties=properties, lon=row.lon, lat=row.lat)
            handle.write(json.dumps(feature, ensure_ascii=False) + "\n")


def load_sources_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def load_raw_data(raw_dir: Path) -> pd.DataFrame:
    csv_paths = sorted(raw_dir.glob("*.csv"))
    if not csv_paths:
        raise SystemExit(
            f"No CSV files found in {raw_dir}. Run scripts/fetch_bcn_open_data.py first."
        )

    frames = []
    for path in csv_paths:
        dataset_slug = path.stem
        frame = pd.read_csv(path, low_memory=False)
        frame["source"] = dataset_slug
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def write_summary(
    *,
    df: pd.DataFrame,
    summary_path: Path,
    fallback_count: int,
    bounds: Bounds,
    official_sources: list[dict[str, Any]],
) -> None:
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary = {
        "generated_at": datetime.now(UTC).isoformat(),
        "source_file": "official-barcelona-open-data",
        "feature_count": int(len(df)),
        "coordinate_fallback_count": fallback_count,
        "bounds": bounds.as_list(),
        "center": bounds.center,
        "schema": [{"source": source, "output": target} for source, target in KEEP_COLUMNS.items()]
        + [
            {"source": "longitud / x_etrs89", "output": "lon"},
            {"source": "latitud / y_etrs89", "output": "lat"},
        ],
        "types": type_summary(df),
        "species": species_summary(df),
        "species_counts": species_counts(df),
        "districts": sorted(
            district for district in df["district"].dropna().unique().tolist() if district
        ),
        "district_bounds": district_bounds(df),
        "official_sources": official_sources,
    }
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    df = load_raw_data(args.raw_dir)
    official_sources = load_sources_manifest(args.sources_manifest)

    lon, lat, fallback_count = choose_coordinates(df)
    cleaned = df[list(KEEP_COLUMNS.keys())].rename(columns=KEEP_COLUMNS).copy()
    cleaned["lon"] = lon
    cleaned["lat"] = lat

    cleaned = cleaned.dropna(subset=["lon", "lat", "scientific_name", "kind"])
    cleaned = cleaned[
        cleaned["lon"].between(2.0, 2.3) & cleaned["lat"].between(41.2, 41.5)
    ].reset_index(drop=True)

    write_geojsonseq(cleaned, args.output)
    bounds = compute_bounds(cleaned)
    write_summary(
        df=cleaned,
        summary_path=args.summary,
        fallback_count=fallback_count,
        bounds=bounds,
        official_sources=official_sources,
    )

    print(f"Prepared {len(cleaned):,} tree features")
    print(f"Wrote {args.output}")
    print(f"Wrote {args.summary}")


if __name__ == "__main__":
    main()
