import { VISIBLE_THRESHOLD } from './geometry.js'

export function simulateBattery(powerFactor, startIndex, lengthHours, { panelMaxW, loadW, batteryCapacityWh }) {
  const batteryWh = new Float32Array(lengthHours + 1)
  const chargingMask = new Uint8Array(lengthHours)
  batteryWh[0] = batteryCapacityWh
  let deadAtHour = null

  for (let h = 0; h < lengthHours; h++) {
    const generatedW = panelMaxW * powerFactor[startIndex + h]
    const raw = batteryWh[h] + generatedW - loadW
    if (raw <= 0 && deadAtHour === null) deadAtHour = h + 1
    batteryWh[h + 1] = Math.min(Math.max(raw, 0), batteryCapacityWh)
    chargingMask[h] = generatedW > loadW ? 1 : 0
  }

  let minIndex = 0
  for (let h = 1; h <= lengthHours; h++) {
    if (batteryWh[h] < batteryWh[minIndex]) minIndex = h
  }
  const minBatteryWh = batteryWh[minIndex]
  const fullWh = batteryCapacityWh * (1 - 1e-6)

  let rechargeHours = null
  if (minBatteryWh >= fullWh) {
    rechargeHours = 0
  } else {
    for (let h = minIndex + 1; h <= lengthHours; h++) {
      if (batteryWh[h] >= fullWh) {
        rechargeHours = h - minIndex
        break
      }
    }
  }

  return {
    batteryWh,
    minBatteryWh,
    minBatteryFraction: minBatteryWh / batteryCapacityWh,
    deadAtHour,
    rechargeHours,
    chargingMask,
  }
}

export function findFullChargeWindows(batteryWh, sunDiskFraction, startIndex, batteryCapacityWh) {
  const lengthHours = batteryWh.length - 1
  const windows = []
  for (let h = 1; h <= lengthHours; h++) {
    const wasLit = sunDiskFraction[startIndex + h - 1] >= VISIBLE_THRESHOLD
    const nowDark = sunDiskFraction[startIndex + h] < VISIBLE_THRESHOLD
    if (wasLit && nowDark) {
      const fraction = batteryWh[h] / batteryCapacityWh
      windows.push({ sunsetOffset: h, batteryAtSunsetFraction: fraction, fullBeforeSunset: fraction >= 0.999 })
    }
  }
  return windows
}