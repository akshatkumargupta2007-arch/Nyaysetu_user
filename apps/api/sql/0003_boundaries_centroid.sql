-- Bible §14 boundaries.centroid — a generated point used by the jurisdiction
-- resolver's nearest-centroid fallback (resolve.ts). Added as a raw-SQL
-- extra because it was missed in the initial Drizzle schema (schema.ts has
-- no `centroid` column) and caught only by the live integration test.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'boundaries' AND column_name = 'centroid'
  ) THEN
    ALTER TABLE boundaries ADD COLUMN centroid geometry(Point, 4326)
      GENERATED ALWAYS AS (ST_PointOnSurface(geom)) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS boundaries_centroid_idx ON boundaries USING gist (centroid);
