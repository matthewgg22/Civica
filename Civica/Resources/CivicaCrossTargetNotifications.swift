import Foundation

// Civica-side declarations of Notification.Name values that the
// legacy SNAP screens (SNAPEntryView, SNAPEligibilityIntroView)
// post but whose canonical definition lives in the VoteNow target's
// SharedUI.swift. The notifications are no-ops in the Civica app —
// nothing in this target listens — but the call sites need a Name
// in scope to compile.
//
// When the legacy SNAP views are deleted in a future cleanup, this
// file goes with them.

extension Notification.Name {
    static let openMyInfoPanel = Notification.Name("openMyInfoPanel")
}
