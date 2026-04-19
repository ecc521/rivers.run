import { ALL_STATE_CODES } from './regions';

const STATE_CODES = new Set(ALL_STATE_CODES);
const ACRONYMS = new Set([
    'USGS', 'USA', 'TVA', 'NWS',
    'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
]);

const EXPANSIONS: Record<string, string> = {
    'cr': 'Creek',
    'crk': 'Creek',
    'r': 'River',
    'br': 'Branch',
    'fk': 'Fork',
    'nr': 'Near',
    'abv': 'Above',
    'blw': 'Below',
    'mt': 'Mount',
    'mtn': 'Mountain',
    'nf': 'North Fork',
    'sf': 'South Fork',
    'ef': 'East Fork',
    'wf': 'West Fork',
    'st': 'Saint',
    'pt': 'Point',
    'lk': 'Lake',
    'res': 'Reservoir',
    'rv': 'River'
};

const LOWERCASE_WORDS = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'as', 'near', 'above', 'below'
]);

function formatToken(token: string, index: number): string {
    const isFirst = index === 0;
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

    let formatted = "";
    let wordIndex = 0;

    for (let i = 0; i < matches.length; i++) {
        const token = matches[i];
        if (/^[a-zA-Z0-9]+$/.test(token)) {
            formatted += formatToken(token, wordIndex++);
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
