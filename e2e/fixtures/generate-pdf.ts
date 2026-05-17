/**
 * Utility that returns a minimal valid PDF as a Buffer.
 * Used when the test needs to upload a document (e.g., photo_id fixture).
 * The PDF is a 3×3-point single blank page — no text, no embedded objects.
 */
export function minimalPdf(): Buffer {
  return Buffer.from(
    // Minimal 1-page PDF — generated from a known-good structure
    "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIg" +
    "MCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2Jq" +
    "PDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCAzIDNdL1BhcmVudCAyIDAgUj4+ZW5kb2JqCnhy" +
    "ZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAw" +
    "MDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKdHJhaWxlcjw8L1NpemUgNC9Sb290" +
    "IDEgMCBSPj4Kc3RhcnR4cmVmCjE5MAolJUVPRg==",
    "base64",
  );
}
