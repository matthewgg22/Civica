# My Info Party Affiliation Slider (Parked)

Status: moved out of active UI on April 9, 2026.

Reason:
- Requested to move the party registration slider into Future Features.
- Active `MyInfoPanelView` now focuses on address, language/accessibility, and feedback.

What changed:
- Removed the party-affiliation section from `Views/MyInfoPanelView.swift`.
- Removed the embedded `PartyAffiliationToggle` component from that file.
- Kept `planVM.selectedParty` model support unchanged for future reactivation.

Re-enable plan (future):
1. Re-add a Party section in `MyInfoPanelView`.
2. Reintroduce `PartyAffiliationToggle` as a reusable view.
3. Reconnect bindings to `planVM.selectedParty`.
