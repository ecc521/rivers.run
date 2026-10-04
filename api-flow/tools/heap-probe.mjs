// Measures the heap that parsing bulk provider payloads retains, to check a new provider
// against the Worker's memory budget (see "Memory budget" in api-flow/AGENTS.md).
//
//   node --expose-gc api-flow/tools/heap-probe.mjs [--fiman feed.json] [--gauge gauge.json] [--nws box.json] [--histories 100]
//
// With no file arguments the payloads are fetched live. FIMAN answers 403 unless the request
// is HTTP/1.1 with the Flow Bot user agent, and Node's fetch may negotiate HTTP/2, so save
// its payloads with curl and pass them as files:
//   curl --http1.1 -A "Rivers.run Flow Bot (https://rivers.run; contact: support@rivers.run)" \
//     https://fiman.nc.gov/api/gaugefeatures -o feed.json     (and .../api/gauges/25530 -o gauge.json)

const UA = "Rivers.run Flow Bot (https://rivers.run; contact: support@rivers.run)";
const NWS_NC_BOX = "https://api.water.noaa.gov/nwps/v1/gauges?bbox.xmin=-84.5&bbox.ymin=33.7&bbox.xmax=-75.3&bbox.ymax=36.7&srid=EPSG_4326";
const FIMAN = "https://fiman.nc.gov/api";
const HEADROOM_MB = 50;

if (!global.gc) {
    console.error("Run with: node --expose-gc api-flow/tools/heap-probe.mjs");
    process.exit(1);
}

const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const mb = (bytes) => (bytes / 1048576).toFixed(1);
const heap = () => { global.gc(); return process.memoryUsage().heapUsed; };

async function load(file, url) {
    if (file) return (await import("node:fs")).readFileSync(file, "utf8");
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status} for ${url}${res.status === 403 ? " (FIMAN needs HTTP/1.1; save it with curl, see the header)" : ""}`);
    return res.text();
}

const held = [];
let total = 0;
function measure(label, text, parse) {
    const before = heap();
    const value = parse(text);
    const retained = heap() - before;
    held.push(value);
    total += retained;
    console.log(`${label.padEnd(34)} ${mb(text.length).padStart(5)} MB payload -> ${mb(retained).padStart(5)} MB retained`);
}

const fimanText = await load(arg("--fiman"), `${FIMAN}/gaugefeatures`);
measure("FIMAN feed (all gauges)", fimanText, JSON.parse);
const nwsText = await load(arg("--nws"), NWS_NC_BOX);
measure("NWS bounding box (NC)", nwsText, JSON.parse);

const count = Number(arg("--histories") ?? 15);
const oneGauge = await load(arg("--gauge"), `${FIMAN}/gauges/25530`);
measure(`${count} FIMAN gauge histories at once`, oneGauge, (t) => Array.from({ length: count }, () => JSON.parse(t)));

console.log(`\nTotal retained: ${mb(total)} MB. Budget for everything a provider holds at once: about ${HEADROOM_MB} MB.`);
console.log("Parsed payloads are held next to the response text, so peak use can be up to twice this.");
