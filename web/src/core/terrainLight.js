// W2 3D terrain view: scene axes are x = PGDA x (east on the map), y = up, z = −PGDA y (docs/technical-reference.md D4 map-angle rule).
const DEG = Math.PI / 180

/** Unit vector from the ground towards a body at azimuthDeg (clockwise from north) and elevationDeg, seen from longitude lonDeg. */
export function sunLightDirection(azimuthDeg, elevationDeg, lonDeg) {
  const mapAngle = (azimuthDeg + lonDeg) * DEG
  const horizontal = Math.cos(elevationDeg * DEG)
  return [Math.sin(mapAngle) * horizontal, Math.sin(elevationDeg * DEG), -Math.cos(mapAngle) * horizontal]
}
