// Build map #C5 — deterministic routing: SQL lookup on (tenant, category,
// boundary), boundary-specific rule beats city-wide, no match -> triage.
// The LLM never sees this table; it only ever picks a category (Bible §3).
import { pool } from "../../db/client.js";

export interface RoutingResult {
  agencyId: string | null;
  department: { hi: string; en: string } | null;
  firstRole: string | null;
  needsHumanTriage: boolean;
}

export async function routeComplaint(
  tenantId: string,
  categoryCode: string,
  boundaryId: string | null,
): Promise<RoutingResult> {
  const res = await pool.query<{
    agency_id: string;
    department: { hi: string; en: string };
    first_role: string;
  }>(
    `SELECT agency_id, department, first_role
     FROM routing_rules
     WHERE tenant_id = $1
       AND category_code = $2
       AND (boundary_id = $3 OR boundary_id IS NULL)
     ORDER BY (boundary_id IS NULL) ASC, precedence DESC
     LIMIT 1`,
    [tenantId, categoryCode, boundaryId],
  );

  if (res.rows.length === 0) {
    return { agencyId: null, department: null, firstRole: null, needsHumanTriage: true };
  }

  const row = res.rows[0]!;
  return {
    agencyId: row.agency_id,
    department: row.department,
    firstRole: row.first_role,
    needsHumanTriage: false,
  };
}
