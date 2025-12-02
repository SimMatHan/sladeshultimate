/**
 * Helper functions for promille/BAC estimates.
 * Kept standalone so UI can import when the promille counter is shown.
 */
const STANDARD_DRINK_GRAMS = 12 // ~12g ethanol per standard drink

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function estimateBodyWaterLiters(heightCm, weightKg, gender) {
  if (!heightCm || !weightKg) return null

  const height = Number(heightCm)
  const weight = Number(weightKg)

  if (Number.isNaN(height) || Number.isNaN(weight) || height <= 0 || weight <= 0) {
    return null
  }

  // James formula (height + weight only) to keep us within given inputs
  if (gender === 'female') {
    return 0.252 * weight + 0.473 * height - 48.3
  }
  if (gender === 'male') {
    return 0.406 * weight + 0.267 * height - 19.2
  }

  // Neutral fallback averages the two
  return 0.329 * weight + 0.37 * height - 33.75
}

/**
 * Rough promille estimate using Widmark-style distribution.
 * Returns null when inputs are incomplete or invalid.
 * 
 * @param {Object} params
 * @param {number|string} params.heightCm - User height in centimeters
 * @param {number|string} params.weightKg - User weight in kilograms
 * @param {string} params.gender - "male" | "female" | "other"
 * @param {number} params.drinkCount - Number of standard drinks logged
 * @returns {number|null} promille value (‰), null if insufficient data
 */
export function estimatePromille({ heightCm, weightKg, gender, drinkCount }) {
  if (!drinkCount || drinkCount <= 0) return 0

  const gramsAlcohol = drinkCount * STANDARD_DRINK_GRAMS
  const bodyWaterLiters = estimateBodyWaterLiters(heightCm, weightKg, gender)
  const weight = Number(weightKg)

  if (!bodyWaterLiters || Number.isNaN(weight) || weight <= 0) {
    return null
  }

  // Convert body water to a Widmark-style distribution ratio
  const distributionRatio = clamp(bodyWaterLiters / weight, 0.45, 0.75)

  // Widmark approximation: %BAC = A / (r * weight) * 100
  const bacPercent = (gramsAlcohol / (distributionRatio * weight)) * 0.01
  const promille = bacPercent * 10

  // Keep a sensible ceiling for display
  return Number(promille.toFixed(3))
}

export function normalizePromilleInput({ heightCm, weightKg, gender, enabled }) {
  const height = heightCm ? Number(heightCm) : null
  const weight = weightKg ? Number(weightKg) : null
  const cleanGender = gender || null
  const isEnabled = !!enabled && !!height && !!weight && !!cleanGender

  if (!isEnabled) {
    return {
      enabled: false,
      heightCm: null,
      weightKg: null,
      gender: null
    }
  }

  return {
    enabled: true,
    heightCm: height,
    weightKg: weight,
    gender: cleanGender
  }
}
