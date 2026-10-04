import { describe, it, expect } from "vitest";
import {
  isUsaceLakeGauge, parseUsaceGauge, usaceGaugeId, usaceSiblingId, buildUsaceDamOptions, matchUsaceDam,
} from "./usaceGauges";

describe("usaceGauges", () => {
  it("parses outflow and lake gauge ids and rejects others", () => {
    expect(parseUsaceGauge("USACE:LRH.Summersville")).toEqual({ dam: "LRH.Summersville", kind: "release" });
    expect(parseUsaceGauge("USACE:LRH.Summersville.Lake")).toEqual({ dam: "LRH.Summersville", kind: "lake" });
    expect(parseUsaceGauge("USACE:")).toBeNull();
    expect(parseUsaceGauge("USACE:Summersville")).toBeNull();
    expect(parseUsaceGauge("USGS:03189600")).toBeNull();
    expect(parseUsaceGauge()).toBeNull();
  });

  it("builds ids, siblings and the lake check", () => {
    expect(usaceGaugeId("LRH.Summersville", "lake")).toBe("USACE:LRH.Summersville.Lake");
    expect(usaceSiblingId("USACE:LRH.Summersville")).toBe("USACE:LRH.Summersville.Lake");
    expect(usaceSiblingId("USACE:LRH.Summersville.Lake")).toBe("USACE:LRH.Summersville");
    expect(usaceSiblingId("USGS:1")).toBeNull();
    expect(isUsaceLakeGauge("USACE:LRH.Summersville.Lake")).toBe(true);
    expect(isUsaceLakeGauge("USACE:LRH.Summersville")).toBe(false);
  });

  const gauges = [
    { id: "USACE:LRH.Summersville", name: "Summersville Lake (Outflow)", states: "WV" },
    { id: "USACE:LRH.Summersville.Lake", name: "Summersville Lake (Lake Level)", states: "WV" },
    { id: "USACE:LRP.Youghiogheny", name: "Youghiogheny River Lake (Outflow)", states: "PA" },
    { id: "USACE:SWT.KEYS.Lake", name: "Keystone Lake (Lake Level)", states: "OK" },
    { id: "USACE:SWL.Keystone_Lake", name: "Keystone Lake (Outflow)", states: "OK" },
    { id: "USGS:03189600", name: "Gauley River", states: "WV" },
  ];

  it("makes one option per dam with its available gauges, disambiguating equal labels", () => {
    expect(buildUsaceDamOptions(gauges)).toEqual([
      { dam: "SWL.Keystone_Lake", label: "Keystone Lake, OK (SWL.Keystone_Lake)", kinds: ["release"] },
      { dam: "SWT.KEYS", label: "Keystone Lake, OK (SWT.KEYS)", kinds: ["lake"] },
      { dam: "LRH.Summersville", label: "Summersville Lake, WV", kinds: ["release", "lake"] },
      { dam: "LRP.Youghiogheny", label: "Youghiogheny River Lake, PA", kinds: ["release"] },
    ]);
  });

  it("matches a label exactly or a typed code, but not partial text", () => {
    const options = buildUsaceDamOptions(gauges);
    expect(matchUsaceDam(options, "Summersville Lake, WV")?.dam).toBe("LRH.Summersville");
    expect(matchUsaceDam(options, " LRH.Summersville ")?.dam).toBe("LRH.Summersville");
    expect(matchUsaceDam(options, "USACE:LRH.Summersville.Lake")?.dam).toBe("LRH.Summersville");
    expect(matchUsaceDam(options, "Summersville")).toBeUndefined();
    expect(matchUsaceDam(options, "")).toBeUndefined();
  });
});
