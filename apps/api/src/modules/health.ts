import { z } from "zod";
import type { AppInstance } from "../types.js";

export function registerHealthRoutes(
  app: AppInstance,
  healthCheck: () => Promise<boolean>,
) {
  app.get(
    "/healthz",
    {
      schema: {
        response: {
          200: z.object({ ok: z.boolean(), db: z.enum(["ok", "down"]) }),
          503: z.object({ ok: z.boolean(), db: z.enum(["ok", "down"]) }),
        },
      },
    },
    async (_req, reply) => {
      const dbOk = await healthCheck();
      const body = { ok: dbOk, db: dbOk ? ("ok" as const) : ("down" as const) };
      reply.status(dbOk ? 200 : 503).send(body);
    },
  );
}
