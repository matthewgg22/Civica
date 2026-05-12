import Foundation

// Hand-rotated PIN that gates the AdminInterviewExportView reached
// via the long-press gesture on the waiting-room footer. NOT a
// security boundary — the binary is shipped to applicants whose
// devices Civica's founder may physically borrow at enrollment
// events. The PIN just keeps casual users out of the export sheet.
//
// Rotation: change this constant in source, rebuild, redistribute.
// No remote config, no Keychain — the threat model is "someone
// noticed the hidden long-press," not "a determined attacker
// extracted the binary."
//
// TODO: Move this to a build-time xcconfig secret before any
// external pilot beyond the founder's own MA cohort, so the value
// doesn't ship in source control.

enum AdminPIN {
    static let current: String = "490321"
}
