export interface LocalSharePayloadV2 {
  v: 2;
  n: string;
  f: string;
  p: string | null;
  pe: string[];
  d: [string, number][];
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid deck link");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function deflateToBase64Url(value: string): Promise<string> {
  const stream = new Blob([value]).stream().pipeThrough(new CompressionStream("deflate"));
  return toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

export async function inflateBase64Url(value: string): Promise<string> {
  const bytes = fromBase64Url(value);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Response(stream).text();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

export function parseLocalSharePayload(value: unknown): LocalSharePayloadV2 {
  if (!value || typeof value !== "object") throw new Error("Unsupported deck format");
  const payload = value as Partial<LocalSharePayloadV2>;
  if (payload.v !== 2 || typeof payload.n !== "string" || typeof payload.f !== "string"
    || !(payload.p === null || typeof payload.p === "string")
    || !isStringArray(payload.pe)
    || !Array.isArray(payload.d)
    || !payload.d.every((entry) => Array.isArray(entry) && entry.length === 2
      && typeof entry[0] === "string" && entry[0].length > 0
      && Number.isInteger(entry[1]) && entry[1] > 0)) {
    throw new Error("Unsupported deck format");
  }
  return payload as LocalSharePayloadV2;
}
