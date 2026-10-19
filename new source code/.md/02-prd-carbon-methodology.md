# PRD 02 — Carbon Methodology

Parent: `1792434273536-00-carbonpulse-index.md`
Implementation rule: no calculation ships until every formula here is covered by unit tests.

## 1. Scope and claims

CarbonPulse estimates **Scope 2 location-based** emissions from purchased electricity for one household. It excludes transport, gas, waste, and embodied emissions.

Three result types must never be conflated:

| Type | Input | Intensity used | Label |
|---|---|---|---|
| Flat-factor estimate | Monthly kWh | One annual GEF | Estimated |
| Modelled time-matched | Monthly kWh + load-shape profile | Hourly modelled intensity | Modelled |
| Interval-timed | Half-hourly or hourly kWh | Hourly modelled intensity | Modelled (interval consumption recorded) |

There is no measured intraday intensity source for Peninsular Malaysia. Every interval result pairs recorded consumption with modelled intensity and must say so.

## 2. Factor registry

### 2.1 Active factor

| Field | Value |
|---|---|
| Region | Peninsular Malaysia |
| Year | 2024 |
| Value | 0.740 kg CO2e/kWh |
| Status | Provisional |
| Basis | Generation-weighted average, main activity producers, Tier 1 factors, net generation |
| Publisher | Energy Commission of Malaysia (Suruhanjaya Tenaga), MyEnergyStats |
| Publication date | 2026-02-23 |
| Numeric cross-check | 110,555 Gg CO2e / 149,301 GWh = 0.7405 |

Stored comparison values: Peninsular 2023 = 0.760, 2022 = 0.769; Sabah 2024 = 0.539; Sarawak 2024 = 0.199. Sabah and Sarawak are not selectable for Elmina but must remain in the registry for future regions.

### 2.2 Versioning rules

- Every estimate row stores `factor_version_id`.
- A factor version is immutable once referenced. Corrections create a new version with `supersedes_id`.
- Recalculation is explicit, never silent. A household may view "recalculated with 2024 factor" and the delta.
- Historical displayed values keep the factor version used at the time, with an option to refresh.
- A factor change never rewrites community aggregates in place; aggregates store their factor version and are rebuilt as a new snapshot.

### 2.3 Consumption versus generation basis

The GEF is generation-based. Consumption-based Scope 2 would add transmission and distribution losses. MVP uses the published GEF directly and states this in the method panel. Do not silently apply a loss multiplier.

### 2.4 REC caveat

The GEF includes RE plants that may issue RECs. Results are location-based and must not be described as market-based or "zero-carbon".

## 3. Flat-factor calculation

```
E_flat_kg = kWh_month * GEF_kg_per_kwh
```

Example: 300 kWh × 0.740 = 222.0 kg CO2e.

Rules:
- Sum unrounded values, round only for display.
- `kWh_month` is the confirmed bill value, or the sum of intervals when both exist.
- If a billing period spans two months, attribute to the period label, not to calendar months. Do not split unless interval data exists.
- Maximum accepted 3,000 kWh per month; above that flag for review rather than silently accepting.

## 4. Modelled hourly intensity

### 4.1 Model

Peninsular intensity varies with demand and solar output. Define hourly intensity:

```
I(h) = clamp( I_min, I_max, GEF * k * ( d(h) - s * sol(h) + b ) )
```

Where:
- `d(h)` is a normalized demand shape in [0,1], fixed per day type (weekday, Saturday, Sunday/holiday), derived from published TNB/GSO demand profile descriptions and stored as a config table.
- `sol(h)` is normalized clear-sky-adjusted solar irradiance in [0,1] from Open-Meteo archived shortwave radiation for the pilot coordinates, averaged over a representative recent year by month and hour.
- `s` is the solar suppression coefficient.
- `b` is a baseload offset controlling the overnight floor.
- `k` is a normalization constant chosen so the generation-weighted annual mean of `I(h)` equals the active GEF exactly.
- `I_min`, `I_max` bound the result to plausible values (initial bounds: 0.45 and 1.00 kg CO2e/kWh).

`k` is solved numerically at build/seed time, not at request time. The solved curve is stored as `intensity_profile` rows: `model_version`, `month`, `hour`, `weekday_class`, `kg_per_kwh`.

### 4.2 Calibration constraint and honesty

Only one official aggregate (the annual GEF) is public. The shape is therefore **assumed**, and only its weighted mean is anchored to an official value. Consequences that must be reflected in the UI:

- The modelled value can differ from the flat value; the difference is an artefact of assumed shape plus the resident's load timing.
- The app must never present the delta as measured savings.
- The method panel must state: "Hourly intensity shape is modelled; its annual average is calibrated to the published 0.740 factor. Malaysia does not publish interval grid intensity."

### 4.3 Versioning

`model_version` includes a semantic version and calibration date, for example `diurnal-1.0.0+2026-10`. Changing any coefficient, the solar source year, or the bounds requires a new version and a changelog entry with the resulting mean and range.

### 4.4 Validation gates

