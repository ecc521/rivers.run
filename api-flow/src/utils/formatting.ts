export function formatGaugeName(name: string): { name: string; section?: string } {
    const lowercaseWords = new Set(['at', 'near', 'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'in', 'to', 'of', 'by', 'as', 'above', 'below', 'blw', 'abv', 'nr', 'be']);
    
    const expansions: Record<string, string> = {
        nr: 'near',
        blw: 'below',
        abv: 'above',
        br: 'branch',
        cr: 'creek',
        rd: 'Road',
        st: 'St',
        gs: 'Gauging Station',
        ds: 'Downstream',
        us: 'Upstream',
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

    if (provider === 'USGS' || provider === 'NWS' || provider === 'Canada') {
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
