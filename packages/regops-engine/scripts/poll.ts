#!/usr/bin/env bun
// Production polling-loop entrypoint.
//
// Invoked by .github/workflows/regops-poll.yml on cron schedule.
// Defers all logic to runCli() so tests can drive the same code path
// without spawning a child process.

import { runCli } from "../src/polling/cli.js";

const code = await runCli();
process.exit(code);
