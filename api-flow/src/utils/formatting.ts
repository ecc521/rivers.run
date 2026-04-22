export function formatGaugeName(name: string): { name: string; section?: string } {
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

    // Pre-processing for specific mangled strings or parentheses
    let processedName = name;
    
    // Handle "TOF TO BE WITSD" -> "Time of Flight - To be Withdrawn"
    if (processedName.toUpperCase().includes("TOF TO BE WITSD")) {
        processedName = processedName.replace(/TOF TO BE WITSD/i, "(Time of Flight - To be Withdrawn)");
    }

    // Splitting logic for parentheses (common in Ireland/UK)
    // "Ballybofey (Finn)" -> Name: Ballybofey, Section: Finn
    const parenMatch = /^([^(]+)\(([^)]+)\)$/.exec(processedName);
    if (parenMatch) {
        const primary = formatGaugeNameInner(parenMatch[1].trim(), lowercaseWords, expansions, stateCodes, acronyms);
        const secondary = formatGaugeNameInner(parenMatch[2].trim(), lowercaseWords, expansions, stateCodes, acronyms);
        return { 
            name: primary.name, 
            section: secondary.section ? `(${secondary.name} ${secondary.section})` : `(${secondary.name})`
        };
    }

    return formatGaugeNameInner(processedName, lowercaseWords, expansions, stateCodes, acronyms);
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


    if (provider === 'Ireland') {
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

function formatGaugeNameInner(name: string, lowercaseWords: Set<string>, expansions: Record<string, string>, stateCodes: Set<string>, acronyms: Set<string>): { name: string; section?: string } {
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
                const isLowercaseExpandedWord = lowercaseWords.has(expansion.toLowerCase());
                if (!isFirst && isLowercaseExpandedWord) {
                    formatted += expansion.toLowerCase();
                } else {
                    formatted += expansion.charAt(0).toUpperCase() + expansion.slice(1);
                }
            } else if (acronyms.has(upperToken)) {
                formatted += upperToken;
            } else if (stateCodes.has(upperToken) && (isLast || followsComma)) {
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

    const normalizedName = formatted.replace(/\s+/g, ' ').trim();
    const delimiters = [' at ', ' near ', ' above ', ' below ', ' upstream ', ' downstream ', ' à ', ' a ', ' en aval ', ' en amont '];

    let splitIndex = -1;
    const lowerFormatted = normalizedName.toLowerCase();

    for (const d of delimiters) {
        const idx = lowerFormatted.indexOf(d);
        if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
            splitIndex = idx;
        }
    }

    // Fallback: splitting at the first comma if it follows a river descriptor
    if (splitIndex === -1) {
        const commaIndex = normalizedName.indexOf(',');
        if (commaIndex !== -1) {
            const riverWords = new Set(['river', 'creek', 'stream', 'run', 'fork', 'branch', 'brook', 'canal', 'lake', 'reservoir', 'r', 'cr', 'fk', 'br', 'rivière', 'ruisseau', 'fleuve', 'lac']);
            const beforeComma = normalizedName.substring(0, commaIndex).trim().toLowerCase();
            const lastWord = beforeComma.split(' ').pop();
            if (lastWord && riverWords.has(lastWord)) {
                splitIndex = commaIndex;
            }
        }
    }


    if (splitIndex !== -1) {
        let gaugeName = normalizedName.substring(0, splitIndex).trim();
        let section = normalizedName.substring(splitIndex).trim();

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

        section = section.charAt(0).toUpperCase() + section.slice(1); // Capitalize first letter of section
        return { name: gaugeName, section };
    }

    return { name: normalizedName };
}
