/**
 * Minimal Server-Sent Events parser over `fetch` + `ReadableStream`.
 *
 * The built-in `EventSource` API can't send custom headers, so the
 * Workspace chat — which needs the Clerk `X-User-Id` header — falls
 * back to a streaming fetch and parses the wire format manually.
 *
 * Wire format (we only emit the ``data:`` field):
 *
 *   data: <json-payload>
 *   <blank line>
 *
 * We yield each parsed payload to the consumer.
 */

export type SSEvent = Record<string, unknown>;

export async function* readSSE(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<SSEvent, void, void> {
  if (!response.body) {
    throw new Error("La respuesta no es un stream.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line. Process all complete
      // frames currently in the buffer, leave any partial frame for
      // the next iteration.
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (dataLine) {
          const raw = dataLine.slice(5).trim();
          if (raw) {
            try {
              yield JSON.parse(raw) as SSEvent;
            } catch {
              // Drop malformed frames silently — the backend is the
              // only producer here so this should never happen, but
              // we don't want one bad frame to take down the stream.
            }
          }
        }
        sep = buffer.indexOf("\n\n");
      }
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}
