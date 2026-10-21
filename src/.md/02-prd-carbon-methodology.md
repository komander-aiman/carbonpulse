# PRD 02 — Carbon Methodology

Parent: `00-carbonpulse-index.md`
Implementation rule: no calculation ships until every formula here is covered by unit tests.

## 1. Scope and claims

CarbonPulse estimates **Scope 2 location-based** emissions from purchased electricity for
one household. It excludes transport, gas, waste, embodied emissions, and all Scope 3
categories.

### 1.1 Scope boundary table (D23)

| Surface | Accounting boundary | Input | Label |
|---|---|---|---|
| Resident estimate (flat) | Scope 2 location-based, purchased electricity | Confirmed monthly kWh | Estimated |
| Resident estimate (modelled) | Scope 2 location-based, time-matched | Confirmed kWh + archetype load shape | Modelled |
| Resident interval estimate | Scope 2 location-based, interval-timed | Recorded interval kWh | Modelled |
| Community zone statistics | Aggregate of household Scope 2 estimates | Consenting household kWh | Recorded + Estimated |
| Zone map shading | Same as zone statistics | Published zone median | Recorded + Estimated |
| Climate panel and timeline | None — atmospheric, air-quality, and programme context | Regional model feeds, SDP figures | Context |

The map has **no Scope 3 layer and no household scenario**. SDP programme figures appear
only in the climate panel's 1850–2030 timeline, labelled programme context, and are never
deducted from a household estimate. A decoupled "township Scope 3 Cat 11 scenario" survives
only as a documented future option; nothing in the shipped UI presents one.
| Climate panel | None — atmospheric and air-quality context | Regional model feeds | Context |

Never describe a resident figure as Scope 3, and never describe the township layer as a
household footprint. Market-based accounting, RECs, and offsets are out of scope.

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

Stored comparison values: Peninsular 2023 = 0.760, 2022 = 0.769; Sabah 2024 = 0.539;
Sarawak 2024 = 0.199. Sabah and Sarawak are not selectable for Elmina but remain in the
registry for future regions.

### 2.2 Versioning rules

- Every estimate row stores `factor_version_id`.
- A factor version is immutable once referenced. Corrections create a new version with `supersedes_id`.
- Recalculation is explicit, never silent. A household may view "recalculated with 2024 factor" and the delta.
- Historical displayed values keep the factor version used at the time, with an option to refresh.
- A factor change never rewrites community aggregates in place; aggregates store their factor version and are rebuilt as a new snapshot.

### 2.3 Consumption versus generation basis

The GEF is generation-based. Consumption-based Scope 2 would add transmission and
distribution losses. MVP uses the published GEF directly and states this in the method
panel. Do not silently apply a loss multiplier.

### 2.4 REC caveat

The GEF includes RE plants that may issue RECs. Results are location-based and must not be
described as market-based or "zero-carbon".

## 3. Flat-factor calculation

```
E_flat_kg = kWh_month * GEF_kg_per_kwh
```

Example: 300 kWh × 0.740 = 222.0 kg CO2e. This is the **headline** number.

Rules:
- Sum unrounded values, round only for display.
- `kWh_month` is the confirmed bill value, or the sum of intervals when both exist.
- If a billing period spans two months, attribute it to the period label, not to calendar months. Do not split unless interval data exists.
- Maximum accepted 3,000 kWh per month; above that flag for review rather than silently accepting.

## 4. Modelled hourly intensity

### 4.1 Model

Peninsular intensity varies with demand and solar output. Define hourly intensity:

```
I(h) = clamp( I_min, I_max, GEF * k * ( d(h) - s * sol(h) + b ) )
```

Where:
- `d(h)` is a normalized demand shape in [0,1], fixed per day type (weekday, Saturday, Sunday/holiday), derived from published TNB/GSO demand profile descriptions and stored as a config table.
- `sol(h)` is normalized clear-sky-adjusted solar irradiance in [0,1], averaged over a representative year by month and hour, with a monsoon seasonality scale.
- `s` is the solar suppression coefficient.
- `b` is a baseload offset controlling the overnight floor.
- `k` is a normalization constant solved by bisection so the demand-weighted annual mean of `I(h)` equals the active GEF.
- `I_min = 0.45`, `I_max = 1.00` bound the result.

`k` is solved at build/seed time, not at request time. The solved curve is stored as
`intensity_profile` rows: `model_version`, `month`, `hour`, `weekday_class`, `kg_per_kwh`.

### 4.2 Calibration constraint and honesty

Only one official aggregate (the annual GEF) is public. The shape is therefore **assumed**,
and only its weighted mean is anchored to an official value. Consequences that must be
reflected in the UI:

- The modelled value can differ from the flat value; the difference is an artefact of assumed shape plus the resident's load timing.
- The app must never present the delta as measured savings, and must never assume the delta is negative.
- The method panel must state: "Hourly intensity shape is modelled; its annual average is calibrated to the published 0.740 factor. Malaysia does not publish interval grid intensity."

