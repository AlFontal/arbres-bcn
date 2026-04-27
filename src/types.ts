import type { Feature, Point } from "geojson";

export type TreeProperties = {
  id: string;
  kind: string;
  species_id: number;
  scientific_name: string;
  common_name_es: string | null;
  common_name_ca: string | null;
  tree_category: string | null;
  green_space: string | null;
  address: string | null;
  neighborhood: string | null;
  district: string | null;
  planting_date: string | null;
  water_type: string | null;
  irrigation_type: string | null;
  heritage_status: string | null;
  source: string | null;
};

export type TreeFeature = Feature<Point, TreeProperties>;

export type SummaryType = {
  value: string;
  count: number;
};

export type SummarySpecies = {
  scientific_name: string;
  common_name_es: string | null;
  common_name_ca: string | null;
  count: number;
};

export type SummarySpeciesCount = {
  scientific_name: string;
  common_name_es: string | null;
  common_name_ca: string | null;
  kind: string;
  district: string;
  count: number;
};

export type DatasetSummary = {
  generated_at: string;
  source_file: string;
  feature_count: number;
  coordinate_fallback_count: number;
  bounds: [number, number, number, number];
  center: [number, number];
  schema: Array<{
    source: string;
    output: string;
  }>;
  types: SummaryType[];
  species: SummarySpecies[];
  species_counts: SummarySpeciesCount[];
  districts: string[];
  district_bounds: Array<{
    district: string;
    bounds: [number, number, number, number];
    center: [number, number];
  }>;
  official_sources: Array<{
    slug: string;
    title: string;
    page_url: string;
    metadata_modified: string;
    resource_name: string;
    resource_created: string;
    resource_url: string;
    local_file: string;
    archive_member: string;
  }>;
};
