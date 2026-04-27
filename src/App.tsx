import {
  startTransition,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import { createDataSource } from "@loaders.gl/core";
import { PMTilesSource, PMTilesTileSource } from "@loaders.gl/pmtiles";
import type { PickingInfo } from "@deck.gl/core";
import type { Feature, FeatureCollection, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DatasetSummary, SummarySpecies, TreeFeature, TreeProperties } from "./types";

const BARCELONA_CENTER: [number, number] = [2.16859, 41.3874];
const PMTILES_URL = `${import.meta.env.BASE_URL}data/trees.pmtiles`;
const SUMMARY_URL = `${import.meta.env.BASE_URL}data/trees-summary.json`;

const SPECIES_COLORS: [number, number, number, number][] = [
  [26, 108, 92, 170],
  [188, 104, 53, 170],
  [86, 115, 202, 170],
  [149, 93, 173, 170],
  [209, 144, 38, 170],
  [54, 140, 178, 170],
  [133, 147, 56, 170],
  [198, 84, 102, 170],
  [115, 95, 178, 170],
  [46, 128, 76, 170],
];

const OTHER_SPECIES_COLOR: [number, number, number, number] = [102, 114, 112, 135];

const BASEMAP_OPTIONS = [
  { id: "muted", label: { ca: "Suau", es: "Suave", en: "Muted" } },
  { id: "basic", label: { ca: "Bàsic", es: "Básico", en: "Basic" } },
  { id: "satellite", label: { ca: "Satèl·lit", es: "Satélite", en: "Satellite" } },
] as const;

type BasemapId = (typeof BASEMAP_OPTIONS)[number]["id"];
type Locale = "ca" | "es" | "en";

type HoverState = {
  feature: TreeFeature;
  x: number;
  y: number;
} | null;

type TileData =
  | FeatureCollection<Point, TreeProperties>
  | Array<Feature<Point, TreeProperties>>
  | null;

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    stats: { features: string; districts: string; species: string };
    controls: {
      language: string;
      basemap: string;
      treeType: string;
      district: string;
      species: string;
      allTypes: string;
      allDistricts: string;
      speciesPlaceholder: string;
    };
    sections: {
      topSpecies: string;
      speciesColors: string;
      selectedTree: string;
      officialSources: string;
    };
    panels: {
      preferences: string;
      open: string;
      close: string;
    };
    footnote: string;
    builtBy: string;
    repo: string;
    sourceIntro: string;
    latestSnapshot: string;
    dataMissingTitle: string;
    runCommand: string;
    metadata: {
      type: string;
      category: string;
      district: string;
      neighborhood: string;
      address: string;
      greenSpace: string;
      planted: string;
      irrigation: string;
      water: string;
      heritage: string;
      source: string;
      treeId: string;
    };
    datasetNames: Record<string, string>;
    otherSpecies: string;
  }
