/**
 * ⚠️ IMPORTANT: Cross-Environment Synchronization ⚠️
 * This validation logic is identically mirrored between the frontend and backend.
 * If you update this file, you MUST identically update its mirror:
 * Backend Mirror: functions/src/services/riverValidation.ts
 */

export interface RiverValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateRiver(river: any): RiverValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!river) {
    return { isValid: false, errors: ["River object is completely null or undefined."], warnings: [] };
  }

  if (!river.id || typeof river.id !== "string" || river.id.trim() === "") {
    errors.push("Missing or invalid River ID.");
  }
  
  if (!river.name || typeof river.name !== "string" || river.name.trim() === "") {
    errors.push("Missing or invalid River Name.");
  }

  if ((river.overview || "").match(/<img[^>]+src=["']data:image/i)) {
    errors.push("Raw image structures (base64) are strictly disallowed to maintain fast load times and database space.");
  }

  const VALID_SKILLS = new Set(["?", "fw", "b", "n", "n+", "li-", "li", "li+", "i-", "i", "i+", "hi-", "hi", "hi+", "a-", "a", "a+", "e-", "e", "e+"]);
  
  if (river.skill && typeof river.skill === "string") {
      if (!VALID_SKILLS.has(river.skill.trim().toLowerCase())) {
          errors.push(`Skill is invalid. Expected a recognized abbreviation like 'FW', 'B', 'N', etc. Got '${river.skill}'.`);
      }
  }

  try {
    const jsonStr = JSON.stringify(river);
    const byteLength = new TextEncoder().encode(jsonStr).length;
    if (byteLength > 25000) {
      warnings.push(`This river profile is abnormally large (${(byteLength / 1024).toFixed(1)} kB). The standard recommended limit is ~25 kB maximum.`);
    }
  } catch {
    errors.push("Failed to serialize River data due to circular references or unsupported formats.");
  }

  const gauges = river.gauges || [];
  const primaryCount = gauges.filter((g: any) => g.isPrimary).length;
  if (gauges.length > 0 && primaryCount > 1) {
    errors.push("At most ONE gauge can be marked as primary.");
  }

  if (river.flow) {
    const tiers = [river.flow.min, river.flow.low, river.flow.mid, river.flow.high, river.flow.max];
    const validTiers = tiers.filter((t: any) => t !== null && t !== undefined && t !== "");
    
    if (validTiers.length > 0 && (!river.flow.unit || typeof river.flow.unit !== "string" || river.flow.unit.trim() === "")) {
      errors.push("Flow unit ('cfs', 'ft', 'cms', 'm') must be specified if any flow tier values are provided.");
    }

    if (primaryCount > 0) {
      for (let i = 0; i < validTiers.length - 1; i++) {
          if (Number(validTiers[i]) >= Number(validTiers[i+1])) {
              errors.push("Flow tiers (min, low, mid, high, max) must be in strictly ascending numeric order.");
              break;
          }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
