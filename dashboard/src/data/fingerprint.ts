// A tiny deterministic hash so edited approvals get a fresh, real-looking
// fingerprint that changes with the payload. NOT cryptographic — demo only.
export function shortHash(input: string, len = 14): string {
  // FNV-1a 32-bit, expanded into hex of the requested length.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let hex = '';
  let seed = h >>> 0;
  while (hex.length < len) {
    seed = (Math.imul(seed, 0x01000193) ^ (seed >>> 15)) >>> 0;
    hex += seed.toString(16).padStart(8, '0');
  }
  return hex.slice(0, len);
}

export function fingerprintOf(input: string): string {
  return `sha256:${shortHash(input, 14)}`;
}
