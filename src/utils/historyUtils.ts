import type { RiverData } from "../types/River";

/**
 * Reconstructs the state of a river at a specific point in time by 
 * unwinding diff patches from the current live state.
 * 
 * @param currentRiver The current live data from the database
 * @param audits Array of audit logs sorted DESC (newest first)
 * @param targetIndex The index in the audits array we want to see the state BEFORE it was applied.
 *                    Actually, usually we want to see the state AS IT WAS after this edit.
 *                    So we unwind all edits NEWER than targetIndex.
 */
export function reconstructHistoricalState(currentRiver: RiverData, audits: any[], targetIndex: number): RiverData {
    // Deep clone to avoid mutations
    const state = JSON.parse(JSON.stringify(currentRiver)) as any;

    // To see the state AFTER audits[targetIndex] was applied, 
    // we must undo all audits that came AFTER it (index 0, 1, ..., targetIndex - 1).
    // Note: If targetIndex is 0 (the most recent edit), we unwind nothing to see the result of that edit,
    // but wait, if we want to see what it looked like AFTER that edit, that's just the current state.
    // If we want to see what it looked like BEFORE that edit, we unwind audits[0].
    
    // If the user selects Version N in a list, they usually want to see what the river looked like 
    // at that specific point in time.
    
    for (let i = 0; i <= targetIndex; i++) {
        const audit = audits[i];
        let diff = audit.diff_patch;
        
        if (typeof diff === 'string') {
            try {
                diff = JSON.parse(diff);
            } catch (e) {
                console.error("Failed to parse diff_patch", e);
                continue;
            }
        }
        
        // The diff_patch format is { key: { old: val, new: val } }
        // BUT for approvals, it's { diff: { ... }, note: "...", type: "approval" }
        const actualDiff = diff.diff || diff;
        
        for (const [key, change] of Object.entries(actualDiff)) {
            const c = change as { old: any, new: any };
            // Apply the 'old' value to go back in time
            state[key] = c.old;
        }
    }

    return state as RiverData;
}

/**
 * Helper to get a human-readable list of changes from a diff_patch
 */
export function getDiffSummary(diff: any): string[] {
    const d = typeof diff === 'string' ? JSON.parse(diff) : diff;
    const summaries: string[] = [];
    
    const FIELD_MAP: Record<string, string> = {
        name: "River Name",
        section: "Section",
        class: "Class",
        skill: "Skill Level",
        writeup: "Description",
        states: "States",
        altname: "Alternative Name",
        tags: "Tags",
        gauges: "Gauge Mapping",
        accessPoints: "Access Points",
        flow: "Flow Thresholds"
    };

    for (const key of Object.keys(d)) {
        summaries.push(FIELD_MAP[key] || key);
    }

    return summaries;
}
