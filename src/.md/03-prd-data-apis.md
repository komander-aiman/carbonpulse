# PRD 03 — Data Sources, Public APIs, and Ingestion

Parent: `00-carbonpulse-index.md`
All sources below were checked on 2026-10-19. Anything not verified is marked.

## 1. Source registry

| ID | Source | Data | Format | Auth | Cadence | Use in app | Status |
|---|---|---|---|---|---|---|---|
| S1 | Energy Commission MyEnergyStats | Peninsular GEF 2024 = 0.740 kg CO2e/kWh, Sabah, Sarawak | PDF | None | Annual, provisional | Factor registry, method copy | Verified |
| S2 | `storage.data.gov.my/energy/electricity_consumption.csv` | National monthly consumption by sector (MKWh), includes domestic and losses | CSV, Parquet | None | Monthly | National context, losses note | Verified |
| S3 | `storage.data.gov.my/energy/electricity_supply.csv` | National monthly supply by sector | CSV, Parquet | None | Monthly | National context | Verified |
| S4 | `data.gov.my/data-catalogue?id=ghg_emissions` | National annual GHG by source, Gg CO2e | JSON, CSV | None | Annual | Township context, benchmark | Verified |
| S5 | `data.gov.my/data-catalogue?id=energy_consumption_sector` | Annual final energy by sector | JSON, CSV | None | Annual | Residential share context | Verified |
| S6 | `data.gov.my/data-catalogue?id=hh_income_district` | Household income by district | JSON, CSV | None | ~2–3 years | Elmina context (Petaling proxy) | Verified |
| S7 | `data.gov.my/data-catalogue?id=hh_profile_state` | Household counts by state | JSON, CSV | None | Annual | Participation denominator | Verified |
| S8 | `data.gov.my/data-catalogue?id=hh_access_amenities` | Electricity access by state/district | JSON, CSV | None | Annual | Context | Verified |
| S9 | `data.gov.my/data-catalogue?id=air_pollution` | National monthly air pollutants | JSON, CSV | None | Monthly, lagged | Climate context | Verified |
| S10 | Open-Meteo Archive | Hourly temperature, humidity, radiation from 1940 | JSON, CSV | None (non-commercial free tier) | Daily, 5-day lag | Cooling degree days, solar shape, climate context | Verified |
| S11 | Open-Meteo Air Quality | PM2.5, PM10, CO, CO2 ppm, AQI, past 92 days | JSON | None | 12-hourly | Local climate context | Verified |
| S12 | World Bank `EN.GHG.CO2.PC.CE.AR5` | Malaysia CO2 per capita | JSON | None | Annual, 2-year lag | National benchmark | Verified |
| S13 | Nominatim | Geocoding, polygon geometry | JSON | None | Live | **Offline only** to extract Elmina boundary | Verified, restricted |
| S14 | Overpass API | POIs and geometry | JSON | None | Live | **Server-side seed job only** | Verified, no CORS |
| S15 | OpenFreeMap | Vector tiles and styles | MVT | None | Continuous | Base map | Verified |
| S16 | GSO / TNB dashboards | Live generation mix | HTML | None | Intraday | **Not used**; no public API | Verified absence |

Do not add Electricity Maps, Climatiq, or other keyed carbon APIs. Keyless Malaysian and
open sources only, per D5.

### 1.1 The one rule that covers every zone figure

**Every zone aggregate is cohort-derived, never a measured township figure.** `data.gov.my`
publishes no state-level electricity, no township data, and no sub-national CO2. A zone
median is the median of consenting households in that subzone. It must never be described
as, or joined to, a "township emission".

## 2. Access pattern per source

### 2.1 data.gov.my

- Use the API only for small interactive lookups. Hard limit is **4 requests per minute**, so never call it from the browser and never per user request.
- Ingest bulk CSV/Parquet from `storage.data.gov.my` in a scheduled server job.
- Filter syntax is `<value>@<column>`, for example `ifilter=Petaling@district`. `filter=...` returns HTTP 400.
- `ghg_emissions` returns one row per source per date, and the `net` source has a **null** value. Filter on `source` or the total is double-counted.
- Cache normalized rows in Postgres; serve all UI reads from Postgres.
- Record `source_id`, `fetched_at`, `source_updated_at`, `checksum`, `row_count`.

