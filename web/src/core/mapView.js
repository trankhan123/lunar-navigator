// W2 map v2 — where things are on screen. Map point (xM, yM) in PGDA metres is drawn at SVG (xM, −yM).
export const VIEW_HALF_WIDTH_M = 304000
export const VIEW_SIZE_M = 2 * VIEW_HALF_WIDTH_M
export const VIEW_BOX = `${-VIEW_HALF_WIDTH_M} ${-VIEW_HALF_WIDTH_M} ${VIEW_SIZE_M} ${VIEW_SIZE_M}`
export const WHOLE_MAP_BOUNDS_M = [-VIEW_HALF_WIDTH_M, -VIEW_HALF_WIDTH_M, VIEW_HALF_WIDTH_M, VIEW_HALF_WIDTH_M]
export const MAX_ZOOM_SCALE = 300

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

/**
 * Zoom transform (SVG user units, for zoomIdentity.translate(x, y).scale(k)) that centres boundsM and fits its wider side.
 * @param {number[]} boundsM  [xMin, yMin, xMax, yMax] in PGDA metres
 * @param {number} paddingFraction  share of the view left empty around the bounds
 * @returns {{k: number, x: number, y: number}}
 */
export function fitTransform([xMin, yMin, xMax, yMax], paddingFraction) {
  const fitScale = Math.min(VIEW_SIZE_M / (xMax - xMin), VIEW_SIZE_M / (yMax - yMin)) * (1 - paddingFraction)
  const k = clamp(fitScale, 1, MAX_ZOOM_SCALE)
  // The bounds' centre, in SVG units, goes to the viewBox centre (0, 0).
  return { k, x: -k * ((xMin + xMax) / 2), y: k * ((yMin + yMax) / 2) }
}

/** The map area [xMin, yMin, xMax, yMax] (PGDA metres) that a zoom transform shows. */
export function viewBoundsM({ k, x, y }) {
  return [(-VIEW_HALF_WIDTH_M - x) / k, (y - VIEW_HALF_WIDTH_M) / k, (VIEW_HALF_WIDTH_M - x) / k, (y + VIEW_HALF_WIDTH_M) / k]
}

/** Map angle (clockwise from map up) of azimuth k at a cell of longitude λ: k + λ (docs/technical-reference.md D4), in 0…360. */
export const mapAngleDeg = (azimuthDeg, lonDeg) => (((azimuthDeg + lonDeg) % 360) + 360) % 360

/** 0…1 values as an SVG path across widthPx (value 1 at the top), numbers rounded to 2 decimals; '' for no values. */
export function sparklinePath(values, widthPx, heightPx) {
  const step = values.length > 1 ? widthPx / (values.length - 1) : 0
  const round = (number) => Number(number.toFixed(2))
  return Array.from(values, (value, index) => `${index === 0 ? 'M' : 'L'}${round(index * step)},${round((1 - value) * heightPx)}`).join(' ')
}

export const LABEL_MIN_CELL_PX = 40

/** LGRS cell labels show once a 1 km cell is at least LABEL_MIN_CELL_PX wide on screen (mapSizePx = the map's drawn width). */
export const cellLabelsVisible = (zoomScale, mapSizePx) => (zoomScale * mapSizePx * 1000) / VIEW_SIZE_M >= LABEL_MIN_CELL_PX

/** True when a resolved current point (cell, site or custom point) lies on the polar map. */
export const isCellOnPolarMap = (cell) => isOnPolarMap(cell.xM, cell.yM)

/** True for finite map coordinates inside the ±304 km polar maps. */
export function isOnPolarMap(xM, yM) {
  return Number.isFinite(xM) && Number.isFinite(yM) && Math.abs(xM) <= VIEW_HALF_WIDTH_M && Math.abs(yM) <= VIEW_HALF_WIDTH_M
}
