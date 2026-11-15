// C1 — Sunlight. Contract: docs/technical-reference.md "C1 Sunlight".
import {
  bodyAzimuthElevation,
  horizonElevationAt,
  visibleDiskFraction,
  SUN_DISK_RADIUS_DEG,
  AU_KM,
  VISIBLE_THRESHOLD,

} from './geometry.js';
import {
  firstIndexBelow,
  fractionAtLeast,
  longestRunBelow,
  meanWhereAtLeast,
  nextCrossing,
} from './timeSeries.js';
const DEG_TO_RAD = Math.PI / 180;
export function resolvePanelType(panelMode, latDeg) {
  if (panelMode === 'vertical' || panelMode === 'horizontal') {
    return panelMode;
  }
  return Math.abs(latDeg) >= 60 ? 'vertical' : 'horizontal';
}

export function panelFactor(elevationDeg, panelType) {
  const elRad = elevationDeg * DEG_TO_RAD;
  if (panelType === 'vertical') {
    return Math.max(0, Math.cos(elRad));
  }
  return Math.max(0, Math.sin(elRad));
}

export function computeSunTrack(cell, ephemeris, firstHour, hourCount, panelMode = 'auto') {
  const panelType = resolvePanelType(panelMode, cell.lat);
  const azimuthDeg = new Float32Array(hourCount);
  const elevationDeg = new Float32Array(hourCount);
  const diskFraction = new Float32Array(hourCount);
  const powerFactor = new Float32Array(hourCount);

  const { sunSubLonDeg, sunSubLatDeg, sunDistanceAu } = ephemeris;
  const horizon = cell.horizon ?? null;

  for (let i = 0; i < hourCount; i++) {
    const h = firstHour + i;
    const distAu = sunDistanceAu[h];
    const pos = bodyAzimuthElevation(
      cell,
      sunSubLonDeg[h],
      sunSubLatDeg[h],
      distAu * AU_KM
    );

    const az = pos.azimuthDeg;
    const el = pos.elevationDeg;
    const horDeg = horizonElevationAt(horizon, az);
    const diskFrac = visibleDiskFraction(el, horDeg, SUN_DISK_RADIUS_DEG);
    const pFactor = panelFactor(el, panelType);
    const invDist = 1 / distAu;

    azimuthDeg[i] = az;
    elevationDeg[i] = el;
    diskFraction[i] = diskFrac;
    powerFactor[i] = invDist * invDist * diskFrac * pFactor;
  }

  return {
    firstHour,
    panelType,
    azimuthDeg,
    elevationDeg,
    diskFraction,
    powerFactor,
  };
}

export function summarizeSunWindow(sunTrack, startIndex, lengthHours) {
  const { diskFraction, elevationDeg } = sunTrack;
  return {
    longestDarkHours: longestRunBelow(diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
    fractionSun: fractionAtLeast(diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
    meanSunElevationDeg: meanWhereAtLeast(
      elevationDeg,
      diskFraction,
      VISIBLE_THRESHOLD,
      startIndex,
      lengthHours
    ),
    hoursToSunset: firstIndexBelow(diskFraction, VISIBLE_THRESHOLD, startIndex, lengthHours),
  };
}

export function nextSunEvent(sunTrack, atIndex) {
  const crossing = nextCrossing(sunTrack.diskFraction, VISIBLE_THRESHOLD, atIndex);
  if (!crossing) return null;
  return {
    event: crossing.direction === 'down' ? 'sunset' : 'sunrise',
    hoursFromNow: crossing.hoursFromNow,
  };
}