### 2.2 Energy Commission GEF

- PDF only, no API. Extract the three regional values and their year during seeding; store the extracted row with the PDF URL, publication date, and a manual verification flag.
- Never parse the PDF at request time.
- A factor update is a reviewed pull request or admin action that creates a new immutable factor version.

### 2.3 Open-Meteo

- Server-side only, daily job for the pilot coordinates (Elmina, approximately 3.1804 N, 101.5173 E).
- Two calls per day maximum: archive daily/hourly for the calibration year cache, and air quality for the last 7 days.
- Compute cooling degree hours from hourly `temperature_2m` with base 24 °C for cooling; do not rely on agronomic degree-day variables.
- Attribution "Weather data by Open-Meteo.com" is mandatory, with a link, on any view using the data.
- Free tier is non-commercial. If the pilot commercialises, switch to the paid host and add a key server-side.
- The browser never calls these hosts directly: the climate panel reads a server-side snapshot (section 5.1).

### 2.4 World Bank

- Response shape is `[metadata, rows]`. The old indicator `EN.ATM.CO2E.PC` is retired and returns an error; use `EN.GHG.CO2.PC.CE.AR5`.
- Cache annually; serve from Postgres.

### 2.5 OSM-derived geography

- Extract once, offline, using Nominatim with a proper User-Agent and at most 1 request per second:
  - Elmina polygon: OSM way 866543395, `landuse=residential`, bbox 3.1602542,101.4924890,3.2135137,101.5288995.
  - Labelled in UI as "OSM-derived indicative boundary", not a gazetted township boundary.
- Split the polygon into 6 grid subzones (North, Central, West, East, South, Lake) and store them as static GeoJSON. Subzones are grid cells, not road-bounded neighbourhoods and not inferred from addresses.
- Extract POIs with a single Overpass query server-side, store as static GeoJSON in the repo or Supabase Storage. Do not call Overpass at runtime.
- Respect ODbL attribution: "© OpenStreetMap contributors".

### 2.6 Maps

- MapLibre GL JS with OpenFreeMap styles. No API key, commercial use permitted, attribution required.
- Do not use `tile.openstreetmap.org` in production; it forbids prefetch and offline caching.
- Never render household coordinates. Boundary, zone choropleth, and public POIs only.

## 3. Adapter contract

Every adapter implements:

```ts
type SourceResult<T> = {
  data: T;
  status: "live" | "cached" | "demo";
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  sourceId: string;
  checksum: string;
};

interface SourceAdapter<T> {
  id: string;
  fetch(): Promise<T>;
  normalize(raw: T): NormalizedRow[];
  validate(rows: NormalizedRow[]): ValidationReport;
  persist(rows: NormalizedRow[]): Promise<void>;
}
```

Rules:
- Adapters never throw into a page render. They return the last good cached value with `status: "cached"`, or a seeded value with `status: "demo"`.
- Validation failures keep the previous snapshot and raise an admin alert.
- All fetches use a 7–10 s timeout, one retry with jitter, and an identifying User-Agent (`CarbonPulse/0.1 (pilot)`).
- No adapter writes to tables read directly by households without a versioned snapshot swap.

### 3.1 Demo namespace in the adapter contract

- `status: "demo"` is only ever produced when `DEMO_MODE` is on and no live value exists.
- A demo value is never written into a real `source_snapshot` row. It is returned for the render only, with the Demo badge.
- Adapters and stores are separate paths: demo rows carry `is_demo = true` and live in the demo namespace; the domain aggregation excludes them from real statistics.
- Flipping the toggle or the env flag must never change a real median, a real count, or a real shared-goal value. This is asserted in the test matrix.

## 4. Ingestion jobs

