import Foundation
import UIKit

// Read-only view onto SNAPCapturedDocumentStore.
//
// New features (Recertification Companion, in particular) need to
// inspect the user's captured documents without owning the storage
// surface or mutating it. This sibling enum exposes only read calls,
// keyed by the same SNAPDocumentType used everywhere else.
//
// Capture date comes from the file's content-modification timestamp,
// which is the most reliable proxy for "when the user took this photo"
// short of writing a separate sidecar metadata file. Re-capturing a
// document overwrites the JPEG, which moves the mtime forward — the
// right behavior for staleness math.

enum SNAPDocumentVaultReader {
    /// True when the vault contains a JPEG for `type`.
    static func hasDocument(_ type: SNAPDocumentType) -> Bool {
        SNAPCapturedDocumentStore.hasCapture(for: type)
    }

    /// Image for thumbnail or full-screen display. Nil when no
    /// capture exists or the file is unreadable.
    static func loadImage(_ type: SNAPDocumentType) -> UIImage? {
        SNAPCapturedDocumentStore.loadImage(for: type)
    }

    /// When the current image for `type` was last written (i.e. when
    /// the user captured or recaptured it). Nil when no capture exists.
    /// Used by the Recertification Companion to decide whether a
    /// document is stale relative to the next recert window.
    static func captureDate(for type: SNAPDocumentType) -> Date? {
        let url = SNAPCapturedDocumentStore.fileURL(for: type)
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path) else {
            return nil
        }
        return attrs[.modificationDate] as? Date
    }

    /// Every document type the user has captured at least once,
    /// paired with its capture date. Stable order: enum case order.
    static func allCaptured() -> [(type: SNAPDocumentType, capturedAt: Date)] {
        SNAPDocumentType.allCases.compactMap { type in
            guard let date = captureDate(for: type) else { return nil }
            return (type, date)
        }
    }
}
