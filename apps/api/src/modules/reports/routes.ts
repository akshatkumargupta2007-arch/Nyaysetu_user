// Build map #C10 — exposes the orchestrator as POST /reports/understand.
// Photo upload (Cloudinary signing, EXIF) is Phase D's capture module; this
// route accepts text + coordinates only for now, which is enough to
// exercise and test the full engine end to end over real HTTP.
import { z } from "zod";
import type { AppInstance } from "../../types.js";
import { optionalCitizenAuth } from "../auth/middleware.js";
import { SUPPORTED_LANGS } from "../../lib/languages.js";
import { understandReport } from "../intelligence/orchestrate.js";

const UnderstandBody = z.object({
  // Text is mandatory (a photo alone can't be understood). Voice counts: it is transcribed first.
  text: z.string().trim().min(3, "text is required").max(2000),
  lang: z.enum(SUPPORTED_LANGS).default("hi"),
  inputMode: z.enum(["voice", "text"]).default("text"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export function registerReportRoutes(app: AppInstance) {
  app.post(
    "/reports/understand",
    {
      preValidation: [optionalCitizenAuth],
      // Bible §17.6 / §19: the AI endpoints get their own stricter limit,
      // separate from the default per the global:false setting in app.ts.
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        body: UnderstandBody,
      },
    },
    async (req, reply) => {
      try {
        const result = await understandReport(req.body);
        reply.send(result);
      } catch (err) {
        if (err instanceof Error && err.message.includes("No tenant covers")) {
          reply.status(422).send({ error: err.message, code: "NO_JURISDICTION" });
          return;
        }
        throw err;
      }
    },
  );
}
