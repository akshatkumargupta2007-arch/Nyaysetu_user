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

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import type { AppInstance } from "../../types.js";
import { parsePhotoDataUrl } from "./photoStore.js";
import { assessPhoto, type PhotoAssessment } from "./photoCheck.js";

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

  // POST /uploads/photo: the fallback when Cloudinary is not configured. The app sends the (already resized)
  // picture as a data URL; we check it really is a picture and keep it in our own database. The id we hand back is
  // used exactly like a Cloudinary public id (it goes into /reports/confirm as photoPublicId).
  app.post<{ Body: { dataUrl?: unknown; aiMarker?: unknown } }>(
    "/uploads/photo",
    { preValidation: [requireCitizenAuth], bodyLimit: 4_000_000, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
      const photo = parsePhotoDataUrl(dataUrl);
      if (!photo) return reply.status(400).send({ error: "That is not a usable photo", code: "BAD_PHOTO" });
      // The same check the app already ran when the photo was chosen: this is the one that cannot be skipped.
      const a = await assessPhoto(photo.bytes, photo.mime, req.citizen!.id, { aiMarker: req.body?.aiMarker === true });
      if (!a.allowed) return reply.status(422).send(rejection(a));
      const publicId = `local_${randomUUID()}`;
      await pool.query(
        `INSERT INTO media_blobs (public_id, citizen_id, mime, bytes, data, sha256, check_verdict, check_confidence, check_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [publicId, req.citizen!.id, photo.mime, photo.bytes.length, photo.bytes, a.sha256, a.verdict, a.confidence, a.reason],
      );
      return reply.status(201).send({ photoPublicId: publicId, check: a.verdict });
    },
  );

  // POST /uploads/photo/check: is this a real photo? Asked as soon as the person picks a picture, so a fake is turned
  // away on the spot instead of after the whole form. Stores nothing. It works with or without Cloudinary.
  app.post<{ Body: { dataUrl?: unknown; aiMarker?: unknown } }>(
    "/uploads/photo/check",
    { preValidation: [requireCitizenAuth], bodyLimit: 4_000_000, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const photo = parsePhotoDataUrl(typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "");
      if (!photo) return reply.status(400).send({ error: "That is not a usable photo", code: "BAD_PHOTO" });
      const a = await assessPhoto(photo.bytes, photo.mime, req.citizen!.id, { aiMarker: req.body?.aiMarker === true });
      if (!a.allowed) return reply.status(422).send(rejection(a));
      return reply.send({ ok: true, check: a.verdict });
    },
  );
};

/** What the app is told when a photo is turned away. The reason is for the citizen, in plain words. */
function rejection(a: PhotoAssessment) {
  return {
    error: a.refusal === "REUSED" ? "This picture was already used by someone else. Please take a new photo." : "This does not look like a real photo of the place. Please take a new photo.",
    code: "PHOTO_REJECTED",
    why: a.refusal === "REUSED" ? "reused" : "not_real",
    verdict: a.verdict,
  };
}
