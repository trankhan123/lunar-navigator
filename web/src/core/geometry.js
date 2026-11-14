// C0 — shared geometry. Contract: README "C0 Shared geometry and time series".

export const MOON_RADIUS_KM = 1737.4
export const SUN_RADIUS_KM = 696000
export const EARTH_RADIUS_KM = 6371
export const AU_KM = 149597870.7
export const SUN_DISK_RADIUS_DEG = 0.27
export const EARTH_DISK_RADIUS_DEG = 0.95
// A body counts as visible (sunlit / Earth in view) when at least this share of its disk is above the horizon.
export const VISIBLE_THRESHOLD = 0.5
const DEG = Math.PI / 180

/**
 * Azimuth/elevation of the Sun or Earth seen from a cell (window-finder.md §4.3).
 * @param {{lat:number, lon:number, heightM:number}} cell  lon East-positive, heightM above the 1737.4 km sphere
 * @param {number} subLonDeg  sub-body point longitude on the Moon (East-positive)
 * @param {number} subLatDeg  sub-body point latitude
 * @param {number} distanceKm  Moon centre → body centre
 * @returns {{azimuthDeg:number, elevationDeg:number}}  azimuth 0 ≤ az < 360, clockwise from North
 */
export function bodyAzimuthElevation(cell, subLonDeg, subLatDeg, distanceKm) {
  // Plain numbers, no arrays: C1/C2 call this once per hour per cell (millions of times in a search).
  const lat = cell.lat * DEG
  const lon = cell.lon * DEG
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon)
  const cosLon = Math.cos(lon)
  const cellRadiusKm = MOON_RADIUS_KM + cell.heightM / 1000
  const cosSubLat = Math.cos(subLatDeg * DEG)
  // d = B − P in Moon-fixed coordinates
  const dx = distanceKm * cosSubLat * Math.cos(subLonDeg * DEG) - cellRadiusKm * cosLat * cosLon
  const dy = distanceKm * cosSubLat * Math.sin(subLonDeg * DEG) - cellRadiusKm * cosLat * sinLon
  const dz = distanceKm * Math.sin(subLatDeg * DEG) - cellRadiusKm * sinLat
  const up = dx * cosLat * cosLon + dy * cosLat * sinLon + dz * sinLat
  const east = -dx * sinLon + dy * cosLon
  const north = -dx * sinLat * cosLon - dy * sinLat * sinLon + dz * cosLat // up × east
  // Clamp: rounding can push the ratio to 1 + ε when the body is exactly overhead, and asin would return NaN.
  const elevationDeg = Math.asin(Math.min(1, Math.max(-1, up / Math.sqrt(dx * dx + dy * dy + dz * dz)))) / DEG
  const azimuthDeg = (Math.atan2(east, north) / DEG + 360) % 360
  return { azimuthDeg, elevationDeg }
}

/**
 * Terrain horizon elevation at any azimuth, linear between whole degrees, wrapping 359 → 0.
 * @param {number[]|null} horizon  360 integers in 0.1° units (index k = azimuth k°); null = smooth sphere (0°)
 * @param {number} azimuthDeg
 * @returns {number} degrees
 */
export function horizonElevationAt(horizon, azimuthDeg) {
  if (!horizon) return 0
  const wrapped = ((azimuthDeg % 360) + 360) % 360
  const lower = Math.floor(wrapped) % 360
  const share = wrapped - Math.floor(wrapped)
  return (horizon[lower] * (1 - share) + horizon[(lower + 1) % 360] * share) / 10
}

/**
 * Share of a disk above the horizon: clamp((el − H + ρ) / 2ρ, 0, 1).
 * @returns {number} 0..1
 */
export function visibleDiskFraction(elevationDeg, horizonDeg, diskRadiusDeg) {
  return Math.min(1, Math.max(0, (elevationDeg - horizonDeg + diskRadiusDeg) / (2 * diskRadiusDeg)))
}

/**
 * Great-circle distance on the 1737.4 km sphere.
 * @param {{lat:number, lon:number}} a
 * @param {{lat:number, lon:number}} b
 * @returns {number} km
 */
export function distanceKm(a, b) {
  const halfDeltaLat = ((b.lat - a.lat) * DEG) / 2
  const halfDeltaLon = ((b.lon - a.lon) * DEG) / 2
  const h = Math.sin(halfDeltaLat) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(halfDeltaLon) ** 2
  return 2 * MOON_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}
