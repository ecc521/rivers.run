/**
 * Ported from functions/src/services/usgs.ts
 * Formats a raw USGS site name into a cleaner title-case name and section segment.
 * Expands common abbreviations like NR, BLW, ABV, BR, and CR.
 */
export function formatGaugeName(name: string): { name: string; section?: string } {
    if (typeof name !== 'string') return { name: String(name || "") };
    const lowercaseWords = new Set(['at', 'near', 'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'in', 'to', 'of', 'by', 'as', 'above', 'below', 'blw', 'abv', 'nr']);
    const expansions: Record<string, string> = {
        nr: 'near',
        blw: 'below',
        abv: 'above',
        br: 'branch',
        cr: 'creek'
    };
    const stateCodes = new Set([
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'VI', 'GU'
    ]);
    const acronyms = new Set([
        'USGS', 'USA', 'TVA', 'NWS',
        'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
    ]);

    const matches = name.match(/([a-zA-Z0-9]+)|([^a-zA-Z0-9]+)/g) || [];

    let formatted = "";
    let wordIndex = 0;
    const wordsOnly = matches.filter(m => /^[a-zA-Z0-9]+$/.test(m));

    for (let i = 0; i < matches.length; i++) {
        const token = matches[i];
        if (/^[a-zA-Z0-9]+$/.test(token)) {
            const index = wordIndex++;
            const isFirst = index === 0;
            const isLast = index === wordsOnly.length - 1;
            const upperToken = token.toUpperCase();
            const lowerToken = token.toLowerCase();
            
            const prevToken = i > 0 ? matches[i - 1] : "";
            const followsComma = prevToken.includes(',');

            const expansion = expansions[lowerToken];
            if (expansion) {
                const isLowercaseExpandedWord = lowercaseWords.has(expansion);
                if (!isFirst && isLowercaseExpandedWord) {
                    formatted += expansion;
                } else {
                    formatted += expansion.charAt(0).toUpperCase() + expansion.slice(1);
                }
            } else if (acronyms.has(upperToken)) {
                formatted += upperToken;
            } else if (stateCodes.has(upperToken) && (isLast || followsComma)) {
                formatted += upperToken;
            } else if (!isFirst && lowercaseWords.has(lowerToken)) {
                formatted += lowerToken;
            } else {
                formatted += token.charAt(0).toUpperCase() + lowerToken.slice(1);
            }
        } else {
            formatted += token;
        }
    }

    const formattedString = formatted.replace(/\s+/g, ' ').trim();

    const delimiters = [' at ', ' near ', ' above ', ' below '];
    let splitIndex = -1;
    
    const lowerFormatted = formattedString.toLowerCase();

    for (const d of delimiters) {
        const idx = lowerFormatted.indexOf(d);
        if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
            splitIndex = idx;
        }
    }

    if (splitIndex !== -1) {
        const gaugeName = formattedString.substring(0, splitIndex).trim();
        let section = formattedString.substring(splitIndex).trim();
        section = section.charAt(0).toUpperCase() + section.slice(1); // Capitalize first letter of section
        return { name: gaugeName, section };
    }

    return { name: formattedString };
}
