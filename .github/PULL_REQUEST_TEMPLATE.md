## Summary

<!-- 1-3 bullets describing what changed and why. -->

## Did you update mocks / test fixtures?

- [ ] If this PR changes a protocol, enum, or shared interface — I checked that test mocks and fixtures still compile (iOS: `xcodebuild build-for-testing`; TS: `pnpm run typecheck` in affected packages).
- [ ] If this PR changes a regulatory threshold (income limit, benefit amount, etc.) — I updated the boundary tests.
- [ ] If unsure — the `iOS — test target compiles` and `TS — typecheck` CI checks will catch it.

## Test plan

<!-- How was this verified? CI checks, manual steps, screenshots, etc. -->
