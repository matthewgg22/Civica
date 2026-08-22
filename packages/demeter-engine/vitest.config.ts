import { defineConfig } from "vitest/config";
// Engine tests run in node (onnxruntime breaks under a jsdom global — the
// reason the dashboard suite carried per-file @vitest-environment pragmas).
export default defineConfig({ test: { environment: "node" } });
