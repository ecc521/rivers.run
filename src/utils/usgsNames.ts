/**
 * Ported from functions/src/services/usgs.ts
 * Formats a raw USGS site name into a cleaner title-case name and section segment.
 * Expands common abbreviations like NR, BLW, ABV, BR, and CR.
 */

const LOWERCASE_WORDS = new Set(['at', 'near', 'a', 'an', 'the', 'and', 'but', 'or', 'for', 'on', 'in', 'to', 'of', 'by', 'as', 'above', 'below', 'blw', 'abv', 'nr']);
const EXPANSIONS: Record<string, string> = {
    nr: 'Near',
    blw: 'Below',
    abv: 'Above',
    br: 'Branch',
    cr: 'Creek',
    n: 'North',
    s: 'South',
    e: 'East',
    w: 'West',
    nf: 'North Fork',
    sf: 'South Fork',
    ef: 'East Fork',
    wf: 'West Fork',
    mf: 'Middle Fork'
};
const STATE_CODES = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'VI', 'GU'
]);
const ACRONYMS = new Set([
    'USGS', 'USA', 'TVA', 'NWS',
    'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
]);

function formatToken(token: string, index: number, totalWords: number, followsComma: boolean): string {
    const isFirst = index === 0;
    const isLast = index === totalWords - 1;
    const upperToken = token.toUpperCase();
    const lowerToken = token.toLowerCase();

    const expansion = EXPANSIONS[lowerToken];
    if (expansion) {
        const lowerExpansion = expansion.toLowerCase();
        if (!isFirst && LOWERCASE_WORDS.has(lowerExpansion)) return lowerExpansion;
        return expansion;
    }

    if (ACRONYMS.has(upperToken)) return upperToken;
    
    // Always keep 2-letter state codes capitalized (e.g. NC, VA, MD)
    if (token.length === 2 && STATE_CODES.has(upperToken)) return upperToken;

    if (!isFirst && LOWERCASE_WORDS.has(lowerToken)) return lowerToken;

    return token.charAt(0).toUpperCase() + lowerToken.slice(1);
}

export function formatGaugeName(name: string): { name: string; section?: string } {
    if (typeof name !== 'string') return { name: String(name || "") };

    const matches = name.match(/([a-zA-Z0-9]+)|([^a-zA-Z0-9]+)/g) || [];
    const wordsOnly = matches.filter(m => /^[a-zA-Z0-9]+$/.test(m));

    let formatted = "";
    let wordIndex = 0;

    for (let i = 0; i < matches.length; i++) {
        const token = matches[i];
        if (/^[a-zA-Z0-9]+$/.test(token)) {
            const followsComma = i > 0 && matches[i - 1].includes(',');
            formatted += formatToken(token, wordIndex++, wordsOnly.length, followsComma);
        } else {
            formatted += token;
        }
    }

    const formattedString = formatted.replace(/\s+/g, ' ').trim();
    const delimiters = [' at ', ' near ', ' above ', ' below '];
    const lowerFormatted = formattedString.toLowerCase();
    
    let splitIndex = -1;
    for (const d of delimiters) {
        const idx = lowerFormatted.indexOf(d);
        if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
            splitIndex = idx;
        }
    }

    if (splitIndex !== -1) {
        const gaugeName = formattedString.substring(0, splitIndex).trim();
        let section = formattedString.substring(splitIndex).trim();
        section = section.charAt(0).toUpperCase() + section.slice(1); 
        return { name: gaugeName, section };
    }

    return { name: formattedString };
}
