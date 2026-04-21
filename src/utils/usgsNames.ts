import { ALL_STATE_CODES } from './regions';

const STATE_CODES = new Set(ALL_STATE_CODES);
const ACRONYMS = new Set([
    'USGS', 'USA', 'TVA', 'NWS', 'US', 'HWY', 'SR', 'GS', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
]);

const EXPANSIONS: Record<string, string> = {
    cr: 'Creek',
    crk: 'Creek',
    r: 'River',
    rv: 'River',
    br: 'Branch',
    f: 'Fork',
    fk: 'Fork',
    trib: 'Tributary',
    nr: 'Near',
    abv: 'Above',
    ab: 'Above',
    blw: 'Below',
    bl: 'Below',
    b: 'Below',
    mth: 'Mouth',
    ds: 'Downstream',
    nf: 'N Fork',
    sf: 'S Fork',
    ef: 'E Fork',
    wf: 'W Fork',
    n: 'N',
    s: 'S',
    e: 'E',
    w: 'W',
    mt: 'Mount',
    mtn: 'Mountain',
    pt: 'Point',
    lk: 'Lake',
    res: 'Reservoir',
    tof: 'Time of Flight',
    witsd: 'Withdrawn'
};

const LOWERCASE_WORDS = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'as', 'near', 'above', 'below', 'mi', 'km', 'en', 'aval', 'amont', 'du', 'barrage', 'la', 'le'
]);

function formatToken(token: string, index: number, isLast: boolean): string {
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
    
    // If it's a state code (e.g. NC), keep it uppercase,
    // UNLESS it's an ambiguous word (e.g. 'on', 'in', 'or') and not at the end
    const isAmbiguousStateCode = LOWERCASE_WORDS.has(lowerToken);
    
    if (token.length === 2 && STATE_CODES.has(upperToken)) {
        if (isLast || !isAmbiguousStateCode) {
            return upperToken;
        }
    }

    if (!isFirst && LOWERCASE_WORDS.has(lowerToken) && !isLast) return lowerToken;

    return token.charAt(0).toUpperCase() + lowerToken.slice(1);
}

export function formatGaugeName(name: string): { name: string; section?: string } {
    if (typeof name !== 'string') return { name: String(name || "") };

    const matches = name.match(/([a-zA-Z0-9]+)|([^a-zA-Z0-9]+)/g) || [];

    let formatted = "";
    let wordIndex = 0;

    for (let i = 0; i < matches.length; i++) {
        const token = matches[i];
        const lowerToken = token.toLowerCase();

        if (/^[a-zA-Z0-9]+$/.test(token)) {
            const isLastWord = matches.slice(i + 1).every(t => !/^[a-zA-Z0-9]+$/.test(t));

            // Special Case: detect slashed abbreviations like U/S or D/S
            if (i + 2 < matches.length && matches[i+1] === '/' && matches[i+2].toUpperCase() === 'S') {
                if (lowerToken === 'u') {
                    formatted += 'Upstream';
                    i += 2;
                    wordIndex++;
                    continue;
                } else if (lowerToken === 'd') {
                    formatted += 'Downstream';
                    i += 2;
                    wordIndex++;
                    continue;
                }
            }

            // Special Case: detect "US" meaning "Upstream" instead of "United States"
            let overrideExpansion: string | null = null;
            if (lowerToken === 'us' && i + 2 < matches.length && matches[i+2].toLowerCase() === 'of') {
                overrideExpansion = 'Upstream';
            }

            // Special Case: "S" in "U.S." should stay "S"
            const isPartOfUS = lowerToken === 's' && i >= 2 && matches[i-1].startsWith('.') && matches[i-2].toLowerCase() === 'u';
            const willExpand = (!!EXPANSIONS[lowerToken] || !!overrideExpansion) && !isPartOfUS;

            if (overrideExpansion) {
                formatted += overrideExpansion;
                wordIndex++;
            } else if (isPartOfUS) {
                formatted += token.toUpperCase();
                wordIndex++;
            } else {
                formatted += formatToken(token, wordIndex++, isLastWord);
            }

            if (willExpand && i + 1 < matches.length && matches[i+1].startsWith('.')) {
                const nextToken = matches[i+1];
                matches[i+1] = nextToken.slice(1);
                // If the remainder of the next token doesn't start with a space, add one
                if (matches[i+1] === "" || !/^\s/.test(matches[i+1])) {
                    formatted += ' ';
                }
            }
        } else {
            formatted += token;
        }
    }

    const formattedString = formatted.replace(/\s+/g, ' ').trim();
    const delimiters = [' at ', ' near ', ' above ', ' below ', ' upstream ', ' downstream ', ' à ', ' en aval ', ' en amont '];
    const lowerFormatted = formattedString.toLowerCase();
    
    let splitIndex = -1;
    for (const d of delimiters) {
        const idx = lowerFormatted.indexOf(d);
        if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
            splitIndex = idx;
        }
    }

    // Fallback: splitting at the first comma if it follows a river descriptor
    if (splitIndex === -1) {
        const commaIndex = formattedString.indexOf(',');
        if (commaIndex !== -1) {
            const riverWords = new Set(['river', 'creek', 'stream', 'run', 'fork', 'branch', 'brook', 'canal', 'lake', 'reservoir', 'r', 'cr', 'fk', 'br']);
            const beforeComma = formattedString.substring(0, commaIndex).trim().toLowerCase();
            const lastWord = beforeComma.split(' ').pop();
            if (lastWord && riverWords.has(lastWord)) {
                splitIndex = commaIndex;
            }
        }
    }

    if (splitIndex !== -1) {
        let gaugeName = formattedString.substring(0, splitIndex).trim();
        let section = formattedString.substring(splitIndex).trim();

        // Check if the section starts with a direction and if name ends with a distance
        const lowerSection = section.toLowerCase();
        if (lowerSection.startsWith('upstream') || lowerSection.startsWith('downstream') || lowerSection.startsWith('en aval') || lowerSection.startsWith('en amont')) {
            // eslint-disable-next-line sonarjs/slow-regex
            const distancePattern = /(?:at|à|a)?\s*[\d.]+\s*(?:mi|km|miles|kilometers)\s*$/i;
            const distanceMatch = distancePattern.exec(gaugeName);
            if (distanceMatch) {
                const distance = distanceMatch[0];
                gaugeName = gaugeName.substring(0, gaugeName.length - distance.length).trim();
                section = distance.trim() + " " + section;
            }
        }

        section = section.charAt(0).toUpperCase() + section.slice(1); 
        return { name: gaugeName, section };
    }

    return { name: formattedString };
}
