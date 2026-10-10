// Build map #A5 — the Fastify app, assembled but not listening (so tests can
// build it without binding a port).
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { FastifyError } from "fastify";
import { env } from "./env.js";
import { reqSerializer } from "./lib/logRedact.js";
import { healthCheck } from "./db/client.js";
import { registerHealthRoutes } from "./modules/health.js";
import { registerReportRoutes } from "./modules/reports/routes.js";
import { registerCaptureRoutes } from "./modules/capture/routes.js";
import { registerUploadRoutes } from "./modules/uploads/routes.js";
import { registerJurisdictionRoutes } from "./modules/jurisdiction/routes.js";
import { registerSessionRoutes } from "./modules/session/routes.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerLifecycleRoutes } from "./modules/lifecycle/routes.js";
import { registerOfficerRoutes } from "./modules/officers/routes.js";
import { registerVoiceRoutes } from "./modules/voice/routes.js";
import { registerCourtRoutes } from "./modules/court/routes.js";
import fastifyJwt from "@fastify/jwt";
import type { AppInstance } from "./types.js";

export async function buildApp(): Promise<AppInstance> {
  // Fastify builds its own pino instance here (rather than us constructing
  // one and passing loggerInstance) so its internal types line up cleanly
  // with @fastify/*'s FastifyBaseLogger. src/lib/log.ts is for standalone
  // scripts (seed, eval) that never touch a Fastify instance.
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
      serializers: { req: reqSerializer }, // never log the ?token= of the live streams
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
          : undefined,
    },
    genReqId: () => crypto.randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // PUBLIC_WEB_ORIGIN may list several origins, comma-separated. Outside production, also allow
  // localhost and private-network addresses so a phone on the same Wi-Fi can use the dev server.
  const allowedOrigins = env.PUBLIC_WEB_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  const lanOrigin = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/;
  await app.register(cors, {
    origin: (origin, cb) =>
      cb(null, !origin || allowedOrigins.includes(origin) || (env.NODE_ENV !== "production" && lanOrigin.test(origin))),
  });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  await app.register(rateLimit, {
    global: false, // each route group opts in with its own limits (Bible §17.6, §19)
    max: 100,
    timeWindow: "1 minute",
  });

  app.setErrorHandler((err: FastifyError, _req, reply) => {
    app.log.error(err);
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    reply.status(status).send({
      error: status >= 500 ? "Internal server error" : err.message,
      code: err.code ?? "ERROR",
    });
  });

  // Allow raw binary bodies (needed by POST /voice/transcribe when the client
  // sends audio/* Content-Type directly, e.g. in tests and curl probes).
  app.addContentTypeParser(
    /^audio\//,
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  // multipart/form-data is also consumed as a raw buffer so our lightweight
  // parseMultipartAudio() helper can split out the audio field.
  app.addContentTypeParser(
    "multipart/form-data",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  registerHealthRoutes(app, healthCheck);
  registerReportRoutes(app);
  registerCaptureRoutes(app);
  registerUploadRoutes(app);
  registerJurisdictionRoutes(app);
  registerAuthRoutes(app);
  registerSessionRoutes(app);
  registerLifecycleRoutes(app);
  registerOfficerRoutes(app);
  registerVoiceRoutes(app);
  registerCourtRoutes(app);

  return app;
}
