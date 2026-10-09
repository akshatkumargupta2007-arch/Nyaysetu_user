import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    officer?: {
      id: string;
      tenantId: string;
      agencyId: string;
      role: string;
      level: number;
    };
  }
}

export async function requireOfficerAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
    // req.user will be populated by jwtVerify if the token is valid.
    // we map req.user to req.officer for typed access.
    const claims = req.user as { kind?: string };
    if (claims.kind !== "officer") {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    req.officer = req.user as any;
  } catch (err) {
    reply.status(401).send({ error: "Unauthorized" });
  }
}
