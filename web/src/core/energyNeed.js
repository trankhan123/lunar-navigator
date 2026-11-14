import { VISIBLE_THRESHOLD } from './geometry.js'

export function findDarkPeriods(diskFraction, startIndex, lengthHours) {
  const periods = []
  let runStart = -1
  for (let h = 0; h < lengthHours; h++) {
    const dark = diskFraction[startIndex + h] < VISIBLE_THRESHOLD
    if (dark && runStart === -1) runStart = h
    if (!dark && runStart !== -1) {
      periods.push({ startOffset: runStart, lengthHours: h - runStart })
      runStart = -1
    }
  }
  if (runStart !== -1) periods.push({ startOffset: runStart, lengthHours: lengthHours - runStart })
  return periods
}

export function summarizeEnergyNeed(sunTrack, startIndex, lengthHours, { panelMaxW, loadW }) {
  let totalGeneratedWh = 0
  let deficitWh = 0
  let minimumCapacityWh = 0

  for (let h = 0; h < lengthHours; h++) {
    const generatedWh = panelMaxW * sunTrack.powerFactor[startIndex + h]
    totalGeneratedWh += generatedWh
    deficitWh = Math.max(0, deficitWh - (generatedWh - loadW))
    if (deficitWh > minimumCapacityWh) minimumCapacityWh = deficitWh
  }

  const darkPeriods = findDarkPeriods(sunTrack.diskFraction, startIndex, lengthHours).map((period) => ({
    ...period,
    energyWh: loadW * period.lengthHours,
  }))
  let longestDarkEnergyWh = 0
  for (const period of darkPeriods) {
    if (period.energyWh > longestDarkEnergyWh) longestDarkEnergyWh = period.energyWh
  }

  const totalLoadWh = loadW * lengthHours
  return {
    totalLoadWh,
    totalGeneratedWh,
    energyBalanceWh: totalGeneratedWh - totalLoadWh,
    minimumCapacityWh,
    longestDarkEnergyWh,
    darkPeriods,
  }
}