// Hydration / readiness gate (V1-6, #315).
//
// BenefitsCal is a React SPA. It both hard-navigates between steps AND can
// soft-update the DOM in place. If the content script runs its fill loop
// against a not-yet-hydrated DOM, every field resolves to "not found" and the
// fill silently no-ops. This gate waits for the target fields to actually
// exist before we fill — a short MutationObserver-backed poll with a timeout.
//
// Pure DOM + a tiny timer. Browser-safe; no chrome.* and no /core driver imports.

/**
 * Resolve once `predicate(root)` returns true, or reject-ish (resolve `false`)
 * after `timeoutMs`. Checks immediately, then on every DOM mutation under
 * `root`, with a fallback interval poll (covers attribute-only hydration that a
 * childList observer might miss, and environments without MutationObserver).
 *
 * Returns `true` if the predicate became satisfied within the window, `false`
 * on timeout. Never throws.
 */
export function waitFor(
  predicate: (root: ParentNode) => boolean,
  opts: { root?: ParentNode; timeoutMs?: number; pollMs?: number } = {},
): Promise<boolean> {
  const root = opts.root ?? document;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const pollMs = opts.pollMs ?? 100;

  // Fast path — already there.
  if (predicate(root)) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let done = false;
    let observer: MutationObserver | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: boolean): void => {
      if (done) return;
      done = true;
      if (observer) observer.disconnect();
      if (interval !== null) clearInterval(interval);
      if (timer !== null) clearTimeout(timer);
      resolve(result);
    };

    const check = (): void => {
      let ok = false;
      try {
        ok = predicate(root);
      } catch {
        ok = false;
      }
      if (ok) finish(true);
    };

    // MutationObserver fires on DOM changes; the interval is a belt-and-braces
    // fallback for attribute-only hydration and non-DOM-mutation re-renders.
    const observeTarget =
      root instanceof Document ? root.documentElement : (root as Node);
    if (typeof MutationObserver !== "undefined" && observeTarget) {
      observer = new MutationObserver(check);
      observer.observe(observeTarget, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }
    interval = setInterval(check, pollMs);
    timer = setTimeout(() => finish(false), timeoutMs);
  });
}
