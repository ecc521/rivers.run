
/**
 * Main entry point for formatting gauge names.
 * Dispatches to provider-specific logic if possible.
 */
export function formatGaugeName(name: string, provider?: string): { name: string; section?: string } {
    const p = provider?.toUpperCase();

    if (p === 'USGS' || p === 'NWS') {
        return formatUSGSName(name);
    } else if (p === 'CANADA' || p === 'EC') {
        return formatCanadaName(name);
    } else if (p === 'UK' || p === 'IRELAND') {
        return formatUKIrelandName(name);
    }

    return formatGenericName(name);
}

const lowercaseWords = new Set(['at', 'near', 'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'in', 'to', 'of', 'by', 'as', 'above', 'below', 'blw', 'abv', 'nr', 'be', 'mi', 'km', 'en', 'aval', 'amont', 'du', 'barrage', 'la', 'le', 'de', 'des', 'les', 'aux', 'au', "d'", "l'"]);

const expansions: Record<string, string> = {
    nr: 'near',
    blw: 'below',
    bl: 'below',
    abv: 'above',
    ab: 'above',
    br: 'branch',
    cr: 'creek',
    crk: 'Creek',
    rd: 'Road',
    st: 'St',
    gs: 'Gauging Station',
    ds: 'Downstream',
    us: 'Upstream',
    r: 'River',
    rv: 'River',
    fk: 'Fork',
    nf: 'North Fork',
    sf: 'South Fork',
    ef: 'East Fork',
    wf: 'West Fork',
    n: 'North',
    s: 'South',
    e: 'East',
    w: 'West',
    mt: 'Mount',
    mtn: 'Mountain',
    pt: 'Point',
    lk: 'Lake',
    res: 'Reservoir',
    bel: 'below',
    btwn: 'between',
    stn: 'Station',
    tof: 'Time of Flight',
    witsd: 'Withdrawn'
};

const stateCodes = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'VI', 'GU'
]);

const acronyms = new Set([
    'USGS', 'USA', 'TVA', 'NWS', 'GSM', 'UK', 'OPW', 'NWPS',
    'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
]);

/**
 * Common Title Case logic with expansion and acronym preservation.
 */
function titleCase(name: string, isUS: boolean = false): string {
    const tokens = name.match(/\p{L}+|\p{N}+|[^\p{L}\p{N}\s]+|\s+/gu) || [];
    let formatted = "";
    
    // Count actual words to identify first/last
    const wordsOnlyIndices = tokens.map((t, i) => /\p{L}+/u.test(t) ? i : -1).filter(i => i !== -1);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (/\p{L}+/u.test(token)) {
            const index = wordsOnlyIndices.indexOf(i);
            const isFirst = index === 0;
            const isLast = index === wordsOnlyIndices.length - 1;
            const upperToken = token.toUpperCase();
            const lowerToken = token.toLowerCase();
            
            const prevTokens = tokens.slice(0, i).reverse();
            const lastNonSpace = prevTokens.find(t => /\S/.test(t)) || "";
            const followsComma = lastNonSpace.includes(',');

            const expansion = expansions[lowerToken];
            if (expansion) {
                const isLowercaseExpandedWord = lowercaseWords.has(expansion.toLowerCase());
                if (!isFirst && isLowercaseExpandedWord && !isLast) {
                    formatted += expansion.toLowerCase();
                } else {
                    formatted += expansion.charAt(0).toUpperCase() + expansion.slice(1);
                }
            } else if (acronyms.has(upperToken)) {
                formatted += upperToken;
            } else if (isUS && stateCodes.has(upperToken) && (isLast || followsComma)) {
                formatted += upperToken;
            } else if (!isFirst && lowercaseWords.has(lowerToken) && !isLast) {
                formatted += lowerToken;
            } else {
                formatted += token.charAt(0).toUpperCase() + lowerToken.slice(1);
            }
        } else {
            formatted += token;
        }
    }

    return formatted.replace(/\s+/g, ' ').trim();
}

function splitNameAndSection(fullName: string, delimiters: string[]): { name: string; section?: string } {
    const lowerName = fullName.toLowerCase();
    let splitIndex = -1;

    for (const d of delimiters) {
        const idx = lowerName.indexOf(d);
        if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
            splitIndex = idx;
        }
    }

    if (splitIndex !== -1) {
        let namePart = fullName.substring(0, splitIndex).trim();
        let sectionPart = fullName.substring(splitIndex).trim();

        // Standardize section start: capitalize first letter
        sectionPart = sectionPart.charAt(0).toUpperCase() + sectionPart.slice(1);

        // Distance pattern adjustment (e.g., "River 0.5 mi at Site" -> Name: River, Section: 0.5 mi at Site)
        const lowerSection = sectionPart.toLowerCase();
        if (lowerSection.includes('upstream') || lowerSection.includes('downstream') || lowerSection.includes('en aval') || lowerSection.includes('en amont')) {
            const parts = namePart.split(/\s+/);
            const last = parts[parts.length - 1];
            const secondLast = parts[parts.length - 2];
            const thirdLast = parts[parts.length - 3];
            
            if (last && /^(mi|km|miles|kilometers)$/i.test(last) && secondLast && /^[0-9.]+$/.test(secondLast)) {
                let distance = secondLast + " " + last;
                if (thirdLast && /^(at|à|a)$/i.test(thirdLast)) {
                    distance = thirdLast + " " + distance;
                }
                namePart = namePart.substring(0, namePart.lastIndexOf(distance)).trim();
                sectionPart = distance + " " + sectionPart;
            }
        }

        return { name: namePart, section: sectionPart };
    }

    return { name: fullName };
}

