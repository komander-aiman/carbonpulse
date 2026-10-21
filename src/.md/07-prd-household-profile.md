# PRD 07 — Household Profile, Similar Homes, and Comparison Copy

Parent: `00-carbonpulse-index.md`
Related: D15, D16, D18, D19, D21; PRD 02 §8; PRD 04 §3.

## 1. Purpose

The questionnaire is the input that makes the action plan specific and the comparison
meaningful. It is **not** a quiz, a score, or a test. It never changes a recorded kWh, never
creates an estimate, and never blocks the first bill.

This document defines:

1. the survey fields and their exact options,
2. the deterministic mapping from answers to archetype and action applicability,
3. the profile band and the similar-home matching ladder,
4. the display contract for a comparison,
5. the copy rules and worked examples,
6. the required unit tests.

## 2. Survey fields

| # | Field | Options | Required? | Effect | Storage |
|---|---|---|---|---|---|
| 1 | Home type | `terrace`, `apartment`, `semi_d`, `bungalow` | Yes | Profile band; slight prior on cooling load | `household_profile.home_type` |
| 2 | Household size | 1–20 (integer) | Yes | Profile band (`1-2`, `3-4`, `5+`) | `household_profile.household_size` |
| 3 | Air conditioners | 0–20 (integer) | Yes | Profile band (`0`, `1-2`, `3+`); cooling applicability | `household_profile.aircon_count` |
| 4 | Occupancy | `home_all_day`, `out_weekdays`, `evenings_only`, `varies` | Yes | Archetype (`ac_all_day` / `workday_absent` / `ac_evening` / `mixed`) | `household_profile.occupancy` |
| 5 | Cooling hours | `none`, `night`, `evening`, `all_day` | Yes | Refines archetype; cooling actions | `household_profile.cooling_hours` |
| 6 | Water heating | `none`, `instant`, `tank` | Yes | Hot-water actions | `household_profile.water_heating` |
| 7 | EV charging | boolean | Yes | Adds a scheduling action; no archetype change | `household_profile.ev_charging` |
| 8 | Appliance ownership | multi-select: `fridge`, `washer`, `dryer`, `dishwasher`, `tv`, `console`, `water_pump` | No (may be empty) | Refines scheduling and standby actions | `household_profile.appliances` |

Every answer is required except appliances; `Skip for now` bypasses the whole form and the
profile is treated as absent (not as `mixed` stored). The action plan then uses the default
archetype with an explicit "default" label.

Versioning: `questionnaire_version` is stored with the answers. A change to option values or
mapping rules must bump the version so an old profile remains interpretable.

## 3. Deterministic mapping

### 3.1 Archetype

Evaluate in order; the first match wins. No randomness, no scoring.

| Priority | Condition | Archetype |
|---|---|---|
| 1 | `aircon_count = 0` | `mixed` |
| 2 | `cooling_hours = all_day` or `occupancy = home_all_day` | `ac_all_day` |
| 3 | `occupancy = out_weekdays` and `cooling_hours ∈ {night, evening}` | `workday_absent` |
| 4 | `cooling_hours ∈ {night, evening}` | `ac_evening` |
| 5 | otherwise | `mixed` |

A missing profile maps to `mixed` and is reported as `source: "default"`, not as an answer.

### 3.2 Action applicability

An action is eligible when the profile satisfies its rule. Rules are evaluated against the
profile, not against the archetype alone, so two households with the same archetype can
receive different action sets.

| Action family | Eligible when | Notes |
|---|---|---|
| Cooling setpoint (`temperature`) | `aircon_count ≥ 1` | Never shown to a home with no aircon |
| Sleep timer (`timer`) | `aircon_count ≥ 1` and `cooling_hours ∈ {night, all_day}` | Overnight cooling only |
| Filter servicing (`ac-servicing`) | `aircon_count ≥ 1` | |
| Standby (`standby`) | `appliances` includes `tv` or `console`, or the list is empty (unknown) | Unknown is permissive but labelled |
| Lighting (`led`) | always | |
| Hot water (`water-heater`) | `water_heating = tank` | Instant heaters get a shorter-duration tip instead, not the tank action |
| Appliance scheduling (`appliance-schedule`) | `appliances` includes `washer`, `dryer`, or `dishwasher` | |
| Fridge clearance (`fridge-clearance`) | `appliances` includes `fridge` or the list is empty | |
| EV off-peak charging (`ev-offpeak`) | `ev_charging = true` | New action; added by this PRD |

## 4. Profile band

```
home_type   ∈ { terrace, apartment, semi_d, bungalow }
size_band   = household_size <= 2 ? "1-2"
            : household_size <= 4 ? "3-4"
            : "5+"
aircon_band = aircon_count === 0 ? "0"
            : aircon_count <= 2 ? "1-2"
            : "3+"
band        = `${home_type}|${size_band}|${aircon_band}`   // e.g. "apartment|1-2|0"
```

Rules:
- The band is derived, never stored as free text. Store the three inputs so the derivation can be re-run after a rule change.
- A profile with no answers has no band and receives no comparison.
- Changing an answer changes the band immediately; the resident's own history is unaffected.

## 5. Similar-home matching ladder

The ladder is evaluated against **consenting households with a confirmed record in the
same period**, in the same namespace (`real` or `demo`), never across namespaces.

| Tier | Group | Display label | Minimum |
|---|---|---|---|
| T1 | Same zone (subzone) **and** same profile band | "Similar homes in your zone" | n ≥ 5 |
| T2 | Same zone (subzone) | "Households in your zone" | n ≥ 5 |
| T3 | Same precinct (City of Elmina) | "Households in City of Elmina" | n ≥ 5 |

