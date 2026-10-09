// Build map #D6 / #C3 — GET /jurisdiction/resolve
// Reverse-labels (lat, lng) coordinates into boundary names and nearby landmarks
// for the citizen-facing location chip on the report screen.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { resolveJurisdiction, type JurisdictionResult } from "./resolve.js";
import type { AppInstance } from "../../types.js";

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export interface JurisdictionResolveResponse {
  tenantId: string | null;
  boundaryId: string | null;
  boundaryName: { hi: string; en: string } | null;
  ownerAgencyId: string | null;
  method: string;
  nearbyPois: Array<{ kind: string; name: string; distanceM: number }>;
  label: { hi: string; en: string };
}

export function formatLocationLabel(
  result: JurisdictionResult,
  lat: number,
  lng: number,
): { hi: string; en: string } {
  const boundaryHi = result.boundaryName?.hi;
  const boundaryEn = result.boundaryName?.en;
  const poi = result.nearbyPois[0];

  if (poi && (boundaryHi || boundaryEn)) {
    return {
      hi: `${poi.name} के पास · ${boundaryHi ?? boundaryEn}`,
      en: `Near ${poi.name} · ${boundaryEn ?? boundaryHi}`,
    };
  }

  if (boundaryHi || boundaryEn) {
    return {
      hi: boundaryHi ?? boundaryEn!,
      en: boundaryEn ?? boundaryHi!,
    };
  }

  if (poi) {
    return {
      hi: `${poi.name} के पास`,
      en: `Near ${poi.name}`,
    };
  }

  return {
    hi: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    en: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  };
}

export function registerJurisdictionRoutes(app: AppInstance) {
  app.get<{ Querystring: z.infer<typeof QuerySchema> }>(
    "/jurisdiction/resolve",
    {
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const parsed = QuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid lat/lng parameters",
          code: "INVALID_COORDINATES",
          details: parsed.error.format(),
        });
      }

      const { lat, lng } = parsed.data;

      try {
        const resolved = await resolveJurisdiction(lat, lng);
        const label = formatLocationLabel(resolved, lat, lng);

        const response: JurisdictionResolveResponse = {
          tenantId: resolved.tenantId,
          boundaryId: resolved.boundaryId,
          boundaryName: resolved.boundaryName,
          ownerAgencyId: resolved.ownerAgencyId,
          method: resolved.method,
          nearbyPois: resolved.nearbyPois,
          label,
        };

        return reply.status(200).send(response);
      } catch (err) {
        // Fallback for when Postgres is offline / starting up
        const fallbackResult: JurisdictionResult = {
          tenantId: "cg.bhilai",
          boundaryId: null,
          boundaryName: null,
          ownerAgencyId: null,
          method: "none",
          nearbyPois: [],
        };
        const label = formatLocationLabel(fallbackResult, lat, lng);

        return reply.status(200).send({
          ...fallbackResult,
          label,
        });
      }
    },
  );
}
