/**
 * Creates a ReadableStream that yields a JSON object representation of the provided data Map or Record.
 * Useful for bypassing memory limits when stringifying large datasets.
 */
export function streamJSONObject(data: Record<string, any>, extraKeys: Record<string, any> = {}): ReadableStream {
  // Use globalThis to ensure we get the runtime constructor in both Node and Cloudflare
  const { readable, writable } = new (globalThis as any).TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      await writer.write(encoder.encode("{"));
      
      let first = true;
      
      // Write extra keys (like generatedAt) first
      for (const [key, value] of Object.entries(extraKeys)) {
        if (!first) await writer.write(encoder.encode(",\n"));
        await writer.write(encoder.encode(`${JSON.stringify(key)}: ${JSON.stringify(value)}`));
        first = false;
      }

      // Write data entries
      const keys = Object.keys(data);
      for (const key of keys) {
        if (!first) await writer.write(encoder.encode(",\n"));
        // We stringify the individual entry to keep memory pressure per-gauge
        await writer.write(encoder.encode(`  ${JSON.stringify(key)}: ${JSON.stringify(data[key])}`));
        first = false;
      }

      await writer.write(encoder.encode("\n}"));
    } catch (err) {
      console.error("Stream writer encountered an error:", err);
    } finally {
      await writer.close();
    }
  })();

  return readable;
}
