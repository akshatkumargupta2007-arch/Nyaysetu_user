// Is it dark at a place and time? Pure maths (NOAA-style solar position), no network, no model. Used by gate G5.
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Sun elevation above the horizon in degrees (negative = below). */
export function solarElevation(at: Date, lat: number, lng: number): number {
  const jd = at.getTime() / 86_400_000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = rad((357.528 + 0.9856003 * n) % 360);
  const lambda = rad(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const eps = rad(23.439 - 0.0000004 * n);
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = rad((((gmst * 15 + lng) % 360) + 360) % 360);
  const ha = lst - ra;
  const latR = rad(lat);
  return deg(Math.asin(Math.sin(latR) * Math.sin(dec) + Math.cos(latR) * Math.cos(dec) * Math.cos(ha)));
}

/** "Dark enough to judge a streetlight": the sun is more than 6 degrees below the horizon (past civil twilight). */
export const isDark = (at: Date, lat: number, lng: number): boolean => solarElevation(at, lat, lng) < -6;
export const isDaylight = (at: Date, lat: number, lng: number): boolean => solarElevation(at, lat, lng) > 0;
