export const skillLevels: [string, string][] = [
  ["?", "Skill Unknown"],
  ["FW", "Flat Water"],
  ["B", "Beginner"],
  ["N", "Novice"],
  ["LI", "Low-Intermediate"],
  ["I", "Intermediate"],
  ["HI", "High-Intermediate"],
  ["A", "Advanced"],
  ["E", "Expert"],
];

export const skillTranslations: Record<string, string> = {};
export const reverseSkillTranslations: Record<string, string> = {};

skillLevels.forEach(([abbreviation, expanded]) => {
  skillTranslations[abbreviation] = expanded;
  reverseSkillTranslations[expanded] = abbreviation;
});

export type SkillValue = string | number | undefined | null;

/**
 * Returns the short abbreviation (e.g. "I") for a skill level (1-8 or string).
 */
export function getSkillAbbreviation(skill: SkillValue): string {
    if (skill === undefined || skill === null || skill === "") return "?";
    const num = typeof skill === "string" ? parseInt(skill, 10) : skill;
    if (typeof num === "number" && !isNaN(num)) {
        if (num >= 1 && num < skillLevels.length) return skillLevels[num][0];
        return "?";
    }
    const s = skill.toString().toUpperCase();
    if (skillTranslations[s]) return s;
    return s || "?";
}

/**
 * Returns the full description (e.g. "Intermediate") for a skill level.
 */
export function getSkillFull(skill: SkillValue): string {
    if (skill === undefined || skill === null || skill === "") return "Skill Unknown";
    const num = typeof skill === "string" ? parseInt(skill, 10) : skill;
    if (typeof num === "number" && !isNaN(num)) {
        if (num >= 1 && num < skillLevels.length) return skillLevels[num][1];
        return "Skill Unknown";
    }
    const s = skill.toString().toUpperCase();
    if (skillTranslations[s]) return skillTranslations[s];
    return "Skill Unknown";
}

/**
 * Returns the numeric index (1-8) for a skill level (abbreviation or number).
 */
export function getSkillIndex(skill: SkillValue): number | null {
    if (skill === undefined || skill === null || skill === "") return null;
    const num = typeof skill === "string" ? parseInt(skill, 10) : skill;
    if (typeof num === "number" && !isNaN(num)) {
        if (num >= 1 && num < skillLevels.length) return num;
        return null;
    }
    const s = skill.toString().toUpperCase();
    const idx = skillLevels.findIndex(([code]) => code === s);
    return idx > 0 ? idx : null;
}
