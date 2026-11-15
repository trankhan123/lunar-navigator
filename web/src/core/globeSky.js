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

/**
 * Straight line from a surface site out along the direction to a far body (the unit vector from the Moon's centre
 * to the body's sub-point; parallax ignored). Lengths are in Moon radii.
 * @returns {[number, number, number][]}  [latDeg, lonDeg, altitudeInRadii] from the surface to the tip
 */
export function rayPoints(siteLatDeg, siteLonDeg, bodyLatDeg, bodyLonDeg, lengthRadii, steps = 12) {
  const rad = Math.PI / 180
  const unit = (latDeg, lonDeg) => [Math.cos(latDeg * rad) * Math.cos(lonDeg * rad), Math.cos(latDeg * rad) * Math.sin(lonDeg * rad), Math.sin(latDeg * rad)]
  const start = unit(siteLatDeg, siteLonDeg)
  const direction = unit(bodyLatDeg, bodyLonDeg)
  return Array.from({ length: steps + 1 }, (_, step) => {
    const [x, y, z] = start.map((value, axis) => value + direction[axis] * lengthRadii * (step / steps))
    const radius = Math.hypot(x, y, z)
    return [Math.asin(z / radius) / rad, Math.atan2(y, x) / rad, radius - 1]
  })
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
