// Local sentence-embedding model for paraphrase-robust retrieval.
//
// Runs in-process via transformers.js (Xenova/all-MiniLM-L6-v2, 384-dim) — no
// API key, no per-query network call, deterministic. Used to route a lay
// caseworker question to the right regulation by comparing it against
// plain-English section descriptors (see section-descriptors.ts). The model
// loads lazily and is cached for the process; EVERY failure path degrades
// gracefully (callers fall back to lexical retrieval), so a runtime/serverless
// hiccup can never break Mae — it just loses the semantic recall boost.

export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";

type Extractor = (
  text: string,
  opts: { pooling: "mean"; normalize: true },
) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<Extractor> | null = null;

async function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // Dynamic import keeps the native/WASM dep out of the static bundle.
      const { pipeline, env } = await import("@xenova/transformers");
      // On Vercel the only writable dir is /tmp; cache the model there.
      if (process.env.VERCEL) env.cacheDir = "/tmp/xenova-cache";
      env.allowRemoteModels = true;
      return (await pipeline("feature-extraction", EMBED_MODEL)) as unknown as Extractor;
    })().catch((err) => {
      extractorPromise = null; // allow a later retry
      throw err;
    });
  }
  return extractorPromise;
}

// The onnxruntime session is NOT safe to call concurrently — parallel embeds
// race and throw. Serialize every embed through this promise chain so they run
// one at a time (still fast: ~4ms each after the model is warm).
let queue: Promise<unknown> = Promise.resolve();

/** Embed text to a unit-normalized vector. Throws if the model is unavailable. */
export async function embed(text: string): Promise<number[]> {
  const run = async (): Promise<number[]> => {
    const ext = await getExtractor();
    const out = await ext(text, { pooling: "mean", normalize: true });
    return Array.from(out.data as Float32Array);
  };
  const result = queue.then(run, run); // run regardless of the prior call's outcome
  queue = result.catch(() => {}); // keep the chain alive after a failure
  return result;
}

/** Cosine similarity of two unit-normalized vectors (== dot product). */
export function cosine(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length && i < b.length; i++) d += a[i] * b[i];
  return d;
}
