// The "about N hours" the citizen sees on the Status screen.
//
// This is a realistic ESTIMATE of when the work will be done. It is NOT the official deadline (SLA): the SLA
// (sla_policies.resolve_hours, usually 24 to 48 h) is what officers are held to and what escalation and the gov
// portal's "past deadline" figures use. Showing it as the estimate made a power cut look like a 47 hour job.
//
// How the estimate is made, in plain terms:
//   1. Every category has a typical time for the crew to do the job once they arrive (TYPICAL_HOURS below):
//        quick on-the-spot jobs (live wire, power cut, fallen tree, open manhole)        2 to 4 h
//        a crew and some material (leak, blocked drain, streetlight, garbage pile-up)  6 to 12 h
//        scheduled or inspected work (potholes, footpaths, parks, illegal building)      24 to 72 h
//   2. Urgent complaints go first: Critical x0.5, High x0.75, Medium x1, Low x1.5.
//   3. It is never longer than the official SLA, and never shorter than 1 hour.
//   4. It counts down from when the complaint was filed. If the estimate has passed but the job is still open
//      and the deadline has not, we show "about 1 hour" rather than an old, wrong number.
//   5. Nothing is shown once work is done, the ticket is closed, or the SLA deadline has passed.
import type { State } from "./types.js";

/** Typical hours from the complaint to finished work, by category (Bhilai taxonomy). */
export const TYPICAL_HOURS: Record<string, number> = {
  // electricity
  ELEC_OUTAGE: 3, ELEC_LIVE_WIRE: 2, ELEC_TRANSFORMER_SPARK: 3, ELEC_VOLTAGE_FLUCTUATION: 4, ELEC_BILLING: 24,
  // street lights
  LIGHT_SINGLE_OUT: 6, LIGHT_AREA_DARK: 8, LIGHT_DAYTIME_ON: 6, LIGHT_POLE_DAMAGED: 12, LIGHT_HIGH_MAST_BROKEN: 24,
  // water
  WATER_NO_SUPPLY: 4, WATER_CONTAMINATED: 4, WATER_PIPELINE_LEAK: 8, WATER_LOW_PRESSURE: 12, WATER_ILLEGAL_CONNECTION: 48,
  // drains and sewage
  DRAIN_OPEN_MANHOLE: 3, DRAIN_BLOCKED: 8, DRAIN_SEWAGE_OVERFLOW: 6, DRAIN_SEWAGE_IN_DRINKING_WATER: 6, DRAIN_ILLEGAL_DISCHARGE: 48,
  // solid waste
  SW_UNCOLLECTED: 12, SW_DEAD_ANIMAL: 4, SW_BURNING: 3, SW_DUSTBIN_OVERFLOW: 8, SW_SWEEPER_ABSENT: 12,
  // roads
  ROAD_POTHOLE: 48, ROAD_CAVED_IN: 24, ROAD_BROKEN_FOOTPATH: 72, ROAD_WATERLOGGING: 6, ROAD_DEBRIS: 8,
  // health and sanitation
  HEALTH_MOSQUITO_FOGGING: 24, HEALTH_UNCLEAN_TOILET: 8, HEALTH_MEDICAL_WASTE: 6, HEALTH_PUBLIC_URINATION: 24, HEALTH_UNHYGIENIC_VENDOR: 24,
  // traffic
  TRAFFIC_SIGNAL_DOWN: 4, TRAFFIC_ABANDONED_VEHICLE: 48, TRAFFIC_UNAUTHORIZED_PARKING: 6, TRAFFIC_BUS_SHELTER_DAMAGED: 72, TRAFFIC_MISSING_SIGNAGE: 48,
  // parks and trees
  PARK_BROKEN_EQUIPMENT: 48, PARK_UNKEMPT: 24, PARK_TREE_FALLEN: 6, PARK_TREE_PRUNING: 48, PARK_ENCROACHMENT: 72,
  // building and planning (needs an inspection first)
  PLAN_UNAUTHORIZED_CONSTRUCTION: 72, PLAN_DANGEROUS_BUILDING: 24, PLAN_COMMERCIAL_IN_RESIDENTIAL: 72, PLAN_ILLEGAL_HOARDING: 48, PLAN_CELL_TOWER: 72,
  // public amenities
  AMENITY_CREMATORIUM: 12, AMENITY_PUBLIC_TAP_BROKEN: 12, AMENITY_UNHYGIENIC_MARKET: 24, AMENITY_STRAY_CATTLE: 12, AMENITY_COMMUNITY_HALL: 48,
  // animals
  ANIMAL_STRAY_DOG: 12, ANIMAL_DEAD_LARGE: 6, ANIMAL_ILLEGAL_SLAUGHTER: 24, ANIMAL_MONKEY_MENACE: 24, ANIMAL_CRUELTY: 12,
  OTHER_CIVIC: 24,
};
export const DEFAULT_TYPICAL_HOURS = 24;

const PRIORITY_FACTOR: Record<string, number> = { Critical: 0.5, High: 0.75, Medium: 1, Low: 1.5 };
const HOUR_MS = 3_600_000;
/** No estimate once the work is finished or the complaint is over. */
const NO_ETA_STATES = new Set<string>(["WORK_DONE_PENDING_CONFIRMATION", "CLOSED_CONFIRMED", "CLOSED_UNCONFIRMED", "REJECTED_NOT_CIVIC"]);

export interface EtaInput {
  categoryCode: string;
  priorityBand?: string | null;
  state: State | string;
  createdAt: Date | string | null;
  slaDueAt: Date | string | null;
  now?: Date;
}

/** Hours of work the whole job is expected to take, before counting down. */
export function estimateTotalHours(categoryCode: string, priorityBand?: string | null, slaHours?: number): number {
  const base = TYPICAL_HOURS[categoryCode] ?? DEFAULT_TYPICAL_HOURS;
  const factor = PRIORITY_FACTOR[priorityBand ?? "Medium"] ?? 1;
  let hours = base * factor;
  if (slaHours !== undefined && slaHours > 0) hours = Math.min(hours, slaHours);
  return Math.max(1, hours);
}

/** Whole hours still to go, or null when no estimate should be shown. */
export function etaHoursRemaining(i: EtaInput): number | null {
  if (NO_ETA_STATES.has(i.state)) return null;
  if (!i.slaDueAt) return null;
  const now = (i.now ?? new Date()).getTime();
  const due = new Date(i.slaDueAt).getTime();
  if (!(due > now)) return null; // past the official deadline: do not invent a promise
  const created = i.createdAt ? new Date(i.createdAt).getTime() : now;
  const slaHours = Math.max(1, (due - created) / HOUR_MS);
  const total = estimateTotalHours(i.categoryCode, i.priorityBand, slaHours);
  const left = total - (now - created) / HOUR_MS;
  const capped = Math.min(left, (due - now) / HOUR_MS); // never promise beyond the deadline
  return Math.max(1, Math.ceil(capped));
}

/** The text the app already understands: it reads the first number as hours. */
export function etaText(i: EtaInput): string | null {
  const h = etaHoursRemaining(i);
  return h === null ? null : `लगभग ${h} घंटे`;
}
