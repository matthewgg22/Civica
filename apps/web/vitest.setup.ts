// Testing Library's async gate, set deliberately instead of inherited.
//
// waitFor defaults to 1000ms. Measured against the DemeterChat suites, which
// drive the real component through 8-24 sequential round-trips, each gated on
// the paced-streaming reveal finishing (STREAM_TICK_MS = 34, ~40 chars/sec at
// rest):
//
//     idle machine, 14 gates:  min 338ms   median 537ms   max 795ms
//
// 795 against 1000 is 80% of the budget consumed with nothing else running,
// and the gates grow as the transcript does — the last are roughly twice the
// first, because every turn re-renders more DOM. Multiply by ~20 gates per
// test, several such tests, and other files running concurrently, and at
// least one gate losing the race stops being unlikely. That is #1018: a
// different test failing each full run, every one of them passing alone.
//
// 5000ms is ~6x the worst observed gate, and still fails a genuine hang well
// inside the 30s these tests set for themselves (#892, after #890 and #896
// flaked on the 5s default).
//
// NOT A FIX FOR SLOWNESS. The suites are slow because they do 20 real
// round-trips; that is #1018's other half and wants fake timers or a seeded
// transcript. This stops the slowness from being FLAKY, which is the part
// that costs people time.
// Imported from @testing-library/react, which re-exports it. The dom package
// is only a transitive dependency here, and pnpm's strict layout will not
// resolve a direct import of something the manifest does not declare.
import { configure } from "@testing-library/react";

// The config is process-wide, but only DOM suites use it — node-environment
// files import this too, and configure() is inert for them.
configure({ asyncUtilTimeout: 5000 });
