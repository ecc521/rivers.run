/**
 * Ported from functions/src/services/usgs.ts
 * Formats a raw USGS site name into a cleaner title-case name and section segment.
 * Expands common abbreviations like NR, BLW, ABV, BR, and CR.
 */
function formatToken(token: string, state: { wordIndex: number, wordsOnlyCount: number, prevToken: string }) {
    const lowercaseWords = new Set(['at', 'near', 'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'in', 'to', 'of', 'by', 'as', 'above', 'below', 'blw', 'abv', 'nr']);
    const expansions: Record<string, string> = {
        nr: 'near', blw: 'below', abv: 'above', br: 'branch', cr: 'creek'
    };
    const stateCodes = new Set([
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'VI', 'GU'
    ]);
    const acronyms = new Set([
        'USGS', 'USA', 'TVA', 'NWS',
        'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
    ]);

    const index = state.wordIndex;
    const isFirst = index === 0;
    const isLast = index === state.wordsOnlyCount - 1;
    const upperToken = token.toUpperCase();
    const lowerToken = token.toLowerCase();
    const followsComma = state.prevToken.includes(',');

    const expansion = expansions[lowerToken];
    if (expansion) {
        if (!isFirst && lowercaseWords.has(expansion)) return expansion;
        return expansion.charAt(0).toUpperCase() + expansion.slice(1);
    } 
    
    if (acronyms.has(upperToken)) return upperToken;
    if (stateCodes.has(upperToken) && (isLast || followsComma)) return upperToken;
    if (!isFirst && lowercaseWords.has(lowerToken)) return lowerToken;
    
    return token.charAt(0).toUpperCase() + lowerToken.slice(1);
}

export function formatGaugeName(name: string): { name: string; section?: string } {
    if (typeof name !== 'string') return { name: String(name || "") };
    
    const tokens = name.match(/([a-zA-Z0-9]+)|([^a-zA-Z0-9]+)/g) || [];
    const wordsOnly = tokens.filter(m => /^[a-zA-Z0-9]+$/.test(m));

    let formatted = "";
    let wordIdx = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (/^[a-zA-Z0-9]+$/.test(token)) {
            formatted += formatToken(token, { 
                wordIndex: wordIdx++, 
                wordsOnlyCount: wordsOnly.length, 
                prevToken: i > 0 ? tokens[i - 1] : "" 
            });
        } else {
            formatted += token;
        }
    }

    const formattedString = formatted.replace(/\s+/g, ' ').trim();
    const delimiters = [' at ', ' near ', ' above ', ' below '];
    let splitIdx = -1;
    const lowerFor = formattedString.toLowerCase();

    for (const d of delimiters) {
        const idx = lowerFor.indexOf(d);
        if (idx !== -1 && (splitIdx === -1 || idx < splitIdx)) splitIdx = idx;
    }

    if (splitIdx !== -1) {
        const gaugeName = formattedString.substring(0, splitIdx).trim();
        let section = formattedString.substring(splitIdx).trim();
        section = section.charAt(0).toUpperCase() + section.slice(1);
        return { name: gaugeName, section };
    }

    return { name: formattedString };
}

