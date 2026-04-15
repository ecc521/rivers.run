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

/**
 * Returns the short abbreviation (e.g. "I") for a skill level (1-8 or string).
 */
export function getSkillAbbreviation(skill: string | number | undefined | null): string {
    if (skill === undefined || skill === null) return "?";
    if (typeof skill === "number") {
        if (skill >= 1 && skill < skillLevels.length) return skillLevels[skill][0];
        return "?";
    }
    const s = skill.toString();
    if (skillTranslations[s]) return s;
    return s || "?";
}

/**
 * Returns the full description (e.g. "Intermediate") for a skill level.
 */
export function getSkillFull(skill: string | number | undefined | null): string {
    if (skill === undefined || skill === null) return "Skill Unknown";
    if (typeof skill === "number") {
        if (skill >= 1 && skill < skillLevels.length) return skillLevels[skill][1];
        return "Skill Unknown";
    }
    const s = skill.toString();
    if (skillTranslations[s]) return skillTranslations[s];
    return "Skill Unknown";
}
