// POST /agent/session: hands a signed-in citizen a short-lived, single-use link to talk to Bolo (the ElevenLabs
// voice agent). The ElevenLabs key stays on this server. Bolo's tools are client tools that run in the citizen's own
// browser against the normal API with their own login, so nothing here can act on another citizen's behalf.
import { z } from "zod";
import type { AppInstance } from "../../types.js";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import { requireCitizenAuth } from "../auth/middleware.js";
import { SUPPORTED_LANGS } from "../../lib/languages.js";
import { AGENT_GREETING, AGENT_VOICES } from "./config.js";

const Body = z.object({ lang: z.enum(SUPPORTED_LANGS).default("hi") });

export function agentLangs(): string[] {
  return env.AGENT_LANGS.split(",").map((s) => s.trim()).filter(Boolean);
}

export function registerAgentRoutes(app: AppInstance) {
  // Tells the app whether Bolo exists at all, so it can hide the button instead of failing.
  app.get("/agent/status", async () => ({
    enabled: Boolean(env.ELEVEN_API_KEY && env.ELEVEN_AGENT_ID),
    languages: agentLangs(),
    maxSeconds: env.AGENT_SESSION_SECONDS,
  }));

  app.post(
    "/agent/session",
    { preValidation: [requireCitizenAuth], config: { rateLimit: { max: 10, timeWindow: "1 minute" } }, schema: { body: Body } },
    async (req, reply) => {
      const { lang } = req.body;
      if (!env.ELEVEN_API_KEY || !env.ELEVEN_AGENT_ID) {
        return reply.status(503).send({ error: "The voice helper is not set up", code: "AGENT_NOT_CONFIGURED" });
      }
      if (!agentLangs().includes(lang)) {
        return reply.status(422).send({ error: "The voice helper is not available in this language yet", code: "AGENT_LANG" });
      }
      const citizenId = req.citizen!.id;
      const used = await pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM agent_sessions WHERE citizen_id = $1 AND started_at > now() - interval '24 hours'`,
        [citizenId],
      );
      if (Number(used.rows[0]!.n) >= env.AGENT_DAILY_CAP) {
        return reply.status(429).send({ error: "You have used the voice helper enough for today", code: "AGENT_CAP" });
      }

      let signedUrl: string;
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(env.ELEVEN_AGENT_ID)}`,
          { headers: { "xi-api-key": env.ELEVEN_API_KEY }, signal: AbortSignal.timeout(8000) },
        );
        if (!res.ok) {
          req.log.error({ status: res.status }, "elevenlabs signed url failed");
          return reply.status(502).send({ error: "The voice helper is not reachable right now", code: "AGENT_UPSTREAM" });
        }
        signedUrl = ((await res.json()) as { signed_url?: string }).signed_url ?? "";
      } catch (err) {
        req.log.error({ err }, "elevenlabs signed url error");
        return reply.status(502).send({ error: "The voice helper is not reachable right now", code: "AGENT_UPSTREAM" });
      }
      if (!signedUrl) return reply.status(502).send({ error: "The voice helper is not reachable right now", code: "AGENT_UPSTREAM" });

      await pool.query(`INSERT INTO agent_sessions (citizen_id, lang) VALUES ($1, $2)`, [citizenId, lang]);
      return reply.send({
        signedUrl,
        maxSeconds: env.AGENT_SESSION_SECONDS,
        language: lang,
        firstMessage: AGENT_GREETING[lang],
        voiceId: AGENT_VOICES[lang],
        remainingToday: Math.max(0, env.AGENT_DAILY_CAP - Number(used.rows[0]!.n) - 1),
      });
    },
  );
}
