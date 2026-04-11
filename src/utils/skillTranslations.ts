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
