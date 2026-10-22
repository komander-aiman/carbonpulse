import type { FactorVersion } from "../carbon/types";
import { getActiveFactor } from "../carbon/factors";
import {
  rankActions,
  type ActionCategory,
  type HouseholdActionState,
  type RankedAction,
} from "../actions";
import {
  WATER_HEATING_LABELS,
  archetypeFor,
  type ProfileAnswers,
} from "../profile";

export type ExploreAreaId = "bedroom" | "living" | "kitchen" | "bathroom" | "lighting";

export interface ExploreAction extends RankedAction {
  readonly area: ExploreAreaId;
  readonly state: HouseholdActionState;
}

export interface ExploreArea {
  readonly id: ExploreAreaId;
  readonly label: string;
  readonly description: string;
  readonly actions: readonly ExploreAction[];
  readonly emptyTitle: string;
  readonly emptyBody: string;
}

export interface ExploreModel {
  readonly areas: readonly ExploreArea[];
  readonly actionCount: number;
  readonly tailored: boolean;
  readonly archetype: string;
  readonly profileVersion: string | null;
  readonly evidenceVersions: readonly string[];
  readonly factorId: string;
  readonly factorKgPerKwh: number;
}

/**
 * Categories map to the room where the action is usually taken. Transport is
 * intentionally absent: home charging is not part of the room illustration.
 */
const AREA_FOR_CATEGORY: Readonly<Record<ActionCategory, ExploreAreaId | null>> = {
  cooling: "bedroom",
  standby: "living",
  appliance_scheduling: "kitchen",
  hot_water: "bathroom",
  lighting: "lighting",
  transport: null,
};

const AREA_COPY: Readonly<
  Record<ExploreAreaId, { label: string; description: string }>
> = {
  bedroom: {
    label: "Bedroom",
    description: "Cooling choices for the room you sleep in.",
  },
  living: {
    label: "Living room",
    description: "Entertainment, chargers and devices left on standby.",
  },
  kitchen: {
    label: "Kitchen",
    description: "Cold storage and the heavy appliance loads.",
  },
  bathroom: {
    label: "Bathroom",
    description: "Water heating for showers and washing.",
  },
  lighting: {
    label: "Lighting",
    description: "The lamps used most after dark.",
  },
};

const AREA_ORDER: readonly ExploreAreaId[] = ["bedroom", "living", "kitchen", "bathroom", "lighting"];

function hasAppliance(answers: ProfileAnswers, appliance: ProfileAnswers["appliances"][number]): boolean {
  return answers.appliances.includes(appliance);
}

function emptyGuidance(
  area: ExploreAreaId,
  profile: ProfileAnswers | null,
): { title: string; body: string } {
  switch (area) {
    case "bedroom":
      if (profile && profile.airconCount <= 0) {
        return {
          title: "No cooling action for this home",
          body: "Your household profile says there is no air conditioning, so bedroom cooling actions are hidden. Update the profile if that changes.",
        };
      }
      if (profile) {
        return {
          title: "No cooling action is matched",
          body: "The current evidence catalog does not include a cooling action for your household's modelled routine. The action plan uses the same filter, so it hides these too.",
        };
      }
      return {
        title: "No cooling action matches yet",
        body: "Nothing in the current evidence catalog applies to this room for your answers.",
      };
    case "bathroom":
      if (profile && profile.waterHeating !== "tank") {
        return {
          title: "No water-heating action for this home",
          body: `Your household profile records: ${WATER_HEATING_LABELS[profile.waterHeating].toLowerCase()}. The current evidence catalog only covers homes with a storage tank.`,
        };
      }
      return {
        title: "No water-heating action matches yet",
        body: "Nothing in the current evidence catalog applies to this room for your answers.",
      };
    case "living":
      if (profile && profile.appliances.length > 0 && !hasAppliance(profile, "tv") && !hasAppliance(profile, "console")) {
        return {
          title: "No standby action for the listed devices",
          body: "Your household profile lists no television or games console, so the standby action is hidden. Update the profile if you add one.",
        };
      }
      return {
        title: "No standby action matches yet",
        body: "Nothing in the current evidence catalog applies to this room for your answers.",
      };
    case "kitchen": {
      const kitchenAppliances = ["fridge", "washer", "dryer", "dishwasher"] as const;
      const unknown = !profile || profile.appliances.length === 0;
      if (profile && !unknown && !kitchenAppliances.some((appliance) => hasAppliance(profile, appliance))) {
        return {
          title: "No kitchen action for the listed appliances",
          body: "Your household profile lists none of the refrigerator, washing machine, dryer or dishwasher. Update the profile if that changes.",
        };
      }
      return {
        title: "No kitchen action matches yet",
        body: "Nothing in the current evidence catalog applies to this room for your answers.",
      };
    }
    case "lighting":
      return {
        title: "No lighting action matches yet",
        body: "Nothing in the current evidence catalog applies to lighting for your answers.",
      };
  }
}

export type ExploreProfile = ProfileAnswers & { readonly version?: string };

/**
 * Builds the room guide from the same ranked, profile-filtered action catalog
 * used by the action plan. It deliberately does not split recorded kWh by room:
 * a monthly bill cannot support an appliance-level breakdown.
 */
export function buildExploreModel(input: {
  readonly profile: ExploreProfile | null;
  readonly factor?: FactorVersion;
  readonly actionStates?: readonly { readonly actionId: string; readonly state: HouseholdActionState }[];
}): ExploreModel {
  const factor = input.factor ?? getActiveFactor();
  const answers = input.profile;
  const archetype = answers ? archetypeFor(answers) : "mixed";
  const stateById = new Map(input.actionStates?.map((action) => [action.actionId, action.state]) ?? []);
  const ranked = rankActions(archetype, factor, answers);

  const grouped = new Map<ExploreAreaId, ExploreAction[]>();
  const dismissedByArea = new Map<ExploreAreaId, number>();
  for (const area of AREA_ORDER) grouped.set(area, []);

  for (const action of ranked) {
    const area = AREA_FOR_CATEGORY[action.category];
    if (!area) continue;
    const state = stateById.get(action.id) ?? "suggested";
    // "Not for me" hides an action from the plan; the room guide mirrors it.
    if (state === "dismissed") {
      dismissedByArea.set(area, (dismissedByArea.get(area) ?? 0) + 1);
      continue;
    }
    grouped.get(area)?.push({
      ...action,
      area,
      state,
    });
  }

  const areas: ExploreArea[] = AREA_ORDER.map((id) => {
    const copy = AREA_COPY[id];
    const actions = grouped.get(id) ?? [];
    const dismissed = dismissedByArea.get(id) ?? 0;
    const empty =
      actions.length === 0 && dismissed > 0
        ? {
            title: "Every action in this room is set aside",
            body: "You marked these actions “Not for me”. Restore them from the action plan if your circumstances change.",
          }
        : emptyGuidance(id, input.profile);
    return {
      id,
      ...copy,
      actions,
      emptyTitle: empty.title,
      emptyBody: empty.body,
    };
  });

  return {
    areas,
    actionCount: areas.reduce((total, area) => total + area.actions.length, 0),
    tailored: input.profile !== null,
    archetype,
    profileVersion: input.profile?.version ?? null,
    evidenceVersions: [...new Set(areas.flatMap((area) => area.actions.map((action) => action.evidenceVersion)))],
    factorId: factor.id,
    factorKgPerKwh: factor.kgPerKwh,
  };
}