function formatUSGSName(name: string): { name: string; section?: string } {
    const formatted = titleCase(name, true);
    const delimiters = [' at ', ' near ', ' in ', ' on ', ' above ', ' below ', ' upstream ', ' downstream ', ' into '];
    const result = splitNameAndSection(formatted, delimiters);

    // Fallback: splitting at the first comma if it follows a river descriptor
    if (!result.section) {
        const commaIndex = result.name.indexOf(',');
        if (commaIndex !== -1) {
            const riverWords = new Set(['river', 'creek', 'stream', 'run', 'fork', 'branch', 'brook', 'canal', 'lake', 'reservoir', 'r', 'cr', 'fk', 'br']);
            const beforeComma = result.name.substring(0, commaIndex).trim().toLowerCase();
            const lastWord = beforeComma.split(' ').pop();
            if (lastWord && riverWords.has(lastWord)) {
                return {
                    name: result.name.substring(0, commaIndex).trim(),
                    section: result.name.substring(commaIndex).trim()
                };
            }
        }
    }

    return result;
}

function formatCanadaName(name: string): { name: string; section?: string } {
    const formatted = titleCase(name);
    // Include French delimiters for Canadian sites
    const delimiters = [' at ', ' near ', ' in ', ' on ', ' à ', ' a ', ' en aval ', ' en amont ', ' près de ', ' pres de '];
    return splitNameAndSection(formatted, delimiters);
}

function formatUKIrelandName(name: string): { name: string; section?: string } {
    let processedName = name;
    
    // Handle specific UK/Ireland mangled strings
    if (processedName.toUpperCase().includes("TOF TO BE WITSD")) {
        processedName = processedName.replace(/TOF TO BE WITSD/i, "(Time of Flight - to be Withdrawn)");
    }

    // Ireland pattern: "Ballybofey (Finn)" -> Name: Ballybofey, Section: (Finn)
    const parenMatch = /^([^(]+)\(([^)]+)\)$/.exec(processedName);
    if (parenMatch) {
        const primary = titleCase(parenMatch[1].trim());
        const secondary = titleCase(parenMatch[2].trim());
        return { 
            name: primary, 
            section: `(${secondary})`
        };
    }

    const formatted = titleCase(processedName);
    const delimiters = [' at ', ' near '];
    return splitNameAndSection(formatted, delimiters);
}

function formatGenericName(name: string): { name: string; section?: string } {
    const formatted = titleCase(name, true);
    const delimiters = [' at ', ' near ', ' above ', ' below '];
    return splitNameAndSection(formatted, delimiters);
}

/**
 * Normalizes a region/state name into a 2-3 character code.
 * Standardizes US/Canada codes and maps UK/Ireland names.
 */
export function formatStateCode(state: string | undefined, provider: string): string | undefined {
    if (!state) return undefined;
    const s = state.trim();
    const upper = s.toUpperCase();

    if (provider === 'USGS' || provider === 'NWS' || provider === 'Canada' || provider === 'EC') {
        // Return 2-letter codes as-is
        return upper.length <= 3 ? upper : undefined;
    }

    if (provider === 'Ireland' || provider === 'ireland') {
        const irelandCounties: Record<string, string> = {
            'CARLOW': 'CW', 'CAVAN': 'CN', 'CLARE': 'CE', 'CORK': 'CO', 'DONEGAL': 'DL',
            'DUBLIN': 'D', 'GALWAY': 'G', 'KERRY': 'KY', 'KILDARE': 'KE', 'KILKENNY': 'KK',
            'LAOIS': 'LS', 'LEITRIM': 'LM', 'LIMERICK': 'LK', 'LONGFORD': 'LD', 'LOUTH': 'LH',
            'MAYO': 'MO', 'MEATH': 'MH', 'MONAGHAN': 'MN', 'OFFALY': 'OY', 'ROSCOMMON': 'RN',
            'SLIGO': 'SO', 'TIPPERARY': 'T', 'WATERFORD': 'WD', 'WESTMEATH': 'WH', 'WEXFORD': 'WX',
            'WICKLOW': 'WW'
        };
        return irelandCounties[upper] || (s.length <= 3 ? upper : undefined);
    }

    if (provider === 'UK') {
        const ukAreas: Record<string, string> = {
            'DEVON AND CORNWALL': 'DC',
            'SOLENT AND SOUTH DOWNS': 'SSD',
            'KENT AND SOUTH LONDON': 'KSL',
            'HERTFORDSHIRE AND NORTH LONDON': 'HNL',
            'THAMES': 'THM',
            'EAST ANGLIA': 'EA',
            'LINCOLNSHIRE AND NORTHAMPTONSHIRE': 'LN',
            'EAST MIDLANDS': 'EM',
            'WEST MIDLANDS': 'WM',
            'DURHAM, NORTHUMBERLAND AND TEES': 'DNT',
            'CUMBRIA AND LANCASHIRE': 'CL',
            'WESSEX': 'WSX',
            'YORKSHIRE': 'YKS'
        };
        return ukAreas[upper] || (s.length <= 3 ? upper : undefined);
    }

    return s.length <= 3 ? upper : undefined;
}
