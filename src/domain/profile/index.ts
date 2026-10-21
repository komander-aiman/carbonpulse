export type HomeType = "terrace" | "apartment" | "semi_d" | "bungalow";

export type Occupancy = "home_all_day" | "out_weekdays" | "evenings_only" | "varies";

export type CoolingHours = "none" | "night" | "evening" | "all_day";

export type WaterHeating = "none" | "instant" | "tank";

export type Appliance =
  | "fridge"
  | "washer"
  | "dryer"
  | "dishwasher"
  | "tv"
  | "console"
  | "water_pump";

export type SizeBand = "1-2" | "3-4" | "5+";
export type AirconBand = "0" | "1-2" | "3+";

export const QUESTIONNAIRE_VERSION = "profile-1.0.0";

export interface ProfileAnswers {
  readonly homeType: HomeType;
  readonly householdSize: number;
  readonly airconCount: number;
  readonly occupancy: Occupancy;
  readonly coolingHours: CoolingHours;
  readonly waterHeating: WaterHeating;
  readonly evCharging: boolean;
  readonly appliances: readonly Appliance[];
}

export interface HouseholdProfile extends ProfileAnswers {
  readonly version: string;
  readonly completedAt: string;
}

export type Archetype = "ac_evening" | "ac_all_day" | "workday_absent" | "mixed";

export interface ProfileBand {
  readonly homeType: HomeType;
  readonly sizeBand: SizeBand;
  readonly airconBand: AirconBand;
  /** Stable grouping key: `home_type|size_band|aircon_band`. */
  readonly key: string;
}

export interface ProfileSummary {
  readonly archetype: Archetype;
  readonly band: ProfileBand | null;
  /** `answered` when a profile exists, `default` when one was skipped. */
  readonly source: "answered" | "default";
  readonly version: string | null;
}

export const HOME_TYPE_LABELS: Readonly<Record<HomeType, string>> = {
  terrace: "Terrace house",
  apartment: "Apartment or condominium",
  semi_d: "Semi-detached",
  bungalow: "Bungalow",
};

export const OCCUPANCY_LABELS: Readonly<Record<Occupancy, string>> = {
  home_all_day: "Someone is home through the day",
  out_weekdays: "Out during weekdays",
  evenings_only: "Mainly evenings",
  varies: "It varies",
};

export const COOLING_LABELS: Readonly<Record<CoolingHours, string>> = {
  none: "We do not use air conditioning",
  night: "Mostly overnight",
  evening: "Mostly in the evening",
  all_day: "Through the day and night",
};

export const WATER_HEATING_LABELS: Readonly<Record<WaterHeating, string>> = {
  none: "No water heater",
  instant: "Instant heater",
  tank: "Storage tank",
};

export const APPLIANCE_LABELS: Readonly<Record<Appliance, string>> = {
  fridge: "Refrigerator",
  washer: "Washing machine",
  dryer: "Dryer",
  dishwasher: "Dishwasher",
  tv: "Television",
  console: "Games console",
  water_pump: "Water pump",
};

export const DEFAULT_ARCHETYPE: Archetype = "mixed";

export function sizeBand(householdSize: number): SizeBand {
  if (householdSize <= 2) return "1-2";
  if (householdSize <= 4) return "3-4";
  return "5+";
}

export function airconBand(airconCount: number): AirconBand {
  if (airconCount <= 0) return "0";
  if (airconCount <= 2) return "1-2";
  return "3+";
}

export function profileBand(answers: Pick<ProfileAnswers, "homeType" | "householdSize" | "airconCount">): ProfileBand {
  const size = sizeBand(answers.householdSize);
  const aircon = airconBand(answers.airconCount);
  return {
    homeType: answers.homeType,
    sizeBand: size,
    airconBand: aircon,
    key: `${answers.homeType}|${size}|${aircon}`,
  };
}

/**
 * Priority order matters and is documented in PRD 07 §3.1. The first match
 * wins, so a home with no air conditioning never receives a cooling archetype.
 */
export function archetypeFor(answers: ProfileAnswers): Archetype {
  if (answers.airconCount <= 0) return "mixed";
  if (answers.coolingHours === "all_day" || answers.occupancy === "home_all_day") return "ac_all_day";
  if (answers.occupancy === "out_weekdays" && (answers.coolingHours === "night" || answers.coolingHours === "evening")) {
    return "workday_absent";
  }
  if (answers.coolingHours === "night" || answers.coolingHours === "evening") return "ac_evening";
  return "mixed";
}

export function summarise(profile: HouseholdProfile | null): ProfileSummary {
  if (!profile) {
    return { archetype: DEFAULT_ARCHETYPE, band: null, source: "default", version: null };
  }
  return {
    archetype: archetypeFor(profile),
    band: profileBand(profile),
    source: "answered",
    version: profile.version,
  };
}

export function hasAppliance(answers: ProfileAnswers, appliance: Appliance): boolean {
  return answers.appliances.includes(appliance);
}

/**
 * Action eligibility is evaluated against the answers, not the archetype alone,
 * so two homes with the same archetype can receive different action sets.
 */
export function actionApplies(actionId: string, answers: ProfileAnswers | null): boolean {
  if (!answers) return true;
  const unknownAppliances = answers.appliances.length === 0;
  switch (actionId) {
    case "temperature":
    case "ac-servicing":
      return answers.airconCount > 0;
    case "timer":
      return answers.airconCount > 0 && (answers.coolingHours === "night" || answers.coolingHours === "all_day");
    case "standby":
      return unknownAppliances || hasAppliance(answers, "tv") || hasAppliance(answers, "console");
    case "led":
      return true;
    case "water-heater":
      return answers.waterHeating === "tank";
    case "appliance-schedule":
      return (
        hasAppliance(answers, "washer") ||
        hasAppliance(answers, "dryer") ||
        hasAppliance(answers, "dishwasher")
      );
    case "fridge-clearance":
      return unknownAppliances || hasAppliance(answers, "fridge");
    case "ev-offpeak":
      return answers.evCharging;
    default:
      return true;
  }
}

export function isProfileAnswers(value: unknown): value is ProfileAnswers {
  if (!value || typeof value !== "object") return false;
  const answers = value as Partial<ProfileAnswers>;
  return (
    typeof answers.homeType === "string" &&
    typeof answers.householdSize === "number" &&
    typeof answers.airconCount === "number" &&
    typeof answers.occupancy === "string" &&
    typeof answers.coolingHours === "string" &&
    typeof answers.waterHeating === "string" &&
    typeof answers.evCharging === "boolean" &&
    Array.isArray(answers.appliances)
  );
}
