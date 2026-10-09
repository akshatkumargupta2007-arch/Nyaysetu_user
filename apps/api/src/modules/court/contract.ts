import { createHash } from "node:crypto";
import { z } from "zod";
import { ALLOWED_TYPES, CRITERION_TYPES, EVIDENCE_KINDS, INSUFFICIENT_KINDS, defaultClaim, familyOf, templateCriteria, type Contract, type Family } from "./catalogue.js";

const criterionSchema = z.object({
  id: z.string().regex(/^c[1-4]$/),
  type: z.enum(CRITERION_TYPES),
  requirement: z.string().min(8).max(240),
  required_evidence: z.array(z.enum(EVIDENCE_KINDS)).min(1).max(3),
  insufficient_if: z.array(z.enum(INSUFFICIENT_KINDS)).max(4),
  needs_darkness: z.boolean().optional(),
});
export const contractSchema = z.object({
  claim: z.string().min(8).max(300),
  criteria: z.array(criterionSchema).min(2).max(4),
  falsifier: z.string().min(8).max(240),
});
export type ContractDraft = z.infer<typeof contractSchema>;

/** The JSON Schema we hand to Gemini so its answer already has this shape. */
export const CONTRACT_JSON_SCHEMA = {
  type: "object",
  properties: {
    claim: { type: "string" },
    criteria: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, type: { type: "string", enum: [...CRITERION_TYPES] }, requirement: { type: "string" },
      required_evidence: { type: "array", items: { type: "string", enum: [...EVIDENCE_KINDS] } },
      insufficient_if: { type: "array", items: { type: "string", enum: [...INSUFFICIENT_KINDS] } },
      needs_darkness: { type: "boolean" },
    }, required: ["id", "type", "requirement", "required_evidence", "insufficient_if"] } },
    falsifier: { type: "string" },
  },
  required: ["claim", "criteria", "falsifier"],
};

const CONSEQUENCE_WORDS = /flood|waterlog|paani|पानी|भर|dark|andhera|अंधेरा|raat|रात|smell|badbu|बदबू|overflow|ubal|उफन|accident/i;

/** Meaning checks the schema cannot do. Throws on a contract we will not freeze. */
export function validateContractMeaning(draft: ContractDraft, family: Family, complaintText: string): void {
  const allowed = new Set(ALLOWED_TYPES[family]);
  const ids = new Set<string>();
  for (const c of draft.criteria) {
    if (!allowed.has(c.type)) throw new Error(`criterion type ${c.type} is not allowed for ${family}`);
    if (ids.has(c.id)) throw new Error(`duplicate criterion id ${c.id}`);
    ids.add(c.id);
    if (c.needs_darkness && c.type !== "operation") throw new Error("needs_darkness only applies to operation criteria");
  }
  if (!draft.criteria.some((c) => c.type === "identity")) throw new Error("a contract needs an identity criterion");
  if (CONSEQUENCE_WORDS.test(complaintText) && !draft.criteria.some((c) => c.type === "outcome" || c.type === "operation")) {
    throw new Error("the complaint names a consequence, so the contract needs an outcome or operation criterion");
  }
  if (family === "light" && !draft.criteria.some((c) => c.needs_darkness)) throw new Error("a streetlight contract must require darkness");
}

export function templateContract(ticketId: string, categoryCode: string, complaintText: string, version = 1): Contract {
  const family = familyOf(categoryCode);
  return {
    contract_version: version, ticket_id: ticketId, category: categoryCode, claim: defaultClaim(family, complaintText),
    criteria: templateCriteria(family), falsifier: "A single observation that shows the reported problem is still there.",
  };
}

export function toContract(draft: ContractDraft, ticketId: string, categoryCode: string, version: number): Contract {
  return { contract_version: version, ticket_id: ticketId, category: categoryCode, claim: draft.claim, criteria: draft.criteria, falsifier: draft.falsifier };
}

/** Canonical JSON (sorted keys) so the same contract always hashes the same. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
export const contractHash = (c: Contract): string => createHash("sha256").update(canonicalJson(c)).digest("hex");
