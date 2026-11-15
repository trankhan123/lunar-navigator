const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

/** [ours, nasa] pairs for one body ('Sun' or 'Earth') from validation.pgda69; rows with missing numbers are skipped. */
export function pgdaPairs(validation, body) {
  return (validation?.pgda69 ?? [])
    .map((row) => [row[`our${body}HalfDiskFraction`], row[`pgda${body}Fraction`]])
    .filter(([ours, nasa]) => isNumber(ours) && isNumber(nasa))
}

function pearsonR(pairs) {
  if (pairs.length < 2) return null
  const mean = (index) => pairs.reduce((sum, pair) => sum + pair[index], 0) / pairs.length
  const [meanOurs, meanNasa] = [mean(0), mean(1)]
  let covariance = 0
  let varianceOurs = 0
  let varianceNasa = 0
  for (const [ours, nasa] of pairs) {
    covariance += (ours - meanOurs) * (nasa - meanNasa)
    varianceOurs += (ours - meanOurs) ** 2
    varianceNasa += (nasa - meanNasa) ** 2
  }
  return varianceOurs && varianceNasa ? covariance / Math.sqrt(varianceOurs * varianceNasa) : null
}

const meanAbsoluteDifference = (pairs) =>
  pairs.length ? pairs.reduce((sum, [ours, nasa]) => sum + Math.abs(ours - nasa), 0) / pairs.length : null

/** Headline numbers for the validation badge; any part that cannot be computed is null. */
export function validationSummary(validation) {
  const overall = validation?.pgda69Stats?.find((entry) => entry.region === 'ALL')
  const sunPairs = pgdaPairs(validation, 'Sun')
  const earthPairs = pgdaPairs(validation, 'Earth')
  const horizonErrors = [validation?.horizons?.maxAzimuthErrorDeg, validation?.horizons?.maxElevationErrorDeg]
  return {
    sunR: overall?.sun?.halfDisk?.pearsonR ?? pearsonR(sunPairs),
    earthR: overall?.earth?.halfDisk?.pearsonR ?? pearsonR(earthPairs),
    sunMae: meanAbsoluteDifference(sunPairs),
    earthMae: meanAbsoluteDifference(earthPairs),
    cellCount: validation?.pgda69 ? validation.pgda69.length : null,
    horizonsMaxDeg: horizonErrors.every(isNumber) ? Math.max(...horizonErrors) : null,
  }
}