### 4.3 Versioning

`model_version` includes a semantic version and calibration date, for example
`diurnal-1.0.0+2026-10`. Changing any coefficient, the solar seasonality scale, or the
bounds requires a new version and a changelog entry with the resulting mean and range.

### 4.4 Validation gates

- Annual demand-weighted mean within 0.0005 of GEF.
- No values outside [0.45, 1.00].
- Daytime mean below night-time mean for Peninsular (solar effect present).
- Evening peak (18:00–22:00) above the daily mean.
- No adjacent-hour jump above 0.08 kg CO2e/kWh.

Current profile: mean `0.739996`, range `0.607–0.931`, max adjacent jump `0.069`.

## 5. Household load shape

### 5.1 Inputs

Monthly kWh alone cannot determine timing. The app derives a load shape from the
questionnaire profile (PRD 07), which maps to one of four archetypes:

| Archetype | Meaning |
|---|---|
| `ac_evening` | Air conditioning concentrated in the evening and overnight |
| `ac_all_day` | Cooling runs through the afternoon as well as at night |
| `workday_absent` | Home empty on weekdays, with morning and evening peaks |
| `mixed` | A blend of daytime occupancy and evening cooling (default) |

### 5.2 Construction

- Allocate monthly kWh across 24 hours and day types using the archetype weights.
- Air-conditioning load is assigned to reported cooling hours; a night-time share is applied when the resident selects overnight cooling.
- Normalize the resulting shape so its monthly sum equals the recorded kWh exactly.
- Never allow the shape to change the monthly total. Only the intensity weighting changes.

### 5.3 Formula

```
E_modelled_kg = sum over h of ( kWh_month * w(h) * I(h) )
where sum(w(h)) = 1
```

The period is split into day buckets with `share = 1 / days.length`, each priced at its own
month and day-class intensity. With intervals, replace `kWh_month * w(h)` by actual interval kWh.

### 5.4 Determinism

Same household inputs, same model version, same factor version must yield identical output.
Randomness is not permitted. Ties in action ranking break by action id.

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

## 7. Target and goal (D18)

```
goal_kwh =
  1-2 confirmed periods  ->  round5( 0.90 * latest_confirmed_kwh )        [Provisional]
  3+ confirmed periods   ->  round5( 0.90 * median(trailing 3 periods) )   [Confirmed]
```

Worked examples:

| Case | Periods (kWh, oldest first) | Rule | Goal |
|---|---|---|---|
| One bill | 326 | 0.9 × 326 = 293.4 | 295 kWh, Provisional |
| Two bills | 300, 326 | 0.9 × 326 = 293.4 | 295 kWh, Provisional |
| Three bills | 300, 326, 310 | median 310 × 0.9 = 279 | 280 kWh, Confirmed |
| Four bills | 300, 326, 310, 280 | median of 326, 310, 280 = 310 → 279 | 280 kWh, Confirmed |

Rules:
- `round5(x) = Math.round(x / 5) * 5`.
- The provisional rule is applied to the latest confirmed period only, never to an average of one or two values.
- The active rule and the number of periods it used are always displayed.
- A goal is a target, not a forecast, and never a claim about savings.

## 8. Similar-home comparison (D16)

### 8.1 Profile band

```
band = home_type × size_band × aircon_band
size_band   ∈ { "1-2", "3-4", "5+" }
aircon_band ∈ { "0", "1-2", "3+" }
home_type   ∈ { "terrace", "apartment", "semi_d", "bungalow" }
```

A household with no completed questionnaire has no band and receives no comparison.

### 8.2 Tier ladder

| Tier | Match rule | Label shown |
|---|---|---|
| T1 | Same subzone and same profile band | "Similar homes in your zone" |
| T2 | Same subzone | "Households in your zone" |
| T3 | Same township (City of Elmina) | "Households in City of Elmina" |

- Evaluate T1, then T2, then T3. The first tier with n ≥ 5 is used.
- If no tier reaches 5, the comparison is suppressed; the card shows "Not enough data yet" and the profile-band explanation.
- The viewer's own record counts toward n. Excluding the viewer would make a group of exactly 5 look suppressed to every member.

### 8.3 Statistics published

| Value | Rule |
|---|---|
| `group_n` | Count, rounded to 5 |
| `median_kwh` | Median of the group, rounded to 5 |
| `p33_kwh`, `p67_kwh` | Thirds, rounded to 5 |
| `band` | `lower_third` if kwh < p33, `upper_third` if kwh > p67, else `middle_third` |
| `difference_kwh` | viewer kWh − group median, rounded to 5 |
| `difference_kg` | difference_kwh × active factor, 1 decimal |
| `tier` | T1, T2, or T3 |

Never published: a mean, another household's value, a rank, or a percentile finer than
thirds. The difference is descriptive, not a performance judgement, and the copy must say so.

## 9. Shared goal (D17)

Each consenting household has a goal from section 7. The zone's shared goal is the
aggregation of those goals:

```
zone_reference_kwh = sum(household confirmed kWh in the reference period)
zone_target_kwh    = sum(household goal_kwh)
zone_current_kwh   = sum(household confirmed kWh in the current period)
progress_pct       = clamp(0, 100, 100 * (zone_reference_kwh - zone_current_kwh)
                                    / (zone_reference_kwh - zone_target_kwh))
```

Worked example (5 homes, reference period totals 1,510 kWh, individual goals 270–295 kWh
summing to 1,390 kWh):

- Reference 1,510 kWh, target 1,390 kWh, required reduction 120 kWh.
- Current period totals 1,450 kWh → `(1510 − 1450) / (1510 − 1390) = 50%`.
- If the current period total is above the reference, progress is 0 and the bar states "above the shared goal" rather than a negative percentage.
- If `zone_reference_kwh == zone_target_kwh`, progress is undefined and the bar is hidden rather than dividing by zero.

Rules:
- A household's contribution to the shared goal uses exactly the same 10% rule as its personal goal.
- The shared goal is published only when the zone is published (k ≥ 5); otherwise the bar is suppressed with the same "Not enough data yet" copy.
- The bar shows the rounded reference, current, and target values, or a text equivalent for assistive technology.
- The shared goal is derived from consenting households only and is never mixed with the demo namespace.

## 10. Uncertainty and display

| Result | Displayed precision | Stated uncertainty |
|---|---|---|
| Flat factor | 1 decimal kg, 2 decimals t | Factor is provisional; no interval uncertainty claimed |
| Modelled time-matched | 1 decimal kg | Show a range of ±15% and the model version |
| Interval-timed | 1 decimal kg | Show ±15% intensity uncertainty and interval coverage |
| Zone statistics | kWh and counts to 5 | Descriptive aggregate, not a measurement |
| Shared goal | percent to whole numbers | Derived from household goals, not a forecast |

Display rules:
- Show the flat value first and larger; the modelled value second, with the delta labelled "modelled timing effect".
- If the absolute delta is below 2%, show "close to the annual-average estimate" instead of a large percentage.
- Never show a percentage reduction without its baseline and period.
- Tonnes only above 1,000 kg; below that use kg.
- Round only at display, never before summation. The one exception is that published cohort values are rounded to 5 by design (D24), after the aggregate is computed.

## 11. Worked examples

**Flat**: 326 kWh × 0.740 = 241.24 → 241.2 kg CO2e.

**Modelled (approved golden values, 300 kWh, September 2026)**:

| Archetype | Flat | Modelled | Delta |
|---|---|---|---|
| `ac_evening` | 222.0 kg | 227.3 kg | +5.3 kg (+2.4%) |
| `workday_absent` | 222.0 kg | 228.4 kg | +6.4 kg (+2.9%) |
| `mixed` | 222.0 kg | 223.2 kg | +1.2 kg (+0.5%) |
| `ac_all_day` | 222.0 kg | 219.5 kg | −2.5 kg (−1.1%) |

The delta is positive for evening-heavy homes because the evening peak is more
carbon-intensive than the annual average. The UI must never hardcode "time-matched means
lower" or a "you saved" arrow.

**Interval**: 1,440 half-hour rows, 99.2% coverage, sum 298.6 kWh, weighted intensity 0.755 → 225.4 kg. UI shows coverage and model version.

**Zone**: 128 consenting households, median 305 kWh, IQR 275–345 kWh. Count is published as 130. No mean is published.

**Shared goal**: see section 9.

## 12. Required tests

- Mean calibration test within tolerance for every model version.
- Bounds and smoothness tests for the intensity curve.
- Sum-preservation test: the modelled shape always sums to the recorded monthly kWh.
- Determinism test across repeated calls.
- Rounding test: display rounding never affects stored totals; cohort rounding is applied exactly once.
- Timezone and billing-period edge cases, including month-end and leap day.
- Interval validation: gaps, duplicates, unit errors, coverage threshold.
- Factor-version immutability and recalculation delta.
- Goal tests: provisional at 1 and 2 periods, confirmed at 3, even-length median, empty history.
- Comparison tests: band assignment, tier fallback, suppression at n = 4, no mean field, viewer counted.
- Shared-goal tests: worked example, clamping at 0 and 100, zero-denominator case, suppression below k.
- Golden-file tests for the four modelled values and the flat 222.0.

## 13. Method copy (approved wording)

- "Estimated: your confirmed kWh multiplied by the published Peninsular Malaysia grid emission factor for 2024 (0.740 kg CO2e/kWh, provisional)."
- "Modelled time-matched: assumes an hourly grid intensity shape whose annual average equals the published factor, combined with your reported routines. Malaysia does not publish interval grid intensity, so this is not a measured value."
- "Scenario: a hypothetical calculation from the inputs you choose. It is not a forecast or a measured community outcome."
- "Your goal is 10% below your recent usage. It is a target for the next bill, not a promise about what you will save."
- "Similar homes are a descriptive comparison with consenting households that match your profile. It is not a ranking and not a judgement."