> = {
  ca: {
    eyebrow: "Dades obertes de Barcelona",
    title: "Arbrat a Barcelona",
    description:
      "Explora l'inventari públic d'arbrat de Barcelona. Filtra per tipus o espècie i consulta el detall de cada arbre.",
    stats: { features: "Arbres", districts: "Districtes", species: "Espècies" },
    controls: {
      language: "Idioma",
      basemap: "Mapa base",
      treeType: "Tipus d'arbrat",
      district: "Districte",
      species: "Espècie",
      allTypes: "Tots els tipus",
      allDistricts: "Tots els districtes",
      speciesPlaceholder: "Cerca per nom científic o comú",
    },
    sections: {
      topSpecies: "Espècies principals del conjunt",
      speciesColors: "Colors per espècie",
      selectedTree: "Arbre seleccionat",
      officialSources: "Fonts oficials",
    },
    panels: {
      preferences: "Idioma i mapa base",
      open: "Obre",
      close: "Tanca",
    },
    footnote:
      "Les dades provenen dels conjunts oficials d'arbrat viari, de zona i de parcs, i s'han optimitzat per a visualització web estàtica.",
    builtBy: "Creat per Alejandro Fontal",
    repo: "Repositori GitHub",
    sourceIntro: "Conjunts d'origen",
    latestSnapshot: "Darrera actualització",
    dataMissingTitle: "Falten dades.",
    runCommand: "Executa",
    metadata: {
      type: "Tipus",
      category: "Perímetre del tronc",
      district: "Districte",
      neighborhood: "Barri",
      address: "Adreça",
      greenSpace: "Espai verd",
      planted: "Plantació",
      irrigation: "Reg",
      water: "Aigua",
      heritage: "Catalogació",
      source: "Conjunt",
      treeId: "Codi",
    },
    datasetNames: {
      "arbrat-viari": "Arbrat viari",
      "arbrat-zona": "Arbrat de zona",
      "arbrat-parcs": "Arbrat de parcs",
    },
    otherSpecies: "Altres espècies",
  },
  es: {
    eyebrow: "Datos abiertos de Barcelona",
    title: "Arbolado de Barcelona",
    description:
      "Explora el inventario público de arbolado de Barcelona como teselas vectoriales. Filtra por tipo o especie y consulta el detalle de cada árbol.",
    stats: { features: "Árboles", districts: "Distritos", species: "Especies" },
    controls: {
      language: "Idioma",
      basemap: "Mapa base",
      treeType: "Tipo de arbolado",
      district: "Distrito",
      species: "Especie",
      allTypes: "Todos los tipos",
      allDistricts: "Todos los distritos",
      speciesPlaceholder: "Busca por nombre científico o común",
    },
    sections: {
      topSpecies: "Especies principales del conjunto",
      speciesColors: "Colores por especie",
      selectedTree: "Árbol seleccionado",
      officialSources: "Fuentes oficiales",
    },
    panels: {
      preferences: "Idioma y mapa base",
      open: "Abrir",
      close: "Cerrar",
    },
    footnote:
      "Los datos proceden de los conjuntos oficiales de arbolado viario, de zona y de parques, y se han optimizado para visualización web estática.",
    builtBy: "Creado por Alejandro Fontal",
    repo: "Repositorio GitHub",
    sourceIntro: "Conjuntos de origen",
    latestSnapshot: "Última actualización",
    dataMissingTitle: "Faltan datos.",
    runCommand: "Ejecuta",
    metadata: {
      type: "Tipo",
      category: "Perímetro del tronco",
      district: "Distrito",
      neighborhood: "Barrio",
      address: "Dirección",
      greenSpace: "Espacio verde",
      planted: "Plantación",
      irrigation: "Riego",
      water: "Agua",
      heritage: "Catalogación",
      source: "Conjunto",
      treeId: "Código",
    },
    datasetNames: {
      "arbrat-viari": "Arbolado viario",
      "arbrat-zona": "Arbolado de zona",
      "arbrat-parcs": "Arbolado de parques",
    },
    otherSpecies: "Otras especies",
  },
  en: {
    eyebrow: "Barcelona open data",
    title: "Barcelona trees",
    description:
      "Explore Barcelona's public tree inventory as vector tiles. Filter by tree type or species and inspect the details of each tree.",
    stats: { features: "Trees", districts: "Districts", species: "Species" },
    controls: {
      language: "Language",
      basemap: "Basemap",
      treeType: "Tree type",
      district: "District",
      species: "Species",
      allTypes: "All types",
      allDistricts: "All districts",
      speciesPlaceholder: "Search scientific or common names",
    },
    sections: {
      topSpecies: "Top species in the dataset",
      speciesColors: "Species colors",
      selectedTree: "Selected tree",
      officialSources: "Official sources",
    },
    panels: {
      preferences: "Language and basemap",
      open: "Open",
      close: "Close",
    },
    footnote:
      "The data comes from the official street, zone, and park tree datasets and has been optimized for static web delivery.",
    builtBy: "Built by Alejandro Fontal",
    repo: "GitHub repository",
    sourceIntro: "Source datasets",
    latestSnapshot: "Latest update",
    dataMissingTitle: "Data missing.",
    runCommand: "Run",
    metadata: {
      type: "Type",
      category: "Trunk girth",
      district: "District",
      neighborhood: "Neighborhood",
      address: "Address",
      greenSpace: "Green space",
      planted: "Planted",
      irrigation: "Irrigation",
      water: "Water",
      heritage: "Heritage",
      source: "Dataset",
      treeId: "Tree ID",
    },
    datasetNames: {
      "arbrat-viari": "Street trees",
      "arbrat-zona": "Zone trees",
      "arbrat-parcs": "Park trees",
    },
    otherSpecies: "Other species",
  },
};

