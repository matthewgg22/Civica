// Local sentence-embedding model for paraphrase-robust retrieval.
//
// Runs in-process via transformers.js (Xenova/all-MiniLM-L6-v2, 384-dim) — no
// API key, no network call, deterministic. Used to route a lay question to the
// right regulation by comparing it against plain-English section descriptors
// (see section-descriptors.ts). EVERY failure path degrades gracefully to
// lexical retrieval — but LOUDLY (eng review 3A/F6): the fallback logs once,
// semanticLayerStatus() feeds the health endpoint and the per-answer
// retrievalMode audit field, and the fallback-rate alert watches production.
//
// VENDORED WEIGHTS (eng review 3A): the quantized model (~23MB) is committed
// at packages/demeter-engine/models/ and loaded from disk with
// allowRemoteModels=false — production provably runs the configuration the
// evals and the published benchmark score were measured in; a Hugging Face
// CDN outage can no longer silently degrade cold instances. Vercel ships the
// files via outputFileTracingIncludes in each app's next.config (fs reads are
// invisible to the tracer). Path resolution probes candidates because
// __dirname is rewritten inside transpiled packages — the resolved path is
// logged at load, so a tracing miss is visible in one log line.

import { existsSync } from "node:fs";
import path from "node:path";

export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";

type Extractor = (
  text: string,
  opts: { pooling: "mean"; normalize: true },
) => Promise<{ data: Float32Array | number[] }>;

export type SemanticStatus = "uninitialized" | "loading" | "ready" | "unavailable";
let status: SemanticStatus = "uninitialized";
let unavailableReason = "";
let lastLoggedReason: string | null = null;

/** Health-endpoint + audit signal: which retrieval mode this process runs. */
export function semanticLayerStatus(): { status: SemanticStatus; reason?: string } {
  return status === "unavailable" ? { status, reason: unavailableReason } : { status };
}

export function retrievalMode(): "semantic+lexical" | "lexical" {
  return status === "ready" ? "semantic+lexical" : "lexical";
}

/** Locate the vendored models/ dir. cwd differs by consumer (apps/web,
 *  apps/dashboard, the package itself in vitest) and Vercel's traced lambda —
 *  probe the known layouts and log the winner once. */
function resolveLocalModelPath(): string | null {
  const candidates = [
    // Running from an app dir (apps/web, apps/dashboard) — local dev + Vercel
    // (outputFileTracingRoot = repo root preserves this relative layout).
    path.join(process.cwd(), "..", "..", "packages", "demeter-engine", "models"),
    // Running from the repo root or a traced bundle rooted there.
    path.join(process.cwd(), "packages", "demeter-engine", "models"),
    // Through the pnpm workspace symlink (materialized by Vercel tracing).
    path.join(process.cwd(), "node_modules", "@civica", "demeter-engine", "models"),
    // Running inside the package itself (vitest).
    path.join(process.cwd(), "models"),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, EMBED_MODEL, "onnx", "model_quantized.onnx"))) return c;
  }
  return null;
}

let extractorPromise: Promise<Extractor> | null = null;

async function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    status = "loading";
    extractorPromise = (async () => {
      // Dynamic import keeps the native/WASM dep out of the static bundle.
      const { pipeline, env } = await import("@xenova/transformers");
      const localPath = resolveLocalModelPath();
      if (!localPath) {
        throw new Error(
          "vendored model not found — packages/demeter-engine/models missing from " +
            `the deployment (checked from cwd=${process.cwd()}); verify ` +
            "outputFileTracingIncludes in the consuming app's next.config",
        );
      }
      env.localModelPath = localPath;
      env.allowRemoteModels = false; // never the HF CDN — prod matches eval mode
      const extractor = (await pipeline(
        "feature-extraction",
        EMBED_MODEL,
      )) as unknown as Extractor;
      // Kept, not silenced. Whether the semantic layer actually loaded or
      // quietly fell back to lexical-only is invisible from output — and when
      // it was silently dead locally it corrupted a whole eval run before
      // anyone noticed. This line is how you tell the two apart.
      // eslint-disable-next-line no-console -- readiness signal for a layer that fails silently
      console.info(`[demeter] semantic layer ready (vendored model at ${localPath})`);
      status = "ready";
      return extractor;
    })().catch((err) => {
      extractorPromise = null; // allow a later retry
      status = "unavailable";
      unavailableReason = (err instanceof Error ? err.message : String(err)) || String(err);
      // LOUD, but deduped: this line is what the fallback-rate alert and the
      // deploy smoke-check grep for — one line per distinct failure, not per
      // request (retries re-attempt the load and would otherwise spam).
      if (lastLoggedReason !== unavailableReason) {
        lastLoggedReason = unavailableReason;
        console.error("[demeter] SEMANTIC LAYER UNAVAILABLE — lexical-only:", unavailableReason);
      }
      throw err;
    });
  }
  return extractorPromise;
}

/** Fire-and-forget model load. Call at ROUTE module scope (not the package
 *  barrel — SSG build workers must not pay the 23MB load). */
export function warmupEmbeddings(): void {
  void getExtractor().catch(() => {});
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
  for (let i = 0; i < a.length && i < b.length; i++) d += a[i]! * b[i]!;
  return d;
}
