#!/usr/bin/env python3

from __future__ import annotations

import io
import json
import urllib.request
import zipfile
from pathlib import Path

DATASET_SLUGS = ["arbrat-viari", "arbrat-zona", "arbrat-parcs"]
OUTPUT_DIR = Path("data/raw")
MANIFEST_PATH = OUTPUT_DIR / "sources.json"
CKAN_API = "https://opendata-ajuntament.barcelona.cat/data/api/action/package_show?id={slug}"


def fetch_package(slug: str) -> dict:
    with urllib.request.urlopen(CKAN_API.format(slug=slug)) as response:
        payload = json.load(response)
    return payload["result"]


def latest_csv_zip(resources: list[dict]) -> dict:
    candidates = [
        resource
        for resource in resources
        if (resource.get("format") or "").upper() == "ZIP"
        and ".csv.zip" in (resource.get("name") or "").lower()
    ]
    if not candidates:
        raise SystemExit("No CSV ZIP resource found for package.")
    candidates.sort(key=lambda item: item.get("created") or "", reverse=True)
    return candidates[0]


def download_and_extract(resource_url: str, output_path: Path) -> str:
    archive_bytes = urllib.request.urlopen(resource_url).read()
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        member = archive.namelist()[0]
        with archive.open(member) as source, output_path.open("wb") as target:
            target.write(source.read())
    return member


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []

    for slug in DATASET_SLUGS:
        package = fetch_package(slug)
        resource = latest_csv_zip(package["resources"])
        output_path = OUTPUT_DIR / f"{slug}.csv"
        extracted_member = download_and_extract(resource["url"], output_path)
        manifest.append(
            {
                "slug": slug,
                "title": package.get("title"),
                "page_url": f"https://opendata-ajuntament.barcelona.cat/data/ca/dataset/{slug}",
                "metadata_modified": package.get("metadata_modified"),
                "resource_name": resource.get("name"),
                "resource_created": resource.get("created"),
                "resource_url": resource.get("url"),
                "local_file": output_path.name,
                "archive_member": extracted_member,
            }
        )
        print(f"Fetched {slug} -> {output_path}")

    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
