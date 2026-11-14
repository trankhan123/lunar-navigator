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
  const lat = cell.lat * DEG
  const lon = cell.lon * DEG
  const cellRadiusKm = MOON_RADIUS_KM + cell.heightM / 1000
  const up = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
  const east = [-Math.sin(lon), Math.cos(lon), 0]
  const north = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)] // up × east
  const subLat = subLatDeg * DEG
  const subLon = subLonDeg * DEG
  const toBody = [
    distanceKm * Math.cos(subLat) * Math.cos(subLon) - cellRadiusKm * up[0],
    distanceKm * Math.cos(subLat) * Math.sin(subLon) - cellRadiusKm * up[1],
    distanceKm * Math.sin(subLat) - cellRadiusKm * up[2],
  ]
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  // Clamp: rounding can push the ratio to 1 + ε when the body is exactly overhead, and asin would return NaN.
  const elevationDeg = Math.asin(Math.min(1, Math.max(-1, dot(toBody, up) / Math.sqrt(dot(toBody, toBody))))) / DEG
  const azimuthDeg = (Math.atan2(dot(toBody, east), dot(toBody, north)) / DEG + 360) % 360
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
