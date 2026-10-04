/**
 * USACE dams are split into two gauges: the outflow gauge "USACE:LRH.Summersville"
 * (release, tailwater stage, projected releases) and the lake gauge
 * "USACE:LRH.Summersville.Lake", whose ft is pool elevation, not river stage.
 */

const PREFIX = "USACE:";
const LAKE_SUFFIX = ".Lake";
const NAME_SUFFIX = / \((Outflow|Lake Level)\)$/;

export type UsaceGaugeKind = "release" | "lake";

/** A dam code ("LRH.Summersville"), optionally with the lake suffix. */
export const USACE_CODE_PATTERN = /^[A-Za-z]+\.[A-Za-z0-9_-]+(\.Lake)?$/;

export function isUsaceLakeGauge(gaugeId?: string): boolean {
    return /^USACE:.+\.Lake$/i.test(gaugeId ?? "");
}

/** The dam code and gauge kind of a USACE gauge id, or null for anything else. */
export function parseUsaceGauge(gaugeId?: string): { dam: string; kind: UsaceGaugeKind } | null {
    if (!gaugeId?.startsWith(PREFIX)) return null;
    const code = gaugeId.slice(PREFIX.length);
    if (!USACE_CODE_PATTERN.test(code)) return null;
    return code.endsWith(LAKE_SUFFIX)
        ? { dam: code.slice(0, -LAKE_SUFFIX.length), kind: "lake" }
        : { dam: code, kind: "release" };
}

export function usaceGaugeId(dam: string, kind: UsaceGaugeKind): string {
    return `${PREFIX}${dam}${kind === "lake" ? LAKE_SUFFIX : ""}`;
}

/** The other gauge of the same dam. */
export function usaceSiblingId(gaugeId?: string): string | null {
    const parsed = parseUsaceGauge(gaugeId);
    return parsed ? usaceGaugeId(parsed.dam, parsed.kind === "lake" ? "release" : "lake") : null;
}

export interface UsaceDamOption {
    /** Dam code, e.g. "LRH.Summersville". */
    dam: string;
    /** What the picker shows and matches typed text against, unique across options. */
    label: string;
    kinds: UsaceGaugeKind[];
}

/** One option per dam from the loaded gauge list, sorted by label. */
export function buildUsaceDamOptions(gauges: Array<{ id: string; name?: string; states?: string }>): UsaceDamOption[] {
    const byDam = new Map<string, { name: string; state: string; kinds: Set<UsaceGaugeKind> }>();
    for (const g of gauges) {
        const parsed = parseUsaceGauge(g.id);
        if (!parsed) continue;
        const entry = byDam.get(parsed.dam) ?? { name: "", state: "", kinds: new Set<UsaceGaugeKind>() };
        entry.kinds.add(parsed.kind);
        entry.name ||= (g.name ?? "").replace(NAME_SUFFIX, "");
        entry.state ||= g.states ?? "";
        byDam.set(parsed.dam, entry);
    }

    const base = [...byDam].map(([dam, e]) => ({
        dam,
        label: e.state ? `${e.name || dam}, ${e.state}` : e.name || dam,
        kinds: (["release", "lake"] as const).filter(k => e.kinds.has(k)),
    }));
    const counts = new Map<string, number>();
    for (const o of base) counts.set(o.label, (counts.get(o.label) ?? 0) + 1);
    return base
        .map(o => (counts.get(o.label)! > 1 ? { ...o, label: `${o.label} (${o.dam})` } : o))
        .sort((a, b) => a.label.localeCompare(b.label));
}

/** The option typed text refers to: an exact label, or a dam code with or without "USACE:" and ".Lake". */
export function matchUsaceDam(options: UsaceDamOption[], text: string): UsaceDamOption | undefined {
    const t = text.trim();
    if (!t) return undefined;
    const byLabel = options.find(o => o.label === t);
    if (byLabel) return byLabel;
    const code = parseUsaceGauge(t.startsWith(PREFIX) ? t : PREFIX + t)?.dam;
    return code ? options.find(o => o.dam === code) : undefined;
}