- Annual generation-weighted mean within 0.0005 of GEF.
- No negative values; bounds respected.
- Daytime mean below night-time mean for Peninsular (solar effect present).
- Evening peak (18:00–22:00) above daily mean.
- Curve smooth: no adjacent-hour jump above 0.08 kg CO2e/kWh unless documented as a config exception.

## 5. Household load shape

### 5.1 Inputs

Monthly kWh alone cannot determine timing. The app derives a load shape from:

1. Appliance and routine survey: air-conditioning hours, occupancy pattern, water heating, EV charging, fridge, entertainment standby.
2. Default archetypes when the survey is skipped: `ac_evening`, `ac_all_day`, `workday_absent`, `mixed`.

### 5.2 Construction

- Allocate monthly kWh across 24 hours and day types using the archetype weights, adjusted by survey answers.
- Air-conditioning load is assigned to reported cooling hours; a night-time share is applied when the resident selects overnight cooling.
- Normalize the resulting shape so its monthly sum equals the recorded kWh exactly.
- Never allow the shape to change the monthly total. Only the intensity weighting changes.

### 5.3 Formula

```
E_modelled_kg = sum over h of ( kWh_month * w(h) * I(h) )
where sum(w(h)) = 1
```

With intervals, replace `kWh_month * w(h)` by actual interval kWh.

### 5.4 Determinism

Same household inputs, same model version, same factor version must yield identical output. Randomness is not permitted. Ties in action ranking break by action id.

## 6. Interval-timed calculation

```
E_interval_kg = sum over intervals of ( kWh_i * I(t_i) )
```

Rules:
- Timestamps normalized to Asia/Kuala_Lumpur (UTC+8, no DST).
- Interval duration inferred from timestamps; reject gaps above 2 hours and duplicate timestamps.
- Allow up to 2% missing intervals; fill with the profile value and flag coverage.
- Flag readings above 50 kWh per half hour as probable unit errors (Wh mistaken for kWh) and block save until confirmed.
- Store coverage percent and render it next to the result.

## 7. Uncertainty and display

| Result | Displayed precision | Stated uncertainty |
|---|---|---|
| Flat factor | 1 decimal kg, 2 decimals t | Factor is provisional; no interval uncertainty claimed |
| Modelled time-matched | 1 decimal kg | Show a range of ±15% and the model version |
| Interval-timed | 1 decimal kg | Show ±15% intensity uncertainty and interval coverage |

Display rules:
- Show the flat value first, the modelled value second, with the delta labelled "modelled timing effect".
- If the absolute delta is below 2%, show "close to the annual-average estimate" instead of a large percentage.
- Never show a percentage reduction without its baseline and period.
- Tonnes only above 1,000 kg; below that use kg.

## 8. Target and action savings

- Household target = round_to_5(trailing_3_month_median × 0.90).
- Action savings come from a versioned evidence table with `kwh_low`, `kwh_high`, `source`, `applies_to`, `confidence`.
- Action CO2e range = savings range × the same factor version.
- Aggregated plan potential is the sum of selected actions, capped at 35% of baseline, with the cap disclosed.
- Completing an action records intent. It never creates a "saved" kWh or CO2e value. Savings are only reported when a later recorded period is lower, and then as an association, not attribution.

## 9. Worked examples

**Flat**: 326 kWh × 0.740 = 241.24 → 241.2 kg CO2e.

**Modelled**: 300 kWh, archetype `ac_evening`, intensity curve mean 0.740 with evening values above mean. Because more load falls in high-intensity hours, result 231.4 kg versus flat 222.0 kg, delta +9.4 kg (+4.2%). UI states: "Modelled timing effect: +9.4 kg CO2e, because your estimated use is concentrated in higher-intensity evening hours."

**Interval**: 1,440 half-hour rows, 99.2% coverage, sum 298.6 kWh, weighted intensity 0.755 → 225.4 kg. UI shows coverage and model version.

**Community**: 128 consenting households, median 305 kWh. Scenario 200 × 10% × 300 kWh × 0.740 / 1000 = 4.44 t CO2e per month. 200 is a user-set scenario input, not the cohort count.

## 10. Required tests

- Mean calibration test within tolerance for every model version.
- Monotonicity and bounds tests for the intensity curve.
- Sum-preservation test: modelled shape always sums to the recorded monthly kWh.
- Determinism test across repeated calls.
- Rounding test: display rounding never affects stored totals.
- Timezone and billing-period edge cases, including month-end and leap day.
- Interval validation: gaps, duplicates, unit errors, coverage threshold.
- Factor-version immutability and recalculation delta.
- Golden-file tests for the four worked examples.

## 11. Method copy (approved wording)

- "Estimated: your confirmed kWh multiplied by the published Peninsular Malaysia grid emission factor for 2024 (0.740 kg CO2e/kWh, provisional)."
- "Modelled time-matched: assumes an hourly grid intensity shape whose annual average equals the published factor, combined with your reported routines. Malaysia does not publish interval grid intensity, so this is not a measured value."
- "Scenario: a hypothetical calculation from the inputs you choose. It is not a forecast or a measured community outcome."
