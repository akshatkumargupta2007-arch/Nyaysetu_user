import type { FastifyInstance, FastifyBaseLogger, RawServerDefault } from "fastify";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export type AppInstance = FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse,
  FastifyBaseLogger,
  ZodTypeProvider
>;
