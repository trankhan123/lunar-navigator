// C0 — shared geometry. Contract: README "C0 Shared geometry and time series".
/* eslint-disable no-unused-vars -- stub parameters; delete this line when you implement the module */
import { notImplemented } from './notImplemented.js'

export const MOON_RADIUS_KM = 1737.4
export const SUN_RADIUS_KM = 696000
export const EARTH_RADIUS_KM = 6371
export const AU_KM = 149597870.7
export const SUN_DISK_RADIUS_DEG = 0.27
export const EARTH_DISK_RADIUS_DEG = 0.95
// A body counts as visible (sunlit / Earth in view) when at least this share of its disk is above the horizon.
export const VISIBLE_THRESHOLD = 0.5

/**
 * Azimuth/elevation of the Sun or Earth seen from a cell (window-finder.md §4.3).
 * @param {{lat:number, lon:number, heightM:number}} cell  lon East-positive, heightM above the 1737.4 km sphere
 * @param {number} subLonDeg  sub-body point longitude on the Moon (East-positive)
 * @param {number} subLatDeg  sub-body point latitude
 * @param {number} distanceKm  Moon centre → body centre
 * @returns {{azimuthDeg:number, elevationDeg:number}}  azimuth 0 ≤ az < 360, clockwise from North
 */
export function bodyAzimuthElevation(cell, subLonDeg, subLatDeg, distanceKm) {
  throw notImplemented('C0', 'bodyAzimuthElevation')
}

/**
 * Terrain horizon elevation at any azimuth, linear between whole degrees, wrapping 359 → 0.
 * @param {number[]|null} horizon  360 integers in 0.1° units (index k = azimuth k°); null = smooth sphere (0°)
 * @param {number} azimuthDeg
 * @returns {number} degrees
 */
export function horizonElevationAt(horizon, azimuthDeg) {
  throw notImplemented('C0', 'horizonElevationAt')
}

/**
 * Share of a disk above the horizon: clamp((el − H + ρ) / 2ρ, 0, 1).
 * @returns {number} 0..1
 */
export function visibleDiskFraction(elevationDeg, horizonDeg, diskRadiusDeg) {
  throw notImplemented('C0', 'visibleDiskFraction')
}

/**
 * Great-circle distance on the 1737.4 km sphere.
 * @param {{lat:number, lon:number}} a
 * @param {{lat:number, lon:number}} b
 * @returns {number} km
 */
export function distanceKm(a, b) {
  throw notImplemented('C0', 'distanceKm')
}