Evaluation order and rules:

1. Try T1. If its n ≥ 5, use it and stop.
2. Otherwise try T2. If its n ≥ 5, use it and stop.
3. Otherwise try T3. If its n ≥ 5, use it and stop.
4. If none reaches 5, the comparison is **suppressed**. Nothing is published, and the card shows the suppression copy in §7.
5. The viewer's own record is always included in the group. It is the viewer's own zone and band, so excluding them would make a group of exactly 5 report as suppressed to every member.
6. Only rows with an active consent, `confirmed = true`, `kwh > 0`, and the matching namespace may enter any tier.
7. A tier never mixes real and demo rows. If the demo toggle is on, the entire ladder runs in the demo namespace.

## 6. Comparison display contract

| Value | Type | Rule |
|---|---|---|
| `tier` | `T1 \| T2 \| T3` or null | Present whenever a comparison is shown |
| `tierLabel` | string | One of the labels in §5 |
| `groupN` | number | Rounded to 5 |
| `groupMedianKwh` | number | Rounded to 5 |
| `p33Kwh`, `p67Kwh` | number | Rounded to 5 |
| `band` | `lower_third \| middle_third \| upper_third \| suppressed` | Computed from p33/p67 |
| `differenceKwh` | number | viewer kWh − group median, rounded to 5 |
| `differenceKg` | number | differenceKwh × factor, 1 decimal |
| `suppressed` | boolean | When true, none of the numeric fields are serialised |

Never returned or rendered: a mean, another household's value, a rank, an exact
percentile, a group member list, or a "you are better than X%" claim.

The difference is **descriptive**: it describes where the resident's recorded usage sits
relative to a group median. It is not a score, a grade, or a judgement.

## 7. Copy rules

### 7.1 Suppression

> **Not enough data yet**
> Similar homes need at least 5 consenting households with a confirmed bill in this period.
> Your own bill still counts toward that group. Nothing about any household is published
> from a group smaller than 5.

### 7.2 T1 (band match)

> **Similar homes in your zone**
> You used **{difference} kWh** {more|less} than the median of **{groupN}** households with a
> similar home and household size in your zone. This is a descriptive comparison, not a
> rating.

### 7.3 T2 (zone only)

> **Households in your zone**
> We could not find 5 homes with your exact profile yet, so this compares you with
> **{groupN}** consenting households across your zone. Your usage is **{difference} kWh**
> {above|below} their median.

### 7.4 T3 (precinct only)

> **Households in City of Elmina**
> Your zone does not yet have enough matching households, so this compares you with
> **{groupN}** consenting households across City of Elmina.

### 7.5 No profile

> **Add your household profile** to compare with similar homes. It takes about a minute and
> you can skip any part of it.

### 7.6 Band labels

| Band | Copy |
|---|---|
| `lower_third` | Lower third of the group |
| `middle_third` | Middle third of the group |
| `upper_third` | Upper third of the group |
| `suppressed` | Not enough data yet |

### 7.7 Forbidden phrasing

- "You are more efficient than X households."
- "Better than average."
- "You saved X kWh compared with your neighbours."
- Any exact percentage rank.
- Any named household or address.

## 8. Worked examples

**Example 1 — T1 match.** Viewer: apartment, 2 people, 0 aircons, zone Elmina Central,
kWh 210. Consenting apartment / 1–2 / 0 homes in the zone: 6, median 230 kWh, p33 200,
p67 260. Tier T1 applies (n = 6 ≥ 5). Band: 210 > 200 and 210 < 260 → `middle_third`.
Difference: 210 − 230 = −20 kWh → "20 kWh less than the median of 5 households" (groupN
rounded to 5). Difference in kg: −20 × 0.740 = −14.8 kg.

**Example 2 — T2 fallback.** Same viewer, but the band group has only 3 homes. The zone
overall has 14 consenting homes, median 245 kWh. T2 applies (n = 15 rounded). Tier label
"Households in your zone". The copy says why the exact profile was not available.

**Example 3 — suppression.** A zone has 4 consenting homes and no tier reaches 5. The
comparison card shows only the §7.1 copy. No median, no difference, no band. The zone
statistics on the community page are suppressed with the same wording.

**Example 4 — no profile.** A resident confirms a bill and skips the questionnaire. The
comparison card shows the §7.5 copy and links to `/questionnaire`. The zone statistics are
still visible, because viewing does not require consent or a profile.

## 9. Required unit tests

- Mapping determinism: same answers always produce the same archetype, band, and eligibility set.
- Aircon-free home: no cooling action, archetype `mixed`.
- Occupancy mapping: each occupancy × cooling-hours pair maps to the expected archetype.
- Profile band: boundary values 2/3, 4/5, 0/1, 2/3 aircons.
- Tier fallback: T1 n = 4 and T2 n = 12 → T2; T1 n = 4 and T2 n = 4 and T3 n = 8 → T3.
- Suppression: all tiers below 5 → suppressed, with no numeric fields.
- Viewer counted: a group of exactly 5 including the viewer publishes.
- No mean: the comparison result type has no mean field, and the serialized payload contains none.
- Namespace isolation: a demo row never enters a real tier, and vice versa.
- Default: a missing profile produces `mixed` with `source: "default"` and no comparison.
- Copy: every tier label in §5 appears in the rendered contract; suppression copy is identical across the card, the map, and the shared goal.