function getBasemapStyle(basemap: BasemapId): StyleSpecification {
  const sources = {
    muted: {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    },
    basic: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
    satellite: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  };

  return {
    version: 8,
    sources: { base: sources[basemap] },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const basemapRef = useRef<BasemapId>("muted");

  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [tileSource, setTileSource] = useState<PMTilesTileSource | null>(null);
  const [tilesError, setTilesError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [speciesInput, setSpeciesInput] = useState<string>("");
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string | null>(null);
  const [speciesMenuOpen, setSpeciesMenuOpen] = useState(false);
  const [basemap, setBasemap] = useState<BasemapId>("muted");
  const [locale, setLocale] = useState<Locale>("ca");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [hoverState, setHoverState] = useState<HoverState>(null);
  const [selectedFeature, setSelectedFeature] = useState<TreeFeature | null>(null);
  const speciesListId = useId();

  const copy = COPY[locale];

  useEffect(() => {
    let cancelled = false;

    fetch(SUMMARY_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load dataset summary (${response.status})`);
        }
        return (await response.json()) as DatasetSummary;
      })
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setSummaryError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const source = (await createDataSource(PMTILES_URL, [PMTilesSource], {
          core: { loadOptions: { mvt: { shape: "geojson" } } },
        })) as PMTilesTileSource;
        if (!cancelled) {
          setTileSource(source);
        }
      } catch (error) {
        if (!cancelled) {
          setTilesError(
            error instanceof Error ? error.message : "Unable to open the PMTiles archive.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getBasemapStyle(basemapRef.current),
      center: BARCELONA_CENTER,
      zoom: 12.2,
      minZoom: 10,
      maxZoom: 18,
      cooperativeGestures: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
    });

    map.addControl(overlay);

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      overlay.finalize();
      map.remove();
      overlayRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || basemapRef.current === basemap) {
      return;
    }

    basemapRef.current = basemap;
    mapRef.current.setStyle(getBasemapStyle(basemap));
  }, [basemap]);

  const kinds = useMemo(() => summary?.types ?? [], [summary]);
  const species = useMemo(() => summary?.species ?? [], [summary]);
  const districts = useMemo(() => summary?.districts ?? [], [summary]);
  const districtBounds = useMemo(() => summary?.district_bounds ?? [], [summary]);
  const officialSources = useMemo(() => summary?.official_sources ?? [], [summary]);
  const normalizedSpeciesInput = normalizeText(speciesInput);
  const speciesSuggestions = useMemo(() => {
    if (!normalizedSpeciesInput) {
      return species.slice(0, 8);
    }
    return species
      .filter((item) => {
        const haystack = [
          item.scientific_name,
          item.common_name_ca,
          item.common_name_es,
        ]
          .filter(Boolean)
          .map(normalizeText)
          .join(" ");
        return haystack.includes(normalizedSpeciesInput);
      })
      .slice(0, 8);
  }, [normalizedSpeciesInput, species]);
  const dynamicSpecies = useMemo(
    () =>
      computeDynamicSpecies(
        summary,
        kindFilter,
        districtFilter,
        selectedSpeciesFilter,
      ),
    [summary, kindFilter, districtFilter, selectedSpeciesFilter],
  );
  const topSpeciesBreakdown = useMemo(
    () => buildTopSpeciesBreakdown(dynamicSpecies, 5),
    [dynamicSpecies],
  );
  const filteredFeatureCount = useMemo(
    () => dynamicSpecies.reduce((sum, item) => sum + item.count, 0),
    [dynamicSpecies],
  );
  const filteredSpeciesCount = useMemo(() => dynamicSpecies.length, [dynamicSpecies]);
  const speciesColorMap = useMemo(
    () =>
      new Map(
        topSpeciesBreakdown
          .filter((item) => item.key !== "others")
          .map((item) => [item.scientific_name, item.color] as const),
      ),
    [topSpeciesBreakdown],
  );

  const filterKey = `${kindFilter}::${districtFilter}::${selectedSpeciesFilter ?? "all"}`;
  const selectedFeatureVisible =
    selectedFeature &&
    matchesFilters(selectedFeature, kindFilter, districtFilter, selectedSpeciesFilter)
      ? selectedFeature
      : null;

  const layers = useMemo(() => {
    if (!tileSource) {
      return [];
    }

    const treesLayer = new TileLayer<TileData>({
      id: `trees-layer-${filterKey}`,
      data: "barcelona-trees",
      minZoom: 0,
      maxZoom: 18,
      visibleMinZoom: 10,
      pickable: true,
      refinementStrategy: "best-available",
      maxRequests: 12,
      getTileData: async ({ index, signal }) => {
        const tile = (await tileSource.getVectorTile({
          x: index.x,
          y: index.y,
          z: index.z,
          layers: [],
        })) as TileData;
        if (signal?.aborted) {
          return null;
        }
        return tile;
      },
      renderSubLayers: (props) => {
        const collection = toFeatureCollection(props.data, props.tile.index);
        if (!collection) {
          return null;
        }

        const filteredFeatures = collection.features.filter((feature) =>
          matchesFilters(feature, kindFilter, districtFilter, selectedSpeciesFilter),
        );

        return new GeoJsonLayer<any>(props as any, {
          id: `${props.id}-points-${filterKey}`,
          data: {
            type: "FeatureCollection",
            features: filteredFeatures,
          },
          pointType: "circle",
          filled: true,
          stroked: false,
          getPointRadius: getPointRadius(props.tile.index.z),
          pointRadiusUnits: "pixels",
          pointRadiusMinPixels: 2.4,
          pointRadiusMaxPixels: 12,
          getFillColor: (feature: any) =>
            getSpeciesColor(feature.properties?.scientific_name, speciesColorMap),
          opacity: 1,
          pickable: true,
          autoHighlight: true,
          highlightColor: [249, 194, 46, 220],
          updateTriggers: {
            data: filterKey,
            getFillColor: [filterKey, speciesColorMap],
          },
        });
      },
      onHover: (info) => handleHover(info, setHoverState),
      onClick: (info) => {
        const feature = asTreeFeature(info.object);
        setSelectedFeature(feature);
      },
    });

    const selectedLayer =
      selectedFeatureVisible &&
      new ScatterplotLayer<TreeFeature>({
        id: "selected-tree-layer",
        data: [selectedFeatureVisible],
        getPosition: (feature) => feature.geometry.coordinates as [number, number],
        getRadius: 13,
        radiusUnits: "pixels",
        filled: false,
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 3,
        getLineColor: [245, 173, 0, 240],
        pickable: false,
      });

    return selectedLayer ? [treesLayer, selectedLayer] : [treesLayer];
  }, [
    filterKey,
    kindFilter,
    districtFilter,
    selectedSpeciesFilter,
    selectedFeatureVisible,
    speciesColorMap,
    tileSource,
  ]);

  useEffect(() => {
    overlayRef.current?.setProps({ layers });
  }, [layers]);

  useEffect(() => {
    if (!mapRef.current || !summary) {
      return;
    }

    const padding = { top: 88, right: 88, bottom: 88, left: 420 };

    if (districtFilter === "all") {
      mapRef.current.fitBounds(
        [
          [summary.bounds[0], summary.bounds[1]],
          [summary.bounds[2], summary.bounds[3]],
        ],
        {
          padding,
          duration: 650,
          maxZoom: 13.2,
        },
      );
      return;
    }

    const target = districtBounds.find((item) => item.district === districtFilter);
    if (!target) {
      return;
    }

    mapRef.current.fitBounds(
      [
        [target.bounds[0], target.bounds[1]],
        [target.bounds[2], target.bounds[3]],
      ],
      {
        padding,
        duration: 650,
        maxZoom: 15.4,
      },
    );
  }, [districtBounds, districtFilter, summary]);

  return (
    <main className={selectedFeatureVisible ? "app-shell has-selection" : "app-shell"}>
      <div ref={mapContainerRef} className="map" />

      <section className="panel panel-primary">
        <div className="panel-primary-scroll">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.description}</p>

          <div className="stats-grid" aria-label="Dataset summary">
            <StatCard label={copy.stats.features} value={formatInt(filteredFeatureCount)} />
            <StatCard label={copy.stats.species} value={formatInt(filteredSpeciesCount)} />
          </div>

          <div className="control-stack">
            <label className="control">
              <span>{copy.controls.district}</span>
              <select
                value={districtFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  startTransition(() => setDistrictFilter(value));
                }}
              >
                <option value="all">{copy.controls.allDistricts}</option>
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>

            <label className="control">
              <span>{copy.controls.treeType}</span>
              <select
                value={kindFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  startTransition(() => setKindFilter(value));
                }}
              >
                <option value="all">{copy.controls.allTypes}</option>
                {kinds.map((item) => (
                  <option key={item.value} value={item.value}>
                    {translateKind(item.value, locale)} ({formatInt(item.count)})
                  </option>
                ))}
              </select>
            </label>

            <label className="control">
              <span>{copy.controls.species}</span>
              <div className="combo-box">
                <input
                  value={speciesInput}
                  onFocus={() => setSpeciesMenuOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setSpeciesMenuOpen(false), 120);
                  }}
                  onChange={(event) => {
                    const value = event.target.value;
                    startTransition(() => {
                      setSpeciesInput(value);
                      if (!value.trim()) {
                        setSelectedSpeciesFilter(null);
                      }
                      setSpeciesMenuOpen(true);
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      const match = species.find((item) => item.scientific_name === speciesInput.trim());
                      if (match) {
                        event.preventDefault();
                        startTransition(() => {
                          setSelectedSpeciesFilter(match.scientific_name);
                          setSpeciesInput(match.scientific_name);
                          setSpeciesMenuOpen(false);
                        });
                      }
                    }
                  }}
                  aria-expanded={speciesMenuOpen}
                  aria-controls={speciesListId}
                  placeholder={copy.controls.speciesPlaceholder}
                />
                {speciesMenuOpen && speciesSuggestions.length > 0 && (
                  <ul id={speciesListId} className="combo-list" role="listbox">
                    {speciesSuggestions.map((item) => (
                      <li key={speciesKey(item)}>
                        <button
                          type="button"
                          className="combo-option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            startTransition(() => {
                              setSelectedSpeciesFilter(item.scientific_name);
                              setSpeciesInput(item.scientific_name);
                              setSpeciesMenuOpen(false);
                            });
                          }}
                        >
                          <span className="combo-option-main">{displaySpeciesName(item, locale)}</span>
                          <span className="combo-option-sub">{item.scientific_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
          </div>

          <div className="species-list">
            <p className="section-label">{copy.sections.topSpecies}</p>
            <ul>
              {topSpeciesBreakdown.map((item) => (
                <li key={item.key} className="species-bar-item">
                  <span className="species-bar-label" title={item.labelByLocale[locale]}>
                    {item.labelByLocale[locale]}
                  </span>
                  <div
                    className="species-bar-track"
                    aria-label={`${item.labelByLocale[locale]}: ${formatInt(item.count)} (${formatPercent(item.count / item.total, locale)})`}
                  >
                    <div
                      className="species-bar-fill"
                      style={{
                        width: `${item.total > 0 ? (item.count / item.total) * 100 : 0}%`,
                        backgroundColor: toCssColor(item.color),
                      }}
                    />
                    <strong className="species-bar-value" title={item.labelByLocale[locale]}>
                      {formatInt(item.count)} ({formatPercent(item.count / item.total, locale)})
                    </strong>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="sources-list">
            <button
              type="button"
              className="section-toggle"
              onClick={() => setSourcesOpen((value) => !value)}
            >
              <span>{copy.sections.officialSources}</span>
              <span>{sourcesOpen ? copy.panels.close : copy.panels.open}</span>
            </button>
            {sourcesOpen && (
              <ul>
                {officialSources.map((source) => (
                  <li key={source.slug}>
                    <a href={source.page_url} target="_blank" rel="noreferrer">
                      {copy.datasetNames[source.slug] ?? source.title}
                    </a>
                    <span>
                      {copy.latestSnapshot}: {formatDate(source.resource_created, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="footnote">{copy.footnote}</p>
          <p className="attribution">
            <a href="https://alfontal.dev" target="_blank" rel="noreferrer">
              {copy.builtBy}
            </a>
            <span> · </span>
            <a href="https://github.com/AlFontal/arbres-bcn" target="_blank" rel="noreferrer">
              {copy.repo}
            </a>
          </p>

          {(summaryError || tilesError) && (
            <div className="status status-error">
              <strong>{copy.dataMissingTitle}</strong>
              <span>{summaryError ?? tilesError}</span>
              <code>{copy.runCommand}: npm run prepare:data && npm run build:tiles</code>
            </div>
          )}
        </div>
      </section>

      <aside className="right-rail">
        <section className="panel panel-language">
          <button
            type="button"
            className="panel-toggle"
            onClick={() => setPreferencesOpen((value) => !value)}
          >
            <span>{copy.panels.preferences}</span>
            <span>{preferencesOpen ? copy.panels.close : copy.panels.open}</span>
          </button>

          {preferencesOpen && (
            <div className="panel-collapsible">
              <div className="control compact-control">
                <span>{copy.controls.language}</span>
                <div className="toggle-row" role="tablist" aria-label={copy.controls.language}>
                  {(["ca", "es", "en"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={option === locale ? "toggle-chip is-active" : "toggle-chip"}
                      onClick={() => {
                        startTransition(() => setLocale(option));
                      }}
                    >
                      {option.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control compact-control">
                <span>{copy.controls.basemap}</span>
                <div className="toggle-row" role="tablist" aria-label={copy.controls.basemap}>
                  {BASEMAP_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={option.id === basemap ? "toggle-chip is-active" : "toggle-chip"}
                      onClick={() => {
                        startTransition(() => setBasemap(option.id));
                      }}
                    >
                      {option.label[locale]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="panel panel-legend">
          <p className="section-label">{copy.sections.speciesColors}</p>
          <ul className="legend-list">
            {topSpeciesBreakdown.map((item) => (
              <li key={item.key}>
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: toCssColor(item.color) }}
                />
                <span>{item.labelByLocale[locale]}</span>
              </li>
            ))}
          </ul>
        </section>

        {selectedFeatureVisible && (
          <section className="panel panel-detail">
            <p className="section-label">{copy.sections.selectedTree}</p>
            <TooltipBody feature={selectedFeatureVisible} locale={locale} />
          </section>
        )}
      </aside>

      {hoverState && (
        <aside
          className="tooltip"
          style={{
            left: hoverState.x + 16,
            top: hoverState.y + 16,
          }}
        >
          <TooltipBody feature={hoverState.feature} locale={locale} />
        </aside>
      )}

    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TooltipBody({ feature, locale }: { feature: TreeFeature; locale: Locale }) {
  const props = feature.properties;
  const copy = COPY[locale];
  const sourceLabel =
    props.source && copy.datasetNames[props.source] ? copy.datasetNames[props.source] : props.source;

  return (
    <div className="tooltip-body">
      <strong>{props.scientific_name}</strong>
      {(props.common_name_ca || props.common_name_es) && (
        <span className="tooltip-subtitle">
          {locale === "ca"
            ? [props.common_name_ca, props.common_name_es].filter(Boolean).join(" · ")
            : locale === "es"
              ? [props.common_name_es, props.common_name_ca].filter(Boolean).join(" · ")
              : [props.common_name_ca ?? props.common_name_es].filter(Boolean).join(" · ")}
        </span>
      )}
      <dl className="tooltip-grid">
        <MetadataRow label={copy.metadata.type} value={translateKind(props.kind, locale)} />
        <MetadataRow label={copy.metadata.category} value={translateTreeCategory(props.tree_category, locale)} />
        <MetadataRow label={copy.metadata.district} value={props.district} />
        <MetadataRow label={copy.metadata.neighborhood} value={props.neighborhood} />
        <MetadataRow label={copy.metadata.address} value={props.address} />
        <MetadataRow label={copy.metadata.greenSpace} value={props.green_space} />
        <MetadataRow label={copy.metadata.planted} value={props.planting_date} />
        <MetadataRow label={copy.metadata.irrigation} value={props.irrigation_type} />
        <MetadataRow label={copy.metadata.water} value={props.water_type} />
        <MetadataRow label={copy.metadata.heritage} value={props.heritage_status} />
        <MetadataRow label={copy.metadata.source} value={sourceLabel} />
        <MetadataRow label={copy.metadata.treeId} value={props.id} />
      </dl>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function handleHover(info: PickingInfo, setHoverState: (value: HoverState) => void) {
  const feature = asTreeFeature(info.object);
  if (!feature || info.x === undefined || info.y === undefined) {
    setHoverState(null);
    return;
  }

  setHoverState({
    feature,
    x: info.x,
    y: info.y,
  });
}

function asTreeFeature(value: unknown): TreeFeature | null {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    (value as Feature).type === "Feature"
  ) {
    return value as TreeFeature;
  }
  return null;
}

function toFeatureCollection(
  data: TileData,
  tileIndex?: { x: number; y: number; z: number },
): FeatureCollection<Point, TreeProperties> | null {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    return {
      type: "FeatureCollection",
      features: data.map((feature) => projectPointFeature(feature, tileIndex)),
    };
  }

  return {
    ...data,
    features: data.features.map((feature) => projectPointFeature(feature, tileIndex)),
  };
}

function projectPointFeature(
  feature: Feature<Point, TreeProperties>,
  tileIndex?: { x: number; y: number; z: number },
) {
  if (!tileIndex) {
    return feature;
  }

  const [x, y] = feature.geometry.coordinates;
  if (!looksLikeLocalTileCoordinates(x, y)) {
    return feature;
  }

  const [lon, lat] = tileLocalToLngLat(x, y, tileIndex);
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: [lon, lat],
    },
  };
}

function looksLikeLocalTileCoordinates(x: number, y: number) {
  return x > -1 && x < 2 && y > -1 && y < 2;
}

function tileLocalToLngLat(
  x: number,
  y: number,
  tileIndex: { x: number; y: number; z: number },
): [number, number] {
  const worldScale = 2 ** tileIndex.z;
  const worldX = (tileIndex.x + x) / worldScale;
  const worldY = (tileIndex.y + y) / worldScale;
  const lon = worldX * 360 - 180;
  const latRadians = Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY)));
  const lat = (latRadians * 180) / Math.PI;
  return [lon, lat];
}

function matchesFilters(
  feature: Feature<Point, TreeProperties>,
  kindFilter: string,
  districtFilter: string,
  selectedSpeciesFilter: string | null,
) {
  const props = feature.properties;

  if (kindFilter !== "all" && props.kind !== kindFilter) {
    return false;
  }

  if (districtFilter !== "all" && props.district !== districtFilter) {
    return false;
  }

  if (selectedSpeciesFilter && props.scientific_name !== selectedSpeciesFilter) {
    return false;
  }

  return true;
}

function getSpeciesColor(
  scientificName: string | null | undefined,
  speciesColorMap: Map<string, [number, number, number, number]>,
): [number, number, number, number] {
  if (scientificName && speciesColorMap.has(scientificName)) {
    return speciesColorMap.get(scientificName) ?? OTHER_SPECIES_COLOR;
  }
  return OTHER_SPECIES_COLOR;
}

function getPointRadius(zoom: number) {
  if (zoom >= 16) return 6.8;
  if (zoom >= 15) return 5.8;
  if (zoom >= 14) return 4.8;
  if (zoom >= 13) return 3.9;
  return 3.1;
}

function formatInt(value: number | undefined) {
  if (typeof value !== "number") {
    return "…";
  }
  return new Intl.NumberFormat("ca-ES").format(value);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function toCssColor([r, g, b, a]: [number, number, number, number]) {
  return `rgb(${r} ${g} ${b} / ${Math.max(0, Math.min(a / 255, 1))})`;
}

function speciesKey(species: SummarySpecies) {
  return [
    species.scientific_name,
    species.common_name_ca ?? "",
    species.common_name_es ?? "",
  ].join("|");
}

function displaySpeciesName(species: SummarySpecies, locale: Locale) {
  if (locale === "ca" && species.common_name_ca) {
    return species.common_name_ca;
  }
  if (locale === "es" && species.common_name_es) {
    return species.common_name_es;
  }
  return species.scientific_name;
}

function translateKind(kind: string | null | undefined, locale: Locale) {
  if (!kind) {
    return "";
  }

  const dictionary: Record<string, Record<Locale, string>> = {
    "ARBRE VIARI": { ca: "Arbre viari", es: "Árbol viario", en: "Street tree" },
    "ARBRE ZONA": { ca: "Arbre de zona", es: "Árbol de zona", en: "Zone tree" },
    "ARBRE PARC": { ca: "Arbre de parc", es: "Árbol de parque", en: "Park tree" },
    "PALMERA VIARI": { ca: "Palmera viària", es: "Palmera viaria", en: "Street palm" },
    "PALMERA ZONA": { ca: "Palmera de zona", es: "Palmera de zona", en: "Zone palm" },
    "PALMERA PARC": { ca: "Palmera de parc", es: "Palmera de parque", en: "Park palm" },
  };

  return dictionary[kind]?.[locale] ?? kind;
}

function translateTreeCategory(category: string | null | undefined, locale: Locale) {
  if (!category) {
    return "";
  }

  const dictionary: Record<string, Record<Locale, string>> = {
    PRIMERA: {
      ca: "Fins a 40 cm",
      es: "Hasta 40 cm",
      en: "Up to 40 cm",
    },
    SEGONA: {
      ca: "De 41 a 80 cm",
      es: "De 41 a 80 cm",
      en: "41 to 80 cm",
    },
    TERCERA: {
      ca: "De 81 a 110 cm",
      es: "De 81 a 110 cm",
      en: "81 to 110 cm",
    },
    EXEMPLAR: {
      ca: "Més de 110 cm",
      es: "Más de 110 cm",
      en: "Over 110 cm",
    },
  };

  return dictionary[category]?.[locale] ?? category;
}

function formatDate(value: string | undefined, locale: Locale) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : `${locale}-ES`, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatPercent(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : `${locale}-ES`, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function computeDynamicSpecies(
  summary: DatasetSummary | null,
  kindFilter: string,
  districtFilter: string,
  selectedSpeciesFilter: string | null,
) {
  const rows = summary?.species_counts ?? [];
  const aggregate = new Map<
    string,
    {
      scientific_name: string;
      common_name_es: string | null;
      common_name_ca: string | null;
      count: number;
    }
  >();

  for (const row of rows) {
    if (kindFilter !== "all" && row.kind !== kindFilter) {
      continue;
    }
    if (districtFilter !== "all" && row.district !== districtFilter) {
      continue;
    }
    if (selectedSpeciesFilter && row.scientific_name !== selectedSpeciesFilter) {
      continue;
    }

    const current = aggregate.get(row.scientific_name);
    if (current) {
      current.count += row.count;
      continue;
    }
    aggregate.set(row.scientific_name, {
      scientific_name: row.scientific_name,
      common_name_es: row.common_name_es,
      common_name_ca: row.common_name_ca,
      count: row.count,
    });
  }

  return Array.from(aggregate.values()).sort(
    (a, b) => b.count - a.count || a.scientific_name.localeCompare(b.scientific_name),
  );
}

function buildTopSpeciesBreakdown(
  species: Array<{
    scientific_name: string;
    common_name_es: string | null;
    common_name_ca: string | null;
    count: number;
  }>,
  topCount: number,
) {
  const total = species.reduce((sum, item) => sum + item.count, 0);
  const top = species.slice(0, topCount).map((item, index) => ({
    key: speciesKey(item),
    scientific_name: item.scientific_name,
    labelByLocale: {
      ca: displaySpeciesName(item, "ca"),
      es: displaySpeciesName(item, "es"),
      en: displaySpeciesName(item, "en"),
    },
    count: item.count,
    total,
    color: SPECIES_COLORS[index],
  }));
  const othersCount = species.slice(topCount).reduce((sum, item) => sum + item.count, 0);
  if (othersCount > 0) {
    top.push({
      key: "others",
      scientific_name: "others",
      labelByLocale: {
        ca: COPY.ca.otherSpecies,
        es: COPY.es.otherSpecies,
        en: COPY.en.otherSpecies,
      },
      count: othersCount,
      total,
      color: OTHER_SPECIES_COLOR,
    });
  }
  return top;
}

export default App;
