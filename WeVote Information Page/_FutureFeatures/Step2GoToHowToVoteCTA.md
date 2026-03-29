# Future Feature: Registration Step 2 CTA

This file parks the Step 2 CTA feature for a future launch.

## Feature parked
- Card: `Get Out to Vote!` (Registration Step 2)
- CTA text: `Go to How to Vote`
- Behavior: Open the How to Vote tab (`.goToHowToVoteTab`)

## Current launch behavior
- The Step 2 CTA button is intentionally hidden in
  `Views/SecondNavigationBarView/VoterRegistrationView.swift`.
- The card content remains live; only the CTA is paused.

## Restore later
In `registrationCard(_:)`, update the action-rendering guard to allow `.thenVote` again.
