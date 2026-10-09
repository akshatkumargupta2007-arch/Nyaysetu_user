// Shared H3 resolution-9 (~175m edge) indexing — used by the demo/history
// seed and by Phase C's dedup candidate pre-filter (#C7).
import { latLngToCell, gridDisk } from "h3-js";

export const H3_RESOLUTION = 9;

export function h3ForPoint(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

/** The cell plus its immediate ring (7 cells total) — the dedup pre-filter. */
export function h3RingForPoint(lat: number, lng: number): string[] {
  const cell = h3ForPoint(lat, lng);
  return gridDisk(cell, 1);
}
