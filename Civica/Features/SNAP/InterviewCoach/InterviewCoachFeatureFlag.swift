import Foundation

// EXPERIMENTAL SILOED MODULE:
// Interview Coach is a SNAP sub-feature. Gated on SNAP_DEV so it ships with
// the same dev build as the rest of SNAP. If we ever need to expose SNAP
// without Coach, split this onto its own compilation condition.
enum InterviewCoachFeatureFlag {
    #if SNAP_DEV
    static let isEnabled = true
    #else
    static let isEnabled = false
    #endif
}
