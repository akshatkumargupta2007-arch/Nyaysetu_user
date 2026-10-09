// Small helpers to turn GeoJSON coordinates into EWKT text. PostGIS's
// `geometry` type parses EWKT text directly on INSERT (no ST_GeomFromGeoJSON
// round-trip needed), so these strings can be passed straight as column
// values through Drizzle's customType (declared as `data: string`).
export type GeoJSONMultiPolygon = { type: "MultiPolygon"; coordinates: number[][][][] };
export type GeoJSONPoint = { type: "Point"; coordinates: [number, number] };

export function multiPolygonToEWKT(geom: GeoJSONMultiPolygon): string {
  const polys = geom.coordinates
    .map(
      (poly) =>
        "(" +
        poly
          .map((ring) => "(" + ring.map(([lng, lat]) => `${lng} ${lat}`).join(",") + ")")
          .join(",") +
        ")",
    )
    .join(",");
  return `SRID=4326;MULTIPOLYGON(${polys})`;
}

export function pointToEWKT(geom: GeoJSONPoint): string {
  const [lng, lat] = geom.coordinates;
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export function latLngToEWKT(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}