| Job | Schedule | Sources | Output |
|---|---|---|---|
| `sync-national-energy` | Monthly, day 5 | S2, S3, S5 | `national_energy_monthly`, `national_energy_annual` |
| `sync-national-ghg` | Monthly | S4, S9 | `national_ghg_annual`, `air_quality_monthly` |
| `sync-context-stats` | Quarterly | S6, S7, S8, S12 | `context_stat` |
| `sync-weather` | Daily 03:00 MYT | S10, S11 | `weather_daily`, `weather_hourly_cache` |
| `recalibrate-intensity` | On model version change only | S10 plus config | `intensity_profile` |
| `rebuild-zones` | Hourly, and after a consent or deletion event | Internal | `zone_snapshot`, `comparison_snapshot`, shared-goal values |
| `purge-parse-buffers` | Hourly | Internal | Drop transient CSV parse buffers older than 1 hour |

Idempotency: each job writes one snapshot row keyed by `(source_id, period, checksum)` and
skips unchanged payloads. `rebuild-zones` inserts a new snapshot and never updates a
published row in place.

**No bill files are ever stored, so there is no upload cleanup job.** The only transient
artefact is the in-memory CSV parse buffer, which is discarded at the end of the request.
`purge-parse-buffers` exists solely to clear any buffer a crashed worker left behind.

## 5. Caching and freshness

### 5.1 Climate panel

- One server-side snapshot per render cycle, cached 15 minutes in a `globalThis` entry.
- `loadClimate(allowNetwork: false)` returns the recorded fallbacks with zero network calls and labels every value Fallback. This is the demo-mode path.
- Air quality is cached per precinct; a failed precinct keeps its last good value and is labelled Cached.
- The weather block, the global CO2 reference, and the per-precinct air quality are all **regional model estimates**, never a township sensor reading. Every one carries a source and a label.

### 5.2 Other layers

| Layer | TTL | Behaviour |
|---|---|---|
| Browser fetch of internal API | 60 s stale-while-revalidate | Show last value with timestamp |
| Postgres context tables | Until next successful sync | Serve regardless, badge age |
| Map tiles | 7 days | Standard HTTP caching, attribution always visible |
| Factor registry | Immutable | No TTL; explicit versioning |
| Weather | 24 h | Badge "Updated <date>" |

Freshness badge thresholds: Live under 2 days, Cached 2–45 days, Stale above 45 days with a
warning, Demo for seed data.

## 6. Fallback and offline demo

- Ship `seeds/demo/` with: 128 synthetic households across 6 subzones, 6 months of usage, factor versions, one calibrated intensity profile, Elmina boundary GeoJSON, 6 subzone polygons, 8 POIs, 8 content articles, and national context rows.
- A single env flag `DEMO_MODE=true` forces all adapters to seeded data and enables the demo namespace.
- **The demo cohort is not a silent substitute.** With demo mode off, a real zone below k shows the "Not enough data yet" state, not demo rows.
- The demo cohort is reachable in the UI only through the labelled toggle on the community page.
- The app must render every view with the network blocked except map tiles; the map shows a labelled fallback panel plus its data table.
- Demo households are stored with `is_demo = true` and excluded from every real aggregate query by a database view **and** by the domain aggregation function. Application logic is the second line of defence, not the only one.

## 7. Licensing and attribution checklist

| Source | Obligation |
|---|---|
| data.gov.my | Attribute dataset publisher and licence (CC BY 4.0 unless stated) |
| Energy Commission | Cite report title, year, provisional status, URL |
| Open-Meteo | "Weather data by Open-Meteo.com" with link; non-commercial free tier |
| World Bank | Attribute World Bank Open Data |
| OpenStreetMap / OpenFreeMap | "© OpenStreetMap contributors"; OpenFreeMap © OpenMapTiles |
| SDP programme figures | Cite the SDP report and year; label as programme context |
| Ember / other | Not used in MVP |

## 8. Prohibited patterns

- Browser calls to `api.data.gov.my`, Overpass, or the Energy Commission PDF.
- Runtime geocoding or autocomplete via Nominatim.
- Scraping GSO or TNB dashboards.
- Storing a bill image or any raw bill file.
- Serving demo rows in real aggregates, or using demo rows to fill a small real cohort.
- Presenting a cached value without its timestamp.
- Presenting a regional atmospheric model value as a township measurement.
- Deducting an SDP programme figure from a household estimate, or crediting a household estimate to that programme target.
