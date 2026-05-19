import Foundation

// Hand-rotated PIN that gates the AdminInterviewExportView reached
// via the long-press gesture on the waiting-room footer. NOT a
// security boundary — the binary is shipped to applicants whose
// devices Civica's founder may physically borrow at enrollment
// events. The PIN just keeps casual users out of the export sheet.
//
// Rotation: update ADMIN_PIN in Civica/Configuration/Secrets.xcconfig
// (gitignored), rebuild, redistribute. No remote config, no Keychain —
// the threat model is "someone noticed the hidden long-press," not "a
// determined attacker extracted the binary."
//
// The value is injected at build time via Civica/Configuration/Secrets.xcconfig
// → Info.plist → Bundle, so it no longer ships in source control.

enum AdminPIN {
    static let current: String =
        Bundle.main.object(forInfoDictionaryKey: "ADMIN_PIN") as? String ?? ""
}
