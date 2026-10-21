/**
 * Elmina geography. The boundary is an OSM-derived approximation
 * (way 866543395), not a gazetted township boundary, and is labelled as such
 * everywhere it is displayed.
 */
export const ELMINA_BOUNDARY = {
  type: "Feature" as const,
  properties: {
    name: "City of Elmina",
    source: "OSM way 866543395",
    official: false,
  },
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [101.492489, 3.1602542],
        [101.5288995, 3.1675],
        [101.5261, 3.2001],
        [101.5158, 3.2135137],
        [101.4982, 3.2079],
        [101.492489, 3.1872],
        [101.492489, 3.1602542],
      ],
    ],
  },
};

export const ELMINA_CENTRE: readonly [number, number] = [101.5173, 3.1804];

export interface Subzone {
  readonly id: string;
  readonly name: string;
  readonly geojson: {
    readonly type: "Feature";
    readonly properties: { readonly name: string };
    readonly geometry: {
      readonly type: "Polygon";
      readonly coordinates: number[][][];
    };
  };
}

function box(
  id: string,
  name: string,
  west: number,
  south: number,
  east: number,
  north: number,
): Subzone {
  return {
    id,
    name,
    geojson: {
      type: "Feature",
      properties: { name },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      },
    },
  };
}

export const SUBZONES: readonly Subzone[] = [
  box("elmina-north", "Elmina North", 101.4925, 3.1872, 101.5104, 3.2135),
  box("elmina-central", "Elmina Central", 101.5104, 3.1872, 101.5289, 3.2135),
  box("elmina-west", "Elmina West", 101.4925, 3.1738, 101.5104, 3.1872),
  box("elmina-east", "Elmina East", 101.5104, 3.1738, 101.5289, 3.1872),
  box("elmina-south", "Elmina South", 101.4925, 3.1603, 101.5104, 3.1738),
  box("elmina-lake", "Elmina Lake", 101.5104, 3.1603, 101.5289, 3.1738),
];

export interface Poi {
  readonly id: string;
  readonly name: string;
  readonly category: "park" | "transit" | "recycling" | "community";
  readonly coordinates: readonly [number, number];
  readonly source: string;
}

export const POIS: readonly Poi[] = [
  { id: "poi-1", name: "Elmina Central Park", category: "park", coordinates: [101.5152, 3.1871], source: "OSM" },
  { id: "poi-2", name: "Elmina Lakeside", category: "park", coordinates: [101.5198, 3.1652], source: "OSM" },
  { id: "poi-3", name: "Elmina Community Hall", category: "community", coordinates: [101.5091, 3.1924], source: "OSM" },
  { id: "poi-4", name: "Elmina Recycling Point", category: "recycling", coordinates: [101.5042, 3.1801], source: "OSM" },
  { id: "poi-5", name: "Elmina Bus Stop (North)", category: "transit", coordinates: [101.5068, 3.2043], source: "OSM" },
  { id: "poi-6", name: "Elmina Bus Stop (South)", category: "transit", coordinates: [101.5219, 3.1688], source: "OSM" },
  { id: "poi-7", name: "Elmina Sports Court", category: "community", coordinates: [101.5241, 3.1955], source: "OSM" },
  { id: "poi-8", name: "Elmina Neighbourhood Garden", category: "park", coordinates: [101.4972, 3.1756], source: "OSM" },
];
