# Future Feature: My Reps Chatbot

This file parks the My Reps chatbot for a future launch.

## Feature parked
- Entry point: `Chat` floating action button in `MyRepsView`.
- Destination: `GovHelpChatSheetView`.
- Behavior: opens contextual chat support for current reps and ZIP.

## Current launch behavior
- Chat entry is intentionally hidden in
  `Views/MyRepsView.swift` via `isGovHelpChatEnabled = false`.
- The chatbot view implementation remains in the codebase; only the UI entry is paused.

## Restore later
- In `MyRepsView`, set `isGovHelpChatEnabled` to `true` and keep the existing
  `.safeAreaInset` + `.sheet` wiring.
