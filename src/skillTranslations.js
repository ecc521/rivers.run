const skillLevels = [
	["?", "Skill Unknown"],
	["FW", "Flat Water"],
	["B", "Beginner"],
	["N", "Novice"],
	["N+", "Novice Plus"],
	["LI-", "Low-Intermediate Minus"],
	["LI", "Low-Intermediate"],
	["LI+", "Low-Intermediate Plus"],
	["I-", "Intermediate Minus"],
	["I", "Intermediate"],
	["I+", "Intermediate Plus"],
	["HI-", "High-Intermediate Minus"],
	["HI", "High-Intermediate"],
	["HI+", "High-Intermediate Plus"],
	["A-", "Advanced Minus"],
	["A", "Advanced"],
	["A+", "Advanced Plus"],
	["E-", "Expert Minus"],
	["E", "Expert"],
	["E+", "Expert Plus"],
]

const skillTranslations = {}
const reverseSkillTranslations = {}
skillLevels.forEach(([abbriviation, expanded]) => {
	skillTranslations[abbriviation] = expanded
	reverseSkillTranslations[expanded] = abbriviation
})

module.exports = {
	skillLevels,
	skillTranslations,
	reverseSkillTranslations,
}
