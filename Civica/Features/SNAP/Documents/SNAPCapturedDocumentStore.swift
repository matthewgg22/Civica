import Foundation
import UIKit

// On-device store for documents captured via the iOS document camera.
// Saves JPEG-compressed images to the app's documents directory keyed
// by SNAPDocumentType so they survive across launches but get wiped
// on app uninstall (no iCloud sync, no iTunes backup of personal IDs).
//
// This is intentionally local-only for v1. The Phase E backend hand-off
// (upload to Supabase Storage + OCR via SNAPNetworkClient.uploadDocument)
// lives on the conversation module that the Civica target excludes;
// when that ships, this store becomes the staging area that the
// uploader pulls from.

enum SNAPCapturedDocumentStore {

    /// JPEG compression — quality vs file size. 0.85 keeps paystub
    /// text readable on a typical 12MP iPhone shot while staying under
    /// 1.5 MB per page on average.
    private static let jpegQuality: CGFloat = 0.85

    private static var directory: URL {
        // Caches dir works too but Documents dir is the user-visible
        // path the system will preserve. We use a subfolder so the
        // top-level documents directory isn't polluted.
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let folder = docs.appendingPathComponent("CivicaCapturedDocuments", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    static func fileURL(for type: SNAPDocumentType) -> URL {
        directory.appendingPathComponent("civica-snap-\(type.rawValue).jpg", isDirectory: false)
    }

    /// Save an image as the canonical capture for a document type.
    /// Overwrites any prior capture for the same type.
    @discardableResult
    static func save(_ image: UIImage, as type: SNAPDocumentType) -> URL? {
        guard let data = image.jpegData(compressionQuality: jpegQuality) else { return nil }
        let url = fileURL(for: type)
        do {
            try data.write(to: url, options: [.atomic, .completeFileProtectionUnlessOpen])
            return url
        } catch {
            return nil
        }
    }

    /// True when a previously-captured image exists on disk for this type.
    static func hasCapture(for type: SNAPDocumentType) -> Bool {
        FileManager.default.fileExists(atPath: fileURL(for: type).path)
    }

    /// Load the captured image as a UIImage for thumbnail display.
    /// Returns nil when no capture exists or the file can't be read.
    static func loadImage(for type: SNAPDocumentType) -> UIImage? {
        let url = fileURL(for: type)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    /// Delete the captured image for a type. Used when the user
    /// re-takes or clears their selection.
    static func delete(_ type: SNAPDocumentType) {
        try? FileManager.default.removeItem(at: fileURL(for: type))
    }

    /// Wipe every captured image. Called when the user taps "Start
    /// over" on the review surface — they get the same clean slate
    /// for documents that they get for their answers.
    static func clearAll() {
        let dir = directory
        guard let contents = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { return }
        for url in contents {
            try? FileManager.default.removeItem(at: url)
        }
    }

    /// Delete any packet PDFs left in the system temp directory from
    /// prior "Generate packet" runs. These are not cleaned up by the OS
    /// until a reboot; call on reset so a fresh start leaves no trace.
    static func clearPacketPDFs() {
        let tmp = FileManager.default.temporaryDirectory
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: tmp, includingPropertiesForKeys: nil
        ) else { return }
        for url in contents where url.lastPathComponent.hasPrefix("civica-snap-summary-") {
            try? FileManager.default.removeItem(at: url)
        }
    }
}
