# Future Feature: Election Timeline MAPV CTA

The Election Timeline card-level `Make a Plan to Vote` CTA (and its pending subtitle)
has been moved out of the active timeline UI.

Current status:
- The timeline cards no longer show:
  - `Make a Plan to Vote`
  - `MAPV becomes active on %@.`
- Election cards now focus on election details, countdown, party badge, and ballot info.

Code path updated:
- `WeVote Information Page/Views/FirstNavigationBarView/ElectionTimelineView.swift`
  - removed the timeline MAPV button block
  - removed timeline MAPV pending subtitle block
  - removed timeline-local MAPV sheet/alert wiring used by that CTA

To re-enable later:
1. Reintroduce the MAPV CTA block in `electionCard(_:index:)`.
2. Restore timeline-local MAPV state and modal wiring.
3. Reconnect the pending activation subtitle messaging.
