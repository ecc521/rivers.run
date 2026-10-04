import type { RiverData } from "../types/River";
import type { UserList } from "../context/ListsContext";
import { getCountryName, getRiverCountries } from "./regions";
import { getRiverShareUrl } from "./url";

const MAX_DESCRIPTION = 160;

function clamp(text: string): string {
  if (text.length <= MAX_DESCRIPTION) return text;
  const cut = text.slice(0, MAX_DESCRIPTION - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function regionOf(river: RiverData): string {
  const states = river.states?.trim();
  const countries = Array.from(getRiverCountries(river), (c) => getCountryName(c)).join(", ");
  return [states, countries].filter(Boolean).join(", ");
}

export function buildRiverTitle(river: RiverData): string {
  return river.section ? `${river.name} - ${river.section}` : river.name;
}

export function buildRiverDescription(river: RiverData): string {
  const place = regionOf(river);
  const where = place ? ` in ${place}` : "";
  if (river.isGauge) {
    return clamp(
      `Live flow and stage readings for ${river.name}${where}, with history graphs and current conditions on Rivers.run.`
    );
  }
  const section = river.section ? ` (${river.section})` : "";
  const cls = river.class ? `Class ${river.class} whitewater` : "Whitewater";
  const gradient = river.averagegradient ? `, ${river.averagegradient} ft/mi average gradient` : "";
  return clamp(
    `${river.name}${section}${where}: ${cls}${gradient}. Live flow, running status, and access points on Rivers.run.`
  );
}

export function buildRiverCanonical(river: RiverData): string {
  return getRiverShareUrl(river);
}

export function buildListDescription(list: UserList | null): string {
  const fallback = "A curated list of whitewater rivers and live flow conditions from paddlers on Rivers.run. Open it to see which sections are running right now.";
  if (!list) return fallback;
  const count = list.rivers?.length ?? 0;
  const intro = list.description?.trim();
  const tail = ` ${count} river${count === 1 ? "" : "s"} with live flow data on Rivers.run.`;
  return clamp(intro ? `${intro}${tail}` : `${list.title}: a curated paddling list.${tail}`);
}
