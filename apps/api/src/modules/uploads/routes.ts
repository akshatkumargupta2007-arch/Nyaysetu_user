// Build map #D5 / Bible §17.5 — POST /uploads/sign
// Cloudinary direct upload signature endpoint.
//
// The browser uploads images directly to Cloudinary so the NyaySetu API never
// touches image bytes. This route generates an authenticated SHA-1 signature
// using CLOUDINARY_API_SECRET.
//
// If CLOUDINARY_API_KEY is not configured (local dev / mock mode), this returns
// a simulated signature payload so the frontend can operate in local preview
// mode without breaking or failing.

import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "../../env.js";
import type { AppInstance } from "../../types.js";

const SignRequestSchema = z.object({
  folder: z.string().optional().default("nyaysetu/reports"),
});

export interface SignResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  simulated: boolean;
}

import { requireCitizenAuth } from "../auth/middleware.js";

export function registerUploadRoutes(app: AppInstance) {
  app.post<{ Body: z.infer<typeof SignRequestSchema> }>(
    "/uploads/sign",
    {
      preValidation: [requireCitizenAuth],
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const parsed = SignRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid sign request",
          code: "INVALID_BODY",
          details: parsed.error.format(),
        });
      }

      const folder = parsed.data.folder;
      const timestamp = Math.floor(Date.now() / 1000);

      // If Cloudinary is not configured, return a mock payload for local dev
      if (!env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_CLOUD_NAME) {
        const mockResponse: SignResponse = {
          signature: "simulated_local_signature",
          timestamp,
          apiKey: "simulated_key",
          cloudName: "simulated_cloud",
          folder,
          simulated: true,
        };
        return reply.status(200).send(mockResponse);
      }

      // Cloudinary signature convention:
      // Sort all parameters to be signed alphabetically by key, format as "key=val&key=val",
      // append api_secret, then compute SHA-1 hex digest.
      const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
      const toHash = `${paramsToSign}${env.CLOUDINARY_API_SECRET}`;
      const signature = createHash("sha1").update(toHash).digest("hex");

      const response: SignResponse = {
        signature,
        timestamp,
        apiKey: env.CLOUDINARY_API_KEY,
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        folder,
        simulated: false,
      };

      return reply.status(200).send(response);
    },
  );
};
