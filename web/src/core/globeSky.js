// W6 globe — where the Sun and Earth are overhead, straight from the ephemeris columns (same fields as C0).

/**
 * Sub-solar and sub-Earth points of one ephemeris hour.
 * @returns {{sun: {latDeg: number, lonDeg: number}, earth: {latDeg: number, lonDeg: number}}|null}  null for an hour outside the ephemeris
 */
export function subBodyPoints(ephemeris, hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour >= ephemeris.hours) return null
  return {
    sun: { latDeg: ephemeris.sunSubLatDeg[hour], lonDeg: ephemeris.sunSubLonDeg[hour] },
    earth: { latDeg: ephemeris.earthSubLatDeg[hour], lonDeg: ephemeris.earthSubLonDeg[hour] },
  }
}

/** Angle in degrees along the surface between two lat/lon points. */
export function angularDistanceDeg(latADeg, lonADeg, latBDeg, lonBDeg) {
  const rad = Math.PI / 180
  const cosine =
    Math.sin(latADeg * rad) * Math.sin(latBDeg * rad) +
    Math.cos(latADeg * rad) * Math.cos(latBDeg * rad) * Math.cos((lonADeg - lonBDeg) * rad)
  return Math.acos(Math.min(1, Math.max(-1, cosine))) / rad
}

/** The region whose centre is nearest to a clicked point and within maxDistanceDeg, else null. */
export function regionAtPoint(regions, latDeg, lonDeg, maxDistanceDeg) {
  let nearest = null
  let nearestDeg = maxDistanceDeg
  for (const region of regions) {
    const distanceDeg = angularDistanceDeg(region.lat, region.lon, latDeg, lonDeg)
    if (distanceDeg <= nearestDeg) [nearest, nearestDeg] = [region, distanceDeg]
  }
  return nearest
}
