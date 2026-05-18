/**
 * Python runtime adapter — STUB.
 *
 * Will spawn `python -m civica_analytics.<dataset>` for parsers that need
 * pandas/pyarrow/pdfplumber. Wraps stdout JSON in the same Result<T> shape
 * the Node runtime returns.
 *
 * Implement when the first Python-only parser ships (likely per_pdf_to_parquet.py).
 */

export const PYTHON_RUNTIME_STATUS = "stub" as const;

export function notImplemented(): never {
  throw new Error(
    "@civica/analytics-engine: python runtime not implemented yet. " +
      "Use @civica/analytics-engine/node for server-side queries.",
  );
}
