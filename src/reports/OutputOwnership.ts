import { safePath } from "./PathSafety";
export const receiptPath = (output: string): string =>
  `${output}.murmuration-report.json`;
export const tableMarker = (definition: string): string =>
  `<!-- mwc-derived-artefact:state-table definition=${encodeURIComponent(definition)} -->`;
export interface OutputReceipt {
  readonly version: 1;
  readonly definitionPath: string;
  readonly outputPath: string;
  readonly digest: string;
}
export async function digest(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  return Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function parseReceipt(raw: string): OutputReceipt {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid ownership receipt.");
  const r = value as Record<string, unknown>;
  if (
    r.version !== 1 ||
    !safePath(r.definitionPath) ||
    !safePath(r.outputPath) ||
    typeof r.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(r.digest)
  )
    throw new Error("Invalid or unsupported ownership receipt.");
  return r as unknown as OutputReceipt;
}
export function markerOwner(content: string): string | null {
  const occurrences =
    content.match(/<!--\s*mwc-derived-artefact:state-table\b/g) ?? [];
  if (!occurrences.length) return null;
  const match =
    /(?:^|\r?\n)(<!-- mwc-derived-artefact:state-table definition=([^\s<>]+) -->)(?:\r?\n)?$/.exec(
      content,
    );
  if (occurrences.length !== 1 || !match)
    throw new Error("Conflicting or malformed table ownership markers.");
  let owner: string;
  try {
    owner = decodeURIComponent(match[2]);
  } catch {
    throw new Error("Malformed table ownership marker.");
  }
  if (!safePath(owner) || match[1] !== tableMarker(owner))
    throw new Error("Non-canonical table ownership marker.");
  return owner;
}
export function serialiseReceipt(receipt: OutputReceipt): string {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}